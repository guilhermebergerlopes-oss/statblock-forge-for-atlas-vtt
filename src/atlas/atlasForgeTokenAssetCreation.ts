import type { App, TFile } from 'obsidian';
import { getAtlasTokenAdapterContexts } from './atlasTokenAdapter.ts';
import { inspectAtlasRuntime } from './atlasRuntime.ts';
import { isForgeNativeV2StatblockNote } from './atlasTokenLinkAdapter.ts';
import { parseImageReference, resolveVaultImageFile } from '../render/vaultImageResolver.ts';

/** Original Atlas asset-library directory observed in the 0.17.0/0.18.0 baselines. */
export const ATLAS_TOKEN_ASSET_DIRECTORY = 'atlas-vtt/assets';

/** Match the image extensions handled by Atlas' original image display service. */
export const ATLAS_TOKEN_IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp',
]);

export interface AtlasForgeTokenAssetRecord {
  readonly id: string;
  readonly type: 'token';
  readonly name: string;
  readonly imagePath: string;
  readonly collection: string;
  readonly statblockPath?: string;
  readonly showRing?: boolean;
  readonly tags?: string[];
  readonly [key: string]: unknown;
}

export interface AtlasForgeTokenAssetService {
  getTokenAssets(): Promise<AtlasForgeTokenAssetRecord[]>;
  loadedTokenAssets(): AtlasForgeTokenAssetRecord[];
  getDefaultCollectionId(): string;
  addTokenAsset(
    asset: Omit<AtlasForgeTokenAssetRecord, 'id' | 'type'>,
    options?: { userImport?: boolean },
  ): Promise<AtlasForgeTokenAssetRecord>;
}

export type ForgeTokenAssetCreationAssessment =
  | { readonly status: 'ready'; readonly imageFile: TFile; readonly imagePath: string }
  | { readonly status: 'invalid-statblock'; readonly message: string }
  | { readonly status: 'atlas-not-loaded'; readonly message: string }
  | { readonly status: 'unsupported-atlas-version'; readonly message: string }
  | { readonly status: 'map-required'; readonly message: string }
  | { readonly status: 'asset-service-unavailable'; readonly message: string }
  | { readonly status: 'missing-image'; readonly message: string }
  | { readonly status: 'remote-image'; readonly message: string }
  | { readonly status: 'image-not-found'; readonly message: string }
  | { readonly status: 'unsupported-image'; readonly message: string }
  | { readonly status: 'already-exists'; readonly asset: AtlasForgeTokenAssetRecord };

export type ForgeTokenAssetCreationResult =
  | { readonly status: 'created'; readonly asset: AtlasForgeTokenAssetRecord }
  | { readonly status: 'already-exists'; readonly asset: AtlasForgeTokenAssetRecord }
  | { readonly status: 'atlas-not-loaded' | 'unsupported-atlas-version' | 'map-required' | 'asset-service-unavailable' | 'invalid-statblock' | 'missing-image' | 'remote-image' | 'image-not-found' | 'unsupported-image'; readonly message: string }
  | { readonly status: 'uncertain'; readonly message: string; readonly imagePath: string }
  | { readonly status: 'failed'; readonly message: string };

interface AtlasAssetServiceContext {
  readonly assetService: AtlasForgeTokenAssetService;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

function readMember(value: unknown, key: string): unknown {
  if (!isRecord(value)) return undefined;
  try { return value[key]; } catch { return undefined; }
}

function isAtlasForgeTokenAssetService(value: unknown): value is AtlasForgeTokenAssetService {
  return ['getTokenAssets', 'loadedTokenAssets', 'getDefaultCollectionId', 'addTokenAsset']
    .every((name) => typeof readMember(value, name) === 'function');
}

function atlasAssetServiceContext(app: App): AtlasAssetServiceContext | null {
  for (const context of getAtlasTokenAdapterContexts(app)) {
    if (isAtlasForgeTokenAssetService(context.assetService)) {
      return { assetService: context.assetService };
    }
  }
  return null;
}

function resolveImage(app: App, sourcePath: string, value: unknown): ForgeTokenAssetCreationAssessment | { status: 'image-file'; imageFile: TFile } {
  const reference = parseImageReference(value);
  if (reference.kind === 'empty') {
    return { status: 'missing-image', message: 'The Forge Token art Field does not contain an image.' };
  }
  if (reference.kind === 'remote') {
    return { status: 'remote-image', message: 'Atlas TokenAssets require a local Vault image. Save this image into the Vault first.' };
  }
  const imageFile = resolveVaultImageFile(app, reference.path, sourcePath);
  if (!imageFile) {
    return { status: 'image-not-found', message: `The Token art image could not be found in the Vault: ${reference.path}` };
  }
  if (!ATLAS_TOKEN_IMAGE_EXTENSIONS.has(imageFile.extension.toLowerCase())) {
    return { status: 'unsupported-image', message: `Atlas does not accept this image extension for Token art: .${imageFile.extension}` };
  }
  return { status: 'image-file', imageFile };
}

/** Check all prerequisites without writing files or modifying the statblock. */
export function assessForgeTokenAssetCreation(
  app: App,
  statblockPath: string,
  imageValue: unknown,
): ForgeTokenAssetCreationAssessment {
  if (!statblockPath.trim() || !isForgeNativeV2StatblockNote(app, statblockPath)) {
    return { status: 'invalid-statblock', message: 'The source is not a Forge-native v2 statblock note.' };
  }

  const runtime = inspectAtlasRuntime(app);
  if (!runtime.pluginLoaded) {
    return { status: 'atlas-not-loaded', message: 'Atlas VTT is not currently loaded.' };
  }
  if (!runtime.runtimeSupported) {
    return { status: 'unsupported-atlas-version', message: `Direct TokenAsset creation requires Atlas 0.17.0 or newer; detected ${runtime.version ?? 'an unknown version'}.` };
  }
  if (runtime.mapCount === 0) {
    return { status: 'map-required', message: 'Open an Atlas map so Forge can access Atlas’ AssetService.' };
  }
  const context = atlasAssetServiceContext(app);
  if (!context) {
    return { status: 'asset-service-unavailable', message: 'Atlas’ AssetService is not ready yet. Wait for the map to finish loading.' };
  }
  const existing = context.assetService.loadedTokenAssets().find((asset) => assetMatchesSource(asset, statblockPath));
  if (existing) return { status: 'already-exists', asset: existing };

  const image = resolveImage(app, statblockPath, imageValue);
  if (image.status !== 'image-file') return image;
  return { status: 'ready', imageFile: image.imageFile, imagePath: image.imageFile.path };
}

function safeAssetStem(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64) || 'Forge_Token';
}

/** Deterministic filename construction is separated for focused regression coverage. */
export function forgeTokenAssetImagePath(name: string, extension: string, now: number, suffix: string): string {
  const cleanExtension = extension.replace(/^\./, '').toLowerCase();
  return `${ATLAS_TOKEN_ASSET_DIRECTORY}/${safeAssetStem(name)}_${now}_${suffix}.${cleanExtension}`;
}

async function ensureVaultFolder(app: App, path: string): Promise<void> {
  const current = app.vault.getAbstractFileByPath(path) as unknown;
  if (current) {
    if (!Array.isArray(readMember(current, 'children'))) throw new Error(`Cannot create Atlas asset folder because ${path} is not a folder.`);
    return;
  }
  await app.vault.createFolder(path);
}

async function ensureAtlasTokenAssetFolder(app: App): Promise<void> {
  await ensureVaultFolder(app, 'atlas-vtt');
  await ensureVaultFolder(app, ATLAS_TOKEN_ASSET_DIRECTORY);
}

async function writeTokenImageCopy(app: App, imageFile: TFile, tokenName: string): Promise<string> {
  await ensureAtlasTokenAssetFolder(app);
  const bytes = await app.vault.readBinary(imageFile);
  const extension = imageFile.extension.toLowerCase();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = Math.random().toString(36).slice(2, 9);
    const path = forgeTokenAssetImagePath(tokenName, extension, Date.now() + attempt, suffix);
    if (app.vault.getAbstractFileByPath(path)) continue;
    await app.vault.createBinary(path, bytes);
    return path;
  }
  throw new Error('Could not allocate a unique image filename in the Atlas asset library.');
}

async function discardOwnedImageCopy(app: App, path: string): Promise<void> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!file) return;
  const fileManager = readMember(app, 'fileManager');
  const trashFile = readMember(fileManager, 'trashFile');
  if (typeof trashFile === 'function') {
    await (trashFile as (this: unknown, file: unknown) => Promise<void>).call(fileManager, file);
    return;
  }
  const vaultDelete = readMember(app.vault, 'delete');
  if (typeof vaultDelete === 'function') {
    await (vaultDelete as (this: unknown, file: unknown) => Promise<void>).call(app.vault, file);
  }
}

function assetMatchesSource(asset: AtlasForgeTokenAssetRecord, statblockPath: string): boolean {
  return asset.type === 'token' && asset.statblockPath === statblockPath;
}

function requestAtlasAssetRefresh(app: App): void {
  try { app.workspace.trigger('atlas-vtt:refresh-assets'); } catch { /* Registration is authoritative even if a refresh listener is unloading. */ }
}

const tokenAssetCreationsInFlight = new WeakMap<App, Map<string, Promise<ForgeTokenAssetCreationResult>>>();

/**
 * Coalesces repeated clicks for the same Forge note so concurrent menu actions
 * cannot register duplicate TokenAssets while the first save is in progress.
 */
export function createForgeTokenAssetFromImage(
  app: App,
  statblockPath: string,
  tokenName: string,
  imageValue: unknown,
): Promise<ForgeTokenAssetCreationResult> {
  let byPath = tokenAssetCreationsInFlight.get(app);
  if (!byPath) {
    byPath = new Map();
    tokenAssetCreationsInFlight.set(app, byPath);
  }
  const pending = byPath.get(statblockPath);
  if (pending) return pending;
  const creation = createForgeTokenAssetFromImageOnce(app, statblockPath, tokenName, imageValue)
    .finally(() => {
      if (byPath?.get(statblockPath) === creation) byPath.delete(statblockPath);
      if (byPath?.size === 0) tokenAssetCreationsInFlight.delete(app);
    });
  byPath.set(statblockPath, creation);
  return creation;
}

/**
 * Creates an Atlas-owned TokenAsset directly from the Forge v2 Token art Field.
 * It copies the original local image into Atlas' shared asset directory, then
 * registers it through AssetService.addTokenAsset. It never publishes or
 * rewrites the Forge note and never invokes Atlas' native statblock importer.
 */
async function createForgeTokenAssetFromImageOnce(
  app: App,
  statblockPath: string,
  tokenName: string,
  imageValue: unknown,
): Promise<ForgeTokenAssetCreationResult> {
  const assessment = assessForgeTokenAssetCreation(app, statblockPath, imageValue);
  if (assessment.status === 'already-exists') return { status: 'already-exists', asset: assessment.asset };
  if (assessment.status !== 'ready') return { status: assessment.status, message: assessment.message };

  const context = atlasAssetServiceContext(app);
  if (!context) {
    return { status: 'asset-service-unavailable', message: 'Atlas’ AssetService became unavailable before the TokenAsset could be created.' };
  }

  const assetService = context.assetService;
  let copiedImagePath: string | null = null;
  try {
    const existing = await assetService.getTokenAssets();
    const existingForNote = existing.find((asset) => assetMatchesSource(asset, statblockPath));
    if (existingForNote) return { status: 'already-exists', asset: existingForNote };

    copiedImagePath = await writeTokenImageCopy(app, assessment.imageFile, tokenName);
    const asset = await assetService.addTokenAsset({
      name: tokenName.trim() || assessment.imageFile.basename,
      imagePath: copiedImagePath,
      statblockPath,
      collection: assetService.getDefaultCollectionId(),
      tags: [],
      // Match Atlas' own statblock import default: preserve the whole original art.
      showRing: false,
    }, { userImport: true });

    requestAtlasAssetRefresh(app);
    return { status: 'created', asset };
  } catch (error) {
    if (copiedImagePath) {
      try {
        const current = await assetService.getTokenAssets();
        const committed = current.find((asset) => asset.imagePath === copiedImagePath && assetMatchesSource(asset, statblockPath));
        if (committed) {
          requestAtlasAssetRefresh(app);
          return { status: 'created', asset: committed };
        }
      } catch {
        // The write outcome cannot be proven. Keep the image so a committed asset
        // can never be left pointing at a file that the cleanup removed.
        return {
          status: 'uncertain',
          imagePath: copiedImagePath,
          message: 'Atlas could not confirm whether the TokenAsset was saved. The image copy was preserved; inspect the Atlas library before retrying.',
        };
      }
      try { await discardOwnedImageCopy(app, copiedImagePath); } catch { /* Keep an unlinked file rather than masking the original error. */ }
    }
    return { status: 'failed', message: error instanceof Error ? error.message : String(error) };
  }
}

export function forgeTokenAssetAssessmentMessage(
  assessment: ForgeTokenAssetCreationAssessment,
  language: 'en' | 'pt-BR',
): string {
  if (assessment.status === 'already-exists') {
    return language === 'pt-BR'
      ? `Esta ficha já possui um TokenAsset na biblioteca do Atlas: ${assessment.asset.name}.`
      : `This statblock already has an Atlas TokenAsset: ${assessment.asset.name}.`;
  }
  if (assessment.status === 'ready') {
    return language === 'pt-BR'
      ? 'Cria um TokenAsset na biblioteca do Atlas usando a imagem local do campo Token art e vincula a ficha atual.'
      : 'Creates an Atlas TokenAsset from the local Token art image and links it to the current statblock.';
  }
  const messages = language === 'pt-BR' ? {
    'invalid-statblock': 'Esta ação está disponível apenas para fichas Forge v2.',
    'atlas-not-loaded': 'O Atlas VTT não está carregado.',
    'unsupported-atlas-version': assessment.message,
    'map-required': 'Abra um mapa do Atlas para acessar a biblioteca de tokens.',
    'asset-service-unavailable': 'O serviço de assets do Atlas ainda não está disponível.',
    'missing-image': 'Escolha uma imagem local para o campo Token art primeiro.',
    'remote-image': 'O Atlas exige uma imagem salva localmente no Vault. Salve a imagem remota antes de continuar.',
    'image-not-found': assessment.message,
    'unsupported-image': assessment.message,
  } : {
    'invalid-statblock': 'This action is available only for Forge v2 statblocks.',
    'atlas-not-loaded': 'Atlas VTT is not loaded.',
    'unsupported-atlas-version': assessment.message,
    'map-required': 'Open an Atlas map to access the token library.',
    'asset-service-unavailable': 'Atlas’ AssetService is not available yet.',
    'missing-image': 'Choose a local image for Token art first.',
    'remote-image': 'Atlas requires an image saved locally in the Vault. Save the remote image before continuing.',
    'image-not-found': assessment.message,
    'unsupported-image': assessment.message,
  };
  return messages[assessment.status];
}
