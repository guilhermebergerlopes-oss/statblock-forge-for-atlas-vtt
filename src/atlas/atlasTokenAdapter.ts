import type { App, WorkspaceLeaf } from 'obsidian';

/** Atlas map view type registered by the Atlas VTT plugin. */
export const ATLAS_TOKEN_VIEW_TYPE = 'atlas-vtt';

export type AtlasTokenAdapterStatus =
  | 'ready'
  | 'renderer-not-ready'
  | 'renderer-unavailable'
  | 'partial';

/**
 * Structural handles to the Atlas runtime.
 *
 * These are deliberately opaque at this stage. Later integration steps may
 * read token state or use the viewport/token renderer, but this first step
 * only discovers the view and validates that the expected runtime services
 * exist. No Atlas-owned state is changed.
 */
export interface AtlasTokenAdapterContext {
  readonly leaf: WorkspaceLeaf;
  readonly view: unknown;
  readonly atlasStore: unknown;
  readonly serviceManager: unknown;
  readonly rendererService: unknown;
  readonly renderer: unknown | null;
  readonly rendererInitialized: boolean;
  readonly status: AtlasTokenAdapterStatus;
}

export interface AtlasTokenAdapterDiagnostic {
  readonly status: AtlasTokenAdapterStatus;
  readonly rendererInitialized: boolean;
  readonly rendererAvailable: boolean;
  readonly storeAvailable: boolean;
  readonly serviceManagerAvailable: boolean;
}

interface AtlasTokenAdapterResult extends AtlasTokenAdapterContext {
  readonly diagnostic: AtlasTokenAdapterDiagnostic;
}

function isObject(value: unknown): value is Record<string, unknown> {
  // Zustand stores are callable functions with getState/subscribe/setState attached.
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

function isAtlasView(view: unknown): boolean {
  return callMember(view, 'getViewType') === ATLAS_TOKEN_VIEW_TYPE;
}

/**
 * Inspects a single workspace leaf. Returns null when it is not an Atlas map
 * view or when the Atlas view has not exposed its minimum runtime structure.
 */
export function inspectAtlasTokenView(leaf: WorkspaceLeaf): AtlasTokenAdapterResult | null {
  const view: unknown = leaf.view;
  if (!isAtlasView(view)) return null;

  const atlasStore = readMember(view, 'atlasStore');
  const serviceManager = readMember(view, 'serviceManager');
  const storeAvailable = typeof readMember(atlasStore, 'getState') === 'function';
  const serviceManagerAvailable = typeof readMember(serviceManager, 'getRendererService') === 'function';

  if (!storeAvailable || !serviceManagerAvailable) {
    const diagnostic: AtlasTokenAdapterDiagnostic = {
      status: 'partial',
      rendererInitialized: false,
      rendererAvailable: false,
      storeAvailable,
      serviceManagerAvailable,
    };

    return {
      leaf,
      view,
      atlasStore,
      serviceManager,
      rendererService: null,
      renderer: null,
      rendererInitialized: false,
      status: 'partial',
      diagnostic,
    };
  }

  const rendererService = callMember(serviceManager, 'getRendererService');
  const rendererInitialized = callMember(rendererService, 'isInitialized') === true;
  const renderer = rendererInitialized
    ? callMember(rendererService, 'getRenderer') ?? null
    : null;
  const rendererAvailable = isObject(renderer);

  const status: AtlasTokenAdapterStatus = !rendererInitialized
    ? 'renderer-not-ready'
    : rendererAvailable
      ? 'ready'
      : 'renderer-unavailable';

  const diagnostic: AtlasTokenAdapterDiagnostic = {
    status,
    rendererInitialized,
    rendererAvailable,
    storeAvailable,
    serviceManagerAvailable,
  };

  return {
    leaf,
    view,
    atlasStore,
    serviceManager,
    rendererService,
    renderer,
    rendererInitialized,
    status,
    diagnostic,
  };
}

/**
 * Finds every currently open Atlas map leaf and inspects its runtime handles.
 * Closed Atlas tabs are naturally excluded by Obsidian's workspace API.
 */
export function getAtlasTokenAdapterContexts(app: App): AtlasTokenAdapterResult[] {
  let leaves: WorkspaceLeaf[];
  try {
    leaves = app.workspace.getLeavesOfType(ATLAS_TOKEN_VIEW_TYPE);
  } catch {
    return [];
  }

  return leaves.flatMap((leaf) => {
    const result = inspectAtlasTokenView(leaf);
    return result ? [result] : [];
  });
}

/** Returns a compact diagnostic snapshot without exposing Atlas objects. */
export function getAtlasTokenAdapterDiagnostics(app: App): AtlasTokenAdapterDiagnostic[] {
  return getAtlasTokenAdapterContexts(app).map(({ diagnostic }) => diagnostic);
}
