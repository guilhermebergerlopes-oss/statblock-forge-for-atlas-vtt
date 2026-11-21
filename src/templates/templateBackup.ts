/**
 * Safe listing and restoration for Forge template backups.
 * New backups use a versioned envelope with the exact original Vault path and
 * a checksum. Older raw `.forgetemplate.bak` files remain readable; their
 * destination is inferred from the stable Template ID when possible.
 */
import { parseTemplateFileText } from './forgeFileFormat.ts';
import type { TemplateStorage } from './templateRepository.ts';

export const FORGE_TEMPLATE_BACKUP_FORMAT = 'statblock-forge-template-backup';
export const FORGE_TEMPLATE_BACKUP_VERSION = 1;

export interface TemplateBackupFileEntry {
  path: string;
  basename: string;
  size: number;
  mtime: number;
}

export interface TemplateBackupEnvelope {
  format: typeof FORGE_TEMPLATE_BACKUP_FORMAT;
  version: typeof FORGE_TEMPLATE_BACKUP_VERSION;
  createdAt: string;
  originalPath: string;
  originalTemplateId: string | null;
  originalText: string;
  originalSize: number;
  checksum: string;
}

export interface TemplateBackupListItem {
  path: string;
  basename: string;
  size: number;
  mtime: number;
  createdAt: string | null;
  originalPath: string | null;
  targetPath: string | null;
  templateId: string | null;
  templateName: string | null;
  isLegacy: boolean;
  canRestore: boolean;
  targetExists: boolean;
  targetText: string | null;
  /** Exact backup snapshot inspected for this listing; passed back during restore. */
  backupText: string;
  message: string;
}

export interface RestoreTemplateBackupRequest {
  storage: TemplateStorage;
  templateFolder: string;
  backup: TemplateBackupListItem;
  /** Exact snapshot shown to the user; protects against a backup changing after it was listed. */
  expectedBackupText: string;
  /** Exact target snapshot shown to the user, or null when the target did not exist. */
  expectedTargetText: string | null;
  /** Must be true when the target existed when the user confirmed restoration. */
  allowOverwrite: boolean;
  now?: Date;
}

export interface RestoreTemplateBackupResult {
  path: string;
  restoredExisting: boolean;
  safetyBackupPath?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
}

function parentPath(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf('/');
  return index > 0 ? normalized.slice(0, index) : '';
}

function safeForgeTemplatePath(path: string): boolean {
  const normalized = normalizePath(path);
  return normalized.length > 0
    && !normalized.split('/').some((part) => part === '.' || part === '..')
    && normalized.toLowerCase().endsWith('.forgetemplate');
}

/** CRC-32 detects accidental corruption; it is not a security/authenticity signature. */
function crc32(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return `crc32:${((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0')}`;
}

function templateIdentity(text: string): { id: string; name: string } | null {
  try {
    const parsed = parseTemplateFileText(text, 'forgetemplate');
    if (parsed.fileFormat !== 'forge' || parsed.canOverwrite !== true || !parsed.layout) return null;
    return { id: parsed.template.id, name: typeof parsed.template.name === 'string' ? parsed.template.name : parsed.template.id };
  } catch {
    return null;
  }
}

export function createTemplateBackupEnvelope(
  originalPath: string,
  originalText: string,
  createdAt = new Date(),
): TemplateBackupEnvelope {
  let originalTemplateId: string | null = null;
  try {
    const parsed: unknown = JSON.parse(originalText);
    if (isRecord(parsed) && typeof parsed.id === 'string' && parsed.id.trim()) originalTemplateId = parsed.id.trim();
  } catch {
    // A damaged source still receives a byte-for-byte backup, but that backup
    // will be marked non-restorable until its original content is valid.
  }
  return {
    format: FORGE_TEMPLATE_BACKUP_FORMAT,
    version: FORGE_TEMPLATE_BACKUP_VERSION,
    createdAt: createdAt.toISOString(),
    originalPath: normalizePath(originalPath),
    originalTemplateId,
    originalText,
    originalSize: new TextEncoder().encode(originalText).length,
    checksum: crc32(originalText),
  };
}

export function serializeTemplateBackup(envelope: TemplateBackupEnvelope): string {
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

function legacyOriginalName(path: string): string | null {
  const leaf = normalizePath(path).split('/').pop() ?? '';
  const basename = leaf.replace(/\.bak$/i, '');
  const match = /^(.*)-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.forgetemplate$/i.exec(basename);
  return match?.[1] ?? null;
}

function uniqueRestorePath(storage: TemplateStorage, folder: string, baseName: string): string {
  const normalizedFolder = normalizePath(folder);
  const cleaned = baseName.trim().replace(/[\\/:*?"<>|#^[\]]/g, '-').replace(/^\.+/, '') || 'Recovered Template';
  let path = `${normalizedFolder}/${cleaned}.forgetemplate`;
  let suffix = 2;
  while (storage.exists(path)) path = `${normalizedFolder}/${cleaned} (restored ${suffix++}).forgetemplate`;
  return path;
}

interface ParsedBackup {
  originalText: string;
  originalPath: string | null;
  originalTemplateId: string | null;
  createdAt: string | null;
  isLegacy: boolean;
  message: string;
  identity: { id: string; name: string };
}

function parseBackupText(text: string, path: string): ParsedBackup | { error: string } {
  let parsed: unknown;
  try { parsed = JSON.parse(text) as unknown; } catch { parsed = null; }
  if (isRecord(parsed) && parsed.format === FORGE_TEMPLATE_BACKUP_FORMAT) {
    if (parsed.version !== FORGE_TEMPLATE_BACKUP_VERSION
      || typeof parsed.originalText !== 'string'
      || typeof parsed.originalPath !== 'string'
      || typeof parsed.originalTemplateId !== 'string' || !parsed.originalTemplateId.trim()
      || typeof parsed.checksum !== 'string'
      || typeof parsed.originalSize !== 'number'
      || typeof parsed.createdAt !== 'string') {
      return { error: 'O manifesto do backup está incompleto ou usa uma versão incompatível.' };
    }
    if (parsed.checksum !== crc32(parsed.originalText)
      || parsed.originalSize !== new TextEncoder().encode(parsed.originalText).length) {
      return { error: 'O checksum ou o tamanho do conteúdo não corresponde. O backup foi preservado e não pode ser restaurado.' };
    }
    const normalizedOriginalPath = normalizePath(parsed.originalPath);
    if (!safeForgeTemplatePath(normalizedOriginalPath)) return { error: 'O caminho original registrado no backup é inválido.' };
    const identity = templateIdentity(parsed.originalText);
    if (!identity) return { error: 'O conteúdo original não é um `.forgetemplate` íntegro e editável.' };
    if (parsed.originalTemplateId !== identity.id) {
      return { error: 'O ID registrado no backup não corresponde ao ID do Template restaurado.' };
    }
    return {
      originalText: parsed.originalText,
      originalPath: normalizedOriginalPath,
      originalTemplateId: identity.id,
      createdAt: parsed.createdAt,
      isLegacy: false,
      message: 'Backup íntegro; o caminho original foi preservado.',
      identity,
    };
  }

  // Legacy backups are raw `.forgetemplate` bytes. They have no manifest or
  // original directory, so the stable Template ID is used to find the target.
  const identity = templateIdentity(text);
  if (!identity) return { error: 'O backup antigo não contém um `.forgetemplate` íntegro e editável.' };
  const originalName = legacyOriginalName(path);
  return {
    originalText: text,
    originalPath: null,
    originalTemplateId: identity.id,
    createdAt: null,
    isLegacy: true,
    message: originalName
      ? 'Backup antigo sem caminho original; o destino será inferido pelo ID ou recuperado como uma cópia.'
      : 'Backup antigo sem manifesto; o destino será inferido pelo ID do Template.',
    identity,
  };
}

async function resolveBackupTarget(
  storage: TemplateStorage,
  templateFolder: string,
  backupPath: string,
  parsed: ParsedBackup,
): Promise<{ path: string; exists: boolean; text: string | null; blocked: string | null }> {
  const idMatches = (await storage.listTemplateIds()).filter((entry) => entry.id.toLowerCase() === parsed.identity.id.toLowerCase());
  if (parsed.originalPath) {
    const path = parsed.originalPath;
    if (storage.exists(path)) {
      const text = await storage.read(path);
      let currentId: string | null = null;
      try {
        const current = JSON.parse(text) as unknown;
        if (isRecord(current) && typeof current.id === 'string') currentId = current.id;
      } catch { /* damaged target may be restored after explicit confirmation */ }
      if (currentId !== null && currentId.toLowerCase() !== parsed.identity.id.toLowerCase()) {
        return { path, exists: true, text, blocked: 'O caminho original agora pertence a outro Template. A restauração foi bloqueada para evitar substituir um ID diferente.' };
      }
      if (idMatches.some((entry) => normalizePath(entry.path) !== path)) {
        return { path, exists: true, text, blocked: 'Há outro arquivo com o ID deste backup. Resolva a duplicidade antes de restaurar.' };
      }
      return { path, exists: true, text, blocked: null };
    }
    if (idMatches.length === 1) {
      const movedPath = normalizePath(idMatches[0].path);
      return { path: movedPath, exists: true, text: await storage.read(movedPath), blocked: null };
    }
    if (idMatches.length > 1) {
      return { path, exists: false, text: null, blocked: 'Há mais de um Template com este ID. Resolva a duplicidade antes de restaurar o backup.' };
    }
    return { path, exists: false, text: null, blocked: null };
  }

  if (idMatches.length === 1) {
    const path = normalizePath(idMatches[0].path);
    return { path, exists: true, text: await storage.read(path), blocked: null };
  }
  if (idMatches.length > 1) {
    return { path: '', exists: false, text: null, blocked: 'Há mais de um Template com este ID. O backup antigo não pode escolher um destino com segurança.' };
  }
  const base = legacyOriginalName(backupPath) ?? parsed.identity.name;
  const path = uniqueRestorePath(storage, templateFolder, base);
  return { path, exists: false, text: null, blocked: null };
}

export async function listTemplateBackups(
  storage: TemplateStorage,
  templateFolder: string,
): Promise<TemplateBackupListItem[]> {
  const folder = `${normalizePath(templateFolder)}/.statblock-forge/backups`;
  const files = await storage.listBackupFiles(folder);
  const items = await Promise.all(files.map(async (file): Promise<TemplateBackupListItem> => {
    let backupText = '';
    try { backupText = await storage.read(file.path); } catch {
      return {
        ...file, createdAt: null, originalPath: null, targetPath: null, templateId: null, templateName: null,
        isLegacy: false, canRestore: false, targetExists: false, targetText: null, backupText: '',
        message: 'Não foi possível ler este backup.',
      };
    }
    const parsed = parseBackupText(backupText, file.path);
    if ('error' in parsed) {
      return {
        ...file, createdAt: null, originalPath: null, targetPath: null, templateId: null, templateName: null,
        isLegacy: false, canRestore: false, targetExists: false, targetText: null, backupText, message: parsed.error,
      };
    }
    const target = await resolveBackupTarget(storage, templateFolder, file.path, parsed);
    return {
      ...file,
      createdAt: parsed.createdAt,
      originalPath: parsed.originalPath,
      targetPath: target.path || null,
      templateId: parsed.identity.id,
      templateName: parsed.identity.name,
      isLegacy: parsed.isLegacy,
      canRestore: target.blocked === null,
      targetExists: target.exists,
      targetText: target.text,
      backupText,
      message: target.blocked ?? parsed.message,
    };
  }));
  return items.sort((left, right) => (right.createdAt ?? new Date(right.mtime).toISOString()).localeCompare(left.createdAt ?? new Date(left.mtime).toISOString()));
}

function backupLeafName(originalPath: string, createdAt: Date): string {
  const leaf = normalizePath(originalPath).split('/').pop() ?? 'Template.forgetemplate';
  const stem = leaf.replace(/\.forgetemplate$/i, '') || 'Template';
  const stamp = createdAt.toISOString().replace(/[:.]/g, '-');
  return `${stem}-${stamp}.forgetemplate.bak`;
}

async function createSafetyBackup(
  storage: TemplateStorage,
  templateFolder: string,
  originalPath: string,
  originalText: string,
  now: Date,
): Promise<string> {
  const folder = `${normalizePath(templateFolder)}/.statblock-forge/backups`;
  await storage.ensureFolder(folder);
  const leaf = backupLeafName(originalPath, now);
  const stem = leaf.replace(/\.forgetemplate\.bak$/i, '');
  let path = `${folder}/${leaf}`;
  let suffix = 2;
  while (storage.exists(path)) path = `${folder}/${stem}-${suffix++}.forgetemplate.bak`;
  const envelope: TemplateBackupEnvelope = createTemplateBackupEnvelope(originalPath, originalText, now);
  await storage.create(path, serializeTemplateBackup(envelope));
  return path;
}

export async function restoreTemplateBackup(request: RestoreTemplateBackupRequest): Promise<RestoreTemplateBackupResult> {
  const { storage, backup } = request;
  if (!backup.canRestore || !backup.targetPath) throw new Error(backup.message || 'Este backup não pode ser restaurado.');
  if (!safeForgeTemplatePath(backup.targetPath)) throw new Error('O destino de restauração é inválido.');
  if (!storage.exists(backup.path)) throw new Error('O arquivo de backup não existe mais.');
  const currentBackupText = await storage.read(backup.path);
  if (currentBackupText !== request.expectedBackupText) throw new Error('O backup mudou depois de ser listado. Atualize a lista antes de restaurar.');
  const parsed = parseBackupText(currentBackupText, backup.path);
  if ('error' in parsed) throw new Error(parsed.error);
  if (parsed.identity.id !== backup.templateId) throw new Error('O ID do backup mudou depois da confirmação.');

  const targetPath = normalizePath(backup.targetPath);
  const targetExistsNow = storage.exists(targetPath);
  if (targetExistsNow !== (request.expectedTargetText !== null)) {
    throw new Error('O destino mudou depois da confirmação. Atualize a lista antes de restaurar.');
  }
  if (targetExistsNow) {
    if (!request.allowOverwrite) throw new Error('A restauração deste backup substituirá um arquivo existente e exige confirmação explícita.');
    const currentText = await storage.read(targetPath);
    if (currentText !== request.expectedTargetText) throw new Error('O Template de destino foi alterado depois da confirmação. A edição recente foi preservada.');
    let currentId: string | null = null;
    try {
      const current = JSON.parse(currentText) as unknown;
      if (isRecord(current) && typeof current.id === 'string') currentId = current.id;
    } catch { /* an explicitly confirmed damaged file can be replaced */ }
    if (currentId && currentId.toLowerCase() !== parsed.identity.id.toLowerCase()) {
      throw new Error('O destino pertence a outro Template. A restauração foi cancelada.');
    }
    const now = request.now ?? new Date();
    const safetyBackupPath = await createSafetyBackup(storage, request.templateFolder, targetPath, currentText, now);
    const write = await storage.compareAndSwap(targetPath, currentText, parsed.originalText);
    if (!write.written) throw new Error('O Template mudou durante a restauração. O backup de segurança foi mantido e a edição concorrente não foi sobrescrita.');
    return { path: targetPath, restoredExisting: true, safetyBackupPath };
  }

  const collisions = (await storage.listTemplateIds()).filter((entry) => entry.id.toLowerCase() === parsed.identity.id.toLowerCase());
  if (collisions.length > 0) throw new Error('Já existe outro Template com o ID deste backup. A restauração foi cancelada para evitar IDs duplicados.');
  await storage.ensureFolder(parentPath(targetPath));
  await storage.create(targetPath, parsed.originalText);
  return { path: targetPath, restoredExisting: false };
}
