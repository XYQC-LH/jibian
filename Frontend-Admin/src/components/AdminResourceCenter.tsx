'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Archive, LayoutTemplate, Plus, Repeat, Rocket, Settings } from 'lucide-react';
import ResourceActions from '@/components/resource/ResourceActions';
import AdminResourceModelsSection from '@/components/admin/resource/AdminResourceModelsSection';
import AddTemplateModal from '@/components/admin/resource/AddTemplateModal';
import EditModelModal from '@/components/admin/resource/EditModelModal';
import TemplateCategoryBar from '@/components/admin/resource/TemplateCategoryBar';
import CategoryManageModal from '@/components/admin/resource/CategoryManageModal';
import { useAdminModels } from '@/components/admin/resource/useAdminModels';
import { useAdminTemplateStats } from '@/components/admin/resource/useAdminTemplateStats';
import { useAdminTemplateCategories } from '@/components/admin/resource/useAdminTemplateCategories';

const AdminResourceCenter: React.FC = () => {
  const [reloadKey, setReloadKey] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
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

  const templateStatCards = [
    {
      title: '模板总数',
      value: templateStats.loading ? '...' : String(templateStats.stats?.total ?? 0),
      icon: LayoutTemplate,
      color: 'from-purple-600 to-purple-700',
    },
    {
      title: '已上线',
      value: templateStats.loading ? '...' : String(templateStats.stats?.published ?? 0),
      icon: Rocket,
      color: 'from-green-600 to-green-700',
    },
    {
      title: '已下架',
      value: templateStats.loading ? '...' : String(templateStats.stats?.offline ?? 0),
      icon: Archive,
      color: 'from-slate-600 to-slate-700',
    },
    {
      title: '累计使用次数',
      value: templateStats.loading ? '...' : String(templateStats.stats?.total_usage ?? 0),
      icon: Repeat,
      color: 'from-blue-600 to-blue-700',
    },
  ];

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

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

        <TemplateCategoryBar
          categories={categories.categories}
          loading={categories.loading}
          selectedCategoryName={selectedCategoryName}
          categoryCounts={categoryCounts}
          totalCount={models.filteredModels.length}
          onSelectCategory={setSelectedCategoryName}
          onManage={() => setShowCategoryModal(true)}
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
          onSearchChange={models.setSearchTerm}
          onToggleEnabled={(model, nextEnabled) => {
            void models.toggleModelEnabled(model, nextEnabled);
          }}
          onEditInfo={(model) => {
            models.setEditingModel(model);
            models.setShowEditModal(true);
          }}
          onDelete={(model) => {
            void models.deleteModel(model);
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

        {showCategoryModal && (
          <CategoryManageModal
            categories={categories.categories}
            onCreate={categories.create}
            onUpdate={categories.update}
            onRemove={categories.remove}
            onClose={() => setShowCategoryModal(false)}
          />
        )}
      </div>
    </div>
  );
};

export default AdminResourceCenter;
