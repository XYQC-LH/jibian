import { AxiosInstance } from 'axios';
import {
  ApiResponse,
  PaginatedResponse,
  CreditLedgerRecord,
  CreditStatistics,
  FinanceDashboard,
  FinanceStatistics,
  InviteStatistics,
  RechargeRecord,
  TransactionRecord,
  TransactionStatistics,
} from '../types';
import { BaseAdminClient, ensureData, buildQueryUrl } from './_base';

export class FinanceAdminClient extends BaseAdminClient {
  constructor(client: AxiosInstance) {
    super(client);
  }

  async getStatistics(days = 30): Promise<FinanceStatistics> {
    const response = await this.client.get<ApiResponse<FinanceStatistics>>(`/api/v1/admin/statistics?days=${days}`);
    return ensureData(response.data, 'Failed to fetch statistics');
  }

  async getFinanceDashboard(days = 30): Promise<FinanceDashboard> {
    const response = await this.client.get<ApiResponse<FinanceDashboard>>(
      `/api/v1/admin/finance/dashboard?days=${days}`
    );
    return ensureData(response.data, 'Failed to fetch finance dashboard');
  }

  async getRechargeRecords(page = 1, pageSize = 20, filters?: {
    user_email?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<PaginatedResponse<RechargeRecord>> {
    const url = `/api/v1/admin/recharge-records?page=${page}&page_size=${pageSize}${
      filters?.user_email ? `&user_email=${encodeURIComponent(filters.user_email)}` : ''
    }${filters?.start_date ? `&start_date=${filters.start_date}` : ''}${filters?.end_date ? `&end_date=${filters.end_date}` : ''}`;
    const response = await this.client.get<ApiResponse<Record<string, unknown>>>(url);
    const payload = ensureData(response.data, 'Failed to fetch recharge records');
    return {
      items: (payload.items as RechargeRecord[]) || [],
      total: (payload.total as number) ?? 0,
      page: (payload.page as number) ?? page,
      page_size: (payload.page_size as number) ?? pageSize,
      total_pages: (payload.total_pages as number) ?? 1,
      has_next: (payload.has_next as boolean) ?? false,
      has_prev: (payload.has_prev as boolean) ?? false,
    };
  }

  async getTransactions(page = 1, pageSize = 20, filters?: {
    transaction_type?: string;
    user_email?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<PaginatedResponse<TransactionRecord>> {
    const url = `/api/v1/admin/transactions?page=${page}&page_size=${pageSize}${
      filters?.transaction_type && filters?.transaction_type !== 'all' ? `&transaction_type=${filters.transaction_type}` : ''
    }${filters?.user_email ? `&user_email=${encodeURIComponent(filters.user_email)}` : ''}${filters?.start_date ? `&start_date=${filters.start_date}` : ''}${filters?.end_date ? `&end_date=${filters.end_date}` : ''}`;
    const response = await this.client.get<ApiResponse<Record<string, unknown>>>(url);
    const payload = ensureData(response.data, 'Failed to fetch transactions');
    return {
      items: (payload.items as TransactionRecord[]) || [],
      total: (payload.total as number) ?? 0,
      page: (payload.page as number) ?? page,
      page_size: (payload.page_size as number) ?? pageSize,
      total_pages: (payload.total_pages as number) ?? 1,
      has_next: (payload.has_next as boolean) ?? false,
      has_prev: (payload.has_prev as boolean) ?? false,
    };
  }

  async getTransactionStatistics(days = 30): Promise<TransactionStatistics> {
    const response = await this.client.get<ApiResponse<TransactionStatistics>>(
      `/api/v1/admin/transactions/statistics?days=${days}`
    );
    return ensureData(response.data, 'Failed to fetch transaction statistics');
  }

  async getCreditStatistics(days = 30): Promise<CreditStatistics> {
    const response = await this.client.get<ApiResponse<CreditStatistics>>(
      `/api/v1/admin/credits/statistics?days=${days}`
    );
    return ensureData(response.data, 'Failed to fetch credit statistics');
  }

  async getInviteStatistics(days = 30): Promise<InviteStatistics> {
    const response = await this.client.get<ApiResponse<InviteStatistics>>(
      `/api/v1/admin/invites/statistics?days=${days}`
    );
    return ensureData(response.data, 'Failed to fetch invite statistics');
  }

  async getCreditLedger(page = 1, pageSize = 20, filters?: {
    type?: string;
    user?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<PaginatedResponse<CreditLedgerRecord>> {
    const url = buildQueryUrl('/api/v1/admin/credits/ledger', {
      page,
      page_size: pageSize,
      type: filters?.type && filters.type !== 'all' ? filters.type : undefined,
      user: filters?.user,
      start_date: filters?.start_date,
      end_date: filters?.end_date,
    });
    const response = await this.client.get<ApiResponse<Record<string, unknown>>>(url);
    const payload = ensureData(response.data, 'Failed to fetch credit ledger');
    return {
      items: (payload.items as CreditLedgerRecord[]) || [],
      total: (payload.total as number) ?? 0,
      page: (payload.page as number) ?? page,
      page_size: (payload.page_size as number) ?? pageSize,
      total_pages: (payload.total_pages as number) ?? 1,
      has_next: (payload.has_next as boolean) ?? false,
      has_prev: (payload.has_prev as boolean) ?? false,
    };
  }

}
