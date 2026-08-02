'use client';

import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Tags, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/http/errors';
import type { TemplateCategory } from '@/lib/api-clients/clients/templateClient';

interface TemplateCategoryBarProps {
  categories: TemplateCategory[];
  loading: boolean;
  onCreate: (name: string, displayName?: string) => Promise<unknown>;
  onUpdate: (id: string, input: { name?: string; display_name?: string }) => Promise<unknown>;
  onRemove: (id: string) => Promise<unknown>;
  onMove: (index: number, direction: -1 | 1) => void;
}

const TemplateCategoryBar: React.FC<TemplateCategoryBarProps> = ({
  categories,
  loading,
  onCreate,
  onUpdate,
  onRemove,
  onMove,
}) => {
  const [newName, setNewName] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [busy, setBusy] = useState(false);

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

  return (
    <section className="card-primary p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Tags size={16} className="text-accent" />
          <h3 className="text-sm font-semibold text-text-primary">模板分类</h3>
          <span className="text-xs text-text-muted">短名称用于模板标识，长名称用于展示；支持排序</span>
        </div>
      </div>

      <div className="space-y-2">
        {categories.map((category, index) => (
          <div
            key={category.id}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03]"
          >
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => onMove(index, -1)}
                disabled={index === 0 || busy}
                className="p-0.5 text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
                aria-label="上移"
              >
                <ArrowUp size={13} />
              </button>
              <button
                type="button"
                onClick={() => onMove(index, 1)}
                disabled={index === categories.length - 1 || busy}
                className="p-0.5 text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
                aria-label="下移"
              >
                <ArrowDown size={13} />
              </button>
            </div>

            {editingId === category.id ? (
              <div className="flex flex-1 flex-col sm:flex-row gap-2">
                <input
                  className="input-primary px-2 py-1 text-sm flex-1"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="短名称"
                  maxLength={32}
                />
                <input
                  className="input-primary px-2 py-1 text-sm flex-1"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="长名称（展示用）"
                  maxLength={80}
                />
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(category)}
                    disabled={busy}
                    className="px-3 py-1 text-xs rounded-lg bg-accent/20 text-accent border border-accent/40 hover:bg-accent/30 transition-colors disabled:opacity-50"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1 text-xs rounded-lg bg-white/5 text-text-muted border border-white/10 hover:text-text-primary transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-text-primary">{category.name}</span>
                  <span className="text-xs text-text-muted ml-2 truncate">
                    {category.display_name !== category.name ? category.display_name : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(category)}
                    className="p-1.5 text-text-muted hover:text-text-primary transition-colors"
                    aria-label={`编辑分类 ${category.name}`}
                  >
                    <Plus size={14} className="rotate-45" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(category)}
                    disabled={busy}
                    className="p-1.5 text-text-muted hover:text-red-400 transition-colors disabled:opacity-40"
                    aria-label={`删除分类 ${category.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {categories.length === 0 && !loading && (
          <div className="text-center text-sm text-text-muted py-4">暂无分类，先添加一个</div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <input
            className="input-primary px-3 py-1.5 text-sm flex-1"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="新分类短名称"
            maxLength={32}
          />
          <input
            className="input-primary px-3 py-1.5 text-sm flex-1"
            value={newDisplayName}
            onChange={(e) => setNewDisplayName(e.target.value)}
            placeholder="长名称（展示用，可留空）"
            maxLength={80}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={busy || adding}
            className="btn-secondary border border-white/10 shrink-0"
          >
            <Plus size={14} className="mr-1" />
            添加分类
          </button>
        </div>
      </div>
    </section>
  );
};

export default TemplateCategoryBar;
