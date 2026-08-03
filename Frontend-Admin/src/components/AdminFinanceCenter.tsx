'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Coins, Download, RefreshCcw, BarChart3, FileText, Gift, Layers, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '@/lib/api';
import CreditStats from './finance/CreditStats';
import CreditLedgerList from './finance/CreditLedgerList';
import RedeemCodeList from './finance/RedeemCodeList';
import CreateRedeemForm from './finance/CreateRedeemForm';
import Pagination from './finance/Pagination';
import EditRedeemForm from './finance/EditRedeemForm';
import ConfirmDialog from '@/components/ConfirmDialog';
import BatchCreateRedeemForm from './finance/BatchCreateRedeemForm';
import { getErrorMessage } from '@/lib/http/errors';
import type { RedeemCode, CreditStatisticsData, InviteStatisticsData, CreditLedgerItem, PaginationState, FinanceTab } from './AdminFinanceCenterTypes';
import { normalizeFinanceTab, getDaysFromTimeRange, exportToCSV } from './AdminFinanceCenterUtils';

const AdminFinanceCenter = () => {
  const searchParams = useSearchParams();
  const [timeRange, setTimeRange] = useState('30d');
  const [activeTab, setActiveTab] = useState<FinanceTab>(() => normalizeFinanceTab(searchParams.get('tab')));
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [creditStats, setCreditStats] = useState<CreditStatisticsData | null>(null);
  const [inviteStats, setInviteStats] = useState<InviteStatisticsData | null>(null);

  const [ledgerRecords, setLedgerRecords] = useState<CreditLedgerItem[]>([]);
  const [ledgerPagination, setLedgerPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1
  });
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('all');
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState('');

  const [redeemCodes, setRedeemCodes] = useState<RedeemCode[]>([]);
  const [redeemPagination, setRedeemPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1
  });

  const [showCreateRedeemModal, setShowCreateRedeemModal] = useState(false);
  const [showBatchCreateModal, setShowBatchCreateModal] = useState(false);
  const [selectedRedeemCode, setSelectedRedeemCode] = useState<RedeemCode | null>(null);
  const [showEditRedeemModal, setShowEditRedeemModal] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [redeemToDisable, setRedeemToDisable] = useState<RedeemCode | null>(null);

  useEffect(() => {
    const nextTab = normalizeFinanceTab(searchParams.get('tab'));
    setActiveTab((prev) => (prev === nextTab ? prev : nextTab));
  }, [searchParams]);

  const fetchCreditStatistics = useCallback(async (days: number) => {
    try {
      const data = await apiClient.finance.getCreditStatistics(days);
      setCreditStats(data as unknown as CreditStatisticsData);
    } catch (error: unknown) {
      console.error('Failed to fetch credit statistics:', error);
      setCreditStats(null);
    }
  }, []);

  const fetchInviteStatistics = useCallback(async (days: number) => {
    try {
      const data = await apiClient.finance.getInviteStatistics(days);
      setInviteStats(data as unknown as InviteStatisticsData);
    } catch (error: unknown) {
      console.error('Failed to fetch invite statistics:', error);
      setInviteStats(null);
    }
  }, []);

  const fetchLedger = useCallback(async (page: number, pageSize: number) => {
    try {
      const data = await apiClient.finance.getCreditLedger(page, pageSize, {
        type: ledgerTypeFilter,
        user: ledgerSearchTerm || undefined,
      });
      setLedgerRecords((data.items || []) as unknown as CreditLedgerItem[]);
      setLedgerPagination({
        page: data.page || page,
        pageSize: data.page_size || pageSize,
        total: data.total || 0,
        totalPages: data.total_pages || 1
      });
    } catch (error: unknown) {
      console.error('Failed to fetch credit ledger:', error);
      setLedgerRecords([]);
    }
  }, [ledgerTypeFilter, ledgerSearchTerm]);

  const fetchRedeemCodes = useCallback(async (page: number, pageSize: number) => {
    try {
      const redeemCodeData = await apiClient.order.getRedemptionCodes(page, pageSize);
      setRedeemCodes((redeemCodeData.items || []) as unknown as RedeemCode[]);
      setRedeemPagination({
        page: redeemCodeData.page || page,
        pageSize: redeemCodeData.page_size || pageSize,
        total: redeemCodeData.total || 0,
        totalPages: redeemCodeData.total_pages || 1
      });
    } catch (error: unknown) {
      console.error('Failed to fetch redeem codes:', error);
      setRedeemCodes([]);
    }
  }, []);

  const fetchAllData = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const days = getDaysFromTimeRange(timeRange);
      await Promise.all([
        fetchCreditStatistics(days),
        fetchInviteStatistics(days),
        fetchLedger(ledgerPagination.page, ledgerPagination.pageSize),
        fetchRedeemCodes(redeemPagination.page, redeemPagination.pageSize),
      ]);
    } catch (error: unknown) {
      console.error('Failed to load finance data', error);
      toast.error(getErrorMessage(error, '加载积分数据失败'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeRange, ledgerPagination.page, ledgerPagination.pageSize,
      redeemPagination.page, redeemPagination.pageSize,
      fetchCreditStatistics, fetchInviteStatistics, fetchLedger, fetchRedeemCodes]);

  useEffect(() => {
    fetchAllData(true);
  }, [timeRange]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchLedger(1, ledgerPagination.pageSize);
  }, [ledgerTypeFilter, ledgerSearchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLedgerPageChange = (page: number) => {
    setLedgerPagination(prev => ({ ...prev, page }));
    fetchLedger(page, ledgerPagination.pageSize);
  };

  const handleLedgerPageSizeChange = (pageSize: number) => {
    setLedgerPagination(prev => ({ ...prev, pageSize, page: 1 }));
    fetchLedger(1, pageSize);
  };

  const handleRedeemPageChange = (page: number) => {
    setRedeemPagination(prev => ({ ...prev, page }));
    fetchRedeemCodes(page, redeemPagination.pageSize);
  };

  const handleRedeemPageSizeChange = (pageSize: number) => {
    setRedeemPagination(prev => ({ ...prev, pageSize, page: 1 }));
    fetchRedeemCodes(1, pageSize);
  };

  const handleRefresh = async () => {
    await fetchAllData(false);
    toast.success('数据已刷新');
  };

  const handleExport = () => {
    if (activeTab === 'ledger') {
      exportToCSV(ledgerRecords as unknown as Record<string, unknown>[], '积分流水', [
        { key: 'type', label: '类型' },
        { key: 'user_email', label: '用户' },
        { key: 'amount', label: '变动积分' },
        { key: 'balance_after', label: '变更后余额' },
        { key: 'ref_type', label: '关联对象类型' },
        { key: 'ref_id', label: '关联对象ID' },
        { key: 'created_at', label: '时间' }
      ]);
    } else if (activeTab === 'redeems') {
      exportToCSV(redeemCodes as unknown as Record<string, unknown>[], '兑换码', [
        { key: 'code', label: '兑换码' },
        { key: 'credits', label: '积分' },
        { key: 'type', label: '类型' },
        { key: 'status', label: '状态' },
        { key: 'used_count', label: '使用次数' },
        { key: 'usage_limit', label: '使用限制' },
        { key: 'expires_at', label: '过期时间' },
        { key: 'created_at', label: '创建时间' }
      ]);
    }
  };

  const handleCreateRedeemCode = async (codeData: Record<string, unknown>) => {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + Number(codeData.days || 30));

      await apiClient.order.createRedemptionCode({
        code: String(codeData.code || '').trim() || undefined,
        credits: Number(codeData.credits ?? 0),
        type: String(codeData.type ?? 'single_use') as 'single_use' | 'multi_use' | 'time_limited',
        usage_limit: Number(codeData.usage_limit ?? 1),
        expires_at: expiresAt.toISOString(),
        description: String(codeData.description ?? '')
      });

      await fetchRedeemCodes(1, redeemPagination.pageSize);
      setShowCreateRedeemModal(false);
      toast.success('兑换码创建成功');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, '创建兑换码失败'));
    }
  };

  const handleBatchCreateRedeemCode = async (batchData: Record<string, unknown>) => {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Number(batchData.days || 30));

    const result = await apiClient.order.batchCreateRedemptionCodes({
      count: Number(batchData.count ?? 1),
      credits: Number(batchData.credits ?? 0),
      type: String(batchData.type ?? 'single_use') as 'single_use' | 'multi_use' | 'time_limited',
      usage_limit: Number(batchData.usage_limit ?? 1),
      expires_at: expiresAt.toISOString(),
      description: String(batchData.description ?? ""),
      prefix: String(batchData.prefix ?? "")
    });

    await fetchRedeemCodes(1, redeemPagination.pageSize);
    return result;
  };

  const handleEditRedeemCode = (redeemCode: RedeemCode) => {
    setSelectedRedeemCode(redeemCode);
    setShowEditRedeemModal(true);
  };

  const handleSaveRedeemCode = async (codeId: string, updatedData: Record<string, unknown>) => {
    if (!selectedRedeemCode || selectedRedeemCode.id !== codeId) return;

    try {
      await apiClient.order.updateRedemptionCode(codeId, {
        credits: Number(updatedData.credits ?? 0),
        status: String(updatedData.status ?? "") as "active" | "disabled",
        usage_limit: Number(updatedData.usage_limit ?? 1),
        expires_at: updatedData.expires_at ? new Date(String(updatedData.expires_at)).toISOString() : undefined,
        description: String(updatedData.description ?? "")
      });

      await fetchRedeemCodes(redeemPagination.page, redeemPagination.pageSize);
      setShowEditRedeemModal(false);
      setSelectedRedeemCode(null);
      toast.success('兑换码更新成功');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, '更新兑换码失败'));
    }
  };

  const handleDisableRedeemClick = (redeemCode: RedeemCode) => {
    setRedeemToDisable(redeemCode);
    setShowDisableConfirm(true);
  };

  const handleConfirmDisable = async () => {
    if (!redeemToDisable) return;

    try {
      await apiClient.order.disableRedemptionCode(redeemToDisable.id);
      await fetchRedeemCodes(redeemPagination.page, redeemPagination.pageSize);
      setShowDisableConfirm(false);
      setRedeemToDisable(null);
      toast.success('兑换码已禁用');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, '禁用兑换码失败'));
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-primary p-6">
      <div className="max-w-[1800px] mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-600 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-500/20">
                <Coins className="text-white w-6 h-6" />
              </div>
              积分与兑换
            </h1>
            <p className="text-text-muted">积分统计 · 积分流水 · 兑换码管理</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="input-primary px-4 py-2"
            >
              <option value="1d">今天</option>
              <option value="7d">最近7天</option>
              <option value="30d">最近30天</option>
              <option value="90d">最近90天</option>
            </select>
            <button
              onClick={handleExport}
              className="btn-secondary-sm border border-white/10"
            >
              <Download size={16} className="mr-2" />
              导出报表
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-primary disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : (
                <RefreshCcw size={16} className="mr-2" />
              )}
              刷新数据
            </button>
          </div>
        </div>

        <div className="flex space-x-1 mb-8 p-1 bg-surface/80 rounded-xl border border-white/5">
          {[
            { id: 'overview', label: '积分统计', icon: BarChart3 },
            { id: 'ledger', label: '积分流水', icon: FileText },
            { id: 'redeems', label: '兑换码', icon: Gift },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as FinanceTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg'
                  : 'text-text-muted hover:text-text-primary hover:bg-white/10'
              }`}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8">
            <CreditStats stats={creditStats} inviteStats={inviteStats} />
            {creditStats && (
              <div className="card-primary p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">按类型统计（累计）</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {Object.entries(creditStats.by_type || {}).map(([type, value]) => (
                    <div key={type} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-xs text-text-muted mb-1">{type}</div>
                      <div className="text-xl font-semibold text-text-primary">
                        {Number(value).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ledger' && (
          <div className="space-y-4">
            <CreditLedgerList
              records={ledgerRecords}
              loading={loading}
              typeFilter={ledgerTypeFilter}
              searchTerm={ledgerSearchTerm}
              onTypeFilterChange={setLedgerTypeFilter}
              onSearchChange={setLedgerSearchTerm}
              onExport={() => handleExport()}
            />
            <Pagination
              page={ledgerPagination.page}
              totalPages={ledgerPagination.totalPages}
              total={ledgerPagination.total}
              pageSize={ledgerPagination.pageSize}
              onPageChange={handleLedgerPageChange}
              onPageSizeChange={handleLedgerPageSizeChange}
            />
          </div>
        )}

        {activeTab === 'redeems' && (
          <div className="space-y-4">
            <div className="flex justify-end gap-3 mb-4">
              <button
                onClick={() => setShowBatchCreateModal(true)}
                className="btn-secondary-sm border border-white/10"
              >
                <Layers size={16} className="mr-2" />
                批量创建
              </button>
            </div>
            <RedeemCodeList
              redeemCodes={redeemCodes}
              loading={loading}
              onCreateClick={() => setShowCreateRedeemModal(true)}
              onEditClick={handleEditRedeemCode}
              onDisableClick={handleDisableRedeemClick}
            />
            <Pagination
              page={redeemPagination.page}
              totalPages={redeemPagination.totalPages}
              total={redeemPagination.total}
              pageSize={redeemPagination.pageSize}
              onPageChange={handleRedeemPageChange}
              onPageSizeChange={handleRedeemPageSizeChange}
            />
          </div>
        )}

        {showCreateRedeemModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="card-primary p-6 w-full max-w-md">
              <h3 className="text-xl font-semibold text-text-primary mb-6">创建兑换码</h3>
              <CreateRedeemForm
                onSubmit={handleCreateRedeemCode as any}
                onCancel={() => setShowCreateRedeemModal(false)}
              />
            </div>
          </div>
        )}

        {showEditRedeemModal && selectedRedeemCode && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="card-primary p-6 w-full max-w-md">
              <h3 className="text-xl font-semibold text-text-primary mb-6">编辑兑换码</h3>
              <EditRedeemForm
                redeemCode={selectedRedeemCode}
                onSubmit={handleSaveRedeemCode as any}
                onCancel={() => {
                  setShowEditRedeemModal(false);
                  setSelectedRedeemCode(null);
                }}
              />
            </div>
          </div>
        )}

        <ConfirmDialog
          isOpen={showDisableConfirm}
          title="禁用兑换码"
          message={`确定要禁用兑换码 "${redeemToDisable?.code}" 吗？禁用后该兑换码将无法使用。`}
          confirmText="确认禁用"
          cancelText="取消"
          type="danger"
          onConfirm={handleConfirmDisable}
          onClose={() => {
            setShowDisableConfirm(false);
            setRedeemToDisable(null);
          }}
        />

        {showBatchCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="card-primary p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-semibold text-text-primary mb-6 flex items-center gap-2">
                <Layers className="w-5 h-5 text-accent" />
                批量创建兑换码
              </h3>
              <BatchCreateRedeemForm
                onSubmit={handleBatchCreateRedeemCode as any}
                onCancel={() => setShowBatchCreateModal(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFinanceCenter;
