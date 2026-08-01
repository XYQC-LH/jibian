import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import apiClient from '@/lib/api'
import type { Task } from '@/lib/api-clients/types'

export type UseTaskDetailReturn = {
  detailOpen: boolean
  detailLoading: boolean
  detailError: string | null
  detailTask: Task | null
  detailTaskIdRef: React.MutableRefObject<string | null>
  openTaskDetail: (taskId: string) => void
  closeDetail: () => void
}

export function useTaskDetail(isAuthorized: boolean): UseTaskDetailReturn {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const detailTaskIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!detailOpen || !detailTask) {
      detailTaskIdRef.current = null
      return
    }
    detailTaskIdRef.current = String(detailTask?.id ?? '')
  }, [detailOpen, detailTask])

  const replaceTaskDetailQuery = useCallback(
    (taskId: string | null) => {
      const nextParams = new URLSearchParams(searchParams?.toString() || '')
      if (taskId) {
        nextParams.set('task_id', taskId)
      } else {
        nextParams.delete('task_id')
      }
      const nextQuery = nextParams.toString()
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const openTaskDetail = useCallback(
    async (taskId: string) => {
      const normalizedTaskId = String(taskId || '').trim()
      if (!normalizedTaskId) return

      replaceTaskDetailQuery(normalizedTaskId)
      setDetailOpen(true)
      setDetailLoading(true)
      setDetailError(null)
      setDetailTask(null)
      try {
        const detail = await apiClient.task.getAdminTask(normalizedTaskId)
        setDetailTask(detail)
      } catch (error: unknown) {
        setDetailError(getErrorMessage(error, '加载任务详情失败'))
      } finally {
        setDetailLoading(false)
      }
    },
    [replaceTaskDetailQuery],
  )

  useEffect(() => {
    if (!isAuthorized) return

    const requestedTaskId = String(searchParams?.get('task_id') || '').trim()
    if (!requestedTaskId) return
    if (detailTaskIdRef.current === requestedTaskId) return
    if (detailLoading) return

    void openTaskDetail(requestedTaskId)
  }, [detailLoading, isAuthorized, openTaskDetail, searchParams])

  const closeDetail = useCallback(() => {
    setDetailOpen(false)
    replaceTaskDetailQuery(null)
  }, [replaceTaskDetailQuery])

  return {
    detailOpen,
    detailLoading,
    detailError,
    detailTask,
    detailTaskIdRef,
    openTaskDetail,
    closeDetail,
  }
}

import { getErrorMessage, getErrorStatus, getErrorCode } from '@/lib/http/errors';