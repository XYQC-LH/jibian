'use client';

import React from 'react';
import { RefreshCcw } from 'lucide-react';

interface ResourceActionsProps {
  serviceStatus: 'healthy' | 'degraded' | 'unavailable';
  onRefresh: () => void;
}

const ResourceActions: React.FC<ResourceActionsProps> = ({
  serviceStatus,
  onRefresh
}) => {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* 服务状态指示器 */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10">
        <div className={`w-2 h-2 rounded-full ${
          serviceStatus === 'healthy' ? 'bg-green-400' :
          serviceStatus === 'degraded' ? 'bg-yellow-400' :
          'bg-red-400'
        }`} />
        <span className="text-sm text-text-muted">
          {serviceStatus === 'healthy' ? '服务正常' :
           serviceStatus === 'degraded' ? '服务降级' :
           '服务不可用'}
        </span>
      </div>

      <button className="btn-primary" onClick={onRefresh}>
        <RefreshCcw size={16} className="mr-2" />
        刷新数据
      </button>
    </div>
  );
};

export default ResourceActions;
