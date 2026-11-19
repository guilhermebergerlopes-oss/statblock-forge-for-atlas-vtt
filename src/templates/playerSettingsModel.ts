/**
 * Player access settings for Atlas statblock template fields.
 *
 * Atlas stores only exceptions to each field type's default in `template.players`.
 * This module mirrors that public JSON behavior without importing Atlas runtime code.
 */
import { isRecord, type ForgeBlock, type ForgeField, type ForgeTemplate } from './forgeTemplate.ts';

export type PlayerAccess = 'edit' | 'read' | 'hidden';

export interface PlayerAccessSetting {
  keys: string[];
  value: PlayerAccess;
  choices: PlayerAccess[];
}

const ACCESS_RANK: Readonly<Record<PlayerAccess, number>> = { hidden: 0, read: 1, edit: 2 };

function isPlayerAccess(value: unknown): value is PlayerAccess {
  return value === 'edit' || value === 'read' || value === 'hidden';
}

function formerKeys(field: ForgeField): string[] {
  return Array.isArray(field.formerKeys)
    ? field.formerKeys.filter((key): key is string => typeof key === 'string')
    : [];
}

function fieldByKey(template: ForgeTemplate, key: string): ForgeField | undefined {
  return template.fields.find((field) => field.key === key);
}

/** Spell lists are read-only by default; other field types are editable by default. */
export function defaultPlayerAccess(field: ForgeField): PlayerAccess {
  return field.type === 'spells' ? 'read' : 'edit';
}

/** A spell-list-only setting cannot offer Edit because Atlas never lets players edit spell lists. */
export function playerAccessChoices(fields: readonly ForgeField[]): PlayerAccess[] {
  return fields.length > 0 && fields.every((field) => field.type === 'spells')
    ? ['read', 'hidden']
    : ['edit', 'read', 'hidden'];
}

function fixedReadField(template: ForgeTemplate, field: ForgeField): boolean {
  const fixedKeys = new Set([
    template.fields.find((item) => item.key === 'name')?.key ?? 'name',
    template.fields.find((item) => item.key === 'image')?.key ?? 'image',
    template.fields.find((item) => item.meaning === 'display-name')?.key,
  ].filter((key): key is string => typeof key === 'string'));
  return fixedKeys.has(field.key) || field.type === 'image';
}

/** Effective access Atlas applies to a field, including fixed header/image and spell-list rules. */
export function effectivePlayerAccess(template: ForgeTemplate, key: string): PlayerAccess {
  const field = fieldByKey(template, key);
  if (!field) return 'hidden';
  if (fixedReadField(template, field)) return 'read';

  const players = isRecord(template.players) ? template.players : {};
  let stored: PlayerAccess | undefined;
  for (const candidate of [field.key, ...formerKeys(field)]) {
    if (!Object.prototype.hasOwnProperty.call(players, candidate)) continue;
    stored = isPlayerAccess(players[candidate]) ? players[candidate] : 'hidden';
    break;
  }
  if (field.type === 'spells') return stored === 'hidden' ? 'hidden' : 'read';
  return stored ?? defaultPlayerAccess(field);
}

function stricter(a: PlayerAccess, b: PlayerAccess): PlayerAccess {
  return ACCESS_RANK[a] <= ACCESS_RANK[b] ? a : b;
}

/**
 * Returns the field keys controlled by a selected block. Abilities tabs are
 * recognized only when every tab contains exactly one Entries block, matching
 * Atlas's special Abilities-tabs structure. Metrics control all their named fields.
 */
export function playerKeysForBlock(block: ForgeBlock): string[] {
  if (block.type === 'line') return [];
  const headingKey = typeof block.headingField === 'string' && block.headingField.trim().length > 0
    ? block.headingField
    : undefined;
  const includeHeading = (keys: readonly string[]): string[] => [
    ...new Set([...keys, ...(headingKey ? [headingKey] : [])]),
  ];
  if (block.type === 'entries') {
    return includeHeading(typeof block.field === 'string' ? [block.field] : []);
  }
  if (block.type === 'metric') {
    const fields = Array.isArray(block.fields)
      ? block.fields.filter((key): key is string => typeof key === 'string' && key.length > 0)
      : [];
    return includeHeading(fields);
  }
  if (block.type === 'tabs' && Array.isArray(block.blocks) && block.blocks.length > 0) {
    const tabs = block.blocks.filter(isRecord);
    const isAbilitiesTabs = tabs.length === block.blocks.length && tabs.every((tab) =>
      tab.type === 'section' && Array.isArray(tab.blocks) && tab.blocks.length === 1
      && isRecord(tab.blocks[0]) && tab.blocks[0].type === 'entries' && typeof tab.blocks[0].field === 'string');
    if (isAbilitiesTabs) {
      const abilityFields = [...new Set(tabs.map((tab) => {
        const entries = (tab.blocks as Record<string, unknown>[])[0];
        return String(entries?.field ?? '');
      }).filter(Boolean))];
      return includeHeading(abilityFields);
    }
    return includeHeading([]);
  }
  return includeHeading(typeof block.field === 'string' && block.field.length > 0 ? [block.field] : []);
}

/** Current common setting shown for all the block's fields; the strictest access wins. */
export function playerAccessSetting(template: ForgeTemplate, block: ForgeBlock): PlayerAccessSetting | null {
  const keys = playerKeysForBlock(block);
  // Atlas always exposes fixed header/name and image values as read-only. Do
  // not show a control whose choices could not affect those values.
  const fields = keys.map((key) => fieldByKey(template, key))
    .filter((field): field is ForgeField => field !== undefined && !fixedReadField(template, field));
  if (fields.length === 0) return null;
  const value = fields.map((field) => effectivePlayerAccess(template, field.key)).reduce(stricter);
  return { keys: fields.map((field) => field.key), value, choices: playerAccessChoices(fields) };
}

/**
 * Sets one access choice for every field shown by a block, keeping only
 * non-default exceptions and leaving unrelated/unknown player keys untouched.
 */
export function withPlayerAccess(
  template: ForgeTemplate,
  keys: readonly string[],
  access: PlayerAccess,
): ForgeTemplate {
  const players: Record<string, unknown> = isRecord(template.players) ? { ...template.players } : {};
  for (const key of keys) {
    const field = fieldByKey(template, key);
    if (!field || fixedReadField(template, field)) continue;
    for (const former of [field.key, ...formerKeys(field)]) delete players[former];
    const choices = playerAccessChoices([field]);
    const own = choices.includes(access) ? access : defaultPlayerAccess(field);
    if (own !== defaultPlayerAccess(field)) players[field.key] = own;
  }

  const previousCandidate = template.players;
  const previousIsRecord = isRecord(previousCandidate);
  const previous: Record<string, unknown> = previousIsRecord ? previousCandidate : {};
  const changed = (!previousIsRecord && template.players !== undefined)
    || Object.keys(players).length !== Object.keys(previous).length
    || Object.entries(players).some(([key, value]) => previous[key] !== value);
  if (!changed) return template;

  const next: ForgeTemplate = { ...template };
  if (Object.keys(players).length > 0) next.players = players;
  else delete next.players;
  return next;
}
