'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type ServiceHealth = 'healthy' | 'degraded' | 'unavailable';

const HEALTH_CHECK_INTERVAL_MS = 15000;
const DEGRADED_THRESHOLD_MS = 3000;

export function useServiceHealth(intervalMs: number = HEALTH_CHECK_INTERVAL_MS) {
  const [status, setStatus] = useState<ServiceHealth>('healthy');
  const [checking, setChecking] = useState(false);
  const degradedTimerRef = useRef<number | null>(null);

  const check = useCallback(async () => {
    if (typeof window === 'undefined') return;
    setChecking(true);
    const startedAt = Date.now();
    try {
      const response = await fetch('/health', { method: 'GET', cache: 'no-store' });
      const ok = response.ok;
      if (ok) {
        if (degradedTimerRef.current) {
          window.clearTimeout(degradedTimerRef.current);
          degradedTimerRef.current = null;
        }
        setStatus('healthy');
      } else {
        setStatus('unavailable');
      }
    } catch {
      // 网络层失败：先降级，持续超时则不可用
      if (!degradedTimerRef.current) {
        degradedTimerRef.current = window.setTimeout(() => {
          setStatus('unavailable');
        }, DEGRADED_THRESHOLD_MS);
      }
      const elapsed = Date.now() - startedAt;
      if (elapsed > DEGRADED_THRESHOLD_MS) {
        setStatus('unavailable');
      } else {
        setStatus('degraded');
      }
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check();
    const timer = window.setInterval(() => {
      void check();
    }, intervalMs);
    return () => {
      window.clearInterval(timer);
      if (degradedTimerRef.current) {
        window.clearTimeout(degradedTimerRef.current);
      }
    };
  }, [check, intervalMs]);

  return { status, checking, refresh: check };
}
