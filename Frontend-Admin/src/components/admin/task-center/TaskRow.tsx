import React from 'react'
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Cpu,
  Eye,
  Image,
  Trash2,
  Video,
  XCircle,
} from 'lucide-react'

import type { UIMappedTask, DispatchAttemptItem } from './types'
import {
  formatAdminDateTime,
  formatModerationDecision,
} from './utils'

const moderationDecisionBadgeClass: Record<string, string> = {
  pass: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  block: 'text-yellow-300 bg-yellow-500/15 border-yellow-500/30',
  not_checked: 'text-slate-300 bg-slate-500/15 border-slate-500/30',
  unknown: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'succeeded':
      return {
        icon: CheckCircle,
        color: 'text-green-400',
        bg: 'bg-green-500/20',
        border: 'border-green-500/30',
        label: '已完成',
      }
    case 'generating':
      return {
        icon: Activity,
        color: 'text-blue-400',
        bg: 'bg-blue-500/20',
        border: 'border-blue-500/30',
        label: '生成中',
      }
    case 'failed':
      return {
        icon: XCircle,
        color: 'text-red-400',
        bg: 'bg-red-500/20',
        border: 'border-red-500/30',
        label: '失败',
      }
    default:
      return {
        icon: AlertCircle,
        color: 'text-gray-400',
        bg: 'bg-gray-500/20',
        border: 'border-gray-500/30',
        label: '未知',
      }
  }
}

export default function TaskRow({
  task,
  onView,
  onDelete,
}: {
  task: UIMappedTask
  onView: (taskId: string) => void
  onDelete: (task: UIMappedTask) => void
}) {
  const isModerationBlockedFailure =
    task.status === 'failed' &&
    (task.moderation.hasBlock || /content_filtered:\s*(input_blocked|output_blocked)/i.test(String(task.error || '')))
  const statusConfig = getStatusConfig(task.status)
  const errorMessageClassName = isModerationBlockedFailure
    ? 'mb-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-2 text-xs text-yellow-300'
    : 'mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-400'
  const StatusIcon = statusConfig.icon
  const TypeIcon = task.type === 'video' ? Video : task.type === 'image' ? Image : Cpu
  const typeLabel =
    task.type === 'video' ? '视频' : task.type === 'image' ? '图片' : task.type === 'audio' ? '音频' : '其他'
  const modelLabel = task.modelName || task.model
  const inputModeration = task.moderation.input
  const outputModeration = task.moderation.output

  const isPurgeFailed = Boolean(task.purgeError)

  return (
    <div className="card-secondary p-4 transition-all duration-200 hover:border-white/20">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="font-mono text-xs text-text-muted">{task.id}</div>

          <div
            className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${statusConfig.bg} ${statusConfig.border} ${statusConfig.color}`}
          >
            <StatusIcon className="h-3 w-3" />
            <span>{statusConfig.label}</span>
          </div>

          <div className="flex items-center gap-1 text-xs text-text-muted">
            <TypeIcon className="h-3 w-3" />
            <span>{typeLabel}</span>
          </div>

          <div
            className={`rounded-full border px-2 py-0.5 text-xs ${moderationDecisionBadgeClass[inputModeration.decision]}`}
            title={
              inputModeration.reason
                ? `输入审核：${inputModeration.reason}`
                : inputModeration.checked
                ? '输入审核已执行'
                : '输入审核未执行'
            }
          >
            输入{formatModerationDecision(inputModeration.decision)}
          </div>
          <div
            className={`rounded-full border px-2 py-0.5 text-xs ${moderationDecisionBadgeClass[outputModeration.decision]}`}
            title={
              outputModeration.reason
                ? `输出审核：${outputModeration.reason}`
                : outputModeration.checked
                ? '输出审核已执行'
                : '输出审核未执行'
            }
          >
            输出{formatModerationDecision(outputModeration.decision)}
          </div>

          {task.purgeError ? (
            <div
              className="rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-xs text-red-300"
              title={String(task.purgeError)}
            >
              删除失败
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-text-secondary">{modelLabel}</span>

            {task.attempts && task.attempts.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="rounded-full border border-purple-500/25 bg-purple-500/10 px-1.5 py-0.5 text-purple-300">
                  调度×{task.attempts.length}
                </span>
                {task.attempts.map((attempt, idx) => {
                  const status = attempt.status
                  const label = attempt.vendor || attempt.source_id || `#${attempt.attempt_no}`
                  const isSucceeded = status === 'succeeded'
                  const isFailed = status === 'failed'
                  let pillClass = 'border-yellow-500/30 bg-yellow-500/15 text-yellow-300'
                  let statusSymbol = '…'
                  if (isSucceeded) {
                    pillClass = 'border-green-500/30 bg-green-500/15 text-green-300'
                    statusSymbol = '✓'
                  } else if (isFailed) {
                    pillClass = 'border-red-500/30 bg-red-500/15 text-red-300'
                    statusSymbol = '✗'
                  }
                  return (
                    <React.Fragment key={attempt.attempt_no}>
                      {idx > 0 && <span className="text-text-muted">→</span>}
                      <span
                        className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 ${
                          isSucceeded ? 'ring-1 ring-green-500/40' : ''
                        } ${pillClass}`}
                        title={`第 ${attempt.attempt_no} 次调度${isSucceeded ? '（成功）' : isFailed ? '（失败）' : ''}`}
                      >
                        {statusSymbol} {label}
                      </span>
                    </React.Fragment>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="text-xs text-text-muted">{task.duration}</div>
      </div>


      {task.status === 'failed' && task.error && (
        <div className={errorMessageClassName}>{task.error}</div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-text-muted">用户：{task.user}</span>
          <span className="text-text-muted">费用：{task.cost} 积分</span>
          {task.completedAt && (
            <span className="text-text-muted">
              完成时间：{formatAdminDateTime(task.completedAt, '--', task.createdAt)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onView(task.id)}
            className="p-1 text-text-muted transition-colors hover:text-white"
            title="查看输入、输出和参数"
          >
            <Eye className="h-4 w-4" />
          </button>

          <button
            onClick={() => onDelete(task)}
            className="p-1 text-red-400 transition-colors hover:text-red-300"
            title={isPurgeFailed ? '重试彻底删除（包含 OSS 产物）' : '彻底删除任务（包含 OSS 产物）'}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
