'use client';

import React, { useState } from 'react';
import { GripVertical, Pencil, Plus, Tags, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
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
import { getErrorMessage } from '@/lib/http/errors';
import type { TemplateCategory } from '@/lib/api-clients/clients/templateClient';

interface TemplateCategoryBarProps {
  categories: TemplateCategory[];
  loading: boolean;
  selectedCategoryName?: string | null;
  categoryCounts?: Record<string, number>;
  totalCount?: number;
  onSelectCategory?: (name: string | null) => void;
  onCreate: (name: string, displayName?: string) => Promise<unknown>;
  onUpdate: (id: string, input: { name?: string; display_name?: string }) => Promise<unknown>;
  onRemove: (id: string) => Promise<unknown>;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

type SortableChipProps = {
  category: TemplateCategory;
  index: number;
  total: number;
  busy: boolean;
  selected: boolean;
  count?: number;
  onSelect?: (category: TemplateCategory) => void;
  onStartEdit: (category: TemplateCategory) => void;
  onRemove: (category: TemplateCategory) => void;
  dragOverlay?: boolean;
};

const SortableChip: React.FC<SortableChipProps> = ({
  category,
  busy,
  selected,
  count,
  onSelect,
  onStartEdit,
  onRemove,
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
      role="button"
      tabIndex={dragOverlay ? -1 : 0}
      onClick={() => onSelect?.(category)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect?.(category);
        }
      }}
      className={`group relative flex items-center gap-2 rounded-full border px-4 py-2 transition-colors ${
        dragOverlay
          ? 'rotate-[0.6deg] scale-[1.05] border-white/25 bg-white/10 shadow-lg cursor-grabbing'
          : selected
            ? 'border-accent/50 bg-accent/15 text-text-primary shadow-[0_0_0_1px_rgba(168,85,247,0.15)] cursor-pointer'
            : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/[0.08] cursor-pointer'
      }`}
    >
      <span
        className={`shrink-0 touch-none ${dragOverlay ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing'}`}
        onClick={(event) => event.stopPropagation()}
        {...(dragOverlay ? {} : attributes)}
        {...(dragOverlay ? {} : listeners)}
      >
        <GripVertical size={14} className={selected ? 'text-accent' : 'text-text-muted/60'} />
      </span>
      <span className="text-sm font-medium text-text-primary">{category.name}</span>
      {category.display_name && category.display_name !== category.name ? (
        <span className="text-xs text-text-muted">{category.display_name}</span>
      ) : null}
      {typeof count === 'number' ? (
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
          selected ? 'bg-accent/25 text-purple-100' : 'bg-white/10 text-text-muted'
        }`}>
          {count}
        </span>
      ) : null}
      <span
        className="hidden group-hover:flex items-center gap-0.5 ml-0.5"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onStartEdit(category)}
          className="p-1 text-text-muted hover:text-accent transition-colors"
          aria-label={`编辑分类 ${category.name}`}
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          onClick={() => onRemove(category)}
          disabled={busy}
          className="p-1 text-text-muted hover:text-red-400 transition-colors disabled:opacity-40"
          aria-label={`删除分类 ${category.name}`}
        >
          <Trash2 size={13} />
        </button>
      </span>
    </div>
  );
};

const TemplateCategoryBar: React.FC<TemplateCategoryBarProps> = ({
  categories,
  loading,
  selectedCategoryName = null,
  categoryCounts = {},
  totalCount = 0,
  onSelectCategory,
  onCreate,
  onUpdate,
  onRemove,
  onReorder,
}) => {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    })
  );

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error('请输入分类短名称');
      return;
    }
    setBusy(true);
    try {
      await onCreate(name, newDisplayName.trim() || undefined);
      setNewName('');
      setNewDisplayName('');
      setAdding(false);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, '创建分类失败'));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (category: TemplateCategory) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditDisplayName(category.display_name);
  };

  const handleSaveEdit = async (category: TemplateCategory) => {
    const name = editName.trim();
    if (!name) {
      toast.error('分类短名称不能为空');
      return;
    }
    setBusy(true);
    try {
      await onUpdate(category.id, {
        name,
        display_name: editDisplayName.trim() || undefined,
      });
      setEditingId(null);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, '保存分类失败'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (category: TemplateCategory) => {
    setBusy(true);
    try {
      await onRemove(category.id);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, '删除分类失败'));
    } finally {
      setBusy(false);
    }
  };

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

      {onSelectCategory ? (
        <button
          type="button"
          onClick={() => onSelectCategory(null)}
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            selectedCategoryName
              ? 'border-white/10 bg-white/5 text-text-muted hover:border-white/25 hover:text-text-primary'
              : 'border-accent/50 bg-accent/15 text-text-primary shadow-[0_0_0_1px_rgba(168,85,247,0.15)]'
          }`}
        >
          全部
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
            selectedCategoryName ? 'bg-white/10 text-text-muted' : 'bg-accent/25 text-purple-100'
          }`}>
            {totalCount}
          </span>
        </button>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveCategory(null)}
      >
        <SortableContext items={categories.map((item) => item.id)} strategy={rectSortingStrategy}>
          {categories.map((category, index) =>
            editingId === category.id ? (
              <div key={category.id} className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2 py-1">
                <input
                  className="input-primary px-2 py-0.5 text-xs w-24"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="短名称"
                  maxLength={32}
                />
                <input
                  className="input-primary px-2 py-0.5 text-xs w-32"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="长名称"
                  maxLength={80}
                />
                <button
                  type="button"
                  onClick={() => handleSaveEdit(category)}
                  disabled={busy}
                  className="p-1 text-accent hover:text-accent/80 transition-colors disabled:opacity-50"
                  aria-label="保存"
                >
                  <Plus size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="p-1 text-text-muted hover:text-text-primary transition-colors"
                  aria-label="取消"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <SortableChip
                key={category.id}
                category={category}
                index={index}
                total={categories.length}
                busy={busy}
                selected={selectedCategoryName === category.name}
                count={categoryCounts[category.name] || 0}
                onSelect={onSelectCategory ? () => onSelectCategory(category.name) : undefined}
                onStartEdit={startEdit}
                onRemove={handleRemove}
              />
            )
          )}
        </SortableContext>
        <DragOverlay>
          {activeCategory ? (
            <SortableChip
              category={activeCategory}
              index={0}
              total={1}
              busy={false}
              selected={selectedCategoryName === activeCategory.name}
              count={categoryCounts[activeCategory.name] || 0}
              onSelect={undefined}
              onStartEdit={startEdit}
              onRemove={handleRemove}
              dragOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {categories.length === 0 && !loading && (
        <span className="text-xs text-text-muted">暂无分类</span>
      )}

      {adding ? (
        <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2 py-1">
          <input
            className="input-primary px-2 py-0.5 text-xs w-24"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="短名称"
            maxLength={32}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleAdd();
            }}
          />
          <input
            className="input-primary px-2 py-0.5 text-xs w-32"
            value={newDisplayName}
            onChange={(e) => setNewDisplayName(e.target.value)}
            placeholder="长名称（可选）"
            maxLength={80}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleAdd();
            }}
          />
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={busy}
            className="p-1 text-accent hover:text-accent/80 transition-colors disabled:opacity-50"
            aria-label="确认添加"
          >
            <Plus size={13} />
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="p-1 text-text-muted hover:text-text-primary transition-colors"
            aria-label="取消添加"
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-full border border-dashed border-white/20 px-4 py-2 text-sm text-text-muted hover:text-text-primary hover:border-white/40 transition-colors"
        >
          <Plus size={14} />
          添加分类
        </button>
      )}
    </section>
  );
};

export default TemplateCategoryBar;
