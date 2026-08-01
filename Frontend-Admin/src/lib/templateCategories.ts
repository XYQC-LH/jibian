const STORAGE_KEY = 'admin_template_categories';

export const DEFAULT_TEMPLATE_CATEGORIES = ['写真', '风格', '角色', '头像', '场景', '节日'];

export function getTemplateCategories(): string[] {
  if (typeof window === 'undefined') {
    return DEFAULT_TEMPLATE_CATEGORIES;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TEMPLATE_CATEGORIES;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_TEMPLATE_CATEGORIES;
    const categories = parsed
      .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
      .map((item) => item.trim());
    return categories.length > 0 ? categories : DEFAULT_TEMPLATE_CATEGORIES;
  } catch {
    return DEFAULT_TEMPLATE_CATEGORIES;
  }
}

export function saveTemplateCategories(categories: string[]): void {
  if (typeof window === 'undefined') return;
  const normalized = Array.from(
    new Set(categories.map((item) => String(item || '').trim()).filter(Boolean))
  );
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore storage errors
  }
}
