import { forgeRestDiceSetById, parseForgeRestDiceSet, type ForgeRestDiceSet } from './restDiceRoller.ts';

export const FORGE_DICE_HISTORY_DATA_KEY = 'forgeDiceHistory';
export const FORGE_DICE_HISTORY_PER_STATBLOCK_LIMIT = 20;
export const FORGE_DICE_HISTORY_TOTAL_LIMIT = 500;

/** A queued save may clear the dirty flag only if no newer roll was recorded. */
export function isForgeDiceHistorySnapshotCurrent(snapshotRevision: number, currentRevision: number): boolean {
  return Number.isSafeInteger(snapshotRevision) && Number.isSafeInteger(currentRevision)
    && snapshotRevision === currentRevision;
}

export interface ForgeDiceHistorySource {
  readonly statblockPath: string;
  readonly tokenId?: string;
  readonly tokenName?: string;
  readonly tokenImagePath?: string;
  readonly abilityName?: string;
}

export interface ForgeDiceHistoryRecipe {
  readonly engine: 'atlas' | 'forge';
  readonly source: ForgeDiceHistorySource;
  readonly diceSet?: ForgeRestDiceSet;
  readonly advantage?: 'advantage' | 'disadvantage';
  readonly mapPath?: string;
  readonly viewId?: string;
}

export interface ForgeDiceHistoryEntry {
  readonly id: string;
  readonly timestamp: number;
  readonly formula: string;
  readonly total: number;
  readonly statblockPath: string;
  readonly tokenName?: string;
  readonly abilityName?: string;
  readonly advantage?: 'advantage' | 'disadvantage';
  readonly repeatable: boolean;
  readonly engine: 'atlas' | 'forge';
  readonly recipe?: ForgeDiceHistoryRecipe;
}

interface RecordLike { [key: string]: unknown }

function isRecord(value: unknown): value is RecordLike {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, maximum = 1000): string | null {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum ? value : null;
}

function sourceOf(value: unknown): ForgeDiceHistorySource | null {
  if (!isRecord(value)) return null;
  const statblockPath = text(value.statblockPath, 2048);
  if (!statblockPath) return null;
  return {
    statblockPath,
    ...(text(value.tokenId, 256) ? { tokenId: text(value.tokenId, 256)! } : {}),
    ...(text(value.tokenName, 256) ? { tokenName: text(value.tokenName, 256)! } : {}),
    ...(text(value.tokenImagePath, 2048) ? { tokenImagePath: text(value.tokenImagePath, 2048)! } : {}),
    ...(text(value.abilityName, 256) ? { abilityName: text(value.abilityName, 256)! } : {}),
  };
}

function diceSetOf(value: unknown): ForgeRestDiceSet | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 256);
  if (id) {
    const builtIn = forgeRestDiceSetById(id);
    if (builtIn) return builtIn;
  }
  return parseForgeRestDiceSet(value);
}

function recipeOf(value: unknown, statblockPath: string, engine: 'atlas' | 'forge'): ForgeDiceHistoryRecipe | null {
  if (!isRecord(value)) return null;
  const source = sourceOf(value.source);
  if (!source || source.statblockPath !== statblockPath) return null;
  const diceSet = diceSetOf(value.diceSet);
  const advantage = value.advantage === 'advantage' || value.advantage === 'disadvantage' ? value.advantage : undefined;
  const mapPath = text(value.mapPath, 2048) ?? undefined;
  const viewId = text(value.viewId, 256) ?? undefined;
  return {
    engine,
    source,
    ...(diceSet ? { diceSet } : {}),
    ...(advantage ? { advantage } : {}),
    ...(mapPath ? { mapPath } : {}),
    ...(viewId ? { viewId } : {}),
  };
}

/** Parses and bounds the Forge-owned roll history stored in the plugin's data.json. */
export function readForgeDiceHistory(value: unknown): ForgeDiceHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: ForgeDiceHistoryEntry[] = [];
  const ids = new Set<string>();
  const perPath = new Map<string, number>();
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const id = text(raw.id, 256);
    const formula = text(raw.formula, 512);
    const statblockPath = text(raw.statblockPath, 2048);
    const timestamp = raw.timestamp;
    const total = raw.total;
    const engine = raw.engine === 'atlas' || raw.engine === 'forge' ? raw.engine : null;
    if (!id || !formula || !statblockPath || !Number.isFinite(timestamp) || !Number.isFinite(total) || !engine || ids.has(id)) continue;
    const pathCount = perPath.get(statblockPath) ?? 0;
    if (pathCount >= FORGE_DICE_HISTORY_PER_STATBLOCK_LIMIT) continue;
    const recipe = recipeOf(raw.recipe, statblockPath, engine);
    const advantage = raw.advantage === 'advantage' || raw.advantage === 'disadvantage' ? raw.advantage : undefined;
    const repeatable = raw.repeatable === true && !!recipe && !!recipe.diceSet;
    entries.push({
      id, timestamp: Number(timestamp), formula, total: Number(total), statblockPath,
      ...(text(raw.tokenName, 256) ? { tokenName: text(raw.tokenName, 256)! } : {}),
      ...(text(raw.abilityName, 256) ? { abilityName: text(raw.abilityName, 256)! } : {}),
      ...(advantage ? { advantage } : {}),
      repeatable,
      engine,
      ...(recipe ? { recipe } : {}),
    });
    ids.add(id);
    perPath.set(statblockPath, pathCount + 1);
    if (entries.length >= FORGE_DICE_HISTORY_TOTAL_LIMIT) break;
  }
  return entries.sort((a, b) => b.timestamp - a.timestamp);
}

/** Detached JSON-safe copy used before saving plugin data. */
export function cloneForgeDiceHistory(entries: readonly ForgeDiceHistoryEntry[]): ForgeDiceHistoryEntry[] {
  return readForgeDiceHistory(entries);
}

/** Adds one entry, deduplicates ids, and applies per-statblock and global bounds. */
export function upsertForgeDiceHistory(
  current: readonly ForgeDiceHistoryEntry[],
  incoming: ForgeDiceHistoryEntry,
): ForgeDiceHistoryEntry[] {
  const next = [incoming, ...current.filter((entry) => entry.id !== incoming.id)];
  return readForgeDiceHistory(next);
}

export function forgeDiceHistoryForStatblock(
  entries: readonly ForgeDiceHistoryEntry[],
  statblockPath: string,
  limit = 10,
): ForgeDiceHistoryEntry[] {
  if (!text(statblockPath, 2048)) return [];
  const bounded = Number.isInteger(limit) ? Math.max(1, Math.min(FORGE_DICE_HISTORY_PER_STATBLOCK_LIMIT, limit)) : 10;
  return entries.filter((entry) => entry.statblockPath === statblockPath)
    .slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, bounded);
}
