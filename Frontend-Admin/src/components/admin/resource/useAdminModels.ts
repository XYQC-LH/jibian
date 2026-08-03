'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@/lib/api';
import { ENABLE_MOCKS, mockAIModels } from '@/lib/mockData';
import type { AIModel } from '@/components/resource/types';
import {
  MODELS_PAGE_SIZE,
  computeModelStats,
  normalizeOrder,
  resolveStatus,
  sortModelsByOrder,
} from './resourceCenterShared';
import {
  assignSequentialModelOrders,
  buildModelReorderPayload,
  canReorderModelList,
} from './modelOrderUtils';
import { getErrorMessage, getErrorStatus, getErrorCode } from '@/lib/http/errors';

const normalizeModelPerformance = (model: AIModel): AIModel => ({
  ...model,
  performance: model?.performance
    ? {
        avg_processing_time: Number(model.performance.avg_processing_time) || 0,
        success_rate: Number(model.performance.success_rate) || 0,
        daily_usage: Number(model.performance.daily_usage) || 0,
        total_usage: Number(model.performance.total_usage) || 0,
      }
    : { avg_processing_time: 0, success_rate: 0, daily_usage: 0, total_usage: 0 },
});

const isResourceListModel = (model: AIModel): boolean => {
  const modelType = String((model.type || '')).trim().toLowerCase();
  return modelType !== 'llm' && modelType !== 'text';
};

export function useAdminModels(reloadKey: number) {
  const [models, setModels] = useState<AIModel[]>([]);
  const [modelsTotal, setModelsTotal] = useState(0);
  const [modelsPage, setModelsPage] = useState(1);
  const [modelsHasNext, setModelsHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [baseStatus, setBaseStatus] = useState<'healthy' | 'degraded' | 'unavailable'>('healthy');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingModel, setEditingModel] = useState<AIModel | null>(null);
  const [togglingModelId, setTogglingModelId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [searchTerm]);

  const hasActiveQuery = debouncedSearchTerm.length > 0;

  const fetchModelsPage = useCallback(async (page: number, modelTypes: string[]) => {
    const result = await apiClient.model.getAllModels({
      page,
      pageSize: MODELS_PAGE_SIZE,
      keyword: debouncedSearchTerm || undefined,
      modelTypes: modelTypes.length > 0 ? modelTypes : undefined,
      skipPricing: true,
    });

    return {
      items: (result.items as unknown as AIModel[]).map((model) => normalizeModelPerformance(model)),
      total: Number(result.total || 0),
      page: Number(result.page || page),
      totalPages: Math.max(Number(result.total_pages || 1), 1),
      hasNext: Boolean(result.has_next),
    };
  }, [debouncedSearchTerm]);

  const replaceModel = useCallback((updated: AIModel) => {
    setModels((prev) =>
      sortModelsByOrder(
        prev.map((m) => (m.id === updated.id ? normalizeModelPerformance(updated) : m))
      )
    );
  }, []);

  const requestEpochRef = useRef(0);

  // 各类型首屏加载完成的标记（用于 loading 状态）
  const firstPageArrivedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let isMounted = true;
    const epoch = ++requestEpochRef.current;

    const isCurrentEpoch = () => isMounted && requestEpochRef.current === epoch;

    const loadTypeFirstPages = async (type: string) => {
      try {
        const firstPage = await fetchModelsPage(1, [type]);
        if (!isCurrentEpoch()) return;

        // 累计各类型的 total（单类型直接设，多类型累加）
        setModelsTotal((prev) => prev + firstPage.total);

        setModels((prev) => {
          const merged = [...prev, ...firstPage.items];
          const unique = Array.from(new Map(merged.map((m) => [m.id, m])).values());
          return sortModelsByOrder(unique);
        });

        firstPageArrivedRef.current.add(type);
        if (firstPageArrivedRef.current.size >= typesToLoad.length) {
          setLoading(false);
        }

        // 后台加载该类型的剩余页
        if (firstPage.hasNext) {
          for (let page = 2; page <= firstPage.totalPages; page++) {
            if (!isCurrentEpoch()) break;
            try {
              const pageResult = await fetchModelsPage(page, [type]);
              if (!isCurrentEpoch()) break;
              setModels((prev) => {
                const merged = [...prev, ...pageResult.items];
                const unique = Array.from(new Map(merged.map((m) => [m.id, m])).values());
                return sortModelsByOrder(unique);
              });
            } catch (e: unknown) {              console.error("Operation in useAdminModels:", e);

              // 单页加载失败不影响其余页面
            }
          }
        }
      } catch (e: unknown) {        console.error("Operation in useAdminModels:", e);

        // 某类型加载失败不影响其他类型
        firstPageArrivedRef.current.add(type);
        if (firstPageArrivedRef.current.size >= typesToLoad.length) {
          setLoading(false);
        }
      }
    };

    const fetchModels = async () => {
      firstPageArrivedRef.current = new Set();

      try {
        setBaseStatus('healthy');

        // 各类型并行独立加载，互不阻塞
        typesToLoad.forEach((type) => {
          loadTypeFirstPages(type);
        });
      } catch (error: unknown) {
        if (!isCurrentEpoch()) return;
        console.error('Failed to load base data', error);
        setBaseStatus(resolveStatus(error));
        toast.error(getErrorMessage(error, '基础数据加载失败'));
        setModels([]);
        setModelsTotal(0);
        setModelsPage(1);
        setModelsHasNext(false);
        setLoading(false);
      }
    };

    const typesToLoad = ['image', 'video', 'music'];

    if (ENABLE_MOCKS) {
      setLoading(true);
      window.setTimeout(() => {
        const filtered = mockAIModels.filter((model) => {
          const matchesType = typesToLoad.includes(String(model.type));
          const keyword = debouncedSearchTerm.toLowerCase();
          const matchesKeyword = !keyword || [model.name, model.description, model.provider]
            .join(' ')
            .toLowerCase()
            .includes(keyword);
          return matchesType && matchesKeyword;
        });

        setBaseStatus('healthy');
        setModels(filtered);
        setModelsTotal(filtered.length);
        setModelsPage(1);
        setModelsHasNext(false);
        setLoading(false);
      }, 250);
      return () => { isMounted = false; };
    }

    setLoading(true);
    setModels([]);
    setModelsTotal(0);
    setModelsPage(1);
    fetchModels();
    return () => { isMounted = false; };
  }, [fetchModelsPage, reloadKey]);

  const loadMoreModels = useCallback(async () => {
    if (loading || loadingMore || !modelsHasNext) return;

    setLoadingMore(true);
    try {
      const nextPage = modelsPage + 1;
      const modelsResult = await apiClient.model.getAllModels({
        page: nextPage,
        pageSize: MODELS_PAGE_SIZE,
        keyword: debouncedSearchTerm || undefined,
      });
      const enhancedModels: AIModel[] = (modelsResult.items as unknown as AIModel[]).map((model) => normalizeModelPerformance(model));
      setModels((prev) => sortModelsByOrder([...prev, ...enhancedModels]));
      setModelsTotal(Number(modelsResult.total || 0));
      setModelsPage(Number(modelsResult.page || nextPage));
      setModelsHasNext(Boolean(modelsResult.has_next));
    } catch (error: unknown) {
      console.error('Load more models error:', error);
      toast.error(getErrorMessage(error, '加载更多模板失败'));
    } finally {
      setLoadingMore(false);
    }
  }, [debouncedSearchTerm, loading, loadingMore, modelsHasNext, modelsPage]);

  const updateModelOrder = useCallback(async (model: AIModel, newOrder: number) => {
    const normalizedScore = normalizeOrder(newOrder);
    try {
      const updated = await apiClient.model.updateModelConfig(model.id, { order: normalizedScore });
      setModels((prev) =>
        sortModelsByOrder(
          prev.map((m) =>
            m.id === model.id
              ? {
                  ...m,
                  order: normalizeOrder(((updated as unknown as Record<string, unknown>)?.order as number) ?? normalizedScore),
                }
              : m
          )
        )
      );
      toast.success(`模板 ${model.name} 排序已更新`);
    } catch (error: unknown) {
      console.error('Update model order error:', error);
      if (getErrorMessage(error, '').includes('503') || getErrorStatus(error) === 503) {
        toast.error('服务暂时不可用，请稍后重试');
      } else if (getErrorMessage(error, '').includes('Network Error') || getErrorCode(error) === 'NETWORK_ERROR') {
        toast.error('网络连接失败，请检查网络状态');
      } else {
        toast.error(getErrorMessage(error, '更新模板排序失败'));
      }
    }
  }, []);

  const reorderModels = useCallback(async (reorderedSubset: AIModel[]) => {
    if (!canReorderModelList(searchTerm)) {
      toast.error('搜索状态下无法拖拽排序');
      return;
    }

    if (reorderedSubset.length <= 0) {
      toast.error('拖拽排序失败，请刷新后重试');
      return;
    }

    const currentModelIds = new Set(models.map((item) => item.id));
    if (reorderedSubset.some((item) => !currentModelIds.has(item.id))) {
      toast.error('拖拽排序失败，请刷新后重试');
      return;
    }

    const previousModels = [...models];
    const nextModels = assignSequentialModelOrders(reorderedSubset);
    const nextPayload = buildModelReorderPayload(reorderedSubset);
    const nextOrderById = new Map(
      nextModels.map((item) => [
        item.id,
        normalizeOrder(item.order ?? 0),
      ])
    );
    setModels((prev) =>
      sortModelsByOrder(
        prev.map((item) => {
          const nextOrder = nextOrderById.get(item.id);
          return nextOrder === undefined
            ? item
            : { ...item, order: nextOrder };
        })
      )
    );

    try {
      await apiClient.model.reorderModels(nextPayload);
      toast.success('模板排序已更新');
    } catch (error: unknown) {
      console.error('Reorder error:', error);
      setModels(previousModels);
      if (getErrorMessage(error, '').includes('503') || getErrorStatus(error) === 503) {
        toast.error('服务暂时不可用，请稍后重试');
      } else if (getErrorMessage(error, '').includes('Network Error') || getErrorCode(error) === 'NETWORK_ERROR') {
        toast.error('网络连接失败，请检查网络状态');
      } else {
        toast.error(getErrorMessage(error, '更新模板排序失败'));
      }
    }
  }, [models, searchTerm]);

  const toggleModelEnabled = useCallback(async (model: AIModel, nextEnabled: boolean) => {
    const previousEnabled = model.is_enabled ?? model.is_active;
    setTogglingModelId(model.id);
    setModels((prev) =>
      prev.map((m) => {
        if (m.id !== model.id) return m;
        const runtimeActive = typeof m.status === 'string' ? m.status.toLowerCase() === 'active' : true;
        return { ...m, is_enabled: nextEnabled, is_active: nextEnabled && runtimeActive };
      })
    );
    try {
      const updated = await apiClient.model.updateModelConfig(model.id, { is_enabled: nextEnabled });
      setModels((prev) =>
        prev.map((m) =>
          m.id === model.id
            ? { ...m, is_enabled: updated.is_enabled, status: updated.status ?? m.status, is_active: updated.is_active }
            : m
        )
      );
      toast.success(nextEnabled ? '模板已上架' : '模板已下架');
    } catch (error: unknown) {
      setModels((prev) =>
        prev.map((m) => {
          if (m.id !== model.id) return m;
          const runtimeActive = typeof m.status === 'string' ? m.status.toLowerCase() === 'active' : true;
          return { ...m, is_enabled: previousEnabled, is_active: previousEnabled && runtimeActive };
        })
      );
      toast.error(getErrorMessage(error, '切换模板上架状态失败'));
    } finally {
      setTogglingModelId(null);
    }
  }, []);

  const filteredModels = useMemo(() => models.filter(model => {
    const keyword = searchTerm.toLowerCase();
    const matchesSearch = model.name.toLowerCase().includes(keyword) ||
                         model.id.toLowerCase().includes(keyword);
    if (!isResourceListModel(model)) return false;
    return matchesSearch;
  }), [models, searchTerm]);

  const canReorderModels = useMemo(
    () => canReorderModelList(searchTerm) && !modelsHasNext && !loadingMore,
    [loadingMore, modelsHasNext, searchTerm]
  );

  const stats = useMemo(() => computeModelStats(models), [models]);

  const handleEditModelSave = useCallback((updatedModel: AIModel) => {
    replaceModel(updatedModel);
    setShowEditModal(false);
    setEditingModel(null);
    toast.success('模板配置已更新');
  }, [replaceModel]);

  const deleteModel = useCallback(async (model: AIModel) => {
    try {
      await apiClient.template.deleteTemplate(model.id);
      setModels((prev) => prev.filter((m) => m.id !== model.id));
      setModelsTotal((prev) => Math.max(0, prev - 1));
      toast.success(`模板 ${model.name} 已删除`);
    } catch (error: unknown) {
      console.error('Delete template error:', error);
      toast.error(getErrorMessage(error, '删除模板失败'));
    }
  }, []);

  return {
    models, modelsTotal, modelsPage, modelsHasNext, loadingMore, loading, baseStatus, searchTerm,
    showEditModal, editingModel, togglingModelId,
    filteredModels, stats, canReorderModels,
    setSearchTerm, setShowEditModal, setEditingModel,
    updateModelOrder, toggleModelEnabled,
    handleEditModelSave, reorderModels, loadMoreModels, hasActiveQuery,
    deleteModel,
  };
}
