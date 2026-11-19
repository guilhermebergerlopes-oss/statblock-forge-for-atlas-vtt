/**
 * Vault-agnostic persistence for native Atlas templates and Forge sidecars.
 * The repository is intentionally expressed as a tiny storage interface so
 * creation, backups, conflict handling, and optimistic concurrency can be
 * tested without loading Obsidian or the Atlas plugin.
 */
import {
  cloneJson,
  createBlankTemplate,
  createForgeLayout,
  newTemplateId,
  isRecord,
  serializeForgeLayout,
  slugify,
  type ForgeLayoutDocument,
  type ForgeTemplate,
} from './forgeTemplate.ts';
import { isForgeTemplatePath, serializeAtlasTemplateFile, serializeForgeTemplateFile } from './forgeFileFormat.ts';
import { analyzeAtlasTemplateCompatibility, type AtlasTemplateCompatibilityReport } from '../atlas/atlasTemplateAdapter.ts';

export interface TemplateFileReference {
  path: string;
  basename: string;
}

export interface TemplateStorage {
  exists(path: string): boolean;
  read(path: string): Promise<string>;
  create(path: string, contents: string): Promise<TemplateFileReference>;
  modify(path: string, contents: string): Promise<void>;
  /** Atomically writes only while the file still contains `expectedText`, like Atlas writeTemplateText. */
  compareAndSwap(path: string, expectedText: string, contents: string): Promise<{ written: boolean; currentText: string }>;
  rename(path: string, newPath: string): Promise<TemplateFileReference>;
  ensureFolder(path: string): Promise<void>;
  /** Read IDs from every native/Forge template in the Vault for collision-safe creation. */
  listTemplateIds(): Promise<Array<{ path: string; id: string }>>;
}

export interface SaveTemplateRequest {
  storage: TemplateStorage;
  templateFolder: string;
  name: string;
  template: ForgeTemplate;
  layout: ForgeLayoutDocument;
  sourcePath?: string | null;
  originalText?: string | null;
  saveAsCopy?: boolean;
  /** Permit a unique suffix instead of prompting when the initial-name flow creates a blank template. */
  allowUniqueNameOnConflict?: boolean;
  /** Exact existing Forge path explicitly approved by the user for replacement. */
  overwriteExistingPath?: string | null;
  /** Snapshot read when the overwrite confirmation was shown; protects against stale confirmation. */
  expectedOverwriteText?: string | null;
  now?: Date;
}

export interface SaveTemplateResult {
  file: TemplateFileReference;
  template: ForgeTemplate;
  layout: ForgeLayoutDocument;
  serializedTemplate: string;
  backupPath?: string;
  sidecarPath?: string;
  sidecarWarning?: string;
  createdCopy: boolean;
  overwrittenExisting?: boolean;
  /** A Save collision wrote to the approved destination without deleting the open source file. */
  sourcePreserved?: boolean;
}

export class TemplateConflictError extends Error {
  constructor(message = 'O arquivo foi alterado fora do Forge desde que foi aberto. Reabra-o para evitar sobrescrever mudanças recentes.') {
    super(message);
    this.name = 'TemplateConflictError';
  }
}

/** A same-name Forge template exists and requires an explicit user decision. */
export class TemplateNameConflictError extends Error {
  readonly path: string;
  readonly existingText: string;

  constructor(
    path: string,
    existingText: string,
    message = 'Já existe um template com este nome. Confirme se deseja substituí-lo.',
  ) {
    super(message);
    this.name = 'TemplateNameConflictError';
    this.path = path;
    this.existingText = existingText;
  }
}

export interface TemplateOverwriteConfirmation {
  overwriteExistingPath: string;
  expectedOverwriteText: string;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
}

function parentPath(path: string): string {
  const normalized = normalizePath(path);
  const slash = normalized.lastIndexOf('/');
  return slash > 0 ? normalized.slice(0, slash) : '';
}

function fileBaseName(path: string): string {
  const name = normalizePath(path).split('/').pop() ?? path;
  return name.replace(/\.[^.]+$/, '');
}

function templateFileName(name: string): string {
  return name.trim().replace(/[\\/:*?"<>|#^[\]]/g, '-').replace(/^\.+/, '').trim() || 'New Template';
}

function uniquePath(storage: TemplateStorage, folder: string, baseName: string, extension: string): string {
  const normalizedFolder = normalizePath(folder);
  const base = `${normalizedFolder}/${baseName}`;
  let candidate = `${base}${extension}`;
  let suffix = 2;
  while (storage.exists(candidate)) candidate = `${base}-${suffix++}${extension}`;
  return candidate;
}

function uniqueTemplatePath(storage: TemplateStorage, folder: string, baseName: string, extension: string): string {
  const normalizedFolder = normalizePath(folder);
  const base = `${normalizedFolder}/${baseName}`;
  let candidate = `${base}${extension}`;
  let suffix = 2;
  while (storage.exists(candidate)) candidate = `${base} ${suffix++}${extension}`;
  return candidate;
}

function sameTemplateName(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

async function uniqueTemplateId(storage: TemplateStorage, name: string): Promise<string> {
  const existing = await storage.listTemplateIds();
  const used = new Set(existing.map((entry) => entry.id.toLowerCase()));
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    // Vary the human-readable prefix as well as the random suffix so a mocked
    // or unusually repetitive random source cannot trap this loop.
    const candidate = newTemplateId(attempt === 0 ? name : `${name}-${attempt + 1}`);
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  throw new Error('Não foi possível gerar um ID exclusivo para o template. Nenhum arquivo foi alterado.');
}

async function assertTemplateIdAvailable(storage: TemplateStorage, id: string, exceptPath?: string): Promise<void> {
  const conflicts = (await storage.listTemplateIds()).filter((entry) => entry.id.toLowerCase() === id.toLowerCase()
    && normalizePath(entry.path) !== normalizePath(exceptPath ?? ''));
  if (conflicts.length > 0) {
    const paths = conflicts.slice(0, 3).map((entry) => entry.path).join(', ');
    throw new Error(`O ID de template "${id}" já está sendo usado por outro arquivo (${paths}). Salve como uma nova cópia para gerar um ID exclusivo.`);
  }
}

async function writeSidecar(
  storage: TemplateStorage,
  templateFolder: string,
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
): Promise<{ path: string; warning?: string }> {
  const folder = normalizePath(`${templateFolder}/.statblock-forge/layouts`);
  const path = `${folder}/${template.id}.json`;
  try {
    await storage.ensureFolder(folder);
    const contents = serializeForgeLayout(layout);
    if (storage.exists(path)) await storage.modify(path, contents);
    else await storage.create(path, contents);
    return { path };
  } catch (error) {
    return {
      path,
      warning: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Save like Atlas: same name updates; a different name creates a new template and leaves the source intact. */
export async function saveTemplateDocument(request: SaveTemplateRequest): Promise<SaveTemplateResult> {
  const storage = request.storage;
  const templateFolder = normalizePath(request.templateFolder);
  if (!templateFolder) throw new Error('A pasta de templates não pode ficar vazia.');

  const name = request.name.trim() || 'New Template';
  const templateFileStem = templateFileName(name);
  const template = cloneJson(request.template);
  const layout = cloneJson(request.layout);
  const sourcePath = request.sourcePath ? normalizePath(request.sourcePath) : null;
  const sourceNameChanged = sourcePath !== null && !sameTemplateName(fileBaseName(sourcePath), name);
  const isCopy = request.saveAsCopy === true || sourcePath === null || sourceNameChanged;
  const sourceIsForge = sourcePath !== null && isForgeTemplatePath(sourcePath);
  const outputFormat = sourcePath === null || request.saveAsCopy === true || sourceIsForge ? 'forge' : 'atlas';
  const extension = outputFormat === 'forge' ? '.forgetemplate' : '.atlastemplate';
  let file: TemplateFileReference;
  let serializedTemplate: string;
  let backupPath: string | undefined;

  if (!isCopy) {
    if (!sourcePath || request.originalText === null || request.originalText === undefined) {
      throw new Error('O template atual não possui um arquivo de origem válido. Reabra-o antes de salvar.');
    }

    // Keep the identity currently stored in the source, even if an edited JSON
    // draft accidentally changed it. The Atlas session never changes IDs on Update.
    try {
      const sourceDocument: unknown = JSON.parse(request.originalText);
      if (isRecord(sourceDocument) && typeof sourceDocument.id === 'string'
        && /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-z0-9]{6}$/.test(sourceDocument.id)) {
        template.id = sourceDocument.id;
      }
    } catch {
      throw new TemplateConflictError('O arquivo atual não pôde ser validado como o template que foi aberto. Reabra-o antes de salvar.');
    }
    await assertTemplateIdAvailable(storage, template.id, sourcePath);
    layout.templateId = template.id;

    // Atlas uses Vault.process as a compare-and-swap. A separate read followed
    // by modify could overwrite a change made in the gap between those calls.
    serializedTemplate = outputFormat === 'forge'
      ? serializeForgeTemplateFile(template, layout)
      : serializeAtlasTemplateFile(template);
    let writeResult: { written: boolean; currentText: string };
    try {
      writeResult = await storage.compareAndSwap(sourcePath, request.originalText, serializedTemplate);
    } catch {
      throw new TemplateConflictError('O arquivo do template foi excluído ou movido. Reabra-o para evitar salvar sobre uma origem inexistente.');
    }
    if (!writeResult.written) throw new TemplateConflictError();
    file = { path: sourcePath, basename: fileBaseName(sourcePath) };
  } else {
    // A saved-as-new template receives a fresh identity; the original remains
    // untouched so existing statblocks continue to refer to their old source.
    const sourceTemplateId = sourcePath ? template.id : null;
    template.id = await uniqueTemplateId(storage, name);
    if (sourceTemplateId) template.derivedFrom = { templateId: sourceTemplateId };
    layout.templateId = template.id;
    serializedTemplate = outputFormat === 'forge'
      ? serializeForgeTemplateFile(template, layout)
      : serializeAtlasTemplateFile(template);

    const targetFolder = sourcePath ? parentPath(sourcePath) || templateFolder : templateFolder;
    await storage.ensureFolder(targetFolder);
    let path = `${targetFolder}/${templateFileStem}${extension}`;
    let overwrittenExisting = false;

    if (storage.exists(path)) {
      if (request.allowUniqueNameOnConflict) {
        path = uniqueTemplatePath(storage, targetFolder, templateFileStem, extension);
      } else if (request.saveAsCopy === true && request.overwriteExistingPath === path) {
        const currentText = await storage.read(path);
        if (request.expectedOverwriteText === null || request.expectedOverwriteText === undefined
          || currentText !== request.expectedOverwriteText) {
          throw new TemplateConflictError('O template de destino foi alterado depois da confirmação. Confira o arquivo e tente salvar novamente.');
        }
        if (!path.toLowerCase().endsWith('.forgetemplate')) {
          throw new Error('Somente um arquivo .forgetemplate pode ser substituído por esta ação.');
        }
        try {
          const existingDocument: unknown = JSON.parse(currentText);
          if (isRecord(existingDocument) && typeof existingDocument.id === 'string'
            && /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-z0-9]{6}$/.test(existingDocument.id)) {
            template.id = existingDocument.id;
          }
        } catch {
          // An explicitly confirmed damaged file can still be replaced.
        }
        await assertTemplateIdAvailable(storage, template.id, path);
        layout.templateId = template.id;
        serializedTemplate = serializeForgeTemplateFile(template, layout);
        const backupFolder = `${templateFolder}/.statblock-forge/backups`;
        await storage.ensureFolder(backupFolder);
        const stamp = (request.now ?? new Date()).toISOString().replace(/[:.]/g, '-');
        backupPath = uniquePath(storage, backupFolder, `${fileBaseName(path)}-${stamp}`, '.forgetemplate.bak');
        await storage.create(backupPath, currentText);
        await storage.modify(path, serializedTemplate);
        file = { path, basename: fileBaseName(path) };
        overwrittenExisting = true;
        return {
          file, template, layout, serializedTemplate, backupPath,
          createdCopy: true, overwrittenExisting,
        };
      } else {
        if (sourceNameChanged || request.saveAsCopy !== true) {
          throw new Error(`Já existe um template chamado ${name}. Escolha outro nome.`);
        }
        throw new TemplateNameConflictError(path, await storage.read(path));
      }
    }

    if (request.overwriteExistingPath) {
      throw new TemplateConflictError('O template que você confirmou para substituição não existe mais. O salvamento foi cancelado.');
    }
    // Re-check immediately before creation. This narrows the collision window
    // when two template copies are created almost simultaneously.
    await assertTemplateIdAvailable(storage, template.id);
    file = await storage.create(path, serializedTemplate);
  }

  if (outputFormat === 'atlas') {
    const sidecar = await writeSidecar(storage, templateFolder, template, layout);
    return {
      file, template, layout, serializedTemplate,
      ...(backupPath ? { backupPath } : {}),
      sidecarPath: sidecar.path,
      ...(sidecar.warning ? { sidecarWarning: sidecar.warning } : {}),
      createdCopy: isCopy,
    };
  }

  return {
    file, template, layout, serializedTemplate,
    ...(backupPath ? { backupPath } : {}),
    createdCopy: isCopy,
  };
}

/** Create the first saved version of a native Forge template in its Vault folder. */
export async function createNewForgeTemplateDocument(
  request: { storage: TemplateStorage; templateFolder: string; name?: string },
): Promise<SaveTemplateResult> {
  const name = request.name?.trim() || 'New Template';
  const template = createBlankTemplate(name);
  const layout = createForgeLayout(template);
  return saveTemplateDocument({
    storage: request.storage,
    templateFolder: request.templateFolder,
    name,
    template,
    layout,
    saveAsCopy: true,
    allowUniqueNameOnConflict: true,
  });
}

export interface ExportAtlasTemplateRequest {
  storage: TemplateStorage;
  templateFolder: string;
  name: string;
  template: ForgeTemplate;
  /** Forge layout metadata used to export Total Hidden blocks as Hidden from players in Atlas. */
  layout?: ForgeLayoutDocument;
}

export interface ExportAtlasTemplateResult {
  file: TemplateFileReference;
  serializedTemplate: string;
  compatibilityReport: AtlasTemplateCompatibilityReport;
}

/** Export a Forge template as a clean native Atlas file, without Forge metadata. */
export async function exportAtlasTemplateFile(
  request: ExportAtlasTemplateRequest,
): Promise<ExportAtlasTemplateResult> {
  const folder = normalizePath(request.templateFolder);
  if (!folder) throw new Error('A pasta de exportação do Atlas não pode ficar vazia.');
  await request.storage.ensureFolder(folder);
  const path = uniquePath(request.storage, folder, slugify(request.name.trim() || 'Template'), '.atlastemplate');
  const template = cloneJson(request.template);
  template.id = await uniqueTemplateId(request.storage, request.name.trim() || 'Template');
  const compatibilityReport = analyzeAtlasTemplateCompatibility(template);
  const serializedTemplate = serializeAtlasTemplateFile(template, request.layout);
  await assertTemplateIdAvailable(request.storage, template.id);
  const file = await request.storage.create(path, serializedTemplate);
  return { file, serializedTemplate, compatibilityReport };
}
