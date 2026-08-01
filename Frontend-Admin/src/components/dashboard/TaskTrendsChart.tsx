'use client';

import React from 'react';
import { ChartSkeleton } from '@/components/ui/Skeleton';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TaskTrendsChartProps {
  trendsData: Record<string, unknown>[];
  loading: boolean;
  selectedDays?: number;
  onDaysChange?: (days: number) => void;
}

const TaskTrendsChart: React.FC<TaskTrendsChartProps> = ({
  trendsData,
  loading,
  selectedDays = 30,
  onDaysChange
}) => {
  // 根据选择的天数过滤数据
  const filteredData = React.useMemo(() => {
    if (!trendsData || trendsData.length === 0) return [];
    if (selectedDays >= trendsData.length) return trendsData;
    return trendsData.slice(-selectedDays);
  }, [trendsData, selectedDays]);

  const handleDaysChange = (days: number) => {
    if (onDaysChange) {
      onDaysChange(days);
    }
  };

  return (
    <div className="card-primary p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-text-primary flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-accent" />
          任务趋势分析
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => handleDaysChange(7)}
            className={`px-3 py-1 text-xs rounded-lg transition-colors ${
              selectedDays === 7
                ? 'bg-accent/20 text-accent'
                : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            7天
          </button>
          <button
            onClick={() => handleDaysChange(30)}
            className={`px-3 py-1 text-xs rounded-lg transition-colors ${
              selectedDays === 30
                ? 'bg-accent/20 text-accent'
                : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            30天
          </button>
        </div>
      </div>

      {loading ? (
        <ChartSkeleton />
      ) : filteredData.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#9ca3af"
              tick={{ fontSize: 12 }}
            />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(10, 10, 12, 0.95)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '8px',
                backdropFilter: 'blur(12px)',
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="tasks"
              stroke="#8b5cf6"
              fillOpacity={1}
              fill="url(#colorTasks)"
              strokeWidth={2}
              name="新增任务"
            />
            <Area
              type="monotone"
              dataKey="tasks_completed"
              stroke="#10b981"
              fillOpacity={1}
              fill="url(#colorCompleted)"
              strokeWidth={2}
              name="完成任务"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 text-text-muted mx-auto mb-3" />
            <p className="text-text-muted">暂无趋势数据</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskTrendsChart;
