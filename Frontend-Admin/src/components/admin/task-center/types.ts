import type {
  NormalizedTaskStatus,
  TaskStatusFilter,
  TaskClass,
} from '@/domain/tasks/types'

export type BackendTaskStatusFilter = TaskStatusFilter
export type TaskStatusType = NormalizedTaskStatus

export interface TaskStats {
  total: number
  completed: number
  failed: number
  generating: number
  pending: number
  avgProcessingTime: number
  successRate: number
}

export interface TrendPoint {
  time: string
  completed: number
  failed: number
  new: number
  otherFailed: number
}

export interface DispatchAttemptItem {
  attempt_no: number
  status: string
  source_id: string | null
  vendor: string | null
}

export interface UIMappedTask {
  id: string
  type: 'image' | 'video' | 'audio' | 'other'
  model: string
  modelName?: string
  etaSeconds?: number
  vendor?: string | null
  sourceId?: string | null
  attempts?: DispatchAttemptItem[] | null
  taskClass: TaskClass
  user: string
  status: TaskStatusType
  progress: number
  duration: string
  cost: number
  createdAt: string
  completedAt?: string
  moderation: {
    input: {
      checked: boolean
      decision: 'pass' | 'block' | 'not_checked' | 'unknown'
      ok: boolean | null
      reason: string | null
      provider: string | null
      checkedAt: string | null
    }
    output: {
      checked: boolean
      decision: 'pass' | 'block' | 'not_checked' | 'unknown'
      ok: boolean | null
      reason: string | null
      provider: string | null
      checkedAt: string | null
    }
    hasBlock: boolean
  }
  purgeError?: string | null
  error?: string
}

export interface ModelPerformanceItem {
  name: string
  tasks: number
  avgTime: number
  successRate: number
  load: number
}

export type { TaskClass }
