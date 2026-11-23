import type { TFile, App } from 'obsidian';
import { bindStatblockData, unwrapStatblockJson, type StatblockDataBinding } from '../render/statblockDataModel.ts';
import { isRecord, type ForgeField, type ForgeTemplate, type JsonRecord } from '../templates/forgeTemplate.ts';
import { restoreForgeStatblockDataFromLegacyNote } from '../atlas/atlasTemplateAdapter.ts';
import { forgeTableStructureFromSample } from './tableRowsModel.ts';

export type StatblockSourceFormat = 'markdown-frontmatter' | 'json';

export interface LoadedStatblockSource {
  path: string;
  basename: string;
  format: StatblockSourceFormat;
  raw: JsonRecord;
  binding: StatblockDataBinding;
}

export type ImageLinkResolver = (linkPath: string) => string | undefined;

function normalizeObsidianImageLink(field: ForgeField, value: unknown, resolveImageLink?: ImageLinkResolver): unknown {
  if (field.type !== 'image' || typeof value !== 'string' || !resolveImageLink) return value;
  const match = value.trim().match(/^!?(?:\[\[)([^\]|]+)(?:\|[^\]]*)?\]\]$/);
  if (!match) return value;
  return resolveImageLink(match[1]!.trim()) ?? value;
}

/**
 * Pure field-binding boundary shared by Markdown and JSON sources. Only fields
 * declared by the chosen template reach the renderer; arbitrary note metadata
 * is kept in `raw` for diagnostics but never copied into `binding.data`.
 */
export function createLoadedStatblockSource(input: {
  path: string;
  basename: string;
  format: StatblockSourceFormat;
  raw: JsonRecord;
  template: ForgeTemplate;
  resolveImageLink?: ImageLinkResolver;
}): LoadedStatblockSource {
  // Atlas renders Forge-only per-entry Counters as text; restore their typed
  // marks in memory before binding so Forge remains the richer editor.
  const forgeData = restoreForgeStatblockDataFromLegacyNote(input.template, input.raw);
  const binding = bindStatblockData(input.template, forgeData);
  const templateSample = isRecord(input.template.sample) ? input.template.sample : {};
  // Older statblocks were created before Table structure was retained when
  // "Copy example values" was unchecked. Restore only missing Table skeletons
  // here as a read-time fallback so existing notes match the Template preview
  // without importing sample cell Values into a real statblock.
  for (const field of input.template.fields) {
    if (field.type !== 'scores' || field.forgeInternal !== 'table-storage') continue;
    // A valid per-statblock Table, even an intentionally reduced one-row Table,
    // always wins. Only missing or legacy/invalid storage receives the fallback.
    if (forgeTableStructureFromSample(binding.data[field.key])) continue;
    if (!Object.prototype.hasOwnProperty.call(templateSample, field.key)) continue;
    const structure = forgeTableStructureFromSample(templateSample[field.key]);
    if (structure) binding.data[field.key] = structure;
  }
  for (const field of input.template.fields) {
    if (Object.prototype.hasOwnProperty.call(binding.data, field.key)) {
      binding.data[field.key] = normalizeObsidianImageLink(field, binding.data[field.key], input.resolveImageLink);
    }
  }
  return {
    path: input.path,
    basename: input.basename,
    format: input.format,
    raw: input.raw,
    binding,
  };
}

/**
 * Load an Obsidian Markdown note's cached frontmatter or an external JSON
 * record, then pass it through the same pure field-binding boundary.
 */
export async function loadStatblockSource(
  app: App,
  file: TFile,
  template: ForgeTemplate,
): Promise<LoadedStatblockSource> {
  let raw: JsonRecord;
  let format: StatblockSourceFormat;

  if (file.extension.toLowerCase() === 'md') {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
    if (!isRecord(frontmatter)) {
      throw new Error('A nota não possui propriedades YAML legíveis. Salve a nota e tente novamente.');
    }
    raw = frontmatter;
    format = 'markdown-frontmatter';
  } else if (file.extension.toLowerCase() === 'json') {
    const parsed: unknown = JSON.parse(await app.vault.read(file));
    raw = unwrapStatblockJson(parsed);
    format = 'json';
  } else {
    throw new Error('A fonte precisa ser uma nota Markdown (.md) ou um registro JSON (.json).');
  }

  return createLoadedStatblockSource({
    path: file.path,
    basename: file.basename,
    format,
    raw,
    template,
    resolveImageLink: (linkPath) => app.metadataCache.getFirstLinkpathDest(linkPath, file.path)?.path,
  });
}
