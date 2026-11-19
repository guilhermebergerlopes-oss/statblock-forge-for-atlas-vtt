import type { ForgeField } from './forgeTemplate.ts';
import type { ForgeLayoutDocument } from './forgeTemplate.ts';

/**
 * Categories group related Field data structures. Value and Metric stay
 * separate because they create different default Canvas blocks; specialized
 * collection and resource types share broader categories instead of requiring
 * one category per renderer.
 */
export const FIELD_CATEGORY_TYPES = {
  value: ['text', 'number', 'rating', 'dice', 'choice'],
  metric: ['text', 'number', 'rating', 'dice', 'choice'],
  collections: ['entries', 'list', 'pairs', 'spells'],
  table: ['scores'],
  resources: ['counters', 'checkboxes'],
  text: ['markdown'],
  image: ['image'],
} as const;

export type ForgeFieldCategory = keyof typeof FIELD_CATEGORY_TYPES;

/** Categories used by earlier Forge versions, normalized when a Field is read. */
const LEGACY_CATEGORY_ALIASES: Readonly<Record<string, ForgeFieldCategory>> = {
  abilities: 'collections',
  tags: 'collections',
  pairs: 'collections',
  spells: 'collections',
  counters: 'resources',
  checkboxes: 'resources',
};

const CATEGORY_BY_FIELD_TYPE: Readonly<Record<string, ForgeFieldCategory>> = {
  text: 'value',
  number: 'value',
  rating: 'value',
  dice: 'value',
  choice: 'value',
  markdown: 'text',
  list: 'collections',
  scores: 'table',
  entries: 'collections',
  pairs: 'collections',
  image: 'image',
  spells: 'collections',
  counters: 'resources',
  checkboxes: 'resources',
};

export function fieldTypesForCategory(category: ForgeFieldCategory): readonly string[] {
  return FIELD_CATEGORY_TYPES[category];
}

/**
 * Keeps a saved Category when it supports the current type. Earlier templates
 * may store one of the narrower categories (Tags, Pairs, Spells, Abilities,
 * Counters or Checkboxes); those values are migrated to their new group while
 * preserving the actual Field type.
 */
export function resolveFieldCategory(
  layout: ForgeLayoutDocument | null,
  field: ForgeField,
): ForgeFieldCategory {
  const saved = layout?.fieldKinds?.[field.key];
  if (typeof saved === 'string') {
    const normalized = LEGACY_CATEGORY_ALIASES[saved] ?? saved;
    if (Object.prototype.hasOwnProperty.call(FIELD_CATEGORY_TYPES, normalized)) {
      const category = normalized as ForgeFieldCategory;
      if ((FIELD_CATEGORY_TYPES[category] as readonly string[]).includes(field.type)) {
        if (layout) {
          layout.fieldKinds ??= {};
          layout.fieldKinds[field.key] = category;
        }
        return category;
      }
    }
  }

  const inferred = CATEGORY_BY_FIELD_TYPE[field.type] ?? 'value';
  if (layout) {
    layout.fieldKinds ??= {};
    layout.fieldKinds[field.key] = inferred;
  }
  return inferred;
}
