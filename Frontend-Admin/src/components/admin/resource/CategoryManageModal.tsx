'use client';

import React, { useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/http/errors';
import type { TemplateCategory } from '@/lib/api-clients/clients/templateClient';

interface CategoryManageModalProps {
  categories: TemplateCategory[];
  onCreate: (name: string, displayName?: string, icon?: string) => Promise<unknown>;
  onUpdate: (id: string, input: { name?: string; display_name?: string; icon?: string }) => Promise<unknown>;
  onRemove: (id: string) => Promise<unknown>;
  onClose: () => void;
}

const CategoryManageModal: React.FC<CategoryManageModalProps> = ({
  categories,
  onCreate,
  onUpdate,
  onRemove,
  onClose,
}) => {
  const [newName, setNewName] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error('请输入主名称');
      return;
    }
    setBusy(true);
    try {
      await onCreate(name, newDisplayName.trim() || undefined, newIcon.trim() || undefined);
      setNewName('');
      setNewDisplayName('');
      setNewIcon('');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, '创建分类失败'));
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (category: TemplateCategory, name: string, displayName: string, icon: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('主名称不能为空');
      return;
    }
    setBusy(true);
    try {
      await onUpdate(category.id, {
        name: trimmedName,
        display_name: displayName.trim() || undefined,
        icon: icon.trim() || undefined,
      });
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card-primary max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-text-primary">模板管理</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary transition-colors"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 mb-6">
          {categories.map((category) => (
            <CategoryEditRow
              key={category.id}
              category={category}
              busy={busy}
              onSave={handleUpdate}
              onRemove={handleRemove}
            />
          ))}
          {categories.length === 0 && (
            <div className="text-center text-sm text-text-muted py-6">暂无分类，先添加一个</div>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Plus size={15} className="text-accent" />
            <span className="text-sm font-medium text-text-primary">新增分类</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              className="input-primary px-3 py-2 text-sm"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="主名称（短）"
              maxLength={32}
            />
            <input
              className="input-primary px-3 py-2 text-sm"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="副名称（长，展示用）"
              maxLength={80}
            />
            <input
              className="input-primary px-3 py-2 text-sm"
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              placeholder="图标（emoji）"
              maxLength={32}
            />
          </div>
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={busy}
            className="btn-primary mt-3 disabled:opacity-50"
          >
            <Plus size={15} className="mr-1" />
            添加
          </button>
        </div>
      </div>
    </div>
  );
};

type CategoryEditRowProps = {
  category: TemplateCategory;
  busy: boolean;
  onSave: (category: TemplateCategory, name: string, displayName: string, icon: string) => Promise<void>;
  onRemove: (category: TemplateCategory) => Promise<void>;
};

const CategoryEditRow: React.FC<CategoryEditRowProps> = ({
  category,
  busy,
  onSave,
  onRemove,
}) => {
  const [name, setName] = useState(category.name);
  const [displayName, setDisplayName] = useState(category.display_name);
  const [icon, setIcon] = useState(String(category.icon ?? ''));
  const [dirty, setDirty] = useState(false);

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.03]">
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          className="input-primary px-2.5 py-1.5 text-sm"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
          }}
          placeholder="主名称（短）"
          maxLength={32}
        />
        <input
          className="input-primary px-2.5 py-1.5 text-sm"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            setDirty(true);
          }}
          placeholder="副名称（长，展示用）"
          maxLength={80}
        />
        <input
          className="input-primary px-2.5 py-1.5 text-sm"
          value={icon}
          onChange={(e) => {
            setIcon(e.target.value);
            setDirty(true);
          }}
          placeholder="图标（emoji）"
          maxLength={32}
        />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => void onSave(category, name, displayName, icon)}
          disabled={busy || !dirty}
          className="p-1.5 text-accent hover:text-accent/80 transition-colors disabled:opacity-30"
          aria-label={`保存分类 ${category.name}`}
        >
          <Save size={15} />
        </button>
        <button
          type="button"
          onClick={() => void onRemove(category)}
          disabled={busy}
          className="p-1.5 text-text-muted hover:text-red-400 transition-colors disabled:opacity-40"
          aria-label={`删除分类 ${category.name}`}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
};

export default CategoryManageModal;
