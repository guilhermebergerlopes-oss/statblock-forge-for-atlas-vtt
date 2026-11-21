import { findLayoutBlock } from './layoutEditorModel.ts';
import type { ForgeBlock, ForgeField, ForgeTemplate } from './forgeTemplate.ts';

/** Atlas Title blocks bind to a single In-line Field and support heading levels 1–3. */
export const TITLE_FIELD_TYPES = ['text'] as const;
export const TITLE_LEVELS = [1, 2, 3] as const;
export type TitleLevel = (typeof TITLE_LEVELS)[number];

export function isTitleCompatibleField(field: ForgeField): boolean {
  return TITLE_FIELD_TYPES.includes(field.type as (typeof TITLE_FIELD_TYPES)[number]);
}

/** Includes fixed header In-line Fields such as Name and Type, which are valid Title sources. */
export function titleFieldsForTemplate(template: ForgeTemplate): ForgeField[] {
  return template.fields.filter(isTitleCompatibleField);
}

function titleBlock(template: ForgeTemplate, blockId: string): ForgeBlock {
  const block = findLayoutBlock(template, blockId);
  if (!block || block.type !== 'title') throw new Error('Bloco Title não encontrado.');
  return block;
}

/** Changes the required Title field without changing the block identity or other Atlas properties. */
export function setTitleField(template: ForgeTemplate, blockId: string, fieldKey: string): void {
  const block = titleBlock(template, blockId);
  const field = template.fields.find((candidate) => candidate.key === fieldKey);
  if (!field || !isTitleCompatibleField(field)) {
    throw new Error('Title aceita apenas campos do tipo In-line.');
  }
  block.field = fieldKey;
}

/** Sets one of Atlas' three native heading levels. */
export function setTitleLevel(template: ForgeTemplate, blockId: string, level: number): void {
  const block = titleBlock(template, blockId);
  if (!TITLE_LEVELS.includes(level as TitleLevel)) {
    throw new Error('O nível de Title deve ser 1, 2 ou 3.');
  }
  block.level = level;
}

/** Stores an optional native pattern; an empty value removes the property. */
export function setTitlePattern(template: ForgeTemplate, blockId: string, pattern: string): void {
  const block = titleBlock(template, blockId);
  if (pattern.trim().length === 0) delete block.pattern;
  else block.pattern = pattern;
}
