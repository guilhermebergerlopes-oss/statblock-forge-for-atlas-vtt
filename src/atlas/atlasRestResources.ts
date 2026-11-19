import type { App } from 'obsidian';
import type { ForgeField, ForgeTemplate, JsonRecord } from '../templates/forgeTemplate.ts';

export interface AtlasCollectionResourceDefinition {
  key: string;
  name: string;
  field: string;
  direction: 'drains' | 'fills' | 'static';
  color?: string;
}

export interface AtlasRestResourceSnapshot extends AtlasCollectionResourceDefinition {
  current: number;
  max: number;
  holder: 'token' | 'party' | 'none';
  partyKey?: string;
  partyEntries?: readonly {
    store: AtlasStoreLike;
    key: string;
    current: number;
    max: number;
    maxByHand?: true;
    rawValue: unknown;
  }[];
  tokenEntries?: readonly {
    store: AtlasStoreLike;
    tokenId: string;
    value: AtlasResourceValueLike | null;
    rawValue: unknown;
    overriddenMax: unknown;
  }[];
  maxByHand?: true;
}

interface AtlasTokenAssetLike {
  id: string;
  name?: string;
  collection: string;
  imagePath?: string;
  statblockPath?: string;
  playerCharacter?: true;
  createdAt?: number;
}

interface AtlasResourceValueLike {
  current: number;
  max: number;
}

interface AtlasPlacedTokenLike {
  id: string;
  assetId?: string;
  imagePath?: string;
  resources?: Record<string, AtlasResourceValueLike>;
  overriddenMax?: string[];
}

interface AtlasTokenUpdateState {
  objects?: { tokens?: Record<string, AtlasPlacedTokenLike> };
  updateTokens?: (entries: Array<{ id: string; changes: { resources: Record<string, AtlasResourceValueLike> } }>) => void;
  partyValues?: Record<string, { current: number; max: number; maxByHand?: true }>;
}

interface AtlasStoreLike {
  getState(): AtlasTokenUpdateState & Record<string, unknown>;
  setState?: (partial: Record<string, unknown>) => void;
}

interface AtlasResourceStoreTarget {
  store: AtlasStoreLike;
  tokenIds: string[];
}

interface AtlasCollectionLike { id: string; name?: string; settings?: unknown }

interface AtlasAssetServiceLike {
  loadedTokenAssets?(): AtlasTokenAssetLike[];
  loadedCollections?(): AtlasCollectionLike[];
  getCollectionSettings?(collectionId: string): unknown;
}

interface AtlasServiceManagerLike {
  getAssetService?(): AtlasAssetServiceLike | null;
  getStore?(): AtlasStoreLike;
}

interface AtlasMapViewLike {
  containerEl?: { isShown?: () => boolean };
  serviceManager?: AtlasServiceManagerLike;
}

export interface AtlasRestResourceContext {
  characterAssetId: string;
  characterName: string;
  collectionId: string;
  resources: readonly AtlasRestResourceSnapshot[];
  stores: readonly AtlasResourceStoreTarget[];
}

export interface AtlasRestResourceChange {
  resourceKey: string;
  from: number;
  to: number;
  max: number;
  /** Forge rest direction: down drains to maximum; up fills towards zero. */
  direction: 'down' | 'up';
}

export interface AtlasRestResourceRollbackReceipt {
  tokenEntries: Array<{
    store: AtlasStoreLike;
    tokenId: string;
    resourceKey: string;
    before: unknown;
    after: AtlasResourceValueLike;
    beforeOverriddenMax: unknown;
    afterOverriddenMax: unknown;
  }>;
  partyEntries: Array<{
    store: AtlasStoreLike;
    key: string;
    before: unknown;
    after: { current: number; max: number; maxByHand?: true };
  }>;
}

export interface AtlasRestResourceCommit {
  updated: number;
  receipt: AtlasRestResourceRollbackReceipt;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function atlasResourceSharesForgeFieldKey(resource: AtlasCollectionResourceDefinition, field: ForgeField): boolean {
  return resource.key === field.key;
}

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[\s_-]/g, '');
}

function hitPointAlias(value: string): boolean {
  return ['hp', 'health', 'hitpoints'].includes(normalizedKey(value.replace(/:\s*$/, '')));
}

function validResourceValue(value: unknown): AtlasResourceValueLike | null {
  if (!isRecord(value)) return null;
  const current = value.current;
  const max = value.max;
  if (typeof current !== 'number' || !Number.isFinite(current)
    || typeof max !== 'number' || !Number.isFinite(max) || max < 0) return null;
  return { current: Math.max(0, Math.min(max, current)), max };
}

function cloneStoredValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  try { return structuredClone(value); }
  catch {
    if (Array.isArray(value)) return value.map((item) => cloneStoredValue(item));
    if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneStoredValue(item)]));
    return value;
  }
}

function sameStoredValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((item, index) => sameStoredValue(item, right[index]));
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index]
    && sameStoredValue(left[key], right[key]));
}

function partyEntry(state: AtlasTokenUpdateState, characterId: string, resourceKey: string): { key: string; value: AtlasResourceValueLike; maxByHand?: true; rawValue: unknown } | null {
  const values = state.partyValues;
  if (!values) return null;
  for (const [key, raw] of Object.entries(values)) {
    let parts: unknown;
    try { parts = JSON.parse(key); } catch { continue; }
    if (!Array.isArray(parts) || parts.length !== 3 || parts[1] !== characterId || parts[2] !== resourceKey) continue;
    const value = validResourceValue(raw);
    if (value) return { key, value, ...(raw.maxByHand === true && { maxByHand: true }), rawValue: cloneStoredValue(raw) };
  }
  return null;
}

function collectionResources(settings: unknown): AtlasCollectionResourceDefinition[] {
  if (!isRecord(settings) || !Array.isArray(settings.resources)) return [];
  const seen = new Set<string>();
  const resources: AtlasCollectionResourceDefinition[] = [];
  for (const raw of settings.resources) {
    if (!isRecord(raw) || typeof raw.key !== 'string' || !raw.key.trim()
      || typeof raw.name !== 'string' || !raw.name.trim()
      || typeof raw.field !== 'string' || !raw.field.trim()
      || !['drains', 'fills', 'static'].includes(String(raw.direction))
      || typeof raw.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(raw.color)
      || seen.has(raw.key) || resources.length >= 6) continue;
    seen.add(raw.key);
    resources.push({
      key: raw.key,
      name: raw.name,
      field: raw.field.trim(),
      direction: raw.direction as AtlasCollectionResourceDefinition['direction'],
      ...(typeof raw.color === 'string' ? { color: raw.color } : {}),
    });
  }
  return resources;
}

const BUILTIN_PRESET_RESOURCES: Record<string, AtlasCollectionResourceDefinition[]> = {
  'builtin:cairn': [
    { key: 'hp', name: 'HP', field: 'hp', direction: 'drains', color: '#22c55e' },
    { key: 'str', name: 'STR', field: 'stats.0', direction: 'drains', color: '#dc2626' },
  ],
  'builtin:daggerheart': [
    { key: 'hp', name: 'HP', field: 'hp', direction: 'drains', color: '#22c55e' },
    { key: 'stress', name: 'Stress', field: 'stress', direction: 'fills', color: '#a855f7' },
  ],
  'builtin:drawsteel': [
    { key: 'hp', name: 'Stamina', field: 'stamina', direction: 'drains', color: '#22c55e' },
  ],
  'builtin:coc7e': [{ key: 'hp', name: 'HP', field: 'hp', direction: 'drains', color: '#22c55e' }],
  'builtin:cyberpunkred': [{ key: 'hp', name: 'HP', field: 'hp', direction: 'drains', color: '#22c55e' }],
  'builtin:dnd5e': [{ key: 'hp', name: 'HP', field: 'hp', direction: 'drains', color: '#22c55e' }],
  'builtin:ose': [{ key: 'hp', name: 'HP', field: 'hp', direction: 'drains', color: '#22c55e' }],
  'builtin:pathfinder2e': [{ key: 'hp', name: 'HP', field: 'hp', direction: 'drains', color: '#22c55e' }],
  'builtin:shadowdark': [{ key: 'hp', name: 'HP', field: 'hp', direction: 'drains', color: '#22c55e' }],
};

const BUILTIN_PRESET_ROLE_TEMPLATE_IDS: Record<string, string[]> = {
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
const GENERIC_ROLE_TEMPLATE_IDS = ['builtin:generic-creature', 'builtin:generic-npc'];

/** Atlas falls back to the generic Creature/NPC roles when a preset declares none. */
export function atlasRoleTemplateIdsForCollection(settings: unknown): string[] {
  const roles = isRecord(settings) && Array.isArray(settings.statblockRoles) ? settings.statblockRoles : [];
  if (roles.length > 0) {
    return roles.flatMap((role) => isRecord(role) && typeof role.templateId === 'string' ? [role.templateId] : []);
  }
  const presetId = isRecord(settings) && typeof settings.systemPresetId === 'string' ? settings.systemPresetId : '';
  return [...(BUILTIN_PRESET_ROLE_TEMPLATE_IDS[presetId] ?? GENERIC_ROLE_TEMPLATE_IDS)];
}

function effectiveCollectionResources(settings: unknown): AtlasCollectionResourceDefinition[] {
  if (isRecord(settings) && Array.isArray(settings.resources)) return collectionResources(settings);
  // Atlas legacyCollectionResources() falls back to HP when the preset is missing or unknown.
  const presetId = isRecord(settings) && typeof settings.systemPresetId === 'string' ? settings.systemPresetId : '';
  const resources = (BUILTIN_PRESET_RESOURCES[presetId] ?? [
    { key: 'hp', name: 'HP', field: 'hp', direction: 'drains', color: '#22c55e' },
  ]).map((resource) => ({ ...resource }));
  const widgets = isRecord(settings) && isRecord(settings.defaultWidgets) ? settings.defaultWidgets : {};
  const stressBar = widgets.stressBar;
  const kept = resources.filter((resource) => resource.key !== 'stress' || stressBar !== false);
  if (stressBar === true && !kept.some((resource) => resource.key === 'stress')) {
    kept.push({ key: 'stress', name: 'Secondary resource', field: 'stress', direction: 'fills', color: '#a855f7' });
  }
  return kept;
}

function serviceViews(app: App): Array<{ view: AtlasMapViewLike; service: AtlasAssetServiceLike; store: AtlasStoreLike; shown: boolean }> {
  const workspace = app.workspace as unknown as { getLeavesOfType?: (type: string) => Array<{ view?: unknown }> };
  if (typeof workspace.getLeavesOfType !== 'function') return [];
  const found: Array<{ view: AtlasMapViewLike; service: AtlasAssetServiceLike; store: AtlasStoreLike; shown: boolean }> = [];
  for (const leaf of workspace.getLeavesOfType('atlas-vtt')) {
    const view = leaf.view as AtlasMapViewLike | undefined;
    const manager = view?.serviceManager;
    const service = manager?.getAssetService?.();
    const store = manager?.getStore?.();
    if (!view || !service || !store || typeof service.loadedTokenAssets !== 'function') continue;
    const state = store.getState();
    // Atlas registers PartySync stores as soon as a GM map view is created, even while
    // its scene is still loading. Keep those stores so campaign-held Resources remain visible.
    if (state.isPlayerView === true) continue;
    const shown = typeof view.containerEl?.isShown === 'function' ? view.containerEl.isShown() : true;
    found.push({ view, service, store, shown });
  }
  return found.sort((a, b) => Number(b.shown) - Number(a.shown));
}

function tokenAssetForPlaced(token: AtlasPlacedTokenLike, assets: readonly AtlasTokenAssetLike[]): AtlasTokenAssetLike | null {
  if (token.assetId) {
    const byId = assets.find((asset) => asset.id === token.assetId);
    if (byId) return byId;
  }
  return assets.find((asset) => asset.imagePath === token.imagePath) ?? null;
}

function characterAssetsForNote(assets: readonly AtlasTokenAssetLike[], notePath: string): AtlasTokenAssetLike[] {
  return assets.filter((asset) => asset.playerCharacter === true && asset.statblockPath === notePath)
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id));
}

/**
 * Atlas-compatible field mapping: a collection Resource reads the field named by its dotted path's
 * first segment. Former field keys and the common HP aliases remain valid after a field rename.
 */
export function atlasResourceReadsForgeField(resource: AtlasCollectionResourceDefinition, field: ForgeField): boolean {
  const path = resource.field.trim();
  const head = path.split('.')[0]?.trim() ?? '';
  const keys = [field.key, ...(Array.isArray(field.formerKeys) ? field.formerKeys.filter((item): item is string => typeof item === 'string') : [])];
  return keys.some((key) => normalizedKey(path) === normalizedKey(key)
    || normalizedKey(head) === normalizedKey(key)
    || (hitPointAlias(head) && (hitPointAlias(key) || field.meaning === 'hit-points')));
}

/** Collection Resource fields offered in the template Rest editor for collections that assign this template to a role. */
export function atlasResourceFieldKeysForTemplate(app: App, template: ForgeTemplate): string[] {
  const views = serviceViews(app);
  const service = views[0]?.service;
  const collections = service?.loadedCollections?.() ?? [];
  const keys = new Set<string>();
  for (const collection of collections) {
    const settings = isRecord(collection.settings) ? collection.settings : {};
    // Atlas uses its own role list when non-empty; otherwise it inherits preset roles,
    // falling back to the generic Creature/NPC roles when the preset is unknown or roleless.
    const assignedTemplate = atlasRoleTemplateIdsForCollection(settings).includes(template.id);
    if (!assignedTemplate) continue;
    const resources = effectiveCollectionResources(settings);
    for (const field of template.fields) {
      if (resources.some((resource) => resource.direction !== 'static' && atlasResourceReadsForgeField(resource, field))) {
        keys.add(field.key);
      }
    }
  }
  return [...keys];
}

/**
 * Finds the Atlas player character linked to a Forge statblock note, its collection Resources,
 * and every live token copy on open maps. Forms share the oldest linked asset as their canonical
 * character id for PartySync. The first resource value follows Atlas' visible-map-first token
 * lookup; writes later update every token copy of the same player character.
 */
export function atlasRestResourceContextForNote(app: App, notePath: string): AtlasRestResourceContext | null {
  const views = serviceViews(app);
  const first = views[0];
  if (!first) return null;
  const assets = first.service.loadedTokenAssets?.() ?? [];
  const characterAssets = characterAssetsForNote(assets, notePath);
  const character = characterAssets[0];
  if (!character) return null;
  const characterIds = new Set(characterAssets.map((asset) => asset.id));
  const settings = first.service.getCollectionSettings?.(character.collection);
  const definitions = effectiveCollectionResources(settings);
  if (definitions.length === 0) return null;

  const stores: AtlasResourceStoreTarget[] = [];
  const tokenValues = new Map<string, AtlasResourceValueLike>();
  const tokenEntries = new Map<string, { store: AtlasStoreLike; tokenId: string; value: AtlasResourceValueLike | null; rawValue: unknown }[]>();
  const partyValues = new Map<string, { store: AtlasStoreLike; key: string; value: AtlasResourceValueLike; maxByHand?: true; rawValue: unknown }[]>();
  for (const { store } of views) {
    const state = store.getState();
    // Token holds follow Atlas openMapViews + characterHolds: only loaded, non-loading GM maps.
    // PartySync values below are still read from stores whose scenes are not loaded yet.
    const canReadTokens = state.mapLoaded === true && state.isMapLoading !== true && state.isPlayerView !== true;
    const tokens = canReadTokens ? state.objects?.tokens ?? {} : {};
    const tokenIds: string[] = [];
    for (const [tokenId, token] of Object.entries(tokens)) {
      const asset = tokenAssetForPlaced(token, assets);
      if (!asset || !characterIds.has(asset.id)) continue;
      // Atlas token maps are keyed by ID; individual token records do not carry that ID.
      tokenIds.push(tokenId);
      for (const definition of definitions) {
        const rawValue = token.resources?.[definition.key];
        const value = validResourceValue(rawValue);
        const entries = tokenEntries.get(definition.key) ?? [];
        entries.push({
          store, tokenId, value, rawValue: cloneStoredValue(rawValue),
          overriddenMax: cloneStoredValue(token.overriddenMax),
        });
        tokenEntries.set(definition.key, entries);
        if (value && !tokenValues.has(definition.key)) tokenValues.set(definition.key, value);
      }
    }
    // Keep empty token groups too: an active PartySync can hold the character's value even
    // when no copy of that character is currently placed on a map.
    stores.push({ store, tokenIds });
    for (const definition of definitions) {
      // Atlas PartySync keys every form by its canonical character id (the oldest linked asset),
      // not by each form's individual asset id.
      const entry = partyEntry(state, character.id, definition.key);
      const entries = partyValues.get(definition.key) ?? [];
      // The canonical party key is intentionally identical across map stores. Deduplicate only
      // when both the store and key match; otherwise one open map would be silently skipped.
      if (entry && !entries.some((candidate) => candidate.store === store && candidate.key === entry.key)) {
        entries.push({ store, ...entry });
      }
      if (entries.length) partyValues.set(definition.key, entries);
    }
  }

  // Atlas prefers a value held by a placed token; the played campaign's party value is the fallback.
  // Keep definitions without a held value too: they must block fallback to a Forge track, then report
  // the Atlas-equivalent `no-value` state instead of silently switching resource ownership.
  const resources = definitions.map((definition): AtlasRestResourceSnapshot => {
    const tokenValue = tokenValues.get(definition.key);
    if (tokenValue) return {
      ...definition, current: tokenValue.current, max: tokenValue.max, holder: 'token',
      tokenEntries: tokenEntries.get(definition.key) ?? [],
    };
    const partyEntries = partyValues.get(definition.key) ?? [];
    const partyValue = partyEntries[0];
    if (partyValue) return {
      ...definition, current: partyValue.value.current, max: partyValue.value.max, holder: 'party',
      partyKey: partyValue.key,
      partyEntries: partyEntries.map(({ store, key, value, maxByHand, rawValue }) => ({
        store, key, current: value.current, max: value.max,
        ...(maxByHand && { maxByHand: true as const }), rawValue: cloneStoredValue(rawValue),
      })),
      ...(partyValue.maxByHand && { maxByHand: true }),
    };
    return { ...definition, current: 0, max: 0, holder: 'none' };
  });
  return {
    characterAssetId: character.id,
    characterName: character.name ?? 'Character',
    collectionId: character.collection,
    resources,
    stores,
  };
}

/**
 * Re-reads every token and campaign value captured by the context before writing. The returned
 * receipt preserves each copy's own prior value so a failed note write can restore the exact state.
 * During a successful Rest, each form keeps its own maximum and reaches its own starting boundary
 * when the shared recovery calculation represents a full recovery.
 */
export function persistAtlasRestResourceChangesWithReceipt(
  context: AtlasRestResourceContext,
  changes: readonly AtlasRestResourceChange[],
): AtlasRestResourceCommit {
  const pending = changes.filter((change) => change.resourceKey && change.from !== change.to);
  const receipt: AtlasRestResourceRollbackReceipt = { tokenEntries: [], partyEntries: [] };
  if (pending.length === 0) return { updated: 0, receipt };
  const definitions = new Map(context.resources.map((resource) => [resource.key, resource]));

  for (const change of pending) {
    const definition = definitions.get(change.resourceKey);
    if (!definition || definition.current !== change.from || definition.max !== change.max) {
      throw new Error(`O Resource Atlas "${change.resourceKey}" mudou desde o cálculo do descanso. Reabra o descanso e tente novamente.`);
    }

    if (definition.holder === 'token') {
      const entries = definition.tokenEntries ?? [];
      const primary = entries.find((entry) => entry.value !== null)?.value;
      if (!primary || primary.current !== change.from || primary.max !== change.max || entries.length === 0) {
        throw new Error(`O Resource Atlas "${change.resourceKey}" mudou desde o cálculo do descanso. Reabra o descanso e tente novamente.`);
      }
      for (const entry of entries) {
        const token = entry.store.getState().objects?.tokens?.[entry.tokenId];
        if (!token
          || !sameStoredValue(token.resources?.[change.resourceKey], entry.rawValue)
          || !sameStoredValue(token.overriddenMax, entry.overriddenMax)) {
          throw new Error(`O Resource Atlas "${change.resourceKey}" mudou desde o cálculo do descanso. Reabra o descanso e tente novamente.`);
        }
      }
    } else if (definition.holder === 'party') {
      const entries = definition.partyEntries ?? [];
      const primary = entries[0];
      if (!primary || primary.current !== change.from || primary.max !== change.max) {
        throw new Error(`O Resource Atlas "${change.resourceKey}" mudou desde o cálculo do descanso. Reabra o descanso e tente novamente.`);
      }
      if (entries.some((entry) => entry.current !== primary.current
        || entry.max !== primary.max || entry.maxByHand !== primary.maxByHand)) {
        throw new Error(`O Resource Atlas "${change.resourceKey}" possui valores de campanha divergentes entre mapas e precisa ser sincronizado. Reabra o descanso e tente novamente.`);
      }
      for (const entry of entries) {
        const raw = entry.store.getState().partyValues?.[entry.key];
        if (!sameStoredValue(raw, entry.rawValue)) {
          throw new Error(`O Resource Atlas "${change.resourceKey}" mudou desde o cálculo do descanso. Reabra o descanso e tente novamente.`);
        }
      }
    } else {
      throw new Error(`O Resource Atlas "${change.resourceKey}" não possui um valor persistível. Reabra o descanso e tente novamente.`);
    }
  }

  let updated = 0;
  const tokenChanges = pending.filter((change) => definitions.get(change.resourceKey)?.holder === 'token');
  if (tokenChanges.length > 0) {
    for (const target of context.stores) {
      const state = target.store.getState();
      const tokens = state.objects?.tokens ?? {};
      if (typeof state.updateTokens !== 'function') continue;
      const updates: Array<{ id: string; changes: { resources: Record<string, AtlasResourceValueLike> } }> = [];
      for (const tokenId of target.tokenIds) {
        const token = tokens[tokenId];
        if (!token) continue;
        const nextResources = { ...(token.resources ?? {}) };
        let changed = false;
        for (const change of tokenChanges) {
          const before = token.resources?.[change.resourceKey];
          // The recovery calculation uses the selected (first held token) value as its shared
          // partial result. Preserve each form's own maximum, and map a full recovery to that
          // form's own starting boundary. The receipt still records each prior value for rollback.
          // A character's forms may hold different maxima. A full recovery reaches each form's
          // own starting boundary; a partial recovery applies the shared absolute current and
          // clamps it to that form's existing maximum. The source sync remains responsible for
          // changing non-manual maxima when the Forge note/template changes.
          const ownMax = token.resources?.[change.resourceKey]?.max ?? change.max;
          const atStart = change.direction === 'down' ? change.to >= change.max : change.to <= 0;
          const current = atStart
            ? (change.direction === 'down' ? ownMax : 0)
            : Math.max(0, Math.min(ownMax, change.to));
          const after = { current, max: ownMax };
          nextResources[change.resourceKey] = after;
          receipt.tokenEntries.push({
            store: target.store, tokenId, resourceKey: change.resourceKey,
            before: cloneStoredValue(before), after: { ...after },
            beforeOverriddenMax: cloneStoredValue(token.overriddenMax),
            afterOverriddenMax: cloneStoredValue(token.overriddenMax),
          });
          changed = true;
        }
        if (changed) updates.push({ id: tokenId, changes: { resources: nextResources } });
      }
      if (updates.length > 0) {
        // Atlas updateTokens is a single store write, so all forms on this map share one history step.
        state.updateTokens(updates);
        updated += updates.length;
      }
    }
  }

  const partyChanges = pending.filter((change) => definitions.get(change.resourceKey)?.holder === 'party');
  for (const change of partyChanges) {
    const definition = definitions.get(change.resourceKey)!;
    const entries = definition.partyEntries ?? [];
    const byStore = new Map<AtlasStoreLike, Record<string, { current: number; max: number; maxByHand?: true }>>();
    for (const entry of entries) {
      if (typeof entry.store.setState !== 'function') continue;
      const state = entry.store.getState();
      const values = byStore.get(entry.store) ?? { ...(state.partyValues ?? {}) };
      const ownMax = entry.max;
      const after = {
        current: Math.max(0, Math.min(ownMax, change.to)),
        max: ownMax,
        ...(entry.maxByHand && { maxByHand: true as const }),
      };
      const before = state.partyValues?.[entry.key];
      values[entry.key] = after;
      receipt.partyEntries.push({ store: entry.store, key: entry.key, before: cloneStoredValue(before), after: { ...after } });
      byStore.set(entry.store, values);
    }
    // PartySync persists each form's party value through Atlas' own campaign flow.
    for (const [store, partyValues] of byStore) {
      store.setState?.({ partyValues });
      updated += 1;
    }
  }

  if (updated === 0) throw new Error('Nenhum token ou valor de campanha do Atlas foi encontrado para salvar os Resources desta coleção.');
  return { updated, receipt };
}

/** Number-returning compatibility wrapper for callers that do not need rollback. */
export function persistAtlasRestResourceChanges(
  context: AtlasRestResourceContext,
  changes: readonly AtlasRestResourceChange[],
): number {
  return persistAtlasRestResourceChangesWithReceipt(context, changes).updated;
}

/** Restores exactly the values written by one commit, but refuses to overwrite intervening edits. */
export function rollbackAtlasRestResourceChanges(receipt: AtlasRestResourceRollbackReceipt): void {
  for (const entry of receipt.tokenEntries) {
    const token = entry.store.getState().objects?.tokens?.[entry.tokenId];
    if (!token || !sameStoredValue(token.resources?.[entry.resourceKey], entry.after)
      || !sameStoredValue(token.overriddenMax, entry.afterOverriddenMax)) {
      throw new Error(`O Resource Atlas "${entry.resourceKey}" mudou após a gravação; o rollback foi interrompido para preservar a alteração mais recente.`);
    }
  }
  for (const entry of receipt.partyEntries) {
    const raw = entry.store.getState().partyValues?.[entry.key];
    if (!sameStoredValue(raw, entry.after)) {
      throw new Error('Um Resource de campanha do Atlas mudou após a gravação; o rollback foi interrompido para preservar a alteração mais recente.');
    }
  }

  const tokenUpdatesByStore = new Map<AtlasStoreLike, Map<string, Record<string, AtlasResourceValueLike>>>();
  for (const entry of receipt.tokenEntries) {
    const state = entry.store.getState();
    const token = state.objects?.tokens?.[entry.tokenId];
    if (!token || typeof state.updateTokens !== 'function') continue;
    const byToken = tokenUpdatesByStore.get(entry.store) ?? new Map<string, Record<string, AtlasResourceValueLike>>();
    const resources = byToken.get(entry.tokenId) ?? { ...(token.resources ?? {}) };
    if (entry.before === undefined) delete resources[entry.resourceKey];
    else resources[entry.resourceKey] = cloneStoredValue(entry.before) as AtlasResourceValueLike;
    byToken.set(entry.tokenId, resources);
    tokenUpdatesByStore.set(entry.store, byToken);
  }
  for (const [store, byToken] of tokenUpdatesByStore) {
    const state = store.getState();
    const updates = [...byToken].map(([id, resources]) => ({ id, changes: { resources } }));
    state.updateTokens?.(updates);
  }

  const partyValuesByStore = new Map<AtlasStoreLike, Record<string, { current: number; max: number; maxByHand?: true }>>();
  for (const entry of receipt.partyEntries) {
    const state = entry.store.getState();
    if (typeof entry.store.setState !== 'function') continue;
    const values = partyValuesByStore.get(entry.store) ?? { ...(state.partyValues ?? {}) };
    if (entry.before === undefined) delete values[entry.key];
    else values[entry.key] = cloneStoredValue(entry.before) as { current: number; max: number; maxByHand?: true };
    partyValuesByStore.set(entry.store, values);
  }
  for (const [store, partyValues] of partyValuesByStore) store.setState?.({ partyValues });
}
