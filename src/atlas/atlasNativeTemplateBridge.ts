import type { App, TFile } from 'obsidian';
import { parseTemplateFileText } from '../templates/forgeFileFormat.ts';
import { cloneJson, isRecord, newTemplateId, type ForgeTemplate } from '../templates/forgeTemplate.ts';
import { FORGE_ATLAS_ROLE_MIRROR_FORMAT, FORGE_ATLAS_ROLE_MIRROR_KEY, FORGE_ATLAS_ROLE_MIRROR_VERSION, forgeAtlasRoleMirrorMetadata } from '../templates/atlasRoleMirrorMetadata.ts';
import { ensureVaultFolder, VaultFolderPathConflictError } from '../utils/vaultFolders.ts';
import { registerForgeAtlasRoleTemplateLink } from './forgeTemplateLinkResolver.ts';

/** Atlas' TemplateLibrary discovers native templates by this extension, anywhere in the Vault. */
export const ATLAS_NATIVE_TEMPLATE_EXTENSION = 'atlastemplate';
export const FORGE_ATLAS_NATIVE_TEMPLATE_FOLDER = 'atlas-vtt/statblock-templates/Forge Mirrors';
export const LEGACY_FORGE_ATLAS_NATIVE_TEMPLATE_FOLDER = '.statblock-forge/atlas-native-templates';

export interface AtlasNativeTemplateMirror {
  /** ID used by Atlas in `.atlastemplate` files and Role assignments. */
  readonly atlasTemplateId: string;
  /** Stable ID retained by the source `.forgetemplate`. */
  readonly sourceTemplateId: string;
  readonly path: string;
  readonly created: boolean;
}

function cleanPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
}

function mirrorPath(sourceTemplateId: string, sourceBasename: string): string {
  const safeBasename = sourceBasename.trim().replace(/[\\/:*?"<>|#^[\]]/g, '-').replace(/^\.+/, '').trim() || 'Forge Template';
  const shortId = sourceTemplateId.slice(-6) || sourceTemplateId;
  return `${FORGE_ATLAS_NATIVE_TEMPLATE_FOLDER}/${safeBasename} (${shortId}).${ATLAS_NATIVE_TEMPLATE_EXTENSION}`;
}

function isLegacyPrivateMirrorPath(path: string): boolean {
  const normalized = cleanPath(path).toLocaleLowerCase();
  return normalized.startsWith(`${LEGACY_FORGE_ATLAS_NATIVE_TEMPLATE_FOLDER.toLocaleLowerCase()}/`);
}

function sameVaultPath(left: string, right: string): boolean {
  return cleanPath(left).toLocaleLowerCase() === cleanPath(right).toLocaleLowerCase();
}

function listedVaultPath(parent: string, entry: string): string {
  const listed = cleanPath(entry);
  return listed.includes('/') ? listed : `${cleanPath(parent)}/${listed}`;
}

async function readExistingMirrorTextAtPath(app: App, path: string): Promise<{ path: string; text: string } | null> {
  const indexed = app.vault.getAbstractFileByPath(path)
    ?? app.vault.getFiles().find((file) => sameVaultPath(file.path, path))
    ?? null;
  if (indexed) {
    if (typeof (indexed as { extension?: unknown }).extension !== 'string'
      || (indexed as { extension: string }).extension.toLowerCase() !== ATLAS_NATIVE_TEMPLATE_EXTENSION) {
      throw new Error(`O caminho reservado para o espelho de Role está ocupado: "${indexed.path}".`);
    }
    return { path: indexed.path, text: await app.vault.cachedRead(indexed as TFile) };
  }

  const adapter = app.vault.adapter as typeof app.vault.adapter & {
    exists?: (adapterPath: string) => Promise<boolean>;
    read?: (adapterPath: string) => Promise<string>;
    list?: (adapterPath: string) => Promise<{ files: string[]; folders: string[] }>;
  };
  let resolvedPath = path;
  if (typeof adapter?.list === 'function') {
    const slash = path.lastIndexOf('/');
    const parent = slash >= 0 ? path.slice(0, slash) : '';
    const basename = slash >= 0 ? path.slice(slash + 1) : path;
    try {
      const listing = await adapter.list(parent);
      resolvedPath = listing.files
        .map((entry) => listedVaultPath(parent, entry))
        .find((entry) => sameVaultPath(entry, path) || entry.split('/').pop()?.toLocaleLowerCase() === basename.toLocaleLowerCase())
        ?? path;
    } catch {
      // Fall through to the adapter's direct existence check.
    }
  }
  if (typeof adapter?.exists !== 'function' || !(await adapter.exists(resolvedPath))) return null;
  if (typeof adapter.read !== 'function') {
    throw new Error(`O arquivo de espelho já existe em "${resolvedPath}", mas o Vault não permite verificar seu conteúdo.`);
  }
  return { path: resolvedPath, text: await adapter.read(resolvedPath) };
}

async function ensureFolder(app: App, path: string): Promise<void> {
  try {
    await ensureVaultFolder(app.vault, path);
  } catch (error) {
    if (error instanceof VaultFolderPathConflictError) {
      throw new Error(`Não foi possível criar o espelho de Roles do Atlas: "${error.path}" é um arquivo.`);
    }
    throw error;
  }
}

function nativeTemplateJson(template: ForgeTemplate, sourcePath: string, atlasTemplateId: string): string {
  const native = cloneJson(template) as Record<string, unknown>;
  // The Atlas mirror is a separate library entry. Never reuse the Forge
  // source ID: Atlas and Forge maintain independent template identities.
  native.id = atlasTemplateId;
  delete native.statblockForge;
  // parseTemplateFileText has already normalized Forge's serialized aliases
  // back to Atlas' native Field IDs. Keep those IDs in the Atlas mirror.

  // Atlas does not have a native Checkboxes Field. Keep it visible but read-only
  // in the native player book instead of letting its unknown type fall back to
  // an editable text field and corrupt the structured boolean map.
  if (Array.isArray(native.fields)) {
    const players = isRecord(native.players) ? { ...native.players } : {};
    for (const field of native.fields) {
      if (!isRecord(field) || typeof field.key !== 'string') continue;
      if (field.type === 'checkboxes' && players[field.key] !== 'hidden') players[field.key] = 'read';
    }
    if (Object.keys(players).length > 0) native.players = players;
    else delete native.players;
  }

  native[FORGE_ATLAS_ROLE_MIRROR_KEY] = {
    format: FORGE_ATLAS_ROLE_MIRROR_FORMAT,
    version: FORGE_ATLAS_ROLE_MIRROR_VERSION,
    sourceTemplateId: template.id,
    sourceTemplatePath: sourcePath,
  };

  return `${JSON.stringify(native, null, 2)}\n`;
}

function templateIdFromText(text: string): string | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) && typeof parsed.id === 'string' ? parsed.id : null;
  } catch {
    return null;
  }
}

/**
 * Reconcile a mirror that already exists on disk. Obsidian may not expose
 * files inside a hidden Vault folder through getAbstractFileByPath() or
 * getFiles(), even though Vault.create() correctly rejects a duplicate path.
 * In that case use the adapter to inspect the existing file, but only update
 * it when its Forge ownership marker names this source Template. Never
 * replace an unrelated file just because the path collides.
 */
async function reconcileExistingMirrorAtPath(
  app: App,
  path: string,
  sourceTemplateId: string,
  nativeText: string,
): Promise<string | null> {
  const adapter = app.vault.adapter as typeof app.vault.adapter & {
    exists?: (adapterPath: string) => Promise<boolean>;
    read?: (adapterPath: string) => Promise<string>;
    write?: (adapterPath: string, text: string) => Promise<void>;
    list?: (adapterPath: string) => Promise<{ files: string[]; folders: string[] }>;
  };

  // Resolve a case-insensitive path collision too. Some Vault adapters run on
  // case-insensitive file systems: create() can reject a path whose casing is
  // different even when the exact spelling is absent from the Obsidian index.
  let resolvedPath = path;
  const indexed = app.vault.getAbstractFileByPath(path)
    ?? app.vault.getFiles().find((file) => sameVaultPath(file.path, path))
    ?? null;
  if (indexed) resolvedPath = indexed.path;

  if (!indexed && typeof adapter?.list === 'function') {
    const slash = path.lastIndexOf('/');
    const parent = slash >= 0 ? path.slice(0, slash) : '';
    const basename = slash >= 0 ? path.slice(slash + 1) : path;
    try {
      const listing = await adapter.list(parent);
      const match = listing.files
        .map((entry) => listedVaultPath(parent, entry))
        .find((entry) => sameVaultPath(entry, path) || entry.split('/').pop()?.toLocaleLowerCase() === basename.toLocaleLowerCase());
      if (match) resolvedPath = match;
    } catch {
      // The folder may not exist yet. The exact adapter exists() check below
      // remains the fallback for adapters that cannot list it.
    }
  }

  const resolvedIndexed = indexed
    ?? app.vault.getAbstractFileByPath(resolvedPath)
    ?? app.vault.getFiles().find((file) => sameVaultPath(file.path, resolvedPath))
    ?? null;
  let existingText: string;
  let writeExisting: (text: string) => Promise<void>;

  if (resolvedIndexed) {
    if (typeof (resolvedIndexed as { extension?: unknown }).extension !== 'string'
      || (resolvedIndexed as { extension: string }).extension.toLowerCase() !== ATLAS_NATIVE_TEMPLATE_EXTENSION) {
      throw new Error(`O caminho reservado para o espelho de Role está ocupado: "${resolvedIndexed.path}".`);
    }
    const file = resolvedIndexed as TFile;
    existingText = await app.vault.cachedRead(file);
    writeExisting = async (text) => { await app.vault.modify(file, text); };
    resolvedPath = file.path;
  } else {
    if (typeof adapter?.exists !== 'function' || !(await adapter.exists(resolvedPath))) return null;
    if (typeof adapter.read !== 'function') {
      throw new Error(`O arquivo de espelho já existe em "${resolvedPath}", mas o Vault não permite verificar seu conteúdo.`);
    }
    existingText = await adapter.read(resolvedPath);
    writeExisting = async (text) => {
      if (typeof adapter.write !== 'function') {
        throw new Error(`O espelho "${resolvedPath}" precisa ser atualizado, mas o adaptador do Vault não oferece escrita direta.`);
      }
      await adapter.write(resolvedPath, text);
    };
  }

  const existingDocument: unknown = (() => {
    try { return JSON.parse(existingText) as unknown; } catch { return null; }
  })();
  const existingMetadata = forgeAtlasRoleMirrorMetadata(existingDocument);
  if (existingMetadata?.sourceTemplateId !== sourceTemplateId) {
    throw new Error(`O caminho reservado para o espelho de Role já contém outro arquivo ou Template: "${resolvedPath}".`);
  }
  if (existingText !== nativeText) await writeExisting(nativeText);
  return resolvedPath;
}

/**
 * Publishes an Atlas-native mirror so Forge templates are discoverable by the
 * Atlas TemplateLibrary, including the collection Roles template selector.
 * The mirror receives its own Atlas ID, independent from the Forge source ID.
 * Its ownership marker lets Forge exclude the generated copy from duplicate-ID
 * checks and resolve Atlas-created Role notes back to the Forge source.
 * Atlas continues to own the Role configuration and statblock lifecycle.
 */
const mirrorOperations = new WeakMap<App, Map<string, Promise<AtlasNativeTemplateMirror>>>();

export function ensureAtlasNativeTemplateMirror(
  app: App,
  templateFile: TFile,
): Promise<AtlasNativeTemplateMirror> {
  let byPath = mirrorOperations.get(app);
  if (!byPath) {
    byPath = new Map();
    mirrorOperations.set(app, byPath);
  }
  const pending = byPath.get(templateFile.path);
  if (pending) return pending;

  const operation = ensureAtlasNativeTemplateMirrorOnce(app, templateFile).then((mirror) => {
    registerForgeAtlasRoleTemplateLink(app, mirror.atlasTemplateId, mirror.sourceTemplateId, templateFile.path);
    return mirror;
  }).finally(() => {
    if (byPath?.get(templateFile.path) === operation) byPath.delete(templateFile.path);
    if (byPath?.size === 0) mirrorOperations.delete(app);
  });
  byPath.set(templateFile.path, operation);
  return operation;
}

async function ensureAtlasNativeTemplateMirrorOnce(
  app: App,
  templateFile: TFile,
): Promise<AtlasNativeTemplateMirror> {
  if (templateFile.extension.toLowerCase() !== 'forgetemplate') {
    throw new Error('O espelho de Role precisa partir de um arquivo .forgetemplate.');
  }
  const sourceText = await app.vault.cachedRead(templateFile);
  const parsed = parseTemplateFileText(sourceText, templateFile.extension);
  if (parsed.fileFormat !== 'forge' || !parsed.template.id) {
    throw new Error('O template Forge não pôde ser convertido para o formato nativo do Atlas.');
  }

  const path = mirrorPath(parsed.template.id, templateFile.basename);
  const sourceTemplateId = parsed.template.id;

  // Reuse the Atlas ID of an existing managed mirror so repeated saves never
  // churn Role references. Older Forge mirrors used the Forge ID itself; those
  // are migrated once to a new Atlas ID while retaining the same file path.
  for (const candidate of app.vault.getFiles()) {
    if (candidate.extension.toLowerCase() !== ATLAS_NATIVE_TEMPLATE_EXTENSION
      || isLegacyPrivateMirrorPath(candidate.path)) continue;
    const candidateText = await app.vault.cachedRead(candidate);
    const candidateDocument: unknown = (() => { try { return JSON.parse(candidateText) as unknown; } catch { return null; } })();
    const mirrorMetadata = forgeAtlasRoleMirrorMetadata(candidateDocument);
    if (mirrorMetadata?.sourceTemplateId !== sourceTemplateId) continue;

    const candidateId = templateIdFromText(candidateText);
    const atlasTemplateId = candidateId && candidateId !== sourceTemplateId
      ? candidateId
      : await generateUniqueAtlasTemplateId(app, templateFile.basename, sourceTemplateId, candidate.path);
    const nativeText = nativeTemplateJson(parsed.template, templateFile.path, atlasTemplateId);
    // A Forge file can be moved or renamed while keeping its stable source ID.
    // Reuse the managed mirror and refresh its content without changing the
    // independent Atlas ID unless it is still using the legacy shared ID.
    if (candidateText !== nativeText) await app.vault.modify(candidate, nativeText);
    return { atlasTemplateId, sourceTemplateId, path: candidate.path, created: false };
  }

  const onDiskMirror = await readExistingMirrorTextAtPath(app, path);
  const onDiskDocument: unknown = onDiskMirror
    ? (() => { try { return JSON.parse(onDiskMirror.text) as unknown; } catch { return null; } })()
    : null;
  const onDiskMetadata = forgeAtlasRoleMirrorMetadata(onDiskDocument);
  const onDiskId = onDiskMetadata?.sourceTemplateId === sourceTemplateId ? templateIdFromText(onDiskMirror!.text) : null;
  const atlasTemplateId = onDiskId && onDiskId !== sourceTemplateId
    ? onDiskId
    : await generateUniqueAtlasTemplateId(app, templateFile.basename, sourceTemplateId, onDiskMirror?.path);
  const nativeText = nativeTemplateJson(parsed.template, templateFile.path, atlasTemplateId);

  // First inspect both the Obsidian index and the adapter. This also reuses
  // mirrors created by an earlier version or by another concurrent writer.
  const existingMirrorPath = await reconcileExistingMirrorAtPath(app, path, sourceTemplateId, nativeText);
  if (existingMirrorPath) {
    return { atlasTemplateId, sourceTemplateId, path: existingMirrorPath, created: false };
  }

  await ensureFolder(app, FORGE_ATLAS_NATIVE_TEMPLATE_FOLDER);
  try {
    await app.vault.create(path, nativeText);
    return { atlasTemplateId, sourceTemplateId, path, created: true };
  } catch (error) {
    // Vault.create() can report "File already exists" when another caller
    // or an earlier Atlas registration created the visible mirror concurrently.
    // Re-check through the adapter instead of relying only on Obsidian's index.
    const racedMirrorPath = await reconcileExistingMirrorAtPath(app, path, sourceTemplateId, nativeText);
    if (racedMirrorPath) {
      return { atlasTemplateId, sourceTemplateId, path: racedMirrorPath, created: false };
    }
    throw error;
  }
}

async function generateUniqueAtlasTemplateId(
  app: App,
  sourceName: string,
  sourceTemplateId: string,
  exceptPath?: string,
): Promise<string> {
  const usedIds = new Set<string>();
  for (const file of app.vault.getFiles()) {
    if (file.extension.toLowerCase() !== ATLAS_NATIVE_TEMPLATE_EXTENSION
      || (exceptPath && sameVaultPath(file.path, exceptPath))) continue;
    const id = templateIdFromText(await app.vault.cachedRead(file));
    if (id) usedIds.add(id.toLocaleLowerCase());
  }

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const candidate = newTemplateId(attempt === 0 ? `${sourceName}-atlas-role` : `${sourceName}-atlas-role-${attempt + 1}`);
    const normalized = candidate.toLocaleLowerCase();
    if (normalized !== sourceTemplateId.toLocaleLowerCase() && !usedIds.has(normalized)) return candidate;
  }
  throw new Error('Não foi possível gerar um ID Atlas exclusivo para o espelho de Role. Nenhum template foi alterado.');
}

/**
 * Keeps the Atlas template library in sync with saved Forge templates.
 * Atlas listens for `.atlastemplate` Vault events itself, so creating or
 * modifying the mirror is sufficient to refresh its native Role selector.
 */
export class AtlasNativeRoleTemplateSync {
  private readonly eventStops: Array<() => void> = [];
  private started = false;
  private readonly app: App;
  private readonly onMirrorSynced?: () => void;

  constructor(app: App, onMirrorSynced?: () => void) {
    this.app = app;
    this.onMirrorSynced = onMirrorSynced;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    const onTemplate = (file: unknown): Promise<void> | undefined => {
      if (!this.started || !isForgeTemplateFileLike(file)) return undefined;
      return this.syncFile(file);
    };
    for (const event of ['create', 'modify', 'rename'] as const) {
      const ref = this.app.vault.on(event, onTemplate);
      this.eventStops.push(() => this.app.vault.offref(ref));
    }
    this.app.workspace.onLayoutReady(() => {
      if (this.started) return this.syncExisting();
      return undefined;
    });
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    for (const stop of this.eventStops.splice(0)) stop();
  }

  async syncExisting(): Promise<{ scanned: number; synced: number; failed: Array<{ path: string; message: string }> }> {
    const files = this.app.vault.getFiles().filter(isForgeTemplateFileLike);
    const result = { scanned: files.length, synced: 0, failed: [] as Array<{ path: string; message: string }> };
    for (const file of files) {
      try {
        await ensureAtlasNativeTemplateMirror(this.app, file);
        result.synced += 1;
      } catch (error) {
        result.failed.push({ path: file.path, message: error instanceof Error ? error.message : String(error) });
      }
    }
    if (result.failed.length > 0) {
      console.error('[Statblock Forge] Some templates could not be registered in Atlas Roles:', result.failed);
    }
    if (result.synced > 0) this.onMirrorSynced?.();
    return result;
  }

  private async syncFile(file: TFile): Promise<void> {
    try {
      await ensureAtlasNativeTemplateMirror(this.app, file);
      this.onMirrorSynced?.();
    } catch (error) {
      console.error(`[Statblock Forge] Could not register "${file.path}" in Atlas Roles:`, error);
    }
  }
}

function isForgeTemplateFileLike(value: unknown): value is TFile {
  return isRecord(value)
    && typeof value.path === 'string'
    && typeof value.basename === 'string'
    && typeof value.extension === 'string'
    && value.extension.toLowerCase() === 'forgetemplate';
}

/** Whether a note's Atlas template marker references a Forge-owned Atlas Role mirror. */
export function hasForgeAtlasTemplateMarker(frontmatter: unknown, atlasTemplateId: string): boolean {
  return isRecord(frontmatter) && frontmatter['atlas-template'] === atlasTemplateId;
}
