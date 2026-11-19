import { TFile, type App } from 'obsidian';
import { headerFieldForPart, newTemplateId, type ForgeLayoutDocument, type ForgeTemplate, type JsonRecord } from '../templates/forgeTemplate.ts';
import { parseTemplateFileText, serializeAtlasTemplateFile } from '../templates/forgeFileFormat.ts';
import { slugify } from '../templates/forgeTemplate.ts';
import { applyAtlasStatblockMetadata, serializeAtlasStatblockNote, validateAtlasStatblockPublish } from './atlasStatblockFormat.ts';
import { createForgeStatblockTemplateLink, forgeStatblockTemplateLinkFromFrontmatter } from '../statblocks/forgeTemplateLink.ts';
import { planAtlasTemplateExport } from './atlasTemplateLifecycle.ts';
import { analyzeAtlasTemplateCompatibility, applyForgeCounterProjectionToFrontmatter } from './atlasTemplateAdapter.ts';

export interface PublishAtlasStatblockRequest {
  app: App;
  template: ForgeTemplate;
  /** Forge layout metadata used to export Total Hidden blocks as Hidden from players in the published Atlas copy. */
  layout?: ForgeLayoutDocument;
  data: JsonRecord;
  templateFolder: string;
  statblockFolder: string;
  fallbackName: string;
  /** Original Markdown source is upgraded in place to avoid maintaining a duplicate statblock note. */
  sourceFile?: TFile | null;
  /** Selected .forgetemplate path, or an Atlas template with a matching Forge source. */
  templateSourcePath?: string | null;
}

export interface PublishAtlasStatblockResult {
  statblockFile: TFile;
  atlasTemplateFile: TFile;
  warnings: string[];
  createdTemplateCopy: boolean;
  updatedExistingNote: boolean;
}

function cleanFolder(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
}

async function ensureFolder(app: App, path: string): Promise<void> {
  const normalized = cleanFolder(path);
  if (!normalized) return;
  let current = '';
  for (const segment of normalized.split('/')) {
    current = current ? `${current}/${segment}` : segment;
    if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
  }
}

function uniquePath(app: App, folder: string, basename: string, extension: string): string {
  const base = `${cleanFolder(folder)}/${slugify(basename)}`;
  let candidate = `${base}.${extension}`;
  let suffix = 2;
  while (app.vault.getAbstractFileByPath(candidate)) candidate = `${base}-${suffix++}.${extension}`;
  return candidate;
}

async function newUniqueTemplateIdInVault(app: App, name: string): Promise<string> {
  const used = new Set<string>();
  const files = app.vault.getFiles().filter((file) => ['forgetemplate', 'atlastemplate'].includes(file.extension.toLowerCase()));
  for (const file of files) {
    try {
      const parsed: unknown = JSON.parse(await app.vault.cachedRead(file));
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        && (parsed as Record<string, unknown>).format === 'atlas-statblock-template') {
        const id = (parsed as Record<string, unknown>).id;
        if (typeof id === 'string' && id.trim()) used.add(id.trim().toLowerCase());
      }
    } catch {
      // Invalid templates have no trustworthy ID to reserve.
    }
  }
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const candidate = newTemplateId(attempt === 0 ? name : `${name}-${attempt + 1}`);
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  throw new Error('Não foi possível gerar um ID exclusivo para o template Atlas.');
}

async function assertTemplateIdUnusedInVault(app: App, templateId: string): Promise<void> {
  const candidates = app.vault.getFiles().filter((file) => ['forgetemplate', 'atlastemplate'].includes(file.extension.toLowerCase()));
  for (const file of candidates) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await app.vault.cachedRead(file));
    } catch {
      // Invalid templates have no trustworthy ID to reserve.
      continue;
    }
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      && (parsed as Record<string, unknown>).format === 'atlas-statblock-template') {
      const id = (parsed as Record<string, unknown>).id;
      if (typeof id === 'string' && id.trim().toLowerCase() === templateId.toLowerCase()) {
        throw new Error(`O ID de template "${templateId}" já está em uso por "${file.path}". A publicação foi cancelada para evitar uma associação ambígua.`);
      }
    }
  }
}

async function findAtlasTemplatesById(app: App, templateId: string): Promise<TFile[]> {
  const matches: TFile[] = [];
  const candidates = app.vault.getFiles().filter((file) => file.extension.toLowerCase() === 'atlastemplate');
  for (const file of candidates) {
    try {
      const parsed: unknown = JSON.parse(await app.vault.cachedRead(file));
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        && (parsed as Record<string, unknown>).format === 'atlas-statblock-template'
        && (parsed as Record<string, unknown>).id === templateId) matches.push(file);
    } catch {
      // Invalid or unreadable templates do not block publishing a clean copy.
    }
  }
  return matches;
}


async function findForgeTemplatePath(app: App, templateId: string, preferredPath?: string | null): Promise<string | null> {
  const check = async (file: TFile): Promise<boolean> => {
    if (file.extension.toLowerCase() !== 'forgetemplate') return false;
    try {
      const parsed = parseTemplateFileText(await app.vault.cachedRead(file), file.extension);
      return parsed.template.id === templateId && parsed.fileFormat === 'forge';
    } catch {
      return false;
    }
  };

  if (preferredPath) {
    const preferred = app.vault.getAbstractFileByPath(preferredPath);
    if (preferred instanceof TFile && await check(preferred)) return preferred.path;
  }

  const candidates = app.vault.getFiles().filter((file) => file.extension.toLowerCase() === 'forgetemplate');
  const matches: TFile[] = [];
  for (const file of candidates) if (await check(file)) matches.push(file);
  return matches.length === 1 ? matches[0]!.path : null;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Publish a Forge-rendered record as a Markdown note Atlas can discover and
 * link to a token. No Atlas runtime service or private asset store is called.
 */
export async function publishAtlasStatblock(request: PublishAtlasStatblockRequest): Promise<PublishAtlasStatblockResult> {
  const { app, template, data } = request;
  const validation = validateAtlasStatblockPublish(template, data);
  if (validation.errors.length > 0) throw new Error(validation.errors.join(' '));
  const templateFolder = cleanFolder(request.templateFolder);
  const statblockFolder = cleanFolder(request.statblockFolder);
  const updateSourceNote = request.sourceFile instanceof TFile && request.sourceFile.extension.toLowerCase() === 'md';
  if (!templateFolder) throw new Error('Configure uma pasta para os templates Atlas antes de publicar.');
  if (!updateSourceNote && !statblockFolder) throw new Error('Configure uma pasta para as notas de statblock antes de publicar.');

  const compatibility = analyzeAtlasTemplateCompatibility(template);
  const warnings = [
    ...validation.warnings,
    ...compatibility.issues.filter((issue) => issue.severity === 'warning').map((issue) => issue.message),
  ];
  const sourceFrontmatter = updateSourceNote && request.sourceFile
    ? app.metadataCache.getFileCache(request.sourceFile)?.frontmatter
    : undefined;
  const previousLink = forgeStatblockTemplateLinkFromFrontmatter(sourceFrontmatter);
  const linkedAtlasTemplateId = previousLink?.atlasTemplateId
    && previousLink.templateId === template.id
    && sourceFrontmatter?.['atlas-template'] === previousLink.atlasTemplateId
    ? previousLink.atlasTemplateId
    : null;
  const preferredAtlasId = linkedAtlasTemplateId ?? template.id;
  const matchingTemplates = await findAtlasTemplatesById(app, preferredAtlasId);
  const desiredAtlasModel: ForgeTemplate = { ...template, id: preferredAtlasId };
  const desiredNative = JSON.parse(serializeAtlasTemplateFile(desiredAtlasModel, request.layout)) as unknown;
  const existingExports = await Promise.all(matchingTemplates.map(async (file) => {
    const currentNative = JSON.parse(await app.vault.cachedRead(file)) as unknown;
    return {
      id: preferredAtlasId,
      matchesCurrentContent: canonicalJson(currentNative) === canonicalJson(desiredNative),
    };
  }));
  const exportPlan = planAtlasTemplateExport({
    forgeTemplateId: template.id,
    linkedAtlasTemplateId,
    existingExports,
    replacementId: await newUniqueTemplateIdInVault(app, `${template.id}-atlas`),
  });
  let atlasTemplateModel: ForgeTemplate = { ...template, id: exportPlan.atlasTemplateId };
  let atlasTemplateFile: TFile | null = null;
  let createdTemplateCopy = false;

  if (exportPlan.action === 'reuse') {
    atlasTemplateFile = matchingTemplates[0]!;
  } else {
    if (exportPlan.warning) warnings.push(exportPlan.warning);
    await ensureFolder(app, templateFolder);
    const templatePath = uniquePath(app, templateFolder, atlasTemplateModel.id, 'atlastemplate');
    await assertTemplateIdUnusedInVault(app, atlasTemplateModel.id);
    atlasTemplateFile = await app.vault.create(templatePath, serializeAtlasTemplateFile(atlasTemplateModel, request.layout));
    createdTemplateCopy = true;
  }

  const forgeTemplatePath = await findForgeTemplatePath(app, template.id, request.templateSourcePath);
  const forgeLink = forgeTemplatePath ? createForgeStatblockTemplateLink({
    templatePath: forgeTemplatePath,
    templateId: template.id,
    atlasTemplateId: atlasTemplateModel.id,
  }) : null;
  if (!forgeLink) warnings.push('Nenhum .forgetemplate de origem inequívoca foi encontrado. A nota ainda será compatível com Atlas, mas não terá atalho para reabrir o template Forge.');

  const nameField = headerFieldForPart(template.fields, 'name');
  const rawName = nameField ? data[nameField.key] : undefined;
  const displayName = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : request.fallbackName.trim() || 'New Statblock';

  try {
    let statblockFile: TFile;
    let updatedExistingNote = false;
    const sourceFile = request.sourceFile;
    if (updateSourceNote && sourceFile) {
      // Keep the existing Markdown note as the single source of statblock values.
      // Only Atlas markers and the Forge-template backlink are changed. Its body
      // and every existing creature field are left untouched.
      await app.fileManager.processFrontMatter(sourceFile, (frontmatter) => {
        // Keep one source note: convert Forge-only per-entry Counter marks to
        // the reversible text projection Atlas knows how to display.
        applyForgeCounterProjectionToFrontmatter(template, frontmatter as JsonRecord);
        applyAtlasStatblockMetadata(frontmatter as JsonRecord, atlasTemplateModel.id, forgeLink, nameField?.key ?? 'name', displayName);
      });
      statblockFile = sourceFile;
      updatedExistingNote = true;
    } else {
      await ensureFolder(app, statblockFolder);
      const notePath = uniquePath(app, statblockFolder, displayName, 'md');
      const noteText = serializeAtlasStatblockNote(atlasTemplateModel, data, displayName, forgeLink);
      statblockFile = await app.vault.create(notePath, noteText);
    }
    if (!atlasTemplateFile) throw new Error('Atlas template publication did not produce a file.');
    return {
      statblockFile,
      atlasTemplateFile,
      warnings: [
        ...warnings,
        updatedExistingNote
          ? 'A nota Markdown original foi atualizada no próprio lugar. O YAML existente continua sendo a única fonte dos valores do statblock.'
          : 'A nota Markdown criada passa a ser a fonte única dos valores compartilhados por Forge e Atlas; o JSON de origem permanece apenas como arquivo de importação.',
        'O Atlas usa o layout nativo do arquivo .atlastemplate. Grid Dense, dimensões físicas e aparência exclusivos do Forge permanecem no .forgetemplate e não são aplicados pelo renderizador do Atlas.',
      ],
      createdTemplateCopy,
      updatedExistingNote,
    };
  } catch (error) {
    // If this publish created a new Atlas template but could not create its note,
    // remove only that newly-created copy. Never remove an existing template.
    if (createdTemplateCopy && atlasTemplateFile) {
      try { await app.fileManager.trashFile(atlasTemplateFile); } catch { /* Preserve the original publish error. */ }
    }
    throw error;
  }
}
