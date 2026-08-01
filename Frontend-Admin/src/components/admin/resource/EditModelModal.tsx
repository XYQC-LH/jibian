'use client';

import React, { useMemo, useState } from 'react';
import { Edit, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';

import apiClient from '@/lib/api';
import { getErrorMessage, getErrorStatus, getErrorCode } from '@/lib/http/errors';
import type { AIModel } from '@/components/resource/types';
type EditModelModalProps = {
  model: AIModel;
  onClose: () => void;
  onSave: (model: AIModel) => void;
  onUpdateModelPricingMultiplier: (nextMultiplier: number) => void;
  onUpdateAcceptGlobalPricingMultiplier: (nextAccept: boolean) => void;
};

const normalizeCreditsCost = (value: unknown, defaultValue = 1): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  const normalized = Math.round(parsed * 10) / 10;
  return normalized >= 0 ? normalized : defaultValue;
};

const normalizeMultiplier = (value: unknown, defaultValue = 1): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return Math.round(parsed * 10000) / 10000;
};

const EditModelModal: React.FC<EditModelModalProps> = ({
  model,
  onClose,
  onSave,
  onUpdateModelPricingMultiplier,
  onUpdateAcceptGlobalPricingMultiplier,
}) => {
  const [displayName, setDisplayName] = useState<string>(String(model.name || '').trim());
  const [description, setDescription] = useState<string>(String(model.description || ''));
  const [creditsCost, setCreditsCost] = useState<string>(String(model.cost_credits ?? 1));
  const [saving, setSaving] = useState(false);
  const [editMultiplier, setEditMultiplier] = useState(false);
  const [tempMultiplier, setTempMultiplier] = useState(normalizeMultiplier(model.model_pricing_multiplier));

  const modelId = useMemo(() => String(model.id || '').trim(), [model.id]);
  const pricingEditable = model.pricing_editable ?? true;
  const acceptGlobalMultiplier = model.accept_global_pricing_multiplier ?? true;
  const currentMultiplier = normalizeMultiplier(model.model_pricing_multiplier);

  const handleMultiplierSave = () => {
    const next = normalizeMultiplier(tempMultiplier);
    if (next !== currentMultiplier && next > 0) {
      onUpdateModelPricingMultiplier(next);
    }
    setEditMultiplier(false);
  };

  const handleSave = async () => {
    const name = displayName.trim();
    if (!name) {
      toast.error('模型名称不能为空');
      return;
    }

    let normalizedCredits = 0;
    if (pricingEditable) {
      const parsedCredits = Number(creditsCost);
      if (!Number.isFinite(parsedCredits) || parsedCredits < 0) {
        toast.error('积分必须是大于等于 0 的数字');
        return;
      }

      normalizedCredits = normalizeCreditsCost(parsedCredits, 0);
    }

    setSaving(true);
    try {
      const updated = await apiClient.model.updateModelConfig(modelId, {
        display_name: name,
        description,
        ...(pricingEditable ? { credits_cost: normalizedCredits } : {}),
      });

      onSave({
        ...model,
        name: updated.name,
        description: updated.description,
        cost_credits: normalizeCreditsCost(updated.cost_credits, normalizedCredits),
        is_active: updated.is_active,
      });
      toast.success('模型配置已保存');
    } catch (error: unknown) {
      console.error('update model config error:', error);
      toast.error(getErrorMessage(error, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="card-primary max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
          <h3 className="text-xl font-bold text-text-primary mb-6">编辑模型</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-muted mb-2">模型 ID（只读）</label>
              <input className="input-primary w-full opacity-70" value={modelId} disabled />
            </div>

            <div>
              <label className="block text-sm text-text-muted mb-2">display_name</label>
              <input
                className="input-primary w-full"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm text-text-muted mb-2">description</label>
              <textarea
                className="input-primary w-full min-h-[100px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {pricingEditable ? (
              <div>
                <label className="block text-sm text-text-muted mb-2">credits_cost</label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  className="input-primary w-full"
                  value={creditsCost}
                  onChange={(e) => setCreditsCost(e.target.value)}
                />
              </div>
            ) : null}

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">接受全局倍率</p>
                  <p className="text-xs text-text-muted">关闭后该模型仅使用模型级倍率，不叠加全局倍率</p>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateAcceptGlobalPricingMultiplier(!acceptGlobalMultiplier)}
                  aria-label={acceptGlobalMultiplier ? '关闭全局倍率叠加' : '开启全局倍率叠加'}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    acceptGlobalMultiplier ? 'bg-orange-500/80' : 'bg-gray-500/40'
                  } cursor-pointer`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      acceptGlobalMultiplier ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">模型级倍率</p>
                  <p className="text-xs text-text-muted">
                    {acceptGlobalMultiplier ? '与全局倍率叠加生效' : '仅模型倍率单独生效'}
                  </p>
                </div>
                {editMultiplier ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={tempMultiplier}
                      onChange={(e) => setTempMultiplier(normalizeMultiplier(e.target.value, 1))}
                      className="input-primary w-20"
                      min="0.0001"
                      step="0.0001"
                    />
                    <button
                      type="button"
                      onClick={handleMultiplierSave}
                      className="p-1.5 text-green-400 hover:text-green-300"
                    >
                      <Save size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditMultiplier(false);
                        setTempMultiplier(currentMultiplier);
                      }}
                      className="p-1.5 text-red-400 hover:text-red-300"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      {currentMultiplier.toFixed(4)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setTempMultiplier(currentMultiplier);
                        setEditMultiplier(true);
                      }}
                      className="p-1 text-text-muted hover:text-text-primary"
                    >
                      <Edit size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              <Save size={16} className="mr-2" />
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              onClick={onClose}
              className="btn-secondary flex-1 border border-white/10"
              disabled={saving}
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default EditModelModal;
