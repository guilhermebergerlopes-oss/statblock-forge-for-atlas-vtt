/**
 * Small, read-only inspector for Atlas .atlastemplate files.
 * This is an independent format check, not a copy of Atlas's parser.
 */

export const ATLAS_TEMPLATE_EXTENSION = 'atlastemplate';
export const ATLAS_TEMPLATE_FORMAT = 'atlas-statblock-template';
export const FORGE_TEMPLATE_EXTENSION = 'forgetemplate';
import { isLegacyTemplateCandidate, migrateLegacyTemplate } from './legacyTemplateMigration.ts';
export type TemplateFileFormat = 'atlas' | 'forge';

export type TemplateInspectionStatus = 'valid' | 'invalid-json' | 'unknown-format' | 'incomplete';

export interface TemplateInspection {
  status: TemplateInspectionStatus;
  id?: string;
  version?: number;
  fieldsCount: number;
  blocksCount: number;
  fileFormat?: TemplateFileFormat;
  message?: string;
  migrationPending?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function countBlocks(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.reduce((total: number, item: unknown) => {
    if (!isRecord(item)) return total + 1;
    return total + 1 + countBlocks(item.blocks);
  }, 0);
}

export function inspectTemplateText(text: string): TemplateInspection {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return {
      status: 'invalid-json',
      fieldsCount: 0,
      blocksCount: 0,
      message: 'O arquivo não contém JSON válido.',
    };
  }

  if (!isRecord(parsed)) {
    return {
      status: 'unknown-format',
      fieldsCount: 0,
      blocksCount: 0,
      message: 'The file does not declare an Atlas statblock template.',
    };
  }

  const migrationPending = isLegacyTemplateCandidate(parsed);
  const normalized = migrationPending ? migrateLegacyTemplate(parsed).template : parsed;
  if (normalized.format !== ATLAS_TEMPLATE_FORMAT) {
    return {
      status: 'unknown-format',
      fieldsCount: 0,
      blocksCount: 0,
      message: 'The file does not declare an Atlas statblock template and has no recognized legacy grid structure.',
    };
  }
  const normalizedRecord = normalized as Record<string, unknown>;

  const id = typeof normalizedRecord.id === 'string' ? normalizedRecord.id : undefined;
  const fileFormat: TemplateFileFormat = Object.prototype.hasOwnProperty.call(normalizedRecord, 'statblockForge') ? 'forge' : 'atlas';
  const version = typeof normalizedRecord.version === 'number' ? normalizedRecord.version : undefined;
  const fields = Array.isArray(normalizedRecord.fields) ? normalizedRecord.fields : undefined;
  const layout = isRecord(normalizedRecord.layout) ? normalizedRecord.layout : undefined;
  const blocks = layout && Array.isArray(layout.blocks) ? layout.blocks : undefined;

  if (!id || !Number.isInteger(version) || (version ?? 0) < 1 || !fields || !blocks) {
    return {
      status: 'incomplete',
      id,
      version,
      fieldsCount: fields?.length ?? 0,
      blocksCount: countBlocks(blocks),
      fileFormat,
      ...(migrationPending ? { migrationPending: true } : {}),
      message: 'The file looks like a template but is missing required structural properties.',
    };
  }

  return {
    status: 'valid',
    id,
    version,
    fieldsCount: fields.length,
    blocksCount: countBlocks(blocks),
    fileFormat,
    ...(migrationPending ? { migrationPending: true, message: 'Legacy grid layout detected. Open and save this template to migrate it.' } : {}),
  };
}

export function normalizeTemplateFolder(value: string): string {
  const cleaned = value.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  return cleaned || 'atlas-vtt/statblock-templates';
}

export function isTemplateInsideFolder(path: string, folder: string): boolean {
  const normalizedPath = path.replace(/\\/g, '/');
  const normalizedFolder = normalizeTemplateFolder(folder);
  const lowerPath = normalizedPath.toLowerCase();
  const isSupportedExtension = lowerPath.endsWith(`.${ATLAS_TEMPLATE_EXTENSION}`)
    || lowerPath.endsWith(`.${FORGE_TEMPLATE_EXTENSION}`);
  return normalizedPath.startsWith(`${normalizedFolder}/`) && isSupportedExtension;
}

/** Atlas and Forge template files are discoverable anywhere in the Vault. */
export function isSupportedTemplatePath(path: string): boolean {
  const lowerPath = path.replace(/\\/g, '/').toLowerCase();
  return lowerPath.endsWith(`.${ATLAS_TEMPLATE_EXTENSION}`)
    || lowerPath.endsWith(`.${FORGE_TEMPLATE_EXTENSION}`);
}
