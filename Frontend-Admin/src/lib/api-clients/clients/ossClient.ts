import { AxiosInstance } from 'axios';
import {
  ApiResponse,
  OssStatus,
  OssBucketInfo,
  OssObjectInfo,
  OssObjectListResult,
  OssCapacityHistory,
  OssAuditLogEntry,
  OssPresignedUrl,
} from '../types';
import { BaseAdminClient, ensureData, ensureSuccess, buildQueryUrl } from './_base';

export class OssAdminClient extends BaseAdminClient {
  constructor(client: AxiosInstance) {
    super(client);
  }

  // ========== OSS (MinIO + Nginx) ==========

  async getOssStatus(): Promise<OssStatus> {
    const response = await this.client.get<ApiResponse<OssStatus>>('/api/v1/admin/oss/status');
    return ensureData(response.data, 'Failed to fetch OSS status');
  }

  async listOssBuckets(): Promise<OssBucketInfo[]> {
    const response = await this.client.get<ApiResponse<OssBucketInfo[]>>('/api/v1/admin/oss/buckets');
    return ensureData(response.data, 'Failed to list OSS buckets');
  }

  async createOssBucket(payload: { name: string; public_read?: boolean; expire_days?: number }): Promise<OssBucketInfo> {
    const response = await this.client.post<ApiResponse<OssBucketInfo>>('/api/v1/admin/oss/buckets', payload);
    return ensureData(response.data, 'Failed to create OSS bucket');
  }

  async setOssBucketPublic(bucket: string, publicRead: boolean, confirm: string): Promise<Record<string, unknown>> {
    const response = await this.client.put<ApiResponse<Record<string, unknown>>>('/api/v1/admin/oss/bucket/public', {
      bucket,
      public_read: publicRead,
      confirm,
    });
    return ensureData(response.data, 'Failed to set OSS bucket public');
  }

  async setOssBucketLifecycle(bucket: string, expireDays: number | null, confirm: string): Promise<Record<string, unknown>> {
    const response = await this.client.put<ApiResponse<Record<string, unknown>>>('/api/v1/admin/oss/bucket/lifecycle', {
      bucket,
      expire_days: expireDays,
      confirm,
    });
    return ensureData(response.data, 'Failed to set OSS bucket lifecycle');
  }

  async getOssCapacityHistory(days = 30): Promise<OssCapacityHistory> {
    const response = await this.client.get<ApiResponse<OssCapacityHistory>>(`/api/v1/admin/oss/capacity/history?days=${days}`);
    return ensureData(response.data, 'Failed to fetch OSS capacity history');
  }

  async snapshotOssCapacity(): Promise<Record<string, unknown>> {
    const response = await this.client.post<ApiResponse<Record<string, unknown>>>('/api/v1/admin/oss/capacity/snapshot', {});
    return ensureData(response.data, 'Failed to snapshot OSS capacity');
  }

  async listOssAuditLogs(params: { action_prefix?: string; limit?: number; offset?: number } = {}): Promise<OssAuditLogEntry[]> {
    const url = buildQueryUrl('/api/v1/admin/oss/audit', params);
    const response = await this.client.get<ApiResponse<OssAuditLogEntry[]>>(url);
    return ensureData(response.data, 'Failed to list OSS audit logs');
  }

  async listOssObjects(
    bucket: string,
    prefix = '',
    limit = 100,
    continuationToken: string | null = null
  ): Promise<OssObjectListResult> {
    const url = buildQueryUrl('/api/v1/admin/oss/objects', {
      bucket,
      prefix,
      limit,
      continuation_token: continuationToken,
    });
    const response = await this.client.get<ApiResponse<OssObjectListResult>>(url);
    return ensureData(response.data, 'Failed to list OSS objects');
  }

  async presignOssDownload(
    bucket: string,
    key: string,
    expiresSeconds = 3600,
    forceDownload = false,
    s3Key?: string
  ): Promise<OssPresignedUrl> {
    const response = await this.client.post<ApiResponse<OssPresignedUrl>>('/api/v1/admin/oss/presign-download', {
      bucket,
      key,
      s3_key: s3Key || undefined,
      expires_seconds: expiresSeconds,
      force_download: forceDownload,
    });
    return ensureData(response.data, 'Failed to presign OSS download');
  }

  async renewOssUrl(value: string, expiresSeconds = 3600): Promise<OssPresignedUrl> {
    const response = await this.client.post<ApiResponse<OssPresignedUrl>>('/api/v1/admin/oss/renew-url', {
      value,
      expires_seconds: expiresSeconds,
    });
    return ensureData(response.data, 'Failed to renew OSS URL');
  }

  async deleteOssObject(bucket: string, key: string, confirm: string, s3Key?: string): Promise<void> {
    const response = await this.client.delete<ApiResponse<unknown>>('/api/v1/admin/oss/object', {
      data: { bucket, key, confirm, s3_key: s3Key || undefined },
    });
    ensureSuccess(response.data, 'Failed to delete OSS object');
  }
}
