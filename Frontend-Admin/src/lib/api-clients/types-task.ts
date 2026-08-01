import type { BackendTaskStatus } from '@/domain/tasks/types';
import type { DispatchAttemptItem } from './types-dispatch';

export interface Task {
  id: number | string;
  user_id?: number | null;
  visibility?: {
    user_deleted_at?: string | null;
    admin_deleted_at?: string | null;
  } | null;
  trace_id?: string | null;
  source?: string | null;
  vendor?: string | null;
  source_id?: string | null;
  attempts?: DispatchAttemptItem[] | null;
  upstream_model_name?: string | null;
  operation?: string | null;
  task_entry?: 'base';
  type?: 'image' | 'video' | 'audio' | string;
  status: BackendTaskStatus;
  prompt?: string;
  model_id?: string | null;
  aspect_ratio?: string;
  created_at?: string;
  updated_at?: string;
  started_at?: string;
  finished_at?: string;
  input_payload?: Record<string, unknown>;
  output_payload?: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  thumbnail_url?: string | null;
  error_code?: string;
  user_email?: string;
  username?: string | null;
  moderation?: {
    input: {
      phase: 'input';
      checked: boolean;
      decision: 'pass' | 'block' | 'not_checked' | 'unknown';
      ok: boolean | null;
      reason: string | null;
      provider: string | null;
      checked_at: string | null;
    };
    output: {
      phase: 'output';
      checked: boolean;
      decision: 'pass' | 'block' | 'not_checked' | 'unknown';
      ok: boolean | null;
      reason: string | null;
      provider: string | null;
      checked_at: string | null;
    };
    has_block: boolean;
  };
  admin_invocation_label?: string | null;
  error_message?: string;
  credits_reserved?: number;
  credits_consumed?: number;
  credits_refunded?: number;
  progress?: number;
  webhook_url?: string;
  idempotency_key?: string;
  input_media?: Array<Record<string, unknown>>;
}
