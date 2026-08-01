import type { Model as SharedModelConfig } from '@/types';

export type AdminModel = Omit<
  SharedModelConfig,
  | 'application_types'
  | 'credits_cost'
  | 'cost_credits'
  | 'display_name'
  | 'description'
  | 'engine_type'
  | 'exposed_fields'
  | 'status'
  | 'usage_count'
  | 'user_fields'
  | 'output_type'
  | 'success_rate'
  | 'order'
  | 'badge_text'
  | 'badge_color'
  | 'is_featured'
  | 'is_new'
  | 'is_hot'
> & {
  application_types: string[];
  application_type_labels: string[];
  credits_cost: number;
  display_name: string;
  description: string;
  cover_url?: string;
  status: 'active' | 'disabled' | 'test';
  usage_count: number;
  success_rate: number;
  order: number;
  badge_text: string | null;
  badge_color: string | null;
  is_featured: boolean;
  is_new: boolean;
  is_hot: boolean;
  model_slug?: string;
};

export type MonitorRange = '1h' | '1d' | '7d';

export interface MonitorTrendPoint {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  active_connections: number;
  queue_size: number;
  database_connections: number;
  timestamp: string;
}

export type ResourceUsage = MonitorTrendPoint;

export interface SystemMonitoringData {
  containers: {
    source: string;
    available: boolean;
    error: string | null;
    sampled_at?: string | null;
    ttl_seconds?: number;
    cache_age_seconds?: number | null;
    stale?: boolean;
    service_settings?: Record<
      string,
      {
        memory_limit_mb?: number;
        worker_concurrency?: number;
        updated_at?: string;
        updated_by?: number;
      }
    >;
    items: Array<{
      service: string;
      container_name: string;
      status: string;
      cpu_percent: number;
      memory_used_mb: number;
      memory_limit_mb: number | null;
      memory_percent: number;
      pids: number | null;
      configured_memory_limit_mb?: number | null;
      configured_worker_concurrency?: number | null;
      worker_service?: boolean;
    }>;
  };
  timestamp: string;
  cpu: {
    usage_percent: number;
    count: number;
    frequency_mhz: number | null;
    load_average: {
      '1min': number;
      '5min': number;
      '15min': number;
    } | null;
  };
  memory: {
    total_gb: number;
    available_gb: number;
    used_gb: number;
    usage_percent: number;
    buffers_gb: number | null;
    cached_gb: number | null;
  };
  disk: {
    total_gb: number;
    used_gb: number;
    free_gb: number;
    usage_percent: number;
    read_bytes_mb: number;
    write_bytes_mb: number;
    read_count: number;
    write_count: number;
  };
  network: {
    bytes_sent_mb: number;
    bytes_recv_mb: number;
    packets_sent: number;
    packets_recv: number;
    active_connections: number;
    total_connections: number;
    interfaces: Record<
      string,
      {
        is_up: boolean;
        speed: number;
        mtu: number;
      }
    >;
  };
  processes: {
    total_count: number;
    current_process_cpu: number;
    current_process_memory_mb: number;
    current_process_memory_percent: number;
  };
  system: {
    boot_time: string;
    uptime_hours: number;
    db_connections: number;
  };
}
