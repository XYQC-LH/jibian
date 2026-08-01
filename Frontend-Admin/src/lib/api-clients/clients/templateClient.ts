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
}
