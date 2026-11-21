import type { App } from 'obsidian';
import { parseDiceField } from '../statblocks/diceFieldEditorModel.ts';
import { parseForgeRestDiceSet, type ForgeRestDiceSet } from '../statblocks/restDiceRoller.ts';
import { createAtlasDicePresetLookCandidate, type AtlasDicePresetLook } from './atlasDicePresetLook.ts';
import { getAtlasMapViewContexts, inspectAtlasRuntime } from './atlasRuntime.ts';
import { ATLAS_DICE_PRESETS_MINIMUM_VERSION, compareSemanticVersions } from './atlasVersionAdapter.ts';

const MAX_PRESETS = 40;
const MAX_PRESET_NAME = 40;
const MAX_PRESET_FORMULA = 100;
const MAX_DICE_ROW = 10;
const STANDARD_DICE_ROW = [4, 6, 8, 10, 12, 20, 100] as const;

interface AtlasDicePresetLike {
  id: string;
  name: string;
  formula: string;
  look?: AtlasDicePresetLook;
}

interface AtlasCollectionLike {
  id: string;
  name?: string;
  settings?: unknown;
}

interface AtlasTokenAssetLike {
  collection?: string;
  statblockPath?: string;
}

interface AtlasCollectionSettingsLike {
  dicePresets?: unknown;
  diceRow?: unknown;
  [key: string]: unknown;
}

type AtlasDiceRowSlotLike = { kind: 'die'; sides: number } | { kind: 'preset'; id: string };

export interface AtlasDicePresetPinState {
  readonly id: string;
  readonly name: string;
  readonly formula: string;
  readonly pinned: boolean;
}

export type AtlasDicePresetPinResult =
  | { readonly ok: true; readonly pinned: boolean; readonly presetName: string }
  | { readonly ok: false; readonly reason: 'preset-not-found' | 'row-full' | 'collection-unavailable' };

interface AtlasAssetServiceLike {
  getCollections?(): Promise<AtlasCollectionLike[]>;
  loadedCollections?(): AtlasCollectionLike[];
  getTokenAssets?(): Promise<AtlasTokenAssetLike[]>;
  loadedTokenAssets?(): AtlasTokenAssetLike[];
  getDefaultCollectionId?(): string;
  getCollectionSettings?(collectionId: string): unknown;
  updateCollectionSettings?(collectionId: string, settings: { dicePresets?: AtlasDicePresetLike[]; diceRow?: AtlasDiceRowSlotLike[] }): Promise<void>;
}

interface AtlasStoreLike {
  getState?(): unknown;
}

interface AtlasServiceManagerLike {
  getAssetService?(): AtlasAssetServiceLike | null;
  getStore?(): AtlasStoreLike | null;
}

interface AtlasMapViewLike {
  containerEl?: { isShown?: () => boolean };
  serviceManager?: AtlasServiceManagerLike;
}

export interface AtlasSavedRollCollection {
  readonly service: AtlasAssetServiceLike;
  readonly collectionId: string;
  readonly collectionName: string;
}

export type AtlasSavedRollSaveResult =
  | { readonly ok: true; readonly preset: AtlasDicePresetLike }
  | { readonly ok: false; readonly reason: 'invalid-name' | 'invalid-formula' | 'limit-reached' | 'collection-unavailable' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseAtlasDicePresetLook(value: unknown): AtlasDicePresetLook | null {
  if (!isRecord(value) || value.readOnly === true
    || (typeof value.format === 'number' && value.format > 1)) return null;
  const parsed = parseForgeRestDiceSet({ ...value, id: 'saved-roll-look', name: 'Saved Roll Look' });
  if (!parsed
    || (value.explode !== undefined && !parsed.explode)
    || (value.advantage !== undefined && !parsed.advantage)
    || (value.disadvantage !== undefined && !parsed.disadvantage)) return null;
  return {
    dice: parsed.dice.map((die) => ({ ...die })),
    crit: parsed.crit,
    ...(parsed.explode ? { explode: { ...parsed.explode } } : {}),
    ...(parsed.advantage ? { advantage: { ...parsed.advantage } } : {}),
    ...(parsed.disadvantage ? { disadvantage: { ...parsed.disadvantage } } : {}),
  };
}

function isUsablePreset(value: unknown): value is AtlasDicePresetLike {
  if (!isRecord(value)) return false;
  const { id, name, formula, look } = value;
  if (typeof id !== 'string' || id.length === 0 || id.length > 64) return false;
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > MAX_PRESET_NAME) return false;
  if (typeof formula !== 'string' || formula.length > MAX_PRESET_FORMULA) return false;
  const cleanFormula = formula.trim();
  if (look !== undefined && (cleanFormula === '' || /^[+-]\d{1,2}$/.test(cleanFormula))
    && parseAtlasDicePresetLook(look)) return true;
  return cleanFormula.length > 0 && !/^[+-]\d+$/.test(cleanFormula);
}

function validPresetCount(raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  const ids = new Set<string>();
  let count = 0;
  for (const candidate of raw) {
    if (!isUsablePreset(candidate) || ids.has(candidate.id)) continue;
    ids.add(candidate.id);
    count += 1;
    if (count >= MAX_PRESETS) return count;
  }
  return count;
}

function validPresets(raw: unknown): AtlasDicePresetLike[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set<string>();
  const presets: AtlasDicePresetLike[] = [];
  for (const candidate of raw) {
    if (!isUsablePreset(candidate) || ids.has(candidate.id)) continue;
    ids.add(candidate.id);
    presets.push(candidate);
    if (presets.length >= MAX_PRESETS) break;
  }
  return presets;
}

function isValidDieSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 2 && value <= 1000;
}

function readDiceRow(raw: unknown, presets: readonly AtlasDicePresetLike[]): AtlasDiceRowSlotLike[] {
  // An absent row means Atlas' standard seven-die row; an explicit empty row stays empty.
  if (!Array.isArray(raw)) return STANDARD_DICE_ROW.map((sides): AtlasDiceRowSlotLike => ({ kind: 'die', sides }));
  const row: AtlasDiceRowSlotLike[] = [];
  for (const candidate of raw) {
    if (!isRecord(candidate)) continue;
    let slot: AtlasDiceRowSlotLike | null = null;
    if (candidate.kind === 'die' && isValidDieSize(candidate.sides)) {
      slot = { kind: 'die', sides: candidate.sides };
    } else if (candidate.kind === 'preset' && typeof candidate.id === 'string'
      && presets.some((preset) => preset.id === candidate.id)) {
      slot = { kind: 'preset', id: candidate.id };
    }
    if (!slot) continue;
    const nextSlot = slot;
    const duplicate = row.some((kept) => {
      if (kept.kind !== nextSlot.kind) return false;
      if (kept.kind === 'die' && nextSlot.kind === 'die') return kept.sides === nextSlot.sides;
      return kept.kind === 'preset' && nextSlot.kind === 'preset' && kept.id === nextSlot.id;
    });
    if (!duplicate) row.push(nextSlot);
    if (row.length >= MAX_DICE_ROW) break;
  }
  return row;
}

function readCollectionSettings(collection: AtlasSavedRollCollection): AtlasCollectionSettingsLike | null {
  try {
    const value = collection.service.getCollectionSettings?.(collection.collectionId);
    return isRecord(value) ? value as AtlasCollectionSettingsLike : null;
  } catch {
    return null;
  }
}

/** Saved rolls with the same exact formula and their current pin state in the Atlas tray. */
export function getAtlasDicePresetPinStates(
  collection: AtlasSavedRollCollection,
  formula: string,
  activeSet?: ForgeRestDiceSet | null,
): AtlasDicePresetPinState[] {
  const settings = readCollectionSettings(collection);
  if (!settings) return [];
  const presets = validPresets(settings.dicePresets);
  const row = readDiceRow(settings.diceRow, presets);
  const pinned = new Set(row.filter((slot): slot is Extract<AtlasDiceRowSlotLike, { kind: 'preset' }> => slot.kind === 'preset')
    .map((slot) => slot.id));
  const cleanFormula = formula.trim();
  const candidate = createAtlasDicePresetLookCandidate(cleanFormula, activeSet);
  return presets.filter((preset) => {
    if (preset.formula.trim() === cleanFormula) return true;
    if (!candidate || !isRecord(preset.look)) return false;
    const parsedLook = parseAtlasDicePresetLook(preset.look);
    if (!parsedLook || preset.formula.trim() !== candidate.formula) return false;
    // Rules, names and colours are deliberately independent after saving. Match the source roll by its dice
    // groups and bonus so that changing the collection's default Dice Set does not hide an existing preset.
    return parsedLook.dice.length === candidate.look.dice.length
      && parsedLook.dice.every((die, index) => {
        const sourceDie = candidate.look.dice[index];
        return !!sourceDie && die.count === sourceDie.count && die.sides === sourceDie.sides;
      });
  }).map((preset) => ({
    id: preset.id,
    name: preset.name,
    formula: preset.formula,
    pinned: pinned.has(preset.id),
  }));
}

/** Adds or removes one saved roll in Atlas' native dice row, preserving every other row entry. */
export async function toggleAtlasDicePresetPin(
  collection: AtlasSavedRollCollection,
  presetId: string,
): Promise<AtlasDicePresetPinResult> {
  const settings = readCollectionSettings(collection);
  if (!settings || typeof collection.service.updateCollectionSettings !== 'function') {
    return { ok: false, reason: 'collection-unavailable' };
  }
  const presets = validPresets(settings.dicePresets);
  const preset = presets.find((entry) => entry.id === presetId);
  if (!preset) return { ok: false, reason: 'preset-not-found' };

  const row = readDiceRow(settings.diceRow, presets);
  const alreadyPinned = row.some((slot) => slot.kind === 'preset' && slot.id === presetId);
  if (alreadyPinned) {
    const nextRow = row.filter((slot) => !(slot.kind === 'preset' && slot.id === presetId));
    try {
      await collection.service.updateCollectionSettings(collection.collectionId, { diceRow: nextRow });
      return { ok: true, pinned: false, presetName: preset.name };
    } catch {
      return { ok: false, reason: 'collection-unavailable' };
    }
  }

  if (row.length >= MAX_DICE_ROW) return { ok: false, reason: 'row-full' };
  try {
    await collection.service.updateCollectionSettings(collection.collectionId, {
      diceRow: [...row, { kind: 'preset', id: presetId }],
    });
    return { ok: true, pinned: true, presetName: preset.name };
  } catch {
    return { ok: false, reason: 'collection-unavailable' };
  }
}

function collectionIdFromPath(path: string, collections: readonly AtlasCollectionLike[]): string | null {
  const match = /^atlas-vtt\/collections\/([^/]+)\//.exec(path);
  if (!match) return null;
  return collections.some((collection) => collection.id === match[1]) ? match[1]! : null;
}

function storeIsPlayerView(store: AtlasStoreLike | null | undefined): boolean {
  try {
    const state = store?.getState?.();
    return isRecord(state) && state.isPlayerView === true;
  } catch {
    return false;
  }
}

interface ServiceCandidate {
  service: AtlasAssetServiceLike;
  visible: boolean;
}

export function supportsAtlasDicePresets(app: App): boolean {
  const runtime = inspectAtlasRuntime(app);
  const version = runtime.version;
  const meetsFeatureMinimum = version !== null
    && (compareSemanticVersions(version, ATLAS_DICE_PRESETS_MINIMUM_VERSION) ?? -1) >= 0;
  return runtime.runtimeSupported && meetsFeatureMinimum;
}

function serviceCandidates(app: App): ServiceCandidate[] {
  // Collection saved rolls (`dicePresets`) require the 0.18.0+ feature baseline.
  if (!supportsAtlasDicePresets(app)) return [];

  const candidates: ServiceCandidate[] = [];
  for (const context of getAtlasMapViewContexts(app)) {
    const view = context.view as AtlasMapViewLike | undefined;
    const manager = view?.serviceManager;
    if (!manager || storeIsPlayerView(manager.getStore?.())) continue;
    const service = manager.getAssetService?.();
    if (!service || typeof service.updateCollectionSettings !== 'function'
      || typeof service.getCollectionSettings !== 'function') continue;
    const visible = typeof view?.containerEl?.isShown === 'function' ? view.containerEl.isShown() : true;
    candidates.push({ service, visible });
  }
  return candidates.sort((a, b) => Number(b.visible) - Number(a.visible));
}

async function collectionsOf(service: AtlasAssetServiceLike): Promise<AtlasCollectionLike[]> {
  if (typeof service.getCollections === 'function') {
    try {
      const collections = await service.getCollections();
      if (Array.isArray(collections)) return collections;
    } catch { /* use the already-loaded collection snapshot, if any */ }
  }
  try {
    const collections = service.loadedCollections?.();
    return Array.isArray(collections) ? collections : [];
  } catch {
    return [];
  }
}

async function tokenAssetsOf(service: AtlasAssetServiceLike): Promise<AtlasTokenAssetLike[]> {
  if (typeof service.getTokenAssets === 'function') {
    try {
      const assets = await service.getTokenAssets();
      if (Array.isArray(assets)) return assets;
    } catch { /* use the already-loaded token snapshot, if any */ }
  }
  try {
    const assets = service.loadedTokenAssets?.();
    return Array.isArray(assets) ? assets : [];
  } catch {
    return [];
  }
}

/** Resolve the collection an Atlas statblock belongs to using Atlas AssetService only. */
export async function resolveAtlasSavedRollCollection(app: App, statblockPath: string): Promise<AtlasSavedRollCollection | null> {
  for (const { service } of serviceCandidates(app)) {
    const collections = await collectionsOf(service);
    if (collections.length === 0) continue;

    let collectionId = collectionIdFromPath(statblockPath, collections);
    if (!collectionId) {
      const assets = await tokenAssetsOf(service);
      const linked = new Set(assets
        .filter((asset) => asset.statblockPath === statblockPath && typeof asset.collection === 'string')
        .map((asset) => asset.collection!)
        .filter((id) => collections.some((collection) => collection.id === id)));
      if (linked.size === 1) collectionId = [...linked][0]!;
    }

    collectionId ??= service.getDefaultCollectionId?.() ?? null;
    const collection = collections.find((entry) => entry.id === collectionId);
    if (!collection) continue;
    return { service, collectionId: collection.id, collectionName: collection.name ?? collection.id };
  }
  return null;
}

/** Save a plain formula preset using Atlas' collection-settings API; all unrelated settings are left intact. */
export async function saveAtlasDicePreset(
  collection: AtlasSavedRollCollection,
  name: string,
  formula: string,
  id: string = crypto.randomUUID(),
  look?: AtlasDicePresetLook,
): Promise<AtlasSavedRollSaveResult> {
  const cleanName = name.trim();
  const cleanFormula = formula.trim();
  if (!cleanName || cleanName.length > MAX_PRESET_NAME) return { ok: false, reason: 'invalid-name' };
  let cleanLook: AtlasDicePresetLook | undefined;
  if (look !== undefined) {
    const validated = parseAtlasDicePresetLook(look);
    if (!validated || cleanFormula.length > 4 || (cleanFormula !== '' && !/^[+-]\d{1,2}$/.test(cleanFormula))) {
      return { ok: false, reason: 'invalid-formula' };
    }
    cleanLook = validated;
  } else if (!cleanFormula || cleanFormula.length > MAX_PRESET_FORMULA || !parseDiceField(cleanFormula)) {
    return { ok: false, reason: 'invalid-formula' };
  }

  let settingsValue: unknown;
  try {
    settingsValue = collection.service.getCollectionSettings?.(collection.collectionId);
  } catch {
    return { ok: false, reason: 'collection-unavailable' };
  }
  const settings = isRecord(settingsValue) ? settingsValue as AtlasCollectionSettingsLike : {};
  const existing = Array.isArray(settings.dicePresets) ? settings.dicePresets.slice() : [];
  if (validPresetCount(existing) >= MAX_PRESETS) return { ok: false, reason: 'limit-reached' };

  const existingIds = new Set(existing.filter(isRecord).map((entry) => entry.id).filter((entry): entry is string => typeof entry === 'string'));
  let uniqueId = id;
  while (!uniqueId || existingIds.has(uniqueId)) uniqueId = crypto.randomUUID();
  const preset: AtlasDicePresetLike = { id: uniqueId, name: cleanName, formula: cleanFormula, ...(cleanLook ? { look: cleanLook } : {}) };
  try {
    await collection.service.updateCollectionSettings!(collection.collectionId, { dicePresets: [...existing, preset] });
  } catch {
    return { ok: false, reason: 'collection-unavailable' };
  }
  return { ok: true, preset };
}

/** Exposes Atlas' limits for the save dialog and tests without importing Atlas code. */
export const ATLAS_DICE_PRESET_LIMITS = Object.freeze({ count: MAX_PRESETS, nameLength: MAX_PRESET_NAME, formulaLength: MAX_PRESET_FORMULA, rowLength: MAX_DICE_ROW });
