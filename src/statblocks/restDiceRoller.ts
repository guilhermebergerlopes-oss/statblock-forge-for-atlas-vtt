import type { App } from 'obsidian';
import type { ForgeTemplate, JsonRecord } from '../templates/forgeTemplate.ts';
import { parseFormula } from './atlasDiceEngine/parseFormula.ts';
import { rollFormula } from './atlasDiceEngine/diceFormula.ts';
import type { ExplodeRule } from './atlasDiceEngine/diceRulesTypes.ts';

export interface ForgeRestDiceGroup {
  count: number;
  sides: number;
  name?: string;
  colour?: string;
}

export type ForgeRestAdvantageRule =
  | { kind: 'keep'; tensOnly?: true }
  | { kind: 'number'; value: number }
  | { kind: 'die'; sides: number; name?: string; colour?: string };

export interface ForgeRestDiceSet {
  id: string;
  name: string;
  builtIn: boolean;
  dice: ForgeRestDiceGroup[];
  crit: 'natural' | 'roll-under' | 'doubles' | 'high-total' | 'none';
  explode?: ExplodeRule;
  advantage?: ForgeRestAdvantageRule;
  disadvantage?: ForgeRestAdvantageRule;
}

export interface ForgeRestDiceRoll {
  formula: string;
  total: number;
}

const KEEP_BEST: Pick<ForgeRestDiceSet, 'advantage' | 'disadvantage'> = {
  advantage: { kind: 'keep' }, disadvantage: { kind: 'keep' },
};
const EDGE: ForgeRestAdvantageRule = { kind: 'number', value: 2 };
const BUILT_IN_REST_DICE_SETS: readonly ForgeRestDiceSet[] = [
  { id: 'builtin:d20', name: 'd20', builtIn: true, dice: [{ count: 1, sides: 20 }], crit: 'natural', ...KEEP_BEST },
  { id: 'builtin:d20-roll-under', name: 'd20 roll-under', builtIn: true, dice: [{ count: 1, sides: 20 }], crit: 'roll-under', ...KEEP_BEST },
  { id: 'builtin:d100-roll-under', name: 'd100 roll-under', builtIn: true, dice: [{ count: 1, sides: 100 }], crit: 'roll-under', ...KEEP_BEST },
  {
    id: 'builtin:d10-exploding', name: 'd10 exploding', builtIn: true, dice: [{ count: 1, sides: 10 }], crit: 'natural',
    explode: { dice: 'default', repeats: false, highFaces: 1, lowFaces: 1 },
  },
  { id: 'builtin:power-roll', name: 'Power roll', builtIn: true, dice: [{ count: 2, sides: 10 }], crit: 'high-total', advantage: EDGE, disadvantage: EDGE },
];

const DEFAULT_REST_DICE_SET = BUILT_IN_REST_DICE_SETS[0]!;

/** Returns a copy of a built-in Atlas-compatible Dice Set by its stable id. */
export function forgeRestDiceSetById(id: string): ForgeRestDiceSet | null {
  const set = BUILT_IN_REST_DICE_SETS.find((candidate) => candidate.id === id);
  return set ? {
    ...set,
    dice: set.dice.map((die) => ({ ...die })),
    ...(set.explode ? { explode: { ...set.explode } } : {}),
    ...(set.advantage ? { advantage: { ...set.advantage } } : {}),
    ...(set.disadvantage ? { disadvantage: { ...set.disadvantage } } : {}),
  } : null;
}

/** Immutable copies of the built-in sets, for Atlas collection/preset resolution. */
export function forgeRestBuiltInDiceSets(): ForgeRestDiceSet[] {
  return BUILT_IN_REST_DICE_SETS.map((set) => forgeRestDiceSetById(set.id)!).filter(Boolean);
}
const VALID_CRITS = new Set(['natural', 'roll-under', 'doubles', 'high-total', 'none']);

function parseAdvantageRule(value: unknown): ForgeRestAdvantageRule | undefined {
  if (!isRecord(value)) return undefined;
  if (value.kind === 'keep') return { kind: 'keep', ...(value.tensOnly === true ? { tensOnly: true as const } : {}) };
  if (value.kind === 'number' && Number.isInteger(value.value) && Number(value.value) >= 1 && Number(value.value) <= 99) {
    return { kind: 'number', value: Number(value.value) };
  }
  if (value.kind === 'die' && Number.isInteger(value.sides) && Number(value.sides) >= 2 && Number(value.sides) <= 999) {
    const result: Extract<ForgeRestAdvantageRule, { kind: 'die' }> = { kind: 'die', sides: Number(value.sides) };
    if (typeof value.name === 'string' && value.name.trim().length > 0 && value.name.trim().length <= 40) result.name = value.name.trim();
    if (typeof value.colour === 'string' && /^#[0-9a-f]{6}$/i.test(value.colour)) result.colour = value.colour.toLowerCase();
    return result;
  }
  return undefined;
}

/** Validates the same public fields Atlas reads from a vault Dice Set record. */
export function parseForgeRestDiceSet(raw: unknown): ForgeRestDiceSet | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id.trim() || raw.id.startsWith('builtin:')
    || typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 40
    || !Array.isArray(raw.dice) || raw.dice.length < 1 || raw.dice.length > 6
    || !VALID_CRITS.has(String(raw.crit))) return null;

  const dice: ForgeRestDiceGroup[] = [];
  for (const rawDie of raw.dice) {
    if (!isRecord(rawDie) || !Number.isInteger(rawDie.count) || Number(rawDie.count) < 1 || Number(rawDie.count) > 20
      || !Number.isInteger(rawDie.sides) || Number(rawDie.sides) < 2 || Number(rawDie.sides) > 999) return null;
    const group: ForgeRestDiceGroup = { count: Number(rawDie.count), sides: Number(rawDie.sides) };
    if (typeof rawDie.name === 'string' && rawDie.name.trim().length > 0 && rawDie.name.trim().length <= 40) group.name = rawDie.name.trim();
    if (typeof rawDie.colour === 'string' && /^#[0-9a-f]{6}$/i.test(rawDie.colour)) group.colour = rawDie.colour.toLowerCase();
    dice.push(group);
  }
  if (dice.reduce((sum, die) => sum + die.count, 0) > 20) return null;

  let explode: ExplodeRule | undefined;
  if (raw.explode !== undefined) {
    if (!isRecord(raw.explode) || !['default', 'all'].includes(String(raw.explode.dice))
      || typeof raw.explode.repeats !== 'boolean'
      || !Number.isInteger(raw.explode.highFaces) || Number(raw.explode.highFaces) < 1 || Number(raw.explode.highFaces) > 99
      || !Number.isInteger(raw.explode.lowFaces) || Number(raw.explode.lowFaces) < 0 || Number(raw.explode.lowFaces) > 99) return null;
    explode = {
      dice: raw.explode.dice as 'default' | 'all',
      repeats: raw.explode.repeats,
      highFaces: Number(raw.explode.highFaces),
      lowFaces: Number(raw.explode.lowFaces),
    };
  }

  const advantage = parseAdvantageRule(raw.advantage);
  const disadvantage = parseAdvantageRule(raw.disadvantage);
  return {
    id: raw.id,
    name: raw.name.trim(),
    builtIn: false,
    dice,
    crit: raw.crit as ForgeRestDiceSet['crit'],
    ...(explode ? { explode } : {}),
    ...(advantage ? { advantage } : {}),
    ...(disadvantage ? { disadvantage } : {}),
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Resolves a template's explicit set, then Atlas's built-in d20 fallback for a Forge-only sheet. */
export function resolveForgeRestDiceSet(templateSetId: unknown, customSets: readonly ForgeRestDiceSet[]): ForgeRestDiceSet {
  if (typeof templateSetId !== 'string' || !templateSetId.trim()) return DEFAULT_REST_DICE_SET;
  return BUILT_IN_REST_DICE_SETS.find((set) => set.id === templateSetId)
    ?? customSets.find((set) => set.id === templateSetId)
    ?? DEFAULT_REST_DICE_SET;
}

/**
 * Dice Set JSON can be stored in Atlas' dice-sets folder, including nested
 * collection folders. Normalize separators and folder casing because Obsidian
 * Vault paths may preserve the casing chosen on Windows/macOS.
 */
function isAtlasDiceSetJsonPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/')
    .normalize('NFC')
    .toLocaleLowerCase()
    .replace(/\s+/g, '-');
  const segments = normalized.split('/').filter(Boolean);
  return segments[0] === 'atlas-vtt' && segments.includes('dice-sets') && normalized.endsWith('.json');
}

export interface ForgeVaultDiceSetLookup {
  set: ForgeRestDiceSet | null;
  sourcePath?: string;
  invalidSourcePath?: string;
  /** Safe, bounded diagnostics for a missing/malformed set; contains paths and IDs, never file contents. */
  diagnostic?: string;
}

/**
 * Lists custom Dice Set JSON paths through Obsidian's Vault adapter rather
 * than `vault.getFiles()`. Atlas' own DiceSetFiles service reads this library
 * through `adapter.list()`/`adapter.read()` so it can see records even when
 * they are not currently present in Obsidian's indexed File Explorer list.
 * The walk is limited to Atlas' own data folder and keeps nested Dice Sets.
 */
export async function listForgeAtlasDiceSetJsonFiles(app: App): Promise<string[]> {
  const adapter = app.vault.adapter;
  const found = new Set<string>();
  const visited = new Set<string>();
  const pending: string[] = [];

  const addFolder = (folder: string): void => {
    const key = folder.replace(/\\/g, '/').normalize('NFC').toLocaleLowerCase();
    if (!visited.has(key)) pending.push(folder);
  };

  // Atlas opens this exact library root directly with adapter.list(), rather
  // than discovering it from the parent folder. Obsidian adapters and vault
  // filters may omit hidden/excluded folders from their parent's listing even
  // though the path itself is readable. Seed the canonical Atlas path first.
  addFolder('atlas-vtt/dice-sets');

  // Also discover a case/spacing variant of the Atlas root and nested
  // collection Dice Sets folders for vaults created on other platforms.
  try {
    const rootListing = await adapter.list('');
    for (const folder of rootListing.folders) {
      const parts = folder.replace(/\\/g, '/').split('/').filter(Boolean);
      const segment = parts[parts.length - 1] ?? folder;
      if (segment.normalize('NFC').toLocaleLowerCase().replace(/\s+/g, '-') === 'atlas-vtt') {
        addFolder(folder);
      }
    }
  } catch {
    // The direct canonical path above remains usable when root enumeration is restricted.
  }

  while (pending.length > 0) {
    const folder = pending.shift()!;
    const key = folder.replace(/\\/g, '/').normalize('NFC').toLocaleLowerCase();
    if (visited.has(key)) continue;
    visited.add(key);

    let listing: { files: string[]; folders: string[] };
    try {
      listing = await adapter.list(folder);
    } catch {
      // A nonexistent canonical folder or an adapter restriction is not fatal;
      // other discovered Atlas roots may still contain the set.
      continue;
    }

    for (const path of listing.files) {
      if (isAtlasDiceSetJsonPath(path)) found.add(path);
    }
    for (const child of listing.folders) addFolder(child);
  }

  // Merge the indexed Vault files as a second source. Some Obsidian adapters
  // omit ignored/hidden folders from adapter.list(), while a TFile can still be
  // present in the Vault index and readable through cachedRead().
  try {
    for (const file of app.vault.getFiles()) {
      if (isAtlasDiceSetJsonPath(file.path)) found.add(file.path);
    }
  } catch {
    // The adapter scan remains the primary source on runtimes without a usable index.
  }

  return [...found].sort((a, b) => a.localeCompare(b));
}

/**
 * Resolves an explicit custom Dice Set ID from the GM Vault. A missing or
 * malformed explicit set is not silently replaced with d20: doing so could
 * change the game's rules. Duplicate IDs are rejected as ambiguous.
 *
 * Read through the adapter just like Atlas' RecordFolderFiles service. Do not
 * rely on `vault.getFiles()`/`cachedRead()`: ignored or not-yet-indexed Atlas
 * library records can be available to the adapter while absent from the UI list.
 */
export async function findForgeRestDiceSetInVault(app: App, id: string): Promise<ForgeVaultDiceSetLookup> {
  const matches: Array<{ set: ForgeRestDiceSet; path: string }> = [];
  const invalidPaths: string[] = [];
  const unreadablePaths: string[] = [];
  const malformedPaths: string[] = [];
  const mismatchedIds: Array<{ path: string; id: string }> = [];
  const candidatePaths = new Set<string>();
  const indexedFiles = new Map<string, ReturnType<App['vault']['getFiles']>[number]>();
  const foldersVisited = new Set<string>();

  // Primary source: the same Vault adapter path Atlas' DiceSetFiles service reads.
  try {
    for (const path of await listForgeAtlasDiceSetJsonFiles(app)) candidatePaths.add(path);
  } catch (error) {
    foldersVisited.add(`adapter scan failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Secondary source: the Obsidian index. Atlas-only JSON records can be absent
  // from getFiles(), but some adapters expose them here even when list() omits them.
  // Merge both sources rather than assuming either one is complete.
  try {
    for (const file of app.vault.getFiles()) {
      if (isAtlasDiceSetJsonPath(file.path)) {
        candidatePaths.add(file.path);
        indexedFiles.set(file.path, file);
      }
    }
  } catch (error) {
    foldersVisited.add(`Vault index scan failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Explicitly record the canonical folder state. This makes the error actionable
  // when the Atlas folder is visible but the file list is unexpectedly empty.
  try {
    const exists = await app.vault.adapter.exists('atlas-vtt/dice-sets');
    foldersVisited.add(`atlas-vtt/dice-sets exists: ${exists ? 'yes' : 'no'}`);
  } catch (error) {
    foldersVisited.add(`atlas-vtt/dice-sets exists: check failed (${error instanceof Error ? error.message : String(error)})`);
  }

  for (const path of [...candidatePaths].sort((a, b) => a.localeCompare(b))) {
    try {
      let text: string;
      try {
        text = await app.vault.adapter.read(path);
      } catch (adapterError) {
        const indexedFile = indexedFiles.get(path);
        if (!indexedFile) throw adapterError;
        text = await app.vault.cachedRead(indexedFile);
      }
      // Dice Set records are small JSON documents. Avoid parsing unexpectedly
      // large files from the Vault while resolving one selected Template.
      if (text.length > 64 * 1024) {
        malformedPaths.push(`${path} (over 64 KiB)`);
        continue;
      }
      let raw: unknown;
      try {
        raw = JSON.parse(text.replace(/^\uFEFF/, '')) as unknown;
      } catch (error) {
        malformedPaths.push(`${path} (${error instanceof Error ? error.message : 'invalid JSON'})`);
        continue;
      }
      if (!isRecord(raw) || typeof raw.id !== 'string') {
        malformedPaths.push(`${path} (JSON has no string id)`);
        continue;
      }
      if (raw.id.trim() !== id) {
        if (mismatchedIds.length < 8) mismatchedIds.push({ path, id: raw.id.slice(0, 100) });
        continue;
      }
      const parsed = parseForgeRestDiceSet(raw);
      if (!parsed) {
        invalidPaths.push(path);
        continue;
      }
      matches.push({ set: parsed, path });
    } catch (error) {
      unreadablePaths.push(`${path} (${error instanceof Error ? error.message : String(error)})`);
    }
  }
  if (matches.length > 1) {
    throw new Error(`More than one Dice Set file in atlas-vtt/dice-sets declares ID "${id}". Keep one valid definition so the Template resolves unambiguously.`);
  }
  if (matches.length === 1) return { set: matches[0]!.set, sourcePath: matches[0]!.path };

  const details = [
    `Requested ID: ${id}`,
    `JSON candidates found: ${candidatePaths.size}`,
    ...[...foldersVisited].slice(0, 4),
    ...(invalidPaths.length ? [`Matching ID but invalid Set Dice structure: ${invalidPaths.slice(0, 4).join(', ')}`] : []),
    ...(unreadablePaths.length ? [`Unreadable JSON: ${unreadablePaths.slice(0, 4).join('; ')}`] : []),
    ...(malformedPaths.length ? [`Invalid JSON: ${malformedPaths.slice(0, 4).join('; ')}`] : []),
    ...(mismatchedIds.length ? [`Other IDs found: ${mismatchedIds.slice(0, 4).map((entry) => `${entry.id} in ${entry.path}`).join('; ')}`] : []),
    ...(candidatePaths.size === 0 ? ['No .json files were returned from the Atlas Dice Sets folder or the Obsidian Vault index.'] : []),
  ].join(' | ').slice(0, 1800);
  const invalidSourcePath = invalidPaths[0];
  return invalidSourcePath
    ? { set: null, invalidSourcePath, diagnostic: details }
    : { set: null, diagnostic: details };
}

/** Reads a Template's named Dice Set from the GM Vault. */
export async function loadForgeRestDiceSet(app: App, template: ForgeTemplate): Promise<ForgeRestDiceSet> {
  const templateSetId = template.diceSetId;
  if (typeof templateSetId !== 'string' || !templateSetId.trim()) return DEFAULT_REST_DICE_SET;
  const builtIn = BUILT_IN_REST_DICE_SETS.find((set) => set.id === templateSetId);
  if (builtIn) return builtIn;
  const result = await findForgeRestDiceSetInVault(app, templateSetId);
  return result.set ?? DEFAULT_REST_DICE_SET;
}

function cryptographicRandom(): number {
  const cryptoApi = window.crypto;
  if (!cryptoApi?.getRandomValues) throw new Error('Secure random number generation is unavailable.');
  const value = cryptoApi.getRandomValues(new Uint32Array(1))[0]!;
  return value / 0x1_0000_0000;
}

/**
 * Rolls a Rest formula with Atlas's bounded grammar and dice-set explosion rules.
 * It returns only the numeric total because Forge's current Rest step shows a preview, not a roll log.
 */
export function rollForgeRestFormula(
  formula: string,
  set: ForgeRestDiceSet,
  random: () => number = cryptographicRandom,
): ForgeRestDiceRoll | null {
  const text = formula.trim();
  if (!text) return null;
  try {
    const parsed = parseFormula(text);
    if (!parsed.ok) return null;
    const rolled = rollFormula(parsed, random, { dice: set.dice, ...(set.explode ? { explode: set.explode } : {}) });
    if (!Number.isFinite(rolled.total)) return null;
    return { formula: text, total: Math.trunc(rolled.total) };
  } catch {
    return null;
  }
}

/** For tests and diagnostics; the live resolver only returns immutable built-in records. */
export function forgeRestDefaultDiceSet(): ForgeRestDiceSet {
  return { ...DEFAULT_REST_DICE_SET, dice: DEFAULT_REST_DICE_SET.dice.map((die) => ({ ...die })) };
}
