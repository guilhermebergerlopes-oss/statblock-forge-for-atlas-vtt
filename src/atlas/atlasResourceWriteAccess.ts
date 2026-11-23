/**
 * Write-boundary checks for Forge operations that use Atlas' internal stores.
 * Atlas owns player/owner visibility; Forge may update Resource values only in
 * a GM map store, never in the player's view of that map.
 */
export interface AtlasResourceStoreAccessState {
  readonly mapPath?: string | null;
  readonly mapLoaded?: boolean;
  readonly isMapLoading?: boolean;
  readonly isPlayerView?: boolean;
}

function mapPathMatches(state: AtlasResourceStoreAccessState, expectedMapPath: string | null | undefined): boolean {
  if (expectedMapPath === undefined) return true;
  const currentMapPath = typeof state.mapPath === 'string' ? state.mapPath : null;
  return currentMapPath === expectedMapPath;
}

/** Token values belong to a loaded scene. Re-check immediately before updateTokens(). */
export function atlasCanWriteTokenResources(
  state: AtlasResourceStoreAccessState,
  expectedMapPath?: string | null,
): boolean {
  return state.isPlayerView !== true
    && state.mapLoaded === true
    && state.isMapLoading !== true
    && mapPathMatches(state, expectedMapPath);
}

/** PartySync values can live in a GM store while its scene is still loading. */
export function atlasCanWritePartyResources(
  state: AtlasResourceStoreAccessState,
  expectedMapPath?: string | null,
): boolean {
  return state.isPlayerView !== true
    && state.isMapLoading !== true
    && mapPathMatches(state, expectedMapPath);
}
