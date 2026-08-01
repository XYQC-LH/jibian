/* Shared utilities for domain API clients. */
import { AxiosInstance } from 'axios';
import { ApiResponse } from '../types';
import { ApiError } from '../lib/http/errors';

export const ensureData = <T>(payload: ApiResponse<T>, defaultMessage: string): T => {
  if (payload?.success && payload.data !== undefined) {
    return payload.data;
  }
  throw new ApiError(payload?.error || payload?.message || defaultMessage, { details: payload });
};

export const ensureSuccess = (payload: ApiResponse<unknown>, defaultMessage: string): void => {
  if (!payload?.success) {
    throw new ApiError(payload?.error || payload?.message || defaultMessage, { details: payload });
  }
};

export const isApiResponse = <T>(payload: unknown): payload is ApiResponse<T> =>
  Boolean(payload) &&
  typeof payload === 'object' &&
  typeof (payload as { success?: unknown }).success === 'boolean';

export abstract class BaseAdminClient {
  constructor(protected client: AxiosInstance) {}
}

export function buildQueryUrl(
  base: string,
  params?: Record<string, string | number | boolean | undefined | null>,
): string {
  const query = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value));
      }
    }
  }
  const suffix = query.toString();
  return suffix ? `${base}?${suffix}` : base;
}
