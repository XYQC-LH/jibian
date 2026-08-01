export {
  ApiError,
  NetworkError,
  ServiceUnavailableError,
  UnauthorizedError,
  getErrorMessage,
  getErrorStatus,
  getErrorCode,
} from '@/lib/api-clients/lib/http/errors';
export type { ApiErrorOptions } from '@/lib/api-clients/lib/http/errors';

export const isAuthError = (error: unknown): boolean => {
  if (!error) return false;
  const status = (error as { status?: unknown }).status;
  if (status === 401 || status === 403) return true;

  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden') ||
    normalized.includes('session expired') ||
    normalized.includes('invalid token') ||
    message.includes('401') ||
    message.includes('403')
  );
};

export const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError';
