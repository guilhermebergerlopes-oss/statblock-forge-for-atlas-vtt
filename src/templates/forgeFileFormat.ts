/**
 * Forge-owned `.forgetemplate` container format.
 *
 * The Atlas template remains in its native shape at the root of the JSON file.
 * Forge-only layout data is stored under `statblockForge`, a namespaced key
 * that is removed when exporting to `.atlastemplate`.
 */
import { projectForgeTemplateForAtlas } from '../atlas/atlasTemplateAdapter.ts';
import { migrateLegacyBlockAppearanceTokens, stripLegacyBlockAppearanceTokens } from './blockAppearance.ts';
import { isLegacyTemplateCandidate, migrateLegacyTemplate } from './legacyTemplateMigration.ts';
import {
  cloneJson,
  isRecord,
  parseForgeLayout,
  parseTemplateForEditing,
  serializeTemplate,
  type ForgeBlock,
  type ForgeLayoutDocument,
  type ForgeTemplate,
} from './forgeTemplate.ts';
import { playerKeysForBlock, withPlayerAccess } from './playerSettingsModel.ts';

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
  if (metadata === undefined) {
    const isForgeExtension = sourceExtension?.toLowerCase().replace(/^\./, '') === FORGE_TEMPLATE_EXTENSION;
    return {
      ...result,
      warnings: baseWarnings,
      layout: null,
      fileFormat: isForgeExtension ? 'forge' : 'atlas',
      canOverwrite: !isForgeExtension,
      ...(isForgeExtension ? { warnings: [...baseWarnings, 'Este arquivo .forgetemplate não contém metadados Forge. O original ficará protegido; use “Salvar cópia Forge” para reconstruí-los.'] } : {}),
    };
  }

  if (!isRecord(metadata) || metadata.format !== FORGE_FILE_METADATA_FORMAT
    || metadata.version !== FORGE_FILE_METADATA_VERSION || !isRecord(metadata.layout)) {
    return {
      ...result,
      layout: null,
      fileFormat: 'forge',
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
      fileFormat: 'forge',
      canOverwrite: false,
      warnings: [...baseWarnings, 'Forge layout metadata is incomplete or belongs to another template. The source file is protected; use Save Forge Copy to rebuild it.'],
    };
  }

  const layoutText = JSON.stringify(rawLayout);
  return {
    ...result,
    warnings: baseWarnings,
    layout: parseForgeLayout(layoutText, result.template),
    fileFormat: 'forge',
    canOverwrite: true,
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
  return `${JSON.stringify(document, null, 2)}\n`;
}

/** Remove all Forge-only information and produce a clean Atlas `.atlastemplate`. */
export function serializeAtlasTemplateFile(template: ForgeTemplate, layout?: ForgeLayoutDocument): string {
  const projection = projectForgeTemplateForAtlas(template);
  let atlasTemplate = cloneJson(projection.template) as ForgeTemplate;
  delete atlasTemplate[FORGE_FILE_METADATA_KEY];

  // Total Hidden remains present in the native Atlas layout. Its Forge-only
  // meaning is projected to Atlas's native `hidden` player access for every
  // Field represented by the block and its descendants. Atlas can then keep
  // the content available to the GM while withholding it from players.
  if (layout && Array.isArray(atlasTemplate.layout.blocks)) {
    const hiddenFieldKeys = new Set<string>();
    const collectTotalHiddenFields = (blocks: readonly ForgeBlock[], inheritedHidden = false): void => {
      for (const block of blocks) {
        const totalHidden = inheritedHidden || layout.blocks[block.id]?.visibility === 'total-hidden';
        if (totalHidden) {
          for (const key of playerKeysForBlock(block)) hiddenFieldKeys.add(key);
        }
        if (Array.isArray(block.blocks)) {
          collectTotalHiddenFields(block.blocks as ForgeBlock[], totalHidden);
        }
      }
    };
    collectTotalHiddenFields(atlasTemplate.layout.blocks);
    if (hiddenFieldKeys.size > 0) {
      atlasTemplate = withPlayerAccess(atlasTemplate, [...hiddenFieldKeys], 'hidden');
    }
  }
  const stripBlocks = (blocks: unknown[]): void => {
    for (const rawBlock of blocks) {
      if (!isRecord(rawBlock)) continue;
      const className = stripLegacyBlockAppearanceTokens(typeof rawBlock.className === 'string' ? rawBlock.className : undefined);
      if (className) rawBlock.className = className;
      else delete rawBlock.className;
      if (Array.isArray(rawBlock.blocks)) stripBlocks(rawBlock.blocks);
    }
  };
  if (isRecord(atlasTemplate.layout) && Array.isArray(atlasTemplate.layout.blocks)) stripBlocks(atlasTemplate.layout.blocks);
  return serializeTemplate(atlasTemplate);
}

export function isForgeTemplatePath(path: string): boolean {
  return path.toLowerCase().endsWith(`.${FORGE_TEMPLATE_EXTENSION}`);
}

export function isAtlasTemplatePath(path: string): boolean {
  return path.toLowerCase().endsWith('.atlastemplate');
}
