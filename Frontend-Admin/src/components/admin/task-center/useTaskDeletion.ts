import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'

import apiClient from '@/lib/api'
import type { UIMappedTask } from './types'

export type UseTaskDeletionReturn = {
  deleteDialogOpen: boolean
  deleteTarget: UIMappedTask | null
  requestDeleteTask: (task: UIMappedTask) => void
  closeDeleteDialog: () => void
  confirmDeleteTask: () => Promise<void>
}

export function useTaskDeletion(
  setRecentTasks: React.Dispatch<React.SetStateAction<UIMappedTask[]>>,
): UseTaskDeletionReturn {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<UIMappedTask | null>(null)

  const requestDeleteTask = useCallback((task: UIMappedTask) => {
    setDeleteTarget(task)
    setDeleteDialogOpen(true)
  }, [])

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false)
    setDeleteTarget(null)
  }, [])

  const confirmDeleteTask = useCallback(async () => {
    const target = deleteTarget
    if (!target) return

    const rawId = String(target.id || '').trim()
    const taskId = Number(rawId)
    if (!Number.isFinite(taskId) || taskId <= 0) {
      toast.error('任务 ID 无效，无法删除')
      closeDeleteDialog()
      return
    }

    try {
      await apiClient.task.deleteAdminTask(taskId)
      setRecentTasks((prev) =>
        prev.map((t) => (t.id === rawId ? { ...t, purgeError: null } : t)),
      )
      toast.success('已提交彻底删除，后台将继续清理任务与 OSS 产物')
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, '删除任务失败'))
    }
  }, [deleteTarget, closeDeleteDialog, setRecentTasks])

  return {
    deleteDialogOpen,
    deleteTarget,
    requestDeleteTask,
    closeDeleteDialog,
    confirmDeleteTask,
  }
}

import { getErrorMessage, getErrorStatus, getErrorCode } from '@/lib/http/errors';