import { AxiosInstance } from 'axios';
import {
  ApiResponse,
  PaginatedResponse,
  OrderInfo,
  OrderStatistics,
  RedemptionCode,
  RedemptionCodeUsage,
  RedemptionStatistics,
} from '../types';
import { BaseAdminClient, ensureData, buildQueryUrl } from './_base';

export class OrderAdminClient extends BaseAdminClient {
  constructor(client: AxiosInstance) {
    super(client);
  }

  async getOrders(page = 1, pageSize = 20, filters?: {
    status?: string;
    user_email?: string;
    payment_method?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<PaginatedResponse<OrderInfo>> {
    const url = buildQueryUrl('/api/v1/admin/orders', {
      page,
      page_size: pageSize,
      status: filters?.status && filters.status !== 'all' ? filters.status : undefined,
      user_email: filters?.user_email,
      payment_method: filters?.payment_method && filters.payment_method !== 'all' ? filters.payment_method : undefined,
      start_date: filters?.start_date,
      end_date: filters?.end_date,
    });
    const response = await this.client.get<ApiResponse<Record<string, unknown>>>(url);
    const payload = ensureData(response.data, 'Failed to fetch orders');
    return {
      items: (payload.items as OrderInfo[]) || [],
      total: (payload.total as number) ?? 0,
      page: (payload.page as number) ?? page,
      page_size: (payload.page_size as number) ?? pageSize,
      total_pages: (payload.total_pages as number) ?? 1,
      has_next: (payload.has_next as boolean) ?? false,
      has_prev: (payload.has_prev as boolean) ?? false,
    };
  }

  async getOrderDetail(orderId: number | string): Promise<OrderInfo> {
    const response = await this.client.get<ApiResponse<OrderInfo>>(
      `/api/v1/admin/orders/${orderId}`
    );
    return ensureData(response.data, 'Failed to fetch order detail');
  }

  async processOrderRefund(orderId: number | string, reason: string): Promise<Record<string, unknown>> {
    const response = await this.client.post<ApiResponse<Record<string, unknown>>>(
      `/api/v1/admin/orders/${orderId}/refund`,
      { reason }
    );
    return ensureData(response.data, 'Failed to process refund');
  }

  async getOrderStatistics(days = 30): Promise<OrderStatistics> {
    const response = await this.client.get<ApiResponse<OrderStatistics>>(
      `/api/v1/admin/orders/statistics/summary?days=${days}`
    );
    return ensureData(response.data, 'Failed to fetch order statistics');
  }

  async getRedemptionCodes(page = 1, pageSize = 20, filters?: {
    status?: string;
    type?: string;
    batch_id?: string;
  }): Promise<PaginatedResponse<RedemptionCode>> {
    const url = buildQueryUrl('/api/v1/admin/redemption-codes', {
      page,
      page_size: pageSize,
      status: filters?.status && filters.status !== 'all' ? filters.status : undefined,
      type: filters?.type && filters.type !== 'all' ? filters.type : undefined,
      batch_id: filters?.batch_id,
    });
    const response = await this.client.get<ApiResponse<Record<string, unknown>>>(url);
    const payload = ensureData(response.data, 'Failed to fetch redemption codes');
    return {
      items: (payload.items as RedemptionCode[]) || [],
      total: (payload.total as number) ?? 0,
      page: (payload.page as number) ?? page,
      page_size: (payload.page_size as number) ?? pageSize,
      total_pages: (payload.total_pages as number) ?? 1,
      has_next: (payload.has_next as boolean) ?? false,
      has_prev: (payload.has_prev as boolean) ?? false,
    };
  }

  async createRedemptionCode(data: {
    code?: string;
    credits: number;
    type: 'single_use' | 'multi_use' | 'time_limited';
    usage_limit?: number;
    expires_at?: string;
    description?: string;
  }): Promise<RedemptionCode> {
    const response = await this.client.post<ApiResponse<RedemptionCode>>(
      '/api/v1/admin/redemption-codes',
      data
    );
    return ensureData(response.data, 'Failed to create redemption code');
  }

  async batchCreateRedemptionCodes(data: {
    count: number;
    credits: number;
    type: 'single_use' | 'multi_use' | 'time_limited';
    usage_limit?: number;
    expires_at?: string;
    description?: string;
    prefix?: string;
  }): Promise<RedemptionCode[]> {
    const response = await this.client.post<ApiResponse<RedemptionCode[]>>(
      '/api/v1/admin/redemption-codes/batch',
      data
    );
    return ensureData(response.data, 'Failed to batch create redemption codes');
  }

  async updateRedemptionCode(codeId: number | string, updates: {
    credits?: number;
    status?: string;
    usage_limit?: number;
    expires_at?: string;
    description?: string;
  }): Promise<RedemptionCode> {
    const response = await this.client.put<ApiResponse<RedemptionCode>>(
      `/api/v1/admin/redemption-codes/${codeId}`,
      updates
    );
    return ensureData(response.data, 'Failed to update redemption code');
  }

  async disableRedemptionCode(codeId: number | string): Promise<Record<string, unknown>> {
    const response = await this.client.post<ApiResponse<Record<string, unknown>>>(
      `/api/v1/admin/redemption-codes/${codeId}/disable`,
      {}
    );
    return ensureData(response.data, 'Failed to disable redemption code');
  }

  async getRedemptionCodeUsages(codeId: number | string, page = 1, pageSize = 20): Promise<PaginatedResponse<RedemptionCodeUsage>> {
    const response = await this.client.get<ApiResponse<Record<string, unknown>>>(
      `/api/v1/admin/redemption-codes/${codeId}/usages?page=${page}&page_size=${pageSize}`
    );
    const payload = ensureData(response.data, 'Failed to fetch redemption code usages');
    return {
      items: (payload.items as RedemptionCodeUsage[]) || [],
      total: (payload.total as number) ?? 0,
      page: (payload.page as number) ?? page,
      page_size: (payload.page_size as number) ?? pageSize,
      total_pages: (payload.total_pages as number) ?? 1,
      has_next: (payload.has_next as boolean) ?? false,
      has_prev: (payload.has_prev as boolean) ?? false,
    };
  }

  async getRedemptionStatistics(): Promise<RedemptionStatistics> {
    const response = await this.client.get<ApiResponse<RedemptionStatistics>>(
      '/api/v1/admin/redemption-codes/statistics'
    );
    return ensureData(response.data, 'Failed to fetch redemption statistics');
  }
}
