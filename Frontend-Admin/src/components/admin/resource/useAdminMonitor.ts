'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@/lib/api';
import type { ResourceTab } from '@/lib/resourceSubrouteMap';
import type { MonitorRange, MonitorTrendPoint, SystemMonitoringData } from './types';
import {
  createMonitorTrendCache,
  getPointsForRange,
  hydrateRangeCache,
  mergeRealtimePointIntoRangeCache,
  toMonitorTrendPointFromHistory,
  toMonitorTrendPointFromSnapshot,
} from './monitorDataUtils';
import {
  createDefaultMonitorTrendPoint,
  mergeHealthStatus,
  resolveStatus,
  MONITOR_POLL_INTERVAL_MS,
  MONITOR_HISTORY_1D_HOURS,
  MONITOR_HISTORY_1D_INTERVAL_MINUTES,
  MONITOR_HISTORY_7D_HOURS,
  MONITOR_HISTORY_7D_INTERVAL_MINUTES,
  MONITOR_RECENT_STEP_SECONDS,
  MONITOR_RECENT_WINDOW_SECONDS,
} from './resourceCenterShared';

export function useAdminMonitor(activeTab: ResourceTab) {
  const [systemMonitoringData, setSystemMonitoringData] = useState<SystemMonitoringData | null>(null);
  const [monitorTrendCache, setMonitorTrendCache] = useState(() => createMonitorTrendCache());
  const [monitorRange, setMonitorRange] = useState<MonitorRange>('1h');
  const [monitorStatus, setMonitorStatus] = useState<'healthy' | 'degraded' | 'unavailable'>('healthy');
  const [monitorLoaded, setMonitorLoaded] = useState(false);
  const monitorLastUpdateAtRef = useRef(0);

  const monitorTrendPoints = getPointsForRange(monitorTrendCache, monitorRange);

  // Initial data load
  useEffect(() => {
    if (activeTab !== 'monitor' || monitorLoaded) return;

    let isMounted = true;
    const fetchSystemMonitoring = async () => {
      try {
        const [currentResult, dayHistoryResult, weekHistoryResult, recentResult] = await Promise.allSettled([
          apiClient.system.getSystemMonitoring(),
          apiClient.system.getSystemMonitoringHistory(MONITOR_HISTORY_1D_HOURS, MONITOR_HISTORY_1D_INTERVAL_MINUTES),
          apiClient.system.getSystemMonitoringHistory(MONITOR_HISTORY_7D_HOURS, MONITOR_HISTORY_7D_INTERVAL_MINUTES),
          apiClient.system.getSystemMonitoringRecent(MONITOR_RECENT_WINDOW_SECONDS, MONITOR_RECENT_STEP_SECONDS),
        ]);
        if (!isMounted) return;

        let nextStatus: 'healthy' | 'degraded' | 'unavailable' = 'healthy';
        let currentSnapshot: SystemMonitoringData | null = null;
        const nextCache = createMonitorTrendCache();

        if (currentResult.status === 'fulfilled') {
          currentSnapshot = currentResult.value as unknown as SystemMonitoringData;
          monitorLastUpdateAtRef.current = Date.now();
          setSystemMonitoringData(currentSnapshot);
        } else {
          nextStatus = mergeHealthStatus(nextStatus, resolveStatus(currentResult.reason));
          setSystemMonitoringData(null);
        }

        const dayPoints: MonitorTrendPoint[] =
          dayHistoryResult.status === 'fulfilled' && Array.isArray((dayHistoryResult.value as unknown as { history: Record<string, unknown>[] }).history)
            ? (dayHistoryResult.value as unknown as { history: Record<string, unknown>[] }).history.map((point) => toMonitorTrendPointFromHistory(point))
            : [];
        if (dayHistoryResult.status === 'rejected') {
          nextStatus = mergeHealthStatus(nextStatus, resolveStatus(dayHistoryResult.reason));
        }

        const weekPoints: MonitorTrendPoint[] =
          weekHistoryResult.status === 'fulfilled' && Array.isArray((weekHistoryResult.value as unknown as { history: Record<string, unknown>[] }).history)
            ? (weekHistoryResult.value as unknown as { history: Record<string, unknown>[] }).history.map((point) => toMonitorTrendPointFromHistory(point))
            : [];
        if (weekHistoryResult.status === 'rejected') {
          nextStatus = mergeHealthStatus(nextStatus, resolveStatus(weekHistoryResult.reason));
        }

        const recentPoints: MonitorTrendPoint[] =
          recentResult.status === 'fulfilled' && Array.isArray((recentResult.value as unknown as { points: Record<string, unknown>[] }).points)
            ? (recentResult.value as unknown as { points: Record<string, unknown>[] }).points.map((point) => toMonitorTrendPointFromHistory(point))
            : [];
        if (recentResult.status === 'rejected') {
          nextStatus = mergeHealthStatus(nextStatus, resolveStatus(recentResult.reason));
        }

        const hydrated = hydrateRangeCache(nextCache, {
          '1h': recentPoints,
          '1d': dayPoints,
          '7d': weekPoints,
        });

        if (currentSnapshot) {
          const currentPoint = toMonitorTrendPointFromSnapshot(currentSnapshot as unknown as Record<string, unknown>);
          setMonitorTrendCache(mergeRealtimePointIntoRangeCache(hydrated, currentPoint));
        } else if (hydrated.byRange['1h'].length === 0) {
          setMonitorTrendCache(
            hydrateRangeCache(hydrated, { '1h': [createDefaultMonitorTrendPoint()] })
          );
        } else {
          setMonitorTrendCache(hydrated);
        }

        setMonitorStatus(nextStatus);
        setMonitorLoaded(true);
      } catch (error: unknown) {
        if (!isMounted) return;
        console.warn('Failed to load system monitoring data:', error);
        if (!monitorLoaded) {
          setMonitorTrendCache((prev) => {
            if (prev.byRange['1h'].length > 0) return prev;
            return hydrateRangeCache(createMonitorTrendCache(), {
              '1h': [createDefaultMonitorTrendPoint()],
            });
          });
          toast('资源监控数据暂不可用');
          setMonitorLoaded(true);
        }
        setMonitorStatus(resolveStatus(error));
      }
    };

    void fetchSystemMonitoring();
    return () => { isMounted = false; };
  }, [activeTab, monitorLoaded]);

  // Polling keeps monitoring fresh after the initial snapshot load.
  useEffect(() => {
    if (activeTab !== 'monitor') return;

    let cancelled = false;
    const pollNow = async () => {
      try {
        const currentData = await apiClient.system.getSystemMonitoring();
        if (cancelled) return;
        monitorLastUpdateAtRef.current = Date.now();
        setSystemMonitoringData(currentData as unknown as SystemMonitoringData);
        setMonitorTrendCache((prev) =>
          mergeRealtimePointIntoRangeCache(prev, toMonitorTrendPointFromSnapshot(currentData as unknown as Record<string, unknown>))
        );
        setMonitorStatus('healthy');
        setMonitorLoaded(true);
      } catch (e: unknown) {        console.error("Unexpected error in useAdminMonitor:", e);

        // ignore polling errors
      }
    };

    void pollNow();
    const timer = setInterval(() => { void pollNow(); }, MONITOR_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeTab]);

  const updateContainerServiceResources = useCallback(async (
    service: string,
    memoryLimitMb: number,
    workerConcurrency: number | null
  ): Promise<void> => {
    const normalizedService = String(service || '').trim();
    const normalizedMemoryLimitMb = Math.round(Number(memoryLimitMb));
    const normalizedWorkerConcurrency =
      workerConcurrency === null || workerConcurrency === undefined
        ? null
        : Math.round(Number(workerConcurrency));

    if (!normalizedService) throw new Error('服务名不能为空');
    if (!Number.isFinite(normalizedMemoryLimitMb) || normalizedMemoryLimitMb <= 0) {
      throw new Error('内存上限必须是大于 0 的 MB 数值');
    }
    if (
      normalizedWorkerConcurrency !== null &&
      (!Number.isFinite(normalizedWorkerConcurrency) || normalizedWorkerConcurrency <= 0)
    ) {
      throw new Error('并发数必须是大于 0 的整数');
    }

    const memoryResult = await apiClient.system.updateServiceContainerMemoryLimit(
      normalizedService,
      normalizedMemoryLimitMb
    );
    const memorySnapshot = memoryResult as unknown as { snapshot?: SystemMonitoringData };
    let latestSnapshot = memorySnapshot.snapshot;

    if (normalizedWorkerConcurrency !== null) {
      const concurrencyResult = await apiClient.system.updateServiceWorkerConcurrency(
        normalizedService,
        normalizedWorkerConcurrency
      );
      const concurrencySnapshot = concurrencyResult as unknown as { snapshot?: SystemMonitoringData };
      if (concurrencySnapshot.snapshot) {
        latestSnapshot = concurrencySnapshot.snapshot;
      }
    }

    if (latestSnapshot && typeof latestSnapshot === 'object') {
      monitorLastUpdateAtRef.current = Date.now();
      setSystemMonitoringData(latestSnapshot);
      setMonitorTrendCache((prev) =>
        mergeRealtimePointIntoRangeCache(prev, toMonitorTrendPointFromSnapshot(latestSnapshot as unknown as Record<string, unknown>))
      );
      setMonitorStatus('healthy');
      setMonitorLoaded(true);
      return;
    }

    const currentData = await apiClient.system.getSystemMonitoring();
    const systemData = currentData as unknown as SystemMonitoringData;
    monitorLastUpdateAtRef.current = Date.now();
    setSystemMonitoringData(systemData);
    setMonitorTrendCache((prev) =>
      mergeRealtimePointIntoRangeCache(prev, toMonitorTrendPointFromSnapshot(currentData as unknown as Record<string, unknown>))
    );
    setMonitorStatus('healthy');
    setMonitorLoaded(true);
  }, []);

  return {
    systemMonitoringData,
    monitorTrendPoints,
    monitorLoaded,
    monitorRange,
    monitorStatus,
    setMonitorRange,
    updateContainerServiceResources,
  };
}
