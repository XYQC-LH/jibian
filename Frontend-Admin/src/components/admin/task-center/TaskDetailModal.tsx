import React from 'react'
import { Copy, Check } from 'lucide-react'

import type { Task } from '@/lib/api-clients/types'
import {
  formatAdminDateTime,
  resolveAdminTaskUserDisplay,
  safeJsonStringify,
} from './utils'
import { collectTaskResultLinks, type TaskResultKind, type TaskResultLink } from './taskResultLinks'

type TaskDetailModalProps = {
  open: boolean
  loading: boolean
  error: string | null
  task: Task | null | undefined
  onClose: () => void
}

type ResolvedAssetLinkPayload = {
  url?: string
}

type ResolvedPreviewLinkState = {
  error: string | null
  loading: boolean
  url: string | null
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (e: unknown) {      console.error("Operation in TaskDetailModal:", e);

      // ignore
    }
  }

  return (
    <button onClick={handleCopy} className="ml-auto text-text-muted transition-colors hover:text-text-primary" title="复制">
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function formatDateTime(value: unknown): string {
  if (!value) return '--'
  return formatAdminDateTime(value as string | number | Date, '--')
}

function buildAdminAssetResolveLink(assetId: string, download: boolean): string {
  const query = download ? '?download=true' : ''
  return `/api/v1/admin/assets/${encodeURIComponent(assetId)}/resolve-link${query}`
}

/** 从 URL 中提取文件扩展名（不含 dot） */
function extractUrlExtension(url: string): string {
  return url.split('?')[0].split('#')[0].trim().toLowerCase().match(/\.([a-z0-9]+)$/i)?.[1] || ''
}

/** 当 item.kind 无法确定时，用解析后的 previewUrl 重新检测媒体类型 */
function reDetectKindFromResolvedUrl(previewUrl: string): TaskResultKind {
  const ext = extractUrlExtension(previewUrl)
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(ext)) return 'image'
  if (['mp4', 'webm', 'mov', 'm4v', 'ogg'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'm4a', 'aac', 'flac', 'oga', 'ogg'].includes(ext)) return 'audio'
  if (ext === 'pdf') return 'pdf'
  return 'unknown'
}

function renderTaskResultPreview(
  item: TaskResultLink,
  resolvedLink: ResolvedPreviewLinkState | undefined,
) {
  if (resolvedLink?.loading) {
    return <div className="text-xs text-text-muted">正在加载预览...</div>
  }

  if (resolvedLink?.error) {
    return <div className="text-xs text-red-300">{resolvedLink.error}</div>
  }

  const previewUrl = String(resolvedLink?.url || '').trim()
  if (!previewUrl) {
    return <div className="text-xs text-text-muted">暂无可预览结果</div>
  }

  // 当同步阶段无法推断类型时，用已解析的 previewUrl 的扩展名重新检测
  const effectiveKind = item.kind !== 'unknown' ? item.kind : reDetectKindFromResolvedUrl(previewUrl)

  if (effectiveKind === 'image') {
    return (
      <img
        src={previewUrl}
        alt={item.displayName}
        loading="lazy"
        className="max-h-[28rem] w-full rounded-md border border-white/10 bg-black/20 object-contain"
      />
    )
  }

  if (effectiveKind === 'video') {
    return <video src={previewUrl} controls className="max-h-[28rem] w-full rounded-md border border-white/10 bg-black" />
  }

  if (effectiveKind === 'audio') {
    return (
      <div className="rounded-md border border-white/10 bg-black/20 p-3">
        <audio src={previewUrl} controls className="w-full" />
      </div>
    )
  }

  if (effectiveKind === 'pdf') {
    return <iframe src={previewUrl} title={item.displayName} className="h-[32rem] w-full rounded-md border border-white/10 bg-white" />
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-text-muted">当前类型暂不支持内嵌预览</div>
      <a className="break-all text-xs text-blue-300 hover:underline" href={previewUrl} target="_blank" rel="noreferrer">
        查看原文件
      </a>
    </div>
  )
}

export default function TaskDetailModal({ open, loading, error, task, onClose }: TaskDetailModalProps) {
  const [resolvedPreviewLinks, setResolvedPreviewLinks] = React.useState<Record<string, ResolvedPreviewLinkState>>({})

  const resultLinks = React.useMemo(() => collectTaskResultLinks(task as unknown as Record<string, unknown>), [task])

  React.useEffect(() => {
    if (!open) {
      setResolvedPreviewLinks({})
      return
    }

    const assetLinks = resultLinks.filter((item) => item.isAssetDownload && item.assetId)
    setResolvedPreviewLinks((current) => {
      const nextState: Record<string, ResolvedPreviewLinkState> = {}
      resultLinks.forEach((item) => {
        nextState[item.url] = item.isAssetDownload
          ? current[item.url] || { error: null, loading: true, url: null }
          : { error: null, loading: false, url: item.url }
      })
      return nextState
    })

    if (!assetLinks.length) {
      return
    }

    let cancelled = false

    void Promise.all(
      assetLinks.map(async (item) => {
        try {
          const response = await fetch(buildAdminAssetResolveLink(item.assetId!, false), {
            credentials: 'include',
          })

          let payload: { success?: boolean; data?: ResolvedAssetLinkPayload; error?: string; message?: string } | null =
            null
          try {
            payload = await response.json()
          } catch (e: unknown) {            console.error("Operation in TaskDetailModal:", e);

            payload = null
          }

          const resolvedUrl = String(payload?.data?.url || '').trim()
          if (!response.ok || !payload?.success || !resolvedUrl) {
            throw new Error(String(payload?.message || payload?.error || '结果预览链接解析失败'))
          }

          if (cancelled) return
          setResolvedPreviewLinks((current) => ({
            ...current,
            [item.url]: {
              error: null,
              loading: false,
              url: resolvedUrl,
            },
          }))
        } catch (resolveError: unknown) {
          console.error('Failed to resolve admin preview link:', resolveError)
          if (cancelled) return
          setResolvedPreviewLinks((current) => ({
            ...current,
            [item.url]: {
              error: resolveError instanceof Error ? resolveError.message : '结果预览链接解析失败',
              loading: false,
              url: null,
            },
          }))
        }
      }),
    )

    return () => {
      cancelled = true
    }
  }, [open, resultLinks])

  if (!open) return null

  const rawTask = task as unknown as Record<string, unknown> | null | undefined
  const displayName = String(rawTask?.display_name || '').trim()
  const inputPayload = task?.input_payload ?? null
  const outputPayload = task?.output_payload ?? null
  const modelSummary = displayName
    ? `${displayName} / ${String(task?.model_id || task?.operation || '--')}`
    : String(task?.model_id || task?.operation || '--')

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-5xl -translate-x-1/2 -translate-y-1/2">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="text-lg font-semibold text-text-primary">任务详情</div>
              {!!task && <div className="font-mono text-xs text-text-muted">task_id={task?.id ?? '--'}</div>}
            </div>
            <button className="btn-secondary-sm border border-white/10" onClick={onClose}>
              关闭
            </button>
          </div>

          <div className="custom-scrollbar max-h-[72vh] overflow-y-auto p-5">
            {loading && (
              <div className="flex items-center justify-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-accent" />
              </div>
            )}

            {!loading && error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</div>
            )}

            {!loading && !error && task && (
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xs text-text-muted">
                      用户：{resolveAdminTaskUserDisplay(task)}
                    </div>
                  </div>
                  <div className="text-sm text-text-primary">{modelSummary}</div>
                  {task?.vendor && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 text-cyan-200">
                        厂商：{task.vendor}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-black/10 p-3">
                    <div className="text-xs text-text-muted">开始时间</div>
                    <div className="mt-1 text-sm text-text-primary">{formatDateTime(task?.started_at || task?.created_at)}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/10 p-3">
                    <div className="text-xs text-text-muted">结束时间</div>
                    <div className="mt-1 text-sm text-text-primary">{formatDateTime(task?.finished_at)}</div>
                  </div>
                </div>


                {task?.input_media && task.input_media.length > 0 && (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="mb-2 text-xs text-text-muted">输入参考图</div>
                    <div className="flex gap-3 overflow-x-auto pb-1">
                      {task.input_media.map((media: Record<string, unknown>, index: number) => (
                        <div key={index} className="group relative shrink-0">
                          <img
                            src={media.url as string}
                            alt={`参考图 ${index + 1}`}
                            loading="lazy"
                            className="h-28 w-auto max-w-48 rounded-md border border-white/10 bg-black/20 object-contain"
                          />
                          {(media.field as string) && (
                            <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-text-muted">
                              {media.field as string}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {resultLinks.length > 0 && (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="mb-2 text-xs text-text-muted">结果预览</div>
                    <div className="space-y-2">
                      {resultLinks.map((item, index) => (
                        <div key={`${item.url}-${index}`}>
                          {renderTaskResultPreview(item, resolvedPreviewLinks[item.url])}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-black/10 p-4">
                    <div className="mb-2 flex items-center text-xs text-text-muted">
                      输入载荷
                      <CopyButton text={safeJsonStringify(inputPayload)} />
                    </div>
                    <pre className="whitespace-pre-wrap break-all text-xs text-text-primary">{safeJsonStringify(inputPayload)}</pre>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/10 p-4">
                    <div className="mb-2 flex items-center text-xs text-text-muted">
                      输出载荷
                      <CopyButton text={safeJsonStringify(outputPayload)} />
                    </div>
                    <pre className="whitespace-pre-wrap break-all text-xs text-text-primary">{safeJsonStringify(outputPayload)}</pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export type { TaskDetailModalProps }
