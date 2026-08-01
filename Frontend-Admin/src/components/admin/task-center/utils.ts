import type { TaskClass } from './types'

type DateInput = string | number | Date | null | undefined
type ModerationDecision = 'pass' | 'block' | 'not_checked' | 'unknown'

const ISO_WITH_TZ_SUFFIX_RE = /[zZ]$|[+-]\d{2}:\d{2}$/
const ISO_NAIVE_T_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/
const ISO_NAIVE_SPACE_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/
const TIME_ONLY_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/

function normalizeDateString(value: string): string {
  const raw = String(value || '').trim()
  if (!raw) return raw
  if (ISO_WITH_TZ_SUFFIX_RE.test(raw)) return raw
  if (ISO_NAIVE_T_RE.test(raw)) return `${raw}Z`
  if (ISO_NAIVE_SPACE_RE.test(raw)) return `${raw.replace(' ', 'T')}Z`
  return raw
}

function toDate(value: DateInput): Date | null {
  if (value == null) return null
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null
  if (typeof value === 'number') {
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date : null
  }
  const date = new Date(normalizeDateString(value))
  return Number.isFinite(date.getTime()) ? date : null
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function toLocalDateTimeString(date: Date): string {
  return `${toLocalDateString(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

function normalizeTimeOnly(value: string): string | null {
  const raw = String(value || '').trim()
  const match = raw.match(TIME_ONLY_RE)
  if (!match) return null

  const hour = Number(match[1])
  const minute = Number(match[2])
  const second = Number(match[3] || '0')
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null

  return `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`
}

export const formatAdminDateTime = (
  value: DateInput,
  emptyText: string = '--',
  dateHint?: DateInput
): string => {
  const parsed = toDate(value)
  if (parsed) return toLocalDateTimeString(parsed)

  const raw = String(value || '').trim()
  if (!raw) return emptyText

  const timeOnly = normalizeTimeOnly(raw)
  if (!timeOnly) return raw

  const hint = toDate(dateHint)
  if (!hint) return raw
  return `${toLocalDateString(hint)} ${timeOnly}`
}

export const formatTaskClass = (taskClass: TaskClass): string => {
  switch (taskClass) {
    case 'base':
    default:
      return 'Base Task'
  }
}

export const resolveAdminTaskUserDisplay = (task: {
  username?: string | null
  user_email?: string | null
  user_id?: number | string | null
}): string => {
  const username = String(task?.username || '').trim()
  if (username) return username

  const email = String(task?.user_email || '').trim()
  if (email) return email

  const userId = String(task?.user_id ?? '').trim()
  return userId ? `用户${userId}` : '未知用户'
}

export type TaskModerationSummary = {
  input: {
    checked: boolean
    decision: ModerationDecision
    ok: boolean | null
    reason: string | null
    provider: string | null
    checkedAt: string | null
  }
  output: {
    checked: boolean
    decision: ModerationDecision
    ok: boolean | null
    reason: string | null
    provider: string | null
    checkedAt: string | null
  }
  hasBlock: boolean
}

const DEFAULT_PHASE_SUMMARY: TaskModerationSummary['input'] = {
  checked: false,
  decision: 'not_checked',
  ok: null,
  reason: null,
  provider: null,
  checkedAt: null,
}

const normalizeDecision = (value: unknown): ModerationDecision => {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'pass' || raw === 'block' || raw === 'not_checked') return raw
  if (!raw) return 'not_checked'
  return 'unknown'
}

const normalizePhaseSummary = (raw: unknown): TaskModerationSummary['input'] => {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PHASE_SUMMARY }
  const obj = raw as Record<string, unknown>
  const okRaw = obj.ok
  return {
    checked: Boolean(obj.checked),
    decision: normalizeDecision(obj.decision),
    ok: okRaw === null || okRaw === undefined ? null : Boolean(okRaw),
    reason: String(obj.reason || '').trim() || null,
    provider: String(obj.provider || '').trim() || null,
    checkedAt: String(obj.checked_at || obj.checkedAt || '').trim() || null,
  }
}

const extractPhaseFromRawRecords = (records: Record<string, unknown>[], phase: 'input' | 'output'): TaskModerationSummary['input'] => {
  const hit = records
    .filter((item) => item && typeof item === 'object' && String(item.phase || '').trim() === phase)
    .slice(-1)[0]
  if (!hit) return { ...DEFAULT_PHASE_SUMMARY }
  const okRaw = hit.ok
  return {
    checked: true,
    decision: normalizeDecision(hit.decision),
    ok: okRaw === null || okRaw === undefined ? null : Boolean(okRaw),
    reason: String(hit.reason || '').trim() || null,
    provider: String(hit.provider || '').trim() || null,
    checkedAt: String(hit.checked_at || '').trim() || null,
  }
}

export const resolveTaskModerationSummary = (task: Record<string, unknown>): TaskModerationSummary => {
  const moderation = task?.moderation
  if (moderation && typeof moderation === 'object') {
    const mod = moderation as Record<string, unknown>
    const input = normalizePhaseSummary(mod.input)
    const output = normalizePhaseSummary(mod.output)
    return {
      input,
      output,
      hasBlock: Boolean(
        mod.has_block ??
          mod.hasBlock ??
          (input.decision === 'block' || output.decision === 'block')
      ),
    }
  }

  const outputPayload = task?.output_payload as Record<string, unknown> | undefined
  const records: Record<string, unknown>[] = Array.isArray(outputPayload?._moderation)
    ? (outputPayload._moderation as Record<string, unknown>[])
    : []
  const input = extractPhaseFromRawRecords(records, 'input')
  const output = extractPhaseFromRawRecords(records, 'output')
  return {
    input,
    output,
    hasBlock: input.decision === 'block' || output.decision === 'block',
  }
}

export const formatModerationDecision = (value: ModerationDecision): string => {
  switch (value) {
    case 'pass':
      return '通过'
    case 'block':
      return '拦截'
    case 'unknown':
      return '未知'
    default:
      return '未审'
  }
}

const formatRiskLevel = (value: string): string => {
  const level = String(value || '').trim().toLowerCase()
  switch (level) {
    case 'none':
      return '无风险'
    case 'low':
      return '低风险'
    case 'medium':
      return '中风险'
    case 'high':
      return '高风险'
    case 'unknown':
      return '未知'
    default:
      return value || '未知'
  }
}

const MODERATION_REASON_DIRECT: Record<string, string> = {
  passed: '审核通过',
  blocked: '审核拦截',
  hit: '命中拦截规则',
  not_hit: '未命中拦截规则',
  disabled: '审核已禁用',
  no_output: '无输出内容',
  missing_access_key: '审核凭证缺失',
  missing_webhook_url: '审核回调地址缺失',
  missing_scan_url: '审核资源地址缺失',
  unsupported_video: '不支持视频审核',
  unrecognized_response: '审核响应不可识别',
}

const MODERATION_REASON_PREFIX: Record<string, string> = {
  text_risk_level: '文本风险等级',
  image_risk_level: '图像风险等级',
  text_http_status: '文本审核 HTTP 状态',
  image_http_status: '图像审核 HTTP 状态',
  unknown_provider: '审核提供方未识别',
  sdk_init_error: '审核 SDK 初始化失败',
  text_api_error: '文本审核接口异常',
  image_api_error: '图像审核接口异常',
  api_error: '审核接口异常',
  aliyun_text_plus_error: '阿里云文本审核异常',
  aliyun_image_plus_error: '阿里云图像审核异常',
}

const MODERATION_REASON_VALUE_TRANSFORM: Record<string, (v: string) => string> = {
  text_risk_level: (v) => formatRiskLevel(v),
  image_risk_level: (v) => formatRiskLevel(v),
}

const MODERATION_REASON_PATTERN = /^([a-z_]+):(.+)$/i

const formatModerationReasonSegment = (segmentRaw: string): string => {
  const segment = String(segmentRaw || '').trim()
  if (!segment) return ''

  const direct = MODERATION_REASON_DIRECT[segment.toLowerCase()]
  if (direct) return direct

  const match = segment.match(MODERATION_REASON_PATTERN)
  if (!match) return segment

  const key = match[1]?.toLowerCase() || ''
  const rawValue = match[2]?.trim() || ''
  const label = MODERATION_REASON_PREFIX[key]
  if (!label) return segment

  const transform = MODERATION_REASON_VALUE_TRANSFORM[key]
  const value = transform ? transform(rawValue) : (rawValue || '--')
  return `${label}：${value}`
}

export const formatModerationReason = (reason: string | null | undefined): string => {
  const raw = String(reason || '').trim()
  if (!raw) return '--'
  const normalized = raw.replace(/\r?\n/g, ';')
  const segments = normalized
    .split(';')
    .map((segment) => formatModerationReasonSegment(segment))
    .filter(Boolean)
  if (segments.length === 0) return raw
  return segments.join('；')
}

export const safeJsonStringify = (value: unknown): string => {
  try {
    const seen = new WeakSet<object>()
    return JSON.stringify(
      value ?? null,
      (_key, currentValue) => {
        if (currentValue && typeof currentValue === 'object') {
          if (seen.has(currentValue)) return '[Circular]'
          seen.add(currentValue)
        }
        return currentValue
      },
      2
    )
  } catch (e: unknown) {
    console.warn('safeStringify serialization failed:', e);
    try {
      return String(value)
    } catch (e2: unknown) {
      console.warn('safeStringify secondary string conversion failed:', e2);
      return '[Unserializable]'
    }
  }
}
