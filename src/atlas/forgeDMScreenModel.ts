/** Minimal token data read from an Atlas map for the Forge DM Screen feed. */
export interface ForgeDMScreenToken {
  readonly id: string;
  readonly name: string;
  readonly imagePath: string;
  readonly assetId: string | null;
}

export interface ForgeDMScreenStatblockGroup {
  readonly path: string;
  readonly tokens: readonly ForgeDMScreenToken[];
}

export interface ForgeDMScreenTokenAssetLike {
  readonly id?: string;
  readonly imagePath?: string;
  readonly name?: string;
  /** Shared Asset-level link written by Atlas' TokenStatblockLinkService. */
  readonly statblockPath?: string;
}

interface UnknownRecord {
  readonly [key: string]: unknown;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Atlas exposes its Zustand store as a callable function with `getState` and
 * `subscribe` attached. Read the current state without assuming the store is a
 * plain object; rejecting function stores makes the Forge feed appear empty.
 */
export function readForgeDMScreenStoreState(store: unknown): Record<string, unknown> | null {
  if ((typeof store !== 'object' && typeof store !== 'function') || store === null || Array.isArray(store)) return null;
  let getter: unknown;
  try { getter = (store as { getState?: unknown }).getState; } catch { return null; }
  if (typeof getter !== 'function') return null;
  try {
    const state: unknown = (getter as (this: unknown) => unknown).call(store);
    return isRecord(state) ? state : null;
  } catch {
    return null;
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Includes linked Atlas Characters and generic Tokens in the Forge feed,
 * while keeping only Forge-native v2 notes. The native Atlas feed itself is
 * The native Atlas feed is Character-only; the Forge section also exposes linked generic Token assets.
 * The predicate is supplied by the caller to keep this model runtime-agnostic.
 */
export function groupForgeDMScreenTokens(
  rawTokens: unknown,
  canRenderPath: (path: string) => boolean,
  assets: readonly ForgeDMScreenTokenAssetLike[] = [],
): ForgeDMScreenStatblockGroup[] {
  if (!isRecord(rawTokens)) return [];
  const groups = new Map<string, ForgeDMScreenToken[]>();

  for (const [id, raw] of Object.entries(rawTokens)) {
    if (!isRecord(raw) || (raw.kind !== 'character' && raw.kind !== 'token')) continue;
    const assetId = text(raw.assetId);
    const imagePath = text(raw.imagePath) ?? '';
    // Atlas stores a shared link on the TokenAsset and may leave a placed map
    // Token without its own statblockPath. A placed-instance link wins; when
    // absent, resolve the inherited Asset link exactly as Atlas does.
    const asset = assets.find((candidate) => assetId && candidate.id === assetId)
      ?? assets.find((candidate) => imagePath && candidate.imagePath === imagePath);
    const rawPath = text(raw.statblockPath) ?? text(asset?.statblockPath);
    if (!rawPath) continue;
    const path = rawPath.split('#', 1)[0]?.trim() ?? '';
    if (!path || !canRenderPath(path)) continue;
    const tokens = groups.get(path) ?? [];
    tokens.push({
      id,
      name: text(raw.name) ?? text(raw.statblockName) ?? text(asset?.name) ?? id,
      imagePath,
      assetId,
    });
    groups.set(path, tokens);
  }

  return [...groups].map(([path, tokens]) => ({ path, tokens }));
}



export interface ForgeDMScreenFeedCandidate {
  readonly heading: string;
  readonly imagePaths: readonly string[];
}

function normalizeFeedLabel(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function comparableImagePath(value: string): string {
  let decoded = value.trim();
  try { decoded = decodeURIComponent(decoded); } catch { /* Keep a malformed URL as literal text. */ }
  decoded = decoded.split(/[?#]/, 1)[0] ?? decoded;
  decoded = decoded.replace(/\\/g, '/').toLocaleLowerCase();
  // Obsidian resource URLs can prepend app://, vault names and resource prefixes.
  return decoded.slice(decoded.lastIndexOf('/') + 1);
}

function feedCandidateSharesImage(candidate: ForgeDMScreenFeedCandidate, images: readonly string[]): boolean {
  const candidateImages = candidate.imagePaths.map(comparableImagePath).filter(Boolean);
  return images.some((image) => {
    const key = comparableImagePath(image);
    return key !== '' && candidateImages.includes(key);
  });
}

/**
 * Match a Forge-linked note to an Atlas DM Screen feed card without relying on
 * React keys or rendered order. Atlas exposes the statblock heading and token
 * portrait in the DOM, but does not expose the note path as a data attribute.
 *
 * Names are the primary identity. If duplicate names exist, the linked token
 * portrait disambiguates them. Returning null is deliberate when the match is
 * ambiguous: in that case Forge keeps its own card instead of hiding the wrong
 * Atlas statblock.
 */
export function matchForgeDMScreenFeedCandidate(
  names: readonly string[],
  images: readonly string[],
  candidates: readonly ForgeDMScreenFeedCandidate[],
): number | null {
  const normalizedNames = new Set(names.map(normalizeFeedLabel).filter(Boolean));
  const nameMatches = candidates.flatMap((candidate, index) =>
    normalizedNames.has(normalizeFeedLabel(candidate.heading)) ? [index] : []);
  if (nameMatches.length === 1) return nameMatches[0] ?? null;

  const imageMatches = candidates.flatMap((candidate, index) =>
    feedCandidateSharesImage(candidate, images) ? [index] : []);
  if (nameMatches.length > 1) {
    const disambiguated = nameMatches.filter((index) => imageMatches.includes(index));
    return disambiguated.length === 1 ? disambiguated[0] ?? null : null;
  }
  return imageMatches.length === 1 ? imageMatches[0] ?? null : null;
}

export type ForgeDMScreenScope = 'fight' | 'players' | 'all';

/**
 * Resolve the optional Atlas scope switch from its accessible checked radio.
 * Unknown/localized labels fail open to `all`: Forge cards must not disappear
 * merely because Atlas changes copy or accessibility text in a future release.
 */
export function readForgeDMScreenScope(scopeRoot: ParentNode | null): ForgeDMScreenScope {
  const checked = scopeRoot?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]');
  const label = checked?.textContent?.trim().toLocaleLowerCase() ?? '';
  if (/\b(fight|combat|luta|combate)\b/.test(label)) return 'fight';
  if (/\b(players?|player characters?|personagens?|jogadores?)\b/.test(label)) return 'players';
  return 'all';
}

/** Filter/order feed groups consistently with the selected DM Screen scope. */
export function filterForgeDMScreenGroups(
  groups: readonly ForgeDMScreenStatblockGroup[],
  scope: ForgeDMScreenScope,
  initiativeEntries: unknown,
  isPlayerToken: (token: ForgeDMScreenToken) => boolean,
): ForgeDMScreenStatblockGroup[] {
  if (scope === 'players') {
    return groups.flatMap((group) => {
      const tokens = group.tokens.filter(isPlayerToken);
      return tokens.length ? [{ ...group, tokens }] : [];
    });
  }
  if (scope !== 'fight' || !Array.isArray(initiativeEntries)) return [...groups];

  const orderedIds = initiativeEntries
    .filter(isRecord)
    .map((entry) => ({ tokenId: text(entry.tokenId), order: typeof entry.order === 'number' ? entry.order : Number.MAX_SAFE_INTEGER }))
    .filter((entry): entry is { tokenId: string; order: number } => entry.tokenId !== null)
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.tokenId);
  const rank = new Map(orderedIds.map((id, index) => [id, index]));
  return groups.flatMap((group) => {
    const tokens = group.tokens
      .filter((token) => rank.has(token.id))
      .sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER));
    return tokens.length ? [{ ...group, tokens }] : [];
  }).sort((a, b) => {
    const aRank = Math.min(...a.tokens.map((token) => rank.get(token.id) ?? Number.MAX_SAFE_INTEGER));
    const bRank = Math.min(...b.tokens.map((token) => rank.get(token.id) ?? Number.MAX_SAFE_INTEGER));
    return aRank - bRank;
  });
}
