/**
 * Versioned, Forge-owned model for linking Atlas token assets and individual
 * token instances to Forge statblock notes.
 *
 * This module is deliberately pure: it does not read/write plugin data, access
 * Obsidian APIs, or mutate Atlas state. Persistence is implemented separately
 * in Etapa 2.2.
 */

export const FORGE_TOKEN_LINK_STORE_FORMAT = 'statblock-forge-token-links' as const;
export const FORGE_TOKEN_LINK_STORE_VERSION = 1 as const;

/** A stable reference to a Forge statblock note and its source template. */
export interface ForgeTokenLinkTarget {
  /** Vault-relative path of the Markdown statblock note. */
  readonly statblockPath: string;
  /** Stable ID inside the linked .forgetemplate file. */
  readonly templateId: string;
}

/**
 * Per-instance exception. A null `link` is an explicit opt-out: it suppresses
 * an inherited Asset ID link for this token instance without deleting it.
 */
export interface ForgeTokenInstanceOverride {
  readonly mapPath: string;
  readonly tokenId: string;
  readonly link: ForgeTokenLinkTarget | null;
}

export interface ForgeTokenLinkStore {
  readonly format: typeof FORGE_TOKEN_LINK_STORE_FORMAT;
  readonly version: typeof FORGE_TOKEN_LINK_STORE_VERSION;
  /** Shared links inherited by every token instance created from an asset. */
  readonly assetLinks: Readonly<Record<string, ForgeTokenLinkTarget>>;
  /** Explicit per-map/per-instance exceptions, including explicit unlink. */
  readonly instanceOverrides: Readonly<Record<string, ForgeTokenInstanceOverride>>;
}

export type ForgeTokenLinkStoreParseResult =
  | {
    readonly status: 'empty' | 'ready' | 'recovered';
    readonly data: ForgeTokenLinkStore;
    readonly issues: readonly string[];
  }
  | {
    readonly status: 'invalid' | 'unsupported-version';
    readonly data: null;
    readonly issues: readonly string[];
  };

export type ForgeTokenLinkResolution =
  | {
    readonly status: 'linked';
    readonly source: 'instance' | 'asset';
    readonly link: ForgeTokenLinkTarget;
  }
  | {
    /** An explicit instance override suppresses an otherwise inherited link. */
    readonly status: 'unlinked';
    readonly source: 'instance-override' | 'none';
  };

export interface ForgeTokenLinkIdentity {
  readonly assetId?: string | null;
  readonly mapPath?: string | null;
  readonly tokenId?: string | null;
}

interface UnknownRecord {
  readonly [key: string]: unknown;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeVaultRelativePath(value: unknown): string | null {
  const raw = readString(value);
  if (!raw) return null;
  const path = raw.replace(/\\/g, '/').replace(/\/+/g, '/');
  if (path.startsWith('/')) return null;
  const segments = path.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return null;
  return path;
}

function normalizeMapPath(value: unknown): string | null {
  const raw = readString(value);
  if (!raw) return null;
  // Atlas mapPath is an identity supplied by Atlas. Preserve its case and
  // spelling; only normalize separators so Windows-style paths are stable.
  return raw.replace(/\\/g, '/').replace(/\/+/g, '/');
}

function normalizeOpaqueId(value: unknown): string | null {
  // Asset IDs and token IDs are opaque identifiers. Do not lowercase them.
  return readString(value);
}

function createDictionary<T>(): Record<string, T> {
  // A null prototype prevents special keys (for example, "__proto__") from
  // altering the object prototype when Atlas supplies an opaque ID.
  return Object.create(null) as Record<string, T>;
}

/** Validate and normalize a statblock target. */
export function normalizeForgeTokenLinkTarget(value: unknown): ForgeTokenLinkTarget | null {
  if (!isRecord(value)) return null;
  const statblockPath = normalizeVaultRelativePath(value.statblockPath);
  const templateId = readString(value.templateId);
  if (!statblockPath || !statblockPath.toLowerCase().endsWith('.md') || !templateId) return null;
  return { statblockPath, templateId };
}

/** Construct a new empty store using the current schema version. */
export function createEmptyForgeTokenLinkStore(): ForgeTokenLinkStore {
  return {
    format: FORGE_TOKEN_LINK_STORE_FORMAT,
    version: FORGE_TOKEN_LINK_STORE_VERSION,
    assetLinks: createDictionary<ForgeTokenLinkTarget>(),
    instanceOverrides: createDictionary<ForgeTokenInstanceOverride>(),
  };
}

/**
 * Stable, collision-safe key for an instance override. JSON tuple encoding is
 * intentional: unlike "mapPath::tokenId", it cannot collide when either ID
 * contains the separator characters.
 */
export function createForgeTokenInstanceOverrideKey(
  mapPathValue: unknown,
  tokenIdValue: unknown,
): string | null {
  const mapPath = normalizeMapPath(mapPathValue);
  const tokenId = normalizeOpaqueId(tokenIdValue);
  return mapPath && tokenId ? JSON.stringify([mapPath, tokenId]) : null;
}

/** Parse persisted input without throwing or silently accepting future versions. */
export function parseForgeTokenLinkStore(value: unknown): ForgeTokenLinkStoreParseResult {
  if (value === null || value === undefined) {
    return { status: 'empty', data: createEmptyForgeTokenLinkStore(), issues: [] };
  }
  if (!isRecord(value) || value.format !== FORGE_TOKEN_LINK_STORE_FORMAT) {
    return { status: 'invalid', data: null, issues: ['O formato do armazenamento de vínculos Forge é inválido.'] };
  }
  if (value.version !== FORGE_TOKEN_LINK_STORE_VERSION) {
    return {
      status: 'unsupported-version',
      data: null,
      issues: [`Versão de vínculos Forge não suportada: ${String(value.version)}.`],
    };
  }

  const issues: string[] = [];
  const assetLinks = createDictionary<ForgeTokenLinkTarget>();
  const instanceOverrides = createDictionary<ForgeTokenInstanceOverride>();

  if (!isRecord(value.assetLinks)) {
    issues.push('A coleção assetLinks está ausente ou inválida.');
  } else {
    for (const [rawAssetId, rawTarget] of Object.entries(value.assetLinks)) {
      const assetId = normalizeOpaqueId(rawAssetId);
      const target = normalizeForgeTokenLinkTarget(rawTarget);
      if (!assetId || !target) {
        issues.push(`Vínculo de asset inválido ignorado: ${rawAssetId}.`);
        continue;
      }
      assetLinks[assetId] = target;
    }
  }

  if (!isRecord(value.instanceOverrides)) {
    issues.push('A coleção instanceOverrides está ausente ou inválida.');
  } else {
    for (const [storedKey, rawOverride] of Object.entries(value.instanceOverrides)) {
      if (!isRecord(rawOverride)) {
        issues.push(`Exceção de instância inválida ignorada: ${storedKey}.`);
        continue;
      }
      const mapPath = normalizeMapPath(rawOverride.mapPath);
      const tokenId = normalizeOpaqueId(rawOverride.tokenId);
      const hasLinkProperty = Object.prototype.hasOwnProperty.call(rawOverride, 'link');
      const link = rawOverride.link === null ? null : normalizeForgeTokenLinkTarget(rawOverride.link);
      const key = createForgeTokenInstanceOverrideKey(mapPath, tokenId);
      if (!mapPath || !tokenId || !hasLinkProperty || (rawOverride.link !== null && !link) || !key) {
        issues.push(`Exceção de instância inválida ignorada: ${storedKey}.`);
        continue;
      }
      if (storedKey !== key) issues.push(`Chave de exceção reconstruída para ${mapPath} / ${tokenId}.`);
      instanceOverrides[key] = { mapPath, tokenId, link };
    }
  }

  const data: ForgeTokenLinkStore = {
    format: FORGE_TOKEN_LINK_STORE_FORMAT,
    version: FORGE_TOKEN_LINK_STORE_VERSION,
    assetLinks,
    instanceOverrides,
  };
  return {
    status: issues.length > 0 ? 'recovered' : 'ready',
    data,
    issues,
  };
}

/** Return a new store with the shared Asset ID link added or replaced. */
export function setForgeAssetTokenLink(
  store: ForgeTokenLinkStore,
  assetIdValue: unknown,
  targetValue: unknown,
): ForgeTokenLinkStore {
  const assetId = normalizeOpaqueId(assetIdValue);
  const target = normalizeForgeTokenLinkTarget(targetValue);
  if (!assetId || !target) throw new Error('Asset ID ou destino de statblock inválido.');

  const assetLinks = createDictionary<ForgeTokenLinkTarget>();
  Object.assign(assetLinks, store.assetLinks);
  assetLinks[assetId] = target;
  return { ...store, assetLinks };
}

/** Return a new store with a shared Asset ID link removed. */
export function removeForgeAssetTokenLink(
  store: ForgeTokenLinkStore,
  assetIdValue: unknown,
): ForgeTokenLinkStore {
  const assetId = normalizeOpaqueId(assetIdValue);
  if (!assetId || !Object.prototype.hasOwnProperty.call(store.assetLinks, assetId)) return store;

  const assetLinks = createDictionary<ForgeTokenLinkTarget>();
  Object.assign(assetLinks, store.assetLinks);
  delete assetLinks[assetId];
  return { ...store, assetLinks };
}

/**
 * Return a new store with an instance-specific target or explicit unlink.
 * Passing null deliberately overrides (rather than deletes) an Asset ID link.
 */
export function setForgeTokenInstanceOverride(
  store: ForgeTokenLinkStore,
  mapPathValue: unknown,
  tokenIdValue: unknown,
  targetValue: unknown,
): ForgeTokenLinkStore {
  const mapPath = normalizeMapPath(mapPathValue);
  const tokenId = normalizeOpaqueId(tokenIdValue);
  const key = createForgeTokenInstanceOverrideKey(mapPath, tokenId);
  const target = targetValue === null ? null : normalizeForgeTokenLinkTarget(targetValue);
  if (!mapPath || !tokenId || !key || (targetValue !== null && !target)) {
    throw new Error('Mapa, ID da instância ou destino de statblock inválido.');
  }

  const instanceOverrides = createDictionary<ForgeTokenInstanceOverride>();
  Object.assign(instanceOverrides, store.instanceOverrides);
  instanceOverrides[key] = { mapPath, tokenId, link: target };
  return { ...store, instanceOverrides };
}

/** Remove an instance exception, allowing it to inherit its Asset ID link again. */
export function removeForgeTokenInstanceOverride(
  store: ForgeTokenLinkStore,
  mapPathValue: unknown,
  tokenIdValue: unknown,
): ForgeTokenLinkStore {
  const key = createForgeTokenInstanceOverrideKey(mapPathValue, tokenIdValue);
  if (!key || !Object.prototype.hasOwnProperty.call(store.instanceOverrides, key)) return store;

  const instanceOverrides = createDictionary<ForgeTokenInstanceOverride>();
  Object.assign(instanceOverrides, store.instanceOverrides);
  delete instanceOverrides[key];
  return { ...store, instanceOverrides };
}

/** Resolve instance exception first, then inherited Asset ID link. */
export function resolveForgeTokenLink(
  store: ForgeTokenLinkStore,
  identity: ForgeTokenLinkIdentity,
): ForgeTokenLinkResolution {
  const instanceKey = createForgeTokenInstanceOverrideKey(identity.mapPath, identity.tokenId);
  if (instanceKey) {
    const override = store.instanceOverrides[instanceKey];
    if (override) {
      return override.link
        ? { status: 'linked', source: 'instance', link: override.link }
        : { status: 'unlinked', source: 'instance-override' };
    }
  }

  const assetId = normalizeOpaqueId(identity.assetId);
  const assetLink = assetId ? store.assetLinks[assetId] : undefined;
  return assetLink
    ? { status: 'linked', source: 'asset', link: assetLink }
    : { status: 'unlinked', source: 'none' };
}
