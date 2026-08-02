import type { BackendTaskStatus, NormalizedTaskStatus, TaskStatusFilter } from './types'

const normalizeRawStatus = (value: BackendTaskStatus): BackendTaskStatus => value

export const normalizeTaskStatus = (value: BackendTaskStatus): NormalizedTaskStatus => {
  if (value === 'running') return 'generating'
  if (value === 'generating') return 'generating'
  if (value === 'succeeded') return 'succeeded'
  return 'failed'
}

export const normalizeTaskStatusFilter = (value: unknown): TaskStatusFilter => {
  const candidate = String(value ?? '').trim().toLowerCase()
  if (candidate === 'all') return 'all'

  if (['success', 'completed', 'done', 'finished', 'succeeded'].includes(candidate)) return 'succeeded'
  if (['failed', 'error'].includes(candidate)) return 'failed'
  if (['processing', 'running', 'in_progress', 'in-progress', 'generating'].includes(candidate)) return 'generating'
  if (['pending', 'queued', 'created', 'waiting'].includes(candidate)) return 'pending'
  if (['canceled', 'cancelled', 'aborted', 'stopped'].includes(candidate)) return 'cancelled'
  if (['timeout', 'timed_out', 'timed-out', 'expired'].includes(candidate)) return 'timeout'
  return 'all'
}

export const isTerminalStatus = (status: NormalizedTaskStatus): boolean => {
  return (
    status === 'succeeded' ||
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'timeout'
  )
}

export const toUserTaskStatus = (status: NormalizedTaskStatus): 'generating' | 'succeeded' | 'failed' => {
  if (status === 'succeeded') return 'succeeded'
  if (status === 'failed' || status === 'cancelled' || status === 'timeout') {
    return 'failed'
  }
  return 'generating'
}

export const toAdminTaskStatus = (status: NormalizedTaskStatus): NormalizedTaskStatus => status
