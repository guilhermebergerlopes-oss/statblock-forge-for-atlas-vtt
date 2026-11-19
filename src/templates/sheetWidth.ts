/** Frontmatter/JSON key for an optional per-statblock width override. */
export const FORGE_STATBLOCK_SHEET_WIDTH_KEY = '__forgeSheetWidth';

/** Shared editor/rendered statblock width bounds in CSS pixels. */
export const DEFAULT_FORGE_SHEET_WIDTH = 560;
export const MIN_FORGE_SHEET_WIDTH = 400;
export const MAX_FORGE_SHEET_WIDTH = 1200;
export const STEP_FORGE_SHEET_WIDTH = 10;

export function normalizeForgeSheetWidth(value: unknown, fallback = DEFAULT_FORGE_SHEET_WIDTH): number {
  const safeFallback = Number.isFinite(fallback)
    ? Math.max(MIN_FORGE_SHEET_WIDTH, Math.min(MAX_FORGE_SHEET_WIDTH, Math.round(fallback / STEP_FORGE_SHEET_WIDTH) * STEP_FORGE_SHEET_WIDTH))
    : DEFAULT_FORGE_SHEET_WIDTH;
  if (typeof value !== 'number' || !Number.isFinite(value)) return safeFallback;
  const clamped = Math.max(MIN_FORGE_SHEET_WIDTH, Math.min(MAX_FORGE_SHEET_WIDTH, value));
  return Math.round(clamped / STEP_FORGE_SHEET_WIDTH) * STEP_FORGE_SHEET_WIDTH;
}

/** A statblock-level override wins; otherwise the template width is inherited. */
export function resolveForgeSheetWidth(override: unknown, templateWidth: unknown): number {
  return typeof override === 'number' && Number.isFinite(override)
    ? normalizeForgeSheetWidth(override)
    : normalizeForgeSheetWidth(templateWidth);
}
