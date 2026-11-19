import { headerFieldForPart, isRecord, type ForgeField, type ForgeTemplate, type JsonRecord } from '../templates/forgeTemplate.ts';
import { projectForgeStatblockDataForAtlas } from './atlasTemplateAdapter.ts';
import { FORGE_STATBLOCK_LINK_KEY, type ForgeStatblockTemplateLink } from '../statblocks/forgeTemplateLink.ts';

/** Field names Atlas reserves for its own statblock/token/note machinery. */
export const ATLAS_RESERVED_STATBLOCK_KEYS = new Set([
  'statblock', 'atlas-template', 'atlas-type', 'layout', 'tags', 'aliases', 'cssclasses', 'cssclass',
  'token', 'token-image', 'statblock-link', 'path', 'extends', 'bestiary', 'note', 'columns', 'mtime',
  'monster', 'creature', 'player', 'position', FORGE_STATBLOCK_LINK_KEY,
]);

export interface AtlasPublishValidation {
  errors: string[];
  warnings: string[];
}

/** Validate whether a Forge template can be represented as an Atlas statblock note. */
export function validateAtlasStatblockPublish(template: ForgeTemplate, data: JsonRecord): AtlasPublishValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const field of template.fields) {
    const normalized = field.key.toLowerCase();
    if (ATLAS_RESERVED_STATBLOCK_KEYS.has(normalized)) {
      errors.push(`O campo "${field.key}" usa uma propriedade reservada pelo Atlas.`);
    }
    if (seen.has(normalized)) errors.push(`A chave "${field.key}" aparece mais de uma vez no template.`);
    seen.add(normalized);
  }

  const nameField = headerFieldForPart(template.fields, 'name');
  const name = nameField ? data[nameField.key] : undefined;
  if (typeof name !== 'string' || !name.trim()) warnings.push('O nome está vazio; o Forge usará o nome do arquivo da nota.');

  const imageField = headerFieldForPart(template.fields, 'image');
  const image = imageField ? data[imageField.key] : undefined;
  if (typeof image === 'string' && /^https?:\/\//i.test(image)) {
    warnings.push('A arte usa um endereço remoto. O Atlas exige uma imagem salva no Vault para criar um token automaticamente a partir do statblock.');
  } else if (image !== undefined && image !== null && typeof image !== 'string') {
    warnings.push('O campo de imagem não contém um caminho de arquivo simples; verifique a arte antes de criar um token.');
  }

  return { errors, warnings };
}

/** Patch only Atlas/Forge linkage metadata, preserving every statblock value and note property. */
export function applyAtlasStatblockMetadata(
  frontmatter: JsonRecord,
  atlasTemplateId: string,
  forgeLink?: ForgeStatblockTemplateLink | null,
  nameFieldKey?: string,
  fallbackName?: string,
): void {
  frontmatter.statblock = true;
  frontmatter['atlas-template'] = atlasTemplateId;
  if (nameFieldKey && fallbackName?.trim()) {
    const currentName = frontmatter[nameFieldKey];
    if (typeof currentName !== 'string' || !currentName.trim()) frontmatter[nameFieldKey] = fallbackName.trim();
  }
  if (forgeLink) frontmatter[FORGE_STATBLOCK_LINK_KEY] = forgeLink;
  else delete frontmatter[FORGE_STATBLOCK_LINK_KEY];
}

/**
 * Prepare Atlas frontmatter from declared Fields. Layout sidecars and arbitrary
 * source properties are not copied into the published note.
 */
export function atlasStatblockFrontmatter(
  template: ForgeTemplate,
  data: JsonRecord,
  fallbackName: string,
  forgeLink?: ForgeStatblockTemplateLink | null,
): JsonRecord {
  const validation = validateAtlasStatblockPublish(template, data);
  if (validation.errors.length > 0) throw new Error(validation.errors.join(' '));

  const atlasData = projectForgeStatblockDataForAtlas(template, data).data;
  const fields: JsonRecord = {};
  for (const field of template.fields) {
    if (Object.prototype.hasOwnProperty.call(atlasData, field.key) && atlasData[field.key] !== undefined) {
      fields[field.key] = atlasData[field.key];
    }
  }

  const nameField = headerFieldForPart(template.fields, 'name');
  const nameValue = nameField ? fields[nameField.key] : undefined;
  if (typeof nameValue !== 'string' || !nameValue.trim()) fields.name = fallbackName;

  // Atlas expects these native markers. `atlas-template` must match a real
  // registered .atlastemplate in Atlas' native template library.
  return {
    statblock: true,
    'atlas-template': template.id,
    ...fields,
    ...(forgeLink ? { [FORGE_STATBLOCK_LINK_KEY]: forgeLink } : {}),
  };
}

function yamlKey(key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : JSON.stringify(key);
}

/** JSON flow values are valid YAML 1.2 and avoid unsafe hand-built YAML strings. */
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

/** Serialize Obsidian/Atlas frontmatter without evaluating or interpolating user text. */
export function serializeAtlasStatblockNote(
  template: ForgeTemplate,
  data: JsonRecord,
  fallbackName: string,
  forgeLink?: ForgeStatblockTemplateLink | null,
): string {
  const frontmatter = atlasStatblockFrontmatter(template, data, fallbackName, forgeLink);
  const lines = Object.entries(frontmatter).map(([key, value]) => `${yamlKey(key)}: ${yamlValue(value)}`);
  return `---\n${lines.join('\n')}\n---\n\n`;
}

export function atlasPublishableFieldKeys(template: ForgeTemplate): string[] {
  return template.fields.filter((field: ForgeField) => !ATLAS_RESERVED_STATBLOCK_KEYS.has(field.key.toLowerCase())).map((field) => field.key);
}
