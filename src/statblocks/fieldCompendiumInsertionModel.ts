/** Pure helpers for copying template Compendium items into one statblock instance. */

import type { CollectionFieldType } from '../templates/fieldCompendiumModel.ts';
import { inlineListItems } from './inlineListFieldEditorModel.ts';
import { markFieldCompendiumEntrySource } from './fieldCompendiumUsageModel.ts';

function cloneValue<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Appends a reusable library item to the statblock's current Field value.
 * The inserted data is always a deep copy: subsequent edits to a statblock
 * cannot mutate the template-owned Compendium entry.
 */
export function appendFieldCompendiumItemValue(
  fieldType: CollectionFieldType,
  currentValue: unknown,
  compendiumValue: unknown,
  compendiumItemId?: string,
): unknown {
  if (fieldType === 'entries') {
    const rows = Array.isArray(currentValue)
      ? cloneValue(currentValue)
      : currentValue === undefined || currentValue === null || currentValue === ''
        ? []
        : [cloneValue(currentValue)];
    rows.push(markFieldCompendiumEntrySource(cloneValue(compendiumValue), compendiumItemId ?? ''));
    return rows;
  }

  if (fieldType === 'list') {
    return [...inlineListItems(currentValue), String(compendiumValue ?? '')].filter((item) => item.trim().length > 0);
  }

  if (fieldType === 'pairs') {
    const rows = Array.isArray(currentValue)
      ? cloneValue(currentValue)
      : isRecord(currentValue) ? [cloneValue(currentValue)] : [];
    rows.push(cloneValue(compendiumValue));
    return rows;
  }

  const rows = Array.isArray(currentValue)
    ? cloneValue(currentValue)
    : isRecord(currentValue)
      ? Object.entries(currentValue).map(([key, value]) => ({ [key]: cloneValue(value) }))
      : currentValue === undefined || currentValue === null || currentValue === ''
        ? []
        : [cloneValue(currentValue)];
  const incoming = Array.isArray(compendiumValue)
    ? cloneValue(compendiumValue)
    : [cloneValue(compendiumValue)];
  return [...rows, ...incoming];
}
