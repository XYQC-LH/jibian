export type BackendTaskStatus = 'generating' | 'succeeded' | 'failed'

export type NormalizedTaskStatus =
  | 'pending'
  | 'generating'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'timeout'
  | 'unknown'

export type TaskStatusFilter = 'all' | Exclude<NormalizedTaskStatus, 'unknown'>

export type TaskClass = 'base'

export type TaskEntryCategory = 'base' | 'skill' | 'public_api' | 'user_api' | 'admin'

export type TaskEngineType = 'base' | 'unknown'

export type TaskSourceCategory = TaskEntryCategory

export type TaskSourceEngine = TaskEngineType
