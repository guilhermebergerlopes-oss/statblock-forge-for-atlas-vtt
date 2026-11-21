import { TFile, type App, type WorkspaceLeaf } from 'obsidian';
import type StatblockForgePlugin from '../../main';
import { getAtlasMapViewContexts, inspectAtlasRuntime, type AtlasMapRuntimeContext } from './atlasRuntime.ts';
import {
  isForgeNativeV2Statblock,
  renderForgeStatblockPreview,
  type ForgeAtlasPreviewRenderSession,
} from './atlasForgePreviewRenderer.ts';
import type { AtlasDiceTokenRollContextLike } from './atlasDiceRuntime.ts';
import {
  filterForgeDMScreenGroups,
  groupForgeDMScreenTokens,
  readForgeDMScreenScope,
  matchForgeDMScreenFeedCandidate,
  readForgeDMScreenStoreState,
  type ForgeDMScreenFeedCandidate,
  type ForgeDMScreenStatblockGroup,
  type ForgeDMScreenToken,
} from './forgeDMScreenModel.ts';

interface UnknownRecord { [key: string]: unknown }
interface AtlasDMScreenStoreLike {
  getState(): unknown;
  subscribe?(listener: () => void): (() => void) | void;
}
interface AtlasDMScreenTokenAssetLike {
  id?: string;
  imagePath?: string;
  name?: string;
  statblockPath?: string;
  playerCharacter?: boolean;
}
interface ForgeDMScreenCard {
  readonly wrapper: HTMLDivElement;
  readonly renderHost: HTMLDivElement;
  readonly tokenLabel: HTMLDivElement;
  signature: string;
  controller: AbortController | null;
  session: ForgeAtlasPreviewRenderSession | null;
  disposed: boolean;
  mountTarget: HTMLElement | null;
  hiddenNativeSheet: HTMLElement | null;
  hiddenNativeSheetWasHidden: boolean;
}

let nextFeedRenderId = 0;

function isRecord(value: unknown): value is UnknownRecord {
  // Atlas exposes its Zustand store as a callable function with getState/subscribe
  // methods attached. Treat functions as records too, or the DM Screen bridge
  // cannot read the map state and silently concludes that no Forge links exist.
  return (typeof value === 'object' || typeof value === 'function')
    && value !== null
    && !Array.isArray(value);
}

function readMember(value: unknown, key: string): unknown {
  if (!isRecord(value)) return undefined;
  try { return value[key]; } catch { return undefined; }
}

function callMember(value: unknown, method: string): unknown {
  const candidate = readMember(value, method);
  if (typeof candidate !== 'function') return undefined;
  try { return (candidate as (this: unknown) => unknown).call(value); } catch { return undefined; }
}

function storeState(context: AtlasMapRuntimeContext): UnknownRecord | null {
  return readForgeDMScreenStoreState(context.store);
}

interface TokenAssetIndexState {
  assets: AtlasDMScreenTokenAssetLike[] | null;
  loading: Promise<void> | null;
}

const tokenAssetIndexes = new WeakMap<object, TokenAssetIndexState>();

/**
 * Atlas' `loadedTokenAssets()` is intentionally read-only and returns an empty
 * list before AssetService has loaded its index. `getTokenAssets()` performs
 * that lazy load; call it once so Asset-level statblockPath links can be found
 * even when no other Atlas UI has opened the token library yet.
 */
function tokenAssets(context: AtlasMapRuntimeContext, onLoaded: () => void): AtlasDMScreenTokenAssetLike[] | null {
  const service = context.assetService;
  if (!isRecord(service)) return null;
  const cached = tokenAssetIndexes.get(service);
  const loaded = callMember(service, 'loadedTokenAssets');
  if (Array.isArray(loaded) && loaded.length > 0) {
    const assets = loaded.filter((asset): asset is AtlasDMScreenTokenAssetLike => isRecord(asset));
    tokenAssetIndexes.set(service, { assets, loading: null });
    return assets;
  }
  if (cached?.assets) return cached.assets;

  let state = cached;
  if (!state) {
    state = { assets: null, loading: null };
    tokenAssetIndexes.set(service, state);
  }
  if (!state.loading) {
    const getTokenAssets = readMember(service, 'getTokenAssets');
    if (typeof getTokenAssets === 'function') {
      state.loading = Promise.resolve()
        .then(() => (getTokenAssets as (this: unknown) => unknown).call(service))
        .then((result) => {
          state!.assets = Array.isArray(result)
            ? result.filter((asset): asset is AtlasDMScreenTokenAssetLike => isRecord(asset))
            : [];
        })
        .catch((error: unknown) => {
          console.error('[Statblock Forge] Could not load Atlas token assets for the DM Screen:', error);
          state!.assets = [];
        })
        .finally(() => {
          state!.loading = null;
          onLoaded();
        });
    }
  }
  return Array.isArray(loaded)
    ? loaded.filter((asset): asset is AtlasDMScreenTokenAssetLike => isRecord(asset))
    : null;
}

function playerTokenPredicate(
  rawTokens: unknown,
  assets: readonly AtlasDMScreenTokenAssetLike[] | null,
): (token: ForgeDMScreenToken) => boolean {
  const tokenRecord = isRecord(rawTokens) ? rawTokens : {};
  return (token) => {
    const raw = readMember(tokenRecord, token.id);
    if (readMember(raw, 'playerCharacter') === true || readMember(raw, 'isPlayerCharacter') === true) return true;
    if (!assets) return true; // Fail open if Atlas has not exposed its player-token index yet.
    const asset = assets.find((candidate) =>
      (token.assetId && candidate.id === token.assetId)
      || (token.imagePath && candidate.imagePath === token.imagePath));
    // Campaign-given player tokens may not be present in the local asset index; keep unknowns visible.
    return asset ? asset.playerCharacter === true : true;
  };
}

function makeRollContext(
  viewId: string | undefined,
  mapPath: string | null,
  tokens: readonly ForgeDMScreenToken[],
): AtlasDiceTokenRollContextLike | undefined {
  if (!viewId || !mapPath || tokens.length === 0) return undefined;
  return Object.freeze({
    viewId,
    mapPath,
    tokenIds: Object.freeze([...new Set(tokens.map((token) => token.id))]),
  });
}

function groupSignature(
  group: ForgeDMScreenStatblockGroup,
  viewId: string | undefined,
  mapPath: string | null,
  sourceRevision: number,
): string {
  return JSON.stringify({
    path: group.path,
    viewId: viewId ?? null,
    mapPath,
    sourceRevision,
    tokens: group.tokens.map((token) => [token.id, token.name, token.imagePath, token.assetId]),
  });
}

function createCard(doc: Document): ForgeDMScreenCard {
  const wrapper = doc.createElement('article');
  wrapper.className = 'statblock-forge__dm-screen-card';
  const renderHost = doc.createElement('div');
  renderHost.className = 'atlas-sheet-render-container statblock-forge__dm-screen-render statblock-forge__atlas-feed-mount';
  const tokenLabel = doc.createElement('div');
  tokenLabel.className = 'statblock-forge__dm-screen-token-list';
  tokenLabel.setAttribute('aria-label', 'Linked Atlas tokens');
  wrapper.append(renderHost, tokenLabel);
  return {
    wrapper,
    renderHost,
    tokenLabel,
    signature: '',
    controller: null,
    session: null,
    disposed: false,
    mountTarget: null,
    hiddenNativeSheet: null,
    hiddenNativeSheetWasHidden: false,
  };
}

function restoreNativeSheet(card: ForgeDMScreenCard): void {
  const nativeSheet = card.hiddenNativeSheet;
  if (nativeSheet) {
    nativeSheet.hidden = card.hiddenNativeSheetWasHidden;
    delete nativeSheet.dataset.forgeReplacedByForge;
  }
  card.hiddenNativeSheet = null;
  card.hiddenNativeSheetWasHidden = false;
}

function attachCard(card: ForgeDMScreenCard, target: HTMLElement, nativeSheet: HTMLElement | null): void {
  if (card.hiddenNativeSheet !== nativeSheet) {
    restoreNativeSheet(card);
    if (nativeSheet) {
      card.hiddenNativeSheetWasHidden = nativeSheet.hidden;
      nativeSheet.hidden = true;
      nativeSheet.dataset.forgeReplacedByForge = 'true';
      card.hiddenNativeSheet = nativeSheet;
    }
  } else if (nativeSheet && !nativeSheet.hidden) {
    // Atlas may replace the React subtree while retaining the feed wrapper.
    nativeSheet.hidden = true;
    nativeSheet.dataset.forgeReplacedByForge = 'true';
  }
  card.mountTarget = target;
  if (card.wrapper.parentElement !== target) target.append(card.wrapper);
}

function detachCard(card: ForgeDMScreenCard): void {
  card.wrapper.remove();
  card.mountTarget = null;
  restoreNativeSheet(card);
}

function disposeCard(card: ForgeDMScreenCard): void {
  card.disposed = true;
  card.controller?.abort();
  card.controller = null;
  card.session?.dispose();
  card.session = null;
  detachCard(card);
}

function updateTokenLabel(card: ForgeDMScreenCard, group: ForgeDMScreenStatblockGroup, language: string): void {
  card.tokenLabel.replaceChildren();
  card.tokenLabel.hidden = group.tokens.length < 2;
  if (group.tokens.length < 2) return;
  const label = card.tokenLabel.ownerDocument.createElement('span');
  label.className = 'statblock-forge__dm-screen-token-caption';
  label.textContent = language === 'pt-BR' ? 'Tokens vinculados' : 'Linked tokens';
  card.tokenLabel.append(label);
  for (const token of group.tokens) {
    const chip = card.tokenLabel.ownerDocument.createElement('span');
    chip.className = 'statblock-forge__dm-screen-token-chip';
    chip.textContent = token.name;
    chip.title = token.name;
    card.tokenLabel.append(chip);
  }
}

async function renderCard(
  app: App,
  plugin: StatblockForgePlugin,
  card: ForgeDMScreenCard,
  group: ForgeDMScreenStatblockGroup,
  viewId: string | undefined,
  mapPath: string | null,
  sceneId: string,
  sourceRevision: number,
): Promise<void> {
  card.controller?.abort();
  card.session?.dispose();
  card.session = null;
  const controller = new AbortController();
  card.controller = controller;
  const signature = groupSignature(group, viewId, mapPath, sourceRevision);
  card.signature = signature;
  card.renderHost.replaceChildren();
  const firstToken = group.tokens[0];
  if (!firstToken) return;

  try {
    const originContext = makeRollContext(viewId, mapPath, group.tokens);
    const session = await renderForgeStatblockPreview(app, plugin, {
      sourcePath: group.path,
      container: card.renderHost,
      instanceId: `dm-screen-${group.path}`,
      sceneId,
      ...(viewId ? { viewId } : {}),
      ...(originContext ? { originContext } : {}),
      renderId: `forge-dm-screen-${++nextFeedRenderId}`,
      token: { tokenId: firstToken.id, name: firstToken.name, imagePath: firstToken.imagePath },
      signal: controller.signal,
      variant: 'feed',
    });
    if (card.disposed || controller.signal.aborted || card.signature !== signature) {
      session?.dispose();
      return;
    }
    card.session = session;
    if (!session) {
      card.renderHost.textContent = plugin.settings.language === 'pt-BR'
        ? 'Não foi possível carregar esta ficha do Forge.'
        : 'This Forge statblock could not be loaded.';
    }
  } catch (error) {
    if (!card.disposed && !controller.signal.aborted) {
      console.error('[Statblock Forge] DM Screen feed render failed:', error);
      card.renderHost.textContent = plugin.settings.language === 'pt-BR'
        ? 'Não foi possível renderizar esta ficha do Forge.'
        : 'This Forge statblock could not be rendered.';
    }
  }
}

function screenSectionFor(view: unknown): { grid: HTMLElement } | null {
  const container = readMember(view, 'containerEl');
  if (!isHTMLElement(container)) return null;
  const section = container.querySelector<HTMLElement>('.atlas-dm-statblocks-section');
  const grid = section?.querySelector<HTMLElement>('.atlas-dm-statblocks-grid');
  return section && grid ? { grid } : null;
}


function forgeFeedNames(app: App, path: string, group: ForgeDMScreenStatblockGroup): string[] {
  const file = app.vault.getAbstractFileByPath(path);
  const names = new Set<string>();
  if (file instanceof TFile) {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
    const frontmatterName = frontmatter?.name;
    if (typeof frontmatterName === 'string' && frontmatterName.trim()) names.add(frontmatterName.trim());
    names.add(file.basename);
  }
  for (const token of group.tokens) {
    if (token.name.trim()) names.add(token.name.trim());
  }
  return [...names];
}

function readReactFiberPath(item: HTMLElement, app: App): string | null {
  // StatblockFeeds keys each native feed item with the StatblockFeedMenu key,
  // whose path prop is the exact vault note path. Reading that path avoids
  // relying on localized heading text or image URLs when replacing the Atlas
  // card with the Forge renderer. React's fiber fields are private, so this is
  // deliberately guarded and the visible heading/image matcher remains fallback.
  const fiberProperty = Object.getOwnPropertyNames(item).find((key) =>
    key.startsWith('__reactFiber$') || key.startsWith('_reactInternals'));
  if (!fiberProperty) return null;

  let fiber: unknown = readMember(item, fiberProperty);
  const queue: unknown[] = [fiber];
  const visited = new Set<unknown>();
  let inspected = 0;
  while (queue.length > 0 && inspected < 80) {
    const current = queue.shift();
    if (!isRecord(current) || visited.has(current)) continue;
    visited.add(current);
    inspected += 1;

    for (const propsKey of ['memoizedProps', 'pendingProps']) {
      const props = readMember(current, propsKey);
      const path = readMember(props, 'path');
      if (typeof path === 'string' && path.trim()) {
        const file = app.vault.getAbstractFileByPath(path.trim());
        if (file instanceof TFile) return file.path;
      }
    }

    const child = readMember(current, 'child');
    const sibling = readMember(current, 'sibling');
    if (child) queue.push(child);
    if (sibling) queue.push(sibling);
  }
  return null;
}

function findNativeFeedMount(
  app: App,
  feeds: HTMLElement | null,
  group: ForgeDMScreenStatblockGroup,
  reservedItems: ReadonlySet<HTMLElement>,
): { readonly item: HTMLElement; readonly target: HTMLElement; readonly nativeSheet: HTMLElement | null } | null {
  if (!feeds) return null;
  const items = Array.from(feeds.children).filter((child): child is HTMLElement =>
    isHTMLElement(child) && child.classList.contains('atlas-dm-statblock-feed-item') && !reservedItems.has(child));
  if (items.length === 0) return null;

  const candidateData: ForgeDMScreenFeedCandidate[] = items.map((item) => ({
    heading: item.querySelector<HTMLElement>('.atlas-sb-header .atlas-sb-heading')?.textContent?.trim() ?? '',
    imagePaths: Array.from(item.querySelectorAll<HTMLImageElement>('.atlas-sb-header img'))
      .flatMap((image) => [image.currentSrc, image.src].filter((value): value is string => Boolean(value))),
  }));
  const imagePaths = group.tokens.map((token) => token.imagePath).filter(Boolean);
  const exactPathMatch = items.findIndex((item) => readReactFiberPath(item, app) === group.path);
  const match = exactPathMatch >= 0
    ? exactPathMatch
    : matchForgeDMScreenFeedCandidate(forgeFeedNames(app, group.path, group), imagePaths, candidateData);
  if (match === null) return null;

  const item = items[match];
  if (!item) return null;
  const target = item.querySelector<HTMLElement>(':scope > .atlas-dm-statblock-menu') ?? item;
  const nativeSheet = target.querySelector<HTMLElement>('.atlas-linked-statblock, .atlas-fantasy-statblock')
    ?? item.querySelector<HTMLElement>('.atlas-linked-statblock, .atlas-fantasy-statblock');
  return { item, target, nativeSheet: nativeSheet ?? null };
}

function isHTMLElement(value: unknown): value is HTMLElement {
  return typeof value === 'object' && value !== null
    && (value as { nodeType?: unknown }).nodeType === 1
    && typeof (value as { querySelector?: unknown }).querySelector === 'function';
}

function ensureFeedRegion(grid: HTMLElement, language: string): {
  root: HTMLElement;
  scopeHost: HTMLDivElement;
  cards: HTMLDivElement;
  empty: HTMLParagraphElement;
} {
  let root = grid.querySelector<HTMLElement>(':scope > .statblock-forge__dm-screen-feed');
  if (!root) {
    const doc = grid.ownerDocument;
    root = doc.createElement('section');
    root.className = 'statblock-forge__dm-screen-feed';
    root.dataset.forgeDmScreenFeed = 'true';
    root.hidden = true;
    const heading = doc.createElement('h3');
    heading.className = 'statblock-forge__dm-screen-heading';
    const scopeHost = doc.createElement('div');
    scopeHost.className = 'statblock-forge__dm-screen-scope-host';
    scopeHost.hidden = true;
    const cards = doc.createElement('div');
    cards.className = 'statblock-forge__dm-screen-cards';
    const empty = doc.createElement('p');
    empty.className = 'statblock-forge__dm-screen-empty';
    empty.hidden = true;
    root.append(heading, scopeHost, cards, empty);
    grid.append(root);
  }
  const scopeHost = root.querySelector<HTMLDivElement>('.statblock-forge__dm-screen-scope-host');
  const cards = root.querySelector<HTMLDivElement>('.statblock-forge__dm-screen-cards');
  if (!scopeHost || !cards) throw new Error('The Forge DM Screen feed has incomplete controls.');
  let empty = root.querySelector<HTMLParagraphElement>('.statblock-forge__dm-screen-empty');
  if (!empty) {
    empty = root.ownerDocument.createElement('p');
    empty.className = 'statblock-forge__dm-screen-empty';
    empty.hidden = true;
    root.append(empty);
  }
  const heading = root.querySelector<HTMLElement>('.statblock-forge__dm-screen-heading');
  if (heading) {
    heading.replaceChildren();
    const label = root.ownerDocument.createElement('span');
    label.className = 'statblock-forge__dm-screen-heading-label';
    label.textContent = language === 'pt-BR' ? 'Outras fichas Forge' : 'Other Forge statblocks';
    const badge = root.ownerDocument.createElement('span');
    badge.className = 'statblock-forge__dm-screen-brand';
    badge.textContent = 'FORGE';
    heading.append(label, badge);
  }
  return { root, scopeHost, cards, empty };
}

function hideEmptyFeedRegion(
  feed: ReturnType<typeof ensureFeedRegion>,
  cardsByPath: Map<string, ForgeDMScreenCard>,
): void {
  for (const card of cardsByPath.values()) disposeCard(card);
  cardsByPath.clear();
  feed.cards.replaceChildren();
  feed.scopeHost.hidden = true;
  feed.empty.textContent = '';
  feed.empty.hidden = true;
  feed.root.hidden = true;
}

function updateFallbackScopeControl(
  host: HTMLDivElement,
  options: readonly ForgeDMScreenScope[],
  selected: ForgeDMScreenScope,
  language: string,
  onChange: (scope: ForgeDMScreenScope) => void,
): void {
  host.hidden = options.length < 2;
  const labels: Record<ForgeDMScreenScope, string> = language === 'pt-BR'
    ? { fight: 'Esta luta', players: 'Personagens jogadores', all: 'Todos' }
    : { fight: 'This fight', players: 'Player characters', all: 'All' };
  const signature = options.join('|');
  let control = host.querySelector<HTMLDivElement>('.atlas-segmented.atlas-dm-statblock-scope');
  if (!control || host.dataset.scopeOptions !== signature) {
    control?.remove();
    control = host.ownerDocument.createElement('div');
    control.className = 'atlas-segmented atlas-dm-statblock-scope';
    control.setAttribute('role', 'radiogroup');
    control.setAttribute('aria-label', language === 'pt-BR' ? 'Escopo das fichas do Forge' : 'Forge statblock scope');
    for (const option of options) {
      const button = host.ownerDocument.createElement('button');
      button.type = 'button';
      button.className = 'atlas-segmented__option';
      button.setAttribute('role', 'radio');
      button.textContent = labels[option];
      button.addEventListener('click', () => onChange(option));
      control.append(button);
    }
    control.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      const buttons = [...control!.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
      const current = buttons.indexOf(event.target as HTMLButtonElement);
      if (current < 0 || buttons.length < 2) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0
        : event.key === 'End' ? buttons.length - 1
          : (current + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
      buttons[next]?.click();
    });
    host.append(control);
    host.dataset.scopeOptions = signature;
  }
  control.setAttribute('aria-label', language === 'pt-BR' ? 'Escopo das fichas do Forge' : 'Forge statblock scope');
  const buttons = [...control.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
  options.forEach((option, index) => {
    const button = buttons[index];
    if (!button) return;
    const active = option === selected;
    button.textContent = labels[option];
    button.classList.toggle('atlas-active', active);
    button.setAttribute('aria-checked', String(active));
    button.tabIndex = active ? 0 : -1;
  });
}

function readMapPath(state: UnknownRecord): string | null {
  const path = readMember(state, 'mapPath');
  return typeof path === 'string' && path.trim() ? path : null;
}

function syncScreen(
  app: App,
  plugin: StatblockForgePlugin,
  context: AtlasMapRuntimeContext,
  cardsByPath: Map<string, ForgeDMScreenCard>,
  sourceRevision: number,
  fallbackScope: ForgeDMScreenScope,
  setFallbackScope: (scope: ForgeDMScreenScope) => void,
  onTokenAssetsLoaded: () => void,
): void {
  const section = screenSectionFor(context.view);
  if (!section) {
    for (const card of cardsByPath.values()) disposeCard(card);
    cardsByPath.clear();
    return;
  }

  const language = plugin.settings.language;
  const feed = ensureFeedRegion(section.grid, language);
  const state = storeState(context);
  const objects = state ? readMember(state, 'objects') : null;
  const rawTokens = readMember(objects, 'tokens');
  const assets = tokenAssets(context, onTokenAssetsLoaded);
  const allGroups = groupForgeDMScreenTokens(
    rawTokens,
    (path) => isForgeNativeV2Statblock(app, path),
    assets ?? [],
  );
  if (!state || allGroups.length === 0) {
    hideEmptyFeedRegion(feed, cardsByPath);
    return;
  }

  const nativeScope = section.grid.querySelector(':scope > .atlas-dm-statblock-scope');
  const initiative = readMember(state, 'initiative');
  const initiativeEntries = isRecord(initiative) ? readMember(initiative, 'entries') : undefined;
  const isPlayerToken = playerTokenPredicate(rawTokens, assets);
  const fightGroups = filterForgeDMScreenGroups(allGroups, 'fight', initiativeEntries, isPlayerToken);
  const playerGroups = filterForgeDMScreenGroups(allGroups, 'players', initiativeEntries, isPlayerToken);
  const fallbackOptions: ForgeDMScreenScope[] = [
    ...(fightGroups.length > 0 && fightGroups.length < allGroups.length ? ['fight' as const] : []),
    ...(playerGroups.length > 0 && playerGroups.length < allGroups.length ? ['players' as const] : []),
    'all',
  ];
  const fallbackSelected = fallbackOptions.includes(fallbackScope)
    ? fallbackScope
    : fallbackOptions.includes('fight') ? 'fight' : 'all';
  if (!nativeScope && fallbackSelected !== fallbackScope) setFallbackScope(fallbackSelected);
  const scope = nativeScope ? readForgeDMScreenScope(nativeScope) : fallbackSelected;
  const groups = filterForgeDMScreenGroups(allGroups, scope, initiativeEntries, isPlayerToken);
  if (groups.length === 0) {
    hideEmptyFeedRegion(feed, cardsByPath);
    return;
  }

  const { scopeHost, cards, empty, root } = feed;
  empty.textContent = '';
  empty.hidden = true;
  if (nativeScope) scopeHost.hidden = true;
  else updateFallbackScopeControl(scopeHost, fallbackOptions, fallbackSelected, language, setFallbackScope);

  const view = isRecord(context.view) ? context.view : {};
  const viewId = typeof view.viewId === 'string' && view.viewId.trim() ? view.viewId : undefined;
  const mapPath = readMapPath(state);
  const sceneId = mapPath ?? viewId ?? 'atlas-map';
  const nativeFeeds = section.grid.querySelector<HTMLElement>('.atlas-dm-statblock-feeds');
  const nextPaths = new Set(groups.map((group) => group.path));
  let extraCount = 0;
  const reservedNativeItems = new Set<HTMLElement>();

  for (const [path, card] of cardsByPath) {
    if (nextPaths.has(path)) continue;
    disposeCard(card);
    cardsByPath.delete(path);
  }

  for (const group of groups) {
    let card = cardsByPath.get(group.path);
    if (!card) {
      card = createCard(section.grid.ownerDocument);
      cardsByPath.set(group.path, card);
    }
    card.wrapper.dataset.forgeStatblockPath = group.path;
    updateTokenLabel(card, group, language);

    // If Atlas already rendered this same note in its native DM Screen feed,
    // keep its feed item, menu, sizing and position, but swap only the visual
    // statblock. The hidden Atlas React node remains mounted and is restored on
    // cleanup, so React state and Atlas controls are not destroyed.
    const nativeMount = findNativeFeedMount(app, nativeFeeds, group, reservedNativeItems);
    if (nativeMount) {
      reservedNativeItems.add(nativeMount.item);
      nativeMount.item.dataset.forgeStatblockPath = group.path;
      attachCard(card, nativeMount.target, nativeMount.nativeSheet);
    } else {
      // Generic Tokens and Asset-inherited links do not get a native Atlas feed
      // item. They remain visible in a compact Forge-only section instead.
      attachCard(card, cards, null);
      extraCount += 1;
    }

    const nextSignature = groupSignature(group, viewId, mapPath, sourceRevision);
    if (card.signature !== nextSignature) {
      void renderCard(app, plugin, card, group, viewId, mapPath, sceneId, sourceRevision);
    }
  }

  root.hidden = extraCount === 0;
  if (extraCount === 0) {
    cards.replaceChildren();
    scopeHost.hidden = true;
  }
}

function installForMap(
  app: App,
  plugin: StatblockForgePlugin,
  context: AtlasMapRuntimeContext,
): { refreshSources(): void; cleanup(): void } {
  const cards = new Map<string, ForgeDMScreenCard>();
  const disposers: Array<() => void> = [];
  const view = readMember(context.view, 'containerEl');
  const doc = isHTMLElement(view) ? view.ownerDocument : document;
  const ownerWindow = doc.defaultView;
  let disposed = false;
  let frame: number | null = null;
  let sourceRevision = 0;
  let fallbackScope: ForgeDMScreenScope = 'all';

  const schedule = (): void => {
    if (disposed || frame !== null) return;
    const raf = ownerWindow?.requestAnimationFrame?.bind(ownerWindow);
    if (raf) {
      frame = raf(() => {
        frame = null;
        if (!disposed) syncScreen(app, plugin, context, cards, sourceRevision, fallbackScope, (scope) => {
          fallbackScope = scope;
          schedule();
        }, schedule);
      });
    } else {
      syncScreen(app, plugin, context, cards, sourceRevision, fallbackScope, (scope) => {
        fallbackScope = scope;
        schedule();
      }, schedule);
    }
  };

  const store = context.store as AtlasDMScreenStoreLike | null;
  if (typeof store?.subscribe === 'function') {
    try {
      const unsubscribe = store.subscribe(schedule);
      if (typeof unsubscribe === 'function') disposers.push(unsubscribe);
    } catch { /* A store with an incompatible subscribe shape is still read on DOM changes. */ }
  }

  const viewContainer = isHTMLElement(view) ? view : null;
  const MutationObserverConstructor = ownerWindow?.MutationObserver;
  if (viewContainer && MutationObserverConstructor) {
    const observer = new MutationObserverConstructor((records) => {
      const relevant = records.some((record) => {
        const target = record.target.nodeType === 1 ? record.target as Element : record.target.parentElement;
        if (target?.closest('.statblock-forge__dm-screen-feed')) return false;
        return true;
      });
      if (relevant) schedule();
    });
    observer.observe(viewContainer, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-checked', 'data-page'] });
    disposers.push(() => observer.disconnect());
  }

  const refreshSources = (): void => {
    if (disposed) return;
    sourceRevision += 1;
    schedule();
  };

  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    if (frame !== null) ownerWindow?.cancelAnimationFrame?.(frame);
    frame = null;
    for (const stop of disposers.splice(0)) stop();
    for (const card of cards.values()) disposeCard(card);
    cards.clear();
    const section = screenSectionFor(context.view);
    section?.grid.querySelector(':scope > .statblock-forge__dm-screen-feed')?.remove();
  };
  schedule();
  return { refreshSources, cleanup };
}

/** Adds Forge-native v2 statblocks to each open Atlas DM Screen without rewriting notes or Atlas templates. */
export function startForgeAtlasDMScreenBridge(app: App, plugin: StatblockForgePlugin): () => void {
  let disposed = false;
  const installed = new Map<WorkspaceLeaf, {
    store: unknown;
    refreshSources: () => void;
    cleanup: () => void;
  }>();
  const releaseRefs: Array<() => void> = [];

  const reconcile = (refreshSources = false): void => {
    if (disposed) return;
    try {
      const runtime = inspectAtlasRuntime(app);
      const contexts = runtime.runtimeSupported ? getAtlasMapViewContexts(app) : [];
      const activeLeaves = new Set(contexts.map((context) => context.leaf));
      for (const context of contexts) {
        const previous = installed.get(context.leaf);
        if (previous?.store === context.store) {
          if (refreshSources) previous.refreshSources();
          continue;
        }
        previous?.cleanup();
        installed.set(context.leaf, { store: context.store, ...installForMap(app, plugin, context) });
      }
      for (const [leaf, entry] of installed) {
        if (activeLeaves.has(leaf)) continue;
        entry.cleanup();
        installed.delete(leaf);
      }
    } catch (error) {
      // A DM Screen layout/runtime mismatch must never disable Forge's token-link
      // controls or the independent Ctrl-hover preview bridge.
      console.error('[Statblock Forge] Could not synchronize the Atlas DM Screen feed:', error);
    }
  };

  const workspaceRefs = [
    app.workspace.on('layout-change', reconcile),
    app.workspace.on('active-leaf-change', reconcile),
    app.workspace.on('file-open', reconcile),
  ];
  const metadataRef = app.metadataCache.on('changed', () => reconcile(true));
  const vaultRefs = [
    app.vault.on('rename', () => reconcile(true)),
    app.vault.on('delete', () => reconcile(true)),
    app.vault.on('modify', () => reconcile(true)),
    app.vault.on('create', () => reconcile(true)),
  ];
  releaseRefs.push(() => { for (const ref of workspaceRefs) app.workspace.offref(ref); });
  releaseRefs.push(() => app.metadataCache.offref(metadataRef));
  releaseRefs.push(() => { for (const ref of vaultRefs) app.vault.offref(ref); });
  app.workspace.onLayoutReady(reconcile);
  reconcile();

  return () => {
    if (disposed) return;
    disposed = true;
    for (const entry of installed.values()) entry.cleanup();
    installed.clear();
    for (const release of releaseRefs.splice(0)) release();
  };
}
