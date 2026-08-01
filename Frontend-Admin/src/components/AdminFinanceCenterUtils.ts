import toast from 'react-hot-toast';
import type { FinanceTab } from './AdminFinanceCenterTypes';

export const normalizeFinanceTab = (value: string | null | undefined): FinanceTab => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'ledger' || normalized === 'redeems') {
    return normalized;
  }
  return 'overview';
};

// 时间范围转换为天数
export const getDaysFromTimeRange = (range: string): number => {
  switch (range) {
    case '1d': return 1;
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
    default: return 7;
  }
};

// 导出 CSV 工具函数
export const exportToCSV = (data: Record<string, unknown>[], filename: string, headers: { key: string; label: string }[]) => {
  if (data.length === 0) {
    toast.error('没有数据可导出');
    return;
  }

  const headerRow = headers.map(h => h.label).join(',');
  const dataRows = data.map(item =>
    headers.map(h => {
      const value = item[h.key];
      // 处理包含逗号或引号的值
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value ?? '';
    }).join(',')
  );

  const csvContent = [headerRow, ...dataRows].join('\n');
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast.success('导出成功');
};
