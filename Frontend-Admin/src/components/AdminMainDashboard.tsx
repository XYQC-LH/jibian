'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/useAdminAuth';
import UserManagement from '@/components/UserManagement';
import { AlertTriangle } from 'lucide-react';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { useRealtimeStats } from '@/hooks/useRealtimeStats';
import apiClient from '@/lib/api';
import AdminTaskCenter from '@/components/AdminTaskCenter';
import AdminFinanceCenter from '@/components/AdminFinanceCenter';
import AdminResourceCenter from '@/components/AdminResourceCenter';
import AdminContentModerationCenter from '@/components/AdminContentModerationCenter';
import SystemConfigPanel from '@/components/admin/resource/SystemConfigPanel';
import MonitorPanel from '@/components/admin/resource/MonitorPanel';
import ModelDispatchTab from '@/components/admin/resource/ModelDispatchTab';
import Sidebar from '@/components/dashboard/Sidebar';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import DashboardStats from '@/components/dashboard/DashboardStats';
import TaskTrendsChart from '@/components/dashboard/TaskTrendsChart';
import { adminSidebarModules, getAccessibleAdminSidebarModules } from '@/components/admin/adminSidebarConfig';
import { getErrorMessage } from '@/lib/http/errors';

// 仪表盘概览数据（初始值均为 0，等待 API 返回真实数据）
const initialOverviewData = {
  // 核心业务指标
  todayRevenue: 0,
  todayTasks: 0,
  newUsers: 0,
  activeUsers: 0,
  // 运营健康度
  successRate: 0,
  avgResponseTime: 0,
  topModel: '暂无数据',
  dailyCreditsSpent: 0,
  totalCreditsIssued: 0,
  // 其他数据
  totalRevenue: 0,
  totalUsers: 0,
  totalTasks: 0,
  completedTasks: 0,
  failedTasks: 0,
  processingTasks: 0,
};

const ADMIN_ACTIVE_MODULE_KEY = 'admin:activeModule';

export default function AdminMainDashboard() {
  const { user, logout } = useAdminAuth();
  const router = useRouter();
  const [activeModule, setActiveModule] = useState('仪表盘');
  const [overviewData, setOverviewData] = useState(initialOverviewData);
  const [trendsData, setTrendsData] = useState<any[]>([]);
  const [trendsDays, setTrendsDays] = useState(30); // 趋势图时间范围
  const [financeTotalRevenue, setFinanceTotalRevenue] = useState(0);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeError, setFinanceError] = useState<string | null>(null);
  const availableModules = useMemo(() => getAccessibleAdminSidebarModules(user), [user]);

  // 首次挂载时，从存储中恢复上次停留的模块，避免刷新后总是回到仪表盘
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const pathname = window.location.pathname;
      if (pathname === '/template' || pathname === '/resources') {
        const resourceModule = availableModules.find((module) => module.requiredPermission === 'admin.resources.read');
        if (resourceModule) {
          setActiveModule(resourceModule.name);
          window.sessionStorage.setItem(ADMIN_ACTIVE_MODULE_KEY, resourceModule.name);
          return;
        }
      }

      const saved = window.sessionStorage.getItem(ADMIN_ACTIVE_MODULE_KEY);
      if (!saved) return;
      const validNames = availableModules.map((m) => m.name);
      if (validNames.includes(saved)) {
        setActiveModule(saved);
      }
    } catch (e: unknown) {      console.error("Unexpected error in AdminMainDashboard:", e);

      // 忽略存储错误，保持默认值
    }
  }, [availableModules]);

  // 使用实时统计Hook
  const {
    stats,
    loading: loadingCharts,
    error,
    lastUpdate,
    lastUpdateText,
    healthStatus,
    refresh: manualRefresh,
    getTrend,
    isRateLimited
  } = useRealtimeStats({
    refreshInterval: 60000, // 60秒刷新间隔（避免速率限制）
    enableAutoRefresh: true,
    silentUpdate: true // 静默更新，不显示toast
  });

  const fetchFinanceTotalRevenue = useCallback(async () => {
    try {
      setFinanceLoading(true);
      setFinanceError(null);

      const dashboardData = await apiClient.finance.getFinanceDashboard(30);
      const summary = dashboardData?.summary as Record<string, unknown> | undefined;
      const totalRevenue = Number(summary?.total_revenue);
      setFinanceTotalRevenue(Number.isFinite(totalRevenue) ? totalRevenue : 0);
    } catch (err: unknown) {
      console.error('Failed to fetch finance dashboard:', err);
      setFinanceError(getErrorMessage(err, '加载失败'));
    } finally {
      setFinanceLoading(false);
    }
  }, []);


  useEffect(() => {
    fetchFinanceTotalRevenue();
  }, [fetchFinanceTotalRevenue]);

  useEffect(() => {
    setOverviewData((prev) => {
      if (prev.totalRevenue === financeTotalRevenue) return prev;
      return { ...prev, totalRevenue: financeTotalRevenue };
    });
  }, [financeTotalRevenue]);

  // 更新概览数据 - 只在关键数据变化时更新
  useEffect(() => {
    if (!stats) return;

    const trends = stats.trends || [];
    const lastDay = trends[trends.length - 1];
    const trendsRevenueTotal = trends.reduce((sum, item) => sum + (item.revenue || 0), 0);
    const resolvedTotalRevenue = financeTotalRevenue > 0 ? financeTotalRevenue : trendsRevenueTotal;

    // 检查是否需要更新（避免无限循环）
    const newOverviewData = {
      // 核心业务指标
      todayRevenue: lastDay?.revenue || 0,
      todayTasks: lastDay?.tasks || 0,
      newUsers: stats.users.today_registrations,
      activeUsers: stats.users.active || stats.users.recent_active,
      // 运营健康度
      successRate: stats.tasks.total > 0 ? (stats.tasks.completed / stats.tasks.total) * 100 : 0,
      avgResponseTime: stats.performance.avg_response_time,
      topModel: (() => {
        const models = stats?.models || {};
        const modelEntries = Object.entries(models);
        if (modelEntries.length === 0) return '暂无数据';

        const topModel = modelEntries.reduce((a, b) =>
          ((b[1] as Record<string, unknown>).tasks as number || 0) > ((a[1] as Record<string, unknown>).tasks as number || 0) ? b : a
        );
        const topModelData = topModel[1] as Record<string, unknown>;

        return Number(topModelData.tasks ?? 0) > 0 ? topModel[0] : '暂无数据';
      })(),
      dailyCreditsSpent: stats.credits.daily_spent || 0,
      totalCreditsIssued: stats.credits.total_earned,
      // 其他数据
      totalRevenue: resolvedTotalRevenue,
      totalUsers: stats.users.total,
      totalTasks: stats.tasks.total,
      completedTasks: stats.tasks.completed,
      failedTasks: stats.tasks.failed,
      processingTasks: stats.tasks.generating,
    };

    // 只有数据真正变化时才更新
    setOverviewData(prev => {
      const hasChanged = JSON.stringify(prev) !== JSON.stringify(newOverviewData);
      return hasChanged ? newOverviewData : prev;
    });

    // 处理图表数据
    if (Array.isArray(trends) && trends.length > 0) {
      // 任务趋势数据
      const processedTrends = trends.map((item) => ({
        date: new Date(item.date).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }),
        tasks: item.tasks || 0,
        tasks_completed: item.tasks_completed || 0,
        users: item.users || 0,
        revenue: item.revenue || 0,
      }));
      setTrendsData(prev => {
        const hasChanged = JSON.stringify(prev) !== JSON.stringify(processedTrends);
        return hasChanged ? processedTrends : prev;
      });
    } else {
      // 没有趋势数据时设置为空数组
      setTrendsData([]);
    }

  }, [stats, financeTotalRevenue]);

  const shouldShowDashboard = activeModule === '仪表盘';
  const hasData = stats !== null || !loadingCharts;

  const handleModuleChange = (moduleName: string) => {
    const targetModule = adminSidebarModules.find((module) => module.name === moduleName);
    if (!targetModule) {
      return;
    }

    setActiveModule(moduleName);
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(ADMIN_ACTIVE_MODULE_KEY, moduleName);
      } catch (e: unknown) {        console.error("Unexpected error in AdminMainDashboard:", e);

        // 存储失败时不影响正常导航
      }
    }

    router.push(targetModule.href);
  };

  const handleRefresh = useCallback(() => {
    manualRefresh();
    fetchFinanceTotalRevenue();
  }, [manualRefresh, fetchFinanceTotalRevenue]);

  return (
    <div className="min-h-screen flex bg-background text-text-primary">
      <Sidebar
        user={user}
        activeModule={activeModule}
        adminModules={adminSidebarModules}
        onModuleChange={handleModuleChange}
        onLogout={logout}
      />

      {/* 主内容区 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-6 lg:p-8 max-w-[1800px] mx-auto">
          {shouldShowDashboard && (
            <>
              <DashboardHeader
                onRefresh={handleRefresh}
                loading={loadingCharts}
                lastUpdate={lastUpdate}
                lastUpdateText={lastUpdateText}
                healthStatus={healthStatus}
              />

              {/* 数据加载状态显示 */}
              {loadingCharts && !stats && (
                <div className="mb-8">
                  <DashboardSkeleton statCards={4} />
                </div>
              )}

              {/* 错误状态显示 */}
              {error && !loadingCharts && (
                <div className={`bg-red-500/10 border rounded-lg p-4 mb-8 ${isRateLimited ? 'border-yellow-500/30 bg-yellow-500/10' : 'border-red-500/30'}`}>
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={`w-5 h-5 ${isRateLimited ? 'text-yellow-400' : 'text-red-400'}`} />
                    <div>
                      <p className={`${isRateLimited ? 'text-yellow-400' : 'text-red-400'} font-medium`}>
                        {isRateLimited ? '请求过于频繁' : '数据加载失败'}
                      </p>
                      <p className={`text-sm ${isRateLimited ? 'text-yellow-300' : 'text-red-300'}`}>
                        {isRateLimited ? '系统正在智能等待，请稍候...' : error.message}
                      </p>
                    </div>
                    {!isRateLimited && (
                      <button
                        onClick={manualRefresh}
                        className="ml-auto px-3 py-1 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                      >
                        重试
                      </button>
                    )}
                  </div>
                </div>
              )}

              <DashboardStats
                overviewData={overviewData}
                getTrend={getTrend}
                financeLoading={financeLoading}
                financeError={financeError}
              />

              {/* 图表区域 */}
              <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
                <TaskTrendsChart
                  trendsData={trendsData}
                  loading={loadingCharts && !stats}
                  selectedDays={trendsDays}
                  onDaysChange={setTrendsDays}
                />

              </section>

            </>
          )}

          {activeModule === '用户管理' && <UserManagement />}

          {activeModule === '生成任务' && <AdminTaskCenter />}

          {activeModule === '源头监控与调度' && <ModelDispatchTab />}

          {activeModule === '模板与模型' && <AdminResourceCenter />}

          {activeModule === '系统配置' && <SystemConfigPanel />}

          {activeModule === '资源监控' && <MonitorPanel />}

          {activeModule === '内容审核' && <AdminContentModerationCenter />}

          {!shouldShowDashboard &&
            ![
              '用户管理',
              '生成任务',
              '源头监控与调度',
              '模板与模型',
              '系统配置',
              '资源监控',
              '积分与兑换',
              '内容审核',
            ].includes(activeModule) && (
              <div className="card-primary p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-text-primary font-medium">模块未实现或不可用</div>
                    <div className="text-sm text-text-muted mt-1">
                      当前模块：{activeModule}
                    </div>
                  </div>
                  <button
                    onClick={() => handleModuleChange('仪表盘')}
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-text-primary transition-colors"
                  >
                    返回仪表盘
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
