import type { App } from 'obsidian';
import type { ForgeRestDiceSet } from './restDiceRoller.ts';
import { forgeStatblockAdvantageSides, type ForgeAdvantageSide } from './statblockDiceMenuModel.ts';
import { ATLAS_PLUGIN_ID } from '../atlas/atlasRuntimeDetection.ts';

export interface AtlasRestDiceRoll {
  formula: string;
  total: number;
  id?: string;
}

export interface AtlasRestDiceRollHistoryEntry {
  id: string;
  formula: string;
  total: number;
  timestamp: number;
  statblockPath: string;
  tokenName?: string;
  abilityName?: string;
  advantage?: 'advantage' | 'disadvantage';
  repeatable?: boolean;
}

export interface AtlasRestDiceAttempt {
  /** False only when neither an Atlas map Dice Tool nor the public app-wide dice API is available. */
  available: boolean;
  /** Null when Atlas was available but refused or failed to roll the formula. */
  roll: AtlasRestDiceRoll | null;
  error?: string;
}

interface AtlasRollSource {
  type: 'statblock';
  statblockPath: string;
  tokenName?: string;
  abilityName?: string;
}

interface AtlasDiceToolLike {
  rollingDice?(set?: ForgeRestDiceSet): {
    dice: readonly { count: number; sides: number }[];
    advantage?: unknown;
    disadvantage?: unknown;
  };
  rollDice(
    formula: string,
    source?: AtlasRollSource,
    origin?: unknown,
    options?: { set?: ForgeRestDiceSet; advantage?: 'advantage' | 'disadvantage' },
  ): AtlasRestDiceRoll | null;
}

interface AtlasPublicAPILike {
  apiVersion?: number;
  capabilities?: readonly string[];
  dice?: AtlasPublicDiceAPI;
}

interface AtlasPublicDicePluginLike {
  publicAPI?: AtlasPublicAPILike;
}

interface AtlasPublicDiceAPI {
  rollStatblock?(request: {
    formula: string;
    source: AtlasRollSource;
    set?: ForgeRestDiceSet;
    advantage?: 'advantage' | 'disadvantage';
  }): AtlasRestDiceRoll | null;
  rollingDiceForStatblock?(request: {
    source: AtlasRollSource;
    set?: ForgeRestDiceSet;
  }): {
    dice: readonly { count: number; sides: number }[];
    advantage?: unknown;
    disadvantage?: unknown;
  } | null;
  getStatblockRollHistory?(request: { statblockPath: string; limit?: number }): readonly AtlasRestDiceRollHistoryEntry[];
  repeatStatblockRoll?(request: { id: string }): AtlasRestDiceRoll | null;
}

interface AtlasMapViewLike {
  containerEl?: HTMLElement & { isShown?: () => boolean };
  serviceManager?: {
    getToolController?: () => {
      getDiceTool?: () => AtlasDiceToolLike | null | undefined;
    } | null | undefined;
  };
}

function diceSetForAtlas(set: ForgeRestDiceSet): ForgeRestDiceSet {
  // This object matches Atlas's public DiceSet shape. It is only passed to
  // DiceTool.rollDice; Forge does not mutate Atlas's library or the set object.
  return {
    ...set,
    dice: set.dice.map((die) => ({ ...die })),
    ...(set.explode ? { explode: { ...set.explode } } : {}),
    ...(set.advantage ? { advantage: { ...set.advantage } } : {}),
    ...(set.disadvantage ? { disadvantage: { ...set.disadvantage } } : {}),
  };
}

/** Finds only a visible Atlas map Dice Tool; hidden tabs must use the app-wide roll layer. */
function findAtlasDiceTool(app: App): AtlasDiceToolLike | null {
  const workspace = app.workspace as unknown as {
    getLeavesOfType?: (viewType: string) => Array<{ view?: unknown }>;
  };
  if (typeof workspace.getLeavesOfType !== 'function') return null;

  for (const leaf of workspace.getLeavesOfType('atlas-vtt')) {
    const view = leaf.view as AtlasMapViewLike | undefined;
    const candidate = view?.serviceManager?.getToolController?.()?.getDiceTool?.();
    if (!candidate || typeof candidate.rollDice !== 'function') continue;
    const shown = typeof view.containerEl?.isShown === 'function' ? view.containerEl.isShown() : true;
    if (shown) return candidate;
  }
  return null;
}

/** Finds Atlas' versioned app-wide dice API; unlike a map Dice Tool, it works with no scene open. */
function findAtlasPublicDiceAPI(app: App): AtlasPublicDiceAPI | null {
  const pluginManager = (app as unknown as { plugins?: { plugins?: Record<string, AtlasPublicDicePluginLike | undefined> } }).plugins;
  const api = pluginManager?.plugins?.[ATLAS_PLUGIN_ID]?.publicAPI;
  if (api?.apiVersion !== 1 || !api.capabilities?.includes('dice.statblock-rolls')) return null;
  if (typeof api.dice?.rollStatblock !== 'function' || typeof api.dice?.rollingDiceForStatblock !== 'function') return null;
  return api.dice;
}

function findAtlasPublicDiceHistoryAPI(app: App): AtlasPublicDiceAPI | null {
  const pluginManager = (app as unknown as { plugins?: { plugins?: Record<string, AtlasPublicDicePluginLike | undefined> } }).plugins;
  const api = pluginManager?.plugins?.[ATLAS_PLUGIN_ID]?.publicAPI;
  if (api?.apiVersion !== 1 || !api.capabilities?.includes('dice.statblock-history')) return null;
  const dice = api.dice;
  if (typeof dice?.getStatblockRollHistory !== 'function' || typeof dice?.repeatStatblockRoll !== 'function'
    || typeof dice?.rollStatblock !== 'function') return null;
  return dice;
}

export function hasForgeStatblockRollHistory(app: App): boolean {
  return findAtlasPublicDiceHistoryAPI(app) !== null;
}

export function getForgeStatblockRollHistory(
  app: App,
  statblockPath: string,
  limit = 10,
): AtlasRestDiceRollHistoryEntry[] {
  if (typeof statblockPath !== 'string' || !statblockPath.trim()) return [];
  const api = findAtlasPublicDiceHistoryAPI(app);
  if (!api?.getStatblockRollHistory) return [];
  try {
    const requestedLimit = Number.isInteger(limit) ? Math.max(1, Math.min(50, limit)) : 10;
    const entries = api.getStatblockRollHistory({ statblockPath, limit: requestedLimit });
    return Array.isArray(entries) ? entries
      .filter((entry) => entry && typeof entry.id === 'string' && typeof entry.formula === 'string'
        && Number.isFinite(entry.total) && Number.isFinite(entry.timestamp) && entry.statblockPath === statblockPath)
      .slice(0, requestedLimit)
      .map((entry) => ({
        id: entry.id,
        formula: entry.formula,
        total: entry.total,
        timestamp: entry.timestamp,
        statblockPath: entry.statblockPath,
        ...(typeof entry.tokenName === 'string' ? { tokenName: entry.tokenName } : {}),
        ...(typeof entry.abilityName === 'string' ? { abilityName: entry.abilityName } : {}),
        ...(entry.advantage === 'advantage' || entry.advantage === 'disadvantage' ? { advantage: entry.advantage } : {}),
        ...(entry.repeatable === false ? { repeatable: false } : { repeatable: true }),
      })) : [];
  } catch {
    return [];
  }
}

export function repeatForgeStatblockRollFromHistory(app: App, id: string): AtlasRestDiceAttempt {
  const api = findAtlasPublicDiceHistoryAPI(app);
  if (!api?.repeatStatblockRoll || typeof id !== 'string' || !id.trim()) return { available: false, roll: null };
  try {
    const result = api.repeatStatblockRoll({ id });
    if (!result || !Number.isFinite(result.total)) return { available: true, roll: null };
    return {
      available: true,
      roll: {
        formula: typeof result.formula === 'string' ? result.formula : '',
        total: Math.trunc(result.total),
        ...(typeof result.id === 'string' ? { id: result.id } : {}),
      },
    };
  } catch (error) {
    return { available: true, roll: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function rollSourceOf(source: { statblockPath: string; tokenName?: string; abilityName?: string }): AtlasRollSource {
  return {
    type: 'statblock',
    statblockPath: source.statblockPath,
    ...(source.tokenName ? { tokenName: source.tokenName } : {}),
    ...(source.abilityName ? { abilityName: source.abilityName } : {}),
  };
}

/** The active Atlas dice rules, written as a default bonus formula (for example `1d20+1d6`). */
export function forgeStatblockDefaultRollFormula(
  app: App,
  explicitSet?: ForgeRestDiceSet | null,
  statblockPath = 'statblock-forge:unknown',
): string | null {
  const tool = findAtlasDiceTool(app);
  try {
    const rules = tool?.rollingDice
      ? tool.rollingDice(explicitSet ? diceSetForAtlas(explicitSet) : undefined)
      : findAtlasPublicDiceAPI(app)?.rollingDiceForStatblock?.({
          source: rollSourceOf({ statblockPath }),
          ...(explicitSet ? { set: diceSetForAtlas(explicitSet) } : {}),
        });
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
): ForgeAdvantageSide[] {
  const tool = findAtlasDiceTool(app);
  try {
    const rules = tool?.rollingDice
      ? tool.rollingDice(explicitSet ? diceSetForAtlas(explicitSet) : undefined)
      : findAtlasPublicDiceAPI(app)?.rollingDiceForStatblock?.({
          source: rollSourceOf({ statblockPath }),
          ...(explicitSet ? { set: diceSetForAtlas(explicitSet) } : {}),
        });
    return rules ? forgeStatblockAdvantageSides(formula, rules) : [];
  } catch {
    return [];
  }
}

/**
 * Sends a statblock formula through Atlas. When the history capability exists,
 * Atlas owns routing between a visible map DiceTool and its app-wide roller.
 * Older fork builds retain the compatible map-tool/public-roll fallback.
 */
export function rollForgeStatblockWithAtlasDiceTool(
  app: App,
  formula: string,
  source: { statblockPath: string; tokenName?: string; abilityName?: string },
  explicitSet?: ForgeRestDiceSet | null,
  advantage?: 'advantage' | 'disadvantage' | null,
): AtlasRestDiceAttempt {
  const historyDice = findAtlasPublicDiceHistoryAPI(app);
  const tool = historyDice ? null : findAtlasDiceTool(app);
  const publicDice = historyDice ?? (tool ? null : findAtlasPublicDiceAPI(app));
  if (!tool && !publicDice) return { available: false, roll: null };

  const rollSource = rollSourceOf(source);
  const options = explicitSet || advantage
    ? { ...(explicitSet ? { set: diceSetForAtlas(explicitSet) } : {}), ...(advantage ? { advantage } : {}) }
    : undefined;
  try {
    const result = publicDice
      ? publicDice.rollStatblock?.({ formula, source: rollSource, ...(explicitSet ? { set: diceSetForAtlas(explicitSet) } : {}), ...(advantage ? { advantage } : {}) }) ?? null
      : tool
        ? (options ? tool.rollDice(formula, rollSource, undefined, options) : tool.rollDice(formula, rollSource))
        : null;
    if (!result || !Number.isFinite(result.total)) return { available: true, roll: null };
    return {
      available: true,
      roll: {
        formula: typeof result.formula === 'string' ? result.formula : formula,
        total: Math.trunc(result.total),
        ...(typeof result.id === 'string' ? { id: result.id } : {}),
      },
    };
  } catch (error) {
    return { available: true, roll: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Backwards-compatible adapter used by the Rest flow. */
export function rollForgeRestWithAtlasDiceTool(
  app: App,
  formula: string,
  source: { statblockPath: string; tokenName: string; abilityName: string },
  explicitSet?: ForgeRestDiceSet | null,
): AtlasRestDiceAttempt {
  return rollForgeStatblockWithAtlasDiceTool(app, formula, source, explicitSet);
}
