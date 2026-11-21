import { isRecord } from '../templates/forgeTemplate.ts';

/** Namespaced frontmatter key linking a Forge statblock instance to its source template. */
export const FORGE_STATBLOCK_LINK_KEY = 'statblock-forge';
export const FORGE_STATBLOCK_LINK_FORMAT = 'statblock-forge-template-link';
export const FORGE_STATBLOCK_LINK_VERSION = 2;

export interface ForgeStatblockTemplateLink {
  format: typeof FORGE_STATBLOCK_LINK_FORMAT;
  /** Version 1 links are also Atlas-published; version 2 links are Forge-native instances. */
  version: 1 | 2;
  templatePath: string;
  templateId: string;
  atlasTemplateId?: string;
}

/** Build validated metadata. Supplying an Atlas ID creates a legacy-compatible v1 link. */
export function createForgeStatblockTemplateLink(input: {
  templatePath: string;
  templateId: string;
  atlasTemplateId?: string | null;
}): ForgeStatblockTemplateLink {
  const templatePath = normalizeVaultPath(input.templatePath);
  const templateId = input.templateId.trim();
  const atlasTemplateId = typeof input.atlasTemplateId === 'string' ? input.atlasTemplateId.trim() : '';
  if (!templatePath || !templatePath.toLowerCase().endsWith('.forgetemplate')) {
    throw new Error('O vínculo Forge precisa apontar para um arquivo .forgetemplate dentro do Vault.');
  }
  if (!templateId) throw new Error('O vínculo Forge precisa conter o ID do template Forge.');
  if (input.atlasTemplateId !== undefined && input.atlasTemplateId !== null && !atlasTemplateId) {
    throw new Error('O ID do template Atlas não pode ficar vazio.');
  }
  return {
    format: FORGE_STATBLOCK_LINK_FORMAT,
    version: atlasTemplateId ? 1 : 2,
    templatePath,
    templateId,
    ...(atlasTemplateId ? { atlasTemplateId } : {}),
  };
}

export function normalizeVaultPath(path: string): string {
  const normalized = path.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
  if (!normalized || normalized.startsWith('/')) return '';
  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return '';
  return normalized;
}

/** Parse both Atlas-linked v1 metadata and Forge-native v2 metadata. */
export function parseForgeStatblockTemplateLink(value: unknown): ForgeStatblockTemplateLink | null {
  if (!isRecord(value)
    || value.format !== FORGE_STATBLOCK_LINK_FORMAT
    || (value.version !== 1 && value.version !== 2)
    || typeof value.templatePath !== 'string'
    || typeof value.templateId !== 'string') return null;

  if (value.version === 1 && typeof value.atlasTemplateId !== 'string') return null;
  if (value.version === 2 && value.atlasTemplateId !== undefined) return null;

  try {
    return createForgeStatblockTemplateLink({
      templatePath: value.templatePath,
      templateId: value.templateId,
      ...(typeof value.atlasTemplateId === 'string' ? { atlasTemplateId: value.atlasTemplateId } : {}),
    });
  } catch {
    return null;
  }
}

export function forgeStatblockTemplateLinkFromFrontmatter(frontmatter: unknown): ForgeStatblockTemplateLink | null {
  if (!isRecord(frontmatter)) return null;
  return parseForgeStatblockTemplateLink(frontmatter[FORGE_STATBLOCK_LINK_KEY]);
}

/** Atlas' Link Statblock dialog discovers notes with `statblock: true`. Forge v2 keeps
 * its own namespaced template link and uses this boolean only as a discovery marker;
 * it does not claim an Atlas template or change the Forge renderer. */
export const FORGE_ATLAS_STATBLOCK_DISCOVERY_KEY = 'statblock' as const;

export type ForgeAtlasStatblockDiscoveryResult = 'registered' | 'already-registered' | 'not-forge-v2' | 'conflict';

/** Adds Atlas' standard statblock discovery marker without overwriting user data. */
export function ensureForgeStatblockIsDiscoverableByAtlas(
  frontmatter: Record<string, unknown>,
): ForgeAtlasStatblockDiscoveryResult {
  const link = forgeStatblockTemplateLinkFromFrontmatter(frontmatter);
  if (link?.version !== 2) return 'not-forge-v2';

  const marker = frontmatter[FORGE_ATLAS_STATBLOCK_DISCOVERY_KEY];
  if (marker === true || marker === 'true') return 'already-registered';
  if (Object.prototype.hasOwnProperty.call(frontmatter, FORGE_ATLAS_STATBLOCK_DISCOVERY_KEY)) return 'conflict';

  frontmatter[FORGE_ATLAS_STATBLOCK_DISCOVERY_KEY] = true;
  return 'registered';
}

/** Update only the YAML backlink path after a uniquely identified Forge template was moved. */
export function refreshForgeStatblockTemplateLinkPath(
  frontmatter: Record<string, unknown>,
  newPath: string,
  expected?: { expectedOldPath?: string; expectedTemplateId?: string },
): boolean {
  const current = forgeStatblockTemplateLinkFromFrontmatter(frontmatter);
  if (!current) return false;
  // Compare-and-swap guards make delayed rename events harmless: never rewrite
  // a note whose link was already changed to another template/path meanwhile.
  if (expected?.expectedOldPath !== undefined && current.templatePath !== expected.expectedOldPath) return false;
  if (expected?.expectedTemplateId !== undefined && current.templateId !== expected.expectedTemplateId) return false;
  let next: ForgeStatblockTemplateLink;
  try {
    next = createForgeStatblockTemplateLink({
      ...current,
      templatePath: newPath,
      ...(current.atlasTemplateId ? { atlasTemplateId: current.atlasTemplateId } : {}),
    });
  } catch {
    return false;
  }
  frontmatter[FORGE_STATBLOCK_LINK_KEY] = next;
  return true;
}
