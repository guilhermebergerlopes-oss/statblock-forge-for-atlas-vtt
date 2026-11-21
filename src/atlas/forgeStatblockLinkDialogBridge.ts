import type { App } from 'obsidian';
import type StatblockForgePlugin from '../../main';
import { getAtlasMapViewContexts } from './atlasRuntime.ts';
import { readForgeStatblockPickerEntries, renderForgeStatblockPreview, type ForgeAtlasPreviewRenderSession } from './atlasForgePreviewRenderer.ts';
import { forgePickerEntryForAtlasOption, type ForgeStatblockPickerEntry } from './forgeStatblockPickerModel.ts';

const DIALOG_SELECTOR = '.atlas-statblock-link';
const LIST_OPTION_SELECTOR = '.atlas-statblock-link__option';
const PREVIEW_SELECTOR = '.atlas-statblock-link__preview';
const PREVIEW_PATH_SELECTOR = '.atlas-statblock-link__preview-path span';
const PREVIEW_PATH_HEADER_SELECTOR = '.atlas-statblock-link__preview-path';
const BADGE_CLASS = 'statblock-forge__atlas-picker-badge';
const HIDDEN_NATIVE_CLASS = 'statblock-forge__atlas-link-native-hidden';
const PREVIEW_HOST_CLASS = 'statblock-forge__atlas-link-preview';

interface TokenAssetLike {
  id?: string;
  name?: string;
  imagePath?: string;
}

interface PreviewTokenLike {
  tokenId: string;
  name: string;
  imagePath: string;
}

interface DialogSession {
  dispose(): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function callMember(target: unknown, member: string): unknown {
  if (!isRecord(target)) return undefined;
  const value = target[member];
  if (typeof value !== 'function') return undefined;
  try { return (value as (this: unknown) => unknown).call(target); } catch { return undefined; }
}

function isHTMLElement(value: Element, document: Document): value is HTMLElement {
  return value.nodeType === 1 && 'hidden' in value && typeof (value as HTMLElement).classList?.add === 'function'
    && value.ownerDocument === document;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function notePath(value: string): string {
  return value.split('#', 1)[0]?.trim() ?? '';
}

function tokenAssetForDialog(app: App, dialog: HTMLElement): PreviewTokenLike | undefined {
  const subtitle = text(dialog.querySelector<HTMLElement>('.atlas-statblock-link__subtitle')?.textContent);
  const wantedName = subtitle.replace(/^for\s+/i, '').trim().toLocaleLowerCase();
  if (!wantedName) return undefined;

  const matches = new Map<string, TokenAssetLike>();
  for (const context of getAtlasMapViewContexts(app)) {
    const assets = callMember(context.assetService, 'loadedTokenAssets');
    if (!Array.isArray(assets)) continue;
    for (const value of assets) {
      if (!isRecord(value)) continue;
      const asset = value as TokenAssetLike;
      if (text(asset.name).toLocaleLowerCase() !== wantedName || !text(asset.imagePath)) continue;
      matches.set(text(asset.imagePath), asset);
    }
  }
  // Do not use the wrong portrait where two different assets share a name.
  if (matches.size !== 1) return undefined;
  const [imagePath, asset] = [...matches.entries()][0]!;
  return {
    tokenId: `asset-preview:${text(asset.id) || imagePath}`,
    name: text(asset.name) || subtitle,
    imagePath,
  };
}

function applyPickerBadges(dialog: HTMLElement, entries: readonly ForgeStatblockPickerEntry[]): void {
  const options = dialog.querySelectorAll<HTMLElement>(LIST_OPTION_SELECTOR);
  const selectedPath = notePath(text(dialog.querySelector<HTMLElement>(PREVIEW_PATH_SELECTOR)?.textContent));
  const selectedEntry = selectedPath ? entries.find((entry) => entry.path === selectedPath) : undefined;
  const activeOption = dialog.querySelector<HTMLElement>(`${LIST_OPTION_SELECTOR}[aria-selected="true"]`);
  for (const option of options) {
    const name = text(option.querySelector<HTMLElement>('.atlas-statblock-link__option-name')?.textContent);
    const detail = text(option.querySelector<HTMLElement>('.atlas-statblock-link__option-detail')?.textContent);
    // The preview header exposes Atlas' exact selected note path. Use it as a
    // reliable fallback for the active row if a React build does not expose
    // its host Fiber key; other rows still require an exact key or safe text match.
    const match = (option === activeOption && selectedEntry)
      ? selectedEntry
      : forgePickerEntryForAtlasOption(option, entries, name, detail);
    let badge = option.querySelector<HTMLElement>(`:scope > .${BADGE_CLASS}`);
    if (!match) {
      badge?.remove();
      delete option.dataset.forgeStatblockPath;
      continue;
    }
    option.dataset.forgeStatblockPath = match.path;
    if (!badge) {
      badge = option.ownerDocument.createElement('span');
      badge.className = BADGE_CLASS;
      badge.textContent = 'FORGE';
      badge.setAttribute('aria-hidden', 'true');
      badge.title = 'Statblock Forge';
      const linked = option.querySelector<HTMLElement>(':scope > .atlas-statblock-link__linked');
      option.insertBefore(badge, linked ?? null);
    }
  }
}

function createDialogSession(app: App, plugin: StatblockForgePlugin, dialog: HTMLElement, entriesPromise: Promise<ForgeStatblockPickerEntry[]>): DialogSession {
  const ownerWindow = dialog.ownerDocument.defaultView;
  const MutationObserverConstructor = ownerWindow?.MutationObserver;
  if (!MutationObserverConstructor) return { dispose: () => {} };

  let disposed = false;
  let queued = false;
  let activePath: string | null = null;
  let activeHost: HTMLElement | null = null;
  let previewHost: HTMLElement | null = null;
  let previewController: AbortController | null = null;
  let previewSession: ForgeAtlasPreviewRenderSession | null = null;
  const hiddenNativeNodes = new Set<HTMLElement>();
  let entries: ForgeStatblockPickerEntry[] = [];

  const restoreNativePreview = (): void => {
    for (const node of hiddenNativeNodes) node.classList.remove(HIDDEN_NATIVE_CLASS);
    hiddenNativeNodes.clear();
  };

  const stopPreview = (removeHost: boolean): void => {
    previewController?.abort();
    previewController = null;
    previewSession?.dispose();
    previewSession = null;
    activePath = null;
    activeHost = null;
    restoreNativePreview();
    if (removeHost) {
      previewHost?.remove();
      previewHost = null;
    }
  };

  const ensurePreviewHost = (preview: HTMLElement, pathHeader: HTMLElement | null): HTMLElement => {
    if (previewHost?.isConnected && previewHost.parentElement === preview) return previewHost;
    stopPreview(true);
    const host = preview.ownerDocument.createElement('div');
    host.className = `atlas-sheet-render-container ${PREVIEW_HOST_CLASS}`;
    host.dataset.forgeStatblockPreviewPath = '';
    if (pathHeader?.parentElement === preview) pathHeader.insertAdjacentElement('afterend', host);
    else preview.append(host);
    previewHost = host;
    return host;
  };

  const hideNativePreview = (preview: HTMLElement, pathHeader: HTMLElement | null, host: HTMLElement): void => {
    for (const child of Array.from(preview.children)) {
      if (!isHTMLElement(child, preview.ownerDocument) || child === pathHeader || child === host) continue;
      if (!child.classList.contains(HIDDEN_NATIVE_CLASS)) {
        child.classList.add(HIDDEN_NATIVE_CLASS);
        hiddenNativeNodes.add(child);
      }
    }
  };

  const renderSelectedForgeNote = async (path: string, host: HTMLElement): Promise<void> => {
    const controller = new AbortController();
    previewController = controller;
    activePath = path;
    activeHost = host;
    host.dataset.forgeStatblockPreviewPath = path;
    host.replaceChildren();
    const token = tokenAssetForDialog(app, dialog);
    try {
      const session = await renderForgeStatblockPreview(app, plugin, {
        sourcePath: path,
        container: host,
        instanceId: `atlas-link-dialog:${path}`,
        sceneId: 'atlas-statblock-link-dialog',
        renderId: `forge-atlas-link-preview-${path}`,
        ...(token ? { token, preferTokenImage: true } : {}),
        signal: controller.signal,
        variant: 'preview',
      });
      if (disposed || controller.signal.aborted || previewHost !== host || activePath !== path) {
        session?.dispose();
        return;
      }
      previewSession = session;
      if (!session) {
        host.textContent = plugin.settings.language === 'pt-BR'
          ? 'Não foi possível carregar esta ficha do Forge.'
          : 'This Forge statblock could not be loaded.';
      }
    } catch (error) {
      if (!disposed && !controller.signal.aborted && previewHost === host) {
        console.error('[Statblock Forge] Link-dialog preview failed:', error);
        host.textContent = plugin.settings.language === 'pt-BR'
          ? 'Não foi possível pré-visualizar esta ficha do Forge.'
          : 'This Forge statblock preview could not be rendered.';
      }
    }
  };

  const update = async (): Promise<void> => {
    if (disposed || !dialog.isConnected) return;
    // Decorate the visible list before awaiting the preview renderer. Rendering
    // can involve vault image resolution and Markdown component setup; badge
    // visibility must not depend on that asynchronous work succeeding.
    applyPickerBadges(dialog, entries);
    const preview = dialog.querySelector<HTMLElement>(PREVIEW_SELECTOR);
    const pathHeader = preview?.querySelector<HTMLElement>(PREVIEW_PATH_HEADER_SELECTOR) ?? null;
    const rawPath = text(preview?.querySelector<HTMLElement>(PREVIEW_PATH_SELECTOR)?.textContent);
    const selectedPath = rawPath ? notePath(rawPath) : '';
    const selectedEntry = selectedPath ? entries.find((entry) => entry.path === selectedPath) : undefined;

    if (preview && selectedEntry) {
      const host = ensurePreviewHost(preview, pathHeader);
      hideNativePreview(preview, pathHeader, host);
      if (activePath !== selectedEntry.path || activeHost !== host) {
        stopPreview(false);
        hideNativePreview(preview, pathHeader, host);
        await renderSelectedForgeNote(selectedEntry.path, host);
      }
    } else {
      if (activePath || previewHost || hiddenNativeNodes.size) stopPreview(true);
    }
    applyPickerBadges(dialog, entries);
  };

  const requestUpdate = (): void => {
    if (disposed || queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      void update();
    });
  };

  const observer = new MutationObserverConstructor(requestUpdate);
  observer.observe(dialog, { childList: true, subtree: true, characterData: true });
  void entriesPromise.then((resolved) => {
    if (disposed) return;
    entries = resolved;
    requestUpdate();
  }).catch((error: unknown) => {
    console.error('[Statblock Forge] Could not read Forge statblocks for the Atlas link dialog:', error);
  });
  requestUpdate();

  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      stopPreview(true);
      for (const badge of dialog.querySelectorAll(`.${BADGE_CLASS}`)) badge.remove();
      for (const option of dialog.querySelectorAll<HTMLElement>(LIST_OPTION_SELECTOR)) delete option.dataset.forgeStatblockPath;
    },
  };
}

/**
 * Adds Forge identification and native-renderer previews to Atlas' existing
 * Link Statblock dialog. The Atlas list/link action remains authoritative;
 * Forge only decorates matching rows and swaps the selected preview surface.
 */
export function startForgeAtlasStatblockLinkDialogBridge(app: App, plugin: StatblockForgePlugin): () => void {
  const document = app.workspace.containerEl.ownerDocument;
  const root = document.body;
  const MutationObserverConstructor = document.defaultView?.MutationObserver;
  if (!root || !MutationObserverConstructor) return () => {};

  let disposed = false;
  const sessions = new Map<HTMLElement, DialogSession>();

  const scan = (): void => {
    if (disposed) return;
    for (const [dialog, session] of sessions) {
      if (dialog.isConnected) continue;
      session.dispose();
      sessions.delete(dialog);
    }
    for (const dialog of root.querySelectorAll<HTMLElement>(DIALOG_SELECTOR)) {
      if (sessions.has(dialog)) continue;
      // Read metadata for each opened dialog so newly-created or renamed Forge notes are reflected.
      sessions.set(dialog, createDialogSession(app, plugin, dialog, readForgeStatblockPickerEntries(app, plugin)));
    }
  };

  const observer = new MutationObserverConstructor(scan);
  observer.observe(root, { childList: true, subtree: true });
  scan();

  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    for (const session of sessions.values()) session.dispose();
    sessions.clear();
  };
  plugin.register(cleanup);
  return cleanup;
}
