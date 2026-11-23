import { migrateLegacyBlockAppearanceTokens, normalizeBlockAppearance } from './blockAppearance.ts';
import { DEFAULT_GRID_COLUMN_COUNT, MAX_BLOCK_ROWS, MAX_GRID_COLUMN_COUNT, MAX_GRID_ROWS } from './layoutLimits.ts';
import { normalizeStatblockThemeId, normalizeThemeOverrides, type StatblockThemeId, type StatblockThemeOverrides } from './statblockThemes.ts';
import { normalizeForgeCustomBorder, normalizeForgeCustomTheme, type ForgeCustomBorder, type ForgeCustomTheme } from './styleLibrary.ts';
import { DEFAULT_FORGE_SHEET_WIDTH, normalizeForgeSheetWidth } from './sheetWidth.ts';
import { normalizeFieldCompendium, normalizeFieldCompendiumSources, normalizeFieldIds } from './fieldCompendiumModel.ts';
import { normalizeFieldTypographyMap } from './fieldTypographyModel.ts';
import { DEFAULT_COUNTERS_PER_ROW, normalizeCountersPerRow } from './counterLayoutModel.ts';
import { normalizeForgeJsonFieldTypes, serializeForgeJsonFieldTypes } from './fieldTypeJsonModel.ts';
/**
 * Forge-owned editing model for the public Atlas .atlastemplate JSON shape.
 * Unknown Atlas properties are preserved so editing a supported field does
 * not erase data introduced by another Atlas version.
 */

export type JsonRecord = Record<string, unknown>;
export type ForgeField = JsonRecord & { key: string; label: string; type: string };
export type ForgeBlock = JsonRecord & { id: string; type: string };
export type ForgeTemplate = JsonRecord & {
  format: 'atlas-statblock-template';
  version: number;
  id: string;
  fields: ForgeField[];
  header?: JsonRecord;
  layout: JsonRecord & { maxColumns: number; blocks: ForgeBlock[] };
};

export type AppearanceMode = 'theme' | 'custom';

export type BorderPreset = 'default' | 'double' | 'oval' | 'diamond' | 'regular-hexagon' | 'triangle-up' | 'triangle-right' | 'triangle-down' | 'triangle-left' | 'pointed' | 'angular' | 'hexagonal' | 'shield';

/** Independent decorative frame for the fixed token portrait in the statblock header. */
export interface TokenFrameAppearance {
  enabled?: boolean;
  borderPreset?: BorderPreset;
  borderColor?: string;
  borderWidth?: number;
}

export interface BlockAppearance {
  /** Whether this block inherits the selected theme or uses its own appearance. */
  appearanceMode?: AppearanceMode;
  /** Background treatment imported from legacy Forge appearance tokens. */
  backgroundStyle?: 'transparent' | 'subtle';
  /** Horizontal placement of block content, separate from text alignment. */
  contentAlign?: 'start' | 'center' | 'end';
  shape?: 'square' | 'rounded' | 'oval';
  background?: string;
  backgroundOpacity?: number;
  borderColor?: string;
  /** Built-in CSS border geometry preset; stored as a stable identifier. */
  borderPreset?: BorderPreset;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'double' | 'none';
  cornerRadius?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowSpread?: number;
  shadowOpacity?: number;
  /** Fallback color for all text inside the block. */
  textColor?: string;
  /** Color for labels, headings and field names (the upper/descriptor text). */
  labelColor?: string;
  /** Color for the primary displayed value (the lower/value text). */
  valueColor?: string;
  /** Typography shared by every text role inside this block. */
  fontSize?: number;
  fontWeight?: '400' | '500' | '600' | '700';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  letterSpacing?: number;
  /** Unitless line-height multiplier shared by all text roles inside this block. */
  lineHeight?: number;
  /** Typography overrides for field labels and headings. */
  labelFontSize?: number;
  labelFontWeight?: '400' | '500' | '600' | '700';
  labelFontStyle?: 'normal' | 'italic';
  labelTextDecoration?: 'none' | 'underline' | 'line-through';
  labelLetterSpacing?: number;
  /** Unitless line-height multiplier for field labels and headings. */
  labelLineHeight?: number;
  /** Typography overrides for field values and descriptions. */
  valueFontSize?: number;
  valueFontWeight?: '400' | '500' | '600' | '700';
  valueFontStyle?: 'normal' | 'italic';
  valueTextDecoration?: 'none' | 'underline' | 'line-through';
  valueLetterSpacing?: number;
  /** Unitless line-height multiplier for field values and descriptions. */
  valueLineHeight?: number;
  padding?: number;
  textAlign?: 'start' | 'center' | 'end';
  verticalAlign?: 'start' | 'center' | 'end';
  trackFillColor?: string;
  trackEmptyColor?: string;
  trackBorderColor?: string;
  /** Legacy Image fit value retained when reading older sidecars; rendering now always fills the frame. */
  imageFit?: 'cover' | 'contain';
  imageZoom?: number;
  imagePositionX?: number;
  imagePositionY?: number;
}

/** Typography overrides for one native Field, independent of its block placement. */
export type FieldTypographyAppearance = Pick<BlockAppearance,
  | 'fontSize' | 'fontWeight' | 'fontStyle' | 'textDecoration' | 'letterSpacing' | 'lineHeight'
  | 'labelFontSize' | 'labelFontWeight' | 'labelFontStyle' | 'labelTextDecoration' | 'labelLetterSpacing' | 'labelLineHeight'
  | 'valueFontSize' | 'valueFontWeight' | 'valueFontStyle' | 'valueTextDecoration' | 'valueLetterSpacing' | 'valueLineHeight'
>;

export interface ForgeBlockLayout {
  /** Preserve per-block layout metadata introduced by later Forge versions. */
  [key: string]: unknown;
  span: number;
  rows: number;
  appearance: BlockAppearance;
  /** Whether the whole field inherits the selected statblock theme or uses its own style. */
  appearanceMode?: AppearanceMode;
  /** Stable Grid column used while Dense Layout is disabled. */
  anchorColumn?: number;
  /** Stable Grid row used while Dense Layout is disabled; collisions may only push it downward. */
  anchorRow?: number;
  /** Physical column count used by anchorColumn; missing legacy values mean the original 12-column grid. */
  anchorColumns?: number;
  /** Forge-only Metric preview layout: maximum number slots placed on each line. */
  metricSlotsPerRow?: number;
  /** Forge-only Counters preview layout: maximum number of Counters placed on each line. */
  countersPerRow?: number;
  /** Hides this block from the final Forge statblock; child Field permissions remain independent. */
  visibility?: 'total-hidden';
}

export interface ForgeContainerDefinition {
  blockId: string;
  kind: 'metric' | 'table';
  /** Native Scores Field used internally to store a Table's grid values. */
  dataFieldKey?: string;
  [key: string]: unknown;
}

export interface ForgeLayoutDocument {
  format: 'statblock-forge-layout';
  version: 1;
  templateId: string;
  /** Physical Grid tracks for this template; logical block spans remain 12-part ratios. */
  columns: number;
  dense: boolean;
  /** Shared fixed-width sheet size in CSS pixels; statblocks may override per note. */
  sheetWidth?: number;
  /** Forge-only global visual theme stored in Forge metadata; native Atlas does not consume it. */
  themeId?: StatblockThemeId;
  /** Forge-only custom palettes, stored independently for each theme preset. */
  themeOverrides?: StatblockThemeOverrides;
  /** Portable snapshot of a reusable custom theme. */
  customTheme?: ForgeCustomTheme;
  /** Portable snapshot of a reusable outer statblock frame. */
  frame?: ForgeCustomBorder;
  /** Optional frame surrounding the reserved Token art field; independent from image blocks. */
  tokenAppearance?: TokenFrameAppearance;
  blocks: Record<string, ForgeBlockLayout>;
  /** Forge-only registry for Metric and Table containers; child refs stay in native blocks. */
  containers?: ForgeContainerDefinition[];
  /** Forge-only appearance by native field key and Ability Part key. */
  abilityParts: Record<string, Record<string, BlockAppearance>>;
  /** Field typography is keyed by stable Field ID so it survives Field key renames. */
  fieldTypography?: Record<string, FieldTypographyAppearance>;
  /** Forge-only field category used when a registered field is later dragged to the canvas. */
  fieldKinds?: Record<string, 'values' | 'choice' | 'text' | 'image' | 'collections' | 'value' | 'metric' | 'table' | 'resources' | 'abilities' | 'counters' | 'checkboxes' | 'tags' | 'pairs' | 'spells'>;
  /** Image Fields whose template sample is copied into every new statblock and locked from note-level removal/replacement. */
  pinnedImageFields?: string[];
  // Legacy `forgeConditionDefinitions` is intentionally not modeled. Unknown layout keys are
  // preserved so existing templates retain their old metadata without Forge executing it.
  /** Stable Forge-only Field identities; keys follow editable native Field keys. */
  fieldIds?: Record<string, string>;
  /** Compendium libraries indexed by stable Field ID, never by display label. */
  compendiumByFieldId?: Record<string, Array<{ id: string; name: string; fieldType: 'entries' | 'list' | 'pairs' | 'spells'; category?: string; value: unknown }>>;
  /** Collection Fields that reuse another compatible Field's Compendium library. */
  compendiumSourceByFieldId?: Record<string, string>;
  /** Preserve sidecar properties introduced by future Forge versions. */
  [key: string]: unknown;
}

export interface GridPlacement {
  id: string;
  x: number;
  y: number;
  span: number;
  rows: number;
}

const HEADER_FIELD_DEFINITIONS = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'image', label: 'Token art', type: 'image' },
  { key: 'level', label: 'Level', type: 'rating', meaning: 'rating' },
  { key: 'type', label: 'Type', type: 'text', meaning: 'creature-type' },
  { key: 'hp', label: 'HP', type: 'number', meaning: 'hit-points' },
  { key: 'description', label: 'Description', type: 'markdown', meaning: 'description' },
] as const;

const FIELD_TYPES = [
  'text', 'markdown', 'number', 'rating', 'dice', 'choice', 'list',
  'entries', 'pairs', 'image', 'spells', 'counters', 'checkboxes',
] as const;

/** Neutral display labels used when a new Scores table has no user-defined columns. */
export const DEFAULT_SCORE_COLUMNS = ['Column 1', 'Column 2', 'Column 3'] as const;

export const FIELD_TO_BLOCK: Readonly<Record<string, string>> = {
  text: 'stat', number: 'stat', rating: 'stat', dice: 'stat', choice: 'stat',
  markdown: 'text', list: 'tags', entries: 'entries',
  pairs: 'pairs', image: 'image', spells: 'spells', counters: 'counters', checkboxes: 'checkboxes',
};

const DEFAULT_SAMPLES: Readonly<Record<string, unknown>> = {
  text: 'Example text', markdown: 'Example description.', number: 10, rating: '1', dice: '2d6+2',
  choice: 'Option', list: ['First', 'Second'], entries: [],
  pairs: {}, image: '', spells: [], counters: [], checkboxes: {},
};

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True only for a complete, user-visible or internal Forge Field record. */
export function isForgeField(value: unknown): value is ForgeField {
  return isRecord(value)
    && typeof value.key === 'string'
    && typeof value.label === 'string'
    && typeof value.type === 'string';
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function slugify(value: string): string {
  const slug = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return slug || 'template';
}

function randomBase36(length: number): string {
  let result = '';
  for (let index = 0; index < length; index += 1) result += Math.floor(Math.random() * 36).toString(36);
  return result;
}

export function newTemplateId(name: string): string {
  return `${slugify(name)}-${randomBase36(6)}`;
}

export function newBlockId(existing: Iterable<string> = []): string {
  const taken = new Set(existing);
  let id = randomBase36(8);
  while (taken.has(id)) id = randomBase36(8);
  return id;
}

export function createBlankTemplate(name: string): ForgeTemplate {
  const fields = HEADER_FIELD_DEFINITIONS.map((field) => ({ ...field } as ForgeField));
  return {
    format: 'atlas-statblock-template',
    version: 1,
    id: newTemplateId(name),
    fields,
    header: { hidden: [] },
    layout: { maxColumns: 2, blocks: [] },
    sample: {
      name: 'Creature name', type: 'Creature', level: '1', hp: 10,
      description: 'A short description of this creature.',
    },
  };
}

function collectTemplateKeyWarnings(fields: unknown[], blocks: unknown[]): string[] {
  const warnings: string[] = [];
  const fieldOwners = new Map<string, string>();
  for (const rawField of fields) {
    if (!isRecord(rawField) || typeof rawField.key !== 'string') continue;
    const fieldLabel = typeof rawField.label === 'string' ? rawField.label : rawField.key;
    if (rawField.formerKeys !== undefined && !Array.isArray(rawField.formerKeys)) {
      warnings.push(`Field "${fieldLabel}": formerKeys não está em uma lista válida.`);
    }
    const candidates = [rawField.key, ...(Array.isArray(rawField.formerKeys) ? rawField.formerKeys.filter((key): key is string => typeof key === 'string') : [])];
    for (const candidate of candidates) {
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(candidate)) {
        warnings.push(`Identificador de Field inválido em "${fieldLabel}": "${candidate}".`);
      }
      const normalized = candidate.toLowerCase();
      const previous = fieldOwners.get(normalized);
      if (previous) warnings.push(`Identificador de Field duplicado: "${candidate}" aparece em "${previous}" e "${fieldLabel}" (incluindo formerKeys).`);
      else fieldOwners.set(normalized, fieldLabel);
    }

    if (rawField.type === 'entries') {
      const entry = isRecord(rawField.entry) ? rawField.entry : {};
      const nameKey = typeof entry.nameKey === 'string' && entry.nameKey.trim() ? entry.nameKey.trim() : 'name';
      const textKey = typeof entry.textKey === 'string' && entry.textKey.trim() ? entry.textKey.trim() : 'desc';
      const entryOwners = new Map<string, string>();
      if (entry.extras !== undefined && !Array.isArray(entry.extras)) {
        warnings.push(`Entries Field "${fieldLabel}": Ability Parts não está em uma lista válida.`);
      }
      for (const [entryLabel, entryKey] of [['nome', nameKey], ['descrição', textKey]] as const) {
        const normalized = entryKey.toLowerCase();
        if (!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(entryKey)) {
          warnings.push(`Entries Field "${fieldLabel}": a chave do ${entryLabel} da habilidade é inválida ("${entryKey}").`);
        }
        const previous = entryOwners.get(normalized);
        if (previous) warnings.push(`Entries Field "${fieldLabel}": as chaves do ${previous} e da ${entryLabel} usam o mesmo identificador "${entryKey}".`);
        else entryOwners.set(normalized, entryLabel);
      }
      for (const [partIndex, rawPart] of (Array.isArray(entry.extras) ? entry.extras : []).entries()) {
        if (!isRecord(rawPart) || typeof rawPart.key !== 'string') continue;
        const partKey = rawPart.key.trim();
        const normalized = partKey.toLowerCase();
        const previous = entryOwners.get(normalized);
        if (previous) warnings.push(`Entries Field "${fieldLabel}": a key da Ability Part ${partIndex + 1} ("${partKey}") conflita com a chave do ${previous}.`);
        else entryOwners.set(normalized, `Ability Part ${partIndex + 1}`);
        if (!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(partKey)) {
          warnings.push(`Entries Field "${fieldLabel}": a key da Ability Part ${partIndex + 1} é inválida ("${partKey}").`);
        }
      }
    }

    if (rawField.type === 'scores') {
      if (rawField.slotKeys !== undefined && !Array.isArray(rawField.slotKeys)) {
        warnings.push(`Tabela "${fieldLabel}": slotKeys não está em uma lista válida.`);
      } else if (Array.isArray(rawField.slotKeys)) {
        const seenSlots = new Set<string>();
        rawField.slotKeys.forEach((rawSlot, index) => {
          if (typeof rawSlot !== 'string' || !/^[a-z][a-z0-9_-]{0,39}$/i.test(rawSlot.trim())) {
            warnings.push(`Tabela "${fieldLabel}": slotKey inválida na coluna ${index + 1}.`);
            return;
          }
          const normalized = rawSlot.trim().toLowerCase();
          if (seenSlots.has(normalized)) warnings.push(`Tabela "${fieldLabel}": slotKey duplicada "${rawSlot}".`);
          seenSlots.add(normalized);
        });
        if (Array.isArray(rawField.slots) && rawField.slotKeys.length < rawField.slots.length) {
          warnings.push(`Tabela "${fieldLabel}": faltam slotKeys em uma ou mais colunas. Os valores existentes foram preservados.`);
        }
      }
    }

    if (rawField.type === 'checkboxes' && rawField.options !== undefined && !Array.isArray(rawField.options)) {
      warnings.push(`Checkboxes Field "${fieldLabel}": as opções não estão em uma lista válida.`);
    }
    if (rawField.type === 'checkboxes' && Array.isArray(rawField.options)) {
      const tokens = new Map<string, { index: number; kind: string }>();
      rawField.options.forEach((rawOption, index) => {
        if (!isRecord(rawOption)) {
          warnings.push(`Checkboxes Field "${fieldLabel}": opção ${index + 1} possui estrutura inválida.`);
          return;
        }
        const key = typeof rawOption.key === 'string' ? rawOption.key.trim().toLowerCase() : '';
        if (!/^[a-z][a-z0-9_]{0,39}$/.test(key)) {
          warnings.push(`Checkboxes Field "${fieldLabel}": a key da opção ${index + 1} é inválida ("${key}").`);
        }
        if (rawOption.aliases !== undefined && !Array.isArray(rawOption.aliases)) {
          warnings.push(`Checkboxes Field "${fieldLabel}": aliases da opção ${index + 1} não estão em uma lista válida.`);
        }
        if (key) {
          const owner = tokens.get(key);
          if (owner) warnings.push(`Checkboxes Field "${fieldLabel}": identificador "${key}" está duplicado entre opções/aliases.`);
          else tokens.set(key, { index, kind: 'key' });
        }
        for (const rawAlias of Array.isArray(rawOption.aliases) ? rawOption.aliases : []) {
          const alias = typeof rawAlias === 'string' ? rawAlias.trim().toLowerCase() : '';
          if (!/^[a-z][a-z0-9_]{0,39}$/.test(alias)) {
            warnings.push(`Checkboxes Field "${fieldLabel}": alias inválido na opção ${index + 1} ("${alias}").`);
            continue;
          }
          const owner = tokens.get(alias);
          if (owner) warnings.push(`Checkboxes Field "${fieldLabel}": alias "${alias}" conflita com uma key ou outro alias.`);
          else tokens.set(alias, { index, kind: 'alias' });
        }
      });
    }
  }

  const visit = (items: unknown[]): void => {
    for (const rawBlock of items) {
      if (!isRecord(rawBlock)) continue;
      if ((rawBlock.type === 'metric' || rawBlock.type === 'line') && Array.isArray(rawBlock.fields)) {
        const seen = new Set<string>();
        for (const rawKey of rawBlock.fields) {
          if (typeof rawKey !== 'string' || !rawKey.trim()) continue;
          const normalized = rawKey.toLowerCase();
          if (seen.has(normalized)) warnings.push(`Bloco ${String(rawBlock.id ?? '')} (${String(rawBlock.type)}): Field "${rawKey}" está referenciado mais de uma vez.`);
          seen.add(normalized);
        }
      }
      if (Array.isArray(rawBlock.blocks)) visit(rawBlock.blocks);
    }
  };
  visit(blocks);
  return [...new Set(warnings)];
}

export function parseTemplateForEditing(text: string): { template: ForgeTemplate; warnings: string[] } {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) throw new Error('A raiz do arquivo precisa ser um objeto JSON.');
  if (parsed.format !== 'atlas-statblock-template') throw new Error('Este arquivo não é um template de statblock do Atlas.');
  if (!Number.isInteger(parsed.version) || Number(parsed.version) < 1) throw new Error('A versão do template é inválida.');
  if (typeof parsed.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*-[a-z0-9]{6}$/.test(parsed.id)) {
    throw new Error('O ID do template não segue o formato esperado pelo Atlas.');
  }
  if (!Array.isArray(parsed.fields)) throw new Error('O template não contém uma lista válida de fields.');
  if (!isRecord(parsed.layout) || !Array.isArray(parsed.layout.blocks)) throw new Error('O template não contém layout.blocks válido.');

  // Forge 0.5.2 had a Field reordering bug that could leave an `undefined`
  // array slot when a Table's private Scores adapter was present. JSON turns
  // that empty slot into `null`; it has no Field data to preserve, so recover
  // the remaining valid Fields and report the repair instead of rejecting the
  // entire template. Malformed non-null records are still rejected below.
  let parsedFields: unknown[] = parsed.fields;
  const emptyFieldSlots = parsedFields.filter((field) => field === null).length;
  if (emptyFieldSlots > 0) parsedFields = parsedFields.filter((field) => field !== null);
  parsed.fields = parsedFields;

  const warnings: string[] = collectTemplateKeyWarnings(parsedFields, parsed.layout.blocks);
  if (emptyFieldSlots > 0) warnings.push(`${emptyFieldSlots} entrada(s) vazia(s) na lista de Fields foram removidas. Isso corrige uma falha de reordenação de Fields de versões anteriores; os Fields válidos foram preservados.`);
  if (Number(parsed.version) > 1) warnings.push(`Este template usa a versão ${String(parsed.version)}. Propriedades desconhecidas serão preservadas, mas a edição de recursos novos pode ser limitada.`);
  const blockIds = new Set<string>();
  const hasValidBlockTree = (blocks: unknown[]): boolean => blocks.every((block) => {
    if (!isRecord(block) || typeof block.id !== 'string' || !block.id.trim() || typeof block.type !== 'string') return false;
    if (blockIds.has(block.id)) return false;
    blockIds.add(block.id);
    return block.blocks === undefined || (Array.isArray(block.blocks) && hasValidBlockTree(block.blocks));
  });
  if (!parsedFields.every(isForgeField)) {
    throw new Error('O template contém um campo com estrutura inválida. O arquivo original foi mantido sem alterações.');
  }
  if (!hasValidBlockTree(parsed.layout.blocks)) {
    throw new Error('O template contém um bloco inválido ou um ID de bloco duplicado. O arquivo original foi mantido sem alterações.');
  }
  const template = cloneJson(parsed) as ForgeTemplate;
  normalizeForgeJsonFieldTypes(template);
  // Keep the original arrays intact: silently filtering malformed entries
  // would make a later save destructive for templates from newer Atlas builds.
  return { template, warnings };
}

export function createForgeLayout(template: ForgeTemplate): ForgeLayoutDocument {
  const blocks: Record<string, ForgeBlockLayout> = {};
  const addBlockMetadata = (items: readonly ForgeBlock[], parentType?: string): void => {
    for (const block of items) {
      const span = block.type === 'vertical-divider' ? 1
        : parentType === 'row' ? 6
          : parentType === undefined && (block.type === 'stat' || block.type === 'tags') ? 6
            : 12;
      const legacyAppearance = migrateLegacyBlockAppearanceTokens(
        typeof block.className === 'string' ? block.className : undefined,
        {},
      );
      if (legacyAppearance.removed) {
        if (legacyAppearance.className) block.className = legacyAppearance.className;
        else delete block.className;
      }
      blocks[block.id] = {
        span, rows: 1, appearance: legacyAppearance.appearance,
        appearanceMode: legacyAppearance.migrated ? 'custom' : 'theme',
        ...(block.type === 'metric' ? { metricSlotsPerRow: 6 } : {}),
        ...(block.type === 'counters' ? { countersPerRow: DEFAULT_COUNTERS_PER_ROW } : {}),
      };
      if (Array.isArray(block.blocks)) {
        addBlockMetadata(block.blocks.filter(isRecord) as ForgeBlock[], block.type);
      }
    }
  };
  addBlockMetadata(template.layout.blocks);
  const containers: ForgeContainerDefinition[] = [];
  const addContainerMetadata = (items: readonly ForgeBlock[]): void => {
    for (const block of items) {
      if (block.type === 'metric') containers.push({ blockId: block.id, kind: 'metric' });
      else if (block.type === 'scores') containers.push({
        blockId: block.id, kind: 'table',
        ...(typeof block.field === 'string' && block.field ? { dataFieldKey: block.field } : {}),
      });
      if (Array.isArray(block.blocks)) addContainerMetadata(block.blocks.filter(isRecord) as ForgeBlock[]);
    }
  };
  addContainerMetadata(template.layout.blocks);
  return {
    format: 'statblock-forge-layout', version: 1, templateId: template.id,
    columns: DEFAULT_GRID_COLUMN_COUNT, dense: true, sheetWidth: DEFAULT_FORGE_SHEET_WIDTH, themeId: 'default', tokenAppearance: { enabled: false }, blocks, containers, abilityParts: {}, fieldTypography: {}, fieldKinds: {}, pinnedImageFields: [],
    fieldIds: normalizeFieldIds({}, template.fields), compendiumByFieldId: {}, compendiumSourceByFieldId: {},
  };
}

function normalizeAppearanceSidecar(value: unknown): BlockAppearance {
  return normalizeBlockAppearance(value);
}

function blockById(blocks: readonly ForgeBlock[], id: string): ForgeBlock | undefined {
  for (const block of blocks) {
    if (block.id === id) return block;
    if (Array.isArray(block.blocks)) {
      const found = blockById(block.blocks.filter(isRecord) as ForgeBlock[], id);
      if (found) return found;
    }
  }
  return undefined;
}

function hasLegacyCustomAppearance(rawAppearance: unknown, block: ForgeBlock | undefined): boolean {
  if (!isRecord(rawAppearance)) return false;
  const entries = Object.entries(rawAppearance);
  const wrapper = block?.type === 'section' || block?.type === 'row' || block?.type === 'tabs';
  const meaningful = entries.some(([key, value]) => {
    if (key === 'shape' && value === 'rounded') return false;
    // Older Forge builds used 10px on general blocks and 0px on tab wrappers.
    if (key === 'padding' && (value === 10 || (wrapper && value === 0))) return false;
    return true;
  });
  return meaningful;
}

export function normalizeTokenFrameAppearance(value: unknown): TokenFrameAppearance {
  if (!isRecord(value)) return { enabled: false };
  const result: TokenFrameAppearance = { enabled: value.enabled === true };
  const preset = value.borderPreset;
  if (preset === 'default' || preset === 'double' || preset === 'oval' || preset === 'diamond'
    || preset === 'regular-hexagon' || preset === 'triangle-up' || preset === 'triangle-right'
    || preset === 'triangle-down' || preset === 'triangle-left' || preset === 'pointed'
    || preset === 'angular' || preset === 'hexagonal' || preset === 'shield') result.borderPreset = preset;
  else result.borderPreset = 'default';
  if (typeof value.borderColor === 'string' && /^#[0-9a-f]{6}$/i.test(value.borderColor)) {
    result.borderColor = value.borderColor.toLowerCase();
  }
  if (typeof value.borderWidth === 'number' && Number.isFinite(value.borderWidth)) {
    result.borderWidth = Math.max(1, Math.min(12, value.borderWidth));
  } else result.borderWidth = result.borderPreset === 'double' ? 3 : 2;
  return result;
}

export function parseForgeLayout(text: string, template: ForgeTemplate): ForgeLayoutDocument {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed) || parsed.format !== 'statblock-forge-layout' || parsed.version !== 1
      || parsed.templateId !== template.id || !isRecord(parsed.blocks)) return createForgeLayout(template);
    normalizeForgeJsonFieldTypes(parsed);
    const defaults = createForgeLayout(template);
    const knownRootKeys = new Set(['format', 'version', 'templateId', 'columns', 'dense', 'sheetWidth', 'themeId', 'themeOverrides', 'customTheme', 'frame', 'tokenAppearance', 'blocks', 'containers', 'abilityParts', 'fieldTypography', 'fieldKinds', 'pinnedImageFields', 'fieldIds', 'compendiumByFieldId', 'compendiumSourceByFieldId']);
    const futureRootProperties = Object.fromEntries(Object.entries(parsed).filter(([key]) => !knownRootKeys.has(key)));
    const customTheme = normalizeForgeCustomTheme(parsed.customTheme);
    const frame = normalizeForgeCustomBorder(parsed.frame);
    const base: ForgeLayoutDocument = {
      ...futureRootProperties,
      ...defaults,
      columns: clampInteger(parsed.columns, 4, MAX_GRID_COLUMN_COUNT, DEFAULT_GRID_COLUMN_COUNT),
      sheetWidth: normalizeForgeSheetWidth(parsed.sheetWidth),
      themeId: normalizeStatblockThemeId(parsed.themeId),
      themeOverrides: normalizeThemeOverrides(parsed.themeOverrides),
      tokenAppearance: normalizeTokenFrameAppearance(parsed.tokenAppearance),
      ...(customTheme ? { customTheme } : {}),
      ...(frame ? { frame } : {}),
    };
    const rawContainers = Array.isArray(parsed.containers) ? parsed.containers.filter(isRecord) : [];
    const rawContainersById = new Map(rawContainers.flatMap((item) =>
      typeof item.blockId === 'string' && (item.kind === 'metric' || item.kind === 'table')
        ? [[item.blockId, item] as const] : [],
    ));
    base.containers = (defaults.containers ?? []).map((fallback) => {
      const saved = rawContainersById.get(fallback.blockId);
      const block = blockById(template.layout.blocks, fallback.blockId);
      const dataFieldKey = block?.type === 'scores' && typeof block.field === 'string' && block.field
        ? block.field : undefined;
      return {
        ...fallback,
        ...(saved && saved.kind === fallback.kind ? Object.fromEntries(Object.entries(saved).filter(([key]) =>
          key !== 'blockId' && key !== 'kind' && key !== 'dataFieldKey')) : {}),
        ...(dataFieldKey ? { dataFieldKey } : {}),
      };
    });
    base.fieldIds = normalizeFieldIds(parsed.fieldIds, template.fields);
    const validFieldIds = new Set(Object.values(base.fieldIds));
    base.fieldTypography = normalizeFieldTypographyMap(parsed.fieldTypography, validFieldIds);
    base.compendiumByFieldId = normalizeFieldCompendium(
      parsed.compendiumByFieldId,
      new Set(Object.values(base.fieldIds)),
    );
    base.compendiumSourceByFieldId = normalizeFieldCompendiumSources(
      parsed.compendiumSourceByFieldId,
      template.fields,
      base.fieldIds,
    );
    const knownBlockMetadataKeys = new Set([
      'span', 'rows', 'appearance', 'appearanceMode', 'anchorColumn', 'anchorRow', 'anchorColumns',
      'metricSlotsPerRow', 'countersPerRow', 'visibility',
    ]);
    for (const [id, raw] of Object.entries(parsed.blocks)) {
      if (!isRecord(raw)) continue;
      const futureBlockProperties = Object.fromEntries(
        Object.entries(raw).filter(([key]) => !knownBlockMetadataKeys.has(key)),
      );
      const rawAppearance = isRecord(raw.appearance) ? raw.appearance : {};
      const defaultMetadata = defaults.blocks[id];
      const appearance = normalizeAppearanceSidecar({
        ...(defaultMetadata?.appearance ?? {}),
        ...rawAppearance,
      });
      const anchorColumn = typeof raw.anchorColumn === 'number' && Number.isSafeInteger(raw.anchorColumn)
        ? clampInteger(raw.anchorColumn, 0, MAX_GRID_COLUMN_COUNT - 1, 0) : undefined;
      const anchorRow = typeof raw.anchorRow === 'number' && Number.isSafeInteger(raw.anchorRow)
        ? clampInteger(raw.anchorRow, 0, MAX_GRID_ROWS - 1, 0) : undefined;
      const anchorColumns = typeof raw.anchorColumns === 'number' && Number.isSafeInteger(raw.anchorColumns)
        ? clampInteger(raw.anchorColumns, 1, MAX_GRID_COLUMN_COUNT, DEFAULT_GRID_COLUMN_COUNT) : undefined;
      const metricSlotsPerRow = typeof raw.metricSlotsPerRow === 'number'
        && Number.isSafeInteger(raw.metricSlotsPerRow) && raw.metricSlotsPerRow > 0
        ? raw.metricSlotsPerRow : undefined;
      const countersPerRow = typeof raw.countersPerRow === 'number'
        ? normalizeCountersPerRow(raw.countersPerRow) : defaultMetadata?.countersPerRow;
      const nativeBlock = blockById(template.layout.blocks, id);
      const explicitMode = raw.appearanceMode === 'custom' || raw.appearanceMode === 'theme'
        ? raw.appearanceMode : undefined;
      base.blocks[id] = {
        ...futureBlockProperties,
        span: clampInteger(raw.span, 1, 12, 12),
        rows: clampInteger(raw.rows, 1, MAX_BLOCK_ROWS, 1),
        appearance,
        // Legacy appearance tokens in the native block take precedence over
        // an old sidecar's default `theme` mode: those tokens were the user's
        // explicit request for an individual appearance and have just been
        // migrated into `appearance` by createForgeLayout().
        appearanceMode: defaultMetadata?.appearanceMode === 'custom'
          ? 'custom'
          : explicitMode ?? (hasLegacyCustomAppearance(rawAppearance, nativeBlock) ? 'custom' : 'theme'),
        ...(anchorColumn !== undefined && anchorRow !== undefined ? {
          anchorColumn, anchorRow, ...(anchorColumns !== undefined ? { anchorColumns } : {}),
        } : {}),
        ...(metricSlotsPerRow !== undefined ? { metricSlotsPerRow } : {}),
        ...(countersPerRow !== undefined ? { countersPerRow } : {}),
        ...(raw.visibility === 'total-hidden' ? { visibility: 'total-hidden' as const } : {}),
      };
    }
    const rawAbilityParts = isRecord(parsed.abilityParts) ? parsed.abilityParts : {};
    base.abilityParts = Object.fromEntries(Object.entries(rawAbilityParts).flatMap(([fieldKey, rawParts]) => {
      if (!isRecord(rawParts)) return [];
      const parts = Object.fromEntries(Object.entries(rawParts).filter(([, rawAppearance]) => isRecord(rawAppearance))
        .map(([partKey, rawAppearance]) => {
          const rawRecord = isRecord(rawAppearance) ? rawAppearance : {};
          const normalized = normalizeAppearanceSidecar(rawRecord);
          const hasColors = Boolean(normalized.trackFillColor || normalized.trackEmptyColor || normalized.trackBorderColor);
          normalized.appearanceMode = rawRecord.appearanceMode === 'custom' || rawRecord.appearanceMode === 'theme'
            ? rawRecord.appearanceMode : hasColors ? 'custom' : 'theme';
          return [partKey, normalized];
        }));
      return Object.keys(parts).length > 0 ? [[fieldKey, parts]] : [];
    }));
    base.dense = parsed.dense !== false;
    const rawFieldKinds = isRecord(parsed.fieldKinds) ? parsed.fieldKinds : {};
    const allowedKinds = new Set(['values', 'choice', 'text', 'image', 'collections', 'value', 'metric', 'table', 'resources', 'abilities', 'counters', 'checkboxes', 'tags', 'pairs', 'spells']);
    base.fieldKinds = Object.fromEntries(Object.entries(rawFieldKinds).filter(([key, kind]) =>
      template.fields.some((field) => field.key === key) && typeof kind === 'string' && allowedKinds.has(kind),
    )) as NonNullable<ForgeLayoutDocument['fieldKinds']>;
    const sample = isRecord(template.sample) ? template.sample : {};
    base.pinnedImageFields = Array.isArray(parsed.pinnedImageFields)
      ? [...new Set(parsed.pinnedImageFields.filter((key): key is string => typeof key === 'string'
        && key !== 'image'
        && template.fields.some((field) => field.key === key && field.type === 'image')
        && typeof sample[key] === 'string' && (sample[key] as string).trim().length > 0))]
      : [];
    return base;
  } catch {
    return createForgeLayout(template);
  }
}

export function serializeTemplate(template: ForgeTemplate): string {
  return `${JSON.stringify(template, null, 2)}\n`;
}

/** Serialize the editor's Forge JSON view using the reorganized Field type IDs. */
export function serializeForgeEditorTemplate(template: ForgeTemplate): string {
  const stored = cloneJson(template);
  serializeForgeJsonFieldTypes(stored);
  return `${JSON.stringify(stored, null, 2)}\n`;
}

export function serializeForgeLayout(layout: ForgeLayoutDocument): string {
  const stored = cloneJson(layout);
  serializeForgeJsonFieldTypes({ statblockForge: { layout: stored } });
  return `${JSON.stringify(stored, null, 2)}\n`;
}

export function headerFieldForPart(fields: readonly ForgeField[], part: string): ForgeField | undefined {
  const meaning: Record<string, string> = {
    level: 'rating', type: 'creature-type', hp: 'hit-points', description: 'description',
  };
  const fallback: Record<string, string> = {
    name: 'name', token: 'image', image: 'image', level: 'level', type: 'type', hp: 'hp', description: 'description',
  };
  // Atlas resolves semantic meanings before conventional keys. Do the same so
  // a custom key such as `cr` remains the actual Level/Rating header field.
  const meaningMatch = meaning[part] === undefined
    ? undefined
    : fields.find((field) => field.meaning === meaning[part]);
  return meaningMatch ?? fields.find((field) => field.key === fallback[part]);
}

export function isHeaderField(field: ForgeField | null | undefined): boolean {
  if (!isForgeField(field)) return false;
  // Only fields that are actually rendered as fixed header parts are reserved.
  // Legacy `display-name` and `hit_dice` fields remain ordinary Template Fields
  // so existing template data stays editable after their Header controls were removed.
  return ['name', 'image', 'level', 'type', 'hp', 'description'].includes(field.key)
    || ['rating', 'creature-type', 'hit-points', 'description'].includes(String(field.meaning ?? ''));
}

export function registerTemplateField(template: ForgeTemplate, label: string, type: string): ForgeField {
  if (!FIELD_TYPES.includes(type as (typeof FIELD_TYPES)[number])) throw new Error('Tipo de campo não suportado.');
  const cleanLabel = label.trim();
  if (!cleanLabel) throw new Error('Informe um nome para o campo.');
  const base = slugify(cleanLabel).replace(/-/g, '_').slice(0, 40) || 'field';
  const used = new Set(template.fields.flatMap((field) => [field.key, ...(Array.isArray(field.formerKeys)
    ? field.formerKeys.filter((value): value is string => typeof value === 'string') : [])]).map((key) => key.toLowerCase()));
  let key = base;
  let suffix = 2;
  while (used.has(key.toLowerCase()) || ['tags', '__forgeconditions', '__forgeconditionvalues', '__proto__', 'prototype', 'constructor'].includes(key.toLowerCase())) {
    key = `${base.slice(0, 40 - String(suffix).length - 1)}_${suffix++}`;
  }
  const field: ForgeField = { key, label: cleanLabel, type };
  if (type === 'choice') field.options = ['Option 1', 'Option 2'];
  if (type === 'entries') field.entry = { nameKey: 'name', textKey: 'desc', extras: [] };
  if (type === 'counters') field.counterRows = [];
  if (type === 'checkboxes') {
    field.options = [{ key: 'option_1', label: 'Option 1' }, { key: 'option_2', label: 'Option 2' }];
    // New Checkbox Fields are exclusive by default; multi-choice is opt-in.
    field.allowMultiple = false;
    // Preserve the current row presentation for new Fields; inline flow is optional.
    field.optionLayout = 'rows';
  }
  if (type === 'number') field.unit = '';
  template.fields.push(field);
  const sample = isRecord(template.sample) ? template.sample : {};
  const defaultValue = type === 'checkboxes' && Array.isArray(field.options)
    ? Object.fromEntries(field.options.filter(isRecord).map((option) => [String(option.key), false]))
    : cloneJson(DEFAULT_SAMPLES[type]);
  template.sample = { ...sample, [key]: defaultValue };
  return field;
}

/**
 * Creates Atlas' native Scores data adapter for a Forge Table block. This is
 * deliberately not a user Field type: it is private storage owned by the
 * Table block and is hidden from the Field palette and Field inspector.
 */
export function registerTableStorageField(template: ForgeTemplate, label: string): ForgeField {
  const field = registerTemplateField(template, label, 'number');
  field.type = 'scores';
  field.forgeInternal = 'table-storage';
  delete field.unit;
  field.slots = [...DEFAULT_SCORE_COLUMNS];
  field.slotKeys = ['slot_1', 'slot_2', 'slot_3'];
  field.rows = [[10, 10, 10]];
  const sample = isRecord(template.sample) ? { ...template.sample } : {};
  sample[field.key] = [[10, 10, 10]];
  template.sample = sample;
  return field;
}

/** Registers a data field only. Adding a field never changes the canvas layout. */
export function addTemplateField(template: ForgeTemplate, label: string, type: string): ForgeField {
  return registerTemplateField(template, label, type);
}

export function createBlock(type: string, template: ForgeTemplate, fieldKey?: string): ForgeBlock {
  const allIds = collectBlockIds(template.layout.blocks);
  const id = newBlockId(allIds);
  switch (type) {
    case 'heading': return { id, type, text: 'New section', level: 'section' };
    case 'title': return { id, type, field: fieldKey ?? 'name', level: 1 };
    case 'divider': return { id, type };
    case 'vertical-divider': return { id, type };
    case 'text': return { id, type, ...(fieldKey ? { field: fieldKey } : { text: 'Add descriptive text.' }) };
    case 'stat': return { id, type, field: fieldKey ?? '', look: 'run-in' };
    case 'metric': return { id, type, fields: fieldKey ? [fieldKey] : [] };
    case 'line': return { id, type, fields: fieldKey ? [fieldKey] : [] };
    case 'tags': return { id, type, field: fieldKey ?? '', look: 'chips' };
    case 'scores': return { id, type, field: fieldKey ?? '' };
    case 'entries': return { id, type, field: fieldKey ?? '', nameStyle: 'run-in' };
    case 'pairs': return { id, type, field: fieldKey ?? '' };
    case 'image': return { id, type, field: fieldKey ?? '', shape: 'portrait' };
    case 'spells': return { id, type, field: fieldKey ?? '' };
    case 'counters': return { id, type, field: fieldKey ?? '' };
    case 'checkboxes': return { id, type, field: fieldKey ?? '' };
    case 'track': return { id, type, field: fieldKey ?? '', look: 'boxes', counts: 'down' };
    case 'section': return { id, type, heading: 'New section', blocks: [] };
    case 'row': return { id, type, align: 'start', blocks: [] };
    case 'tabs': return { id, type, heading: 'New tabs', blocks: [] };
    default: throw new Error(`Tipo de bloco não suportado: ${type}`);
  }
}

export function addStandaloneBlock(template: ForgeTemplate, type: 'heading' | 'divider' | 'vertical-divider'): ForgeBlock {
  const block = createBlock(type, template);
  template.layout.blocks.push(block);
  return block;
}

export function collectBlockIds(blocks: readonly ForgeBlock[]): string[] {
  const result: string[] = [];
  const visit = (items: readonly ForgeBlock[]): void => {
    for (const item of items) {
      result.push(item.id);
      if (Array.isArray(item.blocks)) visit(item.blocks.filter(isRecord) as ForgeBlock[]);
    }
  };
  visit(blocks);
  return result;
}

export function blockLabel(block: ForgeBlock, fields: readonly ForgeField[]): string {
  if (block.type === 'heading') return String(block.text ?? 'Heading');
  if (block.type === 'divider') return 'Divider';
  if (block.type === 'vertical-divider') return 'Vertical divider';
  if (block.type === 'title') {
    const field = fields.find((item) => item.key === block.field);
    return field ? `Title · ${field.label.trim() || field.key}` : 'Title · configure field';
  }
  if (block.type === 'line') {
    const keys = Array.isArray(block.fields) ? block.fields.filter((key): key is string => typeof key === 'string') : [];
    const labels = keys.map((key) => { const field = fields.find((item) => item.key === key); return field?.label.trim() || key; });
    return labels.length > 0 ? `Line · ${labels.join(' · ')}` : 'Line · configure values';
  }
  if (block.type === 'section' || block.type === 'tabs' || block.type === 'row') {
    const title = typeof block.heading === 'string' && block.heading.trim() ? block.heading : block.type;
    return `${title} · container`;
  }
  if (block.type === 'metric') return typeof block.heading === 'string' && block.heading.trim() ? block.heading : 'Metric';
  if (block.type === 'scores') return 'Table';
  const field = fields.find((item) => item.key === block.field);
  return field ? `${field.label.trim() || field.key} · ${block.type}` : `${block.type} · ${String(block.field ?? 'sem campo')}`;
}

export function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export { packPhysicalGrid } from './gridLayout.ts';

export const FORGE_FIELD_TYPES = FIELD_TYPES;
export const FORGE_ENTRY_PART_TYPES = ['text', 'number', 'dice', 'list', 'choice', 'counter'] as const;
