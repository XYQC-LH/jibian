import type { AIModel } from '@/components/resource/types';
import { normalizeOrder } from './resourceCenterShared';

export const MODEL_ORDER_STEP = 10;

export type ModelReorderPayloadItem = {
  model_id: string;
  order: number;
};

export const canReorderModelList = (searchTerm: string): boolean => {
  return searchTerm.trim() === '';
};

export const assignSequentialModelOrders = (models: AIModel[]): AIModel[] => {
  return models.map((model, index) => {
    const order = normalizeOrder((index + 1) * MODEL_ORDER_STEP);
    return {
      ...model,
      order,
    };
  });
};

export const buildModelReorderPayload = (models: AIModel[]): ModelReorderPayloadItem[] => {
  return assignSequentialModelOrders(models).map((model) => ({
    model_id: model.id,
    order: normalizeOrder(model.order ?? 0),
  }));
};
