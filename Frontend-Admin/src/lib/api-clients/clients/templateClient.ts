import { AxiosInstance } from 'axios';
import { ApiResponse } from '../types';
import { BaseAdminClient, ensureData } from './_base';

export interface TemplateStatistics {
  total: number;
  published: number;
  offline: number;
  total_usage: number;
  [key: string]: unknown;
}

export interface CreateTemplatePayload {
  name: string;
  category: string;
  cover_asset_id?: string;
  prompt: string;
  price_credits: number;
  result_count: number;
  sort_order: number;
  status: string;
}

export interface AdminTemplate {
  id: string;
  name: string;
  category: string;
  cover_asset_id: string | null;
  prompt: string;
  price_credits: number;
  result_count: number;
  sort_order: number;
  status: string;
  [key: string]: unknown;
}

export interface AdminCoverUploadUrl {
  asset_id: string;
  upload_url: string;
  storage_key: string;
}

export class TemplateAdminClient extends BaseAdminClient {
  constructor(client: AxiosInstance) {
    super(client);
  }

  async getStatistics(): Promise<TemplateStatistics> {
    const response = await this.client.get<ApiResponse<TemplateStatistics>>(
      '/api/v1/admin/templates/statistics'
    );
    return ensureData(response.data, 'Failed to fetch template statistics');
  }

  async createTemplate(payload: CreateTemplatePayload): Promise<AdminTemplate> {
    const response = await this.client.post<ApiResponse<AdminTemplate>>(
      '/api/v1/admin/templates',
      payload
    );
    return ensureData(response.data, 'Failed to create template');
  }

  async createCoverUploadUrl(): Promise<AdminCoverUploadUrl> {
    const response = await this.client.post<ApiResponse<AdminCoverUploadUrl>>(
      '/api/v1/admin/assets/upload-url',
      { asset_type: 'template_cover' }
    );
    return ensureData(response.data, 'Failed to create upload URL');
  }
}
