import type { App } from 'obsidian';
import {
  getAtlasTokenAdapterContexts,
  type AtlasTokenAdapterDiagnostic,
} from './atlasTokenAdapter';
import {
  readAtlasTokenStateFromContext,
  type AtlasTokenStateStatus,
} from './atlasTokenStateReader';
import {
  getAtlasTokenViewportAccess,
  hitTestAtlasToken,
  type AtlasScreenPoint,
  type AtlasTokenHitTestStatus,
  type AtlasTokenViewportAccessStatus,
} from './atlasTokenViewportAccess';

export type AtlasTokenMapDiagnosticStatus = 'ready' | 'partial';

export interface AtlasTokenMapIntegrationDiagnostic {
  /** Stable within this diagnostic result; not an Atlas map or token identifier. */
  readonly mapIndex: number;
  readonly mapPath: string | null;
  readonly activeTool: string | null;
  readonly adapter: AtlasTokenAdapterDiagnostic;
  readonly stateStatus: AtlasTokenStateStatus;
  readonly tokenCount: number;
  readonly selectedObjectCount: number;
  readonly selectedTokenCount: number;
  readonly viewportStatus: AtlasTokenViewportAccessStatus;
  readonly viewportAvailable: boolean;
  readonly tokenRendererAvailable: boolean;
  readonly hitTestStatus: AtlasTokenHitTestStatus | 'not-tested';
  /** Instance ID returned by the Atlas renderer, only when a test point hits a token. */
  readonly hitTokenId: string | null;
  readonly status: AtlasTokenMapDiagnosticStatus;
}

export type AtlasTokenIntegrationDiagnosticsStatus = 'ready' | 'partial' | 'atlas-not-open';

export interface AtlasTokenIntegrationDiagnostics {
  readonly status: AtlasTokenIntegrationDiagnosticsStatus;
  readonly mapCount: number;
  readonly hitTestRequested: boolean;
  readonly maps: readonly AtlasTokenMapIntegrationDiagnostic[];
}

function isHitTestHealthy(status: AtlasTokenHitTestStatus | 'not-tested'): boolean {
  // no-hit means the hit test ran successfully and found no token at the point.
  return status === 'not-tested' || status === 'hit' || status === 'no-hit';
}

/**
 * Builds a detached, read-only diagnostic report for all currently open Atlas maps.
 *
 * When `screenPoint` is supplied, the report also exercises `toWorld()` and
 * `hitTestTokens()` for that point. Without a point, it checks that both APIs
 * are present but does not invoke the hit test. This function never registers
 * listeners and never calls Atlas write actions.
 */
export function getAtlasTokenIntegrationDiagnostics(
  app: App,
  screenPoint?: AtlasScreenPoint,
): AtlasTokenIntegrationDiagnostics {
  const contexts = getAtlasTokenAdapterContexts(app);
  if (contexts.length === 0) {
    return {
      status: 'atlas-not-open',
      mapCount: 0,
      hitTestRequested: screenPoint !== undefined,
      maps: [],
    };
  }

  const maps = contexts.map((context, mapIndex): AtlasTokenMapIntegrationDiagnostic => {
    const state = readAtlasTokenStateFromContext(context);
    const viewport = getAtlasTokenViewportAccess(context);
    const hitTest = screenPoint === undefined
      ? null
      : hitTestAtlasToken(viewport, screenPoint);

    const hitTestStatus = hitTest?.status ?? 'not-tested';
    const isReady = context.status === 'ready'
      && state.status === 'ready'
      && viewport.status === 'ready'
      && isHitTestHealthy(hitTestStatus);

    return {
      mapIndex,
      mapPath: state.mapPath,
      activeTool: state.activeTool,
      adapter: context.diagnostic,
      stateStatus: state.status,
      tokenCount: state.tokens.length,
      selectedObjectCount: state.selectedIds.length,
      selectedTokenCount: state.selectedTokenIds.length,
      viewportStatus: viewport.status,
      viewportAvailable: viewport.viewportAvailable,
      tokenRendererAvailable: viewport.tokenRendererAvailable,
      hitTestStatus,
      hitTokenId: hitTest?.status === 'hit' ? hitTest.tokenId : null,
      status: isReady ? 'ready' : 'partial',
    };
  });

  return {
    status: maps.every((map) => map.status === 'ready') ? 'ready' : 'partial',
    mapCount: maps.length,
    hitTestRequested: screenPoint !== undefined,
    maps,
  };
}
