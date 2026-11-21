import type { App } from 'obsidian';
import type { ForgeRestDiceSet } from './restDiceRoller.ts';
import { forgeStatblockAdvantageSides, type ForgeAdvantageSide } from './statblockDiceMenuModel.ts';
import { rollForgeOffMapDiceFormula, type ForgeOffMapDiceRollResult, type ForgeOffMapRollSource } from './atlasOffMapDiceRoller.ts';
import { combineWrittenAdvantage, writtenAdvantage } from './atlasDiceEngine/writtenAdvantage.ts';
import {
  atlasDiceRollOriginForToken,
  getAtlasDiceHistorySnapshots,
  getAtlasDiceRuntimeContexts,
  resolveAtlasDiceRollTarget,
  type AtlasDiceRollResultLike,
  type AtlasDiceRuntimeContext,
  type AtlasDiceTokenRollContextLike,
} from '../atlas/atlasDiceRuntime.ts';
import type { ForgeDiceHistoryEntry, ForgeDiceHistoryRecipe, ForgeDiceHistorySource } from './forgeDiceHistoryStorage.ts';

export interface AtlasRestDiceRoll {
  formula: string;
  total: number;
  id?: string;
}

export type AtlasRestDiceRollHistoryEntry = ForgeDiceHistoryEntry;

export interface AtlasRestDiceAttempt {
  /** False only when neither a native Atlas map Dice Tool nor a valid local Dice Set is available. */
  available: boolean;
  /** Null when the selected roller refused or failed to roll the formula. */
  roll: AtlasRestDiceRoll | null;
  error?: string;
  engine?: 'atlas' | 'forge';
  details?: ForgeOffMapDiceRollResult;
}

export interface ForgeAtlasRollContext {
  readonly viewId?: string;
  readonly tokenId?: string;
  readonly tokenImagePath?: string;
  readonly originContext?: AtlasDiceTokenRollContextLike;
}

interface AtlasRollSource extends ForgeDiceHistorySource {
  type: 'statblock';
}

interface ForgeHistoryPluginLike {
  getForgeDiceHistoryEntries?(statblockPath: string, limit?: number): ForgeDiceHistoryEntry[];
  getForgeDiceHistoryEntry?(id: string): ForgeDiceHistoryEntry | null;
  recordForgeDiceHistoryEntry?(entry: ForgeDiceHistoryEntry): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function historyPlugin(app: App): ForgeHistoryPluginLike | null {
  try {
    const plugins = (app as unknown as { plugins?: { plugins?: Record<string, unknown> } }).plugins?.plugins;
    const plugin = plugins?.['statblock-forge'];
    return isRecord(plugin) ? plugin as ForgeHistoryPluginLike : null;
  } catch {
    return null;
  }
}

function diceSetForAtlas(set: ForgeRestDiceSet): ForgeRestDiceSet {
  return {
    ...set,
    dice: set.dice.map((die) => ({ ...die })),
    ...(set.explode ? { explode: { ...set.explode } } : {}),
    ...(set.advantage ? { advantage: { ...set.advantage } } : {}),
    ...(set.disadvantage ? { disadvantage: { ...set.disadvantage } } : {}),
  };
}

function rollSourceOf(source: {
  statblockPath: string;
  tokenId?: string;
  tokenName?: string;
  tokenImagePath?: string;
  abilityName?: string;
}): AtlasRollSource {
  return {
    type: 'statblock',
    statblockPath: source.statblockPath,
    ...(source.tokenId ? { tokenId: source.tokenId } : {}),
    ...(source.tokenName ? { tokenName: source.tokenName } : {}),
    ...(source.tokenImagePath ? { tokenImagePath: source.tokenImagePath } : {}),
    ...(source.abilityName ? { abilityName: source.abilityName } : {}),
  };
}

function sourceForHistory(source: AtlasRollSource): ForgeDiceHistorySource {
  return {
    statblockPath: source.statblockPath,
    ...(source.tokenId ? { tokenId: source.tokenId } : {}),
    ...(source.tokenName ? { tokenName: source.tokenName } : {}),
    ...(source.tokenImagePath ? { tokenImagePath: source.tokenImagePath } : {}),
    ...(source.abilityName ? { abilityName: source.abilityName } : {}),
  };
}

function recordHistory(app: App, entry: ForgeDiceHistoryEntry): void {
  try { historyPlugin(app)?.recordForgeDiceHistoryEntry?.(entry); } catch { /* the roll itself remains valid if history storage is unavailable */ }
}

function recipeFor(
  engine: 'atlas' | 'forge',
  source: AtlasRollSource,
  set: ForgeRestDiceSet | null,
  advantage: 'advantage' | 'disadvantage' | null | undefined,
  mapContext?: Pick<AtlasDiceRuntimeContext, 'mapPath' | 'viewId'>,
): ForgeDiceHistoryRecipe {
  return {
    engine,
    source: sourceForHistory(source),
    ...(set ? { diceSet: diceSetForAtlas(set) } : {}),
    ...(advantage ? { advantage } : {}),
    ...(mapContext?.mapPath ? { mapPath: mapContext.mapPath } : {}),
    ...(mapContext?.viewId ? { viewId: mapContext.viewId } : {}),
  };
}

function recordSuccessfulRoll(
  app: App,
  result: AtlasDiceRollResultLike | ForgeOffMapDiceRollResult,
  source: AtlasRollSource,
  recipe: ForgeDiceHistoryRecipe,
  engine: 'atlas' | 'forge',
): void {
  if (!result || typeof result.id !== 'string' || !result.id.trim()
    || !Number.isFinite(result.total) || !Number.isFinite(result.timestamp)) return;
  const formula = typeof result.formula === 'string' ? result.formula : '';
  if (!formula) return;
  recordHistory(app, {
    id: result.id,
    timestamp: Number(result.timestamp),
    formula,
    total: Number(result.total),
    statblockPath: source.statblockPath,
    ...(source.tokenName ? { tokenName: source.tokenName } : {}),
    ...(source.abilityName ? { abilityName: source.abilityName } : {}),
    ...(recipe.advantage ? { advantage: recipe.advantage } : {}),
    repeatable: !!recipe.diceSet,
    engine,
    recipe,
  });
}

function sourceFromUnknown(value: unknown): ForgeDiceHistorySource | null {
  if (!isRecord(value) || value.type !== 'statblock'
    || typeof value.statblockPath !== 'string' || !value.statblockPath.trim()) return null;
  return {
    statblockPath: value.statblockPath,
    ...(typeof value.tokenId === 'string' ? { tokenId: value.tokenId } : {}),
    ...(typeof value.tokenName === 'string' ? { tokenName: value.tokenName } : {}),
    ...(typeof value.tokenImagePath === 'string' ? { tokenImagePath: value.tokenImagePath } : {}),
    ...(typeof value.abilityName === 'string' ? { abilityName: value.abilityName } : {}),
  };
}

function mapHistoryEntries(app: App, statblockPath: string): ForgeDiceHistoryEntry[] {
  const entries: ForgeDiceHistoryEntry[] = [];
  for (const snapshot of getAtlasDiceHistorySnapshots(app)) {
    const results = [...snapshot.persistedHistory, ...snapshot.inMemoryHistory];
    for (const result of results) {
      const source = sourceFromUnknown(result.source);
      if (!source || source.statblockPath !== statblockPath || typeof result.id !== 'string'
        || typeof result.formula !== 'string' || !Number.isFinite(result.timestamp) || !Number.isFinite(result.total)) continue;
      const recipe: ForgeDiceHistoryRecipe = {
        engine: 'atlas', source,
        ...(snapshot.mapPath ? { mapPath: snapshot.mapPath } : {}),
        ...(snapshot.viewId ? { viewId: snapshot.viewId } : {}),
        ...(result.advantage === 'advantage' || result.advantage === 'disadvantage' ? { advantage: result.advantage } : {}),
      };
      entries.push({
        id: result.id,
        timestamp: Number(result.timestamp),
        formula: result.formula,
        total: Number(result.total),
        statblockPath,
        ...(source.tokenName ? { tokenName: source.tokenName } : {}),
        ...(source.abilityName ? { abilityName: source.abilityName } : {}),
        ...(recipe.advantage ? { advantage: recipe.advantage } : {}),
        repeatable: snapshot.visible && !!snapshot.mapPath,
        engine: 'atlas',
        recipe,
      });
    }
  }
  return entries;
}

function findHistoryEntryById(app: App, id: string): ForgeDiceHistoryEntry | null {
  if (typeof id !== 'string' || !id.trim()) return null;
  let saved: ForgeDiceHistoryEntry | null = null;
  try {
    saved = historyPlugin(app)?.getForgeDiceHistoryEntry?.(id) ?? null;
    if (saved?.repeatable) return saved;
  } catch { /* continue with live Atlas snapshots */ }
  for (const snapshot of getAtlasDiceHistorySnapshots(app)) {
    for (const result of [...snapshot.persistedHistory, ...snapshot.inMemoryHistory]) {
      if (result.id !== id) continue;
      const source = sourceFromUnknown(result.source);
      if (!source || typeof result.formula !== 'string' || !Number.isFinite(result.timestamp) || !Number.isFinite(result.total)) return null;
      const recipe: ForgeDiceHistoryRecipe = {
        engine: 'atlas', source,
        ...(snapshot.mapPath ? { mapPath: snapshot.mapPath } : {}),
        ...(snapshot.viewId ? { viewId: snapshot.viewId } : {}),
        ...(result.advantage === 'advantage' || result.advantage === 'disadvantage' ? { advantage: result.advantage } : {}),
      };
      return {
        id, timestamp: Number(result.timestamp), formula: result.formula, total: Number(result.total),
        statblockPath: source.statblockPath,
        ...(source.tokenName ? { tokenName: source.tokenName } : {}),
        ...(source.abilityName ? { abilityName: source.abilityName } : {}),
        ...(recipe.advantage ? { advantage: recipe.advantage } : {}),
        repeatable: snapshot.visible && !!snapshot.mapPath,
        engine: 'atlas', recipe,
      };
    }
  }
  return saved;
}

function localRepeat(app: App, entry: ForgeDiceHistoryEntry, recipe: ForgeDiceHistoryRecipe): AtlasRestDiceAttempt {
  if (!recipe.diceSet) return { available: false, engine: 'forge', roll: null, error: 'The original Dice Set is unavailable.' };
  const source: ForgeOffMapRollSource = { type: 'statblock', ...recipe.source };
  const attempt = rollForgeOffMapDiceFormula(entry.formula, recipe.diceSet, source, recipe.advantage);
  if (!attempt.ok) return { available: true, engine: 'forge', roll: null, error: attempt.error };
  const result = attempt.result;
  const nextRecipe = recipeFor('forge', rollSourceOf(recipe.source), recipe.diceSet, recipe.advantage);
  recordSuccessfulRoll(app, result, rollSourceOf(recipe.source), nextRecipe, 'forge');
  return {
    available: true,
    engine: 'forge',
    details: result,
    roll: { id: result.id, formula: result.formula, total: result.total },
  };
}

function visibleMapForHistory(app: App, recipe: ForgeDiceHistoryRecipe): AtlasDiceRuntimeContext | null {
  const contexts = getAtlasDiceRuntimeContexts(app).filter((context) => context.visible && context.mapPath === recipe.mapPath);
  if (recipe.viewId) {
    const exact = contexts.find((context) => context.viewId === recipe.viewId);
    if (exact) return exact;
  }
  if (contexts.length === 1) return contexts[0]!;
  if (contexts.length > 1) {
    const activeLeaf = (app as unknown as { workspace?: { activeLeaf?: unknown } }).workspace?.activeLeaf;
    const active = contexts.filter((context) => context.leaf === activeLeaf);
    if (active.length === 1) return active[0]!;
  }
  return null;
}

/** The active dice rules, written as a default bonus formula (for example `1d20+1d6`). */
export function forgeStatblockDefaultRollFormula(
  app: App,
  explicitSet?: ForgeRestDiceSet | null,
  statblockPath = 'statblock-forge:unknown',
  rollContext?: ForgeAtlasRollContext,
  offMapSet?: ForgeRestDiceSet | null,
): string | null {
  const target = resolveAtlasDiceRollTarget(app, rollContext?.viewId, rollContext?.originContext?.mapPath);
  const tool = target.status === 'ready' ? target.context.diceTool : null;
  if (target.status !== 'ready' && target.status !== 'none') return null;
  try {
    const localSet = explicitSet ?? offMapSet ?? null;
    const rules = tool?.rollingDice
      ? tool.rollingDice(explicitSet ? diceSetForAtlas(explicitSet) : undefined)
      : target.status === 'none' && localSet ? localSet : null;
    if (!rules) return null;
    const dice = Array.isArray(rules.dice) ? rules.dice : [];
    const formula = dice
      .filter((die) => Number.isInteger(die.count) && die.count > 0 && Number.isInteger(die.sides) && die.sides > 0)
      .map((die) => `${die.count}d${die.sides}`)
      .join('+');
    return formula || null;
  } catch {
    return null;
  }
}

export function forgeStatblockRollMenuSides(
  app: App,
  formula: string,
  explicitSet?: ForgeRestDiceSet | null,
  statblockPath = 'statblock-forge:unknown',
  rollContext?: ForgeAtlasRollContext,
  offMapSet?: ForgeRestDiceSet | null,
): ForgeAdvantageSide[] {
  const target = resolveAtlasDiceRollTarget(app, rollContext?.viewId, rollContext?.originContext?.mapPath);
  const tool = target.status === 'ready' ? target.context.diceTool : null;
  if (target.status !== 'ready' && target.status !== 'none') return [];
  try {
    const localSet = explicitSet ?? offMapSet ?? null;
    const rules = tool?.rollingDice
      ? tool.rollingDice(explicitSet ? diceSetForAtlas(explicitSet) : undefined)
      : target.status === 'none' && localSet ? localSet : null;
    return rules ? forgeStatblockAdvantageSides(formula, rules) : [];
  } catch {
    return [];
  }
}

/** Returns recent Forge statblock rolls from Forge persistence and open Atlas map logs. */
export function hasForgeStatblockRollHistory(app: App): boolean {
  return typeof historyPlugin(app)?.getForgeDiceHistoryEntries === 'function';
}

export function getForgeStatblockRollHistory(app: App, statblockPath: string, limit = 10): AtlasRestDiceRollHistoryEntry[] {
  if (typeof statblockPath !== 'string' || !statblockPath.trim()) return [];
  const requestedLimit = Number.isInteger(limit) ? Math.max(1, Math.min(50, limit)) : 10;
  const saved = historyPlugin(app)?.getForgeDiceHistoryEntries?.(statblockPath, 20) ?? [];
  const merged = new Map<string, ForgeDiceHistoryEntry>();
  for (const entry of mapHistoryEntries(app, statblockPath)) merged.set(entry.id, entry);
  // Saved entries carry the full replay recipe. However, a legacy saved entry
  // that lacked a Dice Set can still be replayable while its original map is open.
  for (const entry of saved) {
    const live = merged.get(entry.id);
    if (!live || entry.repeatable || !live.repeatable) merged.set(entry.id, entry);
  }
  return [...merged.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, requestedLimit);
}

/** Repeats an Atlas map roll in its map when still available, otherwise locally from its saved Dice Set. */
export function repeatForgeStatblockRollFromHistory(app: App, id: string): AtlasRestDiceAttempt {
  const entry = findHistoryEntryById(app, id);
  if (!entry || !entry.repeatable || !entry.recipe) return { available: false, roll: null };
  const recipe = entry.recipe;

  if (recipe.engine === 'atlas') {
    const context = recipe.mapPath ? visibleMapForHistory(app, recipe) : null;
    if (context) {
      try {
        const source = { type: 'statblock' as const, ...recipe.source };
        const origin = atlasDiceRollOriginForToken(context, recipe.source.tokenId);
        const options = recipe.diceSet || recipe.advantage
          ? { ...(recipe.diceSet ? { set: diceSetForAtlas(recipe.diceSet) } : {}), ...(recipe.advantage ? { advantage: recipe.advantage } : {}) }
          : undefined;
        const result = options
          ? context.diceTool.rollDice(entry.formula, source, origin, options)
          : context.diceTool.rollDice(entry.formula, source, origin);
        if (!result || !Number.isFinite(result.total)) return { available: true, engine: 'atlas', roll: null };
        const nextRecipe = recipeFor('atlas', source, recipe.diceSet ?? null, recipe.advantage, context);
        recordSuccessfulRoll(app, result, source, nextRecipe, 'atlas');
        return {
          available: true,
          engine: 'atlas',
          roll: {
            id: typeof result.id === 'string' ? result.id : undefined,
            formula: typeof result.formula === 'string' ? result.formula : entry.formula,
            total: Math.trunc(result.total),
          },
        };
      } catch (error) {
        return { available: true, engine: 'atlas', roll: null, error: error instanceof Error ? error.message : String(error) };
      }
    }
  }

  return localRepeat(app, entry, recipe);
}

/** Rolls on the map that owns the statblock, or through Forge's local engine when no map is open. */
export function rollForgeStatblockWithAtlasDiceTool(
  app: App,
  formula: string,
  source: {
    statblockPath: string;
    viewId?: string;
    tokenId?: string;
    tokenImagePath?: string;
    tokenName?: string;
    abilityName?: string;
    originContext?: AtlasDiceTokenRollContextLike;
  },
  explicitSet?: ForgeRestDiceSet | null,
  advantage?: 'advantage' | 'disadvantage' | null,
  offMapSet?: ForgeRestDiceSet | null,
): AtlasRestDiceAttempt {
  const target = resolveAtlasDiceRollTarget(app, source.viewId, source.originContext?.mapPath);
  if (target.status === 'origin-unavailable' || target.status === 'origin-hidden') {
    return {
      available: true,
      roll: null,
      error: target.status === 'origin-hidden'
        ? 'The originating Atlas map is hidden. Bring that map to the foreground before rolling.'
        : 'The originating Atlas map is no longer available.',
    };
  }
  if (target.status === 'ambiguous') {
    return { available: true, roll: null, error: 'More than one Atlas map is visible. Activate the intended map before rolling.' };
  }

  const rollSource = rollSourceOf(source);
  const effectiveSet = explicitSet ?? offMapSet ?? null;
  const effectiveAdvantage = combineWrittenAdvantage(writtenAdvantage(formula.trim()).side, advantage);
  const options = explicitSet || advantage
    ? { ...(explicitSet ? { set: diceSetForAtlas(explicitSet) } : {}), ...(advantage ? { advantage } : {}) }
    : undefined;
  try {
    let result: AtlasDiceRollResultLike | null;
    if (target.status === 'ready') {
      const origin = atlasDiceRollOriginForToken(target.context, source.tokenId, source.originContext);
      result = options
        ? target.context.diceTool.rollDice(formula, rollSource, origin, options)
        : target.context.diceTool.rollDice(formula, rollSource, origin);
      if (!result || !Number.isFinite(result.total)) return { available: true, engine: 'atlas', roll: null };
      const recipe = recipeFor('atlas', rollSource, effectiveSet, effectiveAdvantage, target.context);
      recordSuccessfulRoll(app, result, rollSource, recipe, 'atlas');
      return {
        available: true,
        engine: 'atlas',
        roll: {
          formula: typeof result.formula === 'string' ? result.formula : formula,
          total: Math.trunc(result.total),
          ...(typeof result.id === 'string' ? { id: result.id } : {}),
        },
      };
    }

    const localSet = effectiveSet;
    if (!localSet) return { available: false, engine: 'forge', roll: null };
    const local = rollForgeOffMapDiceFormula(formula, localSet, rollSource, advantage);
    if (!local.ok) return { available: true, engine: 'forge', roll: null, error: local.error };
    const recipe = recipeFor('forge', rollSource, localSet, effectiveAdvantage);
    recordSuccessfulRoll(app, local.result, rollSource, recipe, 'forge');
    return {
      available: true,
      engine: 'forge',
      details: local.result,
      roll: { id: local.result.id, formula: local.result.formula, total: local.result.total },
    };
  } catch (error) {
    return { available: true, roll: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Adapter used by the Rest flow; map rolls use Atlas and standalone rolls use Forge. */
export function rollForgeRestWithAtlasDiceTool(
  app: App,
  formula: string,
  source: { statblockPath: string; tokenName: string; abilityName: string },
  explicitSet?: ForgeRestDiceSet | null,
): AtlasRestDiceAttempt {
  return rollForgeStatblockWithAtlasDiceTool(app, formula, source, explicitSet);
}
