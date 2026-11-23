import type { App, TFile } from 'obsidian';
import { parseTemplateFileText } from '../templates/forgeFileFormat.ts';
import { createForgeStatblockTemplateLink, forgeStatblockTemplateLinkFromFrontmatter, type ForgeStatblockTemplateLink } from '../statblocks/forgeTemplateLink.ts';
import { isRecord } from '../templates/forgeTemplate.ts';

const atlasRoleTemplateLinks = new WeakMap<App, Map<string, ForgeStatblockTemplateLink>>();

/** Register the Forge source behind a native Atlas template mirror.
 * Atlas-created Role notes only carry `atlas-template`; this mapping lets Forge
 * resolve them without modifying the note's YAML or claiming the native card.
 */
export function registerForgeAtlasRoleTemplateLink(
  app: App,
  atlasTemplateId: string,
  sourceTemplateId: string,
  templatePath: string,
): void {
  const link = createForgeStatblockTemplateLink({
    templateId: sourceTemplateId,
    templatePath,
    atlasTemplateId,
  });
  let links = atlasRoleTemplateLinks.get(app);
  if (!links) {
    links = new Map();
    atlasRoleTemplateLinks.set(app, links);
  }
  links.set(atlasTemplateId, link);
}

function isVaultFileLike(value: unknown): value is TFile {
  return isRecord(value)
    && typeof value.path === 'string'
    && typeof value.extension === 'string'
    && typeof value.basename === 'string';
}

export type ForgeTemplateLinkResolution =
  | { status: 'linked'; file: TFile; link: ForgeStatblockTemplateLink; pathWasMoved: boolean }
  | { status: 'missing'; link: ForgeStatblockTemplateLink }
  | { status: 'ambiguous'; link: ForgeStatblockTemplateLink; candidates: string[] }
  | { status: 'invalid'; link: null };

export function readForgeTemplateLink(app: App, note: TFile): ForgeStatblockTemplateLink | null {
  if (note.extension.toLowerCase() !== 'md') return null;
  const frontmatter = app.metadataCache.getFileCache(note)?.frontmatter;
  if (!isRecord(frontmatter)) return null;

  // An explicit Forge link always wins. Never infer a second link over a
  // malformed or conflicting user-authored `statblock-forge` property.
  if (Object.prototype.hasOwnProperty.call(frontmatter, 'statblock-forge')) {
    const link = forgeStatblockTemplateLinkFromFrontmatter(frontmatter);
    if (!link) return null;
    // v1 is an Atlas-published statblock and must retain its exact Atlas schema link.
    // v2 is a Forge-native statblock and intentionally has no Atlas template marker.
    if (link.atlasTemplateId) return frontmatter['atlas-template'] === link.atlasTemplateId ? link : null;
    return link.version === 2 && frontmatter['atlas-template'] === undefined ? link : null;
  }

  // Atlas creates notes from Roles with only `atlas-template`. When that ID
  // belongs to one of Forge's registered native mirrors, synthesize the same
  // v1 relationship used by Forge-published Atlas statblocks. The note and
  // Atlas' native card remain untouched; Forge only adds its Markdown editor.
  const atlasTemplateId = frontmatter['atlas-template'];
  if (typeof atlasTemplateId !== 'string' || !atlasTemplateId.trim()) return null;
  return atlasRoleTemplateLinks.get(app)?.get(atlasTemplateId.trim()) ?? null;
}

async function templateFileMatches(app: App, file: TFile, link: ForgeStatblockTemplateLink): Promise<boolean> {
  if (file.extension.toLowerCase() !== 'forgetemplate') return false;
  try {
    const parsed = parseTemplateFileText(await app.vault.cachedRead(file), file.extension);
    return parsed.fileFormat === 'forge' && parsed.template.id === link.templateId;
  } catch {
    return false;
  }
}

/** Resolve the exact path first, then recover a renamed file by its stable Forge template ID. */
export async function resolveForgeTemplateLink(
  app: App,
  link: ForgeStatblockTemplateLink,
): Promise<ForgeTemplateLinkResolution> {
  const exact = app.vault.getAbstractFileByPath(link.templatePath);
  if (isVaultFileLike(exact) && await templateFileMatches(app, exact, link)) {
    return { status: 'linked', file: exact, link, pathWasMoved: false };
  }

  const matches: TFile[] = [];
  for (const candidate of app.vault.getFiles()) {
    if (candidate.extension.toLowerCase() === 'forgetemplate' && await templateFileMatches(app, candidate, link)) {
      matches.push(candidate);
    }
  }
  if (matches.length === 1) return { status: 'linked', file: matches[0]!, link, pathWasMoved: true };
  if (matches.length > 1) return { status: 'ambiguous', link, candidates: matches.map((file) => file.path) };
  return { status: 'missing', link };
}

export async function resolveForgeTemplateForNote(app: App, note: TFile): Promise<ForgeTemplateLinkResolution> {
  const link = readForgeTemplateLink(app, note);
  return link ? resolveForgeTemplateLink(app, link) : { status: 'invalid', link: null };
}
