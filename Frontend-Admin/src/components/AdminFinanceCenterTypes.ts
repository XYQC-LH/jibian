// 积分与兑换中心类型定义

export interface RedeemCode {
  id: string;
  code: string;
  credits: number;
  type?: string;
  status: 'active' | 'used' | 'expired' | 'disabled' | string;
  usage_limit?: number;
  used_count?: number;
  expires_at?: string | null;
  created_at: string;
  [key: string]: unknown;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CreditStatisticsData {
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
}

export interface CreditLedgerItem {
  id: string;
  user_id: string;
  user_email?: string;
  type: string;
  amount: number;
  balance_after: number;
  ref_type: string;
  ref_id: string;
  created_at: string;
}

export type FinanceTab = 'overview' | 'ledger' | 'redeems';
