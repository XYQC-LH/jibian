'use client';

import React from 'react';
import {
  DollarSign,
  Zap,
  UserPlus,
  Users,
  Activity,
  Target,
  TrendingUp,
  Gauge,
} from 'lucide-react';
import StatCard from '@/components/admin/resource/StatCard';

interface DashboardStatsProps {
  overviewData: {
    // 核心业务指标
    todayRevenue: number;
    todayTasks: number;
    newUsers: number;
    activeUsers: number;
    // 运营健康度
    successRate: number;
    avgResponseTime: number;
    topModel: string;
    // 趋势数据
    totalRevenue: number;
  };
  getTrend?: (category: string, metric: string) => number;
  financeLoading?: boolean;
  financeError?: string | null;
}

const DashboardStats: React.FC<DashboardStatsProps> = ({
  overviewData,
  getTrend,
  financeLoading,
  financeError,
}) => {
  // 格式化收入金额
  const formatRevenue = (value: number) => {
    if (financeLoading) return '加载中...';
    if (financeError) return '加载失败';
    if (value <= 0) return '¥0.00';
    if (value >= 10000) {
      return `¥${(value / 10000).toFixed(2)}万`;
    }
    return `¥${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="space-y-6 mb-8">
      {/* 第一行：核心业务指标 */}
      <div>
        <h3 className="text-sm font-medium text-text-muted mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          核心业务指标
        </h3>
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="今日收入"
            value={formatRevenue(overviewData.todayRevenue)}
            icon={DollarSign}
            trend={getTrend ? getTrend('finance', 'revenue') : 0}
            trendLabel="vs 昨日"
            color="green"
          />
          <StatCard
            title="今日任务"
            value={overviewData.todayTasks.toLocaleString()}
            icon={Zap}
            trend={getTrend ? getTrend('tasks', 'total') : 0}
            trendLabel="vs 昨日"
            color="blue"
          />
          <StatCard
            title="今日注册"
            value={overviewData.newUsers}
            icon={UserPlus}
            trend={getTrend ? getTrend('users', 'new') : 0}
            trendLabel="vs 昨日"
            color="purple"
          />
          <StatCard
            title="活跃用户"
            value={overviewData.activeUsers}
            icon={Users}
            trend={getTrend ? getTrend('users', 'active') : 0}
            trendLabel="7日活跃"
            color="orange"
          />
        </section>
      </div>

      {/* 第二行：运营健康度 */}
      <div>
        <h3 className="text-sm font-medium text-text-muted mb-3 flex items-center gap-2">
          <Gauge className="w-4 h-4" />
          运营健康度
        </h3>
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="任务成功率"
            value={`${overviewData.successRate.toFixed(1)}%`}
            icon={Target}
            trend={getTrend ? getTrend('tasks', 'success_rate') : 0}
            trendLabel="vs 昨日"
            color="green"
          />
          <StatCard
            title="平均响应时间"
            value={`${overviewData.avgResponseTime.toFixed(1)}s`}
            icon={Activity}
            trend={getTrend ? getTrend('performance', 'response_time') : 0}
            trendLabel="vs 昨日"
            color="blue"
          />
        </section>
      </div>
    </div>
  );
};

export default DashboardStats;
