import type { ForgeLayoutDocument } from './forgeTemplate.ts';

/** Default number of named Counter tracks shown on each visual line. */
export const DEFAULT_COUNTERS_PER_ROW = 2;

/** Normalize a Counter column count to a positive, whole, safely representable number. */
export function normalizeCountersPerRow(value: unknown): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_COUNTERS_PER_ROW;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(1, Math.floor(parsed)));
}

/** Update the visual layout for one Counters block without changing its Field. */
export function setCountersPerRow(layout: ForgeLayoutDocument, blockId: string, value: unknown): boolean {
  const metadata = layout.blocks[blockId];
  if (!metadata) return false;
  const normalized = normalizeCountersPerRow(value);
  if (metadata.countersPerRow === normalized) return false;
  metadata.countersPerRow = normalized;
  return true;
}
