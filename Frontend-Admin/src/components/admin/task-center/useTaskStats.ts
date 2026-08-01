import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import apiClient from '@/lib/api'
import { ENABLE_MOCKS, mockTaskStats, mockTaskTrends } from '@/lib/mockData'
import type { ModelPerformanceItem, TaskStats, TrendPoint } from './types'

const initialTaskStats: TaskStats = {
  total: 0,
  completed: 0,
  failed: 0,
  generating: 0,
  pending: 0,
  avgProcessingTime: 0,
  successRate: 0,
}

export type UseTaskStatsReturn = {
  taskStats: TaskStats
  taskTrends: TrendPoint[]
  modelPerformance: ModelPerformanceItem[]
  trendsLoading: boolean
  trendsError: string | null
  trendDays: 7 | 30
  setTrendDays: React.Dispatch<React.SetStateAction<7 | 30>>
  setTaskStats: React.Dispatch<React.SetStateAction<TaskStats>>
  setModelPerformance: React.Dispatch<React.SetStateAction<ModelPerformanceItem[]>>
  fetchStats: () => Promise<void>
}

export function useTaskStats(isAuthorized: boolean): UseTaskStatsReturn {
  const [taskStats, setTaskStats] = useState<TaskStats>(initialTaskStats)
  const [taskTrends, setTaskTrends] = useState<TrendPoint[]>([])
  const [modelPerformance, setModelPerformance] = useState<ModelPerformanceItem[]>([])
  const [trendsLoading, setTrendsLoading] = useState(false)
  const [trendsError, setTrendsError] = useState<string | null>(null)
  const [trendDays, setTrendDays] = useState<7 | 30>(7)

  const fetchStats = useCallback(async () => {
    if (!isAuthorized) return
    setTrendsLoading(true)
    setTrendsError(null)
    if (ENABLE_MOCKS) {
      window.setTimeout(() => {
        setTaskStats(mockTaskStats)
        setTaskTrends(trendDays === 7 ? mockTaskTrends.slice(-7) : mockTaskTrends)
        setTrendsLoading(false)
      }, 200)
      return
    }

    try {
      const stats = await apiClient.finance.getStatistics(trendDays)

      if (stats?.tasks) {
        const tasksData = stats.tasks as Record<string, unknown>
        const total = Number(tasksData.total ?? 0)
        const completed = Number(tasksData.completed ?? 0)
        const failed = Number(tasksData.failed ?? 0)
        const generating = Number(tasksData.generating ?? 0)
        const pending = Number(tasksData.pending ?? 0)
        const denominator = completed + failed
        const successRate = denominator > 0 ? (completed / denominator) * 100 : 0

        setTaskStats((prev) => ({ ...prev, total, completed, failed, generating, pending, successRate }))
      }

      if (Array.isArray(stats?.trends)) {
        setTaskTrends(
          (stats.trends as Record<string, unknown>[])
            .slice()
            .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
            .map((d) => ({
              time: String(d.date ?? ''),
              completed: Number(d.tasks_completed ?? 0),
              failed: Number(d.tasks_failed_primary ?? d.tasks_failed ?? 0),
              new: Number(d.tasks ?? 0),
              otherFailed: Number(d.tasks_other_failed ?? d.tasks_blocked ?? 0),
            })),
        )
      } else {
        setTaskTrends([])
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error, '加载统计数据失败')
      setTrendsError(message)
      toast.error(message)
    } finally {
      setTrendsLoading(false)
    }
  }, [isAuthorized, trendDays])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return {
    taskStats,
    taskTrends,
    modelPerformance,
    trendsLoading,
    trendsError,
    trendDays,
    setTrendDays,
    setTaskStats,
    setModelPerformance,
    fetchStats,
  }
}

import { getErrorMessage, getErrorStatus, getErrorCode } from '@/lib/http/errors';
