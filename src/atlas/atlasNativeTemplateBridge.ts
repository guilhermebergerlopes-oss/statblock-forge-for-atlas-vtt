import type { App, TFile } from 'obsidian';
import { parseTemplateFileText } from '../templates/forgeFileFormat.ts';
import { cloneJson, isRecord, type ForgeTemplate } from '../templates/forgeTemplate.ts';
import { ensureVaultFolder, VaultFolderPathConflictError } from '../utils/vaultFolders.ts';

/** Atlas' TemplateLibrary discovers native templates by this extension, anywhere in the Vault. */
export const ATLAS_NATIVE_TEMPLATE_EXTENSION = 'atlastemplate';
export const FORGE_ATLAS_NATIVE_TEMPLATE_FOLDER = 'atlas-vtt/statblock-templates/Forge Mirrors';
export const LEGACY_FORGE_ATLAS_NATIVE_TEMPLATE_FOLDER = '.statblock-forge/atlas-native-templates';

export interface AtlasNativeTemplateMirror {
  readonly templateId: string;
  readonly path: string;
  readonly created: boolean;
}

function cleanPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
}

function mirrorPath(templateId: string, sourceBasename: string): string {
  const safeBasename = sourceBasename.trim().replace(/[\\/:*?"<>|#^[\]]/g, '-').replace(/^\.+/, '').trim() || 'Forge Template';
  const shortId = templateId.slice(-6) || templateId;
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

async function ensureFolder(app: App, path: string): Promise<void> {
  try {
    await ensureVaultFolder(app.vault, path);
  } catch (error) {
    if (error instanceof VaultFolderPathConflictError) {
      throw new Error(`Não foi possível criar o espelho de multiplayer do Atlas: "${error.path}" é um arquivo.`);
    }
    throw error;
  }
}

function nativeTemplateJson(template: ForgeTemplate): string {
  const native = cloneJson(template) as Record<string, unknown>;
  delete native.statblockForge;

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
 * it when its embedded Template id proves that it belongs to this Forge
 * mirror. Never replace an unrelated file just because the path collides.
 */
async function reconcileExistingMirrorAtPath(
  app: App,
  path: string,
  templateId: string,
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
      throw new Error(`O caminho reservado para o espelho multiplayer está ocupado: "${resolvedIndexed.path}".`);
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

  const existingId = templateIdFromText(existingText);
  if (existingId !== templateId) {
    throw new Error(`O caminho reservado para o espelho multiplayer já contém outro arquivo ou Template: "${resolvedPath}".`);
  }
  if (existingText !== nativeText) await writeExisting(nativeText);
  return resolvedPath;
}

/**
 * Makes a Forge template visible to Atlas' native multiplayer BookShare.
 * The mirror intentionally uses the same template id as its Forge source:
 * Forge ids already follow Atlas' vault-template id format and are unique
 * across Forge templates. Atlas continues to own player identity, access,
 * validation, conflict checks and persistence.
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

  const operation = ensureAtlasNativeTemplateMirrorOnce(app, templateFile).finally(() => {
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
    throw new Error('O espelho multiplayer precisa partir de um arquivo .forgetemplate.');
  }
  const sourceText = await app.vault.cachedRead(templateFile);
  const parsed = parseTemplateFileText(sourceText, templateFile.extension);
  if (parsed.fileFormat !== 'forge' || !parsed.template.id) {
    throw new Error('O template Forge não pôde ser convertido para o formato nativo do Atlas.');
  }

  const path = mirrorPath(parsed.template.id, templateFile.basename);
  const nativeText = nativeTemplateJson(parsed.template);

  // Never overwrite an unrelated Atlas template which happens to claim the
  // same id. A Forge template normally has a fresh id; this guard protects
  // imported or manually edited files from taking over somebody else's sheet.
  for (const candidate of app.vault.getFiles()) {
    if (candidate.extension.toLowerCase() !== ATLAS_NATIVE_TEMPLATE_EXTENSION
      || sameVaultPath(candidate.path, path)
      || isLegacyPrivateMirrorPath(candidate.path)) continue;
    const candidateText = await app.vault.cachedRead(candidate);
    const candidateId = templateIdFromText(candidateText);
    if (candidateId === parsed.template.id) {
      if (candidateText === nativeText) {
        return { templateId: parsed.template.id, path: candidate.path, created: false };
      }
      throw new Error(`O ID "${parsed.template.id}" já pertence ao template Atlas "${candidate.path}". Salve o template Forge como uma cópia para gerar um ID exclusivo antes de ativar o multiplayer.`);
    }
  }

  // First inspect both the Obsidian index and the adapter. This also reuses
  // mirrors created by an earlier version or by another concurrent writer.
  const existingMirrorPath = await reconcileExistingMirrorAtPath(app, path, parsed.template.id, nativeText);
  if (existingMirrorPath) {
    return { templateId: parsed.template.id, path: existingMirrorPath, created: false };
  }

  await ensureFolder(app, FORGE_ATLAS_NATIVE_TEMPLATE_FOLDER);
  try {
    await app.vault.create(path, nativeText);
    return { templateId: parsed.template.id, path, created: true };
  } catch (error) {
    // Vault.create() can report "File already exists" when another caller
    // or an earlier Atlas registration created the visible mirror concurrently.
    // Re-check through the adapter instead of relying only on Obsidian's index.
    const racedMirrorPath = await reconcileExistingMirrorAtPath(app, path, parsed.template.id, nativeText);
    if (racedMirrorPath) {
      return { templateId: parsed.template.id, path: racedMirrorPath, created: false };
    }
    throw error;
  }
}

/** Whether a note's Atlas template marker is the Forge template's native mirror. */
export function hasForgeAtlasTemplateMarker(frontmatter: unknown, templateId: string): boolean {
  return isRecord(frontmatter) && frontmatter['atlas-template'] === templateId;
}
