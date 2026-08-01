export interface ApiErrorOptions {
  status?: number;
  details?: unknown;
  cause?: unknown;
}

export class ApiError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, options?: ApiErrorOptions) {
    super(message);
    this.name = 'ApiError';
    this.status = options?.status;
    this.details = options?.details;
    if (options?.cause) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export class NetworkError extends ApiError {
  constructor(message = 'Network connection failed', options?: ApiErrorOptions) {
    super(message, options);
    this.name = 'NetworkError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Session expired, please login again', options?: ApiErrorOptions) {
    super(message, options);
    this.name = 'UnauthorizedError';
    this.status = 401;
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(message = 'Service is temporarily unavailable', options?: ApiErrorOptions) {
    super(message, options);
    this.name = 'ServiceUnavailableError';
    this.status = 503;
  }
}

/** 从 unknown 错误对象中提取消息文本。支持 Error、字符串、Axios 嵌套结构。 */
export const getErrorMessage = (error: unknown, defaultMessage = '操作失败'): string => {
  if (!error) return defaultMessage
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (typeof error === 'object') {
    const obj = error as Record<string, unknown>
    const response = obj.response as Record<string, unknown> | undefined
    const data = response?.data as Record<string, unknown> | undefined
    if (typeof data?.error === 'string') return data.error
    if (typeof obj.message === 'string') return obj.message
  }
  return defaultMessage
}

/** 从 unknown 错误对象中提取 HTTP 状态码。 */
export const getErrorStatus = (error: unknown): number | undefined => {
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>
    if (typeof obj.status === 'number') return obj.status
    const response = obj.response as Record<string, unknown> | undefined
    if (response && typeof response.status === 'number') return response.status
  }
  return undefined
}

/** 从 unknown 错误对象中提取错误码（如 NETWORK_ERROR）。 */
export const getErrorCode = (error: unknown): string | undefined => {
  if (error && typeof error === 'object') {
    return (error as Record<string, unknown>).code as string | undefined
  }
  return undefined
}
