'use client';

import React, { useState } from 'react';
import { Gift, Loader2, Copy, Download, CheckCircle } from 'lucide-react';
import { getErrorMessage, getErrorStatus, getErrorCode } from '@/lib/http/errors';
import toast from 'react-hot-toast';

interface BatchCreateRedeemFormProps {
  onSubmit: (data: BatchCreateData) => Promise<BatchCreateResult>;
  onCancel: () => void;
}

interface BatchCreateData {
  count: number;
  credits: number;
  type: 'single_use' | 'multi_use' | 'time_limited';
  usage_limit?: number;
  days: number;
  prefix?: string;
  description?: string;
}

interface BatchCreateResult {
  codes: string[];
  batch_id: string;
  created_count: number;
}

const BatchCreateRedeemForm: React.FC<BatchCreateRedeemFormProps> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<BatchCreateData>({
    count: 10,
    credits: 100,
    type: 'single_use',
    usage_limit: 1,
    days: 30,
    prefix: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BatchCreateResult | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const handleChange = (field: keyof BatchCreateData, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.count < 1 || formData.count > 100) {
      toast.error('批量数量必须在 1-100 之间');
      return;
    }
    
    if (formData.credits < 1) {
      toast.error('积分数量必须大于 0');
      return;
    }

    setLoading(true);
    try {
      const res = await onSubmit(formData);
      setResult(res);
      toast.success(`成功创建 ${res.created_count} 个兑换码`);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, '批量创建失败'));
    } finally {
      setLoading(false);
    }
  };

  const copyAllCodes = async () => {
    if (!result?.codes) return;
    
    const codesText = result.codes.join('\n');
    await navigator.clipboard.writeText(codesText);
    setCopiedAll(true);
    toast.success('已复制所有兑换码');
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const downloadCodes = () => {
    if (!result?.codes) return;
    
    const csvContent = [
      '兑换码,积分,类型,状态',
      ...result.codes.map(code => `${code},${formData.credits},${formData.type},active`)
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `兑换码批次_${result.batch_id}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('已下载兑换码列表');
  };

  // 显示结果页面
  if (result) {
    return (
      <div className="space-y-6">
        {/* 成功提示 */}
        <div className="flex items-center gap-3 p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
          <CheckCircle className="w-6 h-6 text-green-400" />
          <div>
            <p className="font-medium text-green-400">批量创建成功</p>
            <p className="text-sm text-text-muted">
              已创建 {result.created_count} 个兑换码，批次ID: {result.batch_id}
            </p>
          </div>
        </div>

        {/* 兑换码列表 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-muted">兑换码列表</span>
            <div className="flex gap-2">
              <button
                onClick={copyAllCodes}
                className="btn-secondary-sm text-xs border border-white/10"
              >
                {copiedAll ? <CheckCircle size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
                复制全部
              </button>
              <button
                onClick={downloadCodes}
                className="btn-secondary-sm text-xs border border-white/10"
              >
                <Download size={14} className="mr-1" />
                下载 CSV
              </button>
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto bg-surface/50 rounded-lg p-3 space-y-1">
            {result.codes.map((code, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-2 bg-white/5 rounded font-mono text-sm"
              >
                <span>{code}</span>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(code);
                    toast.success('已复制');
                  }}
                  className="p-1 text-text-muted hover:text-white transition-colors"
                >
                  <Copy size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3 pt-4 border-t border-white/10">
          <button
            onClick={() => {
              setResult(null);
              setFormData({
                count: 10,
                credits: 100,
                type: 'single_use',
                usage_limit: 1,
                days: 30,
                prefix: '',
                description: ''
              });
            }}
            className="btn-secondary flex-1 border border-white/10"
          >
            继续创建
          </button>
          <button
            onClick={onCancel}
            className="btn-primary flex-1"
          >
            完成
          </button>
        </div>
      </div>
    );
  }

  // 表单页面
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 批量数量 */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          批量数量 <span className="text-red-400">*</span>
        </label>
        <input
          type="number"
          value={formData.count}
          onChange={(e) => handleChange('count', parseInt(e.target.value) || 1)}
          min={1}
          max={100}
          className="input-primary w-full"
          placeholder="1-100"
          required
        />
        <p className="text-xs text-text-muted mt-1">单次最多创建 100 个兑换码</p>
      </div>

      {/* 积分数量 */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          每个兑换码积分 <span className="text-red-400">*</span>
        </label>
        <input
          type="number"
          value={formData.credits}
          onChange={(e) => handleChange('credits', parseInt(e.target.value) || 0)}
          min={1}
          className="input-primary w-full"
          placeholder="输入积分数量"
          required
        />
      </div>

      {/* 兑换码类型 */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          兑换码类型 <span className="text-red-400">*</span>
        </label>
        <select
          value={formData.type}
          onChange={(e) => handleChange('type', e.target.value)}
          className="input-primary w-full"
        >
          <option value="single_use">单次使用</option>
          <option value="multi_use">多次使用</option>
          <option value="time_limited">限时使用</option>
        </select>
      </div>

      {/* 使用次数限制 - 仅多次使用时显示 */}
      {formData.type === 'multi_use' && (
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            每个码使用次数限制
          </label>
          <input
            type="number"
            value={formData.usage_limit}
            onChange={(e) => handleChange('usage_limit', parseInt(e.target.value) || 1)}
            min={1}
            className="input-primary w-full"
            placeholder="输入使用次数限制"
          />
        </div>
      )}

      {/* 有效期 */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          有效期（天）
        </label>
        <select
          value={formData.days}
          onChange={(e) => handleChange('days', parseInt(e.target.value))}
          className="input-primary w-full"
        >
          <option value={7}>7 天</option>
          <option value={30}>30 天</option>
          <option value={90}>90 天</option>
          <option value={180}>180 天</option>
          <option value={365}>365 天</option>
        </select>
      </div>

      {/* 前缀 */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          兑换码前缀（可选）
        </label>
        <input
          type="text"
          value={formData.prefix}
          onChange={(e) => handleChange('prefix', e.target.value.toUpperCase())}
          maxLength={6}
          className="input-primary w-full"
          placeholder="如: PROMO, VIP, NEW"
        />
        <p className="text-xs text-text-muted mt-1">最多 6 个字符，将自动转为大写</p>
      </div>

      {/* 描述 */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          批次描述（可选）
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          className="input-primary w-full resize-none"
          rows={2}
          placeholder="如: 2026年新年活动兑换码"
        />
      </div>

      {/* 预览信息 */}
      <div className="p-4 bg-surface/50 rounded-lg border border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <Gift className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium">批量创建预览</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-text-muted">数量:</div>
          <div className="text-text-primary">{formData.count} 个</div>
          <div className="text-text-muted">总积分:</div>
          <div className="text-text-primary">{formData.count * formData.credits} 积分</div>
          <div className="text-text-muted">类型:</div>
          <div className="text-text-primary">
            {formData.type === 'single_use' ? '单次使用' : 
             formData.type === 'multi_use' ? '多次使用' : '限时使用'}
          </div>
          {formData.prefix && (
            <>
              <div className="text-text-muted">前缀:</div>
              <div className="text-text-primary font-mono">{formData.prefix}</div>
            </>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3 pt-4 border-t border-white/10">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary flex-1 border border-white/10"
          disabled={loading}
        >
          取消
        </button>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary flex-1 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              创建中...
            </>
          ) : (
            <>
              <Gift size={16} className="mr-2" />
              批量创建
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default BatchCreateRedeemForm;