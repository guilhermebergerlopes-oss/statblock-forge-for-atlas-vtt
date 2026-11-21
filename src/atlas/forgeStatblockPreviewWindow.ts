import { setIcon, type App, type WorkspaceLeaf } from 'obsidian';
import type StatblockForgePlugin from '../../main';
import { renderForgeStatblockPreview, type ForgeAtlasPreviewRenderSession } from './atlasForgePreviewRenderer.ts';
import type { AtlasDiceTokenRollContextLike } from './atlasDiceRuntime.ts';

export interface AtlasForgePreviewAnchorLike {
  readonly id: string;
  readonly notePath: string;
  readonly type?: string;
  readonly name?: string;
  readonly imagePath?: string;
}

interface ForgePreviewToken {
  readonly tokenId: string;
  readonly name: string;
  readonly imagePath: string;
}

export interface AtlasForgePreviewStoreLike {
  getState?(): unknown;
  subscribe?: (
    selector: (state: unknown) => ForgePreviewToken | null,
    listener: (value: ForgePreviewToken | null) => void,
    options?: { equalityFn?: (left: ForgePreviewToken | null, right: ForgePreviewToken | null) => boolean },
  ) => () => void;
}

export interface AtlasForgePreviewManagerLike {
  readonly viewId?: string;
  readonly store?: AtlasForgePreviewStoreLike;
  readonly suspended?: boolean;
  activePreviews?: Map<string, unknown>;
  mapViewElement?(): HTMLElement | null;
  raiseZIndex?(preview: unknown): void;
  handlePreviewClosed?(preview: unknown): void;
}

export interface ForgeStatblockPreviewWindowOptions {
  readonly app: App;
  readonly plugin: StatblockForgePlugin;
  readonly manager: AtlasForgePreviewManagerLike;
  readonly pin: AtlasForgePreviewAnchorLike;
  readonly sourcePath: string;
  readonly screenX: number;
  readonly screenY: number;
  readonly sourceLeaf?: WorkspaceLeaf | null;
  readonly originContext?: AtlasDiceTokenRollContextLike;
}

let nextRenderId = 0;
const PREVIEW_EDGE_GAP = 16;
const PREVIEW_OFFSET = 15;
const PREVIEW_CLOSE_MS = 150;
const PREVIEW_SCROLL_SELECTOR = '.statblock-forge__preview-body';
const TOKEN_CARD_HEADER = '.atlas-sb-header, .atlas-sb-heading-row';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function tokenFromState(store: AtlasForgePreviewStoreLike | undefined, pin: AtlasForgePreviewAnchorLike): ForgePreviewToken | null {
  try {
    const state = store?.getState?.();
    if (!isRecord(state) || !isRecord(state.objects) || !isRecord(state.objects.tokens)) return null;
    const token = state.objects.tokens[pin.id];
    if (!isRecord(token) || token.offMap === true) return null;
    return {
      tokenId: pin.id,
      name: typeof token.name === 'string' && token.name.trim() ? token.name : (pin.name ?? ''),
      imagePath: typeof token.imagePath === 'string' ? token.imagePath : (pin.imagePath ?? ''),
    };
  } catch {
    return null;
  }
}

function sameToken(left: ForgePreviewToken | null, right: ForgePreviewToken | null): boolean {
  return left === right || (!!left && !!right
    && left.tokenId === right.tokenId
    && left.name === right.name
    && left.imagePath === right.imagePath);
}

function wheelPixels(delta: number, mode: number, pageSize: number): number {
  if (mode === 1) return delta * 16;
  if (mode === 2) return delta * pageSize;
  return delta;
}

function scrollableOnAxis(element: HTMLElement, axis: 'x' | 'y', delta: number): boolean {
  if (delta === 0) return false;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (!style) return false;
  if (axis === 'y') {
    const overflow = style.overflowY;
    return (overflow === 'auto' || overflow === 'scroll')
      && (delta < 0 ? element.scrollTop > 0 : element.scrollTop < element.scrollHeight - element.clientHeight - 0.5);
  }
  const overflow = style.overflowX;
  return (overflow === 'auto' || overflow === 'scroll')
    && (delta < 0 ? element.scrollLeft > 0 : element.scrollLeft < element.scrollWidth - element.clientWidth - 0.5);
}

/**
 * Atlas-owned floating-window contract. The class name and interaction surface mirror
 * Atlas's native StatblockPreviewWindow lifecycle, based on inspected 0.17.0 and 0.18.0 baselines, so the manager can track, hide, pin and close it.
 */
export class ForgeStatblockPreviewWindow {
  readonly notePath: string;
  readonly originatingPin: { readonly id: string; readonly notePath: string };
  element: HTMLElement | null;

  private readonly app: App;
  private readonly plugin: StatblockForgePlugin;
  private readonly manager: AtlasForgePreviewManagerLike;
  private readonly pin: AtlasForgePreviewAnchorLike;
  private readonly sourcePath: string;
  private readonly originContext?: AtlasDiceTokenRollContextLike;
  private readonly renderHost: HTMLElement;
  private readonly controller = new AbortController();
  private readonly resizeObserver: ResizeObserver | null;
  private readonly ownerWindow: Window;
  private readonly pinButton: HTMLButtonElement;
  private readonly controls: HTMLElement;
  private initialPosition: { x: number; y: number } | null;
  private renderSession: ForgeAtlasPreviewRenderSession | null = null;
  private stopTokenUpdates: (() => void) | null = null;
  private stopDrag: (() => void) | null = null;
  private pinned = false;
  private closing = false;
  private disposed = false;

  constructor(options: ForgeStatblockPreviewWindowOptions) {
    this.app = options.app;
    this.plugin = options.plugin;
    this.manager = options.manager;
    this.pin = options.pin;
    this.notePath = options.pin.notePath;
    this.sourcePath = options.sourcePath;
    this.originContext = options.originContext;
    this.originatingPin = { id: options.pin.id, notePath: options.pin.notePath };
    this.initialPosition = { x: options.screenX, y: options.screenY };

    const doc = options.sourceLeaf?.view?.containerEl?.ownerDocument
      ?? options.manager.mapViewElement?.()?.ownerDocument
      ?? document;
    const ownerWindow = doc.defaultView;
    if (!ownerWindow) throw new Error('The Atlas preview document has no active window.');
    this.ownerWindow = ownerWindow;

    const element = doc.createElement('div');
    element.className = 'atlas-statblock-preview-window atlas-statblock-preview-window--movable';
    element.tabIndex = -1;
    element.style.position = 'fixed';
    element.style.display = 'flex';
    element.style.flexDirection = 'column';
    element.style.width = 'max-content';
    element.style.boxSizing = 'border-box';
    element.style.zIndex = '100';
    doc.body.append(element);
    this.element = element;

    const controls = doc.createElement('div');
    controls.className = 'atlas-vtt-plugin atlas-statblock-preview-window__controls';
    this.controls = controls;
    element.append(controls);

    const grip = doc.createElement('div');
    grip.className = 'atlas-statblock-preview-window__grip';
    setIcon(grip, 'grip-vertical');
    grip.setAttribute('aria-hidden', 'true');
    controls.append(grip);

    const pinButton = doc.createElement('button');
    pinButton.type = 'button';
    pinButton.className = 'atlas-statblock-preview-window__button';
    pinButton.setAttribute('aria-label', 'Pin preview');
    pinButton.setAttribute('title', 'Pin preview');
    setIcon(pinButton, 'pin');
    pinButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.setPinned(!this.pinned);
    });
    this.pinButton = pinButton;
    controls.append(pinButton);

    const closeButton = doc.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'atlas-statblock-preview-window__button';
    closeButton.setAttribute('aria-label', 'Close preview');
    closeButton.setAttribute('title', 'Close preview');
    setIcon(closeButton, 'x');
    closeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.hide(true);
    });
    controls.append(closeButton);

    const content = doc.createElement('div');
    content.className = 'atlas-statblock-preview-window__content';
    element.append(content);
    const renderHost = doc.createElement('div');
    renderHost.className = 'atlas-sheet-render-container';
    renderHost.style.display = 'flex';
    renderHost.style.flex = '1 1 auto';
    renderHost.style.minWidth = '0';
    renderHost.style.minHeight = '0';
    renderHost.style.maxWidth = '100%';
    renderHost.style.overflowX = 'auto';
    content.append(renderHost);
    this.renderHost = renderHost;

    controls.addEventListener('mousedown', (event) => {
      const target = event.target;
      if (target && (target as Node).nodeType === 1 && (target as Element).closest('button')) return;
      this.beginDrag(event);
    });
    element.addEventListener('mousedown', (event) => {
      const target = event.target;
      if (event.button !== 0 || !target || (target as Node).nodeType !== 1 || !(target as Element).closest(TOKEN_CARD_HEADER)) return;
      if (target.closest('button, a, input, textarea, select, [contenteditable="true"]')) return;
      this.beginDrag(event);
    });
    element.addEventListener('wheel', this.onWheel, { capture: true, passive: false });
    element.addEventListener('mousedown', () => this.raiseToFront());

    this.setPosition(options.screenX, options.screenY);

    const ResizeObserverConstructor = (ownerWindow as Window & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    this.resizeObserver = ResizeObserverConstructor
      ? new ResizeObserverConstructor(() => this.reposition())
      : null;
    this.resizeObserver?.observe(element);
  }

  async render(): Promise<void> {
    if (this.disposed || !this.element) return;
    try {
      const initialToken = tokenFromState(this.manager.store, this.pin) ?? {
        tokenId: this.pin.id,
        name: this.pin.name ?? '',
        imagePath: this.pin.imagePath ?? '',
      };
      const session = await renderForgeStatblockPreview(this.app, this.plugin, {
        sourcePath: this.sourcePath,
        container: this.renderHost,
        instanceId: this.pin.id,
        sceneId: this.manager.viewId ?? 'atlas-map',
        ...(this.manager.viewId ? { viewId: this.manager.viewId } : {}),
        ...(this.originContext ? { originContext: this.originContext } : {}),
        renderId: `forge-preview-${++nextRenderId}`,
        token: initialToken,
        signal: this.controller.signal,
      });
      if (this.disposed || this.controller.signal.aborted) {
        session?.dispose();
        return;
      }
      this.renderSession = session;
      if (!session) {
        this.renderHost.textContent = this.plugin.settings.language === 'pt-BR'
          ? 'Não foi possível carregar esta ficha do Forge. Verifique o vínculo com o Template.'
          : 'This Forge statblock could not be loaded. Check its Template link.';
      } else {
        this.subscribeToTokenUpdates();
      }
      this.reposition();
    } catch (error) {
      if (!this.disposed && !this.controller.signal.aborted) {
        console.error('[Statblock Forge] Direct Atlas preview failed:', error);
        this.renderHost.textContent = this.plugin.settings.language === 'pt-BR'
          ? 'Não foi possível renderizar esta ficha do Forge.'
          : 'This Forge statblock could not be rendered.';
      }
    }
  }

  private subscribeToTokenUpdates(): void {
    const store = this.manager.store;
    if (!store?.subscribe) return;
    const select = (state: unknown): ForgePreviewToken | null => {
      if (!isObjectWithTokens(state)) return null;
      const token = state.objects.tokens[this.pin.id];
      if (!token || typeof token !== 'object') return null;
      const values = token as Record<string, unknown>;
      if (values.offMap === true) return null;
      return {
        tokenId: this.pin.id,
        name: typeof values.name === 'string' && values.name.trim() ? values.name : (this.pin.name ?? ''),
        imagePath: typeof values.imagePath === 'string' ? values.imagePath : (this.pin.imagePath ?? ''),
      };
    };
    this.stopTokenUpdates = store.subscribe(select, (token) => {
      if (!token) {
        this.hide(true);
        return;
      }
      void this.renderSession?.updateToken(token);
    }, { equalityFn: sameToken });
  }

  private readonly onWheel = (event: WheelEvent): void => {
    if (!event.ctrlKey || !this.element) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.target;
    if (!target || (target as Node).nodeType !== 1) return;
    for (let box: Element | null = target as Element; box; box = box.parentElement) {
      if ((box as Node).nodeType !== 1) continue;
      const deltaX = wheelPixels(event.deltaX, event.deltaMode, box.clientWidth);
      const deltaY = wheelPixels(event.deltaY, event.deltaMode, box.clientHeight);
      const moveX = scrollableOnAxis(box, 'x', deltaX);
      const moveY = scrollableOnAxis(box, 'y', deltaY);
      if (moveX) box.scrollLeft += deltaX;
      if (moveY) box.scrollTop += deltaY;
      if (moveX || moveY || box === this.element) return;
    }
    const body = this.element.querySelector<HTMLElement>(PREVIEW_SCROLL_SELECTOR);
    if (body) body.scrollTop += wheelPixels(event.deltaY, event.deltaMode, body.clientHeight);
  };

  private beginDrag(event: MouseEvent): void {
    if (!this.element || event.button !== 0) return;
    event.preventDefault();
    this.initialPosition = null;
    this.element.classList.add('is-dragging');
    const startX = event.clientX;
    const startY = event.clientY;
    const rect = this.element.getBoundingClientRect();
    const left = rect.left;
    const top = rect.top;
    const doc = this.element.ownerDocument;
    const onMove = (move: MouseEvent): void => {
      if (!this.element) return;
      const maxLeft = Math.max(PREVIEW_EDGE_GAP, this.ownerWindow.innerWidth - this.element.offsetWidth - PREVIEW_EDGE_GAP);
      const maxTop = Math.max(PREVIEW_EDGE_GAP, this.ownerWindow.innerHeight - this.element.offsetHeight - PREVIEW_EDGE_GAP);
      this.element.style.left = `${Math.min(maxLeft, Math.max(PREVIEW_EDGE_GAP, left + move.clientX - startX))}px`;
      this.element.style.top = `${Math.min(maxTop, Math.max(PREVIEW_EDGE_GAP, top + move.clientY - startY))}px`;
    };
    const onUp = (): void => {
      doc.removeEventListener('mousemove', onMove);
      doc.removeEventListener('mouseup', onUp);
      this.element?.classList.remove('is-dragging');
      this.stopDrag = null;
    };
    doc.addEventListener('mousemove', onMove);
    doc.addEventListener('mouseup', onUp, { once: true });
    this.stopDrag = onUp;
  }

  private setPinned(pinned: boolean): void {
    this.pinned = pinned;
    if (pinned) this.initialPosition = null;
    if (!this.element) return;
    this.element.classList.toggle('is-pinned', pinned);
    this.pinButton.classList.toggle('is-pinned', pinned);
    this.pinButton.setAttribute('aria-label', pinned ? 'Unpin preview' : 'Pin preview');
    this.pinButton.setAttribute('title', pinned ? 'Unpin preview' : 'Pin preview');
  }

  private raiseToFront(): void {
    this.manager.raiseZIndex?.(this);
  }

  setPosition(x: number, y: number): void {
    this.initialPosition = { x, y };
    this.reposition();
  }

  private reposition(): void {
    const element = this.element;
    if (!element || this.disposed || !this.initialPosition) return;
    const maxWidth = Math.max(1, this.ownerWindow.innerWidth - PREVIEW_EDGE_GAP * 2);
    const maxHeight = Math.max(1, this.ownerWindow.innerHeight - PREVIEW_EDGE_GAP * 2 - this.controls.offsetHeight);
    element.style.maxHeight = `${maxHeight}px`;

    // Keep the card at its Template width when it fits. The previous flex
    // layout let the render host shrink to Atlas' generic hover width even
    // though the child card had a wider min-width. Size both levels together:
    // the outer window includes its measured padding, while the host becomes
    // the scroll viewport if the configured card is wider than the viewport.
    const sheetWidth = Number(this.renderHost.dataset.forgeSheetWidth);
    if (Number.isFinite(sheetWidth) && sheetWidth > 0) {
      const surfaceStyle = this.ownerWindow.getComputedStyle(element);
      const horizontalPadding = (Number.parseFloat(surfaceStyle.paddingLeft) || 0)
        + (Number.parseFloat(surfaceStyle.paddingRight) || 0);
      const outerWidth = Math.min(sheetWidth + horizontalPadding, maxWidth);
      const availableContentWidth = Math.max(1, outerWidth - horizontalPadding);
      element.style.width = `${outerWidth}px`;
      element.style.maxWidth = `${outerWidth}px`;
      this.renderHost.style.boxSizing = 'border-box';
      this.renderHost.style.flex = `0 0 ${availableContentWidth}px`;
      this.renderHost.style.width = `${availableContentWidth}px`;
      this.renderHost.style.minWidth = '0';
      this.renderHost.style.maxWidth = `${availableContentWidth}px`;
    } else {
      element.style.maxWidth = `${maxWidth}px`;
      element.style.width = `min(max-content, ${maxWidth}px)`;
    }

    // Measure after applying the configured width so position clamping uses
    // the actual card width, not the generic width measured before expansion.
    const width = Math.max(element.getBoundingClientRect().width, element.offsetWidth, 1);
    const height = Math.max(element.getBoundingClientRect().height, element.offsetHeight, 1);
    const availableWidth = Math.min(width, maxWidth);
    const availableHeight = Math.min(height, maxHeight);
    const currentRect = element.getBoundingClientRect();
    let left = currentRect.left;
    let top = currentRect.top;
    if (this.initialPosition) {
      left = this.initialPosition.x + PREVIEW_OFFSET;
      top = this.initialPosition.y + PREVIEW_OFFSET;
      if (left + availableWidth > this.ownerWindow.innerWidth - PREVIEW_EDGE_GAP) {
        left = this.initialPosition.x - availableWidth - PREVIEW_OFFSET;
      }
      if (top + availableHeight > this.ownerWindow.innerHeight - PREVIEW_EDGE_GAP) {
        top = this.initialPosition.y - availableHeight - PREVIEW_OFFSET;
      }
    }
    // Pinned or manually moved windows retain their current position, but are
    // clamped again when their content or the application viewport changes.
    left = Math.max(PREVIEW_EDGE_GAP, Math.min(left, this.ownerWindow.innerWidth - availableWidth - PREVIEW_EDGE_GAP));
    top = Math.max(PREVIEW_EDGE_GAP + this.controls.offsetHeight, Math.min(top, this.ownerWindow.innerHeight - availableHeight - PREVIEW_EDGE_GAP));
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
  }

  setVisible(visible: boolean): void {
    if (this.element) this.element.style.display = visible ? 'flex' : 'none';
  }

  getIsPinned(): boolean {
    return this.pinned;
  }

  hide(force = false): void {
    if (this.closing || (this.pinned && !force)) return;
    this.closing = true;
    const element = this.element;
    if (!element) {
      this.destroy();
      return;
    }
    element.classList.add('atlas-statblock-preview-window--closing');
    this.ownerWindow.setTimeout(() => this.destroy(), PREVIEW_CLOSE_MS);
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.controller.abort();
    this.resizeObserver?.disconnect();
    this.stopTokenUpdates?.();
    this.stopTokenUpdates = null;
    this.stopDrag?.();
    this.stopDrag = null;
    this.renderSession?.dispose();
    this.renderSession = null;
    this.element?.removeEventListener('wheel', this.onWheel, { capture: true });
    this.element?.remove();
    this.element = null;
    this.manager.handlePreviewClosed?.(this);
  }
}

function isObjectWithTokens(value: unknown): value is { objects: { tokens: Record<string, unknown> } } {
  if (!value || typeof value !== 'object') return false;
  const objects = (value as { objects?: unknown }).objects;
  return !!objects && typeof objects === 'object'
    && !!(objects as { tokens?: unknown }).tokens
    && typeof (objects as { tokens: unknown }).tokens === 'object';
}
