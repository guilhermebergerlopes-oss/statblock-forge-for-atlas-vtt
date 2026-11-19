import { isRecord, type ForgeBlock, type ForgeField, type ForgeTemplate } from './forgeTemplate.ts';

export type NumericTrackingDirection = 'down' | 'up';
export type NumericTrackingMode = 'off' | NumericTrackingDirection;
export type NumericFieldTracks = Record<string, unknown> & { counts: NumericTrackingDirection; max?: string };

function validDirection(value: unknown): value is NumericTrackingDirection {
  return value === 'down' || value === 'up';
}

/** Finds an unbound Track tile for a Number Field, matching Atlas trackedNumbers(). */
export function trackBlockForNumericField(
  template: ForgeTemplate,
  fieldKey: string,
  exceptBlockId?: string,
): ForgeBlock | null {
  const visit = (blocks: ForgeBlock[]): ForgeBlock | null => {
    for (const block of blocks) {
      if (block.type === 'track' && block.id !== exceptBlockId && block.field === fieldKey && block.resource === undefined) {
        return block;
      }
      if (Array.isArray(block.blocks)) {
        const found = visit(block.blocks.filter(isRecord) as ForgeBlock[]);
        if (found) return found;
      }
    }
    return null;
  };
  return visit(template.layout.blocks);
}

export function numericFieldTracks(field: ForgeField, trackBlock?: ForgeBlock | null): NumericFieldTracks | null {
  const storedTracks = isRecord(field.tracks) ? field.tracks : null;
  if (storedTracks && validDirection(storedTracks.counts)) {
    return storedTracks as NumericFieldTracks;
  }
  // Older Atlas templates may omit `counts` on a Track block. Atlas treats
  // that as the default down-counting mode; keep its Maximum selector
  // available instead of presenting a tracking mode with no max control.
  if (trackBlock?.type === 'track' && trackBlock.resource === undefined) {
    return {
      ...(storedTracks ?? {}),
      counts: validDirection(trackBlock.counts) ? trackBlock.counts : 'down',
    } as NumericFieldTracks;
  }
  return null;
}

/**
 * Sets Atlas' per-Number tracking direction. Turning a Track's setting changes
 * both the Field's definition and that Track tile; a Track cannot be switched off
 * without first changing its display back to Number.
 */
export function setNumericFieldTracking(
  template: ForgeTemplate,
  fieldKey: string,
  mode: NumericTrackingMode,
  trackBlockId?: string,
): boolean {
  const field = template.fields.find((item) => item.key === fieldKey && item.type === 'number');
  if (!field) return false;
  const currentTrack = trackBlockId ? findBlock(template.layout.blocks, trackBlockId) : null;
  if (trackBlockId && (!currentTrack || currentTrack.type !== 'track' || currentTrack.field !== fieldKey || currentTrack.resource !== undefined)) return false;
  // A Number shown as a Track cannot be switched off from the Track tile;
  // users must first change its display back to Number. An independent Track
  // elsewhere is only a fallback, as in Atlas, and does not lock the setting.
  if (currentTrack && mode === 'off') return false;

  const previous = isRecord(field.tracks) ? field.tracks : {};
  const next = mode === 'off' ? undefined : { ...previous, counts: mode };
  const fieldChanged = mode === 'off'
    ? field.tracks !== undefined
    : !isRecord(field.tracks) || field.tracks.counts !== mode;
  const trackChanged = Boolean(currentTrack && currentTrack.counts !== mode);
  if (!fieldChanged && !trackChanged) return false;

  if (next) field.tracks = next;
  else delete field.tracks;
  if (currentTrack && mode !== 'off') currentTrack.counts = mode;
  return true;
}

/** Sets the maximum source for an already tracked Number Field. Empty means its own value. */
export function setNumericFieldMaximum(
  template: ForgeTemplate,
  fieldKey: string,
  maxFieldKey: string | null,
  trackBlockId?: string,
): boolean {
  const field = template.fields.find((item) => item.key === fieldKey && item.type === 'number');
  if (!field) return false;
  const currentTrack = trackBlockId ? findBlock(template.layout.blocks, trackBlockId) : null;
  if (trackBlockId && (!currentTrack || currentTrack.type !== 'track' || currentTrack.field !== fieldKey || currentTrack.resource !== undefined)) return false;
  const storedTracks = isRecord(field.tracks) ? field.tracks : null;
  const previousTracks = storedTracks && validDirection(storedTracks.counts)
    ? storedTracks
    : currentTrack
      ? {
        ...(storedTracks ?? {}),
        counts: validDirection(currentTrack.counts) ? currentTrack.counts : 'down',
      }
      : null;
  if (!previousTracks) return false;
  const normalized = maxFieldKey?.trim() ?? '';
  if (normalized) {
    const maxField = template.fields.find((item) => item.key === normalized);
    if (!maxField || maxField.type !== 'number' || normalized === fieldKey) return false;
  }
  const previous = previousTracks.max;
  if ((typeof previous === 'string' ? previous : '') === normalized) return false;
  const next = { ...previousTracks };
  if (normalized) next.max = normalized;
  else delete next.max;
  field.tracks = next;
  return true;
}

function findBlock(blocks: ForgeBlock[], blockId: string): ForgeBlock | null {
  for (const block of blocks) {
    if (block.id === blockId) return block;
    if (Array.isArray(block.blocks)) {
      const found = findBlock(block.blocks.filter(isRecord) as ForgeBlock[], blockId);
      if (found) return found;
    }
  }
  return null;
}
