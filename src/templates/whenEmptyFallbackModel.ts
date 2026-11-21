import type { ForgeBlock, ForgeField, JsonRecord } from './forgeTemplate.ts';

const NON_VALUE_BLOCK_TYPES = new Set([
  'section', 'row', 'tabs', 'heading', 'divider', 'vertical-divider', 'script', 'opaque',
]);

/**
 * A lone dash is the renderer's visible placeholder for an unset Field.
 * Treat common dash glyphs as empty for When Empty only; do not change Atlas'
 * general emptiness semantics used by editing/focus behavior elsewhere.
 */
function isWhenEmptySourceValue(value: unknown, depth = 0): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' || /^[-\u2013\u2014\u2212]$/.test(trimmed);
  }
  if (typeof value === 'number') return Number.isNaN(value);
  if (depth >= 32) return false;
  if (Array.isArray(value)) return value.every((item) => isWhenEmptySourceValue(item, depth + 1));
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every((item) => isWhenEmptySourceValue(item, depth + 1));
  }
  return false;
}

function addKey(target: Set<string>, value: unknown): void {
  if (typeof value === 'string' && value.trim()) target.add(value);
}

function addPatternReferences(target: Set<string>, value: unknown): void {
  if (typeof value !== 'string') return;
  // Forge's shared renderer currently expands simple {fieldKey} references.
  // References in the fallback itself are intentionally not visibility inputs.
  for (const match of value.matchAll(/\{([A-Za-z0-9_-]+)\}/g)) {
    if (match[1]) target.add(match[1]);
  }
}

/**
 * Fields whose values make a leaf block non-empty. This mirrors Atlas' public
 * block binding rules while deliberately excluding fallback-pattern fields.
 */
function addFormulaFieldReferences(target: Set<string>, formula: string, fields: readonly ForgeField[], baseFieldKey?: string): void {
  const knownKeys = new Set(fields.map((field) => field.key));
  const tokenPattern = /@([A-Za-z_][A-Za-z0-9_.-]*)|\{([A-Za-z_][A-Za-z0-9_.-]*)\}|([A-Za-z_][A-Za-z0-9_.]*)/g;
  for (const match of formula.matchAll(tokenPattern)) {
    const explicit = match[1] ?? match[2];
    const bare = match[3];
    const key = explicit ?? bare;
    if (!key) continue;
    if (key === 'value' && baseFieldKey) {
      target.add(baseFieldKey);
      continue;
    }
    if (['true', 'false'].includes(key.toLowerCase())) continue;
    if (bare && !explicit) {
      const next = formula.slice((match.index ?? 0) + bare.length).match(/^\s*(.)/)?.[1];
      if (next === '(') continue;
    }
    if (knownKeys.has(key)) target.add(key);
    else {
      const root = key.split('.')[0];
      if (knownKeys.has(root)) target.add(root);
    }
  }
}

function addFieldValueSources(target: Set<string>, fieldKey: unknown, fields: readonly ForgeField[]): void {
  if (typeof fieldKey !== 'string' || !fieldKey.trim()) return;
  const field = fields.find((candidate) => candidate.key === fieldKey);
  const formula = field && (field.type === 'number' || field.type === 'rating')
    && typeof field.formula === 'string' ? field.formula.trim() : '';
  if (formula) addFormulaFieldReferences(target, formula, fields, fieldKey);
  else target.add(fieldKey);
}

function addMetricFormulaReferences(target: Set<string>, block: ForgeBlock, fields: readonly ForgeField[]): void {
  if (!Array.isArray(block.formulas)) return;
  for (const formula of block.formulas) {
    if (typeof formula === 'string' && formula.trim()) addFormulaFieldReferences(target, formula, fields);
  }
}

export function whenEmptyFallbackSourceFieldKeys(block: ForgeBlock, fields: readonly ForgeField[] = []): string[] {
  if (NON_VALUE_BLOCK_TYPES.has(block.type)) return [];

  const keys = new Set<string>();

  // These blocks display the expanded Pattern instead of their bound Field(s).
  // Only the values that actually feed the Pattern decide whether it is empty;
  // unrelated bindings must not suppress the fallback.
  if ((block.type === 'title' || block.type === 'line' || block.type === 'stat')
    && typeof block.pattern === 'string' && block.pattern.trim()) {
    addPatternReferences(keys, block.pattern);
    return [...keys];
  }

  switch (block.type) {
    case 'line':
      if (Array.isArray(block.fields)) block.fields.forEach((key) => addFieldValueSources(keys, key, fields));
      break;
    case 'metric': {
      const metricFields = Array.isArray(block.fields) ? block.fields : [];
      const formulas = Array.isArray(block.formulas) ? block.formulas : [];
      metricFields.forEach((key, index) => {
        const formula = typeof formulas[index] === 'string' ? formulas[index].trim() : '';
        if (formula) addFormulaFieldReferences(keys, formula, fields);
        else addFieldValueSources(keys, key, fields);
      });
      // Keep references from formula slots even when a legacy block contains
      // fewer bound Field slots than formulas.
      addMetricFormulaReferences(keys, { ...block, formulas: formulas.slice(metricFields.length) }, fields);
      break;
    }
    case 'stat':
      // rollFrom is a dice/action source, not the value rendered by this Stat.
      // Counting it here made an empty Stat look populated whenever its roll
      // source had a value.
      addFieldValueSources(keys, block.field, fields);
      break;
    case 'scores':
      addKey(keys, block.field);
      if (Array.isArray(block.fields)) block.fields.forEach((key) => addFieldValueSources(keys, key, fields));
      break;
    case 'entries':
      addKey(keys, block.field);
      addKey(keys, block.introField);
      break;
    default:
      addFieldValueSources(keys, block.field, fields);
      break;
  }

  return [...keys];
}

/** Whether a block should show its fallback instead of its empty bound values. */
export function shouldShowWhenEmptyFallback(block: ForgeBlock, sample: JsonRecord, fields: readonly ForgeField[] = []): boolean {
  if (block.whenEmpty !== 'fallback' || typeof block.fallback !== 'string' || !block.fallback.trim()) return false;
  const sourceKeys = whenEmptyFallbackSourceFieldKeys(block, fields);
  return sourceKeys.length > 0 && sourceKeys.every((key) => isWhenEmptySourceValue(sample[key]));
}
