import { AxiosInstance } from 'axios';
import {
  ApiResponse,
  ModelRoute,
  DispatchOverview,
  DispatchSourceStatsResponse,
  DispatchRouteRuntime,
  DispatchAttemptItem,
  DispatchTaskTimeline,
  TaskRequestItem,
  TaskRequestDetail,
  TaskRequestOverview,
  SourceRuntimeProfile,
  SourceRuntimeProfilePatchRequest,
  SourceProvider,
  PaginatedResponse,
} from '../types';
import { BaseAdminClient, buildQueryUrl, ensureData } from './_base';

export class DispatchAdminClient extends BaseAdminClient {
  constructor(client: AxiosInstance) {
    super(client);
  }

  async listModelRoutes(filters: {
    operation?: string;
    model_id?: string;
    source_id?: string;
    enabled?: boolean;
  } = {}): Promise<ModelRoute[]> {
    const url = buildQueryUrl('/api/v1/admin/model-routes', filters);
    const response = await this.client.get<ApiResponse<{ items: ModelRoute[]; total: number }>>(url);
    const data = ensureData(response.data, 'Failed to fetch model routes');
    return data?.items || [];
  }

  async getDispatchOverview(hours = 24): Promise<DispatchOverview> {
    const response = await this.client.get<ApiResponse<DispatchOverview>>(
      `/api/v1/admin/dispatch/overview?hours=${hours}`,
    );
    return ensureData(response.data, 'Failed to fetch dispatch overview');
  }

  async getDispatchSourceStats(
    hours = 24,
    filters: {
      model_id?: string;
      source_id?: string;
    } = {},
  ): Promise<DispatchSourceStatsResponse> {
    const url = buildQueryUrl('/api/v1/admin/dispatch/source-stats', {
      hours: String(hours),
      ...filters,
    });
    const response = await this.client.get<ApiResponse<DispatchSourceStatsResponse>>(url);
    return ensureData(response.data, 'Failed to fetch dispatch source stats');
  }

  async listDispatchRoutes(filters: {
    operation?: string;
    model_id?: string;
    source_id?: string;
    enabled?: boolean;
  } = {}): Promise<DispatchRouteRuntime[]> {
    const url = buildQueryUrl('/api/v1/admin/dispatch/routes', filters);
    const response = await this.client.get<ApiResponse<{ items: DispatchRouteRuntime[]; total: number }>>(url);
    const data = ensureData(response.data, 'Failed to fetch dispatch routes');
    return data?.items || [];
  }

  async listDispatchAttempts(params: {
    task_id?: number;
    source_id?: string;
    status?: string;
    error_type?: string;
    limit?: number;
  } = {}): Promise<{ items: DispatchAttemptItem[]; total: number }> {
    const url = buildQueryUrl('/api/v1/admin/dispatch/attempts', params);
    const response = await this.client.get<ApiResponse<{ items: DispatchAttemptItem[]; total: number }>>(url);
    const data = ensureData(response.data, 'Failed to fetch dispatch attempts');
    return { items: data?.items || [], total: data?.total ?? 0 };
  }

  async listSourceProviders(filters: {
    model_id?: string;
    source_id?: string;
    vendor?: string;
    traffic_tier?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<SourceProvider[]> {
    const url = buildQueryUrl('/api/v1/admin/source-providers', filters);
    const response = await this.client.get<ApiResponse<SourceProvider[]>>(url);
    return ensureData(response.data, 'Failed to fetch source providers') || [];
  }

  async syncSourceProvidersFromRegistry(options: {
    bootstrap?: boolean;
    force_refresh?: boolean;
  } = {}): Promise<{
    bootstrap: boolean;
    force_refresh: boolean;
    scanned: number;
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
  }> {
    const url = buildQueryUrl('/api/v1/admin/source-providers/sync-from-registry', {
      bootstrap: options.bootstrap ?? true,
      force_refresh: options.force_refresh ?? false,
    });
    const response = await this.client.post<ApiResponse<{
      bootstrap: boolean;
      force_refresh: boolean;
      scanned: number;
      created: number;
      updated: number;
      skipped: number;
      errors: string[];
    }>>(url);
    return ensureData(response.data, 'Failed to sync source providers from registry');
  }

  async listSourceRuntimeProfiles(): Promise<SourceRuntimeProfile[]> {
    const response = await this.client.get<ApiResponse<{ items: SourceRuntimeProfile[]; total: number }>>(
      '/api/v1/admin/source-runtime-profiles',
    );
    const data = ensureData(response.data, 'Failed to fetch source runtime profiles');
    return data?.items || [];
  }

  async patchSourceRuntimeProfile(
    sourceId: string,
    payload: SourceRuntimeProfilePatchRequest,
  ): Promise<SourceRuntimeProfile> {
    const response = await this.client.patch<ApiResponse<SourceRuntimeProfile>>(
      `/api/v1/admin/source-runtime-profiles/${encodeURIComponent(sourceId)}`,
      payload,
    );
    return ensureData(response.data, 'Failed to patch source runtime profile');
  }

  async listTaskRequests(params: {
    page?: number;
    page_size?: number;
    status?: string;
    user?: string;
    model_id?: string;
    source?: string;
    trace_id?: string;
    task_id?: number;
    from?: string;
    to?: string;
  } = {}): Promise<PaginatedResponse<TaskRequestItem>> {
    const url = buildQueryUrl('/api/v1/admin/task-requests', params);
    const response = await this.client.get<ApiResponse<PaginatedResponse<TaskRequestItem>>>(url);
    return ensureData(response.data, 'Failed to fetch task requests');
  }

  async getTaskRequest(requestId: number): Promise<TaskRequestDetail> {
    const response = await this.client.get<ApiResponse<TaskRequestDetail>>(`/api/v1/admin/task-requests/${requestId}`);
    return ensureData(response.data, 'Failed to fetch task request detail');
  }

  async getDispatchTaskTimeline(taskId: number): Promise<DispatchTaskTimeline> {
    const response = await this.client.get<ApiResponse<DispatchTaskTimeline>>(
      `/api/v1/admin/dispatch/tasks/${encodeURIComponent(String(taskId))}/timeline`,
    );
    return ensureData(response.data, 'Failed to fetch dispatch task timeline');
  }

  async getTaskRequestOverview(params: {
    status?: string;
    user?: string;
    model_id?: string;
    source?: string;
    trace_id?: string;
    task_id?: number;
    from?: string;
    to?: string;
  } = {}): Promise<TaskRequestOverview> {
    const url = buildQueryUrl('/api/v1/admin/task-requests/overview', params);
    const response = await this.client.get<ApiResponse<TaskRequestOverview>>(url);
    return ensureData(response.data, 'Failed to fetch task request overview');
  }
}
