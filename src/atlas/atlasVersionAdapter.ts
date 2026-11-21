/**
 * Version-aware Atlas integration profiles.
 *
 * Atlas 0.17.0 and 0.18.0 are exact source snapshots inspected for direct
 * internal-runtime access. Later semantic versions use the nearest baseline
 * and are enabled through forward-compatible, feature-level capability checks.
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
  | 'forward-compatible-version'
  | 'generic-file-only'
  | 'standalone';

export type AtlasRuntimeMode = 'internal-runtime' | 'standalone';

export interface AtlasAdapterResolution {
  kind: AtlasAdapterResolutionKind;
  adapterId: string;
  label: string;
  detectedVersion: string | null;
  verifiedRange: AtlasVersionRange | null;
  templateFiles: 'verified' | 'best-effort' | 'standalone';
  runtimeMode: AtlasRuntimeMode;
  runtimeHooks: readonly string[];
  explanation: string;
}

/** Latest exact Atlas source snapshot supplied and inspected for this transition. */
export const ATLAS_VERIFIED_SNAPSHOT = '0.18.0';

/** Minimum runtime generation accepted by Forge's capability-checked adapter. */
export const ATLAS_RUNTIME_MINIMUM_VERSION = '0.17.0';
export const ATLAS_DICE_PRESETS_MINIMUM_VERSION = '0.18.0';

/** Internal contracts confirmed in the original Atlas 0.17.0 source snapshot. */
export const ATLAS_0170_RUNTIME_HOOKS: readonly string[] = Object.freeze([
  "Workspace.getLeavesOfType('atlas-vtt')",
  'AtlasView.serviceManager',
  'AtlasView.atlasStore',
  'ServiceManager.getRendererService()',
  'ServiceManager.getToolController()',
  'ServiceManager.getNotePreviewUIManager()',
  'ServiceManager.getAssetService()',
  'ServiceManager.getStore()',
  'ServiceManager.getEventBus()',
  'ToolController.getDiceTool()',
  'DiceTool.rollDice(formula, source, origin, options)',
  'NotePreviewUIManager.showOrCreatePreview()',
  'NotePreviewUIManager.hideAllUnpinnedPreviews()',
  'AssetService.loadedTokenAssets()/getTokenAssets()/addTokenAsset()',
  'TokenRenderer.statblockSync.tokenStatblockLinkService',
]);

/** Internal contracts rechecked against the supplied original Atlas 0.18.0 source snapshot. */
export const ATLAS_0180_RUNTIME_HOOKS: readonly string[] = Object.freeze([
  "Workspace.getLeavesOfType('atlas-vtt')",
  'AtlasView.serviceManager',
  'AtlasView.atlasStore',
  'ServiceManager.getRendererService()',
  'ServiceManager.getToolController()',
  'ServiceManager.getNotePreviewUIManager()',
  'ServiceManager.getAssetService()',
  'ServiceManager.getStore()',
  'ServiceManager.getEventBus()',
  'ToolController.getDiceTool()',
  'DiceTool.rollDice(formula, source, origin, options)',
  'NotePreviewUIManager.showOrCreatePreview()',
  'NotePreviewUIManager.hideAllUnpinnedPreviews()',
  'AssetService.loadedTokenAssets()/getTokenAssets()/addTokenAsset()',
  'AssetService.getCollections()/loadedCollections()/getDefaultCollectionId()',
  'AssetService.getCollectionSettings()/updateCollectionSettings()',
  'TokenRenderer.statblockSync.tokenStatblockLinkService',
  'TypedEventEmitter.on()/off()',
  'DiceTool written adv/dis formula handling',
]);

const VERIFIED_PROFILES: readonly {
  id: string;
  label: string;
  range: AtlasVersionRange;
  runtimeHooks: readonly string[];
}[] = [
  {
    id: 'atlas-0.17.0-internal-runtime',
    label: 'Atlas 0.17.0 — runtime interno verificado',
    range: { minInclusive: '0.17.0', maxInclusive: '0.17.0' },
    runtimeHooks: ATLAS_0170_RUNTIME_HOOKS,
  },
  {
    id: 'atlas-0.18.0-internal-runtime',
    label: 'Atlas 0.18.0 — runtime interno verificado',
    range: { minInclusive: ATLAS_VERIFIED_SNAPSHOT, maxInclusive: ATLAS_VERIFIED_SNAPSHOT },
    runtimeHooks: ATLAS_0180_RUNTIME_HOOKS,
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

/** Selects an exact inspected profile or the nearest forward-compatible baseline. */
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
      runtimeMode: 'internal-runtime',
      runtimeHooks: profile.runtimeHooks,
      explanation: `A versão corresponde exatamente ao snapshot original do Atlas ${profile.range.minInclusive} fornecido e inspecionado. Os contratos internos listados foram confirmados diretamente nesse código-fonte.`,
    };
  }

  const meetsRuntimeMinimum = compareSemanticVersions(normalized, ATLAS_RUNTIME_MINIMUM_VERSION);
  if (meetsRuntimeMinimum !== null && meetsRuntimeMinimum >= 0) {
    const comparisonTo018 = compareSemanticVersions(normalized, ATLAS_DICE_PRESETS_MINIMUM_VERSION);
    const uses018Baseline = comparisonTo018 !== null && comparisonTo018 >= 0;
    const baselineVersion = uses018Baseline ? ATLAS_DICE_PRESETS_MINIMUM_VERSION : ATLAS_RUNTIME_MINIMUM_VERSION;
    const baselineHooks = uses018Baseline ? ATLAS_0180_RUNTIME_HOOKS : ATLAS_0170_RUNTIME_HOOKS;
    return {
      kind: 'forward-compatible-version',
      adapterId: `atlas-forward-compatible-${baselineVersion}-runtime`,
      label: `Atlas ${normalized} — compatibilidade por recursos (base ${baselineVersion})`,
      detectedVersion: normalized,
      verifiedRange: null,
      templateFiles: 'best-effort',
      runtimeMode: 'internal-runtime',
      runtimeHooks: baselineHooks,
      explanation: `Esta versão é posterior ao mínimo ${ATLAS_RUNTIME_MINIMUM_VERSION} e será usada com o contrato-base Atlas ${baselineVersion}. A versão exata não foi inspecionada; cada recurso dependente do runtime deve confirmar os métodos e serviços necessários antes de operar. Recursos cuja API tenha mudado podem permanecer indisponíveis.`,
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
    explanation: `Esta versão é anterior ao mínimo de runtime ${ATLAS_RUNTIME_MINIMUM_VERSION}. O Forge mantém somente a compatibilidade genérica com arquivos .atlastemplate; nenhuma integração interna de runtime é ativada.`,
  };
}
