'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Shuffle } from 'lucide-react';

interface CreateRedeemFormProps {
  onSubmit: (data: CreateRedeemFormData) => void;
  onCancel: () => void;
}

interface CreateRedeemFormData {
  code: string;
  credits: number;
  type: 'single_use' | 'multi_use' | 'time_limited';
  usage_limit: number;
  days: number;
  description: string;
}

// 生成随机兑换码
const generateRandomCode = (length: number = 12): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除容易混淆的字符
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // 每4个字符添加一个分隔符
  return result.match(/.{1,4}/g)?.join('-') || result;
};

const CreateRedeemForm: React.FC<CreateRedeemFormProps> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<CreateRedeemFormData>({
    code: '',
    credits: 100,
    type: 'single_use',
    usage_limit: 1,
    days: 30,
    description: ''
  });

  const handleGenerateCode = () => {
    setFormData({ ...formData, code: generateRandomCode() });
  };

  const handleTypeChange = (type: 'single_use' | 'multi_use' | 'time_limited') => {
    let usage_limit = formData.usage_limit;
    if (type === 'single_use') {
      usage_limit = 1;
    } else if (type === 'multi_use' && usage_limit === 1) {
      usage_limit = 10; // 默认多次使用为10次
    }
    setFormData({ ...formData, type, usage_limit });
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
    
    if (formData.days <= 0) {
      toast.error('有效期必须大于0天');
      return;
    }
    
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 兑换码 */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">兑换码</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            placeholder="例如: WELCOME-2024"
            className="input-primary flex-1 px-4 py-2"
          />
          <button
            type="button"
            onClick={handleGenerateCode}
            className="btn-secondary px-3 py-2 border border-white/10"
            title="随机生成"
          >
            <Shuffle size={16} />
          </button>
        </div>
        <p className="text-xs text-text-muted mt-1">留空时由服务端生成唯一兑换码</p>
      </div>

      {/* 积分数量 */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">积分数量</label>
        <input
          type="number"
          value={formData.credits}
          onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 0 })}
          min="1"
          className="input-primary w-full px-4 py-2"
        />
      </div>

      {/* 兑换码类型 */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">兑换码类型</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'single_use', label: '单次使用', desc: '每个用户只能使用一次' },
            { value: 'multi_use', label: '多次使用', desc: '可被多个用户使用' },
            { value: 'time_limited', label: '限时使用', desc: '在有效期内可多次使用' }
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleTypeChange(option.value as 'single_use' | 'multi_use' | 'time_limited')}
              className={`p-3 rounded-lg border text-left transition-all ${
                formData.type === option.value
                  ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                  : 'border-white/10 hover:border-white/20 text-text-muted'
              }`}
            >
              <div className="font-medium text-sm">{option.label}</div>
              <div className="text-xs opacity-70 mt-1">{option.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 使用次数限制 */}
      {formData.type !== 'single_use' && (
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            使用次数限制
          </label>
          <input
            type="number"
            value={formData.usage_limit}
            onChange={(e) => setFormData({ ...formData, usage_limit: parseInt(e.target.value) || 1 })}
            min="1"
            className="input-primary w-full px-4 py-2"
          />
          <p className="text-xs text-text-muted mt-1">
            {formData.type === 'multi_use' 
              ? '该兑换码最多可被使用的总次数' 
              : '在有效期内最多可使用的次数'}
          </p>
        </div>
      )}

      {/* 有效期 */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">有效期（天）</label>
        <input
          type="number"
          value={formData.days}
          onChange={(e) => setFormData({ ...formData, days: parseInt(e.target.value) || 0 })}
          min="1"
          className="input-primary w-full px-4 py-2"
        />
        <p className="text-xs text-text-muted mt-1">
          兑换码将在 {formData.days} 天后过期
        </p>
      </div>

      {/* 描述 */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">描述（可选）</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="兑换码用途描述，如：新用户注册奖励"
          rows={3}
          className="input-primary w-full px-4 py-2 resize-none"
        />
      </div>

      {/* 预览 */}
      <div className="p-4 bg-surface/50 rounded-lg border border-white/10">
        <h4 className="text-sm font-medium text-text-primary mb-2">预览</h4>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">兑换码:</span>
            <span className="text-text-primary font-mono">{formData.code || '(自动生成)'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">积分:</span>
            <span className="text-yellow-400">{formData.credits}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">类型:</span>
            <span className="text-text-primary">
              {formData.type === 'single_use' ? '单次使用' : 
               formData.type === 'multi_use' ? '多次使用' : '限时使用'}
            </span>
          </div>
          {formData.type !== 'single_use' && (
            <div className="flex justify-between">
              <span className="text-text-muted">使用限制:</span>
              <span className="text-text-primary">{formData.usage_limit} 次</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-text-muted">有效期:</span>
            <span className="text-text-primary">{formData.days} 天</span>
          </div>
        </div>
      </div>

      {/* 按钮 */}
      <div className="flex gap-3 pt-4">
        <button type="submit" className="btn-primary flex-1">
          创建兑换码
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 border border-white/10">
          取消
        </button>
      </div>
    </form>
  );
};

export default CreateRedeemForm;
