'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Save } from 'lucide-react';
import toast from 'react-hot-toast';

import apiClient from '@/lib/api';
import { getErrorMessage } from '@/lib/http/errors';
import { getTemplateCategories } from '@/lib/templateCategories';
import type { AIModel } from '@/components/resource/types';

type EditModelModalProps = {
  model: AIModel;
  onClose: () => void;
  onSave: (model: AIModel) => void;
};

const normalizeCreditsCost = (value: unknown, defaultValue = 1): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  const normalized = Math.round(parsed * 10) / 10;
  return normalized >= 0 ? normalized : defaultValue;
};

const EditModelModal: React.FC<EditModelModalProps> = ({
  model,
  onClose,
  onSave,
}) => {
  const [displayName, setDisplayName] = useState<string>(String(model.name || '').trim());
  const [category, setCategory] = useState<string>(String(model.category || '').trim());
  const [creditsCost, setCreditsCost] = useState<string>(String(model.cost_credits ?? 1));
  const [saving, setSaving] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>(String(model.cover_url || ''));
  const [coverAssetId, setCoverAssetId] = useState<string | null>(String(model.cover_asset_id || '') || null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const categoryOptions = useMemo(() => getTemplateCategories(), []);

  useEffect(() => {
    if (categoryOptions.length > 0 && !category) {
      setCategory(categoryOptions[0]);
    }
  }, [categoryOptions, category]);

  const modelId = useMemo(() => String(model.id || '').trim(), [model.id]);

  const handleUploadCover = async (): Promise<string | null> => {
    if (!coverFile) return null;

    setUploadingCover(true);
    try {
      const upload = await apiClient.template.createCoverUploadUrl();
      const response = await fetch(upload.upload_url, {
        method: 'PUT',
        body: await coverFile.arrayBuffer(),
        headers: { 'Content-Type': coverFile.type || 'application/octet-stream' },
      });
      if (!response.ok) {
        throw new Error(`上传失败: HTTP ${response.status}`);
      }
      setCoverAssetId(upload.asset_id);
      return upload.asset_id;
    } catch (error: unknown) {
      console.error('upload cover error:', error);
      toast.error(getErrorMessage(error, '封面上传失败'));
      return null;
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = async () => {
    const name = displayName.trim();
    if (!name) {
      toast.error('模板名称不能为空');
      return;
    }

    const parsedCredits = Number(creditsCost);
    if (!Number.isFinite(parsedCredits) || parsedCredits < 0) {
      toast.error('积分必须是大于等于 0 的数字');
      return;
    }
    const normalizedCredits = normalizeCreditsCost(parsedCredits, 0);

    setSaving(true);
    try {
      let resolvedCoverAssetId = coverAssetId;
      if (coverFile && !resolvedCoverAssetId) {
        resolvedCoverAssetId = await handleUploadCover();
        if (!resolvedCoverAssetId) {
          setSaving(false);
          return;
        }
      }

      const updated = await apiClient.model.updateModelConfig(modelId, {
        display_name: name,
        ...(category.trim() ? { category: category.trim() } : {}),
        ...(resolvedCoverAssetId ? { cover_asset_id: resolvedCoverAssetId } : {}),
        credits_cost: normalizedCredits,
      });

      onSave({
        ...model,
        name: updated.name,
        category: updated.category ?? category.trim(),
        cover_asset_id: updated.cover_asset_id ?? resolvedCoverAssetId,
        cover_url: updated.cover_url ?? (coverPreview || null),
        cost_credits: normalizeCreditsCost(updated.cost_credits, normalizedCredits),
        is_active: updated.is_active,
      });
      toast.success('模板配置已保存');
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
          <h3 className="text-xl font-bold text-text-primary mb-6">编辑模板</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-muted mb-2">模板 ID（只读）</label>
              <input className="input-primary w-full opacity-70" value={modelId} disabled />
            </div>

            <div>
              <label className="block text-sm text-text-muted mb-2">名称</label>
              <input
                className="input-primary w-full"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm text-text-muted mb-2">分类</label>
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setCategory(option)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      category === option
                        ? 'bg-accent/20 text-accent border border-accent/40'
                        : 'bg-white/5 text-text-muted border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-text-muted mb-2">封面</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (!file) return;
                  if (!file.type.startsWith('image/')) {
                    toast.error('封面必须是图片文件');
                    return;
                  }
                  setCoverFile(file);
                  setCoverPreview(URL.createObjectURL(file));
                  setCoverAssetId(null);
                }}
              />
              {coverPreview ? (
                <div className="flex items-start gap-3">
                  <img
                    src={coverPreview}
                    alt="封面预览"
                    className="w-28 h-28 object-cover rounded-xl border border-white/10"
                  />
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingCover || saving}
                      className="btn-secondary text-xs border border-white/10 disabled:opacity-50"
                    >
                      更换图片
                    </button>
                    {coverAssetId ? (
                      <span className="text-xs text-green-400">封面已上传</span>
                    ) : (
                      <span className="text-xs text-text-muted">保存时自动上传</span>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingCover || saving}
                  className="w-full border-2 border-dashed border-white/15 rounded-xl py-6 flex flex-col items-center gap-2 text-text-muted hover:border-white/30 hover:bg-white/[0.03] transition-colors disabled:opacity-50"
                >
                  <ImagePlus size={24} />
                  <span className="text-sm">{uploadingCover ? '上传中...' : '点击选择封面图片'}</span>
                </button>
              )}
            </div>

            <div>
              <label className="block text-sm text-text-muted mb-2">单次生成消耗积分</label>
              <input
                type="number"
                min={0}
                step={0.1}
                className="input-primary w-full"
                value={creditsCost}
                onChange={(e) => setCreditsCost(e.target.value)}
              />
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
