'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Plus, RefreshCcw, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import apiClient from '@/lib/api';
import { getErrorMessage } from '@/lib/http/errors';
import type { OperationHomeBanner } from '@/lib/api-clients/clients/operationClient';
import type { AdminTemplate } from '@/lib/api-clients/clients/templateClient';
import { Skeleton } from '@/components/ui/Skeleton';
import TemplatePicker from './TemplatePicker';

type EditableBanner = OperationHomeBanner & {
  local_preview_url?: string;
};

const createBanner = (sortOrder: number): EditableBanner => ({
  id: crypto.randomUUID(),
  title: '首页轮播',
  image_asset_id: '',
  image_url: '',
  template_id: '',
  sort_order: sortOrder,
  status: 'active',
});

const sortBanners = (items: EditableBanner[]) =>
  [...items].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

export default function OperationSettingsPanel() {
  const [banners, setBanners] = useState<EditableBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const activeCount = useMemo(
    () => banners.filter((banner) => banner.status === 'active' && (banner.image_url || banner.local_preview_url)).length,
    [banners]
  );

  const loadConfig = async () => {
    setLoading(true);
    try {
      const config = await apiClient.operation.getOperationConfig();
      setBanners(sortBanners(config.home_banners || []));
    } catch (error: unknown) {
      console.error('load operation config error:', error);
      toast.error(getErrorMessage(error, '运营配置加载失败'));
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    setTemplatesLoading(true);
    try {
      setTemplates(await apiClient.template.listTemplates());
    } catch (error: unknown) {
      console.error('load templates error:', error);
      toast.error(getErrorMessage(error, '模板列表加载失败'));
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    void loadConfig();
    void loadTemplates();
  }, []);

  const updateBanner = (id: string, patch: Partial<EditableBanner>) => {
    setBanners((current) =>
      sortBanners(current.map((banner) => (banner.id === id ? { ...banner, ...patch } : banner)))
    );
  };

  const addBanner = () => {
    const nextSortOrder = banners.reduce((max, banner) => Math.max(max, Number(banner.sort_order) || 0), 0) + 10;
    setBanners((current) => [...current, createBanner(nextSortOrder)]);
  };

  const removeBanner = (id: string) => {
    setBanners((current) => current.filter((banner) => banner.id !== id));
  };

  const moveBanner = (id: string, direction: -1 | 1) => {
    const ordered = sortBanners(banners).map((banner) => ({ ...banner }));
    const index = ordered.findIndex((banner) => banner.id === id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;

    const currentOrder = ordered[index].sort_order;
    ordered[index].sort_order = ordered[targetIndex].sort_order;
    ordered[targetIndex].sort_order = currentOrder;
    setBanners(sortBanners(ordered));
  };

  const uploadImage = async (bannerId: string, file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('运营位图片必须是图片文件');
      return;
    }

    setUploadingId(bannerId);
    try {
      const upload = await apiClient.operation.createOperationImageUploadUrl(file.type);
      const response = await fetch(upload.upload_url, {
        method: 'PUT',
        body: await file.arrayBuffer(),
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!response.ok) {
        throw new Error(`上传失败: HTTP ${response.status}`);
      }
      updateBanner(bannerId, {
        image_asset_id: upload.asset_id,
        local_preview_url: URL.createObjectURL(file),
      });
      toast.success('图片已上传，保存后小程序生效');
    } catch (error: unknown) {
      console.error('upload operation image error:', error);
      toast.error(getErrorMessage(error, '运营位图片上传失败'));
    } finally {
      setUploadingId(null);
    }
  };

  const saveConfig = async () => {
    const normalized = sortBanners(banners).map((banner, index) => ({
      ...banner,
      title: banner.title.trim() || `首页轮播 ${index + 1}`,
      template_id: banner.template_id.trim(),
      sort_order: Number.isFinite(Number(banner.sort_order)) ? Math.trunc(Number(banner.sort_order)) : index + 1,
    }));

    const invalid = normalized.find((banner) => !banner.template_id || (!banner.image_asset_id && !banner.image_url));
    if (invalid) {
      toast.error('每张轮播图都需要图片和模板 ID');
      return;
    }

    setSaving(true);
    try {
      const saved = await apiClient.operation.updateOperationConfig({
        home_banners: normalized.map(({ local_preview_url: _localPreviewUrl, ...banner }) => banner),
      });
      setBanners(sortBanners(saved.home_banners || []));
      toast.success('运营配置已保存');
    } catch (error: unknown) {
      console.error('save operation config error:', error);
      toast.error(getErrorMessage(error, '运营配置保存失败'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="card-primary p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">首页轮播配置</h2>
            <p className="mt-1 text-sm text-text-muted">
              已配置 {banners.length} 张，当前小程序展示 {activeCount} 张。点击轮播图会跳转到绑定模板的即变页面。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-secondary flex items-center gap-2 border border-white/10"
              onClick={() => void loadConfig()}
              disabled={saving || Boolean(uploadingId)}
            >
              <RefreshCcw size={16} />
              刷新
            </button>
            <button
              type="button"
              className="btn-secondary flex items-center gap-2 border border-white/10"
              onClick={addBanner}
              disabled={saving || Boolean(uploadingId) || banners.length >= 10}
            >
              <Plus size={16} />
              新增轮播
            </button>
            <button
              type="button"
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
              onClick={() => void saveConfig()}
              disabled={saving || Boolean(uploadingId)}
            >
              <Save size={16} />
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </div>
      </section>

      {banners.length === 0 ? (
        <section className="card-primary flex min-h-[360px] flex-col items-center justify-center p-10 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-text-muted">
            <ImagePlus size={30} />
          </div>
          <h3 className="text-lg font-semibold text-text-primary">还没有首页运营图</h3>
          <p className="mt-2 max-w-md text-sm text-text-muted">
            新增轮播后上传图片并填写模板 ID，保存后小程序首页会自动展示多图轮播。
          </p>
          <button type="button" className="btn-primary mt-6 flex items-center gap-2" onClick={addBanner}>
            <Plus size={16} />
            新增第一张
          </button>
        </section>
      ) : (
        <div className="space-y-4">
          {sortBanners(banners).map((banner, index) => {
            const previewUrl = banner.local_preview_url || banner.image_url;
            const uploading = uploadingId === banner.id;

            return (
              <section key={banner.id} className="card-primary p-5">
                <div className="grid gap-5 xl:grid-cols-[280px,1fr]">
                  <div>
                    <input
                      id={`operation-banner-image-${banner.id}`}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        void uploadImage(banner.id, event.target.files?.[0] || null);
                        event.currentTarget.value = '';
                      }}
                    />
                    {previewUrl ? (
                      <label
                        htmlFor={`operation-banner-image-${banner.id}`}
                        className="group relative block aspect-[5/3] cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                      >
                        <img src={previewUrl} alt={banner.title || '首页轮播图'} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 text-sm font-medium text-white opacity-0 transition-all group-hover:bg-black/35 group-hover:opacity-100">
                          {uploading ? '上传中...' : '更换图片'}
                        </div>
                      </label>
                    ) : (
                      <label
                        htmlFor={`operation-banner-image-${banner.id}`}
                        className="flex aspect-[5/3] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.03] text-text-muted transition-colors hover:border-white/30 hover:bg-white/[0.05]"
                      >
                        <ImagePlus size={30} />
                        <span className="mt-2 text-sm">{uploading ? '上传中...' : '上传轮播图'}</span>
                      </label>
                    )}
                    <p className="mt-2 text-xs text-text-muted">建议尺寸 750 × 604 或同等比例，使用 JPG/PNG/WebP。</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-text-muted">
                          #{index + 1}
                        </span>
                        <button
                          type="button"
                          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                            banner.status === 'active'
                              ? 'bg-green-500/15 text-green-300'
                              : 'bg-white/5 text-text-muted'
                          }`}
                          onClick={() =>
                            updateBanner(banner.id, { status: banner.status === 'active' ? 'inactive' : 'active' })
                          }
                        >
                          {banner.status === 'active' ? (
                            <span className="inline-flex items-center gap-1"><Eye size={13} />展示中</span>
                          ) : (
                            <span className="inline-flex items-center gap-1"><EyeOff size={13} />已停用</span>
                          )}
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-ghost-sm px-3"
                          onClick={() => moveBanner(banner.id, -1)}
                          disabled={index === 0}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn-ghost-sm px-3"
                          onClick={() => moveBanner(banner.id, 1)}
                          disabled={index === banners.length - 1}
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn-ghost-sm px-3 text-red-300 hover:text-red-200"
                          onClick={() => removeBanner(banner.id)}
                          disabled={saving || uploading}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1fr,220px]">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-text-primary">运营图标题</label>
                        <input
                          className="input-primary w-full"
                          value={banner.title}
                          maxLength={80}
                          onChange={(event) => updateBanner(banner.id, { title: event.target.value })}
                          placeholder="例如：新年头像上新"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-text-primary">排序</label>
                        <input
                          type="number"
                          className="input-primary w-full"
                          value={banner.sort_order}
                          onChange={(event) => updateBanner(banner.id, { sort_order: Number(event.target.value) })}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-text-primary">绑定模板</label>
                      <TemplatePicker
                        value={banner.template_id}
                        templates={templates}
                        loading={templatesLoading}
                        onChange={(id) => updateBanner(banner.id, { template_id: id })}
                        placeholder="搜索并选择跳转目标模板"
                        disabled={saving || Boolean(uploadingId)}
                      />
                      <p className="mt-2 text-xs text-text-muted">
                        从列表中选择模板，保存后点击轮播图进入 /pages/create/index?id=模板ID。支持按名称/分类搜索。
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
