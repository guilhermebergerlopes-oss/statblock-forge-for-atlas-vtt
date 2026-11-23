import type { ForgeField } from '../templates/forgeTemplate.ts';

/**
 * Read-only projection of Atlas ResourceDefinition; only fields Forge needs are represented here.
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

const SECONDARY_RESOURCE: AtlasCollectionResourceDefinition = { ...STRESS_RESOURCE, name: 'Secondary resource' };

/**
 * Atlas' old secondary bar becomes a Resource when its old switch was on or a scene
 * still shows values for it. An explicit off switch only removes it when no scene uses it.
 */
export function atlasWithLegacyResourceBars(
  resources: readonly AtlasCollectionResourceDefinition[],
  defaultWidgets: Record<string, unknown> | undefined,
  usedInScenes = false,
): AtlasCollectionResourceDefinition[] {
  const wanted = usedInScenes || defaultWidgets?.stressBar === true;
  const kept = resources.filter(({ key }) => key !== STRESS_RESOURCE.key || wanted || defaultWidgets?.stressBar !== false);
  if (wanted && !kept.some(({ key }) => key === STRESS_RESOURCE.key)) kept.push({ ...SECONDARY_RESOURCE });
  return kept;
}

function legacySceneHidesStress(tokenSettings: unknown): boolean {
  if (!isRecord(tokenSettings)) return false;
  let hidden = Array.isArray(tokenSettings.hiddenResources)
    ? tokenSettings.hiddenResources.filter((key): key is string => typeof key === 'string')
    : [];
  const hasSwitches = 'showHPBars' in tokenSettings || 'showStressBars' in tokenSettings;
  if (hasSwitches) {
    // Mirrors tokenSettingsFromFile(): when either old switch exists, both old bars are
    // made explicit. In particular, a missing showStressBars means the old bar was off.
    hidden = tokenSettings.showStressBars === true
      ? hidden.filter((key) => key !== 'stress')
      : [...hidden.filter((key) => key !== 'stress'), 'stress'];
  } else if (tokenSettings.showResources === false) {
    hidden = ['hp', 'stress'];
  }
  return hidden.includes('stress');
}

function isAtlasResourceFileValue(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  return isRecord(value)
    && typeof value.current === 'number' && Number.isFinite(value.current)
    && typeof value.max === 'number' && Number.isFinite(value.max);
}

function tokenFileHasLegacyStress(token: unknown): boolean {
  if (!isRecord(token)) return false;
  const resources = isRecord(token.resources) ? token.resources : undefined;
  if (isAtlasResourceFileValue(resources?.stress)) return true;

  // Atlas 0.19 tokenFromFile() also imports non-standard resources from
  // `statblockResources`; the `stress` key can be present there in older files.
  const statblockResources = isRecord(token.statblockResources) ? token.statblockResources : undefined;
  if (isAtlasResourceFileValue(statblockResources?.stress)) return true;

  // Older file formats stored the secondary bar directly on the token.
  return isAtlasResourceFileValue(token.stress);
}

/** Atlas' sceneShowsSecondaryBar(): the scene must not hide Stress and a token must hold it. */
export function atlasSceneShowsLegacySecondaryResource(scene: unknown): boolean {
  if (!isRecord(scene) || legacySceneHidesStress(scene.tokenSettings)) return false;
  const objects = isRecord(scene.objects) ? scene.objects : undefined;
  const tokens = isRecord(objects?.tokens) ? objects.tokens : {};
  return Object.values(tokens).some(tokenFileHasLegacyStress);
}

/**
 * Same predicate as Atlas sceneShowsSecondaryBar(), but for the JSON stored in an .atlasmap.
 * Atlas wraps the persisted scene in `state` and converts legacy top-level token fields and
 * the old showStressBars/showResources switches before inspecting it.
 */
export function atlasSceneFileShowsLegacySecondaryResource(content: string): boolean {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!isRecord(parsed) || !isRecord(parsed.state)) return false;
    const scene = parsed.state;
    return atlasSceneShowsLegacySecondaryResource(scene);
  } catch {
    return false;
  }
}

/** Built-in preset Resource defaults mirrored from Atlas system presets. */
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

function legacyCollectionResources(
  settings: Record<string, unknown>,
  usedInScenes = false,
): AtlasCollectionResourceDefinition[] {
  const presetId = nonBlank(settings.systemPresetId) ? settings.systemPresetId : '';
  // Atlas' legacy collectionResources() fallback uses BUILT_IN_SYSTEM_PRESETS only.
  // User preset Resources are copied into settings.resources when that preset is applied.
  const presetResources = BUILTIN_PRESET_RESOURCES[presetId] ?? [HP_RESOURCE];
  const widgets = isRecord(settings.defaultWidgets) ? settings.defaultWidgets : undefined;
  return atlasWithLegacyResourceBars(presetResources.map((resource) => ({ ...resource })), widgets, usedInScenes)
    .slice(0, MAX_ATLAS_RESOURCES);
}

/**
 * Effective Resource definitions for a collection. A collection saved before Resources existed
 * follows Atlas' legacy bar rules until Atlas stores its one-time migrated list.
 */
export function effectiveAtlasCollectionResources(
  settings: unknown,
  _presetRules?: Record<string, unknown> | null,
  usedInScenes = false,
): AtlasCollectionResourceDefinition[] {
  if (!isRecord(settings)) return [{ ...HP_RESOURCE }];
  if (Array.isArray(settings.resources)) return parseAtlasCollectionResourceDefinitions(settings.resources);
  return legacyCollectionResources(settings, usedInScenes);
}

/**
 * Resources inherited by an Atlas campaign system. Campaign systems have no
 * defaultWidgets of their own, but legacy systems still inherit the Resources
 * of their recorded built-in preset unless an explicit (even empty) list was
 * saved. This matches Atlas collectionResources() for the played system.
 */
export function effectiveAtlasCampaignResources(
  system: unknown,
  _presetRules?: Record<string, unknown> | null,
): AtlasCollectionResourceDefinition[] {
  if (!isRecord(system)) return [{ ...HP_RESOURCE }];
  if (Array.isArray(system.resources)) return parseAtlasCollectionResourceDefinitions(system.resources);
  // Campaign Systems use the same legacy built-in fallback as collectionResources().
  const systemPresetId = nonBlank(system.systemPresetId) && system.systemPresetId.length <= 200
    ? system.systemPresetId : undefined;
  return effectiveAtlasCollectionResources(systemPresetId ? { systemPresetId } : {});
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

export function atlasRoleTemplateIdsForCollection(
  settings: unknown,
  presetRules?: Record<string, unknown> | null,
): string[] {
  if (!isRecord(settings)) return [...GENERIC_ROLE_TEMPLATE_IDS];
  const roles = Array.isArray(settings.statblockRoles) ? settings.statblockRoles : [];
  if (roles.length > 0) {
    return roles.flatMap((role) => isRecord(role) && nonBlank(role.templateId) ? [role.templateId] : []);
  }
  const presetRoles = Array.isArray(presetRules?.statblockRoles) ? presetRules.statblockRoles : [];
  if (presetRoles.length > 0) {
    return presetRoles.flatMap((role) => isRecord(role) && nonBlank(role.templateId) ? [role.templateId] : []);
  }
  const presetId = nonBlank(settings.systemPresetId) ? settings.systemPresetId : '';
  return [...(BUILTIN_PRESET_ROLE_TEMPLATE_IDS[presetId] ?? GENERIC_ROLE_TEMPLATE_IDS)];
}

/** Resource definition assigned to the Atlas token socket it occupies. */
export interface AtlasSlottedResourceDefinition {
  readonly definition: AtlasCollectionResourceDefinition;
  readonly slot: number;
}

/**
 * Mirrors Atlas slottedResources(): valid stored slots are claimed first; definitions without
 * a free valid slot take the first free socket in list order. The result is returned in socket
 * order and never mutates the saved collection/preset definitions.
 */
export function slottedAtlasCollectionResources(
  definitions: readonly AtlasCollectionResourceDefinition[],
): AtlasSlottedResourceDefinition[] {
  const sockets = new Map<number, AtlasCollectionResourceDefinition>();
  const waiting: AtlasCollectionResourceDefinition[] = [];
  for (const definition of definitions) {
    if (validSocket(definition.slot) && !sockets.has(definition.slot)) sockets.set(definition.slot, definition);
    else waiting.push(definition);
  }
  for (let slot = 0; slot < MAX_ATLAS_RESOURCES && waiting.length > 0; slot++) {
    if (!sockets.has(slot)) {
      const definition = waiting.shift();
      if (definition) sockets.set(slot, definition);
    }
  }
  return [...sockets].sort(([left], [right]) => left - right)
    .map(([slot, definition]) => ({ definition, slot }));
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
