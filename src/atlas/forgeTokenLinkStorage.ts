import {
  parseForgeTokenLinkStore,
  type ForgeTokenLinkStore,
  type ForgeTokenLinkStoreParseResult,
} from './forgeTokenLinkModel';

/** Namespaced property inside Obsidian's plugin-owned data.json payload. */
export const FORGE_TOKEN_LINKS_DATA_KEY = 'forgeTokenLinks' as const;

/**
 * Reads the Forge-owned value from plugin data. Parsing is delegated to the
 * pure model so malformed entries can be reported without throwing and
 * unsupported future versions can be preserved by the caller.
 */
export function readPersistedForgeTokenLinks(value: unknown): ForgeTokenLinkStoreParseResult {
  return parseForgeTokenLinkStore(value);
}

/**
 * Creates a detached JSON-safe snapshot for saveData(). The round-trip also
 * prevents consumers of the plugin API from mutating the live in-memory store
 * through a returned object reference.
 */
export function cloneForgeTokenLinksForPersistence(store: ForgeTokenLinkStore): ForgeTokenLinkStore {
  let detached: unknown;
  try {
    const serialized = JSON.stringify(store);
    if (typeof serialized !== 'string') throw new Error('o valor não gerou JSON');
    detached = JSON.parse(serialized) as unknown;
  } catch (error) {
    throw new Error(
      `Não foi possível serializar os vínculos de tokens do Forge: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const parsed = parseForgeTokenLinkStore(detached);
  if (!parsed.data) {
    throw new Error(`O armazenamento de vínculos do Forge não passou pela validação: ${parsed.issues.join(' ')}`);
  }
  return parsed.data;
}
