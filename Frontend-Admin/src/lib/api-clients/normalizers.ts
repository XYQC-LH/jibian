import { ExposedField, InputSchema, Model, User } from './types';

const unwrapUserPayload = (data: unknown): Record<string, unknown> => {
  if (data && typeof data === 'object' && 'user' in data && data.user && typeof data.user === 'object') {
    return data.user as Record<string, unknown>;
  }
  return (data ?? {}) as Record<string, unknown>;
};

const normalizePermissionList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  return Array.from(new Set(normalized));
};

const normalizeStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => String(item || '').trim())
          .filter(Boolean),
      ),
    );
  }

  const single = String(value || '').trim();
  return single ? [single] : [];
};

const normalizeExposedField = (field: unknown, index: number): ExposedField | null => {
  if (!field || typeof field !== 'object') return null;
  const f = field as Record<string, unknown>;
  const name = String(f?.name || f?.field_name || '').trim();
  if (!name) return null;

  return {
    name,
    label: String(f?.label || f?.display_name || name).trim() || name,
    type: (String(f?.type || 'text').trim() || 'text') as ExposedField['type'],
    required: Boolean(f?.required),
    visible: f?.visible !== false,
    default: f?.default,
    options: Array.isArray(f?.options) ? f.options as ExposedField['options'] : undefined,
    min: typeof f?.min === 'number' ? f.min : undefined,
    max: typeof f?.max === 'number' ? f.max : undefined,
    step: typeof f?.step === 'number' ? f.step : undefined,
    max_size_mb: typeof f?.max_size_mb === 'number' ? f.max_size_mb : undefined,
    placeholder: typeof f?.placeholder === 'string' ? f.placeholder : undefined,
    description: typeof f?.description === 'string' ? f.description : undefined,
    merge_strategy: typeof f?.merge_strategy === 'string' ? f.merge_strategy as ExposedField['merge_strategy'] : undefined,
    ui_group: typeof f?.ui_group === 'string' ? f.ui_group : undefined,
    order: typeof f?.order === 'number' ? f.order : index,
    as_main_prompt: Boolean(f?.as_main_prompt || f?.is_main_prompt),
    validation_regex: typeof f?.validation_regex === 'string' ? f.validation_regex : undefined,
  };
};

const normalizeFieldList = (fields: unknown): ExposedField[] => {
  if (!Array.isArray(fields)) return [];
  return fields
    .map((field, index) => normalizeExposedField(field, index))
    .filter(Boolean) as ExposedField[];
};

const normalizeInputSchema = (value: unknown): InputSchema | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  return {
    fields: normalizeFieldList(v?.fields),
    main_prompt_field:
      typeof v?.main_prompt_field === 'string' && v.main_prompt_field.trim()
        ? v.main_prompt_field.trim()
        : undefined,
  };
};

const deriveInputSchema = (pm: Record<string, unknown>): InputSchema | undefined => {
  const normalized = normalizeInputSchema(pm?.input_schema);
  if (normalized && normalized.fields.length > 0) {
    return normalized;
  }
  return normalized;
};

const deriveOutputType = (pm: Record<string, unknown>): 'image' | 'video' | 'music' => {
  const explicit = String(pm?.output_type || '').trim().toLowerCase();
  if (explicit === 'video') return 'video';
  if (explicit === 'image') return 'image';
  if (explicit === 'music' || explicit === 'audio') return 'music';

  const outputs = Array.isArray(pm?.output_schema ? (pm.output_schema as Record<string, unknown>).outputs : null)
    ? ((pm.output_schema as Record<string, unknown>).outputs as Record<string, unknown>[])
    : [];
  if (outputs.some((item) => String(item?.kind || '').trim().toLowerCase() === 'video')) {
    return 'video';
  }
  if (outputs.some((item) => {
    const kind = String(item?.kind || '').trim().toLowerCase();
    return kind === 'audio' || kind === 'music';
  })) {
    return 'music';
  }
  return 'image';
};

const deriveInputConfig = (pm: Record<string, unknown>, fields: ExposedField[]) => {
  if (pm?.input_config && typeof pm.input_config === 'object') {
    return pm.input_config;
  }

  const textFields = fields.filter((field) => field.type === 'text' || field.type === 'textarea');
  const imageField = fields.find((field) => field.type === 'image-upload');

  return {
    enable_text: textFields.length > 0,
    enable_image: Boolean(imageField),
    text_required: textFields.some((field) => field.required),
    image_required: Boolean(imageField?.required),
    image_max_size_mb: imageField?.max_size_mb,
  };
};

export const normalizeUser = (data: unknown): User => {
  const payload = unwrapUserPayload(data);
  const normalizedEmail = String(payload?.email || '').trim();
  const normalizedUsername = String(payload?.username || '').trim();
  const normalizedLoginAccount = String(payload?.login_account || '').trim();

  return {
    id: (payload?.id as string | number) ?? (payload?.user_id as string | number) ?? '',
    email: normalizedEmail,
    username: payload?.username as string | undefined,
    login_account: normalizedLoginAccount || normalizedEmail || normalizedUsername || undefined,
    registration_source: typeof payload?.registration_source === 'string' ? payload.registration_source : undefined,
    registration_source_label:
      typeof payload?.registration_source_label === 'string' ? payload.registration_source_label : undefined,
    admin_note: typeof payload?.admin_note === 'string' ? payload.admin_note : undefined,
    credits: (payload?.credits as number) ?? 0,
    permissions: normalizePermissionList(payload?.permissions),
    created_at: (payload?.created_at as string) ?? new Date().toISOString(),
    updated_at: payload?.updated_at as string | undefined,
    last_login: payload?.last_login as string | undefined,
    is_active: (payload?.is_active as boolean) ?? true,
    status: payload?.status as string | undefined,
    login_count: payload?.login_count as number | undefined,
  };
};

export const mapModelResponse = (model: unknown, defaultId?: string, defaultCredits?: number): Model => {
  const m = (model ?? {}) as Record<string, unknown>;
  const extraFields = m?.extra_fields || [];
  const performance = m?.performance as Record<string, unknown> | undefined;
  const status = typeof m?.status === 'string' ? m.status : undefined;
  const isEnabled = typeof m?.is_enabled === 'boolean' ? m.is_enabled : undefined;
  const parsedOrder = Number(m?.order ?? 0);
  const normalizedOrder = Number.isFinite(parsedOrder) && parsedOrder >= 0
    ? Math.trunc(parsedOrder)
    : 0;
  const parsedUsageCount = Number(m?.usage_count);
  const usageCount = Number.isFinite(parsedUsageCount) && parsedUsageCount >= 0
    ? Math.trunc(parsedUsageCount)
    : undefined;

  return {
    id: (m?.model_id as string) || (m?.id as string) || defaultId || '',
    name: (m?.display_name as string) || (m?.name as string) || defaultId || 'Model',
    type: ((m?.type || m?.output_type || 'image') as Model['type']),
    output_type: (m?.output_type as string | undefined) || (m?.type as string | undefined),
    order: normalizedOrder,
    usage_count: usageCount,
    status,
    is_enabled: isEnabled,
    description: (m?.description as string) || '',
    cost_credits: (m?.credits_cost as number) ?? defaultCredits ?? 1,
    pricing_mode: (m?.pricing_mode as string | null) ?? null,
    pricing_strategy: (m?.pricing_strategy as string | null) ?? null,
    pricing_currency_basis: (m?.pricing_currency_basis as string | null) ?? null,
    pricing_editable: typeof m?.pricing_editable === 'boolean' ? m.pricing_editable : true,
    pricing_managed_by: m?.pricing_managed_by as string | null ?? null,
    pricing_spec_count: Number(m?.pricing_spec_count ?? 0) || 0,
    pricing_default_spec_key: m?.pricing_default_spec_key as string | null ?? null,
    pricing_default_anchor_cost_cny:
      m?.pricing_default_anchor_cost_cny == null ? null : Number(m.pricing_default_anchor_cost_cny),
    pricing_default_quoted_credits_cost:
      m?.pricing_default_quoted_credits_cost == null ? null : Number(m.pricing_default_quoted_credits_cost),
    pricing_summary_status: m?.pricing_summary_status as Model['pricing_summary_status'] ?? undefined,
    pricing_summary_error: m?.pricing_summary_error as string | null ?? null,
    model_pricing_multiplier: Number(m?.model_pricing_multiplier ?? 1) || 1,
    accept_global_pricing_multiplier:
      typeof m?.accept_global_pricing_multiplier === 'boolean'
        ? m.accept_global_pricing_multiplier
        : true,
    is_active: (m?.is_active as boolean) ?? ((isEnabled ?? true) && (status ?? 'active') === 'active'),
    features: (m?.features as string[]) || [],
    supported_ratios: (m?.supported_ratios as string[]) || ['16:9', '9:16', '1:1'],
    max_duration: m?.max_duration as number | undefined,
    max_resolution: m?.max_resolution as string | undefined,
    extra_fields: extraFields as Model['extra_fields'],
    default_params: (m?.default_params as Record<string, unknown>) || {},
    fixed_params: (m?.fixed_params as Record<string, unknown>) || {},
    exposed_fields: extraFields as Model['exposed_fields'],
    health_status: m?.health_status,
    capabilities: m?.capabilities as Record<string, unknown> | undefined,
    parameter_schema: (m?.parameter_schema as Record<string, unknown>) || {},
    ui_config: (m?.ui_config as Record<string, unknown>) || {},
    performance: performance
      ? {
          avg_processing_time: Number(performance.avg_processing_time) || 0,
          success_rate: Number(performance.success_rate) || 0,
          daily_usage: Number(performance.daily_usage) || 0,
          total_usage: Number(performance.total_usage) || 0,
        }
      : undefined,
    config: {},
  };
};
