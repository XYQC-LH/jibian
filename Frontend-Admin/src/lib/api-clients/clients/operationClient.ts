import { AxiosInstance } from 'axios';
import { ApiResponse } from '../types';
import { BaseAdminClient, ensureData } from './_base';

export type OperationBannerStatus = 'active' | 'inactive';

export interface OperationHomeBanner {
  id: string;
  title: string;
  image_asset_id: string;
  image_url: string;
  template_id: string;
  sort_order: number;
  status: OperationBannerStatus;
}

export interface OperationConfig {
  home_banners: OperationHomeBanner[];
}

export interface OperationImageUploadUrl {
  asset_id: string;
  upload_url: string;
  storage_key: string;
}

export class OperationAdminClient extends BaseAdminClient {
  constructor(client: AxiosInstance) {
    super(client);
  }

  async getOperationConfig(): Promise<OperationConfig> {
    const response = await this.client.get<ApiResponse<OperationConfig>>('/api/v1/settings/operation');
    return ensureData(response.data, 'Failed to fetch operation config');
  }

  async updateOperationConfig(payload: OperationConfig): Promise<OperationConfig> {
    const response = await this.client.put<ApiResponse<OperationConfig>>('/api/v1/settings/operation', payload);
    return ensureData(response.data, 'Failed to update operation config');
  }

  async createOperationImageUploadUrl(contentType?: string): Promise<OperationImageUploadUrl> {
    const response = await this.client.post<ApiResponse<OperationImageUploadUrl>>(
      '/api/v1/admin/assets/upload-url',
      { asset_type: 'operation_banner', content_type: contentType }
    );
    return ensureData(response.data, 'Failed to create operation image upload URL');
  }
}
