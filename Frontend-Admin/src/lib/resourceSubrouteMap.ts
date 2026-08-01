export type ResourceTab =
  | 'models'
  | 'system'
  | 'monitor';

export type AdminResourceInitialTab = ResourceTab;

export type ResourceSubrouteSlug =
  | 'models'
  | 'system'
  | 'monitoring';

export type ResourceSubrouteGroup = 'model-config' | 'platform-ops';

export type ResourceTabDefinition = {
  tab: ResourceTab;
  slug: ResourceSubrouteSlug;
  group: ResourceSubrouteGroup;
  anchors: readonly string[];
};

export const DEFAULT_RESOURCE_TAB: ResourceTab = 'models';
const DEFAULT_RESOURCE_SUBROUTE: ResourceSubrouteSlug = 'models';

export const RESOURCE_TAB_DEFINITIONS: readonly ResourceTabDefinition[] = [
  {
    tab: 'models',
    slug: 'models',
    group: 'model-config',
    anchors: ['stats', 'filter', 'model-list'],
  },
  {
    tab: 'system',
    slug: 'system',
    group: 'platform-ops',
    anchors: ['task', 'resource-limit', 'registration', 'switches', 'rate-limit'],
  },
  {
    tab: 'monitor',
    slug: 'monitoring',
    group: 'platform-ops',
    anchors: ['overview', 'host-metrics', 'container-metrics', 'trend'],
  },
] as const;

const TAB_TO_SUBROUTE_ENTRIES = RESOURCE_TAB_DEFINITIONS.map((item) => [item.tab, item.slug] as const);
const SUBROUTE_TO_TAB_ENTRIES = RESOURCE_TAB_DEFINITIONS.map((item) => [item.slug, item.tab] as const);
const SUBROUTE_TO_ANCHORS_ENTRIES = RESOURCE_TAB_DEFINITIONS.map((item) => [item.slug, item.anchors] as const);

export const RESOURCE_TAB_TO_SUBROUTE: Readonly<Record<ResourceTab, ResourceSubrouteSlug>> = Object.freeze(
  Object.fromEntries(TAB_TO_SUBROUTE_ENTRIES) as Record<ResourceTab, ResourceSubrouteSlug>
);

export const RESOURCE_SUBROUTE_TO_TAB: Readonly<Record<ResourceSubrouteSlug, ResourceTab>> = Object.freeze(
  Object.fromEntries(SUBROUTE_TO_TAB_ENTRIES) as Record<ResourceSubrouteSlug, ResourceTab>
);

const RESOURCE_SUBROUTE_ANCHORS: Readonly<Record<ResourceSubrouteSlug, readonly string[]>> = Object.freeze(
  Object.fromEntries(SUBROUTE_TO_ANCHORS_ENTRIES) as Record<ResourceSubrouteSlug, readonly string[]>
);

const RESOURCE_SUBROUTE_GROUPS = [
  {
    id: 'model-config' as const,
    label: '模型配置',
    tabs: ['models'] as const,
  },
  {
    id: 'platform-ops' as const,
    label: '平台运维',
    tabs: ['system', 'monitor'] as const,
  },
] as const;

export const resolveResourceTab = (raw: string | null | undefined): ResourceTab | null => {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) {
    return null;
  }
  return (RESOURCE_TAB_TO_SUBROUTE as Record<string, ResourceSubrouteSlug | undefined>)[key]
    ? key as ResourceTab
    : null;
};

export const normalizeResourceTab = (tab: AdminResourceInitialTab | null | undefined): ResourceTab => {
  return resolveResourceTab(tab ?? null) ?? DEFAULT_RESOURCE_TAB;
};

export const resolveTabBySubroute = (subroute: string | null | undefined): ResourceTab | null => {
  const key = String(subroute || '').trim().toLowerCase();
  if (!key) {
    return null;
  }
  return (RESOURCE_SUBROUTE_TO_TAB as Record<string, ResourceTab | undefined>)[key] ?? null;
};

export const isResourceSubrouteSlug = (subroute: string | null | undefined): subroute is ResourceSubrouteSlug => {
  return resolveTabBySubroute(subroute) !== null;
};

export const resolveTabBySubrouteOrDefault = (subroute: string | null | undefined): ResourceTab => {
  return resolveTabBySubroute(subroute) ?? DEFAULT_RESOURCE_TAB;
};

export const resolveSubrouteByTab = (tab: ResourceTab): ResourceSubrouteSlug => {
  return RESOURCE_TAB_TO_SUBROUTE[tab];
};

export const buildResourceSubroutePath = (
  tab: ResourceTab,
  options?: { anchor?: string | null; withHash?: boolean }
): string => {
  const slug = resolveSubrouteByTab(tab);
  const basePath = `/resources/${slug}`;
  const anchor = String(options?.anchor || '').trim();
  if (!options?.withHash || !anchor) {
    return basePath;
  }
  return `${basePath}#${anchor}`;
};
