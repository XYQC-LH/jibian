import type { MonitorRange, MonitorTrendPoint } from './types';

const MONITOR_RANGE_WINDOW_SECONDS: Record<MonitorRange, number> = {
  '1h': 60 * 60,
  '1d': 60 * 60 * 24,
  '7d': 60 * 60 * 24 * 7,
};

const MONITOR_RANGE_BUCKET_SECONDS: Record<MonitorRange, number> = {
  '1h': 1,
  '1d': 60,
  '7d': 300,
};

export type MonitorTrendCache = {
  byRange: Record<MonitorRange, MonitorTrendPoint[]>;
};

const toFiniteNumber = (value: unknown, defaultValue = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const clampPercent = (value: unknown): number => {
  const parsed = toFiniteNumber(value, 0);
  if (parsed < 0) return 0;
  if (parsed > 100) return 100;
  return parsed;
};

const parseTimestampMs = (timestamp: unknown): number | null => {
  const value = typeof timestamp === 'string' ? timestamp : '';
  if (!value.trim()) {
    return null;
  }
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) {
    return null;
  }
  return ms;
};

const toIsoTimestamp = (timestamp: unknown): string => {
  const ms = parseTimestampMs(timestamp);
  if (ms === null) {
    return new Date().toISOString();
  }
  return new Date(ms).toISOString();
};

const toBucketTimestamp = (timestamp: string, bucketSeconds: number): string => {
  const bucket = Math.max(1, Number(bucketSeconds) || 1);
  if (bucket <= 1) {
    return toIsoTimestamp(timestamp);
  }
  const ms = parseTimestampMs(timestamp);
  if (ms === null) {
    return new Date().toISOString();
  }
  const bucketMs = bucket * 1000;
  const normalized = Math.floor(ms / bucketMs) * bucketMs;
  return new Date(normalized).toISOString();
};

export const toMonitorTrendPointFromSnapshot = (snapshot: Record<string, unknown>): MonitorTrendPoint => {
  const cpu = snapshot.cpu as Record<string, unknown> | undefined;
  const memory = snapshot.memory as Record<string, unknown> | undefined;
  const disk = snapshot.disk as Record<string, unknown> | undefined;
  const network = snapshot.network as Record<string, unknown> | undefined;
  const system = snapshot.system as Record<string, unknown> | undefined;
  return {
    cpu_usage: clampPercent(cpu?.usage_percent),
    memory_usage: clampPercent(memory?.usage_percent),
    disk_usage: clampPercent(disk?.usage_percent),
    active_connections: toFiniteNumber(network?.active_connections, 0),
    queue_size: 0,
    database_connections: toFiniteNumber(system?.db_connections, 0),
    timestamp: toIsoTimestamp(snapshot?.timestamp),
  };
};

export const toMonitorTrendPointFromHistory = (point: Record<string, unknown>): MonitorTrendPoint => ({
  cpu_usage: clampPercent(point?.cpu_usage),
  memory_usage: clampPercent(point?.memory_usage),
  disk_usage: clampPercent(point?.disk_usage),
  active_connections: toFiniteNumber(point?.active_connections, 0),
  queue_size: toFiniteNumber(point?.queue_size, 0),
  database_connections: toFiniteNumber(point?.database_connections, 0),
  timestamp: toIsoTimestamp(point?.timestamp),
});

const mergeAndNormalizePoints = (
  current: MonitorTrendPoint[],
  incoming: MonitorTrendPoint[],
  options?: {
    bucketSeconds?: number;
    windowSeconds?: number;
    maxPoints?: number;
  }
): MonitorTrendPoint[] => {
  const bucketSeconds = Math.max(1, Number(options?.bucketSeconds) || 1);
  const map = new Map<string, MonitorTrendPoint>();

  current.forEach((point) => {
    const timestamp = toBucketTimestamp(point.timestamp, bucketSeconds);
    map.set(timestamp, { ...point, timestamp });
  });
  incoming.forEach((point) => {
    const timestamp = toBucketTimestamp(point.timestamp, bucketSeconds);
    map.set(timestamp, { ...point, timestamp });
  });

  const sorted = Array.from(map.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const latestMs = sorted.length > 0 ? new Date(sorted[sorted.length - 1].timestamp).getTime() : 0;
  const windowSeconds = Math.max(0, Number(options?.windowSeconds) || 0);
  let next = sorted;
  if (latestMs > 0 && windowSeconds > 0) {
    const cutoff = latestMs - windowSeconds * 1000;
    next = next.filter((point) => new Date(point.timestamp).getTime() >= cutoff);
  }

  const maxPoints = Math.max(0, Number(options?.maxPoints) || 0);
  if (maxPoints > 0 && next.length > maxPoints) {
    next = next.slice(-maxPoints);
  }

  return next;
};

const mergeMonitorTrendPoints = (
  current: MonitorTrendPoint[],
  incoming: MonitorTrendPoint | MonitorTrendPoint[],
  options?: {
    bucketSeconds?: number;
    windowSeconds?: number;
    maxPoints?: number;
  }
): MonitorTrendPoint[] => {
  const nextIncoming = Array.isArray(incoming) ? incoming : [incoming];
  return mergeAndNormalizePoints(current, nextIncoming, options);
};

export const createMonitorTrendCache = (): MonitorTrendCache => ({
  byRange: {
    '1h': [],
    '1d': [],
    '7d': [],
  },
});

export const mergeRealtimePointIntoRangeCache = (
  cache: MonitorTrendCache,
  realtimePoint: MonitorTrendPoint
): MonitorTrendCache => {
  const next: MonitorTrendCache = {
    byRange: { ...cache.byRange },
  };

  next.byRange['1h'] = mergeMonitorTrendPoints(cache.byRange['1h'], realtimePoint, {
    bucketSeconds: MONITOR_RANGE_BUCKET_SECONDS['1h'],
    windowSeconds: MONITOR_RANGE_WINDOW_SECONDS['1h'],
    maxPoints: MONITOR_RANGE_WINDOW_SECONDS['1h'],
  });
  next.byRange['1d'] = mergeMonitorTrendPoints(cache.byRange['1d'], realtimePoint, {
    bucketSeconds: MONITOR_RANGE_BUCKET_SECONDS['1d'],
    windowSeconds: MONITOR_RANGE_WINDOW_SECONDS['1d'],
  });
  next.byRange['7d'] = mergeMonitorTrendPoints(cache.byRange['7d'], realtimePoint, {
    bucketSeconds: MONITOR_RANGE_BUCKET_SECONDS['7d'],
    windowSeconds: MONITOR_RANGE_WINDOW_SECONDS['7d'],
  });
  return next;
};

export const hydrateRangeCache = (
  cache: MonitorTrendCache,
  payload: Partial<Record<MonitorRange, MonitorTrendPoint[]>>
): MonitorTrendCache => {
  const next: MonitorTrendCache = {
    byRange: {
      '1h': cache.byRange['1h'],
      '1d': cache.byRange['1d'],
      '7d': cache.byRange['7d'],
    },
  };

  (['1h', '1d', '7d'] as MonitorRange[]).forEach((range) => {
    const list = payload[range];
    if (!Array.isArray(list)) {
      return;
    }
    next.byRange[range] = mergeMonitorTrendPoints([], list, {
      bucketSeconds: MONITOR_RANGE_BUCKET_SECONDS[range],
      windowSeconds: MONITOR_RANGE_WINDOW_SECONDS[range],
      maxPoints: range === '1h' ? MONITOR_RANGE_WINDOW_SECONDS['1h'] : 0,
    });
  });

  return next;
};

export const getPointsForRange = (cache: MonitorTrendCache, range: MonitorRange): MonitorTrendPoint[] => {
  return cache.byRange[range] || [];
};

export const resolveMonitorSequence = (
  lastSequence: number,
  nextSequence: unknown
): { accepted: boolean; next: number } => {
  const parsed = Number(nextSequence);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { accepted: true, next: lastSequence };
  }
  if (parsed <= lastSequence) {
    return { accepted: false, next: lastSequence };
  }
  return { accepted: true, next: parsed };
};
