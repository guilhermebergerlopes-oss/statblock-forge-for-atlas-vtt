import type { ForgeTemplate } from '../templates/forgeTemplate.ts';

const ROLL_NAME_LABELS = [
  '.statblock-forge__preview-stat-label',
  '.statblock-forge__preview-block-heading',
  '.statblock-forge__preview-field-label',
  '.statblock-forge__preview-line-label',
  '.statblock-forge__preview-entry-part-label',
  '.atlas-sb-label',
  '.atlas-sb-property-name',
].join(',');

/** Resolves a clicked Forge roll link to a key belonging to its active Template. */
export function forgeFieldKeyForRollLink(link: HTMLElement, template?: ForgeTemplate): string {
  const validFieldKeys = template ? new Set(template.fields.map((field) => field.key)) : undefined;
  const candidates = [
    link.dataset.forgeDiceFieldKey,
    link.closest<HTMLElement>('[data-forge-roll-field-key]')?.dataset.forgeRollFieldKey,
    link.closest<HTMLElement>('[data-forge-inline-field]')?.dataset.forgeInlineField,
    link.closest<HTMLElement>('[data-prop]')?.dataset.prop,
  ];
  for (const candidate of candidates) {
    const key = candidate?.trim();
    if (key && (!validFieldKeys || validFieldKeys.has(key))) return key;
  }
  if (!template) return '';

  // Some renderer-owned bonus links sit inside a layout block rather than a
  // Field wrapper. Recover the Field from the block definition, but only when
  // the key is present in this exact Template.
  const blockId = link.closest<HTMLElement>('[data-block-id]')?.dataset.blockId;
  const layoutBlocks = template.layout?.blocks as Record<string, { field?: unknown }> | undefined;
  const blockField = blockId ? layoutBlocks?.[blockId]?.field : undefined;
  const activeTemplateFieldKeys = new Set(template.fields.map((field) => field.key));
  if (typeof blockField === 'string' && activeTemplateFieldKeys.has(blockField)) return blockField;

  // Metric/score renderers can preserve a roll name after Atlas strips child
  // Field attributes. Accept only a unique Template label/key match.
  const rollName = link.closest<HTMLElement>('[data-roll-name]')?.dataset.rollName?.trim()
    || link.closest<HTMLElement>(ROLL_NAME_LABELS)?.textContent?.trim();
  if (rollName) {
    const normalized = rollName.toLocaleLowerCase();
    const matches = template.fields.filter((field) =>
      field.key.toLocaleLowerCase() === normalized || field.label.trim().toLocaleLowerCase() === normalized,
    );
    if (matches.length === 1) return matches[0]!.key;
  }
  return '';
}

/** Used only for roll links whose origin has no one-to-one Field wrapper in the rendered sheet. */
export const GENERIC_FORGE_ROLL_LINK_FIELD_KEY = '__forge_roll_link__';
