import type { ForgeLayoutDocument } from './forgeTemplate.ts';

/** Default number of named Counter tracks shown on each visual line. */
export const DEFAULT_COUNTERS_PER_ROW = 2;
export const MAX_COUNTERS_PER_ROW = 6;

/** Clamp persisted Block layout settings while keeping older templates compact. */
export function normalizeCountersPerRow(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_COUNTERS_PER_ROW;
  return Math.max(1, Math.min(MAX_COUNTERS_PER_ROW, Math.floor(value)));
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
