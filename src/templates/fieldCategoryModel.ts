import type { ForgeField } from './forgeTemplate.ts';
import type { ForgeLayoutDocument } from './forgeTemplate.ts';

/**
 * Current presentation groups for user-created Fields. The runtime model keeps
 * Atlas-compatible IDs, while Forge-owned JSON writes reorganized type IDs.
 */
export const FIELD_CATEGORY_TYPES = {
  values: ['number', 'rating', 'dice', 'counters'],
  text: ['text', 'markdown'],
  choice: ['checkboxes', 'choice'],
  image: ['image'],
  collections: ['list', 'entries', 'pairs', 'spells'],
} as const;

export type ForgeFieldCategory = keyof typeof FIELD_CATEGORY_TYPES;

/** Default native Field type selected when a presentation group is opened. */
export const FIELD_CATEGORY_DEFAULT_TYPES: Readonly<Record<ForgeFieldCategory, string>> = {
  values: 'number',
  text: 'text',
  choice: 'checkboxes',
  image: 'image',
  collections: 'list',
};

/** Older saved Field categories are normalized by the actual Field type. */
const LEGACY_CATEGORY_ALIASES: Readonly<Record<string, ForgeFieldCategory>> = {
  value: 'values',
  metric: 'values',
  resources: 'values',
  counters: 'values',
  checkboxes: 'choice',
  abilities: 'collections',
  tags: 'collections',
  pairs: 'collections',
  spells: 'collections',
  table: 'collections',
};

const CATEGORY_BY_FIELD_TYPE: Readonly<Record<string, ForgeFieldCategory>> = {
  number: 'values',
  rating: 'values',
  dice: 'values',
  counters: 'values',
  text: 'text',
  markdown: 'text',
  checkboxes: 'choice',
  choice: 'choice',
  image: 'image',
  list: 'collections',
  entries: 'collections',
  pairs: 'collections',
  spells: 'collections',
  // Legacy Scores storage is kept readable for old Table blocks but is not a
  // user-created Field type and is excluded from the Field palette.
  scores: 'collections',
};

export function fieldTypesForCategory(category: ForgeFieldCategory): readonly string[] {
  return FIELD_CATEGORY_TYPES[category];
}

/**
 * Keeps compatible saved categories and migrates old category names. If an
 * old broad category no longer matches the new grouping (for example a Text
 * Field formerly saved as Value), the current type determines its new group.
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

  const inferred = CATEGORY_BY_FIELD_TYPE[field.type] ?? 'values';
  if (layout) {
    layout.fieldKinds ??= {};
    layout.fieldKinds[field.key] = inferred;
  }
  return inferred;
}
