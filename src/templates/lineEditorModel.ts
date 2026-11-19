import { findLayoutBlock } from './layoutEditorModel.ts';
import type { ForgeBlock, ForgeField, ForgeTemplate } from './forgeTemplate.ts';

/** Atlas allows scalar fields only in the values displayed by a Line block. */
export const LINE_FIELD_TYPES = ['text', 'number', 'rating', 'dice', 'choice'] as const;
export const MAX_LINE_FIELDS = 4;

export type LineFieldType = (typeof LINE_FIELD_TYPES)[number];

export function isLineCompatibleField(field: ForgeField): boolean {
  return LINE_FIELD_TYPES.includes(field.type as LineFieldType);
}

export function lineFieldsForTemplate(template: ForgeTemplate): ForgeField[] {
  return template.fields.filter(isLineCompatibleField);
}

function lineBlock(template: ForgeTemplate, blockId: string): ForgeBlock {
  const block = findLayoutBlock(template, blockId);
  if (!block || block.type !== 'line') throw new Error('Bloco Line não encontrado.');
  return block;
}

function currentFields(block: ForgeBlock): string[] {
  return Array.isArray(block.fields)
    ? block.fields.filter((key): key is string => typeof key === 'string' && key.length > 0)
    : [];
}

/** Adds or replaces one field in the ordered native Line.fields array. */
export function setLineField(
  template: ForgeTemplate,
  blockId: string,
  index: number,
  fieldKey: string,
): void {
  const block = lineBlock(template, blockId);
  const field = template.fields.find((item) => item.key === fieldKey);
  if (!field || !isLineCompatibleField(field)) {
    throw new Error('Line aceita apenas campos Text, Number, Rating, Dice e Choice.');
  }

  const fields = currentFields(block);
  if (!Number.isInteger(index) || index < 0 || index > fields.length || index >= MAX_LINE_FIELDS) {
    throw new Error('Posição de valor inválida para o bloco Line.');
  }
  if (fields.some((key, at) => key === fieldKey && at !== index)) {
    throw new Error('Este campo já está presente no bloco Line.');
  }
  if (index === fields.length) fields.push(fieldKey);
  else fields[index] = fieldKey;
  block.fields = fields;
}

/** Removes one ordered field from a Line, preserving the remaining order. */
export function removeLineField(template: ForgeTemplate, blockId: string, index: number): boolean {
  const block = lineBlock(template, blockId);
  const fields = currentFields(block);
  if (!Number.isInteger(index) || index < 0 || index >= fields.length) return false;
  fields.splice(index, 1);
  block.fields = fields;
  return true;
}
