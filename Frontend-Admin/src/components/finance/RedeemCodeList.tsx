'use client';

import React from 'react';
import { Gift, Plus, Edit, Trash2, Ban } from 'lucide-react';
import { formatChinaDate } from '@/utils/format';

interface RedeemCode {
  id: string;
  code: string;
  credits: number;
  type?: string;
  status: 'active' | 'used' | 'expired' | 'disabled' | string;
  usage_limit?: number;
  used_count?: number;
  expires_at?: string | null;
  created_at: string;
  description?: string;
  [key: string]: unknown;
}

interface RedeemCodeListProps {
  redeemCodes: RedeemCode[];
  loading: boolean;
  onCreateClick: () => void;
  onEditClick?: (code: RedeemCode) => void;
  onDisableClick?: (code: RedeemCode) => void;
}

const RedeemCodeList: React.FC<RedeemCodeListProps> = ({
  redeemCodes,
  loading,
  onCreateClick,
  onEditClick,
  onDisableClick
}) => {
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'active':
        return { label: '可用', className: 'bg-green-500/20 text-green-400 border border-green-500/30' };
      case 'used':
        return { label: '已使用', className: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' };
      case 'expired':
        return { label: '已过期', className: 'bg-gray-500/20 text-gray-400 border border-gray-500/30' };
      case 'disabled':
        return { label: '已禁用', className: 'bg-red-500/20 text-red-400 border border-red-500/30' };
      default:
        return { label: status, className: 'bg-gray-500/20 text-gray-400 border border-gray-500/30' };
    }
  };

  const getTypeDisplay = (type?: string) => {
    switch (type) {
      case 'single_use':
        return '单次使用';
      case 'multi_use':
        return '多次使用';
      case 'time_limited':
        return '限时使用';
      default:
        return type || '单次使用';
    }
  };

  return (
    <div className="space-y-6">
      {/* 操作栏 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-text-primary">兑换码管理</h3>
          <span className="text-sm text-text-muted">
            共 {redeemCodes.length} 个兑换码
          </span>
        </div>
        <button onClick={onCreateClick} className="btn-primary">
          <Plus size={16} className="mr-2" />
          创建兑换码
        </button>
      </div>

      {/* 兑换码列表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {redeemCodes.map((code) => (
          <div key={code.id} className="card-primary p-6 hover:border-white/20 transition-all duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
                  <Gift className="text-white w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-text-primary font-mono">{code.code}</h4>
                  <p className="text-sm text-text-muted">{code.credits} 积分</p>
                </div>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs ${getStatusDisplay(code.status).className}`}>
                {getStatusDisplay(code.status).label}
              </div>
            </div>

            {code.description && (
              <p className="text-sm text-text-muted mb-4">{code.description}</p>
            )}

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">类型:</span>
                <span className="text-text-primary">{getTypeDisplay(code.type)}</span>
              </div>
              {code.usage_limit !== undefined && (
                <div className="flex justify-between">
                  <span className="text-text-muted">使用次数:</span>
                  <span className="text-text-primary">{code.used_count || 0} / {code.usage_limit}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-text-muted">创建时间:</span>
                <span className="text-text-primary">{formatChinaDate(code.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">过期时间:</span>
                <span className="text-text-primary">{code.expires_at ? formatChinaDate(code.expires_at) : '永不过期'}</span>
              </div>
            </div>

            <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
              <button
                onClick={() => onEditClick?.(code)}
                disabled={code.status === 'disabled'}
                className="flex-1 text-xs text-text-muted hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Edit size={14} className="inline mr-1" />
                编辑
              </button>
              <button
                onClick={() => onDisableClick?.(code)}
                disabled={code.status === 'disabled' || code.status === 'used'}
                className="flex-1 text-xs text-text-muted hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Ban size={14} className="inline mr-1" />
                禁用
              </button>
            </div>
          </div>
        ))}
      </div>

      {redeemCodes.length === 0 && !loading && (
        <div className="text-center py-12">
          <Gift className="w-16 h-16 text-text-muted mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-text-primary mb-2">暂无兑换码</h3>
          <p className="text-text-muted mb-4">创建第一个兑换码来开始吧</p>
          <button onClick={onCreateClick} className="btn-primary">
            <Plus size={16} className="mr-2" />
            创建兑换码
          </button>
        </div>
      )}
    </div>
  );
};

export default RedeemCodeList;
