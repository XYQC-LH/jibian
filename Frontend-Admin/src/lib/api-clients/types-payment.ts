import type { Task } from './types-task';

export interface PaymentRequest {
  amount: number;
  method: 'alipay' | 'wxpay';  // 支付宝 | 微信支付（通过支付中间层）
  credits: number;
}

export interface PaymentResponse {
  payment_url: string | null;  // 支付跳转 URL
  qrcode: string | null;       // 二维码内容（如有）
  payment_id: number;          // 支付记录 ID
  trade_no: string | null;     // 平台交易号
  out_trade_no: string;        // 商户订单号
  amount: number;              // 支付金额
  credits: number;             // 充值积分数
  status: string;              // 支付状态
  payment_method: string;      // 支付方式
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface GenerationRequest {
  model_id: string;
  prompt: string;
  negative_prompt?: string;
  ratio: string;
  quality?: 'standard' | 'high';
  style?: string;
  reference_image_url?: string;
}

export type GenerationResponse = Task;

// 配置驱动的玩法模式字段定义
export interface ExposedField {
  name: string;
  label?: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'image-upload' | 'video-upload' | 'toggle';
  required?: boolean;
  visible?: boolean;
  default?: unknown;
  options?: Array<{ label: string; value: string | number }>;
  min?: number;
  max?: number;
  step?: number;
  max_size_mb?: number;
  video_input_mode?: 'url' | 'upload' | 'both';
  placeholder?: string;
  description?: string;
  merge_strategy?: 'prepend' | 'append' | 'override';
  ui_group?: string;
  order?: number;
  as_main_prompt?: boolean;
  validation_regex?: string;
}

export interface InputSchema {
  fields: ExposedField[];
  main_prompt_field?: string;
}

export interface SystemConfig {
  max_concurrent_tasks: number;
  task_timeout: number;
  cleanup_interval: number;
  redis_memory_limit: string;
  database_connections: number;
  file_storage_limit: string;
}

// Credits / 积分明细
export type CreditTransactionType =
  | 'recharge'
  | 'reserve'
  | 'confirm'
  | 'refund_reserved'
  | 'adjust'
  | 'redemption';

export interface CreditTransaction {
  id: number;
  amount: number;
  balance_before: number;
  balance_after: number;
  transaction_type: CreditTransactionType;
  description?: string | null;
  payment_id?: number | null;
  task_id?: number | null;
  created_at: string;
  processed_at?: string | null;
}

// Input configuration for dynamic form rendering
export interface InputConfig {
  enable_text: boolean;
  enable_image: boolean;
  text_placeholder?: string;
  text_required?: boolean;
  image_max_size_mb?: number;
  image_required?: boolean;
}

// User inputs data structure for API submission
export interface UserInputsData {
  text?: string;
  image_url?: string | null;
}

export interface PaginatedCreditTransactions {
  items: CreditTransaction[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
  has_prev: boolean;
}
