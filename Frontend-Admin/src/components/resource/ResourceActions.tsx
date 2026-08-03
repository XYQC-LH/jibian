'use client';

import React from 'react';
import { RefreshCcw } from 'lucide-react';

interface ResourceActionsProps {
  onRefresh: () => void;
}

const ResourceActions: React.FC<ResourceActionsProps> = ({
  onRefresh
}) => {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <button className="btn-primary" onClick={onRefresh}>
        <RefreshCcw size={16} className="mr-2" />
        刷新数据
      </button>
    </div>
  );
};

export default ResourceActions;
