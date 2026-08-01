'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCcw, Shield, ShieldOff, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import apiClient from '@/lib/api';
import { logger } from '@/lib/logger';
import { getErrorMessage, getErrorStatus, getErrorCode } from '@/lib/http/errors';
import ModerationAssetPreview from './admin/moderation/ModerationAssetPreview';

type ModerationConfig = {
  enabled: boolean;
  enabled_source?: string | null;
  provider?: string | null;
  last_modified_at?: string | null;
  last_modified_by?: string | null;
};

type ModerationSummaryBucket = {
  total?: number;
  passed?: number;
  blocked?: number;
  skipped?: number;
  unknown?: number;
};

type ModerationDashboardItem = {
  task_id?: number;
  image_index?: number;
  image_url?: string | null;
  generated_at?: string | null;
  checked_at?: string | null;
  user_id?: number | null;
  user_email?: string | null;
  provider?: string | null;
  risk_level?: string | null;
  moderation_status?: 'passed' | 'blocked' | 'skipped' | 'unknown' | string;
  moderation_status_label?: string | null;
  reason?: string | null;
  task_status?: string | null;
};

type ModerationDashboardResponse = {
  config?: ModerationConfig;
  summary?: {
    all_time?: ModerationSummaryBucket;
    last_24h?: ModerationSummaryBucket;
    last_7d?: ModerationSummaryBucket;
  };
  items?: ModerationDashboardItem[];
  total?: number;
};

import { formatChinaDateTime as formatDateTime } from '@/utils/format';

const normalizeText = (value?: string | number | null) => {
  const text = String(value ?? '').trim();
  return text || '-';
};

const formatProvider = (value?: string | null) => {
  const provider = String(value || '').trim().toLowerCase();
  if (!provider) return '暂无记录';
  if (provider === 'aliyun_green_plus') return '阿里云内容安全增强版';
  return provider;
};

const formatRiskLevel = (value?: string | null, status?: string | null) => {
  const level = String(value || '').trim().toLowerCase();
  if (level) return level;
  if (status === 'skipped') return '审核关闭';
  return '暂无记录';
};

const formatStatus = (item: ModerationDashboardItem) => normalizeText(item.moderation_status_label);

const MODERATION_IMAGE_BATCH_SIZE = 10;

const statusTone = (item: ModerationDashboardItem) => {
  const status = String(item.moderation_status || '').trim().toLowerCase();
  if (status === 'blocked') return 'border border-red-500/25 bg-red-500/10 text-red-300';
  if (status === 'passed') return 'border border-green-500/25 bg-green-500/10 text-green-300';
  if (status === 'skipped') return 'border border-yellow-500/25 bg-yellow-500/10 text-yellow-300';
  return 'border border-white/10 bg-white/5 text-text-muted';
};

const bucketValue = (bucket?: ModerationSummaryBucket | null) => ({
  total: Number(bucket?.total || 0),
  passed: Number(bucket?.passed || 0),
  blocked: Number(bucket?.blocked || 0),
});

function StatCard({
  title,
  value,
  hint,
  tone,
  icon,
}: {
  title: string;
  value: string | number;
  hint: string;
  tone: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`admin-stat-card rounded-2xl p-5 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-text-muted">{title}</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">{value}</div>
          <div className="mt-2 text-xs text-text-muted">{hint}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-current">{icon}</div>
      </div>
    </div>
  );
}

export default function AdminContentModerationCenter() {
  // 简化：后端通过 env + cookie 鉴权，前端不再依赖 role 字段
  const isSuperAdmin = true;

  const [loading, setLoading] = useState(false);
  const [savingSwitch, setSavingSwitch] = useState(false);
  const [config, setConfig] = useState<ModerationConfig>({ enabled: false });
  const [dashboard, setDashboard] = useState<ModerationDashboardResponse | null>(null);
  const [visibleImageCount, setVisibleImageCount] = useState(MODERATION_IMAGE_BATCH_SIZE);
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);

  const allTime = useMemo(() => bucketValue(dashboard?.summary?.all_time), [dashboard]);
  const last24h = useMemo(() => bucketValue(dashboard?.summary?.last_24h), [dashboard]);
  const last7d = useMemo(() => bucketValue(dashboard?.summary?.last_7d), [dashboard]);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.moderation.getModerationDashboard(240);
      const configData = data?.config as Record<string, unknown> | undefined;
      setConfig({
        enabled: Boolean(configData?.enabled),
        enabled_source: String(configData?.enabled_source ?? '') || null,
        provider: String(configData?.provider ?? '') || null,
        last_modified_at: String(configData?.last_modified_at ?? '') || null,
        last_modified_by: String(configData?.last_modified_by ?? '') || null,
      });
      setDashboard(data as unknown as ModerationDashboardResponse | null);
    } catch (error: unknown) {
      logger.error('Failed to fetch moderation dashboard', error);
      toast.error(getErrorMessage(error, '加载内容审核中心失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const toggleModeration = useCallback(
    async (nextEnabled: boolean) => {
      if (!isSuperAdmin) return;
      setSavingSwitch(true);
      try {
        await apiClient.moderation.updateModerationConfig({ enabled: nextEnabled });
        toast.success(nextEnabled ? '内容审核已开启' : '内容审核已关闭');
        await fetchDashboard();
      } catch (error: unknown) {
        logger.error('Failed to update moderation switch', error);
        toast.error(getErrorMessage(error, '更新审核开关失败'));
      } finally {
        setSavingSwitch(false);
      }
    },
    [fetchDashboard, isSuperAdmin]
  );

  const items = useMemo(
    () => (Array.isArray(dashboard?.items) ? dashboard.items : []),
    [dashboard?.items],
  );
  const visibleItems = useMemo(
    () => items.slice(0, Math.min(visibleImageCount, items.length)),
    [items, visibleImageCount],
  );

  useEffect(() => {
    setVisibleImageCount(MODERATION_IMAGE_BATCH_SIZE);
  }, [items.length]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;
    if (visibleImageCount >= items.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setVisibleImageCount((current) => Math.min(current + MODERATION_IMAGE_BATCH_SIZE, items.length));
      },
      { rootMargin: '240px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [items.length, visibleImageCount]);

  return (
    <section className="space-y-6">
      <div className="card-primary p-6 admin-glow">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/25 bg-purple-500/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-purple-200">
              内容审核中心
            </div>
            <div>
              <h2 className="admin-section-title text-2xl font-semibold tracking-tight text-text-primary">自动审核总览</h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                这里只保留自动审核的观测和总开关，不再保留人工审核池、人工复核按钮或待审核列表。
              </p>
            </div>
          </div>

          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-background/40 p-5 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm text-text-muted">全局审核开关</div>
                <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-text-primary">
                  {config.enabled ? (
                    <Shield className="h-5 w-5 text-green-300" />
                  ) : (
                    <ShieldOff className="h-5 w-5 text-yellow-300" />
                  )}
                  {config.enabled ? '已开启' : '已关闭'}
                </div>
                <div className="mt-2 text-xs leading-5 text-text-muted">
                  只有 `super_admin` 可以切换。关闭后新任务不参与审核并直接放行，开启后输入和输出都会走阿里云自动审核。
                </div>
              </div>

              <button
                type="button"
                onClick={() => toggleModeration(!config.enabled)}
                disabled={!isSuperAdmin || savingSwitch}
                className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full border transition ${
                  config.enabled
                    ? 'border-green-400/60 bg-green-500/80'
                    : 'border-white/10 bg-white/10'
                } ${!isSuperAdmin ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                aria-label="切换内容审核开关"
              >
                <span
                  className={`inline-block h-6 w-6 rounded-full bg-white shadow transition ${
                    config.enabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => fetchDashboard()}
                className="btn-secondary-sm"
              >
                <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                刷新数据
              </button>
              {!isSuperAdmin ? <span className="text-xs text-yellow-300">当前账号不是 super_admin，仅可查看</span> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <StatCard
          title="累计通过"
          value={allTime.passed.toLocaleString()}
          hint={`累计图片 ${allTime.total.toLocaleString()} 张`}
          tone="text-green-300"
          icon={<CheckCircle2 className="h-5 w-5 text-green-300" />}
        />
        <StatCard
          title="累计拦截"
          value={allTime.blocked.toLocaleString()}
          hint={`累计图片 ${allTime.total.toLocaleString()} 张`}
          tone="text-red-300"
          icon={<XCircle className="h-5 w-5 text-red-300" />}
        />
        <StatCard
          title="最近 24 小时"
          value={`${last24h.passed}/${last24h.blocked}`}
          hint={`通过 / 拦截，共 ${last24h.total.toLocaleString()} 张`}
          tone="text-blue-300"
          icon={<Shield className="h-5 w-5 text-blue-300" />}
        />
        <StatCard
          title="最近 7 天"
          value={`${last7d.passed}/${last7d.blocked}`}
          hint={`通过 / 拦截，共 ${last7d.total.toLocaleString()} 张`}
          tone="text-purple-300"
          icon={<AlertCircle className="h-5 w-5 text-purple-300" />}
        />
      </div>

      <div className="card-primary overflow-hidden p-0">
        <div className="flex flex-col gap-2 border-b border-white/10 px-6 py-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="admin-section-title text-lg font-semibold text-text-primary">全部图片审核记录</h3>
            <p className="mt-1 text-sm text-text-muted">
              不区分通过还是拦截，所有能展示的图片都直接列在这里，默认按生成时间倒序排列。
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-text-muted">
            当前展示 {visibleItems.length.toLocaleString()} / {items.length.toLocaleString()} 张图片
          </div>
        </div>

        {items.length ? (
          <div className="p-5">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {visibleItems.map((item, index) => {
              const imageUrl = String(item.image_url || '').trim();
              return (
                <article
                  key={`${item.task_id || 'task'}-${item.image_index || 0}-${index}`}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] transition-colors hover:border-white/20 hover:bg-white/[0.05]"
                >
                  <div className="grid grid-cols-1 gap-0 md:grid-cols-[208px_minmax(0,1fr)]">
                    <div className="group h-full min-h-[208px] overflow-hidden bg-background/70">
                      {imageUrl ? (
                        <ModerationAssetPreview
                          rawUrl={imageUrl}
                          kind="image"
                          alt="moderation-item"
                          wrapperClassName="h-full min-h-[208px]"
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-text-muted">无图片</div>
                      )}
                    </div>

                    <div className="flex flex-col gap-4 p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone(item)}`}>
                          {formatStatus(item)}
                        </span>
                        <span className="rounded-full border border-purple-500/25 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-200">
                          风险等级 {formatRiskLevel(item.risk_level, item.moderation_status)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-3 text-sm text-text-secondary sm:grid-cols-2">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-text-muted">生成时间</div>
                          <div className="mt-1 font-medium text-text-primary">{formatDateTime(item.generated_at)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-text-muted">审核时间</div>
                          <div className="mt-1 font-medium text-text-primary">{formatDateTime(item.checked_at)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-text-muted">生成者</div>
                          <div className="mt-1 font-medium text-text-primary">{normalizeText(item.user_email || item.user_id)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-text-muted">任务 ID</div>
                          <div className="mt-1 font-medium text-text-primary">{normalizeText(item.task_id)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-text-muted">审核提供方</div>
                          <div className="mt-1 font-medium text-text-primary">{formatProvider(item.provider)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-text-muted">任务状态</div>
                          <div className="mt-1 font-medium text-text-primary">{normalizeText(item.task_status)}</div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-background/40 p-4">
                        <div className="text-xs uppercase tracking-wide text-text-muted">审核原因</div>
                        <div className="mt-2 break-all text-sm leading-6 text-text-secondary">{normalizeText(item.reason)}</div>
                      </div>

                      {imageUrl ? (
                        <div className="truncate text-xs text-text-muted" title={imageUrl}>
                          图片地址：{imageUrl}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
            </div>
            {visibleImageCount < items.length ? (
              <div
                ref={loadMoreRef}
                className="mt-5 flex items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-4 text-xs text-text-muted"
              >
                继续下滑，自动加载更多图片...
              </div>
            ) : null}
          </div>
        ) : (
          <div className="px-6 py-16 text-center text-sm text-text-muted">暂时没有图片审核记录</div>
        )}
      </div>
    </section>
  );
}
