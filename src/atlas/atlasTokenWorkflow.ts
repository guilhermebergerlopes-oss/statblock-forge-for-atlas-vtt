import type { App, TFile } from 'obsidian';

/** Atlas command documented for creating and linking a token from the active statblock note. */
export const ATLAS_CREATE_TOKEN_FROM_STATBLOCK_COMMAND = 'atlas-vtt:create-token-from-statblock';

const IMAGE_FRONTMATTER_KEYS = ['image', 'token', 'token-image'] as const;
// Mirrors the exact image extensions accepted by the supplied Atlas importer.
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'avif']);

interface ObsidianCommandDescriptor {
  id: string;
  name?: string;
}

/**
 * Obsidian's command manager is not part of the stable typed plugin API in
 * every supported Obsidian version. Treat it as an optional bridge. When it
 * is unavailable, the user can still run Atlas' documented command manually.
 */
interface OptionalCommandManager {
  listCommands?: () => ObsidianCommandDescriptor[];
  executeCommandById?: (commandId: string) => boolean | void;
}

interface AppWithOptionalCommands extends App {
  commands?: OptionalCommandManager;
}

export type AtlasImageReference =
  | { kind: 'empty' }
  | { kind: 'remote'; reference: string }
  | { kind: 'vault'; path: string };

export type AtlasTokenCreationAssessment =
  | { status: 'ready'; imagePath: string; commandAccess: 'direct' | 'manual'; commandName: string }
  | { status: 'not-statblock'; message: string }
  | { status: 'missing-image'; message: string }
  | { status: 'remote-image'; reference: string; message: string }
  | { status: 'image-not-found'; reference: string; message: string }
  | { status: 'unsupported-image'; reference: string; message: string }
  | { status: 'atlas-command-unavailable'; message: string };

export type AtlasCommandDispatchResult =
  | { status: 'dispatched' }
  | { status: 'command-unavailable' }
  | { status: 'dispatch-unavailable' }
  | { status: 'rejected' }
  | { status: 'failed'; message: string };

function firstString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item);
      if (found) return found;
    }
  }
  return null;
}

function decodePath(value: string): string {
  // Atlas uses decodeURI for encoded Markdown link payloads.
  try { return decodeURI(value); } catch { return value; }
}

/**
 * Accepts the path forms Atlas reads from statblock frontmatter, including
 * Obsidian wikilinks and Markdown image syntax. Remote URLs are distinguished
 * because Atlas' automatic token importer requires an image file in the Vault.
 */
export function normalizeAtlasImageReference(value: unknown): AtlasImageReference {
  const raw = firstString(value);
  if (!raw) return { kind: 'empty' };

  let target = raw.trim();

  // Atlas/Fantasy Statblocks can encode Obsidian links in frontmatter.
  const encoded = /^<STATBLOCK-(WIKI|MARKDOWN)-LINK>([\s\S]+?)<STATBLOCK-\1-LINK>$/.exec(target);
  if (encoded?.[2]) {
    target = (encoded[2].split('|')[0] ?? encoded[2]).trim();
    if (encoded[1] === 'MARKDOWN') target = decodePath(target);
  }

  const markdownImage = /^!?(?:\[[^\]]*\])\((.+)\)$/.exec(target);
  if (markdownImage?.[1]) target = markdownImage[1].trim();

  if (/^(?:https?:)?\/\//i.test(target) || /^data:image\//i.test(target)) {
    return { kind: 'remote', reference: target };
  }

  if (target.startsWith('![[ ') || target.startsWith('[[') || target.startsWith('![[')) {
    target = target.replace(/^!?(?:\[\[)/, '').replace(/\]\]$/, '');
  }
  target = target.split('|')[0]?.trim() ?? '';
  target = target.split('#')[0]?.trim() ?? '';
  target = decodePath(target).replace(/^\/+/, '');
  return target ? { kind: 'vault', path: target } : { kind: 'empty' };
}

function isFileLike(value: unknown): value is TFile {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.path === 'string' && typeof record.extension === 'string';
}

function isNativeAtlasStatblock(frontmatter: Record<string, unknown>): boolean {
  // Mirrors Atlas' hasBestiaryFrontmatter(): inline notes do not require
  // an atlas-template property to be eligible for token creation.
  const marker = frontmatter.statblock;
  return marker === true || marker === 'true' || marker === 'inline';
}

function commandManager(app: App): OptionalCommandManager | null {
  const manager = (app as AppWithOptionalCommands).commands;
  return manager && typeof manager === 'object' ? manager : null;
}

function atlasCommandIsRegistered(manager: OptionalCommandManager): boolean | null {
  if (typeof manager.listCommands !== 'function') return null;
  try {
    const commands = manager.listCommands.call(manager);
    if (!Array.isArray(commands)) return null;
    return commands.some((command) => command?.id === ATLAS_CREATE_TOKEN_FROM_STATBLOCK_COMMAND);
  } catch {
    return null;
  }
}

/**
 * Checks whether a published native Atlas note can create a linked token.
 * `fallbackValues` is used immediately after Forge publishes a new note, before
 * Obsidian's metadata cache has necessarily indexed the just-created file.
 */
export function assessAtlasTokenCreation(
  app: App,
  note: TFile,
  fallbackValues: Record<string, unknown> = {},
  assumePublished = false,
): AtlasTokenCreationAssessment {
  if (note.extension.toLowerCase() !== 'md') {
    return { status: 'not-statblock', message: 'O Atlas cria tokens a partir de notas Markdown, não de arquivos JSON.' };
  }

  const cachedFrontmatter = app.metadataCache.getFileCache(note)?.frontmatter as Record<string, unknown> | undefined;
  const frontmatter: Record<string, unknown> = { ...fallbackValues, ...(cachedFrontmatter ?? {}) };
  if (!assumePublished && !isNativeAtlasStatblock(frontmatter)) {
    return { status: 'not-statblock', message: 'Publique esta nota como statblock Atlas antes de criar um token.' };
  }

  const reference = normalizeAtlasImageReference(
    IMAGE_FRONTMATTER_KEYS.map((key) => frontmatter[key]).find((value) => firstString(value) !== null),
  );
  if (reference.kind === 'empty') {
    return { status: 'missing-image', message: 'Adicione uma imagem local ao campo image do statblock para criar um token automaticamente.' };
  }
  if (reference.kind === 'remote') {
    return {
      status: 'remote-image',
      reference: reference.reference,
      message: 'A imagem é remota. O Atlas só cria automaticamente tokens a partir de imagens salvas no Vault; use um token existente ou salve a imagem localmente.',
    };
  }

  const linked = app.metadataCache.getFirstLinkpathDest(reference.path, note.path)
    ?? app.vault.getAbstractFileByPath(reference.path);
  if (!isFileLike(linked)) {
    return {
      status: 'image-not-found',
      reference: reference.path,
      message: `A imagem ${reference.path} não foi encontrada no Vault. Corrija o campo image antes de criar o token.`,
    };
  }
  if (!IMAGE_EXTENSIONS.has(linked.extension.toLowerCase())) {
    return {
      status: 'unsupported-image',
      reference: reference.path,
      message: `O arquivo ${reference.path} não parece ser uma imagem compatível com tokens.`,
    };
  }

  const manager = commandManager(app);
  const registered = manager ? atlasCommandIsRegistered(manager) : null;
  if (registered === false) {
    return {
      status: 'atlas-command-unavailable',
      message: 'O comando do Atlas não está registrado. Confira se o Atlas VTT está habilitado; também é possível usar Link Statblock em um token existente.',
    };
  }

  return {
    status: 'ready',
    imagePath: linked.path,
    commandAccess: manager && registered === true && typeof manager.executeCommandById === 'function' ? 'direct' : 'manual',
    commandName: 'Atlas VTT: Create token from statblock image',
  };
}

/** Dispatches only Atlas' user-facing command; it never calls Atlas services or stores directly. */
export function dispatchAtlasCreateTokenCommand(app: App): AtlasCommandDispatchResult {
  const manager = commandManager(app);
  if (!manager) return { status: 'dispatch-unavailable' };
  const registered = atlasCommandIsRegistered(manager);
  if (registered === false) return { status: 'command-unavailable' };
  if (registered === null || typeof manager.executeCommandById !== 'function') {
    return { status: 'dispatch-unavailable' };
  }
  try {
    const result = manager.executeCommandById.call(manager, ATLAS_CREATE_TOKEN_FROM_STATBLOCK_COMMAND);
    return result === false ? { status: 'rejected' } : { status: 'dispatched' };
  } catch (error) {
    return { status: 'failed', message: error instanceof Error ? error.message : String(error) };
  }
}
