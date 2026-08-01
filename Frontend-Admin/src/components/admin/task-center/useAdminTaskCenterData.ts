import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

import { useAdminAuth } from '@/lib/useAdminAuth'
import { isAdmin } from '@/lib/auth'

import { useTaskList } from './useTaskList'
import { useTaskStats } from './useTaskStats'
import { useTaskDetail } from './useTaskDetail'
import { useTaskDeletion } from './useTaskDeletion'
import type { ModelPerformanceItem, UIMappedTask } from './types'


export type AdminTaskCenterData = ReturnType<typeof useAdminTaskCenterData>

export const useAdminTaskCenterData = () => {
  const router = useRouter()
  const { user, loading: authLoading, isAuthenticated } = useAdminAuth()
  const isAuthorized = Boolean(isAuthenticated && user && isAdmin(user))

  const taskList = useTaskList(isAuthorized)
  const taskStats = useTaskStats(isAuthorized)
  const taskDetail = useTaskDetail(isAuthorized)
  const taskDeletion = useTaskDeletion(taskList.setRecentTasks)

  const [purgeErrors, setPurgeErrors] = useState<Record<string, string>>({})
  const purgeErrorsRef = useRef<Record<string, string>>({})

  useEffect(() => {
    purgeErrorsRef.current = purgeErrors
  }, [purgeErrors])

  // Redirect unauthorized users
  useEffect(() => {
    if (authLoading) return
    if (isAuthorized) return
    router.push('/')
  }, [authLoading, isAuthorized, router])

  // Sync purge errors to recent tasks on initial load
  useEffect(() => {
    taskList.setRecentTasks((prev) =>
      prev.map((t) => {
        const pe = purgeErrorsRef.current[t.id]
        if (pe && t.purgeError !== pe) return { ...t, purgeError: pe }
        return t
      }),
    )
  }, [taskList])

  // Compute model performance from recent tasks
  const buildModelPerformance = useCallback((tasks: UIMappedTask[]): ModelPerformanceItem[] => {
    const modelMap = new Map<string, { tasks: number; completed: number; totalSeconds: number; generating: number }>()
    tasks.forEach((t) => {
      const key = t.modelName || t.model || 'Unknown Model'
      if (!modelMap.has(key)) modelMap.set(key, { tasks: 0, completed: 0, totalSeconds: 0, generating: 0 })
      const agg = modelMap.get(key)!
      agg.tasks += 1
      if (t.status === 'succeeded') {
        agg.completed += 1
        const match = t.duration.match(/(?:(\d+)m)?\s*(\d+)s/)
        if (match) {
          agg.totalSeconds += (parseInt(match[1] || '0', 10)) * 60 + parseInt(match[2] || '0', 10)
        }
      }
      if (t.status === 'generating') agg.generating += 1
    })

    return Array.from(modelMap.entries()).map(([name, agg]) => ({
      name,
      tasks: agg.tasks,
      avgTime: agg.completed > 0 ? agg.totalSeconds / agg.completed : 0,
      successRate: agg.tasks > 0 ? (agg.completed / agg.tasks) * 100 : 0,
      load: agg.tasks > 0 ? Math.min(100, Math.round((agg.generating / agg.tasks) * 100)) : 0,
    }))
  }, [])

  const modelPerformance = useMemo(
    () => buildModelPerformance(taskList.recentTasks),
    [taskList.recentTasks, buildModelPerformance],
  )

  // Compute avg processing time from recent tasks
  const estimatedAvgProcessingTime = useMemo(() => {
    const completedTasks = taskList.recentTasks.filter(
      (t) => t.status === 'succeeded' && t.completedAt,
    )
    if (completedTasks.length === 0) return 0

    const totalSeconds = completedTasks.reduce((sum, t) => {
      try {
        const start = new Date(t.createdAt).getTime()
        const end = t.completedAt ? new Date(t.completedAt).getTime() : start
        return sum + Math.max(0, (end - start) / 1000)
      } catch (e: unknown) {        console.error("Operation in useAdminTaskCenterData:", e);

        return sum
      }
    }, 0)
    return totalSeconds / completedTasks.length
  }, [taskList.recentTasks])

  // Sync avgProcessingTime into taskStats
  useEffect(() => {
    taskStats.setTaskStats((prev) => {
      if (prev.avgProcessingTime === estimatedAvgProcessingTime) return prev
      return { ...prev, avgProcessingTime: estimatedAvgProcessingTime }
    })
  }, [estimatedAvgProcessingTime, taskStats])

  const handleQueueRefresh = useCallback(() => {
    taskList.fetchTasks()
    taskStats.fetchStats()
  }, [taskList, taskStats])

  return {
    authLoading,
    isAuthorized,

    // Task list
    filter: taskList.filter,
    setFilter: taskList.setFilter,
    searchTerm: taskList.searchTerm,
    setSearchTerm: taskList.setSearchTerm,
    recentTasksPage: taskList.recentTasksPage,
    setRecentTasksPage: taskList.setRecentTasksPage,
    loading: taskList.loading,
    tasksError: taskList.tasksError,
    recentTasks: taskList.recentTasks,
    tasksTotal: taskList.tasksTotal,
    tasksTotalPages: taskList.tasksTotalPages,
    tasksHasNext: taskList.tasksHasNext,
    tasksHasPrev: taskList.tasksHasPrev,

    // Stats
    taskStats: taskStats.taskStats,
    taskTrends: taskStats.taskTrends,
    modelPerformance,
    trendsLoading: taskStats.trendsLoading,
    trendsError: taskStats.trendsError,
    trendDays: taskStats.trendDays,
    setTrendDays: taskStats.setTrendDays,

    // Detail
    detailOpen: taskDetail.detailOpen,
    detailLoading: taskDetail.detailLoading,
    detailError: taskDetail.detailError,
    detailTask: taskDetail.detailTask,
    openTaskDetail: taskDetail.openTaskDetail,
    closeDetail: taskDetail.closeDetail,

    // Deletion
    deleteDialogOpen: taskDeletion.deleteDialogOpen,
    deleteTarget: taskDeletion.deleteTarget,
    requestDeleteTask: taskDeletion.requestDeleteTask,
    closeDeleteDialog: taskDeletion.closeDeleteDialog,
    confirmDeleteTask: taskDeletion.confirmDeleteTask,

    // Actions
    refreshStats: taskStats.fetchStats,
    handleQueueRefresh,
    queueRefreshing: taskList.loading || taskStats.trendsLoading,
  }
}
