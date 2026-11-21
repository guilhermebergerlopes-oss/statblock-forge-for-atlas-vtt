import type { App } from 'obsidian';
import { cloneJson, headerFieldForPart, isRecord, slugify, type ForgeTemplate, type JsonRecord } from '../templates/forgeTemplate.ts';
import { createForgeStatblockTemplateLink, FORGE_ATLAS_STATBLOCK_DISCOVERY_KEY, FORGE_STATBLOCK_LINK_KEY, type ForgeStatblockTemplateLink } from './forgeTemplateLink.ts';

export interface CreateForgeStatblockNoteRequest {
  app: App;
  template: ForgeTemplate;
  data: JsonRecord;
  statblockFolder: string;
  fallbackName: string;
  templateSourcePath: string;
}

export interface CreateForgeStatblockNoteResult {
  /** A Forge-native statblock instance. This is a Markdown note, never a template. */
  statblockFile: TFile;
  forgeLink: ForgeStatblockTemplateLink;
}

function cleanFolder(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
}

async function ensureFolder(app: App, path: string): Promise<void> {
  const normalized = cleanFolder(path);
  // An empty destination is the Vault root, which already exists.
  if (!normalized) return;
  let current = '';
  for (const segment of normalized.split('/')) {
    current = current ? `${current}/${segment}` : segment;
    const existing = app.vault.getAbstractFileByPath(current);
    if (!existing) await app.vault.createFolder(current);
    else if (typeof (existing as { extension?: unknown }).extension === 'string') {
      throw new Error(`Não é possível criar a pasta de statblocks porque "${current}" é um arquivo.`);
    }
  }
}

function uniqueNotePath(app: App, folder: string, basename: string): string {
  const normalizedFolder = cleanFolder(folder);
  const base = normalizedFolder ? `${normalizedFolder}/${slugify(basename)}` : slugify(basename);
  let candidate = `${base}.md`;
  let suffix = 2;
  while (app.vault.getAbstractFileByPath(candidate)) candidate = `${base}-${suffix++}.md`;
  return candidate;
}

function yamlKey(key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : JSON.stringify(key);
}

function yamlValue(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('O statblock contém um número não finito que não pode ser salvo em YAML.');
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(yamlValue).join(', ')}]`;
  if (isRecord(value)) {
    const entries = Object.entries(value).map(([key, item]) => `${yamlKey(key)}: ${yamlValue(item)}`);
    return `{${entries.join(', ')}}`;
  }
  throw new Error('O statblock contém um valor que não pode ser serializado em YAML.');
}

function serializeForgeFrontmatter(frontmatter: JsonRecord): string {
  const lines = Object.entries(frontmatter).map(([key, value]) => `${yamlKey(key)}: ${yamlValue(value)}`);
  return `---\n${lines.join('\n')}\n---\n\n`;
}

/**
 * Create a note using the Forge template as its actual rendering schema.
 * Atlas templates and Atlas-specific frontmatter markers are not required.
 */
export async function createForgeStatblockNoteFromTemplate(
  request: CreateForgeStatblockNoteRequest,
): Promise<CreateForgeStatblockNoteResult> {
  const { app, template } = request;
  const sourcePath = request.templateSourcePath.replace(/\\/g, '/');
  if (!sourcePath.toLowerCase().endsWith('.forgetemplate')) {
    throw new Error('A origem do statblock precisa ser um arquivo .forgetemplate.');
  }
  const sourceFile = app.vault.getAbstractFileByPath(sourcePath);
  if (!sourceFile || !('extension' in sourceFile) || typeof sourceFile.extension !== 'string'
    || sourceFile.extension.toLowerCase() !== 'forgetemplate') {
    throw new Error('O .forgetemplate de origem não existe mais no Vault.');
  }

  const seen = new Set<string>();
  const fields: JsonRecord = {};
  for (const field of template.fields) {
    const normalizedKey = field.key.trim().toLowerCase();
    if (!normalizedKey || normalizedKey === FORGE_STATBLOCK_LINK_KEY || normalizedKey === FORGE_ATLAS_STATBLOCK_DISCOVERY_KEY) {
      throw new Error(`O campo "${field.key}" não pode ser usado em uma ficha Forge.`);
    }
    if (seen.has(normalizedKey)) throw new Error(`A chave "${field.key}" aparece mais de uma vez no template.`);
    seen.add(normalizedKey);
    if (Object.prototype.hasOwnProperty.call(request.data, field.key) && request.data[field.key] !== undefined) {
      fields[field.key] = cloneJson(request.data[field.key]);
    }
  }

  const nameField = headerFieldForPart(template.fields, 'name');
  const rawName = nameField ? fields[nameField.key] : undefined;
  const displayName = typeof rawName === 'string' && rawName.trim()
    ? rawName.trim()
    : request.fallbackName.trim() || 'New Statblock';
  if (nameField && (typeof fields[nameField.key] !== 'string' || !(fields[nameField.key] as string).trim())) {
    fields[nameField.key] = displayName;
  }

  const forgeLink = createForgeStatblockTemplateLink({
    templatePath: sourceFile.path,
    templateId: template.id,
  });
  const note = serializeForgeFrontmatter({
    ...fields,
    // Atlas' Link Statblock dialog indexes statblock:true notes. This marker is
    // only for discovery; the Forge v2 backlink and renderer remain authoritative.
    [FORGE_ATLAS_STATBLOCK_DISCOVERY_KEY]: true,
    [FORGE_STATBLOCK_LINK_KEY]: forgeLink,
  });

  await ensureFolder(app, request.statblockFolder);
  const notePath = uniqueNotePath(app, request.statblockFolder, displayName);
  const statblockFile = await app.vault.create(notePath, note);
  return { statblockFile, forgeLink };
}
