import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@/lib/api';
import { getErrorMessage, getErrorStatus } from '@/lib/http/errors';
import { ENABLE_MOCKS, mockSystemStats } from '@/lib/mockData';

// 统计数据类型定义
interface SystemStats {
  users: {
    total: number;
    active: number;
    recent_active: number;
    today_registrations: number;
    new: number;
  };
  tasks: {
    total: number;
    completed: number;
    failed: number;
    generating: number;
    pending: number;
  };
  credits: {
    total_earned: number;
    monthly_earned: number;
    daily_spent: number;
    total_balance: number;
  };
  transactions: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    average_value: number;
    conversion_rate: number;
  };
  trends: Array<{
    date: string;
    tasks: number;
    tasks_completed: number;
    users: number;
    revenue: number;
    transactions: number;
  }>;
  models: Record<string, {
    revenue: number;
    tasks: number;
    users: number;
  }>;
  payment_methods: Record<string, {
    revenue: number;
    count: number;
  }>;
  performance: {
    avg_response_time: number;
    system_uptime: number;
    queue_size: number;
    cpu_usage: number;
    memory_usage: number;
  };
  conversion_funnel?: unknown;
}

interface RealtimeStatsOptions {
  refreshInterval?: number; // 刷新间隔（毫秒）
  enableAutoRefresh?: boolean; // 是否启用自动刷新
  onStatsUpdate?: (stats: SystemStats) => void; // 数据更新回调
  onError?: (error: Error) => void; // 错误回调
  silentUpdate?: boolean; // 是否静默更新（不显示toast）
}

const calculatePercentChange = (currentValue: number, previousValue: number): number => {
  if (previousValue <= 0) return 0;

  const change = ((currentValue - previousValue) / previousValue) * 100;
  if (!Number.isFinite(change)) return 0;

  return Number(change.toFixed(1));
};

/**
 * 实时统计数据Hook
 * 提供系统统计数据的实时更新功能
 */
export const useRealtimeStats = (options: RealtimeStatsOptions = {}) => {
  const {
    refreshInterval = 60000, // 默认60秒（减少请求频率）
    enableAutoRefresh = true,
    onStatsUpdate,
    onError,
    silentUpdate = true
  } = options;

  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isManualRefresh, setIsManualRefresh] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRateLimited, setIsRateLimited] = useState(false);

  // 使用 ref 来存储最新的函数引用，避免无限循环
  const fetchStatsRef = useRef<(isManual?: boolean) => Promise<void>>();
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 获取统计数据
  const fetchStats = useCallback(async (isManual = false) => {
    if (ENABLE_MOCKS) {
      setLoading(true);
      setError(null);
      setIsManualRefresh(isManual);
      window.setTimeout(() => {
        setStats(mockSystemStats);
        setLastUpdate(new Date());
        setLoading(false);
        if (isManual) {
          setTimeout(() => setIsManualRefresh(false), 500);
        }
        onStatsUpdate?.(mockSystemStats);
      }, 250);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (isManual) {
        setIsManualRefresh(true);
      }

      const response = await apiClient.finance.getStatistics(30) as Record<string, unknown>;

      // 标准化数据格式 - 确保数据准确且无占位符
      const usersData = response?.users as Record<string, unknown> | undefined;
      const tasksData = response?.tasks as Record<string, unknown> | undefined;
      const creditsData = response?.credits as Record<string, unknown> | undefined;
      const txData = response?.transactions as Record<string, unknown> | undefined;
      const perfData = response?.performance as Record<string, unknown> | undefined;
      const normalizedStats: SystemStats = {
        users: {
          total: Math.max(0, Number(usersData?.total ?? 0)),
          active: Math.max(0, Number(usersData?.active ?? 0)),
          recent_active: Math.max(0, Number(usersData?.recent_active ?? 0)),
          today_registrations: Math.max(0, Number(usersData?.today_registrations ?? 0)),
          new: Math.max(0, Number(usersData?.new ?? 0))
        },
        tasks: {
          total: Math.max(0, Number(tasksData?.total ?? 0)),
          completed: Math.max(0, Number(tasksData?.completed ?? 0)),
          failed: Math.max(0, Number(tasksData?.failed ?? 0)),
          generating: Math.max(0, Number(tasksData?.generating ?? 0)),
          pending: Math.max(0, Number(tasksData?.pending ?? 0))
        },
        credits: {
          total_earned: Math.max(0, Number(creditsData?.total_earned ?? 0)),
          monthly_earned: Math.max(0, Number(creditsData?.monthly_earned ?? 0)),
          daily_spent: Math.max(0, Number(creditsData?.daily_spent ?? 0)),
          total_balance: Math.max(0, Number(creditsData?.total_balance ?? 0))
        },
        transactions: {
          total: Math.max(0, Number(txData?.total ?? 0)),
          completed: Math.max(0, Number(txData?.completed ?? 0)),
          failed: Math.max(0, Number(txData?.failed ?? 0)),
          pending: Math.max(0, Number(txData?.pending ?? 0)),
          average_value: Math.max(0, Number(txData?.average_value ?? 0)),
          conversion_rate: Math.max(0, Math.min(100, Number(txData?.conversion_rate ?? 0)))
        },
        trends: Array.isArray(response?.trends) ? (response.trends as Record<string, unknown>[]).map((trend) => ({
          date: String(trend.date ?? ''),
          tasks: Math.max(0, Number(trend.tasks ?? 0)),
          tasks_completed: Math.max(0, Number(trend.tasks_completed ?? 0)),
          users: Math.max(0, Number(trend.users ?? 0)),
          revenue: Math.max(0, Number(trend.revenue ?? 0)),
          transactions: Math.max(0, Number(trend.transactions ?? 0))
        })) : [],
        models: typeof response?.models === 'object' && response.models !== null ? response.models as any : {},
        payment_methods: typeof response?.payment_methods === 'object' && response.payment_methods !== null ? response.payment_methods as any : {},
        performance: {
          avg_response_time: Math.max(0, Number(perfData?.avg_response_time ?? 0)),
          system_uptime: Math.max(0, Math.min(100, Number(perfData?.system_uptime ?? 0))),
          queue_size: Math.max(0, Number(perfData?.queue_size ?? 0)),
          cpu_usage: Math.max(0, Math.min(100, Number(perfData?.cpu_usage ?? 0))),
          memory_usage: Math.max(0, Math.min(100, Number(perfData?.memory_usage ?? 0)))
        },
        // 注册转化漏斗数据（用于仪表盘 ConversionFunnel 组件）
        conversion_funnel: response?.conversion_funnel
      };

      setStats(normalizedStats);
      setLastUpdate(new Date());

      // 调用回调函数
      if (onStatsUpdate) {
        onStatsUpdate(normalizedStats);
      }

    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, '获取统计数据失败');
      const error = new Error(errorMessage);
      setError(error);

      // 检查是否是速率限制错误
      const isRateLimitError =
        errorMessage.toLowerCase().includes('too many requests') ||
        getErrorStatus(err) === 429 ||
        errorMessage.includes('请求过多');

      if (isRateLimitError) {
        setIsRateLimited(true);
        setRetryCount(prev => prev + 1);

        // 指数退避：第1次等30秒，第2次等60秒，第3次等120秒
        const backoffTime = Math.min(30000 * Math.pow(2, retryCount), 120000);

        if (!isManual) {
          console.warn(`速率限制：${backoffTime / 1000}秒后重试 (第${retryCount + 1}次)`);

          // 清除之前的重试定时器
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
          }

          // 设置新的重试定时器
          retryTimeoutRef.current = setTimeout(() => {
            setIsRateLimited(false);
            if (fetchStatsRef.current) {
              fetchStatsRef.current(false);
            }
          }, backoffTime);
        }
      } else {
        // 其他错误，重置重试计数
        setRetryCount(0);
      }

      setStats(mockSystemStats);
      setLastUpdate(new Date());

      if (onError) {
        onError(error);
      }

      if (!isManual) {
        console.error('Failed to fetch stats:', err);
      }
    } finally {
      setLoading(false);
      if (isManual) {
        setTimeout(() => setIsManualRefresh(false), 1000);
      }
    }
  }, [onStatsUpdate, onError, retryCount]);

  // 将 fetchStats 函数赋值给 ref
  useEffect(() => {
    fetchStatsRef.current = fetchStats;
  }, [fetchStats]);

  // 手动刷新
  const manualRefresh = useCallback(() => {
    if (fetchStatsRef.current) {
      fetchStatsRef.current(true);
    }
  }, []);

  // 计算数据变化
  const getTrend = useCallback((key: string, subKey?: string) => {
    if (!stats || !stats.trends || stats.trends.length < 2) {
      return 0;
    }

    const trends = stats.trends;
    const current = trends[trends.length - 1];
    const previous = trends[trends.length - 2];

    if (!current || !previous) return 0;

    switch (key) {
      case 'tasks':
        if (subKey === 'total') {
          const currentTasks = current.tasks || 0;
          const previousTasks = previous.tasks || 0;
          return calculatePercentChange(currentTasks, previousTasks);
        } else if (subKey === 'completed') {
          const currentCompleted = current.tasks_completed || 0;
          const previousCompleted = previous.tasks_completed || 0;
          return calculatePercentChange(currentCompleted, previousCompleted);
        } else if (subKey === 'success_rate') {
          const currentTasks = current.tasks || 0;
          const previousTasks = previous.tasks || 0;

          if (currentTasks <= 0 || previousTasks <= 0) {
            return 0;
          }

          const currentSuccessRate = ((current.tasks_completed || 0) / currentTasks) * 100;
          const previousSuccessRate = ((previous.tasks_completed || 0) / previousTasks) * 100;

          return calculatePercentChange(currentSuccessRate, previousSuccessRate);
        }
        break;
      case 'users':
        if (subKey === 'total') {
          const currentUsers = current.users || 0;
          const previousUsers = previous.users || 0;
          return calculatePercentChange(currentUsers, previousUsers);
        }
        break;
      case 'credits':
        if (subKey === 'total_earned') {
          const currentRevenue = current.revenue || 0;
          const previousRevenue = previous.revenue || 0;
          return calculatePercentChange(currentRevenue, previousRevenue);
        }
        break;
    }

    return 0;
  }, [stats]);

  // 获取健康状态
  const getHealthStatus = useCallback(() => {
    if (!stats) return 'unknown';

    const { tasks, performance } = stats;

    // 基于任务成功率和系统性能计算健康状态
    const successRate = tasks.total > 0 ? (tasks.completed / tasks.total) * 100 : 100;
    const isHealthy = successRate >= 95 &&
                     performance.system_uptime >= 99 &&
                     performance.avg_response_time <= 2;

    if (isHealthy) return 'healthy';
    if (successRate >= 90 && performance.system_uptime >= 95) return 'warning';
    return 'critical';
  }, [stats]);

  // 格式化最后更新时间
  const getLastUpdateText = useCallback(() => {
    if (!lastUpdate) return '从未更新';

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000);

    if (diffInSeconds < 60) return '刚刚更新';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}分钟前更新`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}小时前更新`;
    return lastUpdate.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
  }, [lastUpdate]);

  // 初始化数据 - 组件挂载时执行一次
  useEffect(() => {
    // 使用 setTimeout 确保组件完全挂载后再加载数据
    const timeoutId = setTimeout(() => {
      if (fetchStatsRef.current) {
        fetchStatsRef.current();
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  // 设置定时刷新 - 使用 ref 来避免依赖变化
  useEffect(() => {
    if (!enableAutoRefresh || isRateLimited) return; // 如果被限流则暂停自动刷新

    const interval = setInterval(() => {
      fetchStatsRef.current && fetchStatsRef.current(false);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [enableAutoRefresh, refreshInterval, isRateLimited]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    stats,
    loading,
    error,
    lastUpdate,
    lastUpdateText: getLastUpdateText(),
    isManualRefresh,
    healthStatus: getHealthStatus(),
    refresh: manualRefresh,
    getTrend,
    isRateLimited
  };
};
