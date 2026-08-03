import { useMemo } from 'react';

import ResourceFilters from '@/components/resource/ResourceFilters';
import ResourceList from '@/components/resource/ResourceList';
import type { AIModel } from '@/components/resource/types';

type AdminResourceModelsSectionProps = {
  searchTerm: string;
  filteredModels: AIModel[];
  allModels: AIModel[];
  modelsTotal: number;
  hasActiveQuery: boolean;
  selectedCategoryName?: string | null;
  loading: boolean;
  togglingModelId: string | null;
  onSearchChange: (value: string) => void;
  onToggleEnabled: (model: AIModel, nextEnabled: boolean) => void;
  onEditInfo: (model: AIModel) => void;
  onDelete: (model: AIModel) => void;
  onReorderModels?: (reordered: AIModel[]) => void;
  dragDisabled?: boolean;
};

export default function AdminResourceModelsSection({
  searchTerm,
  filteredModels,
  allModels,
  modelsTotal,
  hasActiveQuery,
  selectedCategoryName = null,
  loading,
  togglingModelId,
  onSearchChange,
  onToggleEnabled,
  onEditInfo,
  onDelete,
  onReorderModels,
  dragDisabled = false,
}: AdminResourceModelsSectionProps) {
  const groupedModels = useMemo(
    () => {
      if (filteredModels.length > 0 || !loading) {
        return [{
          id: selectedCategoryName || 'all',
          title: selectedCategoryName || '全部模板',
          models: filteredModels,
          showHeader: Boolean(selectedCategoryName),
        }];
      }

      return [{ id: 'loading', title: '模板', models: [], showHeader: false }];
    },
    [filteredModels, loading, selectedCategoryName]
  );
  const canReorderCurrentView = Boolean(selectedCategoryName) && !dragDisabled;

  return (
    <div className="space-y-6">
      <ResourceFilters
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
      />

      {(hasActiveQuery || !loading) && groupedModels.every((group) => group.models.length === 0) ? (
        <div className="card-primary p-12 text-center">
          <p className="text-text-muted">当前筛选条件下暂无模板数据</p>
        </div>
      ) : null}

      <div className="space-y-6">
        {groupedModels.map((group) => {
          if (group.models.length === 0 && (hasActiveQuery || !loading)) {
            return null;
          }

          return (
            <section key={group.id}>
              {group.showHeader ? (
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-text-primary">{group.title}</h2>
                  <span className="text-xs text-text-muted">{group.models.length} 个模板</span>
                </div>
              ) : null}
              <ResourceList
                models={group.models}
                loading={loading}
                onToggleEnabled={onToggleEnabled}
                togglingModelId={togglingModelId}
                onEditInfo={onEditInfo}
                onDelete={onDelete}
                onReorderModels={canReorderCurrentView ? onReorderModels : undefined}
                dragDisabled={!canReorderCurrentView}
              />
            </section>
          );
        })}
      </div>

    </div>
  );
}
