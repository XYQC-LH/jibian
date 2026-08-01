import { useMemo } from 'react';
import { LayoutTemplate, Rocket, Archive, Repeat } from 'lucide-react';

import ResourceFilters from '@/components/resource/ResourceFilters';
import ResourceList from '@/components/resource/ResourceList';
import type { AIModel } from '@/components/resource/types';
import type { TemplateStatistics } from '@/lib/api-clients/clients/templateClient';

type AdminResourceModelsSectionProps = {
  searchTerm: string;
  filteredModels: AIModel[];
  allModels: AIModel[];
  modelsTotal: number;
  hasActiveQuery: boolean;
  loading: boolean;
  togglingModelId: string | null;
  templateStats: TemplateStatistics | null;
  templateStatsLoading: boolean;
  onSearchChange: (value: string) => void;
  onToggleEnabled: (model: AIModel, nextEnabled: boolean) => void;
  onEditInfo: (model: AIModel) => void;
  onReorderModels?: (reordered: AIModel[]) => void;
  dragDisabled?: boolean;
};

type ModelGroupId = 'image' | 'video' | 'music';

const MODEL_GROUP_IDS: ModelGroupId[] = ['image', 'video', 'music'];

const resolveModelGroupId = (model: AIModel): ModelGroupId | null => {
  const modelType = String((model.type || model.output_type || '')).trim().toLowerCase();
  if (modelType === 'image') return 'image';
  if (modelType === 'video') return 'video';
  if (modelType === 'music' || modelType === 'audio') return 'music';
  return null;
};

export default function AdminResourceModelsSection({
  searchTerm,
  filteredModels,
  allModels,
  modelsTotal,
  hasActiveQuery,
  loading,
  togglingModelId,
  templateStats,
  templateStatsLoading,
  onSearchChange,
  onToggleEnabled,
  onEditInfo,
  onReorderModels,
  dragDisabled = false,
}: AdminResourceModelsSectionProps) {
  const groupedModels = useMemo(
    () =>
      MODEL_GROUP_IDS.map((id) => ({
        id,
        models: filteredModels.filter((model) => resolveModelGroupId(model) === id),
      })),
    [filteredModels]
  );

  const templateStatCards = [
    {
      title: '模板总数',
      value: templateStatsLoading ? '...' : String(templateStats?.total ?? 0),
      icon: LayoutTemplate,
      color: 'from-purple-600 to-purple-700',
    },
    {
      title: '已上线',
      value: templateStatsLoading ? '...' : String(templateStats?.published ?? 0),
      icon: Rocket,
      color: 'from-green-600 to-green-700',
    },
    {
      title: '已下架',
      value: templateStatsLoading ? '...' : String(templateStats?.offline ?? 0),
      icon: Archive,
      color: 'from-slate-600 to-slate-700',
    },
    {
      title: '累计使用次数',
      value: templateStatsLoading ? '...' : String(templateStats?.total_usage ?? 0),
      icon: Repeat,
      color: 'from-blue-600 to-blue-700',
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {templateStatCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="card-primary p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-muted text-sm mb-1">{card.title}</p>
                  <p className="text-2xl font-bold text-text-primary">{card.value}</p>
                </div>
                <div className={`w-12 h-12 bg-gradient-to-br ${card.color} rounded-xl flex items-center justify-center`}>
                  <Icon className="text-white w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <ResourceFilters
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
      />

      {(hasActiveQuery || !loading) && groupedModels.every((group) => group.models.length === 0) ? (
        <div className="card-primary p-12 text-center">
          <p className="text-text-muted">当前筛选条件下暂无模型数据</p>
        </div>
      ) : null}

      <div className="space-y-6">
        {groupedModels.map((group) => {
          if (group.models.length === 0 && (hasActiveQuery || !loading)) {
            return null;
          }

          return (
            <section key={group.id}>
              <ResourceList
                models={group.models}
                loading={loading}
                onToggleEnabled={onToggleEnabled}
                togglingModelId={togglingModelId}
                onEditInfo={onEditInfo}
                onReorderModels={onReorderModels}
                dragDisabled={dragDisabled}
              />
            </section>
          );
        })}
      </div>

    </div>
  );
}
