'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Settings, Tags } from 'lucide-react';
import ResourceActions from '@/components/resource/ResourceActions';
import AdminResourceModelsSection from '@/components/admin/resource/AdminResourceModelsSection';
import AddTemplateModal from '@/components/admin/resource/AddTemplateModal';
import CategoryManageModal from '@/components/admin/resource/CategoryManageModal';
import EditModelModal from '@/components/admin/resource/EditModelModal';
import { useAdminModels } from '@/components/admin/resource/useAdminModels';
import { useAdminTemplateStats } from '@/components/admin/resource/useAdminTemplateStats';

const AdminResourceCenter: React.FC = () => {
  const [reloadKey, setReloadKey] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryVersion, setCategoryVersion] = useState(0);

  const models = useAdminModels(reloadKey);
  const templateStats = useAdminTemplateStats(reloadKey);

  const serviceStatus = useMemo(() => {
    if (models.baseStatus === 'unavailable') {
      return 'unavailable';
    }
    if (models.baseStatus === 'degraded') {
      return 'degraded';
    }
    return 'healthy';
  }, [models.baseStatus]);

  const handleRefreshAll = () => {
    setReloadKey((prev) => prev + 1);
  };

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
            <button className="btn-secondary border border-white/10" onClick={() => setShowCategoryModal(true)}>
              <Tags size={16} className="mr-2" />
              分类管理
            </button>
            <ResourceActions serviceStatus={serviceStatus} onRefresh={handleRefreshAll} />
          </div>
        </div>

        <AdminResourceModelsSection
          searchTerm={models.searchTerm}
          filteredModels={models.filteredModels}
          allModels={models.models}
          modelsTotal={models.modelsTotal}
          hasActiveQuery={models.hasActiveQuery}
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
            onClose={() => {
              models.setShowEditModal(false);
              models.setEditingModel(null);
            }}
            onSave={models.handleEditModelSave}
          />
        )}

        {showAddModal && (
          <AddTemplateModal
            categoryVersion={categoryVersion}
            onClose={() => setShowAddModal(false)}
            onCreated={handleRefreshAll}
          />
        )}

        {showCategoryModal && (
          <CategoryManageModal
            onClose={() => setShowCategoryModal(false)}
            onChanged={() => setCategoryVersion((prev) => prev + 1)}
          />
        )}
      </div>
    </div>
  );
};

export default AdminResourceCenter;
