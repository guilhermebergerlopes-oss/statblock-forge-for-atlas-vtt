import type { ForgeBlock, ForgeField, JsonRecord } from '../templates/forgeTemplate.ts';
import { forgeTrackedResourceCurrent, forgeTrackedResourceDefinitionsFor } from './forgeResourceValues.ts';

export interface TrackedNumberDisplay {
  current: number;
  maximum: number;
  maxField: ForgeField;
  counts: 'down' | 'up';
}

/**
 * Resolves the native Atlas presentation for a Number Value whose Field is
 * tracked either directly (`field.tracks`) or by an unbound Track block.
 * This is presentation only: it does not change how Atlas owns token Resources
 * or how Forge persists its existing preview values.
 */
export function trackedNumberDisplayForField(
  field: ForgeField,
  fields: readonly ForgeField[],
  sample: JsonRecord,
  readNumber: (source: ForgeField) => number | null,
  sourceBlocks: readonly ForgeBlock[] = [],
  sourceHeader?: JsonRecord,
): TrackedNumberDisplay | null {
  if (field.type !== 'number') return null;
  const definition = forgeTrackedResourceDefinitionsFor(fields, sourceBlocks, sourceHeader)
    .find((candidate) => candidate.field.key === field.key);
  if (!definition) return null;

  const { maxField, counts } = definition;
  const rawMaximum = readNumber(maxField);
  // Match Atlas trackedMax(): a maximum below one does not produce a tracked value.
  if (rawMaximum === null || !Number.isFinite(rawMaximum) || rawMaximum < 1) return null;
  const maximum = Math.floor(rawMaximum);
  if (maximum < 1) return null;

  const current = forgeTrackedResourceCurrent(sample, field.key, maximum, counts);
  if (current === null) return null;
  return { current, maximum, maxField, counts };
}
