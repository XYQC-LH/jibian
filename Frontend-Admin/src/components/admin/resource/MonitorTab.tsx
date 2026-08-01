'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MonitorSkeleton } from '@/components/ui/Skeleton';
import { Activity, Cpu, Database, Server, Shield, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import ResourceMetricCard from './ResourceMetricCard';
import type { MonitorTrendPoint, SystemMonitoringData } from './types';
import { getErrorMessage, getErrorStatus, getErrorCode } from '@/lib/http/errors';
import { formatChinaDateTime } from '@/utils/format';

import type { MonitorTabProps, TrendDatum, ZoomDomain } from './MonitorTabTypes';
import {
  formatChartTime,
  formatChartDateTime,
  formatPercentText,
  formatMemoryText,
  resolveStatusBadgeClass,
  resolveContainerUnavailableText,
  chartTooltipStyle,
  WORKER_SERVICES,
} from './MonitorTabFormatters';
import { MonitorRangeSwitch, MetricTrendCard, ResourceTrendSection } from './MonitorTabComponents';

const EMPTY_CONTAINER_ITEMS: never[] = [];

const MonitorTab: React.FC<MonitorTabProps> = ({
  systemMonitoringData,
  trendPoints,
  monitorLoaded,
  monitorRange,
  onMonitorRangeChange,
  onUpdateContainerServiceResources,
}) => {
  const hasTrendData = trendPoints.length > 1;
  const containerMetrics = systemMonitoringData?.containers;
  const containerItems = useMemo(
    () => (Array.isArray(containerMetrics?.items) ? containerMetrics.items : EMPTY_CONTAINER_ITEMS),
    [containerMetrics?.items],
  );
  const serviceSettings = useMemo(
    () =>
      containerMetrics?.service_settings && typeof containerMetrics.service_settings === 'object'
        ? containerMetrics.service_settings
        : {},
    [containerMetrics?.service_settings],
  );
  const containerUnavailableText = resolveContainerUnavailableText(
    containerMetrics?.available,
    containerMetrics?.error
  );
  const [serviceMemoryLimitDrafts, setServiceMemoryLimitDrafts] = useState<Record<string, string>>({});
  const [serviceWorkerConcurrencyDrafts, setServiceWorkerConcurrencyDrafts] = useState<Record<string, string>>({});
  const [savingService, setSavingService] = useState<string | null>(null);

  useEffect(() => {
    setServiceMemoryLimitDrafts((prev) => {
      let changed = false;
      const next: Record<string, string> = { ...prev };
      for (const item of containerItems) {
        const service = String(item.service || '').trim();
        if (!service || next[service] !== undefined) {
          continue;
        }
        const normalizedService = service.toLowerCase();
        const serviceCfg = (serviceSettings as Record<string, unknown> | undefined)?.[normalizedService] as Record<string, unknown> | undefined;
        const configuredMemoryLimitMb = Number(
          item.configured_memory_limit_mb ?? serviceCfg?.memory_limit_mb as number | undefined
        );
        const reportedMemoryLimitMb = Number(item.memory_limit_mb);
        const memoryLimitMb = Number.isFinite(configuredMemoryLimitMb) && configuredMemoryLimitMb > 0
          ? configuredMemoryLimitMb
          : reportedMemoryLimitMb;
        next[service] = Number.isFinite(memoryLimitMb) && memoryLimitMb > 0
          ? String(Math.round(memoryLimitMb))
          : '';
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [containerItems, serviceSettings]);

  useEffect(() => {
    setServiceWorkerConcurrencyDrafts((prev) => {
      let changed = false;
      const next: Record<string, string> = { ...prev };
      for (const item of containerItems) {
        const service = String(item.service || '').trim();
        if (!service || next[service] !== undefined) {
          continue;
        }
        const normalizedService = service.toLowerCase();
        const workerEnabled = Boolean(item.worker_service) || WORKER_SERVICES.has(normalizedService);
        if (!workerEnabled) {
          next[service] = '';
          changed = true;
          continue;
        }
        const serviceCfg = (serviceSettings as Record<string, unknown> | undefined)?.[normalizedService] as Record<string, unknown> | undefined;
        const configuredConcurrency = Number(
          item.configured_worker_concurrency ?? serviceCfg?.worker_concurrency as number | undefined
        );
        next[service] = Number.isFinite(configuredConcurrency) && configuredConcurrency > 0
          ? String(Math.round(configuredConcurrency))
          : '';
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [containerItems, serviceSettings]);

  const handleApplyServiceResources = async (service: string, workerService: boolean) => {
    const normalizedService = String(service || '').trim();
    if (!normalizedService) {
      toast.error('服务名无效，无法更新容器资源配置');
      return;
    }

    const memoryDraftValue = String(serviceMemoryLimitDrafts[normalizedService] || '').trim();
    const parsedMemoryLimitMb = Math.round(Number(memoryDraftValue));
    if (!Number.isFinite(parsedMemoryLimitMb) || parsedMemoryLimitMb <= 0) {
      toast.error('请输入大于 0 的内存上限（MB）');
      return;
    }

    let parsedWorkerConcurrency: number | null = null;
    if (workerService) {
      const concurrencyDraftValue = String(serviceWorkerConcurrencyDrafts[normalizedService] || '').trim();
      parsedWorkerConcurrency = Math.round(Number(concurrencyDraftValue));
      if (!Number.isFinite(parsedWorkerConcurrency) || parsedWorkerConcurrency <= 0) {
        toast.error('请输入大于 0 的 Worker 并发数');
        return;
      }
    }

    try {
      setSavingService(normalizedService);
      await onUpdateContainerServiceResources(normalizedService, parsedMemoryLimitMb, parsedWorkerConcurrency);
      if (workerService && parsedWorkerConcurrency !== null) {
        toast.success(`服务 ${normalizedService} 已更新：内存 ${parsedMemoryLimitMb} MB，并发 ${parsedWorkerConcurrency}`);
      } else {
        toast.success(`服务 ${normalizedService} 内存上限已更新为 ${parsedMemoryLimitMb} MB`);
      }
    } catch (error: unknown) {
      const errMsg = getErrorMessage(error, '更新容器资源配置失败');
      toast.error(errMsg);
    } finally {
      setSavingService((current) => (current === normalizedService ? null : current));
    }
  };

  const connectionTrendData = useMemo<TrendDatum[]>(() => {
    return trendPoints
      .map((point) => {
        const timestampMs = new Date(point.timestamp).getTime();
        if (!Number.isFinite(timestampMs)) {
          return null;
        }
        return {
          ...point,
          timestampMs,
        };
      })
      .filter((point): point is TrendDatum => Boolean(point))
      .sort((a, b) => a.timestampMs - b.timestampMs);
  }, [trendPoints]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-text-primary">系统资源监控</h3>
        {systemMonitoringData && (
          <div className="text-sm text-text-muted">
            最后更新: {formatChinaDateTime(systemMonitoringData.timestamp)}
          </div>
        )}
      </div>

      {systemMonitoringData ? (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ResourceMetricCard
              title="CPU 使用率"
              value={`${systemMonitoringData.cpu.usage_percent.toFixed(2)}%`}
              icon={Cpu}
              color="blue"
            />
            <ResourceMetricCard
              title="内存使用率"
              value={`${systemMonitoringData.memory.usage_percent.toFixed(2)}%`}
              icon={Database}
              color="green"
            />
            <ResourceMetricCard
              title="磁盘使用率"
              value={`${systemMonitoringData.disk.usage_percent.toFixed(2)}%`}
              icon={Server}
              color="orange"
            />
            <ResourceMetricCard
              title="活跃连接"
              value={systemMonitoringData.network.active_connections}
              icon={Users}
              color="purple"
            />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card-primary p-6">
              <h4 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-blue-400" />
                CPU 信息
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">使用率</span>
                  <span className="text-sm font-medium text-text-primary">
                    {systemMonitoringData.cpu.usage_percent.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">核心数</span>
                  <span className="text-sm font-medium text-text-primary">
                    {systemMonitoringData.cpu.count}
                  </span>
                </div>
                {systemMonitoringData.cpu.frequency_mhz && (
                  <div className="flex justify-between">
                    <span className="text-sm text-text-muted">频率</span>
                    <span className="text-sm font-medium text-text-primary">
                      {systemMonitoringData.cpu.frequency_mhz.toFixed(0)} MHz
                    </span>
                  </div>
                )}
                {systemMonitoringData.cpu.load_average && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-text-muted">1分钟负载</span>
                      <span className="text-sm font-medium text-text-primary">
                        {systemMonitoringData.cpu.load_average['1min'].toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-text-muted">5分钟负载</span>
                      <span className="text-sm font-medium text-text-primary">
                        {systemMonitoringData.cpu.load_average['5min'].toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="card-primary p-6">
              <h4 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Database className="w-5 h-5 text-green-400" />
                内存信息
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">总计</span>
                  <span className="text-sm font-medium text-text-primary">
                    {systemMonitoringData.memory.total_gb.toFixed(1)} GB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">已使用</span>
                  <span className="text-sm font-medium text-text-primary">
                    {systemMonitoringData.memory.used_gb.toFixed(1)} GB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">可用</span>
                  <span className="text-sm font-medium text-text-primary">
                    {systemMonitoringData.memory.available_gb.toFixed(1)} GB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">使用率</span>
                  <span className="text-sm font-medium text-text-primary">
                    {systemMonitoringData.memory.usage_percent.toFixed(2)}%
                  </span>
                </div>
                {systemMonitoringData.memory.buffers_gb && (
                  <div className="flex justify-between">
                    <span className="text-sm text-text-muted">缓存</span>
                    <span className="text-sm font-medium text-text-primary">
                      {(
                        systemMonitoringData.memory.buffers_gb +
                        (systemMonitoringData.memory.cached_gb || 0)
                      ).toFixed(1)}{' '}
                      GB
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="card-primary p-6">
              <h4 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Server className="w-5 h-5 text-orange-400" />
                磁盘信息
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">总计</span>
                  <span className="text-sm font-medium text-text-primary">
                    {systemMonitoringData.disk.total_gb.toFixed(1)} GB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">已使用</span>
                  <span className="text-sm font-medium text-text-primary">
                    {systemMonitoringData.disk.used_gb.toFixed(1)} GB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">可用</span>
                  <span className="text-sm font-medium text-text-primary">
                    {systemMonitoringData.disk.free_gb.toFixed(1)} GB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">使用率</span>
                  <span className="text-sm font-medium text-text-primary">
                    {systemMonitoringData.disk.usage_percent.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card-primary p-6">
              <h4 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-400" />
                网络信息
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">活跃连接</span>
                  <span className="text-sm font-medium text-text-primary">
                    {systemMonitoringData.network.active_connections}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">总连接数</span>
                  <span className="text-sm font-medium text-text-primary">
                    {systemMonitoringData.network.total_connections}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">已发送</span>
                  <span className="text-sm font-medium text-text-primary">
                    {systemMonitoringData.network.bytes_sent_mb.toFixed(1)} MB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">已接收</span>
                  <span className="text-sm font-medium text-text-primary">
                    {systemMonitoringData.network.bytes_recv_mb.toFixed(1)} MB
                  </span>
                </div>
              </div>
            </div>

            <div className="card-primary p-6">
              <h4 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-accent" />
                系统信息
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">运行时间</span>
                  <span className="text-sm font-medium text-text-primary">
                    {systemMonitoringData.system.uptime_hours.toFixed(1)} 小时
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">进程总数</span>
                  <span className="text-sm font-medium text-text-primary">
                    {systemMonitoringData.processes.total_count}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">数据库连接</span>
                  <span className="text-sm font-medium text-text-primary">
                    {systemMonitoringData.system.db_connections}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">当前进程内存</span>
                  <span className="text-sm font-medium text-text-primary">
                    {systemMonitoringData.processes.current_process_memory_mb.toFixed(1)} MB
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="card-primary p-6">
            <h4 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-orange-400" />
              容器服务监控
            </h4>
            {containerMetrics?.sampled_at && (
              <div className="text-xs text-text-muted mb-3">
                采样时间: {formatChinaDateTime(containerMetrics.sampled_at)}
                {containerMetrics.stale ? '（缓存已过期）' : ''}
              </div>
            )}
            {containerItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="text-left text-text-muted border-b border-white/10">
                      <th className="py-2 pr-4 font-medium">服务</th>
                      <th className="py-2 pr-4 font-medium">容器</th>
                      <th className="py-2 pr-4 font-medium">状态</th>
                      <th className="py-2 pr-4 font-medium">CPU</th>
                      <th className="py-2 pr-4 font-medium">内存</th>
                      <th className="py-2 pr-4 font-medium">内存上限(MB)</th>
                      <th className="py-2 pr-4 font-medium">Worker并发</th>
                      <th className="py-2 font-medium">PIDs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {containerItems.map((item) => {
                      const memoryPercent = Number(item.memory_percent);
                      const safeMemoryPercent = Number.isFinite(memoryPercent)
                        ? Math.max(0, Math.min(100, memoryPercent))
                        : 0;
                      const normalizedService = String(item.service || '').trim().toLowerCase();
                      const workerService = Boolean(item.worker_service) || WORKER_SERVICES.has(normalizedService);

                      return (
                        <tr
                          key={`${item.service}-${item.container_name}`}
                          className="border-b border-white/5 text-text-primary"
                        >
                          <td className="py-3 pr-4 align-top font-medium">{item.service}</td>
                          <td className="py-3 pr-4 align-top text-text-muted">{item.container_name}</td>
                          <td className="py-3 pr-4 align-top">
                            <span className={`px-2 py-1 rounded text-xs ${resolveStatusBadgeClass(item.status)}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3 pr-4 align-top">{formatPercentText(item.cpu_percent)}</td>
                          <td className="py-3 pr-4 align-top">
                            <div className="flex flex-col gap-1">
                              <span>{formatMemoryText(item.memory_used_mb, item.memory_limit_mb)}</span>
                              <div className="h-1.5 rounded bg-white/10 overflow-hidden">
                                <div
                                  className="h-full bg-green-400/80"
                                  style={{ width: `${safeMemoryPercent}%` }}
                                />
                              </div>
                              <span className="text-xs text-text-muted">{formatPercentText(item.memory_percent)}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 align-top">
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={serviceMemoryLimitDrafts[item.service] ?? ''}
                              onChange={(event) =>
                                setServiceMemoryLimitDrafts((prev) => ({
                                  ...prev,
                                  [item.service]: event.target.value,
                                }))
                              }
                              className="input-primary w-28 px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="py-3 pr-4 align-top">
                            <div className="flex items-center gap-2">
                              {workerService ? (
                                <input
                                  type="number"
                                  min={1}
                                  step={1}
                                  value={serviceWorkerConcurrencyDrafts[item.service] ?? ''}
                                  onChange={(event) =>
                                    setServiceWorkerConcurrencyDrafts((prev) => ({
                                      ...prev,
                                      [item.service]: event.target.value,
                                    }))
                                  }
                                  className="input-primary w-24 px-2 py-1 text-xs"
                                />
                              ) : (
                                <span className="text-xs text-text-muted">--</span>
                              )}
                              <button
                                type="button"
                                onClick={() => void handleApplyServiceResources(item.service, workerService)}
                                disabled={savingService === item.service}
                                className="btn-primary px-2 py-1 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {savingService === item.service ? '更新中...' : '应用'}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 align-top">{item.pids ?? '--'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-text-muted">
                {containerUnavailableText}
              </div>
            )}
          </div>

          <ResourceTrendSection
            trendPoints={trendPoints}
            monitorRange={monitorRange}
            onMonitorRangeChange={onMonitorRangeChange}
          />

          <div className="card-primary p-6">
            <h4 className="text-lg font-semibold text-text-primary mb-6">活跃连接数趋势</h4>
            {hasTrendData ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={connectionTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="timestampMs"
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    stroke="#9ca3af"
                    minTickGap={24}
                    tickFormatter={formatChartTime}
                  />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    labelFormatter={(label) => formatChartDateTime(Number(label))}
                    cursor={{ stroke: '#9ca3af', strokeDasharray: '3 3' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="active_connections"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    name="活跃连接数"
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-sm text-text-muted">
                趋势数据接入中，页面将持续增量刷新
              </div>
            )}
          </div>
        </>
      ) : (
        <MonitorSkeleton />
      )}
    </div>
  );
};

export default MonitorTab;
