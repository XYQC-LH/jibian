'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Settings } from 'lucide-react';
import ResourceActions from '@/components/resource/ResourceActions';
import AdminResourceModelsSection from '@/components/admin/resource/AdminResourceModelsSection';
import AddTemplateModal from '@/components/admin/resource/AddTemplateModal';
import EditModelModal from '@/components/admin/resource/EditModelModal';
import TemplateCategoryBar from '@/components/admin/resource/TemplateCategoryBar';
import { useAdminModels } from '@/components/admin/resource/useAdminModels';
import { useAdminTemplateStats } from '@/components/admin/resource/useAdminTemplateStats';
import { useAdminTemplateCategories } from '@/components/admin/resource/useAdminTemplateCategories';

const AdminResourceCenter: React.FC = () => {
  const [reloadKey, setReloadKey] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);

  const models = useAdminModels(reloadKey);
  const templateStats = useAdminTemplateStats(reloadKey);
  const categories = useAdminTemplateCategories();

  const handleRefreshAll = () => {
    setReloadKey((prev) => prev + 1);
    void categories.refetch();
  };

  const categoryOptions = useMemo(
    () => categories.categories.map((item) => item.name),
    [categories.categories]
  );

  const categoryCounts = useMemo(() => {
    return models.filteredModels.reduce<Record<string, number>>((counts, model) => {
      const category = String(model.category || '').trim();
      if (!category) return counts;
      counts[category] = (counts[category] || 0) + 1;
      return counts;
    }, {});
  }, [models.filteredModels]);

  const visibleModels = useMemo(() => {
    if (!selectedCategoryName) return models.filteredModels;
    return models.filteredModels.filter((model) => model.category === selectedCategoryName);
  }, [models.filteredModels, selectedCategoryName]);

  useEffect(() => {
    if (!selectedCategoryName) return;
    const stillExists = categories.categories.some((category) => category.name === selectedCategoryName);
    if (!stillExists) {
      setSelectedCategoryName(null);
    }
  }, [categories.categories, selectedCategoryName]);

  return (
    <div className="min-h-screen bg-background text-text-primary p-6">
      <div className="max-w-[1800px] mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-600 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Settings className="text-white w-6 h-6" />
              </div>
              模板管理
            </h1>
            <p className="text-text-muted">玩法模板管理</p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <button className="btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={16} className="mr-2" />
              添加模板
            </button>
            <ResourceActions onRefresh={handleRefreshAll} />
          </div>
        </div>

        <TemplateCategoryBar
          categories={categories.categories}
          loading={categories.loading}
          selectedCategoryName={selectedCategoryName}
          categoryCounts={categoryCounts}
          totalCount={models.filteredModels.length}
          onSelectCategory={setSelectedCategoryName}
          onCreate={categories.create}
          onUpdate={categories.update}
          onRemove={categories.remove}
          onReorder={categories.reorder}
        />

        <AdminResourceModelsSection
          searchTerm={models.searchTerm}
          filteredModels={visibleModels}
          allModels={models.models}
          modelsTotal={models.modelsTotal}
          hasActiveQuery={models.hasActiveQuery}
          selectedCategoryName={selectedCategoryName}
          loading={models.loading}
          togglingModelId={models.togglingModelId}
          templateStats={templateStats.stats}
          templateStatsLoading={templateStats.loading}
          onSearchChange={models.setSearchTerm}
          onToggleEnabled={(model, nextEnabled) => {
            void models.toggleModelEnabled(model, nextEnabled);
          }}
          onEditInfo={(model) => {
            models.setEditingModel(model);
            models.setShowEditModal(true);
          }}
          onReorderModels={models.canReorderModels ? models.reorderModels : undefined}
          dragDisabled={!models.canReorderModels}
        />

        {models.showEditModal && models.editingModel && (
          <EditModelModal
            model={models.editingModel}
            categoryOptions={categoryOptions}
            onClose={() => {
              models.setShowEditModal(false);
              models.setEditingModel(null);
            }}
            onSave={models.handleEditModelSave}
          />
        )}

        {showAddModal && (
          <AddTemplateModal
            categoryOptions={categoryOptions}
            onClose={() => setShowAddModal(false)}
            onCreated={handleRefreshAll}
          />
        )}
      </div>
    </div>
  );
};

export default AdminResourceCenter;
