export type AIModelType = 'image' | 'video' | 'music' | 'audio' | 'llm' | 'text' | 'other';

export interface AIModel {
  id: string;
  name: string;
  description?: string;
  type: AIModelType;
  output_type?: AIModelType | string;
  order?: number;
  usage_count?: number;
  provider: string;
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
  is_enabled?: boolean;
  status?: string;
  is_available: boolean;
  config?: Record<string, unknown>;
  exposed_fields?: Record<string, unknown>[];
  extra_fields?: Record<string, unknown>[];
  parameter_schema?: Record<string, unknown>;
  default_params?: Record<string, unknown>;
  ui_config?: Record<string, unknown>;
  model_config: Record<string, unknown>;
  performance: {
    avg_processing_time: number;
    success_rate: number;
    daily_usage: number;
    total_usage: number;
  };
  created_at: string;
  updated_at: string;
}
