'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/Skeleton';
import type { CreditLedgerItem } from '../AdminFinanceCenterTypes';

const TYPE_LABELS: Record<string, string> = {
  charge: '生成扣费',
  refund: '失败退款',
  recharge: '充值',
  redeem: '兑换码',
  adjustment: '人工调整',
};

const TYPE_OPTIONS = [
  { value: 'all', label: '全部类型' },
  { value: 'charge', label: '生成扣费' },
  { value: 'refund', label: '失败退款' },
  { value: 'recharge', label: '充值' },
  { value: 'redeem', label: '兑换码' },
  { value: 'adjustment', label: '人工调整' },
];

const amountTone = (amount: number) =>
  amount > 0 ? 'text-green-400' : amount < 0 ? 'text-red-400' : 'text-text-muted';

interface CreditLedgerListProps {
  records: CreditLedgerItem[];
  loading: boolean;
  typeFilter: string;
  searchTerm: string;
  onTypeFilterChange: (type: string) => void;
  onSearchChange: (term: string) => void;
  onExport?: () => void;
}

const CreditLedgerList: React.FC<CreditLedgerListProps> = ({
  records,
  loading,
  typeFilter,
  searchTerm,
  onTypeFilterChange,
  onSearchChange,
  onExport,
}) => {
  const [searchInput, setSearchInput] = useState('');

  return (
    <div className="card-primary rounded-2xl overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 p-4 border-b border-white/5">
        <div className="flex flex-wrap gap-2">
          <select
            value={typeFilter}
            onChange={(e) => onTypeFilterChange(e.target.value)}
            className="input-primary px-3 py-2 text-sm"
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                onSearchChange(e.target.value);
              }}
              placeholder="搜索用户昵称/手机号"
              className="input-primary pl-9 pr-3 py-2 text-sm w-52"
            />
          </div>
        </div>
        {onExport && (
          <button onClick={onExport} className="btn-secondary-sm border border-white/10">
            导出流水
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-muted border-b border-white/5">
              <th className="px-4 py-3 font-medium">类型</th>
              <th className="px-4 py-3 font-medium">用户</th>
              <th className="px-4 py-3 font-medium text-right">变动积分</th>
              <th className="px-4 py-3 font-medium text-right">变更后余额</th>
              <th className="px-4 py-3 font-medium">关联对象</th>
              <th className="px-4 py-3 font-medium">时间</th>
            </tr>
          </thead>
          <tbody>
            {loading && records.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <TableSkeleton rows={4} columns={5} />
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  暂无匹配的积分流水
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs">
                      {TYPE_LABELS[record.type] ?? record.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {record.user_email || record.user_id.slice(0, 8)}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${amountTone(record.amount)}`}>
                    {record.amount > 0 ? `+${record.amount}` : record.amount}
                  </td>
                  <td className="px-4 py-3 text-right text-text-primary">{record.balance_after}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {record.ref_type}
                    {record.ref_id ? ` · ${record.ref_id.slice(0, 8)}` : ''}
                  </td>
                  <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                    {new Date(record.created_at).toLocaleString('zh-CN', { hour12: false })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CreditLedgerList;
