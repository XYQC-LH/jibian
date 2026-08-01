import type { SystemConfig } from '@/types';
import type { AdminModel, MonitorTrendPoint } from './types';
import type { AIModel } from '@/components/resource/types';

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  max_concurrent_tasks: 10,
  task_timeout: 300,
  cleanup_interval: 3600,
  redis_memory_limit: '256mb',
  database_connections: 20,
  file_storage_limit: '1gb',
};

export const MONITOR_HISTORY_1D_HOURS = 24;
export const MONITOR_HISTORY_1D_INTERVAL_MINUTES = 1;
export const MONITOR_HISTORY_7D_HOURS = 24 * 7;
export const MONITOR_HISTORY_7D_INTERVAL_MINUTES = 5;
export const MONITOR_RECENT_WINDOW_SECONDS = 60 * 60;
export const MONITOR_RECENT_STEP_SECONDS = 1;
export const MONITOR_POLL_INTERVAL_MS = 10_000;
// 后端接口限制 page_size <= 100，管理员页按 100 分页拉全量，避免 422。
export const MODELS_PAGE_SIZE = 100;

export type ModelStats = {
  totalModels: number;
  imageModels: number;
  videoModels: number;
  musicModels: number;
};

export const computeModelStats = (models: AIModel[]): ModelStats => {
  const totalModels = models.length;
  const imageModels = models.filter((m) => m.type === 'image').length;
  const videoModels = models.filter((m) => m.type === 'video').length;
  const musicModels = models.filter((m) => m.type === 'music' || m.type === 'audio').length;

  return {
    totalModels,
    imageModels,
    videoModels,
    musicModels,
  };
};

export const createDefaultMonitorTrendPoint = (): MonitorTrendPoint => ({
  cpu_usage: 0,
  memory_usage: 0,
  disk_usage: 0,
  active_connections: 0,
  queue_size: 0,
  database_connections: 0,
  timestamp: new Date().toISOString(),
});

export const resolveStatus = (error: unknown): 'degraded' | 'unavailable' => {
  const err = error as { message?: string; status?: number; code?: string } | null;
  if (err?.message?.includes('503') || err?.status === 503) {
    return 'unavailable';
  }
  if (err?.message?.includes('Network Error') || err?.code === 'NETWORK_ERROR') {
    return 'unavailable';
  }
  return 'degraded';
};

export const mergeHealthStatus = (
  current: 'healthy' | 'degraded' | 'unavailable',
  next: 'healthy' | 'degraded' | 'unavailable'
): 'healthy' | 'degraded' | 'unavailable' => {
  if (current === 'unavailable' || next === 'unavailable') {
    return 'unavailable';
  }
  if (current === 'degraded' || next === 'degraded') {
    return 'degraded';
  }
  return 'healthy';
};

export const normalizeOrder = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const normalized = Math.trunc(parsed);
  return normalized >= 0 ? normalized : 0;
};

export const toPositiveInt = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
};

export const sortModelsByOrder = (items: AIModel[]): AIModel[] => {
  return [...items].sort((a, b) => {
    const orderA = normalizeOrder(a.order ?? 0);
    const orderB = normalizeOrder(b.order ?? 0);
    if (orderA !== orderB) return orderA - orderB;
    return String(a.name || a.id || '').localeCompare(String(b.name || b.id || ''), 'zh-CN');
  });
};
