import { AxiosInstance } from 'axios';
import {
  ApiResponse,
  Task,
  PaginatedResponse,
  DispatchAttemptItem,
} from '../types';
import { mapAxiosError } from '../lib/http/httpClient';
import { ApiError } from '../lib/http/errors';
import { BaseAdminClient, ensureData, buildQueryUrl } from './_base';
import type { BackendTaskStatus } from '@/domain/tasks/types';

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const normalizeAdminTaskStatus = (value: unknown): BackendTaskStatus => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'generating' || raw === 'succeeded' || raw === 'failed') {
    return raw
  }
  console.warn('[normalizeAdminTaskStatus] unexpected backend status:', raw)
  return 'failed'
}

const normalizeTaskTypeFromPayload = (task: Record<string, unknown>): Task['type'] => {
  const operation = String(task?.operation || '').trim().toLowerCase();
  if (operation.startsWith('video.')) return 'video';
  if (operation.startsWith('audio.')) return 'audio';
  if (operation.startsWith('image.')) return 'image';

  const outputPayload = asRecord(task?.output_payload);
  const outputBuckets = asRecord(outputPayload?.outputs);
  for (const bucket of ['videos', 'audios', 'images']) {
    const items = Array.isArray(outputBuckets?.[bucket]) ? outputBuckets[bucket] as unknown[] : [];
    if (items.length === 0) continue;
    if (bucket === 'videos') return 'video';
    if (bucket === 'audios') return 'audio';
    return 'image';
  }

  return 'image';
};

const mapAdminTaskRecord = (task: Record<string, unknown>): Task => {
  // eslint-disable-next-line no-restricted-syntax
  const t = task as unknown as Record<string, any>;
  return {
  id: t.id,
  user_id: t.user_id,
  source: t.source ?? null,
  vendor: t.vendor ?? null,
  source_id: t.source_id ?? null,
  attempts: Array.isArray(t.attempts)
    ? (t.attempts as Record<string, unknown>[]).map((attempt) => ({
        attempt_no: Number(attempt?.attempt_no ?? 1),
        status: String(attempt?.status || '').trim().toLowerCase() || 'failed',
        source_id: attempt?.source_id ?? null,
        vendor: attempt?.vendor ?? null,
      })) as unknown as DispatchAttemptItem[]
    : null,
  upstream_model_name: t.upstream_model_name ?? null,
  operation: t.operation ?? null,
  trace_id: t.trace_id ?? null,
  task_entry: t.task_entry ?? 'base',
  status: normalizeAdminTaskStatus(t.status),
  type: typeof t.type === 'string' && (t.type as string).trim() ? t.type as string : normalizeTaskTypeFromPayload(t),
  model_id: t.model_id,
  input_payload: t.input_payload ?? undefined,
  output_payload: t.output_payload ?? undefined,
  result: t.result ?? null,
  thumbnail_url: t.thumbnail_url ?? null,
  error_code: t.error_code ?? undefined,
  error_message: t.error_message,
  credits_reserved: Number(t.credits_reserved ?? 0),
  credits_consumed: Number(t.credits_consumed ?? 0),
  credits_refunded: Number(t.credits_refunded ?? 0),
  webhook_url: t.webhook_url ?? undefined,
  idempotency_key: t.idempotency_key ?? undefined,
  started_at: t.started_at ?? undefined,
  finished_at: t.finished_at ?? undefined,
  created_at: t.created_at,
  updated_at: t.updated_at,
  visibility: t?.visibility && typeof t.visibility === 'object'
    ? {
        user_deleted_at: (t.visibility as Record<string, unknown>)?.user_deleted_at as string | null ?? null,
        admin_deleted_at: (t.visibility as Record<string, unknown>)?.admin_deleted_at as string | null ?? null,
      }
    : undefined,
  user_email: t.user_email,
  username: t.username ?? null,
  moderation: t.moderation,
  progress: typeof t.progress === 'number' ? t.progress : 0,
  admin_invocation_label: t.admin_invocation_label ?? null,
};
}

export class TaskAdminClient extends BaseAdminClient {
  constructor(client: AxiosInstance) {
    super(client);
  }

  // Tasks (admin view)
  async getAdminTasks(page = 1, pageSize = 50, status?: string, userEmail?: string, model?: string): Promise<PaginatedResponse<Task>> {
    const url = buildQueryUrl('/api/v1/admin/tasks', {
      page,
      page_size: pageSize,
      status: status && status !== 'all' ? status : undefined,
      user: userEmail,
      model_id: model,
    });
    const response = await this.client.get<ApiResponse<Record<string, unknown>>>(url);
    const payload = ensureData(response.data, 'Failed to fetch admin tasks');
    const items = (payload.items as unknown[] || []).map((task: unknown) => mapAdminTaskRecord(task as Record<string, unknown>));
    return {
      items,
      total: (payload.total as number) ?? items.length,
      page: (payload.page as number) ?? page,
      page_size: (payload.page_size as number) ?? pageSize,
      total_pages: (payload.total_pages as number) ?? Math.max(1, Math.ceil(((payload.total as number) ?? items.length) / pageSize)),
      has_next: (payload.has_next as boolean) ?? false,
      has_prev: (payload.has_prev as boolean) ?? false,
    };
  }

  async getAdminTask(taskId: string): Promise<Task> {
    const response = await this.client.get<ApiResponse<Record<string, unknown>>>(`/api/v1/admin/tasks/${encodeURIComponent(taskId)}`);
    const task = ensureData(response.data, 'Failed to fetch admin task');
    return mapAdminTaskRecord(task);
  }

  async deleteAdminTask(taskId: string): Promise<void> {
    const response = await this.client.delete<ApiResponse<Record<string, unknown>>>(`/api/v1/admin/tasks/${encodeURIComponent(taskId)}`);
    if (!response.data?.success) {
      throw new ApiError(response.data?.error || response.data?.message || 'Failed to delete task', { details: response.data });
    }
  }

}
