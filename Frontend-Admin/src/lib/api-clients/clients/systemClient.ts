import { AxiosInstance } from 'axios';
import {
  ApiResponse,
  User,
  PaginatedResponse,
  SystemConfig,
  SystemMonitorSnapshot,
  ContainerInfo,
} from '../types';
import { normalizeUser } from '../normalizers';
import { ApiError } from '../lib/http/errors';
import { BaseAdminClient, ensureData, ensureSuccess, isApiResponse } from './_base';

const ensureMaybeData = <T>(payload: unknown, defaultMessage: string): T => {
  if (isApiResponse<T>(payload)) {
    return ensureData(payload, defaultMessage);
  }
  if (payload === undefined || payload === null) {
    throw new ApiError(defaultMessage);
  }
  return payload as T;
};

const defaultSystemConfig: SystemConfig = {
  max_concurrent_tasks: 10,
  task_timeout: 900,
  cleanup_interval: 600,
  redis_memory_limit: '512mb',
  database_connections: 10,
  file_storage_limit: '5gb',
};

type UploadedFilePayload = {
  id: number | string;
  url: string;
  filename: string;
};

export class SystemAdminClient extends BaseAdminClient {
  constructor(client: AxiosInstance) {
    super(client);
  }

  async getSystemConfig(): Promise<SystemConfig> {
    return defaultSystemConfig;
  }

  async updateSystemConfig(payload: Partial<SystemConfig>): Promise<SystemConfig> {
    return { ...defaultSystemConfig, ...payload };
  }

  async getHealthStatus(): Promise<Record<string, unknown>> {
    const response = await this.client.get('/health');
    return response.data as Record<string, unknown>;
  }

  // System monitoring
  async getSystemMonitoring(): Promise<SystemMonitorSnapshot> {
    const response = await this.client.get<ApiResponse<SystemMonitorSnapshot>>('/api/v1/admin/system-monitor', {
      timeout: 60000,
    });
    return ensureData(response.data, 'Failed to fetch system monitoring data');
  }

  async getSystemMonitoringHistory(hours = 24, interval = 5): Promise<SystemMonitorSnapshot[]> {
    const response = await this.client.get<ApiResponse<SystemMonitorSnapshot[]>>(
      `/api/v1/admin/system-monitor/history?hours=${hours}&interval=${interval}`,
      {
        timeout: 60000,
      }
    );
    return ensureData(response.data, 'Failed to fetch system monitoring history');
  }

  async getSystemMonitoringRecent(windowSeconds = 3600, stepSeconds = 1): Promise<SystemMonitorSnapshot[]> {
    const response = await this.client.get<ApiResponse<SystemMonitorSnapshot[]>>(
      `/api/v1/admin/system-monitor/recent?window_seconds=${windowSeconds}&step_seconds=${stepSeconds}`,
      {
        timeout: 60000,
      }
    );
    return ensureData(response.data, 'Failed to fetch recent system monitoring data');
  }

  async getSystemMonitoringContainers(refresh = false): Promise<ContainerInfo[]> {
    const response = await this.client.get<ApiResponse<ContainerInfo[]>>(
      `/api/v1/admin/system-monitor/containers?refresh=${refresh ? 'true' : 'false'}`,
      {
        timeout: 60000,
      }
    );
    return ensureData(response.data, 'Failed to fetch container monitoring data');
  }

  async updateServiceContainerMemoryLimit(service: string, memoryLimitMb: number): Promise<ContainerInfo> {
    const response = await this.client.post<ApiResponse<ContainerInfo>>(
      '/api/v1/admin/system-monitor/containers/memory-limit',
      {
        service,
        memory_limit_mb: Math.round(memoryLimitMb),
      },
      {
        timeout: 60000,
      }
    );
    return ensureData(response.data, 'Failed to update container memory limit');
  }

  async updateServiceWorkerConcurrency(service: string, workerConcurrency: number): Promise<ContainerInfo> {
    const response = await this.client.post<ApiResponse<ContainerInfo>>(
      '/api/v1/admin/system-monitor/containers/worker-concurrency',
      {
        service,
        worker_concurrency: Math.round(workerConcurrency),
      },
      {
        timeout: 60000,
      }
    );
    return ensureData(response.data, 'Failed to update worker concurrency');
  }

  // Files
  async uploadImage(file: File, scope?: 'cover'): Promise<UploadedFilePayload> {
    const formData = new FormData();
    formData.append('file', file);

    const url =
      scope === 'cover'
        ? '/api/v1/files/admin/upload-cover'
        : '/api/v1/assets/upload';

    const response = await this.client.post<ApiResponse<UploadedFilePayload>>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return ensureData(response.data, 'Failed to upload file');
  }

  async uploadFile(file: File): Promise<UploadedFilePayload> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post<ApiResponse<UploadedFilePayload>>('/api/v1/assets/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return ensureData(response.data, 'Failed to upload file');
  }

  // Users
  async getAllUsers(page = 1, pageSize = 20): Promise<PaginatedResponse<User>> {
    const response = await this.client.get<ApiResponse<Record<string, unknown>>>(
      `/api/v1/admin/users?page=${page}&page_size=${pageSize}`
    );
    const payload = ensureData(response.data, 'Failed to fetch users');
    const items = ((payload.items as unknown[]) || []).map(normalizeUser);
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

  async updateUserStatus(
    userId: string,
    status: 'active' | 'inactive' | 'banned'
  ): Promise<User> {
    const response = await this.client.post<ApiResponse<unknown> | unknown>(
      `/api/v1/admin/users/${userId}/ban`,
      { is_active: status === 'active' }
    );
    return normalizeUser(ensureMaybeData<Record<string, unknown>>(response.data, 'Failed to update user status'));
  }

  async updateUserAdminNote(userId: string, adminNote: string): Promise<User> {
    const response = await this.client.patch<ApiResponse<unknown> | unknown>(
      `/api/v1/admin/users/${userId}/admin-note`,
      { admin_note: adminNote }
    );
    return normalizeUser(ensureMaybeData<Record<string, unknown>>(response.data, 'Failed to update user admin note'));
  }

  async adjustUserCredits(userId: string, credits: number, _reason?: string): Promise<User> {
    const response = await this.client.post<ApiResponse<unknown> | unknown>(
      `/api/v1/admin/users/${userId}/credits`,
      { delta: credits }
    );
    return normalizeUser(ensureMaybeData<Record<string, unknown>>(response.data, 'Failed to adjust user credits'));
  }

  async createUser(payload: {
    email: string;
    password: string;
    username?: string;
    credits?: number;
  }): Promise<User> {
    const response = await this.client.post<ApiResponse<unknown>>(
      '/api/v1/admin/users',
      {
        email: payload.email,
        password: payload.password,
        username: payload.username,
        credits: payload.credits ?? 0,
      }
    );
    return normalizeUser(ensureData(response.data, 'Failed to create user'));
  }

  async resetUserPassword(userId: string, newPassword: string): Promise<void> {
    const response = await this.client.post<ApiResponse<unknown>>(
      `/api/v1/admin/users/${userId}/password/reset`,
      { new_password: newPassword }
    );
    ensureSuccess(response.data, 'Failed to reset user password');
  }

  async deleteUser(_userId: string): Promise<void> {
    await this.client.delete<ApiResponse<unknown>>(`/api/v1/admin/users/${_userId}`);
  }
}
