// ========== System Monitoring ==========
export interface SystemMonitorSnapshot {
  cpu: Record<string, unknown>;
  memory: Record<string, unknown>;
  disk: Record<string, unknown>;
  network: Record<string, unknown>;
  load_avg: number[];
  timestamp: string;
}

export interface SystemMonitorHistoryEntry {
  recorded_at: string;
  cpu: Record<string, unknown>;
  memory: Record<string, unknown>;
  disk: Record<string, unknown>;
  network: Record<string, unknown>;
  load_avg: number[];
}

export interface ContainerInfo {
  service: string;
  name: string;
  status: 'running' | 'stopped' | 'restarting' | string;
  memory: Record<string, unknown>;
  cpu_percent: number;
  uptime: string;
  restart_count: number;
}

// ========== OSS ==========
export interface OssStatus {
  available: boolean;
  endpoint: string | null;
  buckets: number;
  total_objects: number;
  total_size_bytes: number;
  [key: string]: unknown;
}

export interface OssBucketInfo {
  name: string;
  created_at?: string;
  object_count?: number;
  size_bytes?: number;
  public_read?: boolean;
  expire_days?: number | null;
  [key: string]: unknown;
}

export interface OssObjectListResult {
  objects: OssObjectInfo[];
  prefix: string;
  bucket: string;
  continuation_token?: string | null;
  is_truncated: boolean;
}

export interface OssObjectInfo {
  key: string;
  size: number;
  etag?: string;
  last_modified?: string;
  url?: string;
  [key: string]: unknown;
}

export interface OssCapacityHistory {
  history: Array<{
    date: string;
    size_bytes: number;
  }>;
  current_size_bytes: number;
  days: number;
}

export interface OssAuditLogEntry {
  id: number;
  action: string;
  bucket: string | null;
  key: string | null;
  operator: string;
  ip_address: string | null;
  created_at: string;
  [key: string]: unknown;
}

export interface OssPresignedUrl {
  url: string;
  expires_at: string;
  method?: string;
  [key: string]: unknown;
}

// ========== Moderation ==========
export interface ModerationOverview {
  total_checked: number;
  pass_count: number;
  block_count: number;
  pass_rate: number;
  period_hours: number;
  [key: string]: unknown;
}

export interface ModerationDashboard {
  recent_events: ModerationEventItem[];
  stats: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ModerationEventItem {
  id: number;
  task_id?: number;
  user_email?: string;
  phase: string;
  decision: string;
  ok: boolean | null;
  reason: string | null;
  provider: string | null;
  created_at: string;
  [key: string]: unknown;
}

export interface ModerationEventList {
  items: ModerationEventItem[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}
