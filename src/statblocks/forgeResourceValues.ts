import { isRecord, type ForgeBlock, type ForgeField, type ForgeTemplate, type JsonRecord } from '../templates/forgeTemplate.ts';

/** Current values for Atlas-style self-tracked numbers, stored on the Forge statblock. */
export const FORGE_RESOURCE_VALUES_KEY = '__forgeResourceValues';

export interface ForgeTrackedResourceDefinition {
  field: ForgeField;
  /** Atlas treats a missing/invalid max reference as the tracked field's own value. */
  maxField: ForgeField;
  counts: 'down' | 'up';
}

function flattenBlocks(blocks: readonly ForgeBlock[]): ForgeBlock[] {
  return blocks.flatMap((block) => [
    block,
    ...(Array.isArray(block.blocks) ? flattenBlocks(block.blocks.filter(isRecord) as ForgeBlock[]) : []),
  ]);
}

/**
 * Atlas' trackedNumbers() considers field.tracks first, then an unbound Track block.
 * A missing or invalid `tracks.max` means that the tracked field itself holds the maximum.
 */
export function forgeTrackedResourceDefinitionsFor(
  fields: readonly ForgeField[],
  sourceBlocks: readonly ForgeBlock[],
  header?: JsonRecord,
): ForgeTrackedResourceDefinition[] {
  const numberFields = fields.filter((field) => field.type === 'number');
  const numberKeys = new Set(numberFields.map((field) => field.key));
  const unboundTracks = new Map<string, 'down' | 'up'>();
  const blocks = flattenBlocks(sourceBlocks);

  for (const block of blocks) {
    if (block.type !== 'track' || block.resource || typeof block.field !== 'string' || unboundTracks.has(block.field)) continue;
    if (block.counts === 'down' || block.counts === 'up') unboundTracks.set(block.field, block.counts);
  }

  // Atlas also derives an unbound Track from the fixed HP header part.
  const headerTrack = isRecord(header) && isRecord(header.hitPoints)
    ? header.hitPoints : null;
  const headerHp = numberFields.find((field) => field.meaning === 'hit-points')
    ?? numberFields.find((field) => field.key === 'hp');
  if (headerTrack && !headerTrack.resource && headerHp && !unboundTracks.has(headerHp.key)
    && (headerTrack.counts === 'down' || headerTrack.counts === 'up')) {
    unboundTracks.set(headerHp.key, headerTrack.counts);
  }

  return numberFields.flatMap((field): ForgeTrackedResourceDefinition[] => {
    const tracks = isRecord(field.tracks) ? field.tracks : null;
    const counts = tracks?.counts === 'down' || tracks?.counts === 'up'
      ? tracks.counts
      : unboundTracks.get(field.key);
    if (!counts) return [];
    const maxKey = typeof tracks?.max === 'string' && numberKeys.has(tracks.max) ? tracks.max : field.key;
    const maxField = numberFields.find((candidate) => candidate.key === maxKey) ?? field;
    return [{ field, maxField, counts }];
  });
}

export function forgeTrackedResourceDefinitions(template: ForgeTemplate): ForgeTrackedResourceDefinition[] {
  return forgeTrackedResourceDefinitionsFor(template.fields, template.layout.blocks, isRecord(template.header) ? template.header : undefined);
}

export function forgeTrackedResourceForField(
  template: ForgeTemplate,
  fieldKey: string,
): ForgeTrackedResourceDefinition | undefined {
  return forgeTrackedResourceDefinitions(template).find((resource) => resource.field.key === fieldKey);
}

function resourceValues(data: JsonRecord): Record<string, number> | null {
  const raw = data[FORGE_RESOURCE_VALUES_KEY];
  if (raw === undefined) return {};
  if (!isRecord(raw)) return null;
  const values: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key || typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return null;
    values[key] = value;
  }
  return values;
}

/** Atlas trackedValue() default: down-counting resources begin full; up-counting begin empty. */
export function forgeTrackedResourceCurrent(
  data: JsonRecord,
  fieldKey: string,
  max: number,
  counts: 'down' | 'up',
): number | null {
  const values = resourceValues(data);
  if (!values) return null;
  const fallback = counts === 'down' ? max : 0;
  const current = values[fieldKey] ?? fallback;
  return Math.max(0, Math.min(max, current));
}

/** Writes one self-tracked current value and preserves all other tracked resources. */
export function setForgeTrackedResourceCurrent(data: JsonRecord, fieldKey: string, current: number): boolean {
  if (!fieldKey.trim() || !Number.isSafeInteger(current) || current < 0) return false;
  const values = resourceValues(data);
  if (!values) return false;
  values[fieldKey] = current;
  data[FORGE_RESOURCE_VALUES_KEY] = values;
  return true;
}

export function forgeResourceValuesAreValid(data: JsonRecord): boolean {
  return resourceValues(data) !== null;
}


/**
 * Adds only Forge's tracked-Resource state to the declared Field values used by Rest/rendering.
 * Legacy Forge Condition metadata is deliberately not interpreted or exposed to the runtime.
 */
export function forgeRestDataWithResources(boundData: JsonRecord, sourceData: JsonRecord): JsonRecord {
  const data: JsonRecord = { ...boundData };
  if (!Object.prototype.hasOwnProperty.call(data, FORGE_RESOURCE_VALUES_KEY)
    && Object.prototype.hasOwnProperty.call(sourceData, FORGE_RESOURCE_VALUES_KEY)) {
    data[FORGE_RESOURCE_VALUES_KEY] = sourceData[FORGE_RESOURCE_VALUES_KEY];
  }
  return data;
}
