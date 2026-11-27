import type { App, WorkspaceLeaf } from 'obsidian';
import { getAtlasMapViewContexts, type AtlasMapRuntimeContext } from './atlasRuntime.ts';

/** Structural subset of Atlas DiceRollResult consumed by Forge, based on the 0.17.0/0.18.0 baselines. */
export interface AtlasDiceRollResultLike {
  readonly id?: string;
  readonly timestamp?: number;
  readonly formula?: string;
  readonly total: number;
  readonly source?: unknown;
  readonly [key: string]: unknown;
}

/** Structural subset of Atlas DiceTool consumed by Forge, based on the 0.17.0/0.18.0 baselines. */
export interface AtlasDiceToolLike {
  rollDice(
    formula: string,
    source?: unknown,
    origin?: unknown,
    options?: unknown,
  ): AtlasDiceRollResultLike | null;
  rollingDice?(set?: unknown): {
    readonly dice: readonly { readonly count: number; readonly sides: number }[];
    readonly advantage?: unknown;
    readonly disadvantage?: unknown;
  };
  getState?(): unknown;
  clearHistory?(): void;
  readonly state?: unknown;
}

export interface AtlasDiceEventBusLike {
  on?(event: string, listener: (...args: unknown[]) => void): unknown;
  off?(event: string, listener: (...args: unknown[]) => void): unknown;
}

export interface AtlasDiceRuntimeContext {
  readonly leaf: WorkspaceLeaf;
  readonly view: unknown;
  readonly serviceManager: unknown;
  readonly store: unknown;
  readonly viewId: string | null;
  readonly mapPath: string | null;
  readonly visible: boolean;
  readonly diceTool: AtlasDiceToolLike;
  /** In-memory DiceTool.state.rollHistory (up to 50 entries in the verified Atlas profiles). */
  readonly inMemoryHistory: readonly AtlasDiceRollResultLike[];
  /** Persisted per-map atlasStore.getState().diceLog (up to 20 entries in the verified Atlas profiles). */
  readonly persistedHistory: readonly AtlasDiceRollResultLike[];
  /** The per-map ServiceManager event bus; dice-rolled and dice-history-cleared are emitted here. */
  readonly eventBus: AtlasDiceEventBusLike | null;
}

export interface AtlasDiceRollOriginLike {
  readonly viewId: string;
  readonly mapPath: string;
  readonly tokenId: string;
}

/** Snapshot Atlas captures when the token's statblock preview is opened. */
export interface AtlasDiceTokenRollContextLike {
  readonly viewId: string;
  readonly mapPath: string;
  readonly tokenIds: readonly string[];
}

export type AtlasDiceRollTargetResolution =
  | { readonly status: 'ready'; readonly context: AtlasDiceRuntimeContext }
  | { readonly status: 'none' | 'ambiguous' | 'origin-unavailable' | 'origin-hidden' };

export interface AtlasDiceHistorySnapshot {
  readonly viewId: string | null;
  readonly mapPath: string | null;
  readonly visible: boolean;
  readonly inMemoryHistory: readonly AtlasDiceRollResultLike[];
  readonly persistedHistory: readonly AtlasDiceRollResultLike[];
  readonly eventBus: AtlasDiceEventBusLike | null;
}

export interface FindAtlasDiceRuntimeOptions {
  /** Restrict discovery to the view that owns the statblock, when known. */
  readonly viewId?: string;
  /** Hidden map views are excluded by default so their roll display is not lost behind another tab. */
  readonly includeHidden?: boolean;
}

type UnknownRecord = Record<string, unknown>;

function isObject(value: unknown): value is UnknownRecord {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

function readMember(target: unknown, key: string): unknown {
  if (!isObject(target)) return undefined;
  try {
    return target[key];
  } catch {
    return undefined;
  }
}

function callMember(target: unknown, method: string): unknown {
  const candidate = readMember(target, method);
  if (typeof candidate !== 'function') return undefined;
  try {
    return (candidate as (this: unknown) => unknown).call(target);
  } catch {
    return undefined;
  }
}

function historyEntries(value: unknown): readonly AtlasDiceRollResultLike[] {
  return Array.isArray(value) ? value.filter(isObject) as AtlasDiceRollResultLike[] : [];
}

function visibleView(view: unknown): boolean {
  const container = readMember(view, 'containerEl');
  const isShown = readMember(container, 'isShown');
  // Atlas always provides isShown(). A test double or wrapper without it follows
  // the existing Forge convention and is treated as visible.
  if (typeof isShown !== 'function') return true;
  try {
    return (isShown as (this: unknown) => unknown).call(container) === true;
  } catch {
    // Fail closed: a broken visibility check must not route a roll into a hidden tab.
    return false;
  }
}

function mapViewId(view: unknown): string | null {
  const value = readMember(view, 'viewId');
  return typeof value === 'string' && value.trim() ? value : null;
}

/**
 * Resolves the per-map dice runtime using the inspected original Atlas 0.17.0/0.18.0 baselines. The source path is:
 * AtlasView.serviceManager -> ServiceManager.getToolController() ->
 * ToolController.getDiceTool(). Store history and the event bus are read from
 * the same map's atlasStore and ServiceManager; no fork API is consulted.
 *
 * All references are resolved afresh on every call so closing/reopening a map
 * cannot leave Forge holding a stale DiceTool or store.
 */
export function getAtlasDiceRuntimeContexts(app: App): AtlasDiceRuntimeContext[] {
  return getAtlasMapViewContexts(app).flatMap((map: AtlasMapRuntimeContext) => {
    const toolController = map.toolController;
    const diceTool = callMember(toolController, 'getDiceTool');
    if (!isObject(diceTool) || typeof readMember(diceTool, 'rollDice') !== 'function') return [];

    const view = map.view;
    const store = map.store;
    const state = callMember(store, 'getState');
    const toolState = callMember(diceTool, 'getState') ?? readMember(diceTool, 'state');
    const serviceManager = map.serviceManager;
    const eventBus = callMember(serviceManager, 'getEventBus');

    return [{
      leaf: map.leaf,
      view,
      serviceManager,
      store,
      viewId: mapViewId(view),
      mapPath: typeof readMember(state, 'mapPath') === 'string' ? readMember(state, 'mapPath') as string : null,
      visible: visibleView(view),
      diceTool: diceTool as unknown as AtlasDiceToolLike,
      inMemoryHistory: historyEntries(readMember(toolState, 'rollHistory')).slice(),
      persistedHistory: historyEntries(readMember(state, 'diceLog')).slice(),
      eventBus: isObject(eventBus) ? eventBus as AtlasDiceEventBusLike : null,
    }];
  });
}

/**
 * Finds a map DiceTool. By default only a visible map is eligible; when a
 * statblock has an originating viewId, callers can target it explicitly and
 * opt into hidden views when the Atlas view still owns that statblock.
 */
export function findAtlasDiceRuntimeContext(
  app: App,
  options: FindAtlasDiceRuntimeOptions = {},
): AtlasDiceRuntimeContext | null {
  const contexts = getAtlasDiceRuntimeContexts(app);
  if (options.viewId) {
    const match = contexts.find((context) => context.viewId === options.viewId);
    if (!match || (!match.visible && options.includeHidden !== true)) return null;
    return match;
  }
  return contexts.find((context) => context.visible)
    ?? (options.includeHidden === true ? contexts[0] ?? null : null);
}

/** Visible-map DiceTool used by Forge's current in-map roll path. */
export function findVisibleAtlasDiceTool(app: App): AtlasDiceToolLike | null {
  return findAtlasDiceRuntimeContext(app)?.diceTool ?? null;
}

/**
 * Reads history snapshots from the currently open Atlas maps. `persistedHistory`
 * is the map's durable diceLog; `inMemoryHistory` is DiceTool's transient list.
 * This function intentionally does not merge/dedupe or repeat entries: Stage
 * 5.4 will define the Forge-facing statblock history semantics.
 */
export function getAtlasDiceHistorySnapshots(app: App): AtlasDiceHistorySnapshot[] {
  return getAtlasDiceRuntimeContexts(app).map((context) => ({
    viewId: context.viewId,
    mapPath: context.mapPath,
    visible: context.visible,
    inMemoryHistory: context.inMemoryHistory,
    persistedHistory: context.persistedHistory,
    eventBus: context.eventBus,
  }));
}


/**
 * Resolves the map that should own a Forge statblock roll.
 *
 * An explicit originating view is authoritative: a closed or hidden origin is
 * not silently redirected into a different map. Without an origin, a single
 * visible map is safe; when multiple maps are visible, the active Atlas leaf
 * must disambiguate them.
 */
export function resolveAtlasDiceRollTarget(
  app: App,
  originatingViewId?: string,
  expectedMapPath?: string,
): AtlasDiceRollTargetResolution {
  const contexts = getAtlasDiceRuntimeContexts(app);
  if (originatingViewId) {
    const exact = contexts.find((context) => context.viewId === originatingViewId);
    if (!exact || (expectedMapPath && exact.mapPath !== expectedMapPath)) return { status: 'origin-unavailable' };
    if (!exact.visible) return { status: 'origin-hidden' };
    return { status: 'ready', context: exact };
  }

  const visible = contexts.filter((context) => context.visible);
  if (visible.length === 1) return { status: 'ready', context: visible[0]! };
  if (visible.length === 0) return { status: 'none' };

  const workspace = readMember(app, 'workspace');
  const activeLeaf = readMember(workspace, 'activeLeaf');
  const active = visible.filter((context) => context.leaf === activeLeaf);
  if (active.length === 1) return { status: 'ready', context: active[0]! };
  return { status: 'ambiguous' };
}

interface PresentedSceneIdentity {
  readonly tabIds: readonly string[];
  readonly mapPaths: readonly string[];
}

/** Reads Atlas' public, read-only presentedScene descriptor without importing Atlas internals. */
function presentedSceneIdentity(app: App): PresentedSceneIdentity | null {
  const plugins = readMember(readMember(app, 'plugins'), 'plugins');
  const atlas = readMember(plugins, 'atlas-vtt');
  const source = readMember(atlas, 'presentedScene');
  if (!isObject(source)) return null;
  // Atlas exposes presentedScene as a source/store with get(), not as the
  // descriptor itself. Read the current descriptor so hidden/background map
  // tabs can still be targeted while they remain presented to the LPV.
  const getter = readMember(source, 'get');
  let presented: unknown = source;
  if (typeof getter === 'function') {
    try { presented = (getter as (this: unknown) => unknown).call(source); }
    catch { return null; }
  }
  if (!isObject(presented)) return null;

  const tabIds: string[] = [];
  const mapPaths: string[] = [];
  for (const [key, raw] of Object.entries(presented)) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const value = raw.trim();
    const loweredKey = key.toLowerCase();
    if (loweredKey.includes('tab') || loweredKey.includes('view') || loweredKey === 'id') tabIds.push(value);
    if ((loweredKey.includes('path') || loweredKey.includes('file') || loweredKey.includes('map'))
      && /\.atlasmap(?:$|[?#])/i.test(value)) mapPaths.push(value);
    // Atlas has described the presented scene as its tab id plus its map file.
    // This suffix check also survives a property rename such as filePath -> mapFile.
    if (/\.atlasmap(?:$|[?#])/i.test(value) && !mapPaths.includes(value)) mapPaths.push(value);
  }
  return tabIds.length || mapPaths.length ? { tabIds: [...new Set(tabIds)], mapPaths: [...new Set(mapPaths)] } : null;
}

/**
 * Selects the map Atlas is actually showing in its Local Player View. This is
 * deliberately different from the active GM tab: the GM can switch maps while
 * the player window keeps the last presented scene. Hidden workspace tabs are
 * valid here because Atlas keeps their event bus alive while that scene is held.
 */
export function resolveAtlasDiceRollTargetForPlayerView(app: App): AtlasDiceRollTargetResolution {
  const identity = presentedSceneIdentity(app);
  if (!identity) return resolveAtlasDiceRollTarget(app);

  const contexts = getAtlasDiceRuntimeContexts(app);
  const byTab = identity.tabIds.flatMap((id) => contexts.filter((context) =>
    context.viewId === id || readMember(context.view, 'tabId') === id || readMember(context.view, 'id') === id));
  const uniqueByTab = [...new Map(byTab.map((context) => [context.viewId ?? String(context.leaf), context])).values()];
  if (uniqueByTab.length === 1) {
    const context = uniqueByTab[0]!;
    if (identity.mapPaths.length && context.mapPath && !identity.mapPaths.includes(context.mapPath)) {
      return { status: 'origin-unavailable' };
    }
    return { status: 'ready', context };
  }

  const byPath = identity.mapPaths.flatMap((path) => contexts.filter((context) => context.mapPath === path));
  const uniqueByPath = [...new Map(byPath.map((context) => [context.viewId ?? String(context.leaf), context])).values()];
  if (uniqueByPath.length === 1) return { status: 'ready', context: uniqueByPath[0]! };
  if (uniqueByPath.length > 1 || uniqueByTab.length > 1) return { status: 'ambiguous' };
  return { status: 'origin-unavailable' };
}

/**
 * Creates the transient Atlas DiceRollOrigin event payload only while the
 * originating token still exists in the selected map. Atlas does not persist
 * this object on the roll; it is used for map/token-aware online handling.
 */
export function atlasDiceRollOriginForToken(
  context: AtlasDiceRuntimeContext,
  tokenId?: string,
  expectedContext?: AtlasDiceTokenRollContextLike,
): AtlasDiceRollOriginLike | undefined {
  if (!tokenId || !context.viewId || !context.mapPath) return undefined;
  if (expectedContext && (expectedContext.viewId !== context.viewId
    || expectedContext.mapPath !== context.mapPath
    || !expectedContext.tokenIds.includes(tokenId))) return undefined;
  const state = callMember(context.store, 'getState');
  const objects = readMember(state, 'objects');
  const tokens = readMember(objects, 'tokens');
  const token = readMember(tokens, tokenId);
  if (!isObject(token) || readMember(token, 'offMap') === true) return undefined;
  return Object.freeze({ viewId: context.viewId, mapPath: context.mapPath, tokenId });
}
