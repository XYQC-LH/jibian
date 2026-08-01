import type { Task } from './types-task';

// Model Routes（模型层 -> 源头层）相关类型
export interface ModelRoute {
  id: number;
  operation: string;
  model_id: string;
  source_id?: string | number | null;
  vendor?: string | null;
  display_name?: string;
  upstream_model_name?: string | null;
  priority: number;
  weight: number;
  expected_cost: number;
  timeout_ms?: number | null;
  first_commit_timeout_ms?: number | null;
  is_enabled: boolean;
  circuit_breaker_policy?: Record<string, unknown>;
  config?: Record<string, unknown>;
  runtime?: {
    circuit_state?: 'open' | 'half_open' | 'closed' | string;
    open_until?: string | null;
  };
  created_at?: string;
  updated_at?: string;
}

export interface DispatchOverview {
  window_hours: number;
  total_attempts: number;
  success_rate: number;
  by_status: Record<string, number>;
  by_error_type: Record<string, number>;
  by_source: Array<{
    source_id: string;
    total: number;
    success: number;
    failure: number;
    success_rate: number;
  }>;
  open_circuits: {
    routes: number;
    half_open_routes: number;
  };
  updated_at?: string;
}

export interface DispatchSourceStatsItem {
  model_id: string;
  source_id: string;
  total: number;
  success: number;
  failure: number;
  success_rate: number;
}

export interface DispatchSourceStatsResponse {
  window_hours: number;
  total: number;
  items: DispatchSourceStatsItem[];
  updated_at?: string;
}

export interface DispatchRouteRuntime extends ModelRoute {
  runtime: {
    circuit_state: 'open' | 'half_open' | 'closed';
    open_until?: string | null;
  };
  pricing_display_mode?: 'single' | 'range' | 'unknown';
  pricing_display_value_cny?: number | null;
  pricing_display_min_cny?: number | null;
  pricing_display_max_cny?: number | null;
}

export interface SourceRuntimeProfile {
  source_id: string;
  module_path: string;
  model_id: string;
  display_name: string;
  is_enabled?: boolean | null;
  is_active: boolean;
  logical_is_enabled?: boolean;
  updated_at?: string | null;
}

export interface SourceRuntimeProfilePatchRequest {
  display_name?: string;
  is_enabled?: boolean | null;
}

export interface DispatchAttemptItem {
  id: number;
  task_id?: number | null;
  operation: string;
  model_id: string;
  source_id?: string | null;
  upstream_model_name?: string | null;
  attempt_no: number;
  status: string;
  error_type?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  latency_ms?: number | null;
  commit_at?: string | null;
  extra?: Record<string, unknown>;
  created_at?: string | null;
}

export interface DispatchTaskTimelineTaskInfo {
  id: number;
  status: string;
  error_code?: string | null;
  error_message?: string | null;
  created_at?: string | null;
  started_at?: string | null;
  updated_at?: string | null;
  finished_at?: string | null;
}

export interface DispatchTaskTimelineSourceRunInfo {
  source_run_id?: number | null;
  upstream_job_id?: string | null;
  source_callback?: string | null;
}

export interface DispatchTaskTimelineEventItem {
  id: number;
  event_type: string;
  occurred_at?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface DispatchTaskTimeline {
  task: DispatchTaskTimelineTaskInfo;
  source_run: DispatchTaskTimelineSourceRunInfo;
  attempts: DispatchAttemptItem[];
  events: DispatchTaskTimelineEventItem[];
}

export interface TaskRequestItem {
  id: number;
  user_id?: number | null;
  user_email?: string | null;
  request_type?: string;
  model_id?: string | null;
  source?: string | null;
  idempotency_key?: string | null;
  trace_id?: string | null;
  status: string;
  task_id?: number | null;
  credits_cost?: number;
  error_code?: string | null;
  error_message?: string | null;
  meta?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface TaskRequestDetail extends TaskRequestItem {
  task?: Task;
}

export interface TaskRequestOverviewModelStat {
  model_id: string;
  request_count: number;
  success_count: number;
  failure_count: number;
  credits_cost: number;
  success_rate: number;
  failure_rate: number;
}

export interface TaskRequestOverviewErrorItem {
  request_id: number;
  user_email?: string | null;
  model_id?: string | null;
  source?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  trace_id?: string | null;
  created_at?: string | null;
}

export interface TaskRequestOverview {
  total_requests: number;
  success_count: number;
  failure_count: number;
  in_progress_count: number;
  duplicated_count: number;
  total_credits_cost: number;
  success_rate: number;
  failure_rate: number;
  top_models: TaskRequestOverviewModelStat[];
  recent_errors: TaskRequestOverviewErrorItem[];
}

export interface SourceProvider {
  id: string;
  model_id: string;
  upstream_model_name?: string | null;
  base_url?: string | null;
  api_key_ref?: string | null;
  credentials?: Record<string, unknown>;
  param_mapping?: Record<string, unknown>;
  priority: number;
  weight: number;
  expected_cost: number;
  constraints?: Record<string, unknown>;
  config?: Record<string, unknown>;
  circuit_breaker_policy?: Record<string, unknown>;
  traffic_tier: 'all' | 'vip' | 'normal' | string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
