import {
  makeForgeStyleId,
  normalizeForgeCustomBorder,
  normalizeForgeCustomTheme,
  type ForgeCustomBorder,
  type ForgeCustomTheme,
} from './styleLibrary.ts';

export const FORGE_STYLE_PACKAGE_FORMAT = 'statblock-forge-style';
export const FORGE_STYLE_PACKAGE_VERSION = 1;
export const FORGE_STYLE_PACKAGE_EXTENSION = 'forgestyle';
export const MAX_FORGE_STYLE_PACKAGE_BYTES = 512 * 1024;
export const MAX_FORGE_STYLES_PER_PACKAGE = 100;

export type ForgeStylePackageKind = 'theme' | 'border' | 'collection';

export interface ForgeStylePackage {
  format: typeof FORGE_STYLE_PACKAGE_FORMAT;
  version: typeof FORGE_STYLE_PACKAGE_VERSION;
  kind: ForgeStylePackageKind;
  name: string;
  themes: ForgeCustomTheme[];
  borders: ForgeCustomBorder[];
}

export type ForgeStyleImportChoice = 'copy' | 'replace' | 'skip';

export interface ForgeStyleImportOptions {
  themeChoices?: readonly ForgeStyleImportChoice[];
  borderChoices?: readonly ForgeStyleImportChoice[];
  themeNames?: readonly string[];
  borderNames?: readonly string[];
}

export interface ForgeStyleImportResult {
  themes: ForgeCustomTheme[];
  borders: ForgeCustomBorder[];
  addedThemes: number;
  replacedThemes: number;
  skippedThemes: number;
  addedBorders: number;
  replacedBorders: number;
  skippedBorders: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const PACKAGE_KEYS = ['format', 'version', 'kind', 'name', 'themes', 'borders'] as const;
const THEME_KEYS = ['id', 'name', 'palette'] as const;
const PALETTE_KEYS = ['background', 'surface', 'raised', 'border', 'accent', 'accentStrong', 'text', 'muted'] as const;
const BORDER_KEYS = ['id', 'name', 'style', 'color', 'width', 'radius', 'inner', 'innerColor', 'innerWidth', 'innerGap'] as const;

/**
 * Style packages are data-only. They never accept CSS, HTML, scripts, URLs,
 * event handlers, executable expressions, or arbitrary extension properties.
 * The allowlisted schema below is the only import surface.
 */
const UNSAFE_TEXT = /[<>\u0000-\u001f]|(?:javascript|vbscript|data|file)\s*:|https?:\/\/|\b(?:on[a-z]+\s*=|@import|expression\s*\(|url\s*\(|eval\s*\(|function\s*\(|new\s+Function|document\s*\.|window\s*\.|globalThis\s*\.)/i;

function assertExactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key) || key === '__proto__' || key === 'prototype' || key === 'constructor') {
      throw new Error(`The style package contains unsupported ${label} data.`);
    }
  }
}

function assertSafeText(value: unknown, label: string, maxLength: number): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength || UNSAFE_TEXT.test(value)) {
    throw new Error(`The style package contains unsafe ${label}. Only plain text is allowed.`);
  }
}

function normalizedName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function safePackageName(value: unknown): string {
  if (value === undefined) return 'Shared styles';
  assertSafeText(value, 'package name', 80);
  return value.trim();
}

function isValidPackageTheme(value: unknown): boolean {
  if (!isRecord(value)) return false;
  assertExactKeys(value, THEME_KEYS, 'theme');
  assertSafeText(value.name, 'theme name', 64);
  const palette = value.palette;
  if (!isRecord(palette)) return false;
  assertExactKeys(palette, PALETTE_KEYS, 'palette');
  return normalizeForgeCustomTheme(value) !== null;
}

function isBoundedNumber(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isValidPackageBorder(value: unknown): boolean {
  if (!isRecord(value)) return false;
  assertExactKeys(value, BORDER_KEYS, 'border');
  assertSafeText(value.name, 'border name', 64);
  if (!['none', 'solid', 'double', 'dashed', 'dotted', 'groove', 'ridge'].includes(String(value.style))) return false;
  if (typeof value.inner !== 'boolean') return false;
  if (!isBoundedNumber(value.width, 0, 16) || !isBoundedNumber(value.radius, 0, 48)
    || !isBoundedNumber(value.innerWidth, 0, 8) || !isBoundedNumber(value.innerGap, 0, 24)) return false;
  return normalizeForgeCustomBorder(value) !== null;
}

function assertStyleCount(themes: unknown[], borders: unknown[]): void {
  if (themes.length + borders.length > MAX_FORGE_STYLES_PER_PACKAGE) {
    throw new Error(`A style package can contain at most ${MAX_FORGE_STYLES_PER_PACKAGE} styles.`);
  }
}

export function createForgeStylePackage(
  name: string,
  themes: readonly ForgeCustomTheme[],
  borders: readonly ForgeCustomBorder[],
): ForgeStylePackage {
  const safeThemes = themes.map((theme) => normalizeForgeCustomTheme(theme));
  const safeBorders = borders.map((border) => normalizeForgeCustomBorder(border));
  if (safeThemes.some((theme) => !theme) || safeBorders.some((border) => !border)) {
    throw new Error('One or more styles contain invalid data and cannot be exported.');
  }
  const normalizedThemes = safeThemes as ForgeCustomTheme[];
  const normalizedBorders = safeBorders as ForgeCustomBorder[];
  for (const theme of normalizedThemes) assertSafeText(theme.name, 'theme name', 64);
  for (const border of normalizedBorders) assertSafeText(border.name, 'border name', 64);
  assertStyleCount(normalizedThemes, normalizedBorders);
  if (normalizedThemes.length + normalizedBorders.length === 0) {
    throw new Error('There are no custom themes or borders to export.');
  }
  const kind: ForgeStylePackageKind = normalizedThemes.length && normalizedBorders.length
    ? 'collection' : normalizedThemes.length ? 'theme' : 'border';
  return {
    format: FORGE_STYLE_PACKAGE_FORMAT,
    version: FORGE_STYLE_PACKAGE_VERSION,
    kind,
    name: safePackageName(name),
    themes: normalizedThemes,
    borders: normalizedBorders,
  };
}

export function serializeForgeStylePackage(stylePackage: ForgeStylePackage): string {
  return `${JSON.stringify(stylePackage, null, 2)}\n`;
}

export function parseForgeStylePackage(source: string): ForgeStylePackage {
  if (new TextEncoder().encode(source).byteLength > MAX_FORGE_STYLE_PACKAGE_BYTES) {
    throw new Error('The .forgestyle file is too large. Maximum size is 512 KB.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    throw new Error('The selected .forgestyle file is not valid JSON.');
  }
  if (!isRecord(parsed) || parsed.format !== FORGE_STYLE_PACKAGE_FORMAT) {
    throw new Error('This file is not a Statblock Forge style package.');
  }
  assertExactKeys(parsed, PACKAGE_KEYS, 'package');
  if (parsed.name !== undefined) assertSafeText(parsed.name, 'package name', 80);
  if (parsed.version !== FORGE_STYLE_PACKAGE_VERSION) {
    throw new Error(`Unsupported .forgestyle version: ${String(parsed.version)}.`);
  }
  if (parsed.kind !== 'theme' && parsed.kind !== 'border' && parsed.kind !== 'collection') {
    throw new Error('The style package has an unknown package type.');
  }
  const rawThemes = parsed.themes === undefined ? [] : parsed.themes;
  const rawBorders = parsed.borders === undefined ? [] : parsed.borders;
  if (!Array.isArray(rawThemes) || !Array.isArray(rawBorders)) {
    throw new Error('The style package has an invalid theme or border list.');
  }
  assertStyleCount(rawThemes, rawBorders);
  if (rawThemes.some((item) => !isValidPackageTheme(item)) || rawBorders.some((item) => !isValidPackageBorder(item))) {
    throw new Error('The style package contains an invalid theme or border. No styles were imported.');
  }
  const themes = rawThemes.map((item) => normalizeForgeCustomTheme(item));
  const borders = rawBorders.map((item) => normalizeForgeCustomBorder(item));
  if (themes.some((theme) => !theme) || borders.some((border) => !border)) {
    throw new Error('The style package contains an invalid theme or border. No styles were imported.');
  }
  const normalizedThemes = themes as ForgeCustomTheme[];
  const normalizedBorders = borders as ForgeCustomBorder[];
  const total = normalizedThemes.length + normalizedBorders.length;
  if (total === 0) throw new Error('The style package does not contain any styles.');
  if (parsed.kind === 'theme' && (normalizedThemes.length === 0 || normalizedBorders.length > 0)) {
    throw new Error('The theme package contents do not match its declared type.');
  }
  if (parsed.kind === 'border' && (normalizedBorders.length === 0 || normalizedThemes.length > 0)) {
    throw new Error('The border package contents do not match its declared type.');
  }
  if (parsed.kind === 'collection' && (normalizedThemes.length === 0 || normalizedBorders.length === 0)) {
    throw new Error('The collection package must contain at least one theme and one border.');
  }
  const themeIds = new Set<string>();
  for (const theme of normalizedThemes) {
    if (themeIds.has(theme.id)) throw new Error('The package contains duplicate theme IDs.');
    themeIds.add(theme.id);
  }
  const borderIds = new Set<string>();
  for (const border of normalizedBorders) {
    if (borderIds.has(border.id)) throw new Error('The package contains duplicate border IDs.');
    borderIds.add(border.id);
  }
  return {
    format: FORGE_STYLE_PACKAGE_FORMAT,
    version: FORGE_STYLE_PACKAGE_VERSION,
    kind: parsed.kind,
    name: safePackageName(parsed.name),
    themes: normalizedThemes,
    borders: normalizedBorders,
  };
}

function findThemeMatch(themes: readonly ForgeCustomTheme[], incoming: ForgeCustomTheme): number {
  const byId = themes.findIndex((theme) => theme.id === incoming.id);
  if (byId >= 0) return byId;
  const name = normalizedName(incoming.name);
  return themes.findIndex((theme) => normalizedName(theme.name) === name);
}

function findBorderMatch(borders: readonly ForgeCustomBorder[], incoming: ForgeCustomBorder): number {
  const byId = borders.findIndex((border) => border.id === incoming.id);
  if (byId >= 0) return byId;
  const name = normalizedName(incoming.name);
  return borders.findIndex((border) => normalizedName(border.name) === name);
}

function uniqueName(desiredName: string, existingNames: readonly string[]): string {
  const used = new Set(existingNames.map(normalizedName));
  const base = desiredName.trim() || 'Imported style';
  if (!used.has(normalizedName(base))) return base;
  const imported = `${base} (Imported)`;
  if (!used.has(normalizedName(imported))) return imported;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base} (Imported ${suffix})`;
    if (!used.has(normalizedName(candidate))) return candidate;
  }
  return `${base} (${Date.now()})`;
}

function uniqueId(id: string, name: string, existingIds: readonly string[]): string {
  if (!existingIds.includes(id)) return id;
  let candidate = makeForgeStyleId(name);
  while (existingIds.includes(candidate)) candidate = makeForgeStyleId(name);
  return candidate;
}

/**
 * Applies user-selected import decisions without silently overwriting the library.
 * Name collisions are case-insensitive; ID matches take precedence for replacement.
 */
export function applyForgeStyleImport(
  stylePackage: ForgeStylePackage,
  currentThemes: readonly ForgeCustomTheme[],
  currentBorders: readonly ForgeCustomBorder[],
  options: ForgeStyleImportOptions = {},
): ForgeStyleImportResult {
  const themes = currentThemes.map((theme) => ({ ...theme, palette: { ...theme.palette } }));
  const borders = currentBorders.map((border) => ({ ...border }));
  const result: ForgeStyleImportResult = {
    themes, borders,
    addedThemes: 0, replacedThemes: 0, skippedThemes: 0,
    addedBorders: 0, replacedBorders: 0, skippedBorders: 0,
  };

  const replacedThemeIndices = new Set<number>();
  stylePackage.themes.forEach((incoming, index) => {
    const choice = options.themeChoices?.[index] ?? 'copy';
    if (choice === 'skip') { result.skippedThemes += 1; return; }
    const matchIndex = findThemeMatch(themes, incoming);
    const requestedName = options.themeNames?.[index] ?? incoming.name;
    if (requestedName.trim()) assertSafeText(requestedName, 'imported theme name', 64);
    if (choice === 'replace' && matchIndex >= 0 && !replacedThemeIndices.has(matchIndex)) {
      const target = themes[matchIndex]!;
      themes[matchIndex] = { ...incoming, id: target.id, name: requestedName.trim() || target.name, palette: { ...incoming.palette } };
      replacedThemeIndices.add(matchIndex);
      result.replacedThemes += 1;
      return;
    }
    const name = uniqueName(requestedName, themes.map((theme) => theme.name));
    const id = uniqueId(incoming.id, name, themes.map((theme) => theme.id));
    themes.push({ ...incoming, id, name, palette: { ...incoming.palette } });
    result.addedThemes += 1;
  });

  const replacedBorderIndices = new Set<number>();
  stylePackage.borders.forEach((incoming, index) => {
    const choice = options.borderChoices?.[index] ?? 'copy';
    if (choice === 'skip') { result.skippedBorders += 1; return; }
    const matchIndex = findBorderMatch(borders, incoming);
    const requestedName = options.borderNames?.[index] ?? incoming.name;
    if (requestedName.trim()) assertSafeText(requestedName, 'imported border name', 64);
    if (choice === 'replace' && matchIndex >= 0 && !replacedBorderIndices.has(matchIndex)) {
      const target = borders[matchIndex]!;
      borders[matchIndex] = { ...incoming, id: target.id, name: requestedName.trim() || target.name };
      replacedBorderIndices.add(matchIndex);
      result.replacedBorders += 1;
      return;
    }
    const name = uniqueName(requestedName, borders.map((border) => border.name));
    const id = uniqueId(incoming.id, name, borders.map((border) => border.id));
    borders.push({ ...incoming, id, name });
    result.addedBorders += 1;
  });

  result.themes = themes;
  result.borders = borders;
  return result;
}

export function downloadForgeStylePackage(stylePackage: ForgeStylePackage, suggestedName: string): void {
  const slug = suggestedName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'forge-styles';
  const blob = new Blob([serializeForgeStylePackage(stylePackage)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slug}.${FORGE_STYLE_PACKAGE_EXTENSION}`;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
