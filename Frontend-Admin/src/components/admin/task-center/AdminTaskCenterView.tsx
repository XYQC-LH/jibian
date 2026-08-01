import React from 'react'
import {
  Activity,
  CheckCircle,
  RefreshCcw,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'

import ConfirmDialog from '@/components/ConfirmDialog'
import { TableSkeleton } from '@/components/ui/Skeleton'

import type { AdminTaskCenterData } from './useAdminTaskCenterData'
import TaskStatusCard from './TaskStatusCard'
import TaskRow from './TaskRow'
import TaskDetailModal from './TaskDetailModal'

type AdminTaskCenterViewProps = Omit<AdminTaskCenterData, 'authLoading' | 'isAuthorized'>

export default function AdminTaskCenterView({
  recentTasksPage,
  setRecentTasksPage,
  loading,
  tasksError,
  taskStats,
  recentTasks,
  tasksTotal,
  tasksTotalPages,
  tasksHasNext,
  tasksHasPrev,
  detailOpen,
  detailLoading,
  detailError,
  detailTask,
  deleteDialogOpen,
  deleteTarget,
  openTaskDetail,
  requestDeleteTask,
  closeDeleteDialog,
  confirmDeleteTask,
  closeDetail,
  handleQueueRefresh,
  queueRefreshing,
}: AdminTaskCenterViewProps) {
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const sentinel = loadMoreRef.current
    if (!sentinel) return
    if (!tasksHasNext || loading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setRecentTasksPage((page) => page + 1)
      },
      { rootMargin: '240px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loading, setRecentTasksPage, tasksHasNext])

  return (
    <div className="min-h-screen bg-background text-text-primary p-6">
      <div className="max-w-[1800px] mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                <RefreshCcw className="text-white w-6 h-6" />
              </div>
              生成任务
            </h1>
            <p className="text-text-muted">实时监控 · 任务管理 · 性能分析</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="btn-primary" onClick={handleQueueRefresh} disabled={queueRefreshing}>
              <RefreshCcw size={16} className={`mr-2 ${queueRefreshing ? 'animate-spin' : ''}`} />
              刷新队列
            </button>
          </div>
        </div>

        <section id="stats" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
          <TaskStatusCard
            title="总任务数"
            value={taskStats.total.toLocaleString()}
            color="border-purple-500/30"
            icon={Zap}
            subtitle="今日处理"
          />
          <TaskStatusCard
            title="已完成"
            value={taskStats.completed.toLocaleString()}
            color="border-green-500/30"
            icon={CheckCircle}
            trend={8.2}
          />
          <TaskStatusCard
            title="生成中"
            value={taskStats.generating}
            color="border-blue-500/30"
            icon={Activity}
            trend={-2.1}
          />
          <TaskStatusCard
            title="失败数"
            value={taskStats.failed}
            color="border-red-500/30"
            icon={XCircle}
          />
          <TaskStatusCard
            title="成功率"
            value={`${taskStats.successRate.toFixed(2)}%`}
            color="border-green-500/30"
            icon={TrendingUp}
            subtitle={`平均处理时间: ${taskStats.avgProcessingTime.toFixed(2)}s`}
          />
        </section>

        <section id="recent-tasks">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <h3 className="text-xl font-semibold text-text-primary admin-section-title">
              最近任务
            </h3>
          </div>

          {loading && recentTasks.length === 0 ? (
            <div className="py-4">
              <TableSkeleton rows={4} columns={4} />
            </div>
          ) : (
            <div className="space-y-4">
              {tasksError ? (
                <div className="flex items-center justify-center p-4 text-red-500 bg-red-50 rounded-lg">
                  加载任务数据失败: {tasksError}
                </div>
              ) : recentTasks.length === 0 ? (
                <div className="text-center text-text-muted text-sm py-8">
                  暂无匹配的任务记录
                </div>
              ) : (
                recentTasks.map((task) => (
                  <TaskRow key={task.id} task={task} onView={openTaskDetail} onDelete={requestDeleteTask} />
                ))
              )}

              {!loading && tasksTotal > 0 ? (
                <div className="pt-2 text-xs text-text-muted">
                  已加载 {recentTasks.length} / {tasksTotal} 条
                </div>
              ) : null}

              {recentTasks.length > 0 && tasksHasNext ? (
                <div
                  ref={loadMoreRef}
                  className="flex items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-4 text-xs text-text-muted"
                >
                  {loading ? '正在加载更多任务...' : '继续下滑，自动加载更多任务...'}
                </div>
              ) : null}
            </div>
          )}
        </section>

        <TaskDetailModal
          open={detailOpen}
          loading={detailLoading}
          error={detailError}
          task={detailTask}
          onClose={closeDetail}
        />

        <ConfirmDialog
          isOpen={Boolean(deleteDialogOpen && deleteTarget)}
          onClose={closeDeleteDialog}
          onConfirm={confirmDeleteTask}
          title={deleteTarget?.purgeError ? '重试彻底删除任务' : '彻底删除任务'}
          message={
            deleteTarget?.purgeError
              ? `上次删除失败：${String(deleteTarget.purgeError)}。重试将再次尝试取消任务并彻底删除（含 OSS 产物）。确认继续？`
              : deleteTarget && (deleteTarget.status === 'generating' || deleteTarget.status === 'pending')
              ? '该任务仍在进行中：删除将先取消任务，再执行彻底删除（含 OSS 产物）。确认继续？'
              : '该操作将彻底删除任务并清理 OSS 产物文件，且无法恢复。确认继续？'
          }
          confirmText={deleteTarget?.purgeError ? '重试删除' : '确认删除'}
          cancelText="取消"
          type="danger"
        />
      </div>
    </div>
  )
}
