import type { App, WorkspaceLeaf } from 'obsidian';
import type { AtlasTokenAdapterContext } from './atlasTokenAdapter.ts';
import { getAtlasTokenAdapterContexts } from './atlasTokenAdapter.ts';
import { readAtlasTokenStateFromContext, type AtlasTokenStateSnapshot, type AtlasTokenSummary } from './atlasTokenStateReader.ts';
import { forgeStatblockTemplateLinkFromFrontmatter } from '../statblocks/forgeTemplateLink.ts';

/** Minimal Atlas TokenAsset shape consumed by Forge; all writes remain Atlas-owned. */
export interface AtlasTokenAssetLike {
  readonly id: string;
  readonly type?: string;
  readonly imagePath?: string;
  readonly statblockPath?: string;
  readonly name?: string;
  readonly [key: string]: unknown;
}

/** The Atlas internal service reached through TokenRenderer.statblockSync in the inspected 0.17.0/0.18.0 baselines. */
export interface AtlasNativeTokenStatblockLinkService {
  getStatblockLinkedToToken(tokenImagePath: string): Promise<string | null>;
  getTokensLinkedToStatblock(statblockPath: string): Promise<string[]>;
  linkTokenToStatblock(
    tokenImagePath: string,
    statblockPath: string,
    options?: { updateStatblockAvatar?: boolean; fromNote?: boolean; notice?: boolean },
  ): Promise<boolean>;
  unlinkToken(
    tokenImagePath: string,
    options?: { updateStatblockAvatar?: boolean; notify?: boolean; fromNote?: boolean; notice?: boolean },
  ): Promise<boolean>;
  findAssetByAnyPath(path: string): Promise<AtlasTokenAssetLike | null>;
}

export interface AtlasNativeAssetService {
  loadedTokenAssets(): AtlasTokenAssetLike[];
  getTokenAssets(): Promise<AtlasTokenAssetLike[]>;
  updateAsset(id: string, updates: Record<string, unknown>): Promise<void>;
  refreshMetadata(): Promise<void>;
}

export type AtlasTokenLinkInspectionStatus =
  | 'ready'
  | 'atlas-not-open'
  | 'no-selection'
  | 'ambiguous-map'
  | 'no-token-image'
  | 'character-tokens-required'
  | 'ambiguous-image-assets'
  | 'link-service-unavailable'
  | 'invalid-statblock';

export interface AtlasSelectedTokenLinkTarget {
  readonly tokenId: string;
  readonly tokenIds: readonly string[];
  readonly name: string | null;
  readonly imagePath: string;
  readonly assetId: string | null;
  readonly currentStatblockPath: string | null;
  readonly assetStatblockPath: string | null;
  readonly assetLinkedToTarget: boolean;
  readonly instanceTokenIdsLinkedToTarget: readonly string[];
  readonly alreadyLinkedToTarget: boolean;
}

export interface AtlasTokenLinkInspection {
  readonly status: AtlasTokenLinkInspectionStatus;
  readonly mapPath: string | null;
  readonly targetStatblockPath: string;
  readonly selectedTokenCount: number;
  readonly targets: readonly AtlasSelectedTokenLinkTarget[];
  readonly linkedToTargetCount: number;
  readonly skippedNonCharacterCount: number;
  readonly message?: string;
  /** Internal runtime references are returned only to the immediate action caller. */
  readonly context?: AtlasTokenAdapterContext;
  readonly linkService?: AtlasNativeTokenStatblockLinkService;
}

export type AtlasTokenLinkActionResult =
  | { readonly status: 'linked' | 'unlinked'; readonly changedCount: number; readonly skippedCount: number; readonly mapPath: string | null }
  | { readonly status: 'atlas-not-open' | 'no-selection' | 'ambiguous-map' | 'no-token-image' | 'character-tokens-required' | 'ambiguous-image-assets' | 'link-service-unavailable' | 'invalid-statblock'; readonly changedCount: 0; readonly skippedCount: number; readonly message: string };

interface UnknownRecord {
  readonly [key: string]: unknown;
}

function isObject(value: unknown): value is UnknownRecord {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

function readMember(target: unknown, key: string): unknown {
  if (!isObject(target)) return undefined;
  try { return target[key]; } catch { return undefined; }
}


function hasMethods(value: unknown, methods: readonly string[]): boolean {
  return methods.every((method) => typeof readMember(value, method) === 'function');
}

/**
 * The verified Atlas profiles do not expose TokenStatblockLinkService on the plugin API.
 * Each map's TokenRenderer owns a StatblockTokenSync, which holds the exact
 * singleton service Atlas itself uses for link/unlink, metadata, map-file and
 * open-store synchronization. Access that instance rather than reimplementing
 * the service's persistence rules. The Forge calls it with
 * `updateStatblockAvatar: false` to keep Forge note serialization untouched.
 */
export function getAtlasNativeTokenStatblockLinkService(
  context: Pick<AtlasTokenAdapterContext, 'tokenStatblockLinkService'>,
): AtlasNativeTokenStatblockLinkService | null {
  const service = context.tokenStatblockLinkService;
  return hasMethods(service, [
    'getStatblockLinkedToToken',
    'getTokensLinkedToStatblock',
    'linkTokenToStatblock',
    'unlinkToken',
    'findAssetByAnyPath',
  ]) ? service as AtlasNativeTokenStatblockLinkService : null;
}

export function getAtlasNativeAssetService(
  context: Pick<AtlasTokenAdapterContext, 'assetService'>,
): AtlasNativeAssetService | null {
  return hasMethods(context.assetService, ['loadedTokenAssets', 'getTokenAssets', 'updateAsset', 'refreshMetadata'])
    ? context.assetService as AtlasNativeAssetService
    : null;
}

/** Mirrors Atlas' libraryTokenOf(): asset ID wins; image path is the legacy fallback. */
export function resolveAtlasLibraryTokenAsset(
  token: Pick<AtlasTokenSummary, 'assetId' | 'imagePath'>,
  assets: readonly AtlasTokenAssetLike[],
): AtlasTokenAssetLike | null {
  if (token.assetId) {
    const named = assets.find((asset) => asset.id === token.assetId && (asset.type === undefined || asset.type === 'token'));
    if (named) return named;
  }
  if (!token.imagePath) return null;
  return assets.find((asset) => (asset.type === undefined || asset.type === 'token') && asset.imagePath === token.imagePath) ?? null;
}

/**
 * Reads the statblock target according to Atlas' ownership rules. A placed
 * token's own statblockPath takes precedence; otherwise its library TokenAsset
 * supplies the shared link inherited by tokens spawned from that asset.
 */
export function resolveAtlasTokenStatblockPath(
  token: Pick<AtlasTokenSummary, 'assetId' | 'imagePath' | 'statblockPath'>,
  assets: readonly AtlasTokenAssetLike[],
): { readonly statblockPath: string | null; readonly source: 'instance' | 'asset' | 'none'; readonly asset: AtlasTokenAssetLike | null } {
  const asset = resolveAtlasLibraryTokenAsset(token, assets);
  if (token.statblockPath) return { statblockPath: token.statblockPath, source: 'instance', asset };
  if (typeof asset?.statblockPath === 'string' && asset.statblockPath.trim()) {
    return { statblockPath: asset.statblockPath, source: 'asset', asset };
  }
  return { statblockPath: null, source: 'none', asset };
}

function activeLeaf(app: App): WorkspaceLeaf | null {
  const workspace = readMember(app, 'workspace');
  const leaf = readMember(workspace, 'activeLeaf');
  return isObject(leaf) ? leaf as WorkspaceLeaf : null;
}

function contextState(context: AtlasTokenAdapterContext): AtlasTokenStateSnapshot {
  return readAtlasTokenStateFromContext(context);
}

export function isForgeStatblockNote(app: App, path: string): boolean {
  const file = app.vault.getAbstractFileByPath(path);
  if (!file || typeof file !== 'object') return false;
  const extension = readMember(file, 'extension');
  if (typeof extension !== 'string' || extension.toLowerCase() !== 'md') return false;
  const metadataCache = readMember(app, 'metadataCache');
  const getFileCache = readMember(metadataCache, 'getFileCache');
  if (typeof getFileCache !== 'function') return false;
  let cache: unknown;
  try { cache = (getFileCache as (this: unknown, file: unknown) => unknown).call(metadataCache, file); }
  catch { return false; }
  const frontmatter = readMember(cache, 'frontmatter');
  const link = forgeStatblockTemplateLinkFromFrontmatter(frontmatter);
  if (!link) return false;
  if (link.atlasTemplateId) return readMember(frontmatter, 'atlas-template') === link.atlasTemplateId;
  return link.version === 2 && readMember(frontmatter, 'atlas-template') === undefined;
}

/** Forge-native v2 notes are rendered directly; legacy v1 notes may still be Atlas-published. */
export function isForgeNativeV2StatblockNote(app: App, path: string): boolean {
  const file = app.vault.getAbstractFileByPath(path);
  if (!file || typeof file !== 'object' || String(readMember(file, 'extension') ?? '').toLowerCase() !== 'md') return false;
  const metadataCache = readMember(app, 'metadataCache');
  const getFileCache = readMember(metadataCache, 'getFileCache');
  if (typeof getFileCache !== 'function') return false;
  let cache: unknown;
  try { cache = (getFileCache as (this: unknown, file: unknown) => unknown).call(metadataCache, file); }
  catch { return false; }
  const frontmatter = readMember(cache, 'frontmatter');
  const link = forgeStatblockTemplateLinkFromFrontmatter(frontmatter);
  return Boolean(link?.version === 2 && readMember(frontmatter, 'atlas-template') === undefined);
}

function selectedContext(app: App, contexts: readonly AtlasTokenAdapterContext[]):
  | { status: 'selected'; context: AtlasTokenAdapterContext; state: AtlasTokenStateSnapshot }
  | { status: 'none' | 'ambiguous' | 'unavailable' } {
  if (contexts.length === 0) return { status: 'unavailable' };

  const active = activeLeaf(app);
  const activeContext = active ? contexts.find((context) => context.leaf === active) : undefined;
  if (activeContext) {
    const state = contextState(activeContext);
    return state.selectedTokens.length > 0
      ? { status: 'selected', context: activeContext, state }
      : { status: 'none' };
  }

  const candidates = contexts.flatMap((context) => {
    const state = contextState(context);
    return state.selectedTokens.length > 0 ? [{ context, state }] : [];
  });
  if (candidates.length === 0) return { status: 'none' };
  if (candidates.length > 1) return { status: 'ambiguous' };
  return { status: 'selected', ...candidates[0]! };
}

/**
 * Inspects the selected tokens across the currently open Atlas maps. The active
 * Atlas map is preferred; when a Forge note is focused, exactly one map with a
 * non-empty selection may still provide the selected-token context.
 */
export function inspectSelectedAtlasTokenLinks(
  app: App,
  targetStatblockPath: string,
): AtlasTokenLinkInspection {
  const invalid = !targetStatblockPath || !targetStatblockPath.trim() || !isForgeStatblockNote(app, targetStatblockPath);
  if (invalid) {
    return {
      status: 'invalid-statblock', mapPath: null, targetStatblockPath, selectedTokenCount: 0,
      targets: [], linkedToTargetCount: 0, skippedNonCharacterCount: 0, message: 'O destino não é uma nota de statblock válida do Forge.',
    };
  }

  const contexts = getAtlasTokenAdapterContexts(app);
  if (contexts.length === 0) {
    return {
      status: 'atlas-not-open', mapPath: null, targetStatblockPath, selectedTokenCount: 0,
      targets: [], linkedToTargetCount: 0, skippedNonCharacterCount: 0, message: 'Abra uma cena do Atlas e selecione pelo menos um token.',
    };
  }

  const selected = selectedContext(app, contexts);
  if (selected.status === 'unavailable') {
    return {
      status: 'atlas-not-open', mapPath: null, targetStatblockPath, selectedTokenCount: 0,
      targets: [], linkedToTargetCount: 0, skippedNonCharacterCount: 0, message: 'Não há uma cena do Atlas disponível.',
    };
  }
  if (selected.status === 'ambiguous') {
    return {
      status: 'ambiguous-map', mapPath: null, targetStatblockPath, selectedTokenCount: 0,
      targets: [], linkedToTargetCount: 0, skippedNonCharacterCount: 0,
      message: 'Há seleções em mais de uma cena do Atlas. Ative a cena desejada para escolher os tokens.',
    };
  }
  if (selected.status === 'none') {
    return {
      status: 'no-selection', mapPath: null, targetStatblockPath, selectedTokenCount: 0,
      targets: [], linkedToTargetCount: 0, skippedNonCharacterCount: 0, message: 'Selecione um ou mais tokens em uma cena do Atlas.',
    };
  }

  const service = getAtlasNativeTokenStatblockLinkService(selected.context);
  if (!service) {
    return {
      status: 'link-service-unavailable', mapPath: selected.state.mapPath, targetStatblockPath,
      selectedTokenCount: selected.state.selectedTokens.length, targets: [], linkedToTargetCount: 0, skippedNonCharacterCount: 0,
      message: 'O serviço interno de vínculos de tokens do Atlas ainda não está disponível. Aguarde o mapa terminar de carregar.',
    };
  }

  const assetService = getAtlasNativeAssetService(selected.context);
  let assets: AtlasTokenAssetLike[] = [];
  if (assetService) {
    try {
      const loaded = assetService.loadedTokenAssets();
      if (Array.isArray(loaded)) assets = loaded.slice();
    } catch {
      // The native link service remains authoritative for writes even if the quick asset snapshot is unavailable.
    }
  }

  const deduplicated = new Map<string, AtlasSelectedTokenLinkTarget>();
  const characterTokens = selected.state.selectedTokens.filter((token) => token.kind === 'character');
  const skippedNonCharacterCount = selected.state.selectedTokens.length - characterTokens.length;
  if (characterTokens.length === 0) {
    return {
      status: 'character-tokens-required', mapPath: selected.state.mapPath, targetStatblockPath,
      selectedTokenCount: selected.state.selectedTokens.length, targets: [], linkedToTargetCount: 0, skippedNonCharacterCount,
      message: 'O Ctrl-hover do Atlas é emitido para tokens do tipo Character. Coloque o token pela biblioteca do Atlas antes de vinculá-lo.',
    };
  }
  for (const token of characterTokens) {
    if (!token.imagePath) continue;
    // Atlas' native link service addresses a TokenAsset by image path rather
    // than asset ID. If duplicate assets share that path, the target is not
    // unambiguous and a write could update a different library record.
    if (assets.filter((asset) => asset.imagePath === token.imagePath).length > 1) {
      return {
        status: 'ambiguous-image-assets', mapPath: selected.state.mapPath, targetStatblockPath,
        selectedTokenCount: selected.state.selectedTokens.length, targets: [], linkedToTargetCount: 0, skippedNonCharacterCount,
        message: `Mais de um TokenAsset usa a imagem ${token.imagePath}. Resolva os duplicados na biblioteca do Atlas antes de alterar o vínculo.`,
      };
    }
    const resolved = resolveAtlasTokenStatblockPath(token, assets);
    const existingTarget = deduplicated.get(token.imagePath);
    const assetStatblockPath = typeof resolved.asset?.statblockPath === 'string' && resolved.asset.statblockPath.trim()
      ? resolved.asset.statblockPath : null;
    const instanceLinkedToTarget = token.statblockPath === targetStatblockPath;
    const target: AtlasSelectedTokenLinkTarget = {
      tokenId: token.id,
      tokenIds: [token.id],
      name: token.name,
      imagePath: token.imagePath,
      assetId: token.assetId,
      currentStatblockPath: resolved.statblockPath,
      assetStatblockPath,
      assetLinkedToTarget: assetStatblockPath === targetStatblockPath,
      instanceTokenIdsLinkedToTarget: instanceLinkedToTarget ? [token.id] : [],
      alreadyLinkedToTarget: resolved.statblockPath === targetStatblockPath,
    };
    if (!existingTarget) {
      deduplicated.set(token.imagePath, target);
    } else {
      const mergedTokenIds = [...existingTarget.tokenIds, token.id];
      const instanceTokenIdsLinkedToTarget = instanceLinkedToTarget
        ? [...existingTarget.instanceTokenIdsLinkedToTarget, token.id]
        : existingTarget.instanceTokenIdsLinkedToTarget;
      const assetLinkedToTarget = existingTarget.assetLinkedToTarget || target.assetLinkedToTarget;
      deduplicated.set(token.imagePath, {
        ...existingTarget,
        tokenIds: mergedTokenIds,
        instanceTokenIdsLinkedToTarget,
        assetLinkedToTarget,
        alreadyLinkedToTarget: existingTarget.alreadyLinkedToTarget || target.alreadyLinkedToTarget,
      });
    }
  }

  const targets = [...deduplicated.values()];
  if (targets.length === 0) {
    return {
      status: 'no-token-image', mapPath: selected.state.mapPath, targetStatblockPath,
      selectedTokenCount: selected.state.selectedTokens.length, targets, linkedToTargetCount: 0, skippedNonCharacterCount,
      message: 'Os tokens selecionados não possuem uma imagem que possa ser vinculada.',
    };
  }

  return {
    status: 'ready',
    mapPath: selected.state.mapPath,
    targetStatblockPath,
    selectedTokenCount: selected.state.selectedTokens.length,
    targets,
    linkedToTargetCount: targets.filter((target) => target.alreadyLinkedToTarget).length,
    skippedNonCharacterCount,
    context: selected.context,
    linkService: service,
  };
}

/** Writes a Forge v2 path into placed Atlas Character instances. Atlas' native
 * link service cannot resolve Forge v2 notes for its open-map sync callback,
 * although it does update the library asset and closed map files. This fills
 * that narrow gap through the same Zustand action Atlas uses for token edits.
 */
export function updateAtlasPlacedCharacterLinks(
  context: AtlasTokenAdapterContext,
  tokenIds: readonly string[],
  statblockPath: string | undefined,
): boolean {
  if (tokenIds.length === 0) return true;
  const store = context.atlasStore;
  const getState = readMember(store, 'getState');
  if (typeof getState !== 'function') return false;
  let state: unknown;
  try { state = (getState as (this: unknown) => unknown).call(store); }
  catch { return false; }
  const updateTokens = readMember(state, 'updateTokens');
  if (typeof updateTokens !== 'function') return false;
  const entries = tokenIds.map((id) => ({
    id,
    changes: { statblockPath },
  }));
  try {
    (updateTokens as (this: unknown, entries: unknown[]) => void).call(state, entries);
    return true;
  } catch {
    return false;
  }
}

/** Clears only selected instance-level statblock overrides, leaving their shared TokenAsset link intact. */
export function clearAtlasPlacedCharacterStatblockOverrides(
  context: AtlasTokenAdapterContext,
  tokenIds: readonly string[],
): boolean {
  if (tokenIds.length === 0) return true;
  const store = context.atlasStore;
  const getState = readMember(store, 'getState');
  if (typeof getState !== 'function') return false;
  let state: unknown;
  try { state = (getState as (this: unknown) => unknown).call(store); }
  catch { return false; }
  const updateTokens = readMember(state, 'updateTokens');
  if (typeof updateTokens !== 'function') return false;
  const changes = {
    statblockPath: undefined,
    name: undefined,
    statblockName: undefined,
    resources: undefined,
    overriddenMax: undefined,
    difficulty: undefined,
  };
  const entries = tokenIds.map((id) => ({ id, changes }));
  try {
    (updateTokens as (this: unknown, entries: unknown[]) => void).call(state, entries);
    return true;
  } catch {
    return false;
  }
}

/** Updates every open-map Character instance spawned from the linked artwork. Atlas' native
 * map-file writer handles closed maps; this handles all currently mounted map stores because
 * its statblock resolver cannot yet read Forge v2 note content.
 */
export function updateAtlasPlacedCharacterLinksForImage(
  app: App,
  imagePath: string,
  statblockPath: string | undefined,
): boolean {
  let success = true;
  for (const context of getAtlasTokenAdapterContexts(app)) {
    const snapshot = readAtlasTokenStateFromContext(context);
    const tokenIds = snapshot.tokens
      .filter((token) => token.kind === 'character' && token.imagePath === imagePath)
      .map((token) => token.id);
    if (tokenIds.length > 0 && !updateAtlasPlacedCharacterLinks(context, tokenIds, statblockPath)) success = false;
  }
  return success;
}

/**
 * Atlas linkTokenToStatblock() internally unlinks a previous target in the verified runtime profiles
 * with updateStatblockAvatar=true, even when the outer call requests false.
 * That implicit unlink can rewrite the previous statblock's Token art field.
 * Forge performs the no-avatar unlink explicitly first, then links the new
 * target; if the new link fails, it attempts to restore the previous link.
 */
async function linkAtlasTokenWithoutRewritingStatblockArtwork(
  service: AtlasNativeTokenStatblockLinkService,
  imagePath: string,
  targetStatblockPath: string,
  options: { updateStatblockAvatar: boolean; notice: boolean },
): Promise<boolean> {
  const previousPath = await service.getStatblockLinkedToToken(imagePath);
  if (!options.updateStatblockAvatar && previousPath && previousPath !== targetStatblockPath) {
    const removed = await service.unlinkToken(imagePath, { updateStatblockAvatar: false, notify: false, notice: false });
    if (!removed) return false;
    let linked = false;
    try {
      linked = await service.linkTokenToStatblock(imagePath, targetStatblockPath, {
        updateStatblockAvatar: false,
        notice: options.notice,
      });
    } catch (error) {
      try {
        await service.linkTokenToStatblock(imagePath, previousPath, { updateStatblockAvatar: false, notice: false });
      } catch {
        // Preserve the original failure; the caller reports the incomplete operation.
      }
      throw error;
    }
    if (!linked) {
      // Avoid leaving the asset detached if the replacement link was rejected.
      await service.linkTokenToStatblock(imagePath, previousPath, { updateStatblockAvatar: false, notice: false });
    }
    return linked;
  }

  return service.linkTokenToStatblock(imagePath, targetStatblockPath, {
    updateStatblockAvatar: options.updateStatblockAvatar,
    notice: options.notice,
  });
}

/** Links every distinct selected token asset using Atlas' own service and sync lifecycle. */
export async function linkSelectedAtlasTokensToStatblock(
  app: App,
  targetStatblockPath: string,
  options: { updateStatblockAvatar?: boolean; notice?: boolean } = {},
): Promise<AtlasTokenLinkActionResult> {
  const inspection = inspectSelectedAtlasTokenLinks(app, targetStatblockPath);
  if (inspection.status !== 'ready' || !inspection.linkService) {
    return {
      status: inspection.status,
      changedCount: 0,
      skippedCount: inspection.skippedNonCharacterCount ?? 0,
      message: inspection.message ?? 'Não foi possível acessar os tokens selecionados.',
    };
  }

  let changedCount = 0;
  let skippedCount = inspection.skippedNonCharacterCount;
  for (const target of inspection.targets) {
    if (target.assetLinkedToTarget) {
      skippedCount += 1;
      continue;
    }
    try {
      const linked = await linkAtlasTokenWithoutRewritingStatblockArtwork(
        inspection.linkService,
        target.imagePath,
        targetStatblockPath,
        { updateStatblockAvatar: options.updateStatblockAvatar ?? false, notice: options.notice ?? true },
      );
      if (linked) {
        changedCount += 1;
        if (!updateAtlasPlacedCharacterLinksForImage(app, target.imagePath, targetStatblockPath)) skippedCount += 1;
      } else skippedCount += 1;
    } catch (error) {
      console.error('[Statblock Forge] Atlas token link failed:', error);
      skippedCount += 1;
    }
  }

  return { status: 'linked', changedCount, skippedCount, mapPath: inspection.mapPath };
}

/** Unlinks only selected token assets that currently point to this exact Forge note. */
export async function unlinkSelectedAtlasTokensFromStatblock(
  app: App,
  targetStatblockPath: string,
  options: { updateStatblockAvatar?: boolean; notify?: boolean; notice?: boolean } = {},
): Promise<AtlasTokenLinkActionResult> {
  const inspection = inspectSelectedAtlasTokenLinks(app, targetStatblockPath);
  if (inspection.status !== 'ready' || !inspection.linkService) {
    return {
      status: inspection.status,
      changedCount: 0,
      skippedCount: inspection.skippedNonCharacterCount ?? 0,
      message: inspection.message ?? 'Não foi possível acessar os tokens selecionados.',
    };
  }

  let changedCount = 0;
  let skippedCount = inspection.skippedNonCharacterCount;
  for (const target of inspection.targets) {
    try {
      if (target.assetLinkedToTarget) {
        const unlinked = await inspection.linkService.unlinkToken(
          target.imagePath,
          {
            updateStatblockAvatar: options.updateStatblockAvatar ?? false,
            notify: options.notify ?? true,
            notice: options.notice ?? true,
          },
        );
        if (unlinked) changedCount += 1;
        else skippedCount += 1;
        continue;
      }

      // An instance-only link must not call unlinkToken(): that Atlas service
      // operates on the shared TokenAsset and would detach every map copy.
      // Clear only the selected Character instances using Atlas' own store action
      // and the same statblock-derived fields as STATBLOCK_UNLINK_UPDATES.
      if (target.instanceTokenIdsLinkedToTarget.length > 0) {
        if (clearAtlasPlacedCharacterStatblockOverrides(inspection.context!, target.instanceTokenIdsLinkedToTarget)) changedCount += 1;
        else skippedCount += 1;
        continue;
      }
      skippedCount += 1;
    } catch (error) {
      console.error('[Statblock Forge] Atlas token unlink failed:', error);
      skippedCount += 1;
    }
  }

  return { status: 'unlinked', changedCount, skippedCount, mapPath: inspection.mapPath };
}
