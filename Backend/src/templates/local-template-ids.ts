export const localTemplateUuidsById = new Map([
  ["pearl-portrait", "00000000-0000-4000-8000-000000000001"],
  ["street-boyfriend", "00000000-0000-4000-8000-000000000002"],
  ["gufeng-mood", "00000000-0000-4000-8000-000000000003"],
  ["private-photo", "00000000-0000-4000-8000-000000000004"],
  ["japanese-clean", "00000000-0000-4000-8000-000000000005"],
  ["vintage-film", "00000000-0000-4000-8000-000000000006"],
  ["dream-glow", "00000000-0000-4000-8000-000000000007"],
  ["cinematic-portrait", "00000000-0000-4000-8000-000000000008"],
  ["forest-avatar", "00000000-0000-4000-8000-000000000009"],
  ["city-night", "00000000-0000-4000-8000-000000000010"],
  ["light-shadow", "00000000-0000-4000-8000-000000000011"],
  ["dark-texture", "00000000-0000-4000-8000-000000000012"],
]);

export const localTemplateIdsByUuid = new Map(
  [...localTemplateUuidsById.entries()].map(([templateId, uuid]) => [uuid, templateId]),
);

export function toTemplateUuid(templateId: string) {
  return localTemplateUuidsById.get(templateId) ?? templateId;
}

export function toPublicTemplateId(templateUuid: string) {
  return localTemplateIdsByUuid.get(templateUuid) ?? templateUuid;
}
