'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';

import apiClient from '@/lib/api';
import { getErrorMessage } from '@/lib/http/errors';

type AddTemplateModalProps = {
  categoryOptions: string[];
  onClose: () => void;
  onCreated: () => void;
};

const AddTemplateModal: React.FC<AddTemplateModalProps> = ({ categoryOptions, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [coverAssetId, setCoverAssetId] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (categoryOptions.length > 0) {
      setCategory((prev) => (categoryOptions.includes(prev) ? prev : categoryOptions[0]));
    }
  }, [categoryOptions]);

  const handleSelectCover = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('封面必须是图片文件');
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setCoverAssetId(null);
  };

  const handleUploadCover = async (): Promise<string | null> => {
    if (!coverFile) return null;

    setUploadingCover(true);
    try {
      const upload = await apiClient.template.createCoverUploadUrl(coverFile.type);
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
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('请输入模板名称');
      return;
    }
    if (!category.trim()) {
      toast.error('请选择分类');
      return;
    }

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

      await apiClient.template.createTemplate({
        name: trimmedName,
        category: category.trim(),
        ...(resolvedCoverAssetId ? { cover_asset_id: resolvedCoverAssetId } : {}),
        prompt: `将用户上传的人物照片转换为${trimmedName}风格的图片。`,
        price_credits: 0,
        result_count: 1,
        sort_order: 0,
        status: 'published',
      });

      toast.success('模板创建成功');
      onCreated();
      onClose();
    } catch (error: unknown) {
      console.error('create template error:', error);
      toast.error(getErrorMessage(error, '创建模板失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card-primary max-w-xl w-full max-h-[90vh] overflow-y-auto p-6">
        <h3 className="text-xl font-bold text-text-primary mb-6">添加模板</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-text-muted mb-2">模板名称（必填）</label>
            <input
              className="input-primary w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：清透珠光写真"
              maxLength={80}
            />
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-2">分类（必填）</label>
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
              onChange={(e) => handleSelectCover(e.target.files?.[0] ?? null)}
            />
            {coverPreview ? (
              <div className="flex items-start gap-3">
                <img
                  src={coverPreview}
                  alt="封面预览"
                  className="w-28 h-28 object-cover rounded-xl border border-white/10"
                />
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-text-muted">{coverFile?.name}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingCover || saving}
                      className="btn-secondary text-xs border border-white/10 disabled:opacity-50"
                    >
                      更换图片
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCoverFile(null);
                        setCoverPreview('');
                        setCoverAssetId(null);
                      }}
                      disabled={uploadingCover || saving}
                      className="btn-secondary text-xs border border-white/10 disabled:opacity-50"
                    >
                      移除
                    </button>
                  </div>
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
                className="w-full border-2 border-dashed border-white/15 rounded-xl py-8 flex flex-col items-center gap-2 text-text-muted hover:border-white/30 hover:bg-white/[0.03] transition-colors disabled:opacity-50"
              >
                <ImagePlus size={28} />
                <span className="text-sm">{uploadingCover ? '上传中...' : '点击选择封面图片'}</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            disabled={saving || uploadingCover}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            <Save size={16} className="mr-2" />
            {saving ? '创建中...' : '创建模板'}
          </button>
          <button
            onClick={onClose}
            className="btn-secondary flex-1 border border-white/10"
            disabled={saving || uploadingCover}
          >
            <X size={16} className="mr-2" />
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddTemplateModal;
