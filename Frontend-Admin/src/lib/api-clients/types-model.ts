import type { ExposedField } from './types-payment';

export interface Model {
  id: string;
  name: string;
  category?: string;
  cover_asset_id?: string | null;
  cover_url?: string | null;
  type: 'image' | 'video' | 'music' | 'audio' | 'other';
  output_type?: string;
  order?: number;
  usage_count?: number;
  status?: string;
  is_enabled?: boolean;
  description: string;
  prompt?: string;
  cost_credits: number;
  pricing_mode?: string | null;
  pricing_strategy?: string | null;
  pricing_currency_basis?: string | null;
  pricing_editable?: boolean;
  pricing_managed_by?: string | null;
  pricing_spec_count?: number;
  pricing_default_spec_key?: string | null;
  pricing_default_anchor_cost_cny?: number | null;
  pricing_default_quoted_credits_cost?: number | null;
  pricing_summary_status?: 'ready' | 'error' | 'unknown';
  pricing_summary_error?: string | null;
  model_pricing_multiplier?: number;
  accept_global_pricing_multiplier?: boolean;
  is_active: boolean;
  performance?: {
    avg_processing_time: number;
    success_rate: number;
    daily_usage: number;
    total_usage: number;
  };
  features?: string[];
  supported_ratios: string[];
  max_duration?: number;
  max_resolution?: string;
  extra_fields?: ModelExtraField[];
  default_params?: Record<string, unknown>;
  fixed_params?: Record<string, unknown>;
  exposed_fields?: ExposedField[];
  health_status?: unknown;
  capabilities?: Record<string, unknown>;
  parameter_schema?: Record<string, unknown>;
  ui_config?: Record<string, unknown>;
  config?: Record<string, unknown>;
}

export interface ModelExtraFieldOption {
  label: string;
  value: string | number;
}

export type ModelExtraFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'integer'
  | 'select'
  | 'toggle'
  | 'boolean'
  | 'image-upload'
  | string;

export interface ModelExtraField {
  name: string;
  label: string;
  type: ModelExtraFieldType;
  required?: boolean;
  visible?: boolean;
  options?: ModelExtraFieldOption[];
  default?: unknown;
  modes?: string[];
  max_size_mb?: number;
  placeholder?: string;
  description?: string;
  min?: number | null;
  max?: number | null;
  step?: number | null;
  merge_strategy?: 'prepend' | 'append' | 'override' | string;
  multiple?: boolean;
  max_files?: number;
}

export interface ModelUpdateRequest {
  display_name?: string;
  category?: string;
  cover_asset_id?: string;
  description?: string;
  prompt?: string;
  credits_cost?: number;
  order?: number | null;
  model_pricing_multiplier?: number | null;
  accept_global_pricing_multiplier?: boolean;
  is_enabled?: boolean;
  status?: string | null;
}

export interface PricingSettings {
  global_pricing_multiplier: number;
  finance_credit_per_cny: number;
}

export interface ModelPricingSpecObservation {
  pricing_spec_key: string;
  pricing_spec_params_snapshot: Record<string, unknown>;
  matched_source_ids: string[];
  matched_source_costs_cny: Record<string, number>;
  min_upstream_cost_cny: number | null;
  max_upstream_cost_cny: number | null;
  pricing_anchor_cost_cny: number | null;
  base_credits_cost: number | null;
  error?: string | null;
}

export interface ModelPricingObservation {
  model_id: string;
  display_name: string;
  type?: 'image' | 'video' | 'music' | 'audio' | 'other' | null;
  pricing_mode?: string | null;
  pricing_strategy?: string | null;
  currency_basis?: string | null;
  default_spec_key?: string | null;
  base_credits_cost: number;
  finance_credit_per_cny: number;
  finance_cny_per_credit: number;
  global_pricing_multiplier: number;
  model_pricing_multiplier: number;
  accept_global_pricing_multiplier: boolean;
  effective_multiplier: number;
  specs: ModelPricingSpecObservation[];
}

export interface ModelReorderItem {
  model_id: string;
  order: number;
}

export interface ModelReorderRequest {
  items: ModelReorderItem[];
}
