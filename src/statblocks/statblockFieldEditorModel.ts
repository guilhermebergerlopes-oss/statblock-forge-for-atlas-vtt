import { isRecord, type ForgeField } from '../templates/forgeTemplate.ts';
import { stripFieldCompendiumEntrySourceMetadata } from './fieldCompendiumUsageModel.ts';
import { numberFieldAdvantageRollFormula } from './inlineNumericFieldEditorModel.ts';

export type StatblockFieldEditorMode = 'number' | 'text' | 'multiline' | 'list' | 'json';

const JSON_FIELD_TYPES = new Set(['scores', 'entries', 'pairs', 'spells', 'counters']);

export function statblockFieldEditorMode(field: ForgeField, value: unknown): StatblockFieldEditorMode {
  if (field.type === 'number') return 'number';
  if (field.type === 'markdown') return 'multiline';
  if (field.type === 'list') return 'list';
  if (JSON_FIELD_TYPES.has(field.type) || Array.isArray(value) || isRecord(value)) return 'json';
  return 'text';
}

export function statblockFieldEditorInitialValue(mode: StatblockFieldEditorMode, value: unknown, fieldType?: string): string {
  if (mode === 'json') {
    const editorValue = fieldType === 'entries' ? stripFieldCompendiumEntrySourceMetadata(value) : value;
    return JSON.stringify(editorValue ?? (fieldType === 'pairs' ? {} : []), null, 2) ?? (fieldType === 'pairs' ? '{}' : '[]');
  }
  if (mode === 'list') {
    if (Array.isArray(value)) return value.map((item) => String(item ?? '')).join('\n');
    return typeof value === 'string' ? value : '';
  }
  return value === null || value === undefined ? '' : String(value);
}

export function parseStatblockFieldEditorValue(
  field: ForgeField,
  mode: StatblockFieldEditorMode,
  rawValue: string,
): unknown {
  if (mode === 'number') {
    const trimmed = rawValue.trim();
    if (!trimmed) return null;
    if (numberFieldAdvantageRollFormula(trimmed)) return trimmed;
    const value = Number(trimmed);
    if (!Number.isFinite(value)) throw new Error(`O campo "${field.label || field.key}" precisa conter um número válido.`);
    return value;
  }
  if (mode === 'list') return rawValue.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  if (mode === 'json') {
    const trimmed = rawValue.trim();
    if (!trimmed) return field.type === 'pairs' ? {} : [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error(`O campo "${field.label || field.key}" contém JSON inválido.`);
    }
    if (field.type === 'pairs' && !isRecord(parsed)) {
      throw new Error(`O campo "${field.label || field.key}" precisa receber um objeto JSON.`);
    }
    if (['scores', 'entries', 'spells', 'counters'].includes(field.type) && !Array.isArray(parsed)) {
      throw new Error(`O campo "${field.label || field.key}" precisa receber uma lista JSON.`);
    }
    return parsed;
  }
  return rawValue;
}
