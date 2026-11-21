import type { App } from 'obsidian';
import type { ForgeTemplate, JsonRecord } from '../templates/forgeTemplate.ts';
import { getAtlasMapViewContexts } from './atlasRuntime.ts';
import {
  atlasResourceReadsForgeField,
  atlasRoleTemplateIdsForCollection,
  effectiveAtlasCollectionResources,
  type AtlasCollectionResourceDefinition,
} from './atlasResourceCatalog.ts';

export { atlasResourceReadsForgeField, atlasResourceSharesForgeFieldKey, atlasRoleTemplateIdsForCollection } from './atlasResourceCatalog.ts';
export type { AtlasCollectionResourceDefinition } from './atlasResourceCatalog.ts';

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

function serviceViews(app: App): Array<{ view: AtlasMapViewLike; service: AtlasAssetServiceLike; store: AtlasStoreLike; shown: boolean }> {
  const found: Array<{ view: AtlasMapViewLike; service: AtlasAssetServiceLike; store: AtlasStoreLike; shown: boolean }> = [];
  for (const context of getAtlasMapViewContexts(app)) {
    const view = context.view as AtlasMapViewLike | undefined;
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

export interface AtlasTemplateResourceMatch {
  readonly collectionId: string;
  readonly collectionName: string;
  readonly resource: AtlasCollectionResourceDefinition;
  readonly fieldKey: string;
  readonly recoverable: boolean;
}

/**
 * Reads the Resource definitions of collections whose Atlas statblock roles use
 * this Template and identifies the Forge Field each definition reads. This is
 * catalog-only: it never changes collection settings, token values, or notes.
 */
export function atlasResourceMatchesForTemplate(app: App, template: ForgeTemplate): AtlasTemplateResourceMatch[] {
  const views = serviceViews(app);
  const service = views[0]?.service;
  if (!service) return [];
  const collections = service.loadedCollections?.() ?? [];
  const matches: AtlasTemplateResourceMatch[] = [];

  for (const collection of collections) {
    let loadedSettings: unknown;
    try {
      loadedSettings = service.getCollectionSettings?.(collection.id) ?? collection.settings;
    } catch {
      loadedSettings = collection.settings;
    }
    const settings = isRecord(loadedSettings) ? loadedSettings : {};
    // Atlas uses explicit roles first, then the recorded preset, then generic Creature/NPC roles.
    if (!atlasRoleTemplateIdsForCollection(settings).includes(template.id)) continue;

    const resources = effectiveAtlasCollectionResources(settings);
    for (const resource of resources) {
      const field = template.fields.find((candidate) => atlasResourceReadsForgeField(resource, candidate));
      if (!field) continue;
      matches.push({
        collectionId: collection.id,
        collectionName: collection.name ?? collection.id,
        resource,
        fieldKey: field.key,
        recoverable: resource.direction !== 'static',
      });
    }
  }
  return matches;
}

/** Collection Resource Fields offered in the Template Rest editor. Static values are not spendable. */
export function atlasResourceFieldKeysForTemplate(app: App, template: ForgeTemplate): string[] {
  return [...new Set(atlasResourceMatchesForTemplate(app, template)
    .filter((match) => match.recoverable)
    .map((match) => match.fieldKey))];
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
  const definitions = effectiveAtlasCollectionResources(settings);
  if (definitions.length === 0) return null;

  const stores: AtlasResourceStoreTarget[] = [];
  const tokenValues = new Map<string, AtlasResourceValueLike>();
  const tokenEntries = new Map<string, { store: AtlasStoreLike; tokenId: string; value: AtlasResourceValueLike | null; rawValue: unknown; overriddenMax: unknown }[]>();
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

  // Complete every stale-state and write-capability check before the first store mutation.
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

  const tokenChanges = pending.filter((change) => definitions.get(change.resourceKey)?.holder === 'token');
  const partyChanges = pending.filter((change) => definitions.get(change.resourceKey)?.holder === 'party');
  const tokenPlans: Array<{
    state: AtlasTokenUpdateState;
    updates: Array<{ id: string; changes: { resources: Record<string, AtlasResourceValueLike> } }>;
  }> = [];
  const partyPlans: Array<{
    store: AtlasStoreLike;
    values: Record<string, { current: number; max: number; maxByHand?: true }>;
  }> = [];

  if (tokenChanges.length > 0) {
    for (const target of context.stores) {
      if (target.tokenIds.length === 0) continue;
      const state = target.store.getState();
      if (typeof state.updateTokens !== 'function') {
        throw new Error('Um mapa do Atlas não oferece updateTokens para salvar os Resources. Nenhuma alteração foi aplicada.');
      }
      const tokens = state.objects?.tokens ?? {};
      const nextByToken = new Map<string, Record<string, AtlasResourceValueLike>>();
      for (const tokenId of target.tokenIds) {
        const token = tokens[tokenId];
        if (!token) {
          throw new Error(`O token Atlas "${tokenId}" mudou desde o cálculo do descanso. Reabra o descanso e tente novamente.`);
        }
        const nextResources: Record<string, AtlasResourceValueLike> = { ...(token.resources ?? {}) };
        for (const change of tokenChanges) {
          const before = token.resources?.[change.resourceKey];
          const storedMax = before?.max;
          const ownMax = typeof storedMax === 'number' && Number.isFinite(storedMax) && storedMax >= 0
            ? storedMax
            : change.max;
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
        }
        nextByToken.set(tokenId, nextResources);
      }
      const updates = [...nextByToken].map(([id, resources]) => ({ id, changes: { resources } }));
      if (updates.length > 0) tokenPlans.push({ state, updates });
    }
    if (receipt.tokenEntries.length === 0) {
      throw new Error('Nenhum token do Atlas foi encontrado para salvar os Resources desta coleção.');
    }
  }

  if (partyChanges.length > 0) {
    const byStore = new Map<AtlasStoreLike, Record<string, { current: number; max: number; maxByHand?: true }>>();
    for (const change of partyChanges) {
      const definition = definitions.get(change.resourceKey)!;
      for (const entry of definition.partyEntries ?? []) {
        if (typeof entry.store.setState !== 'function') {
          throw new Error('Um mapa do Atlas não oferece setState para salvar os Resources de campanha. Nenhuma alteração foi aplicada.');
        }
        const state = entry.store.getState();
        const values = byStore.get(entry.store) ?? { ...(state.partyValues ?? {}) };
        const after = {
          current: Math.max(0, Math.min(entry.max, change.to)),
          max: entry.max,
          ...(entry.maxByHand && { maxByHand: true as const }),
        };
        const before = state.partyValues?.[entry.key];
        values[entry.key] = after;
        receipt.partyEntries.push({ store: entry.store, key: entry.key, before: cloneStoredValue(before), after: { ...after } });
        byStore.set(entry.store, values);
      }
    }
    for (const [store, values] of byStore) {
      if (typeof store.setState !== 'function') {
        throw new Error('Um mapa do Atlas não oferece setState para salvar os Resources de campanha. Nenhuma alteração foi aplicada.');
      }
      partyPlans.push({ store, values });
    }
    if (receipt.partyEntries.length === 0) {
      throw new Error('Nenhum valor de campanha do Atlas foi encontrado para salvar os Resources desta coleção.');
    }
  }

  let updated = 0;
  try {
    // Atlas updateTokens groups all token copies in one map into one store write/history step.
    for (const plan of tokenPlans) {
      plan.state.updateTokens?.(plan.updates);
      updated += plan.updates.length;
    }
    // PartySync owns campaign persistence; write each map store once with the complete value map.
    for (const plan of partyPlans) {
      plan.store.setState?.({ partyValues: plan.values });
      updated += 1;
    }
  } catch (error) {
    // A later map/store may fail after earlier ones have already accepted their writes.
    // The receipt was fully prepared before mutation, so restore every changed entry while
    // leaving entries that never changed untouched. Rollback itself refuses to overwrite
    // values that no longer match either the pre-commit or committed snapshots.
    try {
      rollbackAtlasRestResourceChanges(receipt);
    } catch (rollbackError) {
      const first = error instanceof Error ? error.message : String(error);
      const second = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      throw new Error(`${first} Além disso, não foi possível reverter as alterações parciais dos Resources Atlas: ${second}`);
    }
    throw error;
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
  const tokenEntriesToRestore: typeof receipt.tokenEntries = [];
  const partyEntriesToRestore: typeof receipt.partyEntries = [];

  // Preflight the entire receipt before making any compensation write. A value that is
  // already at `before` is untouched (or already restored); a value at neither snapshot
  // belongs to a later edit and prevents the rollback from overwriting it.
  for (const entry of receipt.tokenEntries) {
    const token = entry.store.getState().objects?.tokens?.[entry.tokenId];
    if (!token) {
      throw new Error(`O token Atlas "${entry.tokenId}" não está mais disponível; o rollback foi interrompido para preservar o estado atual.`);
    }
    const current = token.resources?.[entry.resourceKey];
    const override = token.overriddenMax;
    const atBefore = sameStoredValue(current, entry.before)
      && sameStoredValue(override, entry.beforeOverriddenMax);
    const atAfter = sameStoredValue(current, entry.after)
      && sameStoredValue(override, entry.afterOverriddenMax);
    if (atBefore) continue;
    if (!atAfter) {
      throw new Error(`O Resource Atlas "${entry.resourceKey}" mudou após a gravação; o rollback foi interrompido para preservar a alteração mais recente.`);
    }
    tokenEntriesToRestore.push(entry);
  }
  for (const entry of receipt.partyEntries) {
    const raw = entry.store.getState().partyValues?.[entry.key];
    if (sameStoredValue(raw, entry.before)) continue;
    if (!sameStoredValue(raw, entry.after)) {
      throw new Error('Um Resource de campanha do Atlas mudou após a gravação; o rollback foi interrompido para preservar a alteração mais recente.');
    }
    partyEntriesToRestore.push(entry);
  }

  const rollbackFailures: string[] = [];
  const tokenUpdatesByStore = new Map<AtlasStoreLike, Map<string, Record<string, AtlasResourceValueLike>>>();
  for (const entry of tokenEntriesToRestore) {
    try {
      const state = entry.store.getState();
      const token = state.objects?.tokens?.[entry.tokenId];
      if (!token) {
        rollbackFailures.push(`O token Atlas "${entry.tokenId}" deixou de existir durante o rollback.`);
        continue;
      }
      const byToken = tokenUpdatesByStore.get(entry.store) ?? new Map<string, Record<string, AtlasResourceValueLike>>();
      const resources = byToken.get(entry.tokenId) ?? { ...(token.resources ?? {}) };
      if (entry.before === undefined) delete resources[entry.resourceKey];
      else resources[entry.resourceKey] = cloneStoredValue(entry.before) as AtlasResourceValueLike;
      byToken.set(entry.tokenId, resources);
      tokenUpdatesByStore.set(entry.store, byToken);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      rollbackFailures.push(`Não foi possível preparar a restauração do token Atlas "${entry.tokenId}": ${detail}`);
    }
  }

  // A failing map must not prevent independent maps or PartySync stores from being
  // compensated. Atlas store methods can throw after mutating, so verify the actual
  // post-call state instead of treating every thrown error as a failed restoration.
  for (const [store, byToken] of tokenUpdatesByStore) {
    let writeError: unknown = null;
    try {
      const state = store.getState();
      if (typeof state.updateTokens !== 'function') throw new Error('updateTokens não está disponível');
      const updates = [...byToken].map(([id, resources]) => ({ id, changes: { resources } }));
      state.updateTokens(updates);
    } catch (error) {
      writeError = error;
    }

    try {
      const state = store.getState();
      const entries = tokenEntriesToRestore.filter((entry) => entry.store === store);
      const restored = entries.every((entry) => {
        const token = state.objects?.tokens?.[entry.tokenId];
        return !!token
          && sameStoredValue(token.resources?.[entry.resourceKey], entry.before)
          && sameStoredValue(token.overriddenMax, entry.beforeOverriddenMax);
      });
      if (!restored) {
        const detail = writeError instanceof Error ? `: ${writeError.message}` : '';
        rollbackFailures.push(`Não foi possível restaurar todos os Resources de tokens de um mapa Atlas${detail}.`);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      rollbackFailures.push(`Não foi possível verificar a restauração dos Resources de um mapa Atlas: ${detail}`);
    }
  }

  const partyValuesByStore = new Map<AtlasStoreLike, Record<string, { current: number; max: number; maxByHand?: true }>>();
  for (const entry of partyEntriesToRestore) {
    try {
      const state = entry.store.getState();
      const values = partyValuesByStore.get(entry.store) ?? { ...(state.partyValues ?? {}) };
      if (entry.before === undefined) delete values[entry.key];
      else values[entry.key] = cloneStoredValue(entry.before) as { current: number; max: number; maxByHand?: true };
      partyValuesByStore.set(entry.store, values);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      rollbackFailures.push(`Não foi possível preparar a restauração de um Resource de campanha do Atlas: ${detail}`);
    }
  }

  for (const [store, partyValues] of partyValuesByStore) {
    let writeError: unknown = null;
    try {
      if (typeof store.setState !== 'function') throw new Error('setState não está disponível');
      store.setState({ partyValues });
    } catch (error) {
      writeError = error;
    }

    try {
      const currentValues = store.getState().partyValues ?? {};
      const entries = partyEntriesToRestore.filter((entry) => entry.store === store);
      const restored = entries.every((entry) => sameStoredValue(currentValues[entry.key], entry.before));
      if (!restored) {
        const detail = writeError instanceof Error ? `: ${writeError.message}` : '';
        rollbackFailures.push(`Não foi possível restaurar todos os Resources de campanha de um mapa Atlas${detail}.`);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      rollbackFailures.push(`Não foi possível verificar a restauração dos Resources de campanha do Atlas: ${detail}`);
    }
  }

  if (rollbackFailures.length > 0) {
    throw new Error(`O rollback dos Resources do Atlas foi parcial: ${rollbackFailures.join(' ')}`);
  }
}
