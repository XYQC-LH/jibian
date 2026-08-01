'use client';

import React from 'react';
import { TrendingUp } from 'lucide-react';

type ResourceMetricCardProps = {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string; size?: number | string }>;
  trend?: number;
  color?: 'purple' | 'green' | 'blue' | 'orange' | 'red';
};

const ResourceMetricCard: React.FC<ResourceMetricCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  color = 'purple',
}) => {
  const getStatusColor = (numeric: number, metricTitle: string) => {
    if (metricTitle === 'cpu' || metricTitle === 'memory' || metricTitle === 'disk') {
      if (numeric > 80) return 'text-red-400';
      if (numeric > 60) return 'text-yellow-400';
      return 'text-green-400';
    }
    return 'text-text-primary';
  };

  const colorClasses = {
    purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
    green: 'from-green-500/20 to-green-600/20 border-green-500/30',
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
    orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30',
    red: 'from-red-500/20 to-red-600/20 border-red-500/30',
  } as const;

  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  const statusColor = getStatusColor(numericValue, title);

  return (
    <div className="card-primary p-6">
      <div className="flex items-center justify-between mb-4">
        <div
          className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center`}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className={`text-lg font-semibold ${statusColor}`}>{value}</div>
      </div>
      <h3 className="text-sm font-medium text-text-primary">{title}</h3>
      {trend !== undefined && (
        <div className="flex items-center text-xs mt-2">
          <TrendingUp
            className={`w-3 h-3 mr-1 ${trend > 0 ? 'text-red-400' : 'text-green-400'}`}
          />
          <span className={trend > 0 ? 'text-red-400' : 'text-green-400'}>
            {trend > 0 ? '+' : ''}
            {trend.toFixed(2)}%
          </span>
        </div>
      )}
    </div>
  );
};

export default ResourceMetricCard;

