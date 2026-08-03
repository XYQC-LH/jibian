'use client';

import React, { useState } from 'react';
import { GripVertical, Settings2, Tags } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TemplateCategory } from '@/lib/api-clients/clients/templateClient';

interface TemplateCategoryBarProps {
  categories: TemplateCategory[];
  loading: boolean;
  selectedCategoryName: string | null;
  categoryCounts: Record<string, number>;
  totalCount: number;
  onSelectCategory: (name: string | null) => void;
  onManage: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

type SortableChipProps = {
  category: TemplateCategory;
  selected: boolean;
  count: number;
  onClick: () => void;
  dragOverlay?: boolean;
};

const SortableChip: React.FC<SortableChipProps> = ({
  category,
  selected,
  count,
  onClick,
  dragOverlay = false,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: category.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={dragOverlay ? undefined : setNodeRef}
      style={style}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`group relative flex items-center gap-2 rounded-full border px-4 py-2 transition-colors ${
        dragOverlay
          ? 'rotate-[0.6deg] scale-[1.05] border-white/25 shadow-lg cursor-grabbing'
          : selected
            ? 'border-accent/50 bg-accent/15 text-accent'
            : 'border-white/10 bg-white/5 hover:border-white/25 cursor-pointer'
      }`}
      {...(dragOverlay ? {} : attributes)}
      {...(dragOverlay ? {} : listeners)}
    >
      <GripVertical
        size={14}
        className={`shrink-0 ${dragOverlay ? 'text-white/70' : 'text-text-muted/60'}`}
      />
      <span className={`text-sm font-medium ${selected ? 'text-accent' : 'text-text-primary'}`}>
        {category.name}
      </span>
      {category.display_name && category.display_name !== category.name ? (
        <span className={`text-xs ${selected ? 'text-accent/70' : 'text-text-muted'}`}>
          {category.display_name}
        </span>
      ) : null}
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
          selected ? 'bg-accent/25 text-accent' : 'bg-white/10 text-text-muted'
        }`}
      >
        {count}
      </span>
    </div>
  );
};

const TemplateCategoryBar: React.FC<TemplateCategoryBarProps> = ({
  categories,
  loading,
  selectedCategoryName,
  categoryCounts,
  totalCount,
  onSelectCategory,
  onManage,
  onReorder,
}) => {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const found = categories.find((item) => item.id === String(event.active.id));
    setActiveCategory(found ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCategory(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((item) => item.id === String(active.id));
    const newIndex = categories.findIndex((item) => item.id === String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(categories, oldIndex, newIndex);
    void onReorder(oldIndex, newIndex);
    void reordered;
  };

  return (
    <section className="flex items-center gap-2.5 flex-wrap p-4 mb-6 rounded-xl border border-white/10 bg-white/[0.03]">
      <span className="flex items-center gap-1.5 text-sm text-text-muted shrink-0 mr-1">
        <Tags size={15} className="text-accent" />
        模板分类
      </span>

      <button
        type="button"
        onClick={() => onSelectCategory(null)}
        className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors ${
          selectedCategoryName === null
            ? 'border-accent/50 bg-accent/15 text-accent'
            : 'border-white/10 bg-white/5 text-text-muted hover:border-white/25 hover:text-text-primary'
        }`}
      >
        全部
        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] leading-none text-text-muted">
          {totalCount}
        </span>
      </button>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveCategory(null)}
      >
        <SortableContext items={categories.map((item) => item.id)} strategy={rectSortingStrategy}>
          {categories.map((category) => (
            <SortableChip
              key={category.id}
              category={category}
              selected={selectedCategoryName === category.name}
              count={categoryCounts[category.name] ?? 0}
              onClick={() =>
                onSelectCategory(selectedCategoryName === category.name ? null : category.name)
              }
            />
          ))}
        </SortableContext>
        <DragOverlay>
          {activeCategory ? (
            <SortableChip
              category={activeCategory}
              selected={false}
              count={categoryCounts[activeCategory.name] ?? 0}
              onClick={() => undefined}
              dragOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {categories.length === 0 && !loading && (
        <span className="text-xs text-text-muted">暂无分类</span>
      )}

      <div className="flex items-center gap-2 ml-auto shrink-0">
        <button
          type="button"
          onClick={onManage}
          className="flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm text-text-muted hover:text-text-primary hover:border-white/40 transition-colors"
        >
          <Settings2 size={14} />
          模板管理
        </button>
      </div>
    </section>
  );
};

export default TemplateCategoryBar;
