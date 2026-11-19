import type { ForgeBlock, ForgeField, JsonRecord } from './forgeTemplate.ts';
import { isAtlasEmptyFieldValue } from '../statblocks/inlineFieldEmptinessModel.ts';

const NON_VALUE_BLOCK_TYPES = new Set([
  'section', 'row', 'tabs', 'heading', 'divider', 'vertical-divider', 'script', 'opaque',
]);

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
function addMetricFormulaReferences(target: Set<string>, block: ForgeBlock, fields: readonly ForgeField[]): void {
  if (!Array.isArray(block.formulas)) return;
  const knownKeys = new Set(fields.map((field) => field.key));
  for (const formula of block.formulas) {
    if (typeof formula !== 'string') continue;
    for (const match of formula.matchAll(/[A-Za-z_][A-Za-z0-9_.]*/g)) {
      const key = match[0];
      if (knownKeys.has(key)) target.add(key);
    }
  }
}

export function whenEmptyFallbackSourceFieldKeys(block: ForgeBlock, fields: readonly ForgeField[] = []): string[] {
  if (NON_VALUE_BLOCK_TYPES.has(block.type)) return [];

  const keys = new Set<string>();
  switch (block.type) {
    case 'line':
      if (Array.isArray(block.fields)) block.fields.forEach((key) => addKey(keys, key));
      break;
    case 'metric':
      if (Array.isArray(block.fields)) block.fields.forEach((key) => addKey(keys, key));
      addMetricFormulaReferences(keys, block, fields);
      break;
    case 'stat':
      addKey(keys, block.field);
      addKey(keys, block.rollFrom);
      break;
    case 'scores':
      addKey(keys, block.field);
      if (Array.isArray(block.columns)) {
        for (const column of block.columns) {
          if (column && typeof column === 'object') addKey(keys, (column as JsonRecord).field);
        }
      }
      break;
    case 'entries':
      addKey(keys, block.field);
      addKey(keys, block.introField);
      break;
    default:
      addKey(keys, block.field);
      break;
  }

  if (block.type === 'title' || block.type === 'line' || block.type === 'stat') {
    addPatternReferences(keys, block.pattern);
  }
  return [...keys];
}

/** Whether a block should show its fallback instead of its empty bound values. */
export function shouldShowWhenEmptyFallback(block: ForgeBlock, sample: JsonRecord, fields: readonly ForgeField[] = []): boolean {
  if (block.whenEmpty !== 'fallback' || typeof block.fallback !== 'string' || !block.fallback.trim()) return false;
  const sourceKeys = whenEmptyFallbackSourceFieldKeys(block, fields);
  return sourceKeys.length > 0 && sourceKeys.every((key) => isAtlasEmptyFieldValue(sample[key]));
}
