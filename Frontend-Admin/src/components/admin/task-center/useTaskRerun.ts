import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'

import apiClient from '@/lib/api'
import { getErrorMessage } from '@/lib/http/errors'
import type { UIMappedTask } from './types'

export type UseTaskRerunReturn = {
  rerunDialogOpen: boolean
  rerunTarget: UIMappedTask | null
  requestRerunTask: (task: UIMappedTask) => void
  closeRerunDialog: () => void
  confirmRerunTask: () => Promise<void>
}

export function useTaskRerun(
  setRecentTasks: React.Dispatch<React.SetStateAction<UIMappedTask[]>>,
  onRerunComplete: () => void,
): UseTaskRerunReturn {
  const [rerunDialogOpen, setRerunDialogOpen] = useState(false)
  const [rerunTarget, setRerunTarget] = useState<UIMappedTask | null>(null)

  const requestRerunTask = useCallback((task: UIMappedTask) => {
    setRerunTarget(task)
    setRerunDialogOpen(true)
  }, [])

  const closeRerunDialog = useCallback(() => {
    setRerunDialogOpen(false)
    setRerunTarget(null)
  }, [])

  const confirmRerunTask = useCallback(async () => {
    const target = rerunTarget
    if (!target) return

    const rawId = String(target.id || '').trim()
    if (!rawId) {
      toast.error('任务 ID 无效，无法重跑')
      closeRerunDialog()
      return
    }

    try {
      await apiClient.task.rerunAdminTask(rawId)
      setRecentTasks((prev) =>
        prev.map((task) =>
          task.id === rawId
            ? {
                ...task,
                status: 'generating',
                progress: 50,
                error: undefined,
              }
            : task,
        ),
      )
      toast.success('失败任务已重新入队')
      onRerunComplete()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, '重跑任务失败'))
    }
  }, [closeRerunDialog, onRerunComplete, rerunTarget, setRecentTasks])

  return {
    rerunDialogOpen,
    rerunTarget,
    requestRerunTask,
    closeRerunDialog,
    confirmRerunTask,
  }
}
