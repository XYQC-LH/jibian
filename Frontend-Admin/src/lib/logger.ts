type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
}

const parseLogLevel = (value: string | undefined): LogLevel | null => {
  const normalized = (value || '').trim().toLowerCase()
  if (
    normalized === 'debug' ||
    normalized === 'info' ||
    normalized === 'warn' ||
    normalized === 'error' ||
    normalized === 'silent'
  ) {
    return normalized
  }
  return null
}

const DEFAULT_LEVEL: LogLevel = process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
const CURRENT_LEVEL: LogLevel =
  parseLogLevel(process.env.NEXT_PUBLIC_LOG_LEVEL) ?? DEFAULT_LEVEL

const canLog = (level: LogLevel): boolean =>
  LEVEL_ORDER[level] >= LEVEL_ORDER[CURRENT_LEVEL]

export const logger = {
  debug: (...args: unknown[]) => {
    if (canLog('debug')) console.debug(...args)
  },
  info: (...args: unknown[]) => {
    if (canLog('info')) console.info(...args)
  },
  warn: (...args: unknown[]) => {
    if (canLog('warn')) console.warn(...args)
  },
  error: (...args: unknown[]) => {
    if (canLog('error')) console.error(...args)
  },
} as const