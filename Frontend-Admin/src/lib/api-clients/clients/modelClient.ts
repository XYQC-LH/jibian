import { AxiosInstance } from 'axios';
import {
  ApiResponse,
  ModelPricingObservation,
  Model,
  ModelReorderItem,
  ModelUpdateRequest,
  PricingSettings,
  PaginatedResponse,
} from '../types';
import type { ModelPricingObservation as ModelPricingObservationType } from '../types';
import { mapAxiosError } from '../lib/http/httpClient';
import { mapModelResponse } from '../normalizers';
import { BaseAdminClient, ensureData } from './_base';

export class ModelAdminClient extends BaseAdminClient {
  constructor(client: AxiosInstance) {
    super(client);
  }

  async getAllModels(params?: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    modelTypes?: string[];
    skipPricing?: boolean;
  }): Promise<PaginatedResponse<Model>> {
    try {
      const response = await this.client.get<ApiResponse<{
        total?: number;
        items?: Record<string, unknown>[];
        page?: number;
        page_size?: number;
        total_pages?: number;
        has_next?: boolean;
        has_prev?: boolean;
      }>>(
        '/api/v1/model-management/models',
        {
          params: {
            page: params?.page ?? 1,
            page_size: params?.pageSize ?? 20,
            q: params?.keyword?.trim() || undefined,
            model_types: Array.isArray(params?.modelTypes) && params?.modelTypes.length > 0
              ? params?.modelTypes.join(',')
              : undefined,
            skip_pricing: params?.skipPricing ? true : undefined,
          },
        }
      );
      const payload = ensureData(response.data, 'Failed to fetch models');
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const mappedItems = items.map((model: Record<string, unknown>) => mapModelResponse(model));
      const page = Math.max(Number(payload?.page || params?.page || 1), 1);
      const pageSize = Math.max(Number(payload?.page_size || params?.pageSize || 20), 1);
      const total = Math.max(Number(payload?.total || mappedItems.length), 0);
      const totalPages = Math.max(Number(payload?.total_pages || Math.ceil(total / pageSize) || 1), 1);

      return {
        items: mappedItems,
        total,
        page,
        page_size: pageSize,
        total_pages: totalPages,
        has_next: Boolean(payload?.has_next ?? page < totalPages),
        has_prev: Boolean(payload?.has_prev ?? page > 1),
      };
    } catch (error: unknown) {
      throw mapAxiosError(error);
    }
  }

  async updateModelConfig(
    modelId: string,
    payload: ModelUpdateRequest
  ): Promise<Model> {
    try {
      const response = await this.client.put<ApiResponse<Record<string, unknown>>>(
        `/api/v1/model-management/models/${modelId}`,
        payload
      );
      const data = ensureData(response.data, 'Failed to update model config');
      return mapModelResponse(data, modelId, payload?.credits_cost);
    } catch (error: unknown) {
      throw mapAxiosError(error);
    }
  }

  async reorderModels(items: ModelReorderItem[]): Promise<number> {
    try {
      const response = await this.client.post<ApiResponse<{ updated?: number }>>(
        '/api/v1/model-management/models/reorder',
        { items }
      );
      const data = ensureData(response.data, 'Failed to reorder models');
      return Math.max(Number(data?.updated || 0), 0);
    } catch (error: unknown) {
      throw mapAxiosError(error);
    }
  }

  async getPricingSettings(): Promise<PricingSettings> {
    try {
      const response = await this.client.get<ApiResponse<PricingSettings>>(
        '/api/v1/model-management/pricing/settings'
      );
      return ensureData(response.data, 'Failed to fetch pricing settings');
    } catch (error: unknown) {
      throw mapAxiosError(error);
    }
  }

  async updatePricingSettings(payload: { global_pricing_multiplier: number }): Promise<PricingSettings> {
    try {
      const response = await this.client.put<ApiResponse<PricingSettings>>(
        '/api/v1/model-management/pricing/settings',
        payload
      );
      return ensureData(response.data, 'Failed to update pricing settings');
    } catch (error: unknown) {
      throw mapAxiosError(error);
    }
  }

  async getModelPricing(modelId: string): Promise<{ model_id: string; pricing_mode: string; pricing_observation: ModelPricingObservationType | null }> {
    try {
      const response = await this.client.get<ApiResponse<{ model_id: string; pricing_mode: string; pricing_observation: ModelPricingObservationType | null }>>(
        `/api/v1/model-management/models/${modelId}/pricing`
      );
      return ensureData(response.data, 'Failed to fetch model pricing');
    } catch (error: unknown) {
      throw mapAxiosError(error);
    }
  }

  async getModelPricingObservations(): Promise<ModelPricingObservation[]> {
    try {
      const response = await this.client.get<ApiResponse<{ items?: ModelPricingObservation[] }>>(
        '/api/v1/model-management/pricing/observations'
      );
      const data = ensureData(response.data, 'Failed to fetch model pricing observations');
      return Array.isArray(data?.items) ? data.items : [];
    } catch (error: unknown) {
      throw mapAxiosError(error);
    }
  }

}
