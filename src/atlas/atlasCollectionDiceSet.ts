import type { App } from 'obsidian';
import { forgeRestDiceSetById, forgeRestDefaultDiceSet, parseForgeRestDiceSet, type ForgeRestDiceSet } from '../statblocks/restDiceRoller.ts';
import { parseRollGroups } from '../statblocks/atlasDiceEngine/diceSetNotation.ts';
import { loadAtlasSystemPresetRules } from './atlasSystemPresetRules.ts';

interface VaultFileLike {
  path: string;
  extension?: string;
}

interface CollectionSettingsLike {
  diceSetId?: unknown;
  dice?: unknown;
  systemPresetId?: unknown;
}

interface AssetMetadataLike {
  collections?: Record<string, { id?: string; name?: string; createdAt?: number; settings?: CollectionSettingsLike } | undefined>;
  assets?: Record<string, { type?: string; statblockPath?: string; collection?: string } | undefined>;
  defaultCollectionId?: string;
}

interface VaultLike {
  adapter?: { read?: (path: string) => Promise<string> };
  getFiles?: () => VaultFileLike[];
  cachedRead?: (file: VaultFileLike) => Promise<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(app: App, path: string): Promise<unknown> {
  const vault = (app as unknown as { vault?: VaultLike }).vault;
  if (typeof vault?.adapter?.read === 'function') {
    try { return JSON.parse(await vault.adapter.read(path)) as unknown; } catch { /* try the next source */ }
  }
  const file = vault?.getFiles?.().find((entry) => entry.path === path);
  if (file && typeof vault?.cachedRead === 'function') {
    try { return JSON.parse(await vault.cachedRead(file)) as unknown; } catch { /* unavailable */ }
  }
  return null;
}

async function assetMetadataOf(app: App): Promise<AssetMetadataLike | null> {
  for (const path of ['atlas-vtt/.atlas-data/assets-metadata.json', 'atlas-vtt/assets-metadata.json']) {
    const value = await readJson(app, path);
    if (isRecord(value)) return value as AssetMetadataLike;
  }
  return null;
}

function defaultCollectionId(metadata: AssetMetadataLike): string | null {
  const collections = metadata.collections ?? {};
  const recorded = metadata.defaultCollectionId;
  if (recorded && collections[recorded]) return recorded;
  if (collections.default) return 'default';
  const oldest = Object.values(collections)
    .filter((entry): entry is NonNullable<typeof entry> => !!entry)
    .sort((a, b) => (a.createdAt ?? Number.MAX_SAFE_INTEGER) - (b.createdAt ?? Number.MAX_SAFE_INTEGER))[0];
  return oldest?.id ?? Object.keys(collections)[0] ?? null;
}

function collectionIdForStatblock(path: string, metadata: AssetMetadataLike): string | null {
  const folder = /^atlas-vtt\/collections\/([^/]+)\//.exec(path)?.[1];
  if (folder && metadata.collections?.[folder]) return folder;

  const linked = new Set(Object.values(metadata.assets ?? {})
    .filter((asset) => asset?.type === 'token' && asset.statblockPath === path && typeof asset.collection === 'string')
    .map((asset) => asset!.collection!)
    .filter((id) => !!metadata.collections?.[id]));
  return linked.size === 1 ? [...linked][0]! : null;
}

const BUILT_IN_PRESET_DICE_SET: Readonly<Record<string, string>> = {
  'builtin:cairn': 'builtin:d20-roll-under',
  'builtin:coc7e': 'builtin:d100-roll-under',
  'builtin:cyberpunkred': 'builtin:d10-exploding',
  'builtin:daggerheart': 'builtin:d20',
  'builtin:dnd5e': 'builtin:d20',
  'builtin:drawsteel': 'builtin:power-roll',
  'builtin:ose': 'builtin:d20',
  'builtin:pathfinder2e': 'builtin:d20',
  'builtin:shadowdark': 'builtin:d20',
};

async function customDiceSetsOf(app: App): Promise<ForgeRestDiceSet[]> {
  const vault = (app as unknown as { vault?: VaultLike }).vault;
  const files = vault?.getFiles?.() ?? [];
  const result: ForgeRestDiceSet[] = [];
  for (const file of files) {
    if (!file.path.startsWith('atlas-vtt/dice-sets/') || !file.path.toLowerCase().endsWith('.json') || !vault?.cachedRead) continue;
    try {
      const parsed = parseForgeRestDiceSet(JSON.parse(await vault.cachedRead(file)) as unknown);
      if (parsed) result.push(parsed);
    } catch { /* invalid or unreadable library records are ignored like Atlas */ }
  }
  return result;
}


function legacyDiceRules(raw: unknown): ForgeRestDiceSet | null {
  if (!isRecord(raw) || typeof raw.defaultRoll !== 'string'
    || !['natural', 'roll-under', 'doubles', 'high-total', 'none'].includes(String(raw.crit))) return null;
  const dice = parseRollGroups(raw.defaultRoll);
  if (!dice || dice.reduce((sum, group) => sum + group.count, 0) > 20 || dice.length > 6) return null;
  let explode: ForgeRestDiceSet['explode'];
  if (raw.explode !== undefined) {
    if (!isRecord(raw.explode) || !['default', 'all'].includes(String(raw.explode.dice))
      || typeof raw.explode.repeats !== 'boolean' || !Number.isInteger(raw.explode.highFaces)
      || !Number.isInteger(raw.explode.lowFaces)) return null;
    explode = {
      dice: raw.explode.dice as 'default' | 'all', repeats: raw.explode.repeats,
      highFaces: Number(raw.explode.highFaces), lowFaces: Number(raw.explode.lowFaces),
    };
  }
  return {
    id: 'collection:legacy-dice-rules', name: dice.map((group) => `${group.count}d${group.sides}`).join(' + '),
    builtIn: false, dice, crit: raw.crit as ForgeRestDiceSet['crit'], ...(explode ? { explode } : {}),
  };
}

function resolveSetId(id: string, customSets: readonly ForgeRestDiceSet[]): ForgeRestDiceSet | null {
  return forgeRestDiceSetById(id) ?? customSets.find((set) => set.id === id) ?? null;
}

/**
 * Resolves the no-map Dice Set using the inspected Atlas 0.17.0/0.18.0 collection-rule baselines:
 * template selection is handled by the caller; collection pick, legacy rules,
 * system preset, and finally d20 are resolved here.
 */
export async function loadForgeAtlasCollectionDiceSet(app: App, statblockPath: string): Promise<ForgeRestDiceSet> {
  const metadata = await assetMetadataOf(app);
  if (!metadata) return forgeRestDefaultDiceSet();
  const collectionId = collectionIdForStatblock(statblockPath, metadata) ?? defaultCollectionId(metadata);
  const settings = collectionId ? metadata.collections?.[collectionId]?.settings : undefined;
  const customSets = await customDiceSetsOf(app);

  if (typeof settings?.diceSetId === 'string' && settings.diceSetId.trim()) {
    const picked = resolveSetId(settings.diceSetId, customSets);
    if (picked) return picked;
  }

  if (settings?.dice !== undefined) {
    const legacy = legacyDiceRules(settings.dice);
    if (legacy) return legacy;
  }

  const presetId = typeof settings?.systemPresetId === 'string' ? settings.systemPresetId : '';
  if (presetId) {
    const builtInSetId = BUILT_IN_PRESET_DICE_SET[presetId];
    if (builtInSetId) {
      const builtIn = forgeRestDiceSetById(builtInSetId);
      if (builtIn) return builtIn;
    } else if (!presetId.startsWith('builtin:')) {
      const rules = await loadAtlasSystemPresetRules(app, presetId);
      if (rules) {
        if (typeof rules.diceSetId === 'string') {
          const selected = resolveSetId(rules.diceSetId, customSets);
          if (selected) return selected;
        }
        if (rules.dice !== undefined) {
          const legacy = legacyDiceRules(rules.dice);
          if (legacy) return legacy;
        }
      }
    }
  }
  return forgeRestDefaultDiceSet();
}

/** Selects the explicit Template set first, then the collection's default set. */
export function effectiveForgeDiceSet(
  explicitSet: ForgeRestDiceSet | null | undefined,
  collectionSet: ForgeRestDiceSet,
): ForgeRestDiceSet {
  return explicitSet ?? collectionSet;
}
