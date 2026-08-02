import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'

import apiClient from '@/lib/api'
import { ENABLE_MOCKS, mockAdminTasks } from '@/lib/mockData'
import { normalizeTaskStatus } from '@/domain/tasks/status'
import type { BackendTaskStatusFilter, ModelPerformanceItem, UIMappedTask } from './types'
import { resolveAdminTaskUserDisplay, resolveTaskModerationSummary } from './utils'

const RECENT_TASKS_PAGE_SIZE = 10

export type UseTaskListReturn = {
  filter: BackendTaskStatusFilter
  setFilter: React.Dispatch<React.SetStateAction<BackendTaskStatusFilter>>
  searchTerm: string
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>
  recentTasksPage: number
  setRecentTasksPage: React.Dispatch<React.SetStateAction<number>>
  loading: boolean
  tasksError: string | null
  recentTasks: UIMappedTask[]
  setRecentTasks: React.Dispatch<React.SetStateAction<UIMappedTask[]>>
  tasksTotal: number
  tasksTotalPages: number
  tasksHasNext: boolean
  tasksHasPrev: boolean
  fetchTasks: () => Promise<void>
}

export function useTaskList(isAuthorized: boolean): UseTaskListReturn {
  const [filter, setFilter] = useState<BackendTaskStatusFilter>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [recentTasksPage, setRecentTasksPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [tasksError, setTasksError] = useState<string | null>(null)
  const [recentTasks, setRecentTasks] = useState<UIMappedTask[]>([])
  const [tasksTotal, setTasksTotal] = useState(0)
  const [tasksTotalPages, setTasksTotalPages] = useState(1)
  const [tasksHasNext, setTasksHasNext] = useState(false)
  const [tasksHasPrev, setTasksHasPrev] = useState(false)

  const fetchTasks = useCallback(async () => {
    if (!isAuthorized) return
    setLoading(true)
    setTasksError(null)
    if (ENABLE_MOCKS) {
      window.setTimeout(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase()
        const filteredTasks = mockAdminTasks.filter((task) => {
          const matchesStatus = filter === 'all' || task.status === filter
          const matchesSearch = !normalizedSearch || [task.id, task.model, task.user]
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch)
          return matchesStatus && matchesSearch
        })

        setRecentTasks(filteredTasks)
        setTasksTotal(filteredTasks.length)
        setTasksTotalPages(1)
        setTasksHasNext(false)
        setTasksHasPrev(false)
        setLoading(false)
      }, 200)
      return
    }

    try {
      const statusParam = filter === 'all' ? undefined : filter === 'generating' ? 'running' : filter
      const searchValue = searchTerm.trim() || undefined
      const tasksPage = await apiClient.task.getAdminTasks(
        recentTasksPage,
        RECENT_TASKS_PAGE_SIZE,
        statusParam,
        searchValue,
        searchValue,
      )

      setTasksTotal(tasksPage.total)
      setTasksTotalPages(tasksPage.total_pages)
      setTasksHasNext(tasksPage.has_next)
      setTasksHasPrev(tasksPage.has_prev)

      const uiTasks: UIMappedTask[] = (tasksPage.items || []).map((t): UIMappedTask => {
        const createdAt = t.created_at
        const completedAt = t.finished_at

        let duration = '-'
        if (createdAt && completedAt) {
          try {
            const start = new Date(createdAt).getTime()
            const end = new Date(completedAt).getTime()
            const seconds = Math.max(0, (end - start) / 1000)
            duration = seconds >= 60
              ? `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`
              : `${Math.floor(seconds)}s`
          } catch (e: unknown) {            console.error("Operation in useTaskList:", e);

            duration = '-'
          }
        }

        const normalizedStatus = normalizeTaskStatus(t.status)
        const progress =
          typeof t.progress === 'number'
            ? t.progress
            : normalizedStatus === 'succeeded'
              ? 100
              : 0
        const tRecord = t as unknown as Record<string, unknown>;
        const progressDetail = typeof tRecord.progress_detail === 'object' && tRecord.progress_detail ? tRecord.progress_detail as Record<string, unknown> | null : null
        const etaSeconds = progressDetail?.eta_seconds != null ? Number(progressDetail.eta_seconds) : undefined

        const displayModel = t.model_id || t.operation || '-'
        const outputType = String(t.type || 'image').toLowerCase()
        const normalizedType: UIMappedTask['type'] =
          outputType === 'video' ? 'video' : outputType === 'audio' ? 'audio' : outputType === 'other' ? 'other' : 'image'

        return {
          id: t.id.toString(),
          type: normalizedType,
          model: displayModel,
          modelName: t.model_id ?? undefined,
          vendor: String(t.vendor || '').trim() || null,
          sourceId: String(t.source_id || '').trim() || null,
          attempts: Array.isArray(t.attempts) ? t.attempts.map((a) => {
            const ar = a as unknown as Record<string, unknown>;
            return {
              attempt_no: Number(ar.attempt_no ?? 1),
              status: String(ar.status || '').trim().toLowerCase() || 'failed',
              source_id: String(ar.source_id || '').trim() || null,
              vendor: String(ar.vendor || '').trim() || null,
            };
          }) : null,
          taskClass: 'base' as UIMappedTask['taskClass'],
          user: resolveAdminTaskUserDisplay(t),
          status: normalizedStatus,
          progress,
          etaSeconds,
          duration,
          cost: Math.max(0, Number(t.credits_consumed ?? 0)),
          createdAt: createdAt ?? '',
          completedAt,
          moderation: resolveTaskModerationSummary(t as unknown as Record<string, unknown>),
          purgeError: null,
          error: t.error_message,
        }
      })

      setRecentTasks((prev) => {
        if (recentTasksPage <= 1) return uiTasks
        const merged = new Map<string, UIMappedTask>()
        prev.forEach((item) => merged.set(item.id, item))
        uiTasks.forEach((item) => merged.set(item.id, item))
        return Array.from(merged.values())
      })
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, '加载任务数据失败'))
      setTasksError(getErrorMessage(error, '加载任务数据失败'))
      if (recentTasksPage <= 1) {
        setRecentTasks([])
        setTasksTotal(0)
        setTasksTotalPages(1)
        setTasksHasNext(false)
        setTasksHasPrev(false)
      }
    } finally {
      setLoading(false)
    }
  }, [filter, isAuthorized, recentTasksPage, searchTerm])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  return {
    filter,
    setFilter,
    searchTerm,
    setSearchTerm,
    recentTasksPage,
    setRecentTasksPage,
    loading,
    tasksError,
    recentTasks,
    setRecentTasks,
    tasksTotal,
    tasksTotalPages,
    tasksHasNext,
    tasksHasPrev,
    fetchTasks,
  }
}

import { getErrorMessage, getErrorStatus, getErrorCode } from '@/lib/http/errors';
