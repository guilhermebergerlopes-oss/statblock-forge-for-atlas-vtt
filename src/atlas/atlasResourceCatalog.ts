import type { ForgeField } from '../templates/forgeTemplate.ts';

/**
 * Read-only projection of ResourceDefinition using the inspected Atlas 0.17.0/0.18.0 baselines.
 * Keep the fields Atlas uses for token display and defeat checks so Forge never
 * silently reduces a collection Resource to just its label and numeric path.
 */
export interface AtlasCollectionResourceDefinition {
  readonly key: string;
  readonly name: string;
  readonly field: string;
  readonly direction: 'drains' | 'fills' | 'static';
  readonly color: string;
  readonly defeatedWhenSpent?: true;
  readonly visibleToPlayers: boolean;
  readonly slot?: number;
}

const MAX_ATLAS_RESOURCES = 6;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validSocket(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
    && value >= 0 && value < MAX_ATLAS_RESOURCES;
}

/**
 * Mirrors Atlas `parseResourceDefinitions()` for the Resource fields consumed
 * by Forge. Resource keys are stable IDs, not Field keys; `field` is the
 * dotted path used to read the matching statblock value.
 */
export function parseAtlasCollectionResourceDefinitions(raw: unknown): AtlasCollectionResourceDefinition[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const resources: AtlasCollectionResourceDefinition[] = [];

  for (const value of raw) {
    if (!isRecord(value)) continue;
    if (!nonBlank(value.key) || !nonBlank(value.name) || !nonBlank(value.field)) continue;
    if (value.direction !== 'drains' && value.direction !== 'fills' && value.direction !== 'static') continue;
    if (typeof value.color !== 'string' || !HEX_COLOR.test(value.color)) continue;
    if (seen.has(value.key) || resources.length >= MAX_ATLAS_RESOURCES) continue;

    seen.add(value.key);
    resources.push({
      key: value.key,
      name: value.name,
      field: value.field.trim(),
      direction: value.direction,
      color: value.color,
      ...(value.defeatedWhenSpent === true && value.direction !== 'static' ? { defeatedWhenSpent: true as const } : {}),
      visibleToPlayers: value.visibleToPlayers === true,
      ...(validSocket(value.slot) ? { slot: value.slot } : {}),
    });
  }

  return resources;
}

const HP_RESOURCE: AtlasCollectionResourceDefinition = {
  key: 'hp', name: 'HP', field: 'hp', direction: 'drains', color: '#22c55e',
  defeatedWhenSpent: true, visibleToPlayers: false,
};
const STRESS_RESOURCE: AtlasCollectionResourceDefinition = {
  key: 'stress', name: 'Stress', field: 'stress', direction: 'fills', color: '#a855f7',
  visibleToPlayers: false,
};

/** Built-in preset Resource defaults inspected in the Atlas 0.17.0/0.18.0 baselines. */
const BUILTIN_PRESET_RESOURCES: Readonly<Record<string, readonly AtlasCollectionResourceDefinition[]>> = {
  'builtin:cairn': [
    { key: 'hp', name: 'HP', field: 'hp', direction: 'drains', color: '#22c55e', visibleToPlayers: false },
    { key: 'str', name: 'STR', field: 'stats.0', direction: 'drains', color: '#dc2626', defeatedWhenSpent: true, visibleToPlayers: false },
  ],
  'builtin:daggerheart': [HP_RESOURCE, STRESS_RESOURCE],
  'builtin:drawsteel': [{ ...HP_RESOURCE, name: 'Stamina', field: 'stamina' }],
  'builtin:coc7e': [HP_RESOURCE],
  'builtin:cyberpunkred': [HP_RESOURCE],
  'builtin:dnd5e': [HP_RESOURCE],
  'builtin:ose': [HP_RESOURCE],
  'builtin:pathfinder2e': [HP_RESOURCE],
  'builtin:shadowdark': [HP_RESOURCE],
};

function legacyCollectionResources(settings: Record<string, unknown>): AtlasCollectionResourceDefinition[] {
  const presetId = nonBlank(settings.systemPresetId) ? settings.systemPresetId : '';
  const resources = (BUILTIN_PRESET_RESOURCES[presetId] ?? [HP_RESOURCE]).map((resource) => ({ ...resource }));
  const widgets = isRecord(settings.defaultWidgets) ? settings.defaultWidgets : {};
  const stressBar = widgets.stressBar;

  // Atlas withLegacyBars(): a legacy Stress bar stays unless it was explicitly
  // switched off; turning it on adds the generic secondary resource if needed.
  const kept = resources.filter((resource) => resource.key !== 'stress' || stressBar !== false);
  if (stressBar === true && !kept.some((resource) => resource.key === 'stress')) {
    kept.push({ ...STRESS_RESOURCE, name: 'Secondary resource' });
  }
  return kept.slice(0, MAX_ATLAS_RESOURCES);
}

/**
 * Effective Resource definitions for a collection, including Atlas' legacy
 * preset fallback for collections whose settings predate explicit resources.
 */
export function effectiveAtlasCollectionResources(settings: unknown): AtlasCollectionResourceDefinition[] {
  if (!isRecord(settings)) return [{ ...HP_RESOURCE }];
  if (Array.isArray(settings.resources)) return parseAtlasCollectionResourceDefinitions(settings.resources);
  return legacyCollectionResources(settings);
}

/**
 * Resources inherited by an Atlas campaign system. Campaign systems have no
 * defaultWidgets of their own, but legacy systems still inherit the Resources
 * of their recorded built-in preset unless an explicit (even empty) list was
 * saved. This matches Atlas collectionResources() for PlayedRules in the inspected 0.17.0/0.18.0 baselines.
 */
export function effectiveAtlasCampaignResources(system: unknown): AtlasCollectionResourceDefinition[] {
  if (!isRecord(system)) return [{ ...HP_RESOURCE }];
  if (Array.isArray(system.resources)) return parseAtlasCollectionResourceDefinitions(system.resources);
  const systemPresetId = nonBlank(system.systemPresetId) && system.systemPresetId.length <= 200
    ? system.systemPresetId : undefined;
  return effectiveAtlasCollectionResources({ ...(systemPresetId ? { systemPresetId } : {}) });
}

/**
 * Atlas falls back to a collection's explicit roles, then preset roles, then
 * generic Creature/NPC roles. Only the IDs are needed for template matching.
 */
const BUILTIN_PRESET_ROLE_TEMPLATE_IDS: Readonly<Record<string, readonly string[]>> = {
  'builtin:cairn': ['builtin:cairn-creature'],
  'builtin:daggerheart': ['builtin:generic-creature', 'builtin:generic-hazard'],
  'builtin:drawsteel': ['builtin:draw-steel-monster'],
  'builtin:coc7e': ['builtin:percentile-creature'],
  'builtin:cyberpunkred': ['builtin:generic-npc'],
  'builtin:dnd5e': ['builtin:5e-2024-monster'],
  'builtin:ose': ['builtin:bx-creature'],
  'builtin:pathfinder2e': ['builtin:d20-creature'],
  'builtin:shadowdark': ['builtin:bx-creature'],
};
const GENERIC_ROLE_TEMPLATE_IDS = ['builtin:generic-creature', 'builtin:generic-npc'] as const;

export function atlasRoleTemplateIdsForCollection(settings: unknown): string[] {
  if (!isRecord(settings)) return [...GENERIC_ROLE_TEMPLATE_IDS];
  const roles = Array.isArray(settings.statblockRoles) ? settings.statblockRoles : [];
  if (roles.length > 0) {
    return roles.flatMap((role) => isRecord(role) && nonBlank(role.templateId) ? [role.templateId] : []);
  }
  const presetId = nonBlank(settings.systemPresetId) ? settings.systemPresetId : '';
  return [...(BUILTIN_PRESET_ROLE_TEMPLATE_IDS[presetId] ?? GENERIC_ROLE_TEMPLATE_IDS)];
}

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[\s_-]/g, '');
}

function isHitPointKey(value: string): boolean {
  return ['hp', 'health', 'hitpoints'].includes(normalizedKey(value.replace(/:\s*$/, '')));
}

/**
 * Whether an Atlas collection Resource reads a Forge Field. Atlas names a
 * dotted path (`stats.0`, `resources.mana`); only its first segment identifies
 * the top-level Field. Former Forge keys and HP meanings survive Field rename.
 */
export function atlasResourceReadsForgeField(resource: AtlasCollectionResourceDefinition, field: ForgeField): boolean {
  const path = resource.field.trim();
  const head = path.split('.')[0]?.trim() ?? '';
  const keys = [field.key, ...(Array.isArray(field.formerKeys)
    ? field.formerKeys.filter((item): item is string => typeof item === 'string')
    : [])];
  return keys.some((key) => normalizedKey(path) === normalizedKey(key)
    || normalizedKey(head) === normalizedKey(key)
    || (isHitPointKey(head) && (isHitPointKey(key) || field.meaning === 'hit-points')));
}

/** Atlas treats a collection Resource as owning a tracked number with the same stable key. */
export function atlasResourceSharesForgeFieldKey(resource: AtlasCollectionResourceDefinition, field: ForgeField): boolean {
  return resource.key === field.key;
}
