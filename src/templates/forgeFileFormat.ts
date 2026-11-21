/**
 * Forge-owned `.forgetemplate` container format.
 *
 * The Atlas template structure remains at the root, while Forge-owned files
 * write the reorganized Field type IDs. Legacy IDs are normalized on read.
 * Forge-only layout data is stored under `statblockForge`. Atlas-native
 * `.atlastemplate` files are import-only and are normalized when read.
 */
import { migrateLegacyBlockAppearanceTokens } from './blockAppearance.ts';
import { isLegacyTemplateCandidate, migrateLegacyTemplate } from './legacyTemplateMigration.ts';
import {
  cloneJson,
  isRecord,
  parseForgeLayout,
  parseTemplateForEditing,
  type ForgeLayoutDocument,
  type ForgeTemplate,
} from './forgeTemplate.ts';
import { serializeForgeJsonFieldTypes } from './fieldTypeJsonModel.ts';

export const FORGE_TEMPLATE_EXTENSION = 'forgetemplate';
export const FORGE_FILE_METADATA_KEY = 'statblockForge';
export const FORGE_FILE_METADATA_FORMAT = 'statblock-forge-metadata';
export const FORGE_FILE_METADATA_VERSION = 1;

export type TemplateFileFormat = 'atlas' | 'forge';

export interface ParsedTemplateFile {
  template: ForgeTemplate;
  layout: ForgeLayoutDocument | null;
  fileFormat: TemplateFileFormat;
  warnings: string[];
  canOverwrite: boolean;
}

export function parseTemplateFileText(text: string, sourceExtension?: string): ParsedTemplateFile {
  const parsed = JSON.parse(text) as unknown;
  if (!isRecord(parsed)) throw new Error('A raiz do arquivo precisa ser um objeto JSON.');

  const shouldMigrate = parsed.format === 'atlas-statblock-template' || isLegacyTemplateCandidate(parsed);
  const migration = shouldMigrate
    ? migrateLegacyTemplate(parsed)
    : { template: parsed, changed: false, migratedGridBlocks: 0, warnings: [] as string[] };
  const migratedText = migration.changed ? JSON.stringify(migration.template) : text;
  const result = parseTemplateForEditing(migratedText);
  const baseWarnings = [...result.warnings, ...migration.warnings];
  const metadata = migration.template[FORGE_FILE_METADATA_KEY];
  const normalizedExtension = sourceExtension?.toLowerCase().replace(/^\./, '');
  const isForgeExtension = normalizedExtension === FORGE_TEMPLATE_EXTENSION;
  const isAtlasExtension = normalizedExtension === 'atlastemplate';
  if (metadata === undefined) {
    return {
      ...result,
      warnings: baseWarnings,
      layout: null,
      fileFormat: isForgeExtension ? 'forge' : 'atlas',
      canOverwrite: false,
      ...(isForgeExtension ? { warnings: [...baseWarnings, 'Este arquivo .forgetemplate não contém metadados Forge. O original ficará protegido; use “Salvar cópia Forge” para reconstruí-los.'] } : {}),
    };
  }

  if (!isRecord(metadata) || metadata.format !== FORGE_FILE_METADATA_FORMAT
    || metadata.version !== FORGE_FILE_METADATA_VERSION || !isRecord(metadata.layout)) {
    return {
      ...result,
      layout: null,
      fileFormat: isAtlasExtension ? 'atlas' : 'forge',
      canOverwrite: false,
      warnings: [...baseWarnings, 'Forge metadata is missing, damaged, or uses an unsupported version. A default layout will be rebuilt; the original file is protected. Use Save Forge Copy to recover without overwriting the source.'],
    };
  }

  const rawLayout = metadata.layout;
  const layoutIsCompatible = rawLayout.format === 'statblock-forge-layout'
    && rawLayout.version === 1
    && rawLayout.templateId === result.template.id
    && isRecord(rawLayout.blocks);
  if (!layoutIsCompatible) {
    return {
      ...result,
      layout: null,
      fileFormat: isAtlasExtension ? 'atlas' : 'forge',
      canOverwrite: false,
      warnings: [...baseWarnings, 'Forge layout metadata is incomplete or belongs to another template. The source file is protected; use Save Forge Copy to rebuild it.'],
    };
  }

  const layoutText = JSON.stringify(rawLayout);
  return {
    ...result,
    warnings: baseWarnings,
    layout: parseForgeLayout(layoutText, result.template),
    fileFormat: isAtlasExtension ? 'atlas' : 'forge',
    canOverwrite: !isAtlasExtension,
  };
}

/** Serialize the Atlas model plus Forge-only metadata into a `.forgetemplate`. */
export function serializeForgeTemplateFile(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
): string {
  const atlasTemplate = cloneJson(template) as Record<string, unknown>;
  delete atlasTemplate[FORGE_FILE_METADATA_KEY];
  const forgeLayout = cloneJson(layout);
  const migrateBlocks = (blocks: unknown[]): void => {
    for (const rawBlock of blocks) {
      if (!isRecord(rawBlock) || typeof rawBlock.id !== 'string') continue;
      const existing = forgeLayout.blocks[rawBlock.id] ?? { span: 12, rows: 1, appearance: {} };
      const migration = migrateLegacyBlockAppearanceTokens(
        typeof rawBlock.className === 'string' ? rawBlock.className : undefined,
        existing.appearance,
      );
      if (migration.removed) {
        if (migration.className) rawBlock.className = migration.className;
        else delete rawBlock.className;
      }
      if (migration.migrated) {
        existing.appearance = migration.appearance;
        // Legacy className tokens explicitly represented an individual style.
        // Keep that styling active after moving it into the Forge sidecar,
        // even when an older sidecar had the default `theme` mode saved.
        existing.appearanceMode = 'custom';
      }
      forgeLayout.blocks[rawBlock.id] = existing;
      if (Array.isArray(rawBlock.blocks)) migrateBlocks(rawBlock.blocks);
    }
  };
  if (isRecord(atlasTemplate.layout) && Array.isArray(atlasTemplate.layout.blocks)) migrateBlocks(atlasTemplate.layout.blocks);
  forgeLayout.templateId = String(atlasTemplate.id ?? forgeLayout.templateId);
  const document = {
    ...atlasTemplate,
    [FORGE_FILE_METADATA_KEY]: {
      format: FORGE_FILE_METADATA_FORMAT,
      version: FORGE_FILE_METADATA_VERSION,
      layout: forgeLayout,
    },
  };
  serializeForgeJsonFieldTypes(document);
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function isForgeTemplatePath(path: string): boolean {
  return path.toLowerCase().endsWith(`.${FORGE_TEMPLATE_EXTENSION}`);
}

export function isAtlasTemplatePath(path: string): boolean {
  return path.toLowerCase().endsWith('.atlastemplate');
}
