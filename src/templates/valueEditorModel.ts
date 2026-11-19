import { isRecord, type ForgeBlock, type ForgeTemplate } from './forgeTemplate.ts';

export type ValueDisplayMode = 'number' | 'boxes' | 'gauge';

function locateValueBlock(blocks: unknown[], blockId: string): { siblings: unknown[]; index: number; block: ForgeBlock } | null {
  for (let index = 0; index < blocks.length; index += 1) {
    const candidate = blocks[index];
    if (!isRecord(candidate) || typeof candidate.id !== 'string' || typeof candidate.type !== 'string') continue;
    const block = candidate as ForgeBlock;
    if (block.id === blockId) return { siblings: blocks, index, block };
    if (Array.isArray(block.blocks)) {
      const nested = locateValueBlock(block.blocks, blockId);
      if (nested) return nested;
    }
  }
  return null;
}

export function valueDisplayMode(block: ForgeBlock): ValueDisplayMode | null {
  if (block.type === 'stat') return 'number';
  if (block.type === 'track') return block.look === 'gauge' ? 'gauge' : 'boxes';
  return null;
}

/**
 * Switches a numeric Value between Atlas' native Stat (Number) and Track
 * (Boxes/Gauge) block types. Only properties supported by both native shapes
 * are carried across; the bound field itself is never changed.
 */
export function setValueDisplayMode(
  template: ForgeTemplate,
  blockId: string,
  mode: ValueDisplayMode,
): boolean {
  const found = locateValueBlock(template.layout.blocks, blockId);
  if (!found || !['stat', 'track'].includes(found.block.type)) return false;
  const current = found.block;
  const fieldKey = typeof current.field === 'string' ? current.field : '';
  const field = template.fields.find((candidate) => candidate.key === fieldKey);
  if (!field || !['number', 'rating'].includes(field.type)) return false;
  if (valueDisplayMode(current) === mode) return false;

  // Atlas makes a Number tracked the first time it is displayed as a Track,
  // and keeps that tracking when the display is changed back to a Number.
  // Resource-backed Track blocks are the exception: their value belongs to
  // the collection Resource, not to the Field's own tracking state.
  if (!(current.type === 'track' && current.resource !== undefined)) {
    const previousTracks = isRecord(field.tracks) ? field.tracks : {};
    const counts = previousTracks.counts === 'up' || previousTracks.counts === 'down'
      ? previousTracks.counts
      : current.type === 'track' && current.counts === 'up' ? 'up' : 'down';
    field.tracks = { ...previousTracks, counts };
  }

  const shared: Record<string, unknown> = { id: current.id, field: fieldKey };
  for (const key of ['label', 'labelPlacement', 'className', 'size', 'showWhen', 'whenEmpty', 'fallback', 'fsExtras']) {
    if (current[key] !== undefined) shared[key] = current[key];
  }

  const next: ForgeBlock = mode === 'number'
    ? { ...shared, id: current.id, type: 'stat', field: fieldKey, look: 'run-in' }
    : {
      ...shared,
      id: current.id,
      type: 'track',
      field: fieldKey,
      look: mode,
      counts: isRecord(field.tracks) && (field.tracks.counts === 'up' || field.tracks.counts === 'down')
        ? field.tracks.counts : (current.counts === 'up' ? 'up' : 'down'),
    };
  found.siblings[found.index] = next;
  return true;
}

export function setStatDisplay(block: ForgeBlock, display: 'plain' | 'signed'): boolean {
  if (block.type !== 'stat') return false;
  const next = display === 'signed' ? 'signed' : undefined;
  if (block.display === next) return false;
  if (next) block.display = next;
  else delete block.display;
  return true;
}

export function setValueBlockFlag(block: ForgeBlock, flag: 'rollable', enabled: boolean): boolean {
  if (block.type !== 'stat' && block.type !== 'pairs') return false;
  if (Boolean(block[flag]) === enabled) return false;
  if (enabled) block[flag] = true;
  else delete block[flag];
  return true;
}

/** Backwards-compatible name for the Number Value block's roll settings. */
export function setStatFlag(block: ForgeBlock, flag: 'rollable', enabled: boolean): boolean {
  if (block.type !== 'stat') return false;
  return setValueBlockFlag(block, flag, enabled);
}

/** Atlas Pairs Value number formatting; the default is plain and is omitted from the file. */
export function setPairsDisplay(block: ForgeBlock, display: 'plain' | 'signed'): boolean {
  if (block.type !== 'pairs') return false;
  const next = display === 'signed' ? 'signed' : undefined;
  if (block.display === next) return false;
  if (next) block.display = next;
  else delete block.display;
  return true;
}
