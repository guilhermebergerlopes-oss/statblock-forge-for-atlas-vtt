import type { App, WorkspaceLeaf } from 'obsidian';
import { resolveAtlasVersionAdapter } from './atlasVersionAdapter.ts';

/** The original Atlas VTT plugin and workspace view identifiers. */
export const ATLAS_PLUGIN_ID = 'atlas-vtt';
export const ATLAS_VIEW_TYPE = 'atlas-vtt';

/**
 * Structural runtime handles based on the inspected Atlas 0.17.0 and 0.18.0 sources.
 * These types intentionally describe the internal objects Forge consumes;
 * they are not imports from Atlas, so the Forge bundle remains self-contained.
 */
export interface AtlasMapRuntimeContext {
  readonly leaf: WorkspaceLeaf;
  readonly view: unknown;
  readonly serviceManager: unknown;
  readonly store: unknown;
  readonly rendererService: unknown;
  readonly rendererInitialized: boolean;
  readonly renderer: unknown;
  readonly tokenRenderer: unknown;
  readonly tokenStatblockLinkService: unknown;
  readonly toolController: unknown;
  readonly notePreviewUIManager: unknown;
  readonly assetService: unknown;
  readonly diagnostics: AtlasMapRuntimeDiagnostics;
}

export interface AtlasMapRuntimeDiagnostics {
  readonly viewTypeMatches: boolean;
  readonly serviceManagerAvailable: boolean;
  readonly storeAvailable: boolean;
  readonly rendererServiceAvailable: boolean;
  readonly toolControllerAvailable: boolean;
  readonly notePreviewUIManagerAvailable: boolean;
  readonly assetServiceAvailable: boolean;
  readonly ready: boolean;
}

export type AtlasRuntimeStatus =
  | 'not-loaded'
  | 'loaded-no-maps'
  | 'ready'
  | 'partial'
  | 'unsupported-version';

export interface AtlasRuntimeSnapshot {
  readonly pluginId: typeof ATLAS_PLUGIN_ID;
  readonly pluginLoaded: boolean;
  readonly version: string | null;
  readonly runtimeSupported: boolean;
  readonly adapterId: string;
  readonly status: AtlasRuntimeStatus;
  readonly mapCount: number;
  readonly readyMapCount: number;
  readonly maps: readonly AtlasMapRuntimeContext[];
  readonly diagnostics: readonly string[];
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
    return (candidate as () => unknown).call(target);
  } catch {
    return undefined;
  }
}

function hasMethod(target: unknown, method: string): boolean {
  return typeof readMember(target, method) === 'function';
}

function pluginRegistry(app: App): unknown {
  return readMember(app, 'plugins');
}

/** Returns the currently loaded original Atlas plugin instance, without caching it. */
export function getLoadedAtlasPlugin(app: App): unknown | null {
  const plugins = pluginRegistry(app);
  const loaded = readMember(plugins, 'plugins');
  const plugin = readMember(loaded, ATLAS_PLUGIN_ID);
  return isObject(plugin) ? plugin : null;
}

/**
 * Returns currently open Atlas map leaves. Lookup is intentionally performed
 * on every call so enabling, disabling, or reloading Atlas never leaves Forge
 * holding a stale plugin or map reference.
 */
export function getAtlasMapLeaves(app: App): WorkspaceLeaf[] {
  const workspace = readMember(app, 'workspace');
  const getLeavesOfType = readMember(workspace, 'getLeavesOfType');
  if (typeof getLeavesOfType !== 'function') return [];

  try {
    const leaves = (getLeavesOfType as (this: unknown, viewType: string) => unknown).call(workspace, ATLAS_VIEW_TYPE);
    return Array.isArray(leaves) ? leaves as WorkspaceLeaf[] : [];
  } catch {
    return [];
  }
}

/**
 * Inspects the original AtlasView and resolves its per-map services.
 * The inspected Atlas baselines expose these through AtlasView.serviceManager and
 * AtlasView.atlasStore; every getter is guarded because map construction and
 * teardown can temporarily leave only part of the runtime available.
 */
export function inspectAtlasMapLeaf(leaf: WorkspaceLeaf): AtlasMapRuntimeContext | null {
  const view = readMember(leaf, 'view');
  if (!isObject(view)) return null;

  const viewType = callMember(view, 'getViewType');
  // Workspace.getLeavesOfType already filters the view type. Lightweight mocks
  // and transitional view wrappers may not implement getViewType().
  if (viewType !== undefined && viewType !== ATLAS_VIEW_TYPE) return null;

  const serviceManager = readMember(view, 'serviceManager');
  const store = readMember(view, 'atlasStore') ?? callMember(serviceManager, 'getStore');
  const rendererService = callMember(serviceManager, 'getRendererService') ?? null;
  const rendererInitialized = callMember(rendererService, 'isInitialized') === true;
  const renderer = rendererInitialized ? callMember(rendererService, 'getRenderer') ?? null : null;
  const tokenRenderer = callMember(renderer, 'getTokenRenderer') ?? null;
  const statblockSync = readMember(tokenRenderer, 'statblockSync');
  const tokenStatblockLinkService = readMember(statblockSync, 'tokenStatblockLinkService') ?? null;
  const toolController = callMember(serviceManager, 'getToolController') ?? null;
  const notePreviewUIManager = callMember(serviceManager, 'getNotePreviewUIManager') ?? null;
  const assetService = callMember(serviceManager, 'getAssetService') ?? null;

  const diagnostics: AtlasMapRuntimeDiagnostics = {
    viewTypeMatches: viewType === undefined || viewType === ATLAS_VIEW_TYPE,
    serviceManagerAvailable: isObject(serviceManager)
      && hasMethod(serviceManager, 'getRendererService')
      && hasMethod(serviceManager, 'getToolController')
      && hasMethod(serviceManager, 'getNotePreviewUIManager')
      && hasMethod(serviceManager, 'getAssetService')
      && hasMethod(serviceManager, 'getStore'),
    storeAvailable: hasMethod(store, 'getState'),
    rendererServiceAvailable: isObject(rendererService)
      && hasMethod(rendererService, 'getRenderer')
      && hasMethod(rendererService, 'isInitialized'),
    toolControllerAvailable: isObject(toolController) && hasMethod(toolController, 'getDiceTool'),
    notePreviewUIManagerAvailable: isObject(notePreviewUIManager)
      && hasMethod(notePreviewUIManager, 'showOrCreatePreview')
      && hasMethod(notePreviewUIManager, 'hideAllUnpinnedPreviews'),
    assetServiceAvailable: isObject(assetService) && hasMethod(assetService, 'loadedTokenAssets'),
    ready: false,
  };
  const ready = diagnostics.serviceManagerAvailable
    && diagnostics.storeAvailable
    && diagnostics.rendererServiceAvailable
    && diagnostics.toolControllerAvailable
    && diagnostics.notePreviewUIManagerAvailable;
  const completedDiagnostics: AtlasMapRuntimeDiagnostics = { ...diagnostics, ready };

  return {
    leaf,
    view,
    serviceManager,
    store,
    rendererService,
    rendererInitialized,
    renderer,
    tokenRenderer,
    tokenStatblockLinkService,
    toolController,
    notePreviewUIManager,
    assetService,
    diagnostics: completedDiagnostics,
  };
}

/** Returns all valid Atlas map runtime contexts, including maps still initializing. */
export function getAtlasMapViewContexts(app: App): AtlasMapRuntimeContext[] {
  return getAtlasMapLeaves(app).flatMap((leaf) => {
    const context = inspectAtlasMapLeaf(leaf);
    return context ? [context] : [];
  });
}

function loadedPluginVersion(plugin: unknown, app: App): string | null {
  const pluginManifest = readMember(plugin, 'manifest');
  const directVersion = readMember(pluginManifest, 'version');
  if (typeof directVersion === 'string' && directVersion.trim()) return directVersion.trim();

  const plugins = pluginRegistry(app);
  const manifests = readMember(plugins, 'manifests');
  const atlasManifest = readMember(manifests, ATLAS_PLUGIN_ID);
  const registeredVersion = readMember(atlasManifest, 'version');
  return typeof registeredVersion === 'string' && registeredVersion.trim() ? registeredVersion.trim() : null;
}

/**
 * Produces a live, read-only runtime snapshot. No plugin/map references are
 * cached, and the function does not register listeners or mutate Atlas state.
 */
export function inspectAtlasRuntime(app: App): AtlasRuntimeSnapshot {
  const plugin = getLoadedAtlasPlugin(app);
  const maps = getAtlasMapViewContexts(app);
  const readyMapCount = maps.filter((map) => map.diagnostics.ready).length;
  const diagnostics: string[] = [];
  const version = plugin ? loadedPluginVersion(plugin, app) : null;
  const versionAdapter = resolveAtlasVersionAdapter(version);

  if (!plugin && maps.length === 0) {
    diagnostics.push('Atlas VTT is not currently loaded.');
  } else if (!plugin) {
    diagnostics.push('Atlas map views exist, but the Atlas plugin instance is not present in the plugin registry.');
  } else if (version === null) {
    diagnostics.push('Atlas is loaded, but its runtime manifest version could not be read. Internal hooks remain disabled until the version is verified.');
  } else if (versionAdapter.kind === 'forward-compatible-version') {
    diagnostics.push(`Atlas ${version} is newer than the inspected runtime baseline. Forge will use the ${versionAdapter.adapterId.includes('0.18.0') ? '0.18.0' : '0.17.0'} contract and check the required runtime members for each feature; features whose Atlas APIs changed may remain unavailable.`);
  } else if (versionAdapter.runtimeMode !== 'internal-runtime') {
    diagnostics.push(`Atlas ${version} is older than the minimum supported runtime version 0.17.0. Internal hooks remain disabled; Vault-based features continue to work.`);
  }

  for (const [index, map] of maps.entries()) {
    if (!map.diagnostics.ready) {
      const missing = Object.entries(map.diagnostics)
        .filter(([key, value]) => key !== 'viewTypeMatches' && key !== 'ready' && value === false)
        .map(([key]) => key);
      diagnostics.push(`Atlas map ${index + 1} is still initializing or lacks runtime members: ${missing.join(', ') || 'unknown'}.`);
    }
  }

  const status: AtlasRuntimeStatus = !plugin && maps.length === 0
    ? 'not-loaded'
    : !plugin || version === null || maps.some((map) => !map.diagnostics.ready)
      ? 'partial'
      : versionAdapter.runtimeMode !== 'internal-runtime'
        ? 'unsupported-version'
        : maps.length === 0
          ? 'loaded-no-maps'
          : 'ready';

  return {
    pluginId: ATLAS_PLUGIN_ID,
    pluginLoaded: plugin !== null,
    version,
    runtimeSupported: versionAdapter.runtimeMode === 'internal-runtime',
    adapterId: versionAdapter.adapterId,
    status,
    mapCount: maps.length,
    readyMapCount,
    maps,
    diagnostics,
  };
}
