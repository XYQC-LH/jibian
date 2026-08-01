'use client';

import React from 'react';
import { LayoutDashboard, RefreshCcw, Check } from 'lucide-react';

interface DashboardHeaderProps {
  onRefresh: () => void;
  loading: boolean;
  lastUpdate?: Date | null;
  lastUpdateText?: string;
  healthStatus?: string;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  onRefresh,
  loading,
  lastUpdate,
  lastUpdateText,
  healthStatus,
}) => {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl lg:text-4xl font-bold text-text-primary mb-2 flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <LayoutDashboard className="text-white w-6 h-6" />
          </div>
          即变运营仪表盘
        </h1>
        <p className="text-text-muted">生成任务、用户增长和积分收入概览</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="btn-primary relative"
        >
          <RefreshCcw size={16} className="mr-2" />
          刷新数据
          {loading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            </div>
          )}
        </button>
        {lastUpdate && (
          <div className="flex items-center text-xs text-text-muted">
            <div className={`w-2 h-2 rounded-full mr-2 ${
              healthStatus === 'healthy' ? 'bg-green-400' :
              healthStatus === 'warning' ? 'bg-yellow-400' :
              'bg-red-400'
            }`} />
            {lastUpdateText}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardHeader;
