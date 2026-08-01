'use client';

import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/lib/api';
import type { TemplateStatistics } from '@/lib/api-clients/clients/templateClient';

export function useAdminTemplateStats(reloadKey: number) {
  const [stats, setStats] = useState<TemplateStatistics | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.template.getStatistics();
      setStats(data);
    } catch (error: unknown) {
      console.error('Failed to fetch template statistics:', error);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats, reloadKey]);

  return { stats, loading, refetch: fetchStats };
}
