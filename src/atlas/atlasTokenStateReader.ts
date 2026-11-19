import type { AtlasTokenAdapterContext } from './atlasTokenAdapter';

export type AtlasTokenKind = 'token' | 'character';

/** A read-only, minimal projection of an Atlas token needed by the Forge integration. */
export interface AtlasTokenSummary {
  readonly id: string;
  readonly kind: AtlasTokenKind;
  readonly assetId: string | null;
  readonly imagePath: string | null;
  readonly name: string | null;
  /** Atlas-native statblock link, retained so later UI can detect a possible preview conflict. */
  readonly statblockPath: string | null;
}

export type AtlasTokenStateStatus =
  | 'ready'
  | 'store-unavailable'
  | 'state-unavailable'
  | 'tokens-unavailable'
  | 'partial';

/** A detached snapshot: arrays and token summaries are newly allocated and safe to retain. */
export interface AtlasTokenStateSnapshot {
  readonly status: AtlasTokenStateStatus;
  readonly mapPath: string | null;
  readonly mapPathAvailable: boolean;
  readonly activeTool: string | null;
  readonly activeToolAvailable: boolean;
  /** All selected map-object IDs, including non-token objects. */
  readonly selectedIds: readonly string[];
  readonly selectedIdsAvailable: boolean;
  /** Selected IDs narrowed to tokens that exist in objects.tokens. */
  readonly selectedTokenIds: readonly string[];
  readonly tokens: readonly AtlasTokenSummary[];
  readonly selectedTokens: readonly AtlasTokenSummary[];
  readonly tokensAvailable: boolean;
  readonly invalidTokenCount: number;
}

interface UnknownRecord {
  readonly [key: string]: unknown;
}

function isRecord(value: unknown): value is UnknownRecord {
  // Atlas's Zustand store itself is callable; its getState method lives on the function.
  return (typeof value === 'object' || typeof value === 'function')
    && value !== null
    && !Array.isArray(value);
}

function readMember(value: unknown, key: string): unknown {
  if (!isRecord(value)) return undefined;
  try {
    return value[key];
  } catch {
    return undefined;
  }
}

function callGetState(store: unknown): unknown {
  const getState = readMember(store, 'getState');
  if (typeof getState !== 'function') return undefined;
  try {
    return (getState as () => unknown).call(store);
  } catch {
    return undefined;
  }
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function readToken(id: string, value: unknown): AtlasTokenSummary | null {
  if (!isRecord(value)) return null;

  const kind = readMember(value, 'kind');
  if (kind !== 'token' && kind !== 'character') return null;

  return {
    // The collection key is the ID used by Atlas selection and renderer APIs.
    id,
    kind,
    assetId: nullableString(readMember(value, 'assetId')),
    imagePath: nullableString(readMember(value, 'imagePath')),
    name: nullableString(readMember(value, 'name'))
      ?? nullableString(readMember(value, 'statblockName')),
    statblockPath: nullableString(readMember(value, 'statblockPath')),
  };
}

function emptySnapshot(status: AtlasTokenStateStatus): AtlasTokenStateSnapshot {
  return {
    status,
    mapPath: null,
    mapPathAvailable: false,
    activeTool: null,
    activeToolAvailable: false,
    selectedIds: [],
    selectedIdsAvailable: false,
    selectedTokenIds: [],
    tokens: [],
    selectedTokens: [],
    tokensAvailable: false,
    invalidTokenCount: 0,
  };
}

/**
 * Reads token-related data from an Atlas Zustand store without calling any Atlas write action.
 * Missing or throwing runtime members produce an explicit status instead of an exception.
 */
export function readAtlasTokenState(atlasStore: unknown): AtlasTokenStateSnapshot {
  if (typeof readMember(atlasStore, 'getState') !== 'function') {
    return emptySnapshot('store-unavailable');
  }

  const state = callGetState(atlasStore);
  if (!isRecord(state)) return emptySnapshot('state-unavailable');

  const rawMapPath = readMember(state, 'mapPath');
  const mapPathAvailable = typeof rawMapPath === 'string' || rawMapPath === null;
  const mapPath = nullableString(rawMapPath);

  const rawActiveTool = readMember(state, 'activeTool');
  const activeToolAvailable = typeof rawActiveTool === 'string';
  const activeTool = activeToolAvailable ? rawActiveTool as string : null;

  const rawSelectedIds = readMember(state, 'selectedIds');
  const selectedIdsAvailable = Array.isArray(rawSelectedIds)
    && rawSelectedIds.every((id) => typeof id === 'string');
  const selectedIds = selectedIdsAvailable
    ? [...rawSelectedIds as string[]]
    : [];

  const objects = readMember(state, 'objects');
  const rawTokens = readMember(objects, 'tokens');
  const tokensAvailable = isRecord(rawTokens);
  const tokens: AtlasTokenSummary[] = [];
  let invalidTokenCount = 0;
  const tokensById = new Map<string, AtlasTokenSummary>();

  if (tokensAvailable) {
    for (const [id, rawToken] of Object.entries(rawTokens)) {
      const token = readToken(id, rawToken);
      if (token === null) {
        invalidTokenCount += 1;
        continue;
      }
      tokens.push(token);
      tokensById.set(id, token);
    }
  }

  const selectedTokenIds = selectedIds.filter((id) => tokensById.has(id));
  const selectedTokens = selectedTokenIds
    .map((id) => tokensById.get(id))
    .filter((token): token is AtlasTokenSummary => token !== undefined);

  const requiredFieldsAvailable = mapPathAvailable
    && activeToolAvailable
    && selectedIdsAvailable
    && tokensAvailable;

  return {
    status: !tokensAvailable
      ? 'tokens-unavailable'
      : requiredFieldsAvailable
        ? 'ready'
        : 'partial',
    mapPath,
    mapPathAvailable,
    activeTool,
    activeToolAvailable,
    selectedIds,
    selectedIdsAvailable,
    selectedTokenIds,
    tokens,
    selectedTokens,
    tokensAvailable,
    invalidTokenCount,
  };
}

/** Convenience wrapper for callers that already discovered an Atlas view in Etapa 1.1. */
export function readAtlasTokenStateFromContext(
  context: Pick<AtlasTokenAdapterContext, 'atlasStore'>,
): AtlasTokenStateSnapshot {
  return readAtlasTokenState(context.atlasStore);
}

/** Returns the selected token from a snapshot, or null when selection contains no token. */
export function getSelectedAtlasToken(
  snapshot: AtlasTokenStateSnapshot,
): AtlasTokenSummary | null {
  return snapshot.selectedTokens[0] ?? null;
}
