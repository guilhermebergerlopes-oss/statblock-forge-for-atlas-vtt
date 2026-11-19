/**
 * Forge-native statblock themes inspired by the visual language of the
 * supplied Atlas CSS theme pack. The original CSS targets Atlas-private DOM
 * structures, so these presets are expressed against Forge's own renderer.
 */
export type StatblockThemeId =
  | 'default'
  | '5e-parchment'
  | 'astral'
  | 'crystal'
  | 'gilded-obsidian'
  | 'gothic'
  | 'ice'
  | 'infernal'
  | 'modern-blue'
  | 'steampunk'
  | 'sylvan-woodcraft';

export interface StatblockThemePalette {
  background: string;
  surface: string;
  raised: string;
  border: string;
  accent: string;
  accentStrong: string;
  text: string;
  muted: string;
}

export type StatblockThemeOverrides = Partial<Record<StatblockThemeId, Partial<StatblockThemePalette>>>;

export interface StatblockThemeDefinition {
  id: StatblockThemeId;
  name: string;
  description: string;
  palette: StatblockThemePalette;
  /** Small preview palette: shell, surface, accent and text. */
  swatches: readonly [string, string, string, string];
}

export const STATBLOCK_THEMES: readonly StatblockThemeDefinition[] = [
  {
    id: 'default',
    name: 'Obsidian default',
    description: 'Use the current Obsidian color scheme without applying a Forge theme.',
    palette: { background: '#1e1e1e', surface: '#262626', raised: '#303030', border: '#3d3d3d', accent: '#7f6df2', accentStrong: '#a596f7', text: '#dcddde', muted: '#999999' },
    swatches: ['#1e1e1e', '#262626', '#7f6df2', '#dcddde'],
  },
  {
    id: '5e-parchment',
    name: '5e Official Parchment',
    description: 'Warm parchment, dark ink, crimson headings and copper trim.',
    palette: { background: '#e6d3b3', surface: '#d9c39f', raised: '#c9ae80', border: '#bfa173', accent: '#8b151b', accentStrong: '#b81d24', text: '#1f140e', muted: '#684c36' },
    swatches: ['#e6d3b3', '#d9c39f', '#8b151b', '#1f140e'],
  },
  {
    id: 'astral',
    name: 'Astral Voyager',
    description: 'Cosmic twilight with silver frames and starlit gold accents.',
    palette: { background: '#090d16', surface: '#111827', raised: '#162032', border: '#1e293b', accent: '#fcd34d', accentStrong: '#fde68a', text: '#e2e8f0', muted: '#94a3b8' },
    swatches: ['#090d16', '#162032', '#fcd34d', '#e2e8f0'],
  },
  {
    id: 'crystal',
    name: 'Astral Crystal',
    description: 'Amethyst geode tones, prismatic cyan and luminous violet.',
    palette: { background: '#100d24', surface: '#1a1638', raised: '#25204d', border: '#4d3d82', accent: '#7b68ee', accentStrong: '#5ce1e6', text: '#f0edff', muted: '#aca5d6' },
    swatches: ['#100d24', '#1a1638', '#7b68ee', '#f0edff'],
  },
  {
    id: 'gilded-obsidian',
    name: 'Gilded Obsidian Vault',
    description: 'Deep obsidian, layered gold inlay and restrained foil highlights.',
    palette: { background: '#050608', surface: '#0b0c10', raised: '#111319', border: '#1e1b14', accent: '#d4af37', accentStrong: '#ffe082', text: '#f4eedb', muted: '#c2a66b' },
    swatches: ['#050608', '#111319', '#d4af37', '#f4eedb'],
  },
  {
    id: 'gothic',
    name: 'Bloodbound Gothic',
    description: 'Vampiric velvet, cathedral iron and blood-red accents.',
    palette: { background: '#0f0a0c', surface: '#181114', raised: '#22161b', border: '#381520', accent: '#9f1239', accentStrong: '#e11d48', text: '#f3f4f6', muted: '#9ca3af' },
    swatches: ['#0f0a0c', '#22161b', '#e11d48', '#f3f4f6'],
  },
  {
    id: 'ice',
    name: 'Glacial Rime',
    description: 'Deep arctic blue, crystalline borders and bright frost cyan.',
    palette: { background: '#050f17', surface: '#0c1d29', raised: '#142a3a', border: '#164e63', accent: '#38bdf8', accentStrong: '#7dd3fc', text: '#f0fdfa', muted: '#99f6e4' },
    swatches: ['#050f17', '#142a3a', '#38bdf8', '#f0fdfa'],
  },
  {
    id: 'infernal',
    name: 'Infernal Obsidian',
    description: 'Volcanic basalt, ember-orange highlights and molten gradients.',
    palette: { background: '#110d0a', surface: '#1c140e', raised: '#2b1a10', border: '#431407', accent: '#ea580c', accentStrong: '#fb923c', text: '#fff7ed', muted: '#fdba74' },
    swatches: ['#110d0a', '#2b1a10', '#ea580c', '#fff7ed'],
  },
  {
    id: 'modern-blue',
    name: 'Modern Blue Glass',
    description: 'Translucent navy surfaces, cyan HUD accents and indigo glow.',
    palette: { background: '#0f172a', surface: '#1e293b', raised: '#334155', border: '#64748b', accent: '#38bdf8', accentStrong: '#818cf8', text: '#f1f5f9', muted: '#cbd5e1' },
    swatches: ['#0f172a', '#334155', '#38bdf8', '#f1f5f9'],
  },
  {
    id: 'steampunk',
    name: 'Eberron Artificer',
    description: 'Clockwork brass, dark iron and lightning amber.',
    palette: { background: '#13110e', surface: '#1c1813', raised: '#282119', border: '#451a03', accent: '#d97706', accentStrong: '#fbbf24', text: '#fef3c7', muted: '#d6b77a' },
    swatches: ['#13110e', '#282119', '#d97706', '#fef3c7'],
  },
  {
    id: 'sylvan-woodcraft',
    name: 'Sylvan Woodcraft',
    description: 'Forest green, bark-brown panels, wood trim and living leaf accents.',
    palette: { background: '#141f17', surface: '#1a2a1e', raised: '#211a14', border: '#3d5240', accent: '#4ade80', accentStrong: '#e09f3e', text: '#f0ead8', muted: '#a6b5a7' },
    swatches: ['#141f17', '#211a14', '#4ade80', '#f0ead8'],
  },
] as const;

const VALID_THEME_IDS = new Set<string>(STATBLOCK_THEMES.map((theme) => theme.id));

export function isStatblockThemeId(value: unknown): value is StatblockThemeId {
  return typeof value === 'string' && VALID_THEME_IDS.has(value);
}

export function normalizeStatblockThemeId(value: unknown): StatblockThemeId {
  return isStatblockThemeId(value) ? value : 'default';
}


const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isThemeHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

export function themePaletteFor(themeId: unknown): StatblockThemePalette {
  const id = normalizeStatblockThemeId(themeId);
  const theme = STATBLOCK_THEMES.find((item) => item.id === id) ?? STATBLOCK_THEMES[0]!;
  return { ...theme.palette };
}

export function normalizeThemeOverrides(value: unknown): StatblockThemeOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: StatblockThemeOverrides = {};
  for (const [themeId, rawPalette] of Object.entries(value)) {
    if (!isStatblockThemeId(themeId) || !rawPalette || typeof rawPalette !== 'object' || Array.isArray(rawPalette)) continue;
    const palette: Partial<StatblockThemePalette> = {};
    for (const key of ['background', 'surface', 'raised', 'border', 'accent', 'accentStrong', 'text', 'muted'] as const) {
      const candidate = (rawPalette as Record<string, unknown>)[key];
      if (isThemeHexColor(candidate)) palette[key] = candidate.toLowerCase();
    }
    if (Object.keys(palette).length > 0) result[themeId] = palette;
  }
  return result;
}
