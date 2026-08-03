'use client';

import React, { useState, useCallback } from 'react';
import {
  Edit,
  GripVertical,
} from 'lucide-react';
import { getModelLogoUrl } from '@/components/icons/models';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragCancelEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { AIModel } from './types';

interface SortableModelCardProps {
  model: AIModel;
  onEditInfo: () => void;
  onToggleEnabled: (nextEnabled: boolean) => void;
  toggleLoading: boolean;
  dragOverlay?: boolean;
  dragDisabled?: boolean;
}

const normalizeCreditsCost = (value: unknown, defaultValue = 1): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  const normalized = Math.round(parsed * 10) / 10;
  return normalized >= 0 ? normalized : defaultValue;
};

const formatCreditsCost = (value: unknown): string => {
  const normalized = normalizeCreditsCost(value);
  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1);
};

const formatCny = (value: unknown): string => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '-';
  return `¥${parsed.toFixed(2)}`;
};

const ModelCard: React.FC<SortableModelCardProps> = ({
  model,
  onEditInfo,
  onToggleEnabled,
  toggleLoading,
  dragOverlay = false,
  dragDisabled = false,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: model.id,
    disabled: dragOverlay || dragDisabled,
  });

  const style: React.CSSProperties = {
    transform: dragOverlay ? undefined : CSS.Transform.toString(transform),
    transition: dragOverlay ? undefined : transition || (isDragging ? undefined : 'transform 220ms ease'),
    opacity: dragOverlay ? 1 : isDragging ? 0.35 : 1,
    zIndex: dragOverlay || isDragging ? 50 : undefined,
    willChange: dragOverlay || isDragging ? 'transform' : undefined,
  };

  const logoUrl = getModelLogoUrl(model.id);
  const coverUrl = model.cover_url || null;
  const isEnabled = model.is_enabled ?? model.is_active;

  return (
    <div
      ref={dragOverlay ? undefined : setNodeRef}
      style={style}
      className={`card-primary overflow-hidden transition-all duration-200 ${
        dragOverlay
          ? 'rotate-[0.6deg] scale-[1.02] border-white/20 shadow-[0_18px_45px_rgba(0,0,0,0.35)]'
          : 'hover:border-white/20'
      } ${isDragging ? 'shadow-[0_12px_30px_rgba(0,0,0,0.28)]' : ''}`}
    >
      <div className="flex items-stretch">
        {/* 封面图 */}
        <div className="relative w-24 shrink-0 bg-gradient-to-br from-blue-500 to-purple-500 sm:w-28">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={`${model.name || model.id} 封面`}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <img
                src={logoUrl}
                alt={`${model.name || model.id} logo`}
                className="w-10 h-10 object-contain"
                loading="lazy"
              />
            </div>
          )}
        </div>

        {/* 信息区 */}
        <div className="flex flex-1 flex-col p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h4 className="font-semibold text-sm text-text-primary truncate">{model.name || model.id}</h4>
              {model.category ? (
                <p className="text-xs text-text-muted truncate">{model.category}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onToggleEnabled(!isEnabled)}
              disabled={toggleLoading}
              aria-label={isEnabled ? '停用模板' : '启用模板'}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${
                isEnabled ? 'bg-green-500/80' : 'bg-gray-500/40'
              } ${toggleLoading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isEnabled ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-text-muted mt-2">
            <span>积分 <span className="font-medium text-text-primary">{formatCreditsCost(model.cost_credits)}</span></span>
            <span>成功率 <span className="font-medium text-green-400">{model.performance.success_rate.toFixed(1)}%</span></span>
            <span>总计 <span className="font-medium text-text-primary">{model.performance.total_usage.toLocaleString()}</span></span>
          </div>

          {/* 成功率进度条 */}
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-3">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-300"
              style={{ width: `${model.performance.success_rate}%` }}
            />
          </div>

          <div className="flex items-center gap-2 mt-auto pt-3">
            <button
              type="button"
              onClick={onEditInfo}
              className="flex h-7 items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 text-xs text-text-muted hover:bg-white/10 hover:text-text-primary transition"
              aria-label="编辑信息"
            >
              <Edit size={12} />
              编辑
            </button>
            <span
              className={`cursor-${dragDisabled ? 'default' : 'grab'} flex h-7 items-center rounded-md border border-white/10 bg-white/5 px-2.5 text-xs text-text-muted touch-none ${
                dragDisabled ? 'opacity-50 cursor-default' : 'cursor-grab hover:bg-white/10'
              }`}
              onPointerDown={(event) => event.stopPropagation()}
              {...(dragOverlay ? {} : attributes)}
              {...(dragOverlay ? {} : listeners)}
            >
              <GripVertical size={12} className="mr-1" />
              拖拽排序
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ResourceListProps {
  models: AIModel[];
  loading: boolean;
  onEditInfo: (model: AIModel) => void;
  onToggleEnabled: (model: AIModel, nextEnabled: boolean) => void;
  togglingModelId?: string | null;
  onReorderModels?: (reordered: AIModel[]) => void;
  dragDisabled?: boolean;
}

const ResourceList: React.FC<ResourceListProps> = ({
  models,
  loading,
  onEditInfo,
  onToggleEnabled,
  togglingModelId,
  onReorderModels,
  dragDisabled = false,
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragCancel = useCallback((_event?: DragCancelEvent) => {
    setActiveId(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || active.id === over.id || !onReorderModels) return;

      const oldIndex = models.findIndex((m) => m.id === active.id);
      const newIndex = models.findIndex((m) => m.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(models, oldIndex, newIndex);
      onReorderModels(reordered);
    },
    [models, onReorderModels]
  );

  const disableDrag = dragDisabled || !onReorderModels;
  const activeModel = activeId ? models.find((item) => item.id === activeId) ?? null : null;

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="card-primary p-5">
            <div className="animate-pulse space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-white/10 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/10 rounded w-3/4" />
                  <div className="h-3 bg-white/10 rounded w-1/2" />
                </div>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full" />
              <div className="h-3 bg-white/10 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="card-primary p-12 text-center">
        <p className="text-text-muted">{'暂无模板数据'}</p>
      </div>
    );
  }

  const sortableIds = models.map((m) => m.id);

  const grid = (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {models.map((model) => (
        <ModelCard
          key={model.id}
          model={model}
          onEditInfo={() => onEditInfo(model)}
          onToggleEnabled={(nextEnabled) => onToggleEnabled(model, nextEnabled)}
          toggleLoading={togglingModelId === model.id}
          dragDisabled={disableDrag}
        />
      ))}
    </div>
  );

  if (disableDrag) {
    return grid;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
        {grid}
      </SortableContext>
      <DragOverlay>
        {activeModel ? (
          <div className="pointer-events-none w-[min(100vw-2rem,26rem)]">
            <ModelCard
              model={activeModel}
              onEditInfo={() => undefined}
              onToggleEnabled={() => undefined}
              toggleLoading={false}
              dragOverlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default ResourceList;
