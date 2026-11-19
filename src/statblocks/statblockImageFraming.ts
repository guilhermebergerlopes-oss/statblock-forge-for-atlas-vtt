import { isRecord, type JsonRecord } from '../templates/forgeTemplate.ts';

/** Forge-owned note metadata for per-statblock image framing. */
export const FORGE_STATBLOCK_IMAGE_FRAMES_KEY = 'statblock-forge-image-frames';

export interface StatblockImageFrame {
  /** Percentage zoom, matching the Image-field inspector range. */
  zoom: number;
  /** Normalized focal point; 50/50 is neutral and values pan within the zoomed image. */
  x: number;
  y: number;
}

export type StatblockImageFrames = Record<string, StatblockImageFrame>;

export const DEFAULT_STATBLOCK_IMAGE_FRAME: Readonly<StatblockImageFrame> = Object.freeze({
  zoom: 100,
  x: 50,
  y: 50,
});

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function normalizeStatblockImageFrame(value: unknown): StatblockImageFrame {
  const record = isRecord(value) ? value : {};
  return {
    zoom: Math.round(boundedNumber(record.zoom, DEFAULT_STATBLOCK_IMAGE_FRAME.zoom, 100, 300)),
    x: Math.round(boundedNumber(record.x, DEFAULT_STATBLOCK_IMAGE_FRAME.x, 0, 100)),
    y: Math.round(boundedNumber(record.y, DEFAULT_STATBLOCK_IMAGE_FRAME.y, 0, 100)),
  };
}

export function readStatblockImageFrames(source: unknown): StatblockImageFrames {
  if (!isRecord(source) || !isRecord(source[FORGE_STATBLOCK_IMAGE_FRAMES_KEY])) return {};
  const result: StatblockImageFrames = {};
  for (const [blockId, rawFrame] of Object.entries(source[FORGE_STATBLOCK_IMAGE_FRAMES_KEY] as JsonRecord)) {
    if (!blockId.trim() || blockId.length > 160 || !isRecord(rawFrame)) continue;
    result[blockId] = normalizeStatblockImageFrame(rawFrame);
  }
  return result;
}

export function withStatblockImageFrame(
  current: unknown,
  blockId: string,
  frame: unknown,
): StatblockImageFrames {
  const frames = readStatblockImageFrames({ [FORGE_STATBLOCK_IMAGE_FRAMES_KEY]: current });
  if (!blockId.trim() || blockId.length > 160) return frames;
  frames[blockId] = normalizeStatblockImageFrame(frame);
  return frames;
}


/** Converts a normalized focal point into a bounded CSS translation. */
export function statblockImagePanTranslation(value: unknown): { x: number; y: number } {
  const frame = normalizeStatblockImageFrame(value);
  const panLimit = Math.max(0, (frame.zoom - 100) / 2);
  return {
    x: ((50 - frame.x) / 50) * panLimit,
    y: ((50 - frame.y) / 50) * panLimit,
  };
}

/** Applies a drag delta in viewport pixels, keeping the image within its zoomed overflow. */
export function panStatblockImageFrame(
  value: unknown,
  deltaX: number,
  deltaY: number,
  width: number,
  height: number,
): StatblockImageFrame {
  const frame = normalizeStatblockImageFrame(value);
  if (frame.zoom <= 100 || ![deltaX, deltaY, width, height].every(Number.isFinite)) return frame;
  const zoomRange = Math.max(1, frame.zoom - 100);
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  return normalizeStatblockImageFrame({
    ...frame,
    x: frame.x - (deltaX / safeWidth) * (100 / zoomRange) * 100,
    y: frame.y - (deltaY / safeHeight) * (100 / zoomRange) * 100,
  });
}
