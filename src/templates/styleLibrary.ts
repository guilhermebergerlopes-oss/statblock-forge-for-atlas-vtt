import { isThemeHexColor, type StatblockThemePalette } from './statblockThemes.ts';

export interface ForgeCustomTheme {
  id: string;
  name: string;
  palette: StatblockThemePalette;
}

export type ForgeBorderStyle = 'none' | 'solid' | 'double' | 'dashed' | 'dotted' | 'groove' | 'ridge';

/** A complete, portable border design. It can live in the plugin library or in a template snapshot. */
export interface ForgeCustomBorder {
  id: string;
  name: string;
  style: ForgeBorderStyle;
  color: string;
  width: number;
  radius: number;
  inner: boolean;
  innerColor: string;
  innerWidth: number;
  innerGap: number;
}

const PALETTE_KEYS = ['background', 'surface', 'raised', 'border', 'accent', 'accentStrong', 'text', 'muted'] as const;
const BORDER_STYLES = new Set<ForgeBorderStyle>(['none', 'solid', 'double', 'dashed', 'dotted', 'groove', 'ridge']);

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function cleanName(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, 64)
    : fallback;
}

function cleanId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const id = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{1,63}$/.test(id) ? id : null;
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value)) : fallback;
}

export function normalizeForgeCustomTheme(value: unknown): ForgeCustomTheme | null {
  const source = record(value);
  if (!source) return null;
  const id = cleanId(source.id);
  const rawPalette = record(source.palette);
  if (!id || !rawPalette) return null;
  const palette = {} as StatblockThemePalette;
  for (const key of PALETTE_KEYS) {
    const candidate = rawPalette[key];
    if (!isThemeHexColor(candidate)) return null;
    palette[key] = candidate.toLowerCase();
  }
  return { id, name: cleanName(source.name, 'Custom theme'), palette };
}

export function normalizeForgeCustomThemes(value: unknown): ForgeCustomTheme[] {
  if (!Array.isArray(value)) return [];
  const result: ForgeCustomTheme[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const theme = normalizeForgeCustomTheme(item);
    if (!theme || seen.has(theme.id)) continue;
    seen.add(theme.id);
    result.push(theme);
  }
  return result;
}

export function normalizeForgeCustomBorder(value: unknown): ForgeCustomBorder | null {
  const source = record(value);
  if (!source) return null;
  const id = cleanId(source.id);
  if (!id || !isThemeHexColor(source.color) || !isThemeHexColor(source.innerColor)) return null;
  const style = typeof source.style === 'string' && BORDER_STYLES.has(source.style as ForgeBorderStyle)
    ? source.style as ForgeBorderStyle : 'solid';
  return {
    id,
    name: cleanName(source.name, 'Custom border'),
    style,
    color: source.color.toLowerCase(),
    width: boundedNumber(source.width, 2, 0, 16),
    radius: boundedNumber(source.radius, 8, 0, 48),
    inner: source.inner === true,
    innerColor: source.innerColor.toLowerCase(),
    innerWidth: boundedNumber(source.innerWidth, 1, 0, 8),
    innerGap: boundedNumber(source.innerGap, 4, 0, 24),
  };
}

export function normalizeForgeCustomBorders(value: unknown): ForgeCustomBorder[] {
  if (!Array.isArray(value)) return [];
  const result: ForgeCustomBorder[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const border = normalizeForgeCustomBorder(item);
    if (!border || seen.has(border.id)) continue;
    seen.add(border.id);
    result.push(border);
  }
  return result;
}

export function createForgeBorderPreset(
  id: string,
  name: string,
  style: ForgeBorderStyle,
  color: string,
): ForgeCustomBorder {
  return {
    id,
    name,
    style,
    color: isThemeHexColor(color) ? color.toLowerCase() : '#7f6df2',
    width: style === 'none' ? 0 : style === 'double' ? 4 : 2,
    radius: 8,
    inner: false,
    innerColor: '#ffffff',
    innerWidth: 1,
    innerGap: 3,
  };
}

export function makeForgeStyleId(name: string): string {
  const base = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'custom';
  const suffix = Math.random().toString(36).slice(2, 7).padEnd(5, '0');
  return `${base}-${suffix}`;
}
