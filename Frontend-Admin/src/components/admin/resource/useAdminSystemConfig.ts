'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@/lib/api';
import { getErrorMessage, getErrorStatus, getErrorCode } from '@/lib/http/errors';
import type { ResourceTab } from '@/lib/resourceSubrouteMap';
import type { SystemConfig } from '@/types';
import { DEFAULT_SYSTEM_CONFIG, resolveStatus } from './resourceCenterShared';

export function useAdminSystemConfig(activeTab: ResourceTab, reloadKey: number) {
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [systemStatus, setSystemStatus] = useState<'healthy' | 'degraded' | 'unavailable'>('healthy');
  const [loadedReloadKey, setLoadedReloadKey] = useState<number | null>(null);

  useEffect(() => {
    if (activeTab !== 'system' || loadedReloadKey === reloadKey) return;

    let isMounted = true;
    const fetchSystemConfig = async () => {
      try {
        const config = await apiClient.system.getSystemConfig();
        if (!isMounted) return;
        setSystemConfig(config);
        setSystemStatus('healthy');
        setLoadedReloadKey(reloadKey);
      } catch (error: unknown) {
        if (!isMounted) return;
        console.warn('Failed to load system config:', error);
        setSystemConfig(DEFAULT_SYSTEM_CONFIG);
        setSystemStatus(resolveStatus(error));
        toast('系统配置加载失败，使用默认配置', { icon: '⚠️' });
        setLoadedReloadKey(reloadKey);
      }
    };

    fetchSystemConfig();
    return () => { isMounted = false; };
  }, [activeTab, loadedReloadKey, reloadKey]);

  const updateSystemConfig = useCallback(async (config: Partial<SystemConfig>) => {
    try {
      if (!systemConfig) return;
      const merged = { ...systemConfig, ...config };
      const payload: Partial<SystemConfig> = {
        task_timeout: merged.task_timeout,
        cleanup_interval: merged.cleanup_interval,
      };
      const updated = await apiClient.system.updateSystemConfig(payload);
      setSystemConfig(updated);
      toast.success('系统配置已更新');
    } catch (error: unknown) {
      console.error('Update system config error:', error);
      if (getErrorMessage(error, '').includes('503') || getErrorStatus(error) === 503) {
        toast.error('服务暂时不可用，请稍后重试');
      } else if (getErrorMessage(error, '').includes('Network Error') || getErrorCode(error) === 'NETWORK_ERROR') {
        toast.error('网络连接失败，请检查网络状态');
      } else {
        toast.error(getErrorMessage(error, '更新系统配置失败'));
      }
    }
  }, [systemConfig]);

  return { systemConfig, systemStatus, setSystemConfig, updateSystemConfig };
}
