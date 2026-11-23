import { isRecord } from './forgeTemplate.ts';

/** Marker for an Atlas-native template file generated from a Forge template. */
export const FORGE_ATLAS_ROLE_MIRROR_KEY = 'statblockForgeRoleMirror';
export const FORGE_ATLAS_ROLE_MIRROR_FORMAT = 'statblock-forge-atlas-role-mirror';
export const FORGE_ATLAS_ROLE_MIRROR_VERSION = 1;

export interface ForgeAtlasRoleMirrorMetadata {
  format: typeof FORGE_ATLAS_ROLE_MIRROR_FORMAT;
  version: typeof FORGE_ATLAS_ROLE_MIRROR_VERSION;
  sourceTemplateId: string;
  sourceTemplatePath: string;
}

export function forgeAtlasRoleMirrorMetadata(value: unknown): ForgeAtlasRoleMirrorMetadata | null {
  if (!isRecord(value)) return null;
  const raw = value[FORGE_ATLAS_ROLE_MIRROR_KEY];
  if (!isRecord(raw)
    || raw.format !== FORGE_ATLAS_ROLE_MIRROR_FORMAT
    || raw.version !== FORGE_ATLAS_ROLE_MIRROR_VERSION
    || typeof raw.sourceTemplateId !== 'string'
    || !raw.sourceTemplateId.trim()
    || typeof raw.sourceTemplatePath !== 'string'
    || !raw.sourceTemplatePath.trim()) return null;
  return {
    format: FORGE_ATLAS_ROLE_MIRROR_FORMAT,
    version: FORGE_ATLAS_ROLE_MIRROR_VERSION,
    sourceTemplateId: raw.sourceTemplateId.trim(),
    sourceTemplatePath: raw.sourceTemplatePath.trim(),
  };
}

export function isForgeAtlasRoleMirror(value: unknown): boolean {
  return forgeAtlasRoleMirrorMetadata(value) !== null;
}

/** Whether a file should reserve its ID when Forge creates/imports templates. */
export function reservesForgeTemplateId(path: string, document: unknown): boolean {
  const extension = path.split('.').pop()?.toLowerCase();
  return !(extension === 'atlastemplate' && isForgeAtlasRoleMirror(document));
}
