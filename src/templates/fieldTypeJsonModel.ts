/**
 * Forge-owned JSON names for Field types.
 *
 * The editing/runtime model intentionally keeps Atlas-native type IDs so the
 * Atlas adapter and older templates remain compatible. Forge-owned JSON uses
 * the reorganized names and normalizes them back on read.
 */
const FORGE_JSON_FIELD_TYPE_BY_RUNTIME: Readonly<Record<string, string>> = {
  text: 'inline',
  choice: 'selection',
  counters: 'counter',
  spells: 'groups',
};

const RUNTIME_FIELD_TYPE_BY_FORGE_JSON: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(FORGE_JSON_FIELD_TYPE_BY_RUNTIME).map(([runtime, stored]) => [stored, runtime]),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mapTemplateFields(value: unknown, mapper: (type: string) => string): void {
  if (!isRecord(value) || !Array.isArray(value.fields)) return;
  for (const field of value.fields) {
    if (!isRecord(field) || typeof field.type !== 'string') continue;
    field.type = mapper(field.type);
  }
}

function mapCompendiumFieldTypes(value: unknown, mapper: (type: string) => string): void {
  if (!isRecord(value)) return;
  const metadata = value.statblockForge;
  if (!isRecord(metadata) || !isRecord(metadata.layout)) return;
  const compendium = metadata.layout.compendiumByFieldId;
  if (!isRecord(compendium)) return;
  for (const items of Object.values(compendium)) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!isRecord(item) || typeof item.fieldType !== 'string') continue;
      item.fieldType = mapper(item.fieldType);
    }
  }
}

function mapLayoutCompendiumFieldTypes(value: unknown, mapper: (type: string) => string): void {
  if (!isRecord(value) || !isRecord(value.compendiumByFieldId)) return;
  for (const items of Object.values(value.compendiumByFieldId)) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!isRecord(item) || typeof item.fieldType !== 'string') continue;
      item.fieldType = mapper(item.fieldType);
    }
  }
}

/** Maps new Forge JSON names back to the stable runtime/native IDs. Mutates a working clone. */
export function normalizeForgeJsonFieldTypes(value: unknown): void {
  const mapper = (type: string): string => RUNTIME_FIELD_TYPE_BY_FORGE_JSON[type] ?? type;
  mapTemplateFields(value, mapper);
  mapCompendiumFieldTypes(value, mapper);
  mapLayoutCompendiumFieldTypes(value, mapper);
}

/** Maps stable runtime IDs to the new names in Forge-owned JSON. Mutates a working clone. */
export function serializeForgeJsonFieldTypes(value: unknown): void {
  const mapper = (type: string): string => FORGE_JSON_FIELD_TYPE_BY_RUNTIME[type] ?? type;
  mapTemplateFields(value, mapper);
  mapCompendiumFieldTypes(value, mapper);
  mapLayoutCompendiumFieldTypes(value, mapper);
}
