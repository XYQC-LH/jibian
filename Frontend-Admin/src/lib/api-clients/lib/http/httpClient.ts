import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { ApiError, NetworkError, ServiceUnavailableError, UnauthorizedError } from './errors';

const API_TIMEOUT = 30000;
const isBrowser = typeof window !== 'undefined';
const ADMIN_SESSION_EXPIRED_EVENT = 'jibian:admin-session-expired';

const normalizeBaseURL = (raw?: string | null) => {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
};

const resolveServerBaseURL = (): string => {
  const internal = normalizeBaseURL(process.env.API_INTERNAL_URL);
  if (internal) return internal;
  return process.env.NODE_ENV === 'production' ? 'http://backend:8000' : 'http://localhost:8000';
};

const baseURL = isBrowser ? '' : resolveServerBaseURL();

const httpClient: AxiosInstance = axios.create({
  baseURL,
  timeout: API_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

const mapAxiosResponseError = (error: AxiosError): ApiError => {
  const status = error.response?.status;
  const data = error.response?.data as Record<string, unknown>;
  const message = (data?.error as string) || (data?.message as string) || error.message || 'Request failed';

  if (status === 401) return new UnauthorizedError(message, { details: data, cause: error });
  if (status === 503) return new ServiceUnavailableError(message, { cause: error });
  return new ApiError(message, { status, details: data, cause: error });
};

const mapAxiosError = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error;
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      if (error.code === 'ECONNABORTED') return new NetworkError('Request timed out', { cause: error });
      return new NetworkError(error.message || 'Network error', { cause: error });
    }
    return mapAxiosResponseError(error);
  }
  return new ApiError((error as Error)?.message || 'Unexpected error', { cause: error });
};

// ── Token refresh state ──
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason: unknown) => void }> = [];

function processQueue(error: unknown): void {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(undefined);
    }
  });
  failedQueue = [];
}

function notifySessionExpired(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ADMIN_SESSION_EXPIRED_EVENT));
  }
}

// ── Response interceptor: map errors + 401 auto-refresh ──
httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!originalRequest) {
      return Promise.reject(mapAxiosError(error));
    }

    // 401 handling with token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Auth endpoints are handled by their callers. Retrying `/me` during the
      // initial auth probe can emit a stale session-expired event after login.
      const requestUrl = originalRequest.url || '';
      if (
        requestUrl.includes('/login') ||
        requestUrl.includes('/refresh') ||
        requestUrl.includes('/api/v1/auth/admin/me')
      ) {
        return Promise.reject(mapAxiosError(error));
      }

      if (isRefreshing) {
        // Queue concurrent 401 requests to wait for the ongoing refresh
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          originalRequest._retry = true;
          return httpClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await httpClient.post('/api/v1/auth/admin/refresh', {});

        processQueue(null);

        return httpClient(originalRequest);
      } catch (refreshError) {
        const mappedError = mapAxiosError(refreshError);
        processQueue(mappedError);
        notifySessionExpired();
        return Promise.reject(mappedError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(mapAxiosError(error));
  },
);

export { ADMIN_SESSION_EXPIRED_EVENT, httpClient, mapAxiosError };
