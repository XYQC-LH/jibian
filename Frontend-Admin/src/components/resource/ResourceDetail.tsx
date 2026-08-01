'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: 'purple' | 'green' | 'blue' | 'orange';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color }) => {
  const colorClasses = {
    purple: 'from-purple-600 to-purple-700',
    green: 'from-green-600 to-green-700',
    blue: 'from-blue-600 to-blue-700',
    orange: 'from-orange-600 to-orange-700'
  };

  return (
    <div className="card-primary p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-text-muted text-sm mb-1">{title}</p>
          <p className="text-2xl font-bold text-text-primary">{value}</p>
        </div>
        <div className={`w-12 h-12 bg-gradient-to-br ${colorClasses[color]} rounded-xl flex items-center justify-center`}>
          <Icon className="text-white w-6 h-6" />
        </div>
      </div>
    </div>
  );
};

interface ResourceStatsProps {
  stats: {
    totalModels: number;
    imageModels: number;
    videoModels: number;
    musicModels: number;
  };
  icons: {
    Cpu: LucideIcon;
    Image: LucideIcon;
    Video: LucideIcon;
    Music: LucideIcon;
  };
}

const ResourceDetail: React.FC<ResourceStatsProps> = ({ stats, icons }) => {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <StatCard
        title="总模型数"
        value={stats.totalModels}
        icon={icons.Cpu}
        color="purple"
      />
      <StatCard
        title="图像模型"
        value={stats.imageModels}
        icon={icons.Image}
        color="blue"
      />
      <StatCard
        title="视频模型"
        value={stats.videoModels}
        icon={icons.Video}
        color="orange"
      />
      <StatCard
        title="音乐模型"
        value={stats.musicModels}
        icon={icons.Music}
        color="purple"
      />
    </section>
  );
};

export default ResourceDetail;
