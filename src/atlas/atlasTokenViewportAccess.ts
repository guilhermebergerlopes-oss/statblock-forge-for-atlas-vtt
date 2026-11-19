import type { AtlasTokenAdapterContext } from './atlasTokenAdapter';

/** Screen-space position, normally copied from a Pixi FederatedPointerEvent.global. */
export interface AtlasScreenPoint {
  readonly x: number;
  readonly y: number;
}

/** World-space position returned by the Atlas Pixi viewport. */
export interface AtlasWorldPoint {
  readonly x: number;
  readonly y: number;
}

export type AtlasTokenViewportAccessStatus =
  | 'ready'
  | 'viewport-unavailable'
  | 'renderer-unavailable'
  | 'token-renderer-unavailable';

/**
 * Structural, read-only handles to the Atlas viewport and token renderer.
 * Runtime types are intentionally structural so Forge does not import Atlas or Pixi internals.
 */
export interface AtlasTokenViewportAccess {
  readonly status: AtlasTokenViewportAccessStatus;
  readonly viewport: unknown;
  readonly tokenRenderer: unknown;
  readonly viewportAvailable: boolean;
  readonly tokenRendererAvailable: boolean;
}

export type AtlasTokenHitTestStatus =
  | 'hit'
  | 'no-hit'
  | 'access-unavailable'
  | 'invalid-screen-point'
  | 'coordinate-transform-failed'
  | 'hit-test-failed';

export interface AtlasTokenHitTestResult {
  readonly status: AtlasTokenHitTestStatus;
  /** Atlas token instance ID. This is not the assetId. */
  readonly tokenId: string | null;
  readonly worldPoint: AtlasWorldPoint | null;
}

interface UnknownRecord {
  readonly [key: string]: unknown;
}

function isObject(value: unknown): value is UnknownRecord {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

function readMember(target: unknown, key: string): unknown {
  if (!isObject(target)) return undefined;
  try {
    return target[key];
  } catch {
    return undefined;
  }
}

function callMember(target: unknown, method: string, ...args: unknown[]): unknown {
  const candidate = readMember(target, method);
  if (typeof candidate !== 'function') return undefined;
  try {
    return (candidate as (...values: unknown[]) => unknown).apply(target, args);
  } catch {
    return undefined;
  }
}

function isFinitePoint(value: unknown): value is AtlasWorldPoint {
  if (!isObject(value)) return false;
  const x = readMember(value, 'x');
  const y = readMember(value, 'y');
  return typeof x === 'number' && Number.isFinite(x)
    && typeof y === 'number' && Number.isFinite(y);
}

/**
 * Obtains the initialized Atlas Pixi viewport and TokenRenderer from a context
 * discovered by atlasTokenAdapter.ts. No listeners are registered and no Atlas
 * methods that mutate state are called.
 */
export function getAtlasTokenViewportAccess(
  context: Pick<AtlasTokenAdapterContext, 'rendererService' | 'renderer' | 'rendererInitialized'>,
): AtlasTokenViewportAccess {
  if (!context.rendererInitialized || context.renderer === null) {
    return {
      status: 'renderer-unavailable',
      viewport: null,
      tokenRenderer: null,
      viewportAvailable: false,
      tokenRendererAvailable: false,
    };
  }

  const viewport = callMember(context.rendererService, 'getViewport') ?? null;
  if (viewport === null || typeof readMember(viewport, 'toWorld') !== 'function') {
    return {
      status: 'viewport-unavailable',
      viewport: null,
      tokenRenderer: null,
      viewportAvailable: false,
      tokenRendererAvailable: false,
    };
  }

  const tokenRenderer = callMember(context.renderer, 'getTokenRenderer') ?? null;
  if (tokenRenderer === null || typeof readMember(tokenRenderer, 'hitTestTokens') !== 'function') {
    return {
      status: 'token-renderer-unavailable',
      viewport,
      tokenRenderer: null,
      viewportAvailable: true,
      tokenRendererAvailable: false,
    };
  }

  return {
    status: 'ready',
    viewport,
    tokenRenderer,
    viewportAvailable: true,
    tokenRendererAvailable: true,
  };
}

/**
 * Converts a Pixi screen/global point to Atlas world coordinates and asks the
 * Atlas TokenRenderer which token is topmost at that point.
 *
 * Atlas 0.14.0's Viewport accepts a point object in toWorld(), and
 * TokenRenderer.hitTestTokens() accepts worldX/worldY and returns string|null.
 * These private/internal runtime contracts must be revalidated for Atlas 0.15.0.
 */
export function hitTestAtlasToken(
  access: AtlasTokenViewportAccess,
  screenPoint: AtlasScreenPoint,
): AtlasTokenHitTestResult {
  if (access.status !== 'ready' || access.viewport === null || access.tokenRenderer === null) {
    return { status: 'access-unavailable', tokenId: null, worldPoint: null };
  }

  if (!Number.isFinite(screenPoint.x) || !Number.isFinite(screenPoint.y)) {
    return { status: 'invalid-screen-point', tokenId: null, worldPoint: null };
  }

  const rawWorldPoint = callMember(access.viewport, 'toWorld', {
    x: screenPoint.x,
    y: screenPoint.y,
  });
  if (!isFinitePoint(rawWorldPoint)) {
    return { status: 'coordinate-transform-failed', tokenId: null, worldPoint: null };
  }

  const hitTest = readMember(access.tokenRenderer, 'hitTestTokens');
  if (typeof hitTest !== 'function') {
    return { status: 'hit-test-failed', tokenId: null, worldPoint: rawWorldPoint };
  }

  let rawTokenId: unknown;
  try {
    rawTokenId = (hitTest as (worldX: number, worldY: number) => unknown).call(
      access.tokenRenderer,
      rawWorldPoint.x,
      rawWorldPoint.y,
    );
  } catch {
    return { status: 'hit-test-failed', tokenId: null, worldPoint: rawWorldPoint };
  }

  if (rawTokenId === null) {
    return { status: 'no-hit', tokenId: null, worldPoint: rawWorldPoint };
  }
  if (typeof rawTokenId !== 'string' || rawTokenId.trim() === '') {
    return { status: 'hit-test-failed', tokenId: null, worldPoint: rawWorldPoint };
  }

  return { status: 'hit', tokenId: rawTokenId, worldPoint: rawWorldPoint };
}
