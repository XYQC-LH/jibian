'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

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

interface EditRedeemFormProps {
  redeemCode: RedeemCode;
  onSubmit: (id: string, data: EditRedeemFormData) => void;
  onCancel: () => void;
}

interface EditRedeemFormData {
  credits: number;
  usage_limit: number;
  expires_at: string;
  description: string;
  status: string;
}

const EditRedeemForm: React.FC<EditRedeemFormProps> = ({ redeemCode, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<EditRedeemFormData>({
    credits: redeemCode.credits,
    usage_limit: redeemCode.usage_limit || 1,
    expires_at: redeemCode.expires_at ? new Date(redeemCode.expires_at).toISOString().split('T')[0] : '',
    description: redeemCode.description || '',
    status: redeemCode.status
  });

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

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'active':
        return { label: '可用', color: 'text-green-400' };
      case 'used':
        return { label: '已使用', color: 'text-blue-400' };
      case 'expired':
        return { label: '已过期', color: 'text-gray-400' };
      case 'disabled':
        return { label: '已禁用', color: 'text-red-400' };
      default:
        return { label: status, color: 'text-gray-400' };
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.credits <= 0) {
      toast.error('积分数量必须大于0');
      return;
    }
    
    if (formData.usage_limit <= 0) {
      toast.error('使用次数必须大于0');
      return;
    }
    
    onSubmit(redeemCode.id, formData);
  };

  const isEditable = redeemCode.status === 'active';
  const statusInfo = getStatusDisplay(redeemCode.status);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 兑换码信息（只读） */}
      <div className="p-4 bg-surface/50 rounded-lg border border-white/10">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-text-muted">兑换码:</span>
            <span className="ml-2 text-text-primary font-mono">{redeemCode.code}</span>
          </div>
          <div>
            <span className="text-text-muted">类型:</span>
            <span className="ml-2 text-text-primary">{getTypeDisplay(redeemCode.type)}</span>
          </div>
          <div>
            <span className="text-text-muted">状态:</span>
            <span className={`ml-2 ${statusInfo.color}`}>{statusInfo.label}</span>
          </div>
          <div>
            <span className="text-text-muted">已使用:</span>
            <span className="ml-2 text-text-primary">{redeemCode.used_count || 0} 次</span>
          </div>
        </div>
      </div>

      {!isEditable && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
          ⚠️ 该兑换码状态为&quot;{statusInfo.label}&quot;，部分字段不可编辑
        </div>
      )}

      {/* 积分数量 */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">积分数量</label>
        <input
          type="number"
          value={formData.credits}
          onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 0 })}
          min="1"
          disabled={!isEditable}
          className="input-primary w-full px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* 使用次数限制 */}
      {redeemCode.type !== 'single_use' && (
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            使用次数限制
          </label>
          <input
            type="number"
            value={formData.usage_limit}
            onChange={(e) => setFormData({ ...formData, usage_limit: parseInt(e.target.value) || 1 })}
            min={redeemCode.used_count || 1}
            disabled={!isEditable}
            className="input-primary w-full px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-text-muted mt-1">
            当前已使用 {redeemCode.used_count || 0} 次，不能设置低于此值
          </p>
        </div>
      )}

      {/* 过期时间 */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">过期时间</label>
        <input
          type="date"
          value={formData.expires_at}
          onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
          min={new Date().toISOString().split('T')[0]}
          disabled={!isEditable}
          className="input-primary w-full px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* 描述 */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">描述</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="兑换码用途描述"
          rows={3}
          className="input-primary w-full px-4 py-2 resize-none"
        />
      </div>

      {/* 状态切换（仅当状态为 active 时可禁用） */}
      {isEditable && (
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">状态</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="input-primary w-full px-4 py-2"
          >
            <option value="active">可用</option>
            <option value="disabled">禁用</option>
          </select>
          <p className="text-xs text-text-muted mt-1">
            禁用后用户将无法使用此兑换码
          </p>
        </div>
      )}

      {/* 按钮 */}
      <div className="flex gap-3 pt-4">
        <button 
          type="submit" 
          className="btn-primary flex-1"
          disabled={!isEditable && formData.description === redeemCode.description}
        >
          保存修改
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 border border-white/10">
          取消
        </button>
      </div>
    </form>
  );
};

export default EditRedeemForm;
