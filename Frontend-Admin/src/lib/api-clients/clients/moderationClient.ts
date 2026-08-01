import { AxiosInstance } from 'axios';
import {
  ApiResponse,
  ModerationOverview,
  ModerationDashboard,
  ModerationEventList,
} from '../types';
import { BaseAdminClient, ensureData, buildQueryUrl } from './_base';

export class ModerationAdminClient extends BaseAdminClient {
  constructor(client: AxiosInstance) {
    super(client);
  }

  async getModerationOverview(range: string): Promise<ModerationOverview> {
    const url = buildQueryUrl('/api/v1/admin/moderation/overview', { range });
    const response = await this.client.get<ApiResponse<ModerationOverview>>(url);
    return ensureData(response.data, 'Failed to fetch moderation overview');
  }

  async getModerationDashboard(limit = 200): Promise<ModerationDashboard> {
    const url = buildQueryUrl('/api/v1/admin/moderation/dashboard', { limit });
    const response = await this.client.get<ApiResponse<ModerationDashboard>>(url);
    return ensureData(response.data, 'Failed to fetch moderation dashboard');
  }

  async updateModerationConfig(payload: { enabled: boolean }): Promise<Record<string, unknown>> {
    const response = await this.client.put<ApiResponse<Record<string, unknown>>>('/api/v1/admin/moderation/config', payload);
    return ensureData(response.data, 'Failed to update moderation config');
  }

  async getModerationEvents(params: {
    range: string;
    page: number;
    pageSize: number;
    phase?: string;
    decision?: string;
    ok?: boolean;
    provider?: string;
    reason?: string;
    taskId?: number;
    userEmail?: string;
  }): Promise<ModerationEventList> {
    const url = buildQueryUrl('/api/v1/admin/moderation/events', {
      range: params.range,
      page: params.page || 1,
      page_size: params.pageSize || 50,
      phase: params.phase,
      decision: params.decision,
      ok: params.ok,
      provider: params.provider,
      reason: params.reason,
      task_id: params.taskId,
      user_email: params.userEmail,
    });
    const response = await this.client.get<ApiResponse<Record<string, unknown>>>(url);
    const payload = ensureData(response.data, 'Failed to fetch moderation events');
    return {
      items: (payload.items as import('../types').ModerationEventItem[]) || [],
      total: (payload.total as number) ?? 0,
      page: (payload.page as number) ?? 1,
      page_size: (payload.page_size as number) ?? 50,
      has_next: (payload.has_next as boolean) ?? false,
    };
  }
}
