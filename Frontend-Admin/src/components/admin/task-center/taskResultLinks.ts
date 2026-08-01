export type TaskResultKind = 'image' | 'video' | 'audio' | 'text' | 'pdf' | 'unknown'

export type TaskResultLink = {
  assetId: string | null
  displayName: string
  isAssetDownload: boolean
  kind: TaskResultKind
  label: string
  mimeType: string | null
  url: string
}

type OutputItem = Record<string, unknown>

function normalizeResultUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw) || /^data:/i.test(raw)) return raw
  if (raw.startsWith('/')) return raw
  if (/^(generated|uploads|media|thumb)\//i.test(raw)) return `/${raw}`
  return null
}

function normalizeAssetId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

function buildCanonicalAssetDownloadUrl(assetId: string): string {
  return `/api/assets/${encodeURIComponent(assetId)}/download`
}

function extractAssetId(value: string): string | null {
  const match = value.match(/(?:^|\/)api\/assets\/([^/?#]+)(?:\/download)?(?=\?|#|$)/i)
  return match?.[1]?.trim() || null
}

function normalizeMimeType(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return normalized || null
}

function extractFileExtension(value: string): string {
  const normalized = value.split('?')[0].split('#')[0].trim().toLowerCase()
  const matched = normalized.match(/\.([a-z0-9]+)$/i)
  return matched?.[1] || ''
}

function resolveTaskResultKind(url: string, displayName: string, mimeType?: string | null, rawUrl?: string | null): TaskResultKind {
  const normalizedMimeType = normalizeMimeType(mimeType)
  if (normalizedMimeType?.startsWith('image/')) return 'image'
  if (normalizedMimeType?.startsWith('video/')) return 'video'
  if (normalizedMimeType?.startsWith('audio/')) return 'audio'
  if (normalizedMimeType?.startsWith('text/')) return 'text'
  if (normalizedMimeType === 'application/pdf') return 'pdf'
  if (normalizedMimeType && /(json|xml|yaml|csv|javascript|typescript|sql|markdown)/i.test(normalizedMimeType)) {
    return 'text'
  }

  const ext = extractFileExtension(displayName)
    || extractFileExtension(url)
    || (rawUrl ? extractFileExtension(rawUrl) : '')
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(ext)) return 'image'
  if (['mp4', 'webm', 'mov', 'm4v', 'ogg'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'm4a', 'aac', 'flac', 'oga', 'ogg'].includes(ext)) return 'audio'
  if (ext === 'pdf') return 'pdf'
  if (['txt', 'md', 'json', 'log', 'csv', 'xml', 'yaml', 'yml', 'html', 'htm', 'js', 'ts', 'py', 'sql'].includes(ext)) {
    return 'text'
  }
  return 'unknown'
}

function resolveResultDisplayName(url: string, label: string, preferredName?: unknown): string {
  const normalizedPreferredName = typeof preferredName === 'string' ? preferredName.trim() : ''
  if (normalizedPreferredName) return normalizedPreferredName

  if (extractAssetId(url)) return `${label}文件`

  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url)
      const segments = parsed.pathname.split('/').filter(Boolean)
      const lastSegment = segments[segments.length - 1]?.trim()
      if (lastSegment && lastSegment.toLowerCase() !== 'download') return lastSegment
      return parsed.hostname || `${label}链接`
    } catch (e: unknown) {      console.error("Operation in taskResultLinks:", e);

      return `${label}链接`
    }
  }

  const segments = url.split('/').filter(Boolean)
  const lastSegment = segments[segments.length - 1]?.trim()
  if (lastSegment && lastSegment.toLowerCase() !== 'download') return lastSegment
  return `${label}文件`
}

export function collectTaskResultLinks(task: Record<string, unknown>): TaskResultLink[] {
  const links: TaskResultLink[] = []
  const seenUrl = new Set<string>()
  const seenAssetId = new Set<string>()

  const append = (raw: unknown, label: string, preferredName?: unknown, mimeType?: unknown, explicitAssetId?: unknown, linkedAssetId?: unknown) => {
    const normalizedAssetId = normalizeAssetId(explicitAssetId)
    const normalized = normalizedAssetId ? buildCanonicalAssetDownloadUrl(normalizedAssetId) : normalizeResultUrl(raw)
    if (!normalized || seenUrl.has(normalized)) return
    seenUrl.add(normalized)

    const normalizedMimeType = normalizeMimeType(mimeType)
    const linkedId = normalizeAssetId(linkedAssetId)
    const assetId = normalizedAssetId || extractAssetId(normalized) || linkedId
    if (assetId && seenAssetId.has(assetId)) return
    if (assetId) seenAssetId.add(assetId)

    const displayName = resolveResultDisplayName(normalized, label, preferredName)
    links.push({
      assetId,
      displayName,
      isAssetDownload: assetId !== null,
      kind: resolveTaskResultKind(normalized, displayName, normalizedMimeType, typeof raw === 'string' ? raw : null),
      label,
      mimeType: normalizedMimeType,
      url: normalized,
    })
  }

  const appendOutputItem = (item: OutputItem, label: string) => {
    append(
      item?.url,
      label,
      item?.filename || item?.original_filename || item?.name,
      item?.mime_type || item?.content_type,
      item?.assetId || item?.asset_id || item?.asset_uuid,
    )
  }

  const appendPresentationOutputs = (value: unknown) => {
    const items = Array.isArray(value) ? value as OutputItem[] : []
    items.forEach((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return
      const kind = String(item?.kind || 'output').trim().toLowerCase() || 'output'
      appendOutputItem(item, `${kind} / ${index + 1}`)
    })
  }

  append(
    task?.thumbnail_url,
    '缩略图',
    task?.thumbnail_filename || task?.thumbnail_original_filename,
    task?.thumbnail_mime_type || task?.thumbnail_content_type,
  )

  appendPresentationOutputs(task?.outputs)

  const outputPayload = task?.output_payload
  if (outputPayload && typeof outputPayload === 'object') {
    const op = outputPayload as Record<string, unknown>
    appendPresentationOutputs(op.outputs)

    const outputs = op.outputs && typeof op.outputs === 'object' && !Array.isArray(op.outputs)
      ? op.outputs as Record<string, unknown>
      : {}

    ;(['images', 'videos', 'audios'] as const).forEach((bucket) => {
      const items = Array.isArray(outputs[bucket]) ? outputs[bucket] as Record<string, unknown>[] : []
      items.forEach((item, index) => {
        const label = `${bucket} / ${index + 1}`
        appendOutputItem(item, label)
      })
    })
  }

  return links
}
