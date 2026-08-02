'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@/lib/api';
import type { TemplateCategory } from '@/lib/api-clients/clients/templateClient';
import { getErrorMessage } from '@/lib/http/errors';

export function useAdminTemplateCategories() {
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const items = await apiClient.template.listCategories();
      setCategories(items);
    } catch (error: unknown) {
      console.error('Failed to fetch template categories:', error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const create = useCallback(async (name: string, displayName?: string) => {
    const created = await apiClient.template.createCategory({
      name,
      display_name: displayName || undefined,
    });
    setCategories((prev) => [...prev, created].sort((a, b) => a.sort_order - b.sort_order));
    toast.success('分类已创建');
    return created;
  }, []);

  const update = useCallback(async (id: string, input: { name?: string; display_name?: string }) => {
    const updated = await apiClient.template.updateCategory(id, input);
    setCategories((prev) => prev.map((item) => (item.id === id ? updated : item)));
    toast.success('分类已更新');
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await apiClient.template.deleteCategory(id);
    setCategories((prev) => prev.filter((item) => item.id !== id));
    toast.success('分类已删除');
  }, []);

  const move = useCallback(async (index: number, direction: -1 | 1) => {
    setCategories((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      const reordered = next.map((item, idx) => ({ ...item, sort_order: idx }));
      setCategories(reordered);
      void apiClient.template
        .reorderCategories(reordered.map((item, idx) => ({ id: item.id, order: idx })))
        .catch((error: unknown) => {
          toast.error(getErrorMessage(error, '分类排序保存失败'));
          void refetch();
        });
      return reordered;
    });
  }, [refetch]);

  return { categories, loading, refetch, create, update, remove, move };
}
