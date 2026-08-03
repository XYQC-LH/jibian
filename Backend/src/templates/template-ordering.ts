export interface TemplateOrderItem {
  id: string;
  name: string;
  category: string;
  sortOrder: number;
}

const FALLBACK_CATEGORY_ORDER = Number.MAX_SAFE_INTEGER;

export function sortTemplatesByCategoryOrder<T extends TemplateOrderItem>(
  templates: T[],
  categoryOrderByName: Map<string, number>,
): T[] {
  return [...templates].sort((a, b) => {
    const categoryOrderA = categoryOrderByName.get(a.category) ?? FALLBACK_CATEGORY_ORDER;
    const categoryOrderB = categoryOrderByName.get(b.category) ?? FALLBACK_CATEGORY_ORDER;
    if (categoryOrderA !== categoryOrderB) return categoryOrderA - categoryOrderB;

    const categoryCompare = a.category.localeCompare(b.category, "zh-CN");
    if (categoryCompare !== 0) return categoryCompare;

    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;

    const nameCompare = a.name.localeCompare(b.name, "zh-CN");
    if (nameCompare !== 0) return nameCompare;

    return a.id.localeCompare(b.id);
  });
}

