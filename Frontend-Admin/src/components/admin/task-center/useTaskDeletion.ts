import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'

import apiClient from '@/lib/api'
import { getErrorMessage } from '@/lib/http/errors'
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
    if (!rawId) {
      toast.error('任务 ID 无效，无法删除')
      closeDeleteDialog()
      return
    }

    try {
      await apiClient.task.deleteAdminTask(rawId)
      setRecentTasks((prev) => prev.filter((t) => t.id !== rawId))
      closeDeleteDialog()
      toast.success('已从任务中心移除，并同步隐藏用户作品')
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
