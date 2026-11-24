import type { BlockAppearance } from './forgeTemplate.ts';

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const LEGACY_TOKEN_PREFIX = 'atlas-appearance-';

export interface LegacyBlockAppearanceMigration {
  appearance: BlockAppearance;
  className?: string;
  migrated: boolean;
  removed: boolean;
}

function clamp(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(min, Math.min(max, value));
}

function color(value: unknown): string | undefined {
  return typeof value === 'string' && COLOR_PATTERN.test(value) ? value.toLowerCase() : undefined;
}

function rgba(hex: string, opacity: number): string {
  const normalized = hex.slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(100, opacity)) / 100})`;
}

function tokensOf(className: string | undefined): string[] {
  return (className ?? '').split(/\s+/).map((token) => token.trim()).filter(Boolean);
}

function setMissing(target: Record<string, unknown>, key: string, value: unknown): void {
  if (target[key] === undefined) target[key] = value;
}

/**
 * Moves legacy Forge-generated appearance tokens out of TemplateBlock.className
 * and into the canonical per-block Forge sidecar. Atlas itself does not
 * implement these tokens, so retaining them in className was misleading.
 */
export function migrateLegacyBlockAppearanceTokens(
  className: string | undefined,
  existingAppearance: unknown = {},
): LegacyBlockAppearanceMigration {
  const originalAppearance = normalizeBlockAppearance(existingAppearance);
  const appearance = { ...originalAppearance } as BlockAppearance;
  const hasOriginal = (key: keyof BlockAppearance): boolean => originalAppearance[key] !== undefined;
  const remaining: string[] = [];
  let migrated = false;
  let removed = false;

  for (const token of tokensOf(className)) {
    const lower = token.toLowerCase();
    if (!lower.startsWith(LEGACY_TOKEN_PREFIX)) {
      remaining.push(token);
      continue;
    }
    removed = true;
    const choice = /^atlas-appearance-(radius|align|padding|border|background|shadow)-([a-z]+)$/.exec(lower);
    const colorToken = /^atlas-appearance-(border|background|shadow|boxes|gauge)-color-([0-9a-f]{6})$/.exec(lower);

    if (choice) {
      const [, family, value] = choice;
      let recognized = true;
      switch (family) {
        case 'radius':
          if (value === 'none') setMissing(appearance as Record<string, unknown>, 'shape', 'square');
          else if (value === 'pill') setMissing(appearance as Record<string, unknown>, 'shape', 'oval');
          else if (value === 'small' || value === 'medium' || value === 'large') {
            setMissing(appearance as Record<string, unknown>, 'shape', 'rounded');
            setMissing(appearance as Record<string, unknown>, 'cornerRadius', value === 'small' ? 4 : value === 'medium' ? 8 : 14);
          } else recognized = false;
          break;
        case 'align':
          if (value === 'left' || value === 'center' || value === 'right') {
            const align = value === 'left' ? 'start' : value === 'right' ? 'end' : 'center';
            setMissing(appearance as Record<string, unknown>, 'textAlign', align);
            setMissing(appearance as Record<string, unknown>, 'contentAlign', align);
          } else recognized = false;
          break;
        case 'padding':
          if (value === 'compact' || value === 'comfortable' || value === 'spacious') {
            setMissing(appearance as Record<string, unknown>, 'padding', value === 'compact' ? 6 : value === 'comfortable' ? 12 : 18);
          } else recognized = false;
          break;
        case 'border':
          if (value === 'none' || value === 'subtle' || value === 'strong') {
            setMissing(appearance as Record<string, unknown>, 'borderStyle', value === 'none' ? 'none' : 'solid');
            setMissing(appearance as Record<string, unknown>, 'borderWidth', value === 'none' ? 0 : value === 'strong' ? 2 : 1);
          } else recognized = false;
          break;
        case 'background':
          if (value === 'transparent' || value === 'subtle') {
            setMissing(appearance as Record<string, unknown>, 'backgroundStyle', value);
            if (value === 'transparent') setMissing(appearance as Record<string, unknown>, 'backgroundOpacity', 0);
          } else recognized = false;
          break;
        case 'shadow':
          if (value === 'none' || value === 'subtle' || value === 'strong') {
            setMissing(appearance as Record<string, unknown>, 'shadowColor', '#000000');
            setMissing(appearance as Record<string, unknown>, 'shadowBlur', value === 'none' ? 0 : value === 'subtle' ? 5 : 12);
            setMissing(appearance as Record<string, unknown>, 'shadowOffsetX', 0);
            setMissing(appearance as Record<string, unknown>, 'shadowOffsetY', value === 'none' ? 0 : value === 'subtle' ? 1 : 4);
            setMissing(appearance as Record<string, unknown>, 'shadowSpread', 0);
            setMissing(appearance as Record<string, unknown>, 'shadowOpacity', value === 'none' ? 0 : value === 'subtle' ? 12 : 18);
          } else recognized = false;
          break;
      }
      migrated ||= recognized;
      continue;
    }

    if (colorToken) {
      const [, family, hex] = colorToken;
      const parsed = `#${hex}`;
      switch (family) {
        case 'border':
          if (!hasOriginal('borderColor')) appearance.borderColor = parsed;
          // The old color control changed a `none` border preset to `subtle`
          // when a custom border color was enabled.
          if (!hasOriginal('borderStyle') && appearance.borderStyle === 'none') appearance.borderStyle = 'solid';
          if (!hasOriginal('borderWidth') && appearance.borderWidth === 0) appearance.borderWidth = 1;
          setMissing(appearance as Record<string, unknown>, 'borderStyle', 'solid');
          setMissing(appearance as Record<string, unknown>, 'borderWidth', 1);
          break;
        case 'background':
          if (!hasOriginal('background') && appearance.backgroundOpacity !== 0) appearance.background = parsed;
          break;
        case 'shadow':
          if (!hasOriginal('shadowColor')) appearance.shadowColor = parsed;
          // The old color control also promoted a `none` shadow preset to `subtle`.
          if (!hasOriginal('shadowBlur') && appearance.shadowBlur === 0) appearance.shadowBlur = 5;
          if (!hasOriginal('shadowOffsetY') && appearance.shadowOffsetY === 0) appearance.shadowOffsetY = 1;
          if (!hasOriginal('shadowOpacity') && appearance.shadowOpacity === 0) appearance.shadowOpacity = 24;
          setMissing(appearance as Record<string, unknown>, 'shadowBlur', 5);
          setMissing(appearance as Record<string, unknown>, 'shadowOffsetY', 1);
          setMissing(appearance as Record<string, unknown>, 'shadowOpacity', 24);
          break;
        case 'boxes':
          if (!hasOriginal('trackFillColor')) appearance.trackFillColor = parsed;
          if (!hasOriginal('trackBorderColor')) appearance.trackBorderColor = parsed;
          break;
        case 'gauge':
          if (!hasOriginal('trackFillColor')) appearance.trackFillColor = parsed;
          break;
      }
      migrated = true;
    }
    // Unknown Forge-only appearance tokens are removed instead of leaking to Atlas.
  }

  return {
    appearance: normalizeBlockAppearance(appearance),
    ...(remaining.length ? { className: remaining.join(' ') } : {}),
    migrated,
    removed,
  };
}

/** Removes Forge-only appearance tokens and preserves every unrelated class. */
export function stripLegacyBlockAppearanceTokens(className: string | undefined): string | undefined {
  const remaining = tokensOf(className).filter((token) => !token.toLowerCase().startsWith(LEGACY_TOKEN_PREFIX));
  return remaining.length ? remaining.join(' ') : undefined;
}

/** Normalize old and partially written sidecar styles without dropping unknown future keys. */
export function normalizeBlockAppearance(value: unknown): BlockAppearance {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const result = { ...record } as BlockAppearance;
  if (record.appearanceMode === 'theme' || record.appearanceMode === 'custom') result.appearanceMode = record.appearanceMode;
  else delete result.appearanceMode;
  if (record.shape === 'square' || record.shape === 'rounded' || record.shape === 'oval') result.shape = record.shape;
  else delete result.shape;
  if (record.borderStyle === 'solid' || record.borderStyle === 'dashed' || record.borderStyle === 'dotted'
    || record.borderStyle === 'double' || record.borderStyle === 'none') result.borderStyle = record.borderStyle;
  else delete result.borderStyle;
  if (record.borderPreset === 'default' || record.borderPreset === 'double' || record.borderPreset === 'oval'
    || record.borderPreset === 'diamond' || record.borderPreset === 'regular-hexagon'
    || record.borderPreset === 'triangle-up' || record.borderPreset === 'triangle-right'
    || record.borderPreset === 'triangle-down' || record.borderPreset === 'triangle-left'
    || record.borderPreset === 'pointed' || record.borderPreset === 'angular'
    || record.borderPreset === 'hexagonal' || record.borderPreset === 'shield') {
    result.borderPreset = record.borderPreset;
  } else delete result.borderPreset;
  if (record.textAlign === 'start' || record.textAlign === 'center' || record.textAlign === 'end') result.textAlign = record.textAlign;
  else delete result.textAlign;
  if (record.contentAlign === 'start' || record.contentAlign === 'center' || record.contentAlign === 'end') result.contentAlign = record.contentAlign;
  else delete result.contentAlign;
  if (record.backgroundStyle === 'transparent' || record.backgroundStyle === 'subtle') result.backgroundStyle = record.backgroundStyle;
  else delete result.backgroundStyle;
  if (record.verticalAlign === 'start' || record.verticalAlign === 'center' || record.verticalAlign === 'end') result.verticalAlign = record.verticalAlign;
  else delete result.verticalAlign;
  if (record.imageFit === 'cover' || record.imageFit === 'contain') result.imageFit = record.imageFit;
  else delete result.imageFit;

  for (const key of [
    'background', 'borderColor', 'shadowColor', 'textColor', 'labelColor', 'valueColor',
    'trackFillColor', 'trackEmptyColor', 'trackBorderColor',
  ] as const) {
    const parsed = color(record[key]);
    if (parsed) result[key] = parsed;
    else delete result[key];
  }
  const numeric: Array<[keyof BlockAppearance, number, number]> = [
    ['borderWidth', 0, 16],
    ['cornerRadius', 0, 100],
    ['backgroundOpacity', 0, 100],
    ['shadowBlur', 0, 64],
    ['shadowOffsetX', -32, 32],
    ['shadowOffsetY', -32, 32],
    ['shadowSpread', -16, 32],
    ['shadowOpacity', 0, 100],
    ['padding', 0, 96],
    ['imageZoom', 100, 300],
    ['imagePositionX', 0, 100],
    ['imagePositionY', 0, 100],
  ];
  const typographyNumeric: Array<[keyof BlockAppearance, number, number]> = [
    ['fontSize', 8, 48], ['letterSpacing', -1, 8],
    ['labelFontSize', 8, 48], ['labelLetterSpacing', -1, 8],
    ['valueFontSize', 8, 48], ['valueLetterSpacing', -1, 8],
  ];
  for (const [key, min, max] of [...numeric, ...typographyNumeric]) {
    const parsed = clamp(record[key as string], min, max);
    if (parsed !== undefined) Object.assign(result, { [key]: parsed });
    else delete (result as Record<string, unknown>)[key];
  }
  const typographyChoices: Array<[keyof BlockAppearance, readonly string[]]> = [
    ['fontWeight', ['400', '500', '600', '700']],
    ['labelFontWeight', ['400', '500', '600', '700']],
    ['valueFontWeight', ['400', '500', '600', '700']],
    ['fontStyle', ['normal', 'italic']],
    ['labelFontStyle', ['normal', 'italic']],
    ['valueFontStyle', ['normal', 'italic']],
    ['textDecoration', ['none', 'underline', 'line-through']],
    ['labelTextDecoration', ['none', 'underline', 'line-through']],
    ['valueTextDecoration', ['none', 'underline', 'line-through']],
  ];
  for (const [key, allowed] of typographyChoices) {
    const candidate = record[key as string];
    if (typeof candidate === 'string' && allowed.includes(candidate)) Object.assign(result, { [key]: candidate });
    else delete (result as Record<string, unknown>)[key];
  }
  return result;
}



/**
 * Resolves the same defaults shown by the Block Appearance inspector. Theme mode
 * deliberately returns no overrides; Custom mode materializes its visible
 * defaults so the first render matches the controls before the user edits them.
 */
export function resolveBlockAppearanceForMode(value: unknown, mode: 'theme' | 'custom'): BlockAppearance {
  if (mode !== 'custom') return {};
  const appearance = normalizeBlockAppearance(value);
  const borderPreset = appearance.borderPreset ?? 'default';
  return {
    ...appearance,
    shape: appearance.shape ?? 'rounded',
    ...(appearance.shape === 'rounded' || appearance.shape === undefined
      ? { cornerRadius: appearance.cornerRadius ?? 14 }
      : {}),
    borderStyle: appearance.borderStyle ?? (borderPreset === 'double' ? 'double' : 'solid'),
    borderWidth: appearance.borderWidth ?? (borderPreset === 'double' ? 3 : 1),
    backgroundOpacity: appearance.backgroundOpacity ?? 100,
    textAlign: appearance.textAlign ?? 'start',
    verticalAlign: appearance.verticalAlign ?? 'center',
    padding: appearance.padding ?? 0,
  };
}

/**
 * Removes only appearance values that older Forge releases seeded on every
 * block while the block was still following its theme. Real user overrides
 * (including mixed/default-looking values) are preserved.
 */
export function stripGeneratedThemeAppearanceDefaults(value: BlockAppearance): BlockAppearance {
  const appearance = normalizeBlockAppearance(value);
  const keys = Object.keys(appearance);
  const seeded = appearance.shape === 'rounded'
    && (appearance.padding === undefined || appearance.padding === 0 || appearance.padding === 10)
    && keys.length > 0
    && keys.every((key) => key === 'shape' || key === 'padding');
  return seeded ? {} : appearance;
}

/**
 * Amount by which a nested layout should extend toward its parent block's
 * outer end edge. Child blocks render inside the parent's content box; adding
 * the parent's right padding and border width brings the final child column
 * back to the same right grid line as the parent block.
 */
export function nestedLayoutInlineBleed(value: unknown): number {
  const appearance = normalizeBlockAppearance(value);
  const hasBorderOverride = appearance.borderStyle !== undefined
    || appearance.borderWidth !== undefined || appearance.borderColor !== undefined;
  const borderWidth = !hasBorderOverride || appearance.borderStyle === 'none'
    ? 0
    : appearance.borderWidth ?? 1;
  return (appearance.padding ?? 0) + borderWidth;
}

/** CSS values shared by the editor preview and the future standalone renderer. */
export function buildBlockAppearanceCss(appearance: BlockAppearance): Record<string, string> {
  // Every individual override comes from one Forge-owned sidecar. An empty
  // custom mode stays visually identical to the selected theme.
  const css: Record<string, string> = {};

  if (appearance.padding !== undefined) css.padding = `${appearance.padding}px`;
  if (appearance.textAlign !== undefined) css.textAlign = appearance.textAlign === 'start' ? 'left' : appearance.textAlign === 'end' ? 'right' : 'center';
  if (appearance.contentAlign !== undefined) css.justifyItems = appearance.contentAlign;
  if (appearance.verticalAlign !== undefined) {
    // The preview block is a one-track CSS Grid. `align-content` only positions
    // the grid tracks; its single `1fr` track already fills the block, so it
    // cannot move a Field's content inside that track. `align-items` positions
    // the direct content item within the track instead.
    css.alignItems = appearance.verticalAlign === 'start' ? 'start'
      : appearance.verticalAlign === 'end' ? 'end' : 'center';
  }
  const hasBorderOverride = appearance.borderStyle !== undefined
    || appearance.borderWidth !== undefined || appearance.borderColor !== undefined;
  if (hasBorderOverride) {
    // A color-only override must still draw a border in the Obsidian-default
    // theme, which intentionally has no block frame of its own. The defaults
    // also match the controls shown in the inspector (solid, 1px).
    const borderStyle = appearance.borderStyle ?? 'solid';
    css.borderStyle = borderStyle;
    css.borderWidth = `${borderStyle === 'none' ? 0 : appearance.borderWidth ?? 1}px`;
    css.borderColor = appearance.borderColor ?? 'var(--forge-theme-border, var(--background-modifier-border))';
  }
  if (appearance.background !== undefined) {
    css.backgroundColor = rgba(appearance.background, appearance.backgroundOpacity ?? 100);
  } else if (appearance.backgroundStyle === 'transparent' || appearance.backgroundOpacity === 0) {
    css.backgroundColor = 'transparent';
  } else if (appearance.backgroundStyle === 'subtle') {
    css.backgroundColor = 'var(--forge-theme-surface, var(--background-secondary))';
  } else if (appearance.backgroundOpacity !== undefined && appearance.backgroundOpacity < 100) {
    const base = css.backgroundColor ?? 'var(--forge-theme-surface, var(--background-primary))';
    css.backgroundColor = `color-mix(in srgb, ${base} ${appearance.backgroundOpacity}%, transparent)`;
  }
  const shapedBorder = appearance.borderPreset !== undefined
    && appearance.borderPreset !== 'default' && appearance.borderPreset !== 'double';
  if (shapedBorder) {
    // CSS-only geometric frames use two clipped layers. The outer layer draws
    // the border; the inner layer restores the block's own surface color.
    css['--forge-custom-border-color'] = appearance.borderColor ?? 'var(--forge-theme-border, var(--background-modifier-border))';
    css['--forge-custom-border-width'] = `${appearance.borderWidth ?? 1}px`;
    css['--forge-custom-border-surface'] = css.backgroundColor
      ?? 'var(--forge-theme-surface, var(--background-primary))';
    css.backgroundColor = 'transparent';
  } else if (appearance.borderPreset === 'double') {
    css.borderStyle = 'double';
    css.borderWidth = `${appearance.borderWidth ?? 3}px`;
    if (appearance.borderColor !== undefined) css.borderColor = appearance.borderColor;
  }
  if (appearance.textColor !== undefined) {
    css.color = appearance.textColor;
    css['--forge-block-text-color'] = appearance.textColor;
  }
  if (appearance.labelColor !== undefined) css['--forge-block-label-color'] = appearance.labelColor;
  if (appearance.valueColor !== undefined) css['--forge-block-value-color'] = appearance.valueColor;

  const typographyVariables: Array<[keyof BlockAppearance, string, (value: string | number) => string]> = [
    ['fontSize', '--forge-block-font-size', (value) => `${value}px`],
    ['fontWeight', '--forge-block-font-weight', String],
    ['fontStyle', '--forge-block-font-style', String],
    ['textDecoration', '--forge-block-text-decoration', String],
    ['letterSpacing', '--forge-block-letter-spacing', (value) => `${value}px`],
    ['labelFontSize', '--forge-block-label-font-size', (value) => `${value}px`],
    ['labelFontWeight', '--forge-block-label-font-weight', String],
    ['labelFontStyle', '--forge-block-label-font-style', String],
    ['labelTextDecoration', '--forge-block-label-text-decoration', String],
    ['labelLetterSpacing', '--forge-block-label-letter-spacing', (value) => `${value}px`],
    ['valueFontSize', '--forge-block-value-font-size', (value) => `${value}px`],
    ['valueFontWeight', '--forge-block-value-font-weight', String],
    ['valueFontStyle', '--forge-block-value-font-style', String],
    ['valueTextDecoration', '--forge-block-value-text-decoration', String],
    ['valueLetterSpacing', '--forge-block-value-letter-spacing', (value) => `${value}px`],
  ];
  for (const [key, variable, format] of typographyVariables) {
    const value = appearance[key];
    if (typeof value === 'string' || typeof value === 'number') css[variable] = format(value);
  }
  if (appearance.shape !== undefined) {
    css.borderRadius = appearance.shape === 'oval' ? '9999px'
      : appearance.shape === 'square' ? '0px' : `${appearance.cornerRadius ?? 14}px`;
  } else if (appearance.cornerRadius !== undefined) {
    css.borderRadius = `${appearance.cornerRadius}px`;
  }
  if (appearance.shadowColor !== undefined) {
    css.boxShadow = `${appearance.shadowOffsetX ?? 0}px ${appearance.shadowOffsetY ?? 2}px ${appearance.shadowBlur ?? 0}px ${appearance.shadowSpread ?? 0}px ${rgba(appearance.shadowColor, appearance.shadowOpacity ?? 55)}`;
  } else if (appearance.shadowBlur !== undefined || appearance.shadowOffsetX !== undefined
    || appearance.shadowOffsetY !== undefined || appearance.shadowSpread !== undefined || appearance.shadowOpacity !== undefined) {
    css.boxShadow = `${appearance.shadowOffsetX ?? 0}px ${appearance.shadowOffsetY ?? 2}px ${appearance.shadowBlur ?? 0}px ${appearance.shadowSpread ?? 0}px ${rgba('#000000', appearance.shadowOpacity ?? 55)}`;
  }


  if (appearance.trackFillColor) css['--forge-track-fill'] = appearance.trackFillColor;
  if (appearance.trackEmptyColor) css['--forge-track-empty'] = appearance.trackEmptyColor;
  if (appearance.trackBorderColor) css['--forge-track-border'] = appearance.trackBorderColor;
  return css;
}
