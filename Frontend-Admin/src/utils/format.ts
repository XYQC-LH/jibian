type DateInput = string | Date | number | null | undefined;

const ISO_WITH_TZ_SUFFIX_RE = /[zZ]$|[+-]\d{2}:\d{2}$/;
const ISO_NAIVE_T_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/;
const ISO_NAIVE_SPACE_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/;

function normalizeDateString(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  if (ISO_WITH_TZ_SUFFIX_RE.test(raw)) return raw;
  if (ISO_NAIVE_T_RE.test(raw)) return `${raw}Z`;
  if (ISO_NAIVE_SPACE_RE.test(raw)) return `${raw.replace(' ', 'T')}Z`;
  return raw;
}

function toDate(value: DateInput): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  const date = new Date(normalizeDateString(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function toLocalDateTimeString(date: Date): string {
  return `${toLocalDateString(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

export function formatDateLocal(value: DateInput, emptyText: string = '--'): string {
  const date = toDate(value);
  return date ? toLocalDateString(date) : emptyText;
}

export function formatDateTimeLocal(value: DateInput, emptyText: string = '--'): string {
  const date = toDate(value);
  return date ? toLocalDateTimeString(date) : emptyText;
}

export function formatDate(date: string | Date, emptyText: string = '--'): string {
  return formatDateLocal(date, emptyText);
}

export function formatDateTime(date: string | Date, emptyText: string = '--'): string {
  return formatDateTimeLocal(date, emptyText);
}

const CHINA_TZ = 'Asia/Shanghai';

export function formatChinaDateTime(value: DateInput, emptyText: string = '--'): string {
  const date = toDate(value);
  if (!date) return emptyText;
  return date.toLocaleString('zh-CN', { timeZone: CHINA_TZ, hour12: false });
}

export function formatChinaDate(value: DateInput, emptyText: string = '--'): string {
  const date = toDate(value);
  if (!date) return emptyText;
  return date.toLocaleDateString('zh-CN', { timeZone: CHINA_TZ });
}

export function formatChinaTime(value: DateInput, emptyText: string = '--'): string {
  const date = toDate(value);
  if (!date) return emptyText;
  return date.toLocaleTimeString('zh-CN', { timeZone: CHINA_TZ, hour12: false });
}

export function formatNumber(num: number, decimals: number = 0): string {
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function formatCurrency(amount: number): string {
  return `¥${formatNumber(amount, 2)}`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}
