/**
 * Capability-specific projection between Forge's extended statblock model and
 * Atlas' documented native template/statblock format.
 *
 * Atlas Entry Ability Parts accept text, number, list, dice and choice. Forge
 * adds a per-entry Counter Part (boolean marks + a selectable maximum), which
 * Atlas does not model. We export that one Part as text and serialize its
 * value as `used/max` (or a positional glyph pattern when marks are not a
 * contiguous prefix). When Forge loads the same note again, the text is
 * restored to the original boolean marks and optional maximum override.
 *
 * This keeps one Markdown statblock record. The `.forgetemplate` remains the
 * authoritative template for Forge-only behavior and appearance.
 */
import { abilityCounterMaxForRow, normalizeAbilityCounterMarks } from '../templates/abilityPartValues.ts';
import {
  ABILITY_COUNTER_MAXES_KEY,
  DEFAULT_ABILITY_COUNTER_MAX,
  MAX_ABILITY_COUNTER_MAX,
  MIN_ABILITY_COUNTER_MAX,
  abilityPartsForField,
  type AbilityPart,
} from '../templates/abilityPartsModel.ts';
import { isRecord, type ForgeField, type ForgeTemplate, type JsonRecord } from '../templates/forgeTemplate.ts';

export const ATLAS_NATIVE_ENTRY_EXTRA_TYPES = ['text', 'number', 'list', 'dice', 'choice'] as const;
export const ATLAS_NATIVE_FIELD_TYPES = [
  'text', 'markdown', 'number', 'rating', 'dice', 'choice', 'list', 'scores',
  'entries', 'pairs', 'image', 'spells', 'counters',
] as const;
export const ATLAS_NATIVE_BLOCK_TYPES = [
  'section', 'row', 'tabs', 'title', 'line', 'stat', 'metric', 'scores', 'tags',
  'text', 'entries', 'pairs', 'track', 'counters', 'image', 'spells', 'heading',
  'divider', 'script', 'opaque',
] as const;

export type AtlasTemplateIssueSeverity = 'info' | 'warning';
export interface AtlasTemplateCompatibilityIssue {
  severity: AtlasTemplateIssueSeverity;
  code: string;
  path: string;
  message: string;
}
export interface AtlasTemplateCompatibilityReport {
  target: 'atlas-native-file';
  canExport: true;
  quality: 'native' | 'degraded' | 'best-effort';
  issues: AtlasTemplateCompatibilityIssue[];
  convertedAbilityCounters: number;
  unknownAbilityPartTypes: number;
  unknownFieldTypes: number;
  unknownBlockTypes: number;
}

export interface AtlasTemplateProjection {
  template: ForgeTemplate;
  report: AtlasTemplateCompatibilityReport;
}

export interface AtlasStatblockDataProjection {
  data: JsonRecord;
  convertedCounters: number;
}

function clampCounterMax(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.max(MIN_ABILITY_COUNTER_MAX, Math.min(MAX_ABILITY_COUNTER_MAX, numeric));
}

function counterParts(field: ForgeField): AbilityPart[] {
  if (field.type !== 'entries') return [];
  return abilityPartsForField(field).filter((part) => part.type === 'counter');
}

function entriesAsList(value: unknown): { rows: unknown[]; wasArray: boolean } | null {
  if (Array.isArray(value)) return { rows: value, wasArray: true };
  if (isRecord(value)) return { rows: [value], wasArray: false };
  return null;
}

function isBooleanMarks(value: unknown): value is boolean[] {
  return Array.isArray(value) && value.every((mark) => typeof mark === 'boolean');
}

function marksToAtlasText(marks: readonly boolean[], max: number, look: AbilityPart['look']): string {
  const safe = normalizeAbilityCounterMarks(marks, max);
  const used = safe.filter(Boolean).length;
  const isPrefix = safe.every((mark, index) => mark === (index < used));
  if (isPrefix) return `${used}/${max}`;
  const [filled, empty] = look === 'checkboxes' ? ['☑', '☐'] : ['●', '○'];
  return safe.map((mark) => mark ? filled : empty).join('');
}

interface ParsedAtlasCounterText {
  marks: boolean[];
  max: number;
}

function parseAtlasCounterText(value: unknown): ParsedAtlasCounterText | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const ratio = /^(\d{1,2})\s*\/\s*(\d{1,2})$/.exec(text);
  if (ratio) {
    const used = Number(ratio[1]);
    const max = Number(ratio[2]);
    if (!Number.isInteger(used) || !Number.isInteger(max)
      || max < MIN_ABILITY_COUNTER_MAX || max > MAX_ABILITY_COUNTER_MAX || used < 0 || used > max) return null;
    return { marks: Array.from({ length: max }, (_, index) => index < used), max };
  }

  if (/^[●○]{1,12}$/u.test(text)) {
    return { marks: Array.from(text, (mark) => mark === '●'), max: Array.from(text).length };
  }
  if (/^[☑☐]{1,12}$/u.test(text)) {
    return { marks: Array.from(text, (mark) => mark === '☑'), max: Array.from(text).length };
  }
  return null;
}

function cloneEntryRows(
  value: unknown,
  transform: (entry: JsonRecord) => JsonRecord,
): { value: unknown; changed: number } {
  const list = entriesAsList(value);
  if (!list) return { value, changed: 0 };
  let changed = 0;
  const rows = list.rows.map((row) => {
    if (!isRecord(row)) return row;
    const next = transform(row);
    if (next !== row) changed += 1;
    return next;
  });
  if (changed === 0) return { value, changed: 0 };
  return { value: list.wasArray ? rows : rows[0], changed };
}

function formatCounterPartForAtlas(entry: JsonRecord, part: AbilityPart): JsonRecord {
  const value = entry[part.key];
  if (value === undefined || value === null || value === '') return entry;
  let marks: boolean[] | null = null;
  let max = abilityCounterMaxForRow(entry, part);

  if (isBooleanMarks(value)) {
    marks = value;
  } else {
    const parsed = parseAtlasCounterText(value);
    if (parsed) {
      marks = parsed.marks;
      max = parsed.max;
    }
  }
  if (!marks) return entry;

  return { ...entry, [part.key]: marksToAtlasText(marks, max, part.look) };
}

/** Converts Forge-only Counter marks to Atlas-readable text without mutating source data. */
export function projectForgeStatblockDataForAtlas(
  template: ForgeTemplate,
  source: JsonRecord,
): AtlasStatblockDataProjection {
  const data: JsonRecord = { ...source };
  let convertedCounters = 0;
  for (const field of template.fields) {
    const parts = counterParts(field);
    if (parts.length === 0 || !Object.prototype.hasOwnProperty.call(data, field.key)) continue;
    const projected = cloneEntryRows(data[field.key], (entry) => {
      let next = entry;
      for (const part of parts) {
        const before = next[part.key];
        next = formatCounterPartForAtlas(next, part);
        if (next !== entry && next[part.key] !== before) convertedCounters += 1;
      }
      if (parts.length > 0 && Object.prototype.hasOwnProperty.call(next, ABILITY_COUNTER_MAXES_KEY)) {
        next = { ...next };
        delete next[ABILITY_COUNTER_MAXES_KEY];
      }
      return next;
    });
    data[field.key] = projected.value;
  }
  return { data, convertedCounters };
}

/** Restores Atlas' textual Counter fallback to Forge's boolean-mark representation. */
export function restoreForgeStatblockDataFromAtlas(
  template: ForgeTemplate,
  source: JsonRecord,
): JsonRecord {
  const data: JsonRecord = { ...source };
  for (const field of template.fields) {
    const parts = counterParts(field);
    if (parts.length === 0 || !Object.prototype.hasOwnProperty.call(data, field.key)) continue;
    const restored = cloneEntryRows(data[field.key], (entry) => {
      let next = entry;
      let overrides = isRecord(next[ABILITY_COUNTER_MAXES_KEY])
        ? { ...(next[ABILITY_COUNTER_MAXES_KEY] as JsonRecord) }
        : {};
      let changed = false;
      for (const part of parts) {
        const value = next[part.key];
        if (isBooleanMarks(value)) continue;
        const parsed = parseAtlasCounterText(value);
        if (!parsed) continue;
        next = { ...next, [part.key]: parsed.marks };
        const defaultMax = clampCounterMax(part.max ?? DEFAULT_ABILITY_COUNTER_MAX, DEFAULT_ABILITY_COUNTER_MAX);
        if (parsed.max !== defaultMax) overrides[part.key] = parsed.max;
        else delete overrides[part.key];
        changed = true;
      }
      if (!changed) return entry;
      if (Object.keys(overrides).length > 0) next[ABILITY_COUNTER_MAXES_KEY] = overrides;
      else delete next[ABILITY_COUNTER_MAXES_KEY];
      return next;
    });
    data[field.key] = restored.value;
  }
  return data;
}

/** Apply the Atlas-facing Counter representation to existing Markdown frontmatter in place. */
export function applyForgeCounterProjectionToFrontmatter(
  template: ForgeTemplate,
  frontmatter: JsonRecord,
): number {
  const projection = projectForgeStatblockDataForAtlas(template, frontmatter);
  for (const field of template.fields) {
    if (Object.prototype.hasOwnProperty.call(projection.data, field.key)) {
      frontmatter[field.key] = projection.data[field.key];
    }
  }
  return projection.convertedCounters;
}

function walkBlocks(blocks: unknown[], visit: (block: JsonRecord, path: string) => void, prefix: string): void {
  blocks.forEach((raw, index) => {
    if (!isRecord(raw)) return;
    const path = `${prefix}[${index}]`;
    visit(raw, path);
    if (Array.isArray(raw.blocks)) walkBlocks(raw.blocks, visit, `${path}.blocks`);
  });
}

/** Reports native fields/blocks and all Forge-only adaptations before publication. */
export function analyzeAtlasTemplateCompatibility(template: ForgeTemplate): AtlasTemplateCompatibilityReport {
  const issues: AtlasTemplateCompatibilityIssue[] = [];
  let convertedAbilityCounters = 0;
  let unknownAbilityPartTypes = 0;
  let unknownFieldTypes = 0;
  let unknownBlockTypes = 0;

  for (const [fieldIndex, field] of template.fields.entries()) {
    if (!(ATLAS_NATIVE_FIELD_TYPES as readonly string[]).includes(field.type)) {
      unknownFieldTypes += 1;
      issues.push({
        severity: 'warning', code: 'unknown-field-type', path: `fields[${fieldIndex}].type`,
        message: `O campo "${field.label.trim() || field.key}" usa o tipo "${field.type}", que não está no formato verificado do Atlas. O valor será preservado no arquivo, mas o Atlas pode ignorá-lo ou tratá-lo como texto.`,
      });
    }
    if (field.type !== 'entries') continue;
    for (const [partIndex, part] of abilityPartsForField(field).entries()) {
      if (part.type === 'counter') {
        convertedAbilityCounters += 1;
        issues.push({
          severity: 'warning', code: 'forge-counter-as-atlas-text',
          path: `fields[${fieldIndex}].entry.extras[${partIndex}]`,
          message: `A Ability Part Counter "${part.label}" será exportada como texto no Atlas (ex.: 2/3). O Forge restaura as marcas e o máximo ao abrir esta mesma nota.`,
        });
      } else if (!(ATLAS_NATIVE_ENTRY_EXTRA_TYPES as readonly string[]).includes(part.type)) {
        unknownAbilityPartTypes += 1;
        issues.push({
          severity: 'warning', code: 'unknown-ability-part-type',
          path: `fields[${fieldIndex}].entry.extras[${partIndex}]`,
          message: `A Ability Part "${part.label}" usa o tipo desconhecido "${part.type}". Ele será mantido sem conversão; o Atlas pode interpretá-lo como texto.`,
        });
      }
    }
  }

  walkBlocks(template.layout.blocks, (block, path) => {
    if (!(ATLAS_NATIVE_BLOCK_TYPES as readonly string[]).includes(String(block.type))) {
      unknownBlockTypes += 1;
      issues.push({
        severity: 'warning', code: 'unknown-layout-block', path: `layout.blocks${path}`,
        message: `O bloco "${String(block.type)}" não pertence ao catálogo verificado do Atlas. Sua estrutura será preservada, mas a renderização nativa pode ignorá-lo.`,
      });
    }
  }, '');

  if (convertedAbilityCounters === 0 && unknownAbilityPartTypes === 0 && unknownFieldTypes === 0 && unknownBlockTypes === 0) {
    issues.push({
      severity: 'info', code: 'native-schema-compatible', path: 'template',
      message: 'Campos, blocos e Ability Parts usam tipos reconhecidos pelo formato Atlas verificado.',
    });
  }
  issues.push({
    severity: 'info', code: 'forge-visual-layout-not-exported', path: 'statblockForge.layout',
    message: 'Grid Dense, dimensões físicas, temas e cores individuais por bloco são exclusivos do Forge e não são aplicados pelo renderer do Atlas. Esses ajustes permanecem no .forgetemplate ou no sidecar Forge associado ao template.',
  });

  const hasWarnings = issues.some((issue) => issue.severity === 'warning');
  return {
    target: 'atlas-native-file',
    canExport: true,
    quality: unknownAbilityPartTypes > 0 || unknownFieldTypes > 0 || unknownBlockTypes > 0
      ? 'best-effort'
      : hasWarnings ? 'degraded' : 'native',
    issues,
    convertedAbilityCounters,
    unknownAbilityPartTypes,
    unknownFieldTypes,
    unknownBlockTypes,
  };
}

/** Creates a safe native Atlas template projection while leaving the Forge model untouched. */
export function projectForgeTemplateForAtlas(template: ForgeTemplate): AtlasTemplateProjection {
  const projected = JSON.parse(JSON.stringify(template)) as ForgeTemplate;
  const report = analyzeAtlasTemplateCompatibility(template);
  for (const field of projected.fields) {
    if (field.type !== 'entries' || !isRecord(field.entry) || !Array.isArray(field.entry.extras)) continue;
    field.entry = {
      ...field.entry,
      extras: field.entry.extras.map((raw) => {
        if (!isRecord(raw) || raw.type !== 'counter') return raw;
        const compatible: JsonRecord = { ...raw, type: 'text' };
        delete compatible.max;
        delete compatible.look;
        return compatible;
      }),
    };
  }

  // Forge's label placement is retained in the editable .forgetemplate.
  // Atlas natively supports run-in and stacked labels, but not the reversed
  // value-above-label order. Project Above Label to the closest native layout
  // (stacked) while Forge's own renderer preserves the exact order.
  walkBlocks(projected.layout.blocks, (block) => {
    // Forge now arms any rendered roll link through its context menu. The old
    // Atlas-native per-Value switches are intentionally omitted from exports.
    delete block.addsToRolls;

    if (block.labelPlacement === 'none') {
      // Atlas stores No Label as an empty block label. Blocks whose visible
      // label comes from a heading need their heading source suppressed too.
      block.label = '';
      if (block.type === 'section') {
        delete block.heading;
        delete block.headingField;
      } else if (['metric', 'text', 'entries', 'spells', 'tabs'].includes(String(block.type))) {
        delete block.heading;
        delete block.headingField;
      }
      delete block.labelPlacement;
      return;
    }
    if (block.type === 'stat' && block.labelPlacement === 'above') {
      // Atlas does not support value-before-label order; stacked is the
      // closest native presentation while Forge preserves the exact order.
      block.look = 'stacked';
      delete block.labelPlacement;
    }
  }, 'layout.blocks');

  return { template: projected, report };
}
