// ========== Orders ==========
export interface OrderInfo {
  id: string;
  order_no?: string;
  user_id: string;
  user_email?: string;
  amount?: number;
  total_amount?: number;
  credits: number;
  status: string;
  payment_method: string;
  trade_no?: string;
  out_trade_no?: string;
  ref_type?: string;
  ref_id?: string;
  package_id?: string;
  balance_after?: number;
  created_at: string;
  paid_at?: string;
  refunded_at?: string;
  refund?: CreditRefundInfo | null;
  payment_refund?: PaymentRefundInfo | null;
  [key: string]: unknown;
}

export interface CreditRefundInfo {
  id: string;
  amount: number;
  balance_after: number;
  created_at: string;
}

export interface PaymentRefundInfo {
  id: string;
  payment_order_id: string;
  out_refund_no: string;
  wx_refund_id?: string | null;
  status: string;
  amount_fen: number;
  amount_yuan: number;
  credits: number;
  reason?: string | null;
  failure_reason?: string | null;
  succeeded_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OrderRefundResult {
  refunded: boolean;
  refund_id?: string | null;
  already_refunded?: boolean;
  amount?: number;
  balance_after?: number;
  payment_refund?: PaymentRefundInfo | null;
}

export interface OrderStatistics {
  total_orders: number;
  total_amount: number;
  total_credits: number;
  success_count: number;
  failed_count: number;
  refund_count: number;
  date_breakdown: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface RedemptionCode {
  id: string;
  code: string;
  credits: number;
  type: string;
  status: string;
  usage_limit: number | null;
  used_count: number;
  created_by?: string;
  batch_id?: string;
  expires_at?: string;
  created_at: string;
  [key: string]: unknown;
}

export interface RedemptionCodeUsage {
  id: string;
  redemption_code_id?: string;
  user_id: string;
  user_email?: string;
  used_at: string;
}

export interface RedemptionStatistics {
  total_codes: number;
  active_codes: number;
  expired_codes: number;
  total_credits_issued: number;
  total_credits_redeemed: number;
  [key: string]: unknown;
}

// ========== Finance ==========
export interface FinanceDashboard {
  total_revenue: number;
  period_revenue: number;
  total_credits_issued: number;
  total_credits_consumed: number;
  active_users: number;
  daily_stats: Array<Record<string, unknown>>;
  revenue_breakdown: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface FinanceStatistics {
  total_revenue: number;
  total_expense: number;
  net_income: number;
  period_days: number;
  [key: string]: unknown;
}

export interface RechargeRecord {
  id: string;
  user_id: string;
  user_email?: string;
  amount: number;
  credits: number;
  status: string;
  payment_method: string;
  created_at: string;
  [key: string]: unknown;
}

export interface TransactionRecord {
  id: string;
  user_id: string;
  user_email?: string;
  amount: number;
  balance_before?: number;
  balance_after?: number;
  transaction_type: string;
  status: string;
  description?: string;
  created_at: string;
  [key: string]: unknown;
}

export interface TransactionStatistics {
  total_transactions: number;
  total_amount: number;
  by_type: Record<string, unknown>;
  period_days: number;
  [key: string]: unknown;
}

// ========== Credits (即变积分体系) ==========
export interface CreditLedgerRecord {
  id: string;
  user_id: string;
  user_email?: string;
  type: string;
  amount: number;
  balance_after: number;
  ref_type: string;
  ref_id: string;
  created_at: string;
  [key: string]: unknown;
}

export interface CreditStatistics {
  summary: {
    total_accounts: number;
    total_balance: number;
    total_ledger_records: number;
    period_ledger_records: number;
    total_issued: number;
    total_spent: number;
    period_issued: number;
    period_spent: number;
  };
  redemption: {
    total_codes: number;
    active_codes: number;
    total_used: number;
  };
  by_type: Record<string, number>;
  period_days: number;
  [key: string]: unknown;
}
