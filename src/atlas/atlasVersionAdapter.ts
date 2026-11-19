/**
 * Version-aware Atlas compatibility profiles.
 *
 * These profiles describe file-format compatibility only. They intentionally
 * expose no runtime hooks: Atlas recognizes `.atlastemplate` files, while
 * `.forgetemplate` instances are rendered and edited by the Forge-owned view.
 */

export interface ParsedSemanticVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

export interface AtlasVersionRange {
  minInclusive: string;
  maxInclusive: string;
}

export type AtlasAdapterResolutionKind =
  | 'verified-version'
  | 'generic-file-only'
  | 'standalone';

export interface AtlasAdapterResolution {
  kind: AtlasAdapterResolutionKind;
  adapterId: string;
  label: string;
  detectedVersion: string | null;
  verifiedRange: AtlasVersionRange | null;
  templateFiles: 'verified' | 'best-effort' | 'standalone';
  runtimeMode: 'standalone';
  runtimeHooks: readonly string[];
  explanation: string;
}

/** The original Atlas source snapshot used for the generic file-format profile. */
export const ATLAS_VERIFIED_SNAPSHOT = '0.13.2-beta.0';
const VERIFIED_PROFILES: readonly {
  id: string;
  label: string;
  range: AtlasVersionRange;
}[] = [
  {
    id: 'atlas-0.13.2-beta.0-file-profile',
    label: 'Atlas 0.13.2-beta.0 — formato de arquivo verificado',
    range: {
      minInclusive: ATLAS_VERIFIED_SNAPSHOT,
      maxInclusive: ATLAS_VERIFIED_SNAPSHOT,
    },
  },
];

/** Parse a strict numeric semantic version with an optional prerelease/build. */
export function parseSemanticVersion(input: string): ParsedSemanticVersion | null {
  const value = input.trim().replace(/^v(?=\d)/i, '');
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/.exec(value);
  if (!match) return null;

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (![major, minor, patch].every(Number.isSafeInteger)) return null;

  const prerelease = match[4] ? match[4].split('.') : [];
  const build = match[5] ? match[5].split('.') : [];
  if (prerelease.some((part) => part.length === 0 || !/^[0-9A-Za-z-]+$/.test(part))) return null;
  if (prerelease.some((part) => /^\d+$/.test(part) && part.length > 1 && part.startsWith('0'))) return null;
  if (build.some((part) => part.length === 0 || !/^[0-9A-Za-z-]+$/.test(part))) return null;
  return { major, minor, patch, prerelease };
}

function comparePrerelease(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 && right.length === 0) return 0;
  if (left.length === 0) return 1;
  if (right.length === 0) return -1;

  const count = Math.max(left.length, right.length);
  for (let index = 0; index < count; index += 1) {
    const a = left[index];
    const b = right[index];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    if (a === b) continue;

    const aNumeric = /^\d+$/.test(a);
    const bNumeric = /^\d+$/.test(b);
    if (aNumeric && bNumeric) {
      // Compare arbitrary-length numeric identifiers without Number precision loss.
      if (a.length !== b.length) return a.length < b.length ? -1 : 1;
      return a < b ? -1 : 1;
    }
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
    return a < b ? -1 : 1;
  }
  return 0;
}

/** Compare two semantic versions. Returns null when either value is invalid. */
export function compareSemanticVersions(left: string, right: string): number | null {
  const a = parseSemanticVersion(left);
  const b = parseSemanticVersion(right);
  if (!a || !b) return null;

  for (const key of ['major', 'minor', 'patch'] as const) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  return comparePrerelease(a.prerelease, b.prerelease);
}

export function isVersionInRange(version: string, range: AtlasVersionRange): boolean {
  const aboveMinimum = compareSemanticVersions(version, range.minInclusive);
  const belowMaximum = compareSemanticVersions(version, range.maxInclusive);
  return aboveMinimum !== null && belowMaximum !== null
    && aboveMinimum >= 0 && belowMaximum <= 0;
}

/**
 * Selects the narrowest profile supported by inspected source evidence.
 * Unknown versions retain file-only compatibility and never activate hooks.
 */
export function resolveAtlasVersionAdapter(version: string | null | undefined): AtlasAdapterResolution {
  const normalized = typeof version === 'string' ? version.trim().replace(/^v(?=\d)/i, '') : '';
  if (!normalized) {
    return {
      kind: 'standalone',
      adapterId: 'forge-standalone',
      label: 'Modo independente do Forge',
      detectedVersion: null,
      verifiedRange: null,
      templateFiles: 'standalone',
      runtimeMode: 'standalone',
      runtimeHooks: [],
      explanation: 'Nenhuma versão do Atlas foi identificada. O editor e o renderizador do Forge continuam independentes; templates Atlas ainda podem ser importados manualmente por arquivo.',
    };
  }

  const parsed = parseSemanticVersion(normalized);
  if (!parsed) {
    return {
      kind: 'standalone',
      adapterId: 'forge-standalone-invalid-version',
      label: 'Modo independente — versão do Atlas inválida',
      detectedVersion: normalized,
      verifiedRange: null,
      templateFiles: 'standalone',
      runtimeMode: 'standalone',
      runtimeHooks: [],
      explanation: 'O manifesto contém uma versão que não segue o padrão semântico esperado. Nenhum adaptador versionado será ativado.',
    };
  }

  const profile = VERIFIED_PROFILES.find((candidate) => isVersionInRange(normalized, candidate.range));
  if (profile) {
    return {
      kind: 'verified-version',
      adapterId: profile.id,
      label: profile.label,
      detectedVersion: normalized,
      verifiedRange: profile.range,
      templateFiles: 'verified',
      runtimeMode: 'standalone',
      runtimeHooks: [],
      explanation: 'A versão corresponde exatamente ao snapshot do Atlas fornecido e inspecionado. A compatibilidade verificada limita-se ao formato de arquivos de template; nenhum hook de runtime é ativado.',
    };
  }

  return {
    kind: 'generic-file-only',
    adapterId: 'atlas-generic-template-file-compatibility',
    label: `Atlas ${normalized} — compatibilidade genérica por arquivo`,
    detectedVersion: normalized,
    verifiedRange: null,
    templateFiles: 'best-effort',
    runtimeMode: 'standalone',
    runtimeHooks: [],
    explanation: 'Esta versão não corresponde a um snapshot de código verificado. O Forge mantém somente a compatibilidade genérica com arquivos .atlastemplate; nenhuma integração de runtime é ativada.',
  };
}
