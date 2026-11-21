import type { App, WorkspaceLeaf } from 'obsidian';
import { getAtlasMapViewContexts, inspectAtlasMapLeaf } from './atlasRuntime.ts';

export type AtlasTokenAdapterStatus =
  | 'ready'
  | 'renderer-not-ready'
  | 'renderer-unavailable'
  | 'partial';

/**
 * Token-specific projection of the central Atlas runtime context.
 * Discovery and service lookup live in atlasRuntime.ts; this adapter only
 * exposes the subset required by token readers and link services.
 */
export interface AtlasTokenAdapterContext {
  readonly leaf: WorkspaceLeaf;
  readonly view: unknown;
  readonly atlasStore: unknown;
  readonly serviceManager: unknown;
  readonly rendererService: unknown;
  readonly renderer: unknown;
  /** Atlas PixiRendererOrchestrator.getTokenRenderer(), when initialized. */
  readonly tokenRenderer: unknown;
  /** Shared Atlas AssetService exposed by this map's ServiceManager. */
  readonly assetService: unknown;
  /** Internal singleton reached through TokenRenderer.statblockSync. */
  readonly tokenStatblockLinkService: unknown;
  readonly rendererInitialized: boolean;
  readonly status: AtlasTokenAdapterStatus;
}

/**
 * Projects an already inspected Atlas map leaf into the token adapter shape.
 * The central runtime owns view validation and all structural lookups, avoiding
 * a second traversal of Workspace leaves and ServiceManager getters.
 */
function tokenAdapterContext(runtime: NonNullable<ReturnType<typeof inspectAtlasMapLeaf>>): AtlasTokenAdapterContext {
  const rendererIsObject = (typeof runtime.renderer === 'object' || typeof runtime.renderer === 'function')
    && runtime.renderer !== null;
  const status: AtlasTokenAdapterStatus = !runtime.diagnostics.storeAvailable
    || !runtime.diagnostics.rendererServiceAvailable
      ? 'partial'
      : !runtime.rendererInitialized
        ? 'renderer-not-ready'
        : !rendererIsObject
          ? 'renderer-unavailable'
          : 'ready';

  return {
    leaf: runtime.leaf,
    view: runtime.view,
    atlasStore: runtime.store,
    serviceManager: runtime.serviceManager,
    rendererService: runtime.rendererService,
    renderer: runtime.renderer,
    tokenRenderer: runtime.tokenRenderer,
    assetService: runtime.assetService,
    tokenStatblockLinkService: runtime.tokenStatblockLinkService,
    rendererInitialized: runtime.rendererInitialized,
    status,
  };
}

/** Projects one leaf using the central Atlas runtime discovery. */
export function inspectAtlasTokenView(leaf: WorkspaceLeaf): AtlasTokenAdapterContext | null {
  const runtime = inspectAtlasMapLeaf(leaf);
  return runtime ? tokenAdapterContext(runtime) : null;
}

/** Finds token-capable contexts from the central live Atlas runtime discovery. */
export function getAtlasTokenAdapterContexts(app: App): AtlasTokenAdapterContext[] {
  return getAtlasMapViewContexts(app).map(tokenAdapterContext);
}
