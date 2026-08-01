'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Image,
  Layers,
  Save,
  Server,
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';

import apiClient from '@/lib/api';
import StatCard from '@/components/admin/resource/StatCard';
import type {
  DispatchRouteRuntime,
  DispatchSourceStatsItem,
  DispatchSourceStatsResponse,
  SourceRuntimeProfile,
} from '@/lib/api-clients/types';
import { getErrorMessage, getErrorStatus, getErrorCode } from '@/lib/http/errors';

const formatPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${value.toFixed(2)}%`;
};

type DispatchRow = {
  route: DispatchRouteRuntime;
  model_id: string;
  source_id: string;
  vendor: string;
  display_name: string;
  runtime_profile?: SourceRuntimeProfile;
  stats24h?: DispatchSourceStatsItem;
  statsAllTime?: DispatchSourceStatsItem;
};

type ModelGroup = {
  model_id: string;
  rows: DispatchRow[];
  sources_count: number;
  attempts_total: number;
  attempts_success: number;
  attempts_failure: number;
  success_rate: number;
};

const LARGE_PRICE = 1e18;

const makeStatsKey = (modelId: string, sourceId: string) => `${modelId}::${sourceId}`;

const formatCny = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return `¥${Number(value).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}`;
};

const resolveSortCostCny = (row: DispatchRow): number => {
  const specCost = Number(row.route.expected_cost || 0);
  if (Number.isFinite(specCost) && specCost > 0) return specCost;
  return LARGE_PRICE;
};

const renderPricingDisplay = (route: DispatchRouteRuntime): string => {
  if (route.pricing_display_mode === 'single') {
    return formatCny(route.pricing_display_value_cny);
  }
  if (route.pricing_display_mode === 'range') {
    const minText = formatCny(route.pricing_display_min_cny);
    const maxText = formatCny(route.pricing_display_max_cny);
    if (minText !== '-' && maxText !== '-') {
      return `${minText} ~ ${maxText}`;
    }
  }
  return '-';
};

const ModelDispatchTab: React.FC = () => {
  const [routes, setRoutes] = useState<DispatchRouteRuntime[]>([]);
  const [profiles, setProfiles] = useState<SourceRuntimeProfile[]>([]);
  const [stats, setStats] = useState<DispatchSourceStatsResponse | null>(null);
  const [allTimeStats, setAllTimeStats] = useState<DispatchSourceStatsResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [modelTypeMap, setModelTypeMap] = useState<Map<string, string>>(new Map());

  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState<'image'>('image');
  const [togglingSources, setTogglingSources] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [routeItems, runtimeProfiles, statsPayload, allTimeStatsPayload, modelsPayload] = await Promise.all([
        apiClient.dispatch.listDispatchRoutes(),
        apiClient.dispatch.listSourceRuntimeProfiles(),
        apiClient.dispatch.getDispatchSourceStats(24),
        apiClient.dispatch.getDispatchSourceStats(0),
        apiClient.model.getAllModels({ pageSize: 200, skipPricing: true }).catch(() => null),
      ]);

      setRoutes(routeItems || []);
      setProfiles(runtimeProfiles || []);
      setStats(statsPayload || null);
      setAllTimeStats(allTimeStatsPayload || null);

      const typeMap = new Map<string, string>();
      const modelItems = modelsPayload?.items || [];
      for (const m of modelItems) {
        const mid = String(m.id || '').trim();
        if (!mid) continue;
        const t = String(m.type || '').trim().toLowerCase();
        if (t === 'video') typeMap.set(mid, 'video');
        else if (t === 'music' || t === 'audio') typeMap.set(mid, 'music');
        else typeMap.set(mid, 'image');
      }
      setModelTypeMap(typeMap);
    } catch (error: unknown) {
      console.error('Failed to load model dispatch data:', error);
      toast.error(getErrorMessage(error, '加载模型调度数据失败'));
      setRoutes([]);
      setProfiles([]);
      setStats(null);
      setAllTimeStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const profileMap = useMemo(() => {
    const map = new Map<string, SourceRuntimeProfile>();
    profiles.forEach((item) => map.set(String(item.source_id || '').trim(), item));
    return map;
  }, [profiles]);

  const statsMap = useMemo(() => {
    const map = new Map<string, DispatchSourceStatsItem>();
    (stats?.items || []).forEach((item) => {
      const modelId = String(item.model_id || '').trim();
      const sourceId = String(item.source_id || '').trim();
      if (!modelId || !sourceId) return;
      map.set(makeStatsKey(modelId, sourceId), item);
    });
    return map;
  }, [stats]);

  const allTimeStatsMap = useMemo(() => {
    const map = new Map<string, DispatchSourceStatsItem>();
    (allTimeStats?.items || []).forEach((item) => {
      const modelId = String(item.model_id || '').trim();
      const sourceId = String(item.source_id || '').trim();
      if (!modelId || !sourceId) return;
      map.set(makeStatsKey(modelId, sourceId), item);
    });
    return map;
  }, [allTimeStats]);

  const allRows = useMemo<DispatchRow[]>(() => {
    return routes.map((route) => {
      const sourceId = String(route.source_id || '').trim();
      const vendor = String(route.vendor || '').trim();
      const displayName = String(route.display_name || vendor || sourceId || '').trim();
      const modelId = String(route.model_id || '').trim();
      const statsKey = modelId && sourceId ? makeStatsKey(modelId, sourceId) : '';
      return {
        route,
        model_id: modelId,
        source_id: sourceId,
        vendor,
        display_name: displayName,
        runtime_profile: sourceId ? profileMap.get(sourceId) : undefined,
        stats24h: statsKey ? statsMap.get(statsKey) : undefined,
        statsAllTime: statsKey ? allTimeStatsMap.get(statsKey) : undefined,
      };
    });
  }, [routes, profileMap, statsMap, allTimeStatsMap]);

  const summary = useMemo(() => {
    const modelCount = new Set(allRows.map((x) => String(x.model_id || '').trim()).filter(Boolean)).size;
    const sourceCount = new Set(allRows.map((x) => String(x.source_id || '').trim()).filter(Boolean)).size;
    const enabledCount = allRows.filter((x) => Boolean(x.route.is_enabled)).length;
    const openCircuits = allRows.filter((x) => x.route.runtime?.circuit_state === 'open').length;

    const total24h = Number(stats?.total || 0);
    const success24h = Number(
      (stats?.items || []).reduce((acc, item) => acc + Number(item.success || 0), 0)
    );
    const successRate24h = total24h ? (success24h / total24h) * 100 : 0;

    const totalAllTime = Number(allTimeStats?.total || 0);

    return {
      modelCount,
      sourceCount,
      enabledCount,
      openCircuits,
      total24h,
      successRate24h,
      totalAllTime,
    };
  }, [allRows, stats, allTimeStats]);

  const groups = useMemo<ModelGroup[]>(() => {
    const keyword = search.trim().toLowerCase();

    const filteredRows = allRows.filter((row) => {

      if (!keyword) return true;
      const hay = [
        row.model_id,
        row.vendor,
        row.display_name,
        row.source_id,
        row.route.upstream_model_name || '',
        row.runtime_profile?.module_path || '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(keyword);
    });

    const byModel = new Map<string, DispatchRow[]>();
    for (const row of filteredRows) {
      const key = row.model_id || '-';
      if (!byModel.has(key)) byModel.set(key, []);
      byModel.get(key)!.push(row);
    }

    const result: ModelGroup[] = [];
    byModel.forEach((modelRows, modelId) => {
      const sortedRows = [...modelRows].sort((a, b) => {
        const pa = resolveSortCostCny(a);
        const pb = resolveSortCostCny(b);
        if (pa !== pb) return pa < pb ? -1 : 1;

        const weightDiff = Number(b.route.weight || 0) - Number(a.route.weight || 0);
        if (weightDiff !== 0) return weightDiff;

        return String(a.source_id).localeCompare(String(b.source_id));
      });

      const attempts_total = sortedRows.reduce((acc, row) => acc + Number(row.stats24h?.total || 0), 0);
      const attempts_success = sortedRows.reduce((acc, row) => acc + Number(row.stats24h?.success || 0), 0);
      const attempts_failure = sortedRows.reduce((acc, row) => acc + Number(row.stats24h?.failure || 0), 0);
      const success_rate = attempts_total ? (attempts_success / attempts_total) * 100 : 0;

      result.push({
        model_id: modelId,
        rows: sortedRows,
        sources_count: new Set(sortedRows.map((row) => String(row.source_id || '').trim()).filter(Boolean)).size,
        attempts_total,
        attempts_success,
        attempts_failure,
        success_rate,
      });
    });

    result.sort((a, b) => {
      const diff = (b.attempts_total || 0) - (a.attempts_total || 0);
      if (diff !== 0) return diff;
      return String(a.model_id).localeCompare(String(b.model_id));
    });
    return result;
  }, [allRows, search]);

  const inferModelType = useCallback(
    (modelId: string, operation?: string): string => {
      const t = modelTypeMap.get(modelId);
      if (t === 'video' || t === 'music') return t;

      const op = (operation || '').toLowerCase();
      if (op.startsWith('video') || op.startsWith('audio_video')) return 'video';
      if (op.startsWith('music') || op.startsWith('audio')) return 'music';
      if (op.startsWith('image') || op.startsWith('text_to_image') || op.startsWith('txt2img') || op.startsWith('img2img')) return 'image';

      return 'image';
    },
    [modelTypeMap]
  );

  type TypedSection = {
    id: string;
    title: string;
    description: string;
    icon: React.ComponentType<{ size?: string | number; className?: string }>;
    groups: ModelGroup[];
  };

  const typedSections = useMemo<TypedSection[]>(() => {
    const defs: Omit<TypedSection, 'groups'>[] = [
      { id: 'image', title: '图片模型', description: '图片生成、图片编辑相关', icon: Image },
    ];

    const sections: TypedSection[] = defs.map((d) => ({ ...d, groups: [] }));
    for (const group of groups) {
      const firstOp = group.rows[0]?.route?.operation;
      const type = inferModelType(group.model_id, firstOp);
      const sec = sections.find((s) => s.id === type);
      if (sec) sec.groups.push(group);
    }

    return sections.filter((s) => s.groups.length > 0);
  }, [groups, inferModelType]);

  const handleToggleEnabled = async (sourceId: string, currentEnabled: boolean) => {
    setTogglingSources((prev) => new Set(prev).add(sourceId));
    try {
      const nextEnabled = !currentEnabled;
      await apiClient.dispatch.patchSourceRuntimeProfile(sourceId, { is_enabled: nextEnabled });
      toast.success(nextEnabled ? '源头已启用' : '源头已停用');
      await loadData();
    } catch (error: unknown) {
      console.error('toggle runtime profile error:', error);
      toast.error(getErrorMessage(error, '切换失败'));
    } finally {
      setTogglingSources((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="模型数" value={summary.modelCount} icon={Layers} color="purple" />
        <StatCard title="源头数" value={summary.sourceCount} icon={Server} color="blue" />
        <StatCard title="已启用" value={summary.enabledCount} icon={Save} color="green" />
        <StatCard title="熔断源头" value={summary.openCircuits} icon={AlertTriangle} color="orange" />
        <StatCard title="历史调用" value={summary.totalAllTime.toLocaleString()} icon={BarChart3} color="purple" />
      </section>

      <div className="card-primary p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col sm:flex-row gap-3">
            <input
              className="input-primary w-full sm:max-w-sm"
              placeholder="搜索 model / vendor / source_id / display_name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-text-muted">
            <BarChart3 className="w-4 h-4 text-blue-300" />
            <span>近 24h 调用：{summary.total24h}（成功率 {formatPercent(summary.successRate24h)}）</span>
          </div>
        </div>

        <div className="flex items-center gap-1 border-b border-white/10 pb-1">
          {([
            { id: 'image' as const, label: '图片', icon: Image },
          ]).map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeType === tab.id;
            const count = typedSections.find((s) => s.id === tab.id)?.groups.length ?? 0;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveType(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors rounded-t-md ${
                  isActive
                    ? 'text-white border-b-2 border-blue-400 bg-white/5'
                    : 'text-text-muted hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <TabIcon size={15} />
                <span>{tab.label}</span>
                <span className="text-[11px] text-text-muted ml-0.5">({count})</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-white/5 text-left text-text-muted">
                <tr>
                  <th className="px-3 py-2 w-[220px]">模型</th>
                  <th className="px-3 py-2 w-[420px]">渠道 / 源头</th>
                  <th className="px-3 py-2 w-[220px]">源头成本（¥）</th>
                  <th className="px-3 py-2 w-[220px]">近 24h 调用</th>
                  <th className="px-3 py-2 w-[140px]">历史调用</th>
                  <th className="px-3 py-2 w-[140px]">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={7} className="px-3 py-4">
                    <TableSkeleton rows={4} columns={5} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : typedSections.length === 0 ? (
          <div className="card-primary p-12 text-center">
            <p className="text-text-muted">暂无数据</p>
          </div>
        ) : (
          <div className="space-y-6">
            {typedSections
              .filter((s) => s.id === activeType)
              .map((section) => {
              return (
                <div key={section.id}>
                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="min-w-full text-sm">
                      <thead className="bg-white/5 text-left text-text-muted">
                        <tr>
                          <th className="px-3 py-2 w-[220px]">模型</th>
                          <th className="px-3 py-2 w-[420px]">渠道 / 源头</th>
                          <th className="px-3 py-2 w-[220px]">源头成本（¥）</th>
                          <th className="px-3 py-2 w-[220px]">近 24h 调用</th>
                          <th className="px-3 py-2 w-[140px]">历史调用</th>
                          <th className="px-3 py-2 w-[140px]">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.groups.flatMap((group) =>
                          group.rows.map((row, index) => {
                            const stat = row.stats24h;
                            const statAll = row.statsAllTime;
                            const profile = row.runtime_profile;

                            return (
                              <tr
                                key={`${group.model_id}-${row.source_id}-${row.vendor}-${row.route.id}`}
                                className="border-t border-white/10 align-top hover:bg-white/5"
                              >
                                {index === 0 ? (
                                  <td className="px-3 py-3" rowSpan={group.rows.length}>
                                    <div className="text-sm font-semibold text-text-primary">{group.model_id}</div>
                                    <div className="text-xs text-text-muted mt-1">
                                      源头 {group.sources_count} ｜ 24h {group.attempts_total} ｜ 成功率 {formatPercent(group.success_rate)}
                                    </div>
                                  </td>
                                ) : null}

                                <td className="px-3 py-3">
                          <div className="text-sm font-medium text-text-primary">{row.display_name || row.vendor || '-'}</div>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                          <span>{row.vendor || '-'}</span>
                                  </div>
                                  <div className="text-xs text-text-muted mt-1 font-mono">
                                    {row.source_id || '-'}
                                  </div>
                                </td>

                                <td className="px-3 py-3">
                                  <div className="text-sm font-semibold text-text-primary">
                                    {renderPricingDisplay(row.route)}
                                  </div>
                                </td>

                                <td className="px-3 py-3">
                                  {stat ? (
                                    <div className="space-y-0.5">
                                      <div className="text-sm font-semibold text-text-primary">{stat.total}</div>
                                      <div className="text-xs text-text-muted">成 {stat.success} / 败 {stat.failure}</div>
                                      <div className="text-xs text-text-muted">成功率 {formatPercent(stat.success_rate)}</div>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-text-muted">-</div>
                                  )}
                                </td>

                                <td className="px-3 py-3">
                                  {statAll ? (
                                    <div className="space-y-0.5">
                                      <div className="text-sm font-semibold text-text-primary">{statAll.total.toLocaleString()}</div>
                                      <div className="text-xs text-text-muted">成 {statAll.success.toLocaleString()} / 败 {statAll.failure.toLocaleString()}</div>
                                      <div className="text-xs text-text-muted">成功率 {formatPercent(statAll.success_rate)}</div>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-text-muted">-</div>
                                  )}
                                </td>

                                <td className="px-3 py-3">
                                  <div className="flex flex-col items-start gap-2">
                                    <button
                                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                                        (profile?.is_enabled == null ? Boolean(row.route.is_enabled) : Boolean(profile.is_enabled))
                                          ? 'bg-green-500'
                                          : 'bg-white/20'
                                      } ${togglingSources.has(row.source_id) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                      disabled={togglingSources.has(row.source_id)}
                                      onClick={() => {
                                        const current = profile?.is_enabled == null ? Boolean(row.route.is_enabled) : Boolean(profile.is_enabled);
                                        void handleToggleEnabled(row.source_id, current);
                                      }}
                                      role="switch"
                                      aria-checked={profile?.is_enabled == null ? Boolean(row.route.is_enabled) : Boolean(profile.is_enabled)}
                                    >
                                      <span
                                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                          (profile?.is_enabled == null ? Boolean(row.route.is_enabled) : Boolean(profile.is_enabled))
                                            ? 'translate-x-[18px]'
                                            : 'translate-x-[3px]'
                                        }`}
                                      />
                                    </button>

                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

export default ModelDispatchTab;
