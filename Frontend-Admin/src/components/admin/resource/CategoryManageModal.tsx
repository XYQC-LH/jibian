'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';

import {
  getTemplateCategories,
  saveTemplateCategories,
} from '@/lib/templateCategories';

type CategoryManageModalProps = {
  onClose: () => void;
  onChanged: () => void;
};

const CategoryManageModal: React.FC<CategoryManageModalProps> = ({ onClose, onChanged }) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCategories(getTemplateCategories());
  }, []);

  const handleAdd = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) {
      toast.error('请输入分类名称');
      return;
    }
    if (categories.includes(trimmed)) {
      toast.error('该分类已存在');
      return;
    }
    setCategories((prev) => [...prev, trimmed]);
    setNewCategory('');
  };

  const handleRemove = (category: string) => {
    setCategories((prev) => prev.filter((item) => item !== category));
  };

  const handleSave = () => {
    if (categories.length === 0) {
      toast.error('至少保留一个分类');
      return;
    }
    setSaving(true);
    try {
      saveTemplateCategories(categories);
      toast.success('分类已保存');
      onChanged();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card-primary max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
        <h3 className="text-xl font-bold text-text-primary mb-2">分类管理</h3>
        <p className="text-sm text-text-muted mb-6">
          管理"添加模板"时可选的分类，删除不影响已创建的模板
        </p>

        <div className="flex gap-2 mb-4">
          <input
            className="input-primary flex-1"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="输入新分类名称"
            maxLength={20}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
          />
          <button className="btn-secondary border border-white/10" onClick={handleAdd}>
            <Plus size={16} className="mr-1" />
            添加
          </button>
        </div>

        <div className="space-y-2">
          {categories.map((category) => (
            <div
              key={category}
              className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.03]"
            >
              <span className="text-sm text-text-primary">{category}</span>
              <button
                type="button"
                onClick={() => handleRemove(category)}
                className="p-1.5 text-text-muted hover:text-red-400 transition-colors"
                aria-label={`删除分类 ${category}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="text-center text-sm text-text-muted py-6">暂无分类</div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            <Save size={16} className="mr-2" />
            保存
          </button>
          <button
            onClick={onClose}
            className="btn-secondary flex-1 border border-white/10"
            disabled={saving}
          >
            <X size={16} className="mr-2" />
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoryManageModal;
