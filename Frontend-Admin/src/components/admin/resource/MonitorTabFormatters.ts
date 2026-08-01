import type React from 'react';
import type { MonitorRange } from './MonitorTabTypes';

export const TREND_SYNC_ID = 'resource-monitor-sync';

export const chartTooltipStyle: React.CSSProperties = {
  backgroundColor: 'rgba(10, 10, 12, 0.95)',
  border: '1px solid rgba(59, 130, 246, 0.35)',
  borderRadius: '8px',
  backdropFilter: 'blur(12px)',
};

export const monitorRangeOptions: Array<{ value: MonitorRange; label: string }> = [
  { value: '1h', label: '1小时' },
  { value: '1d', label: '1天' },
  { value: '7d', label: '7天' },
];

export const WORKER_SERVICES = new Set(['celery-worker']);

export const formatChartTime = (value: number): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--:--:--';
  }
  return date.toLocaleTimeString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' });
};

export const formatChartDateTime = (value: number): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' });
};

export const formatPercentText = (value: number | null | undefined): string => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return '--';
  }
  return `${parsed.toFixed(2)}%`;
};

export const formatMemoryText = (usedMb: number | null | undefined, limitMb: number | null | undefined): string => {
  const used = Number(usedMb);
  if (!Number.isFinite(used)) {
    return '--';
  }
  const usedText = `${used.toFixed(1)} MB`;
  const limit = Number(limitMb);
  if (!Number.isFinite(limit) || limit <= 0) {
    return usedText;
  }
  return `${usedText} / ${limit.toFixed(1)} MB`;
};

export const resolveStatusBadgeClass = (status: string): string => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'running') {
    return 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30';
  }
  if (normalized === 'paused') {
    return 'bg-amber-500/20 text-amber-300 border border-amber-400/30';
  }
  return 'bg-red-500/20 text-red-300 border border-red-400/30';
};

export const resolveContainerUnavailableText = (
  available: boolean | undefined,
  error: string | null | undefined
): string => {
  if (available !== false) {
    return '暂无容器监控数据';
  }

  const normalizedError = String(error || '').trim().toLowerCase();
  if (!normalizedError || normalizedError === 'not_sampled') {
    return '容器监控初始化中，请稍后刷新';
  }
  if (normalizedError === 'docker_socket_not_found') {
    return '容器监控暂不可用: 未检测到 Docker Socket';
  }
  return `容器监控暂不可用: ${error}`;
};
