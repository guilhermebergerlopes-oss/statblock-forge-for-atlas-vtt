import type { App, EventRef, WorkspaceLeaf } from 'obsidian';
import type StatblockForgePlugin from '../../main';
import { getAtlasMapViewContexts, inspectAtlasRuntime } from './atlasRuntime.ts';
import { isForgeNativeV2Statblock } from './atlasForgePreviewRenderer.ts';
import type { AtlasDiceTokenRollContextLike } from './atlasDiceRuntime.ts';
import {
  ForgeStatblockPreviewWindow,
  type AtlasForgePreviewAnchorLike,
  type AtlasForgePreviewManagerLike,
} from './forgeStatblockPreviewWindow.ts';

interface AtlasPreviewManager extends AtlasForgePreviewManagerLike {
  showOrCreatePreview(
    pin: AtlasForgePreviewAnchorLike,
    screenX: number,
    screenY: number,
    sourceLeaf?: WorkspaceLeaf | null,
    originContext?: unknown,
  ): Promise<void>;
  showStatblocksWithMap?(): void;
  activePreviews: Map<string, unknown>;
  hideAllUnpinnedPreviews(excludeNotePath?: string | null): void;
}


function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function notePathWithoutHeading(notePath: string): string {
  return notePath.split('#', 1)[0] ?? notePath;
}

function isTokenAnchor(pin: AtlasForgePreviewAnchorLike): boolean {
  return pin.type === 'token' && typeof pin.id === 'string' && typeof pin.notePath === 'string';
}


function existingPreview(manager: AtlasPreviewManager, pinId: string): unknown {
  for (const preview of manager.activePreviews.values()) {
    if (!isObject(preview)) continue;
    const origin = preview.originatingPin;
    if (isObject(origin) && origin.id === pinId) return preview;
  }
  return undefined;
}

function raisePreview(manager: AtlasPreviewManager, preview: ForgeStatblockPreviewWindow): void {
  if (manager.raiseZIndex) manager.raiseZIndex(preview);
  else if (preview.element) preview.element.setCssStyles({ zIndex: '40' });
}


function capturedTokenRollContext(
  value: unknown,
  manager: AtlasPreviewManager,
  tokenId: string,
): AtlasDiceTokenRollContextLike | undefined {
  if (!isObject(value)) return undefined;
  const viewId = value.viewId;
  const mapPath = value.mapPath;
  const tokenIds = value.tokenIds;
  if (typeof viewId !== 'string' || !viewId.trim() || viewId !== manager.viewId
    || typeof mapPath !== 'string' || !mapPath.trim()
    || !Array.isArray(tokenIds) || !tokenIds.every((id) => typeof id === 'string')
    || !tokenIds.includes(tokenId)) return undefined;
  return Object.freeze({ viewId, mapPath, tokenIds: Object.freeze([...new Set(tokenIds as string[])]) });
}

function isShownMapLeaf(leaf: WorkspaceLeaf): boolean {
  const view = leaf.view as { containerEl?: HTMLElement & { isShown?: () => boolean } } | undefined;
  const container = view?.containerEl;
  if (!container) return false;
  return typeof container.isShown === 'function' ? container.isShown() : true;
}

/**
 * Installs a narrow interception on a verified original Atlas NotePreviewUIManager instance.
 * Only Forge-native v2 token notes are handled; every other preview follows the original method.
 */
export function installForgePreviewHooksForManager(
  app: App,
  plugin: StatblockForgePlugin,
  manager: AtlasPreviewManager,
  leaf: WorkspaceLeaf,
): (() => void) | null {
  if (typeof manager.showOrCreatePreview !== 'function' || !(manager.activePreviews instanceof Map)) return null;
  const originalShowOrCreatePreview = manager.showOrCreatePreview;
  const originalShowStatblocksWithMap = manager.showStatblocksWithMap;

  const wrappedShowOrCreatePreview: AtlasPreviewManager['showOrCreatePreview'] = async function (
    pin,
    screenX,
    screenY,
    sourceLeaf,
    originContext,
  ): Promise<void> {
    if (!isTokenAnchor(pin)) {
      return originalShowOrCreatePreview.call(manager, pin, screenX, screenY, sourceLeaf, originContext);
    }

    const sourcePath = notePathWithoutHeading(pin.notePath);
    if (!isForgeNativeV2Statblock(app, sourcePath)) {
      return originalShowOrCreatePreview.call(manager, pin, screenX, screenY, sourceLeaf, originContext);
    }

    const previous = existingPreview(manager, pin.id);
    if (previous instanceof ForgeStatblockPreviewWindow) {
      if (!previous.getIsPinned()) previous.setPosition(screenX, screenY);
      raisePreview(manager, previous);
      return;
    }
    if (isObject(previous) && typeof previous.hide === 'function') {
      (previous.hide as (force?: boolean) => void).call(previous, true);
    }

    // Match the original manager's replacement behavior. Register before awaiting I/O so
    // modifier release, map changes, or a later hover can close this preview during loading.
    manager.hideAllUnpinnedPreviews();
    const tokenRollContext = capturedTokenRollContext(originContext, manager, pin.id);
    const preview = new ForgeStatblockPreviewWindow({
      app,
      plugin,
      manager,
      pin,
      sourcePath,
      screenX,
      screenY,
      sourceLeaf: sourceLeaf ?? null,
      ...(tokenRollContext ? { originContext: tokenRollContext } : {}),
    });
    manager.activePreviews.set(`${pin.notePath}::${pin.id}`, preview);
    raisePreview(manager, preview);
    preview.element?.addEventListener('mousedown', () => raisePreview(manager, preview));
    await preview.render();
  };

  manager.showOrCreatePreview = wrappedShowOrCreatePreview;

  let wrappedShowStatblocksWithMap: (() => void) | undefined;
  if (originalShowStatblocksWithMap) {
    wrappedShowStatblocksWithMap = function (): void {
      originalShowStatblocksWithMap.call(manager);
      const shown = !manager.suspended && isShownMapLeaf(leaf);
      for (const preview of manager.activePreviews.values()) {
        if (preview instanceof ForgeStatblockPreviewWindow) preview.setVisible(shown);
      }
    };
    manager.showStatblocksWithMap = wrappedShowStatblocksWithMap;
  }

  return () => {
    for (const preview of [...manager.activePreviews.values()]) {
      if (preview instanceof ForgeStatblockPreviewWindow) preview.destroy();
    }
    if (manager.showOrCreatePreview === wrappedShowOrCreatePreview) {
      manager.showOrCreatePreview = originalShowOrCreatePreview;
    }
    if (originalShowStatblocksWithMap && manager.showStatblocksWithMap === wrappedShowStatblocksWithMap) {
      manager.showStatblocksWithMap = originalShowStatblocksWithMap;
    }
  };
}

/** Installs and owns direct Atlas preview hooks for all currently open and future map views. */
export function startForgeAtlasPreviewBridge(app: App, plugin: StatblockForgePlugin): () => void {
  let disposed = false;
  const patches = new Map<AtlasPreviewManager, () => void>();
  const eventRefs: EventRef[] = [];

  const reconcile = (): void => {
    if (disposed) return;
    const runtime = inspectAtlasRuntime(app);
    if (!runtime.runtimeSupported) {
      for (const patch of patches.values()) patch();
      patches.clear();
      return;
    }

    const activeManagers = new Set<AtlasPreviewManager>();
    for (const context of getAtlasMapViewContexts(app)) {
      if (!context.diagnostics.notePreviewUIManagerAvailable) continue;
      const manager = context.notePreviewUIManager as AtlasPreviewManager | null;
      if (!manager) continue;
      activeManagers.add(manager);
      if (patches.has(manager)) continue;
      const cleanup = installForgePreviewHooksForManager(app, plugin, manager, context.leaf);
      if (cleanup) patches.set(manager, cleanup);
    }

    for (const [manager, patch] of patches) {
      if (activeManagers.has(manager)) continue;
      patch();
      patches.delete(manager);
    }
  };

  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    for (const patch of patches.values()) patch();
    patches.clear();
    for (const ref of eventRefs) app.workspace.offref(ref);
    eventRefs.length = 0;
  };

  eventRefs.push(app.workspace.on('layout-change', reconcile));
  eventRefs.push(app.workspace.on('active-leaf-change', reconcile));
  eventRefs.push(app.workspace.on('file-open', reconcile));
  app.workspace.onLayoutReady(reconcile);
  reconcile();
  plugin.register(cleanup);
  return cleanup;
}
