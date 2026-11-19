import { TFile, type App } from 'obsidian';
import { parseTemplateFileText } from '../templates/forgeFileFormat.ts';
import { forgeStatblockTemplateLinkFromFrontmatter, type ForgeStatblockTemplateLink } from '../statblocks/forgeTemplateLink.ts';

export type ForgeTemplateLinkResolution =
  | { status: 'linked'; file: TFile; link: ForgeStatblockTemplateLink; pathWasMoved: boolean }
  | { status: 'missing'; link: ForgeStatblockTemplateLink }
  | { status: 'ambiguous'; link: ForgeStatblockTemplateLink; candidates: string[] }
  | { status: 'invalid'; link: null };

export function readForgeTemplateLink(app: App, note: TFile): ForgeStatblockTemplateLink | null {
  if (note.extension.toLowerCase() !== 'md') return null;
  const frontmatter = app.metadataCache.getFileCache(note)?.frontmatter;
  const link = forgeStatblockTemplateLinkFromFrontmatter(frontmatter);
  if (!link || !frontmatter) return null;
  // v1 is an Atlas-published statblock and must retain its exact Atlas schema link.
  // v2 is a Forge-native statblock and intentionally has no Atlas template marker.
  if (link.atlasTemplateId) return frontmatter['atlas-template'] === link.atlasTemplateId ? link : null;
  return link.version === 2 && frontmatter['atlas-template'] === undefined ? link : null;
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
  if (exact instanceof TFile && await templateFileMatches(app, exact, link)) {
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
