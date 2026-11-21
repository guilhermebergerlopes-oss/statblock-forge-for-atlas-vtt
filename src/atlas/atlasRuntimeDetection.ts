import { ATLAS_PLUGIN_ID } from './atlasRuntime.ts';
import { resolveAtlasVersionAdapter, type AtlasAdapterResolution } from './atlasVersionAdapter.ts';

export { ATLAS_PLUGIN_ID } from './atlasRuntime.ts';

/**
 * Kept temporarily while the Ctrl-hover and off-map dice migrations are staged.
 * New direct-runtime integrations must use ATLAS_PLUGIN_ID (`atlas-vtt`) instead.
 */
export const LEGACY_ATLAS_FORK_PLUGIN_ID = 'forked-atlas-vtt-compatibility-for-statblock-forge';

export interface AtlasManifestStorage {
  configDir: string;
  adapter: {
    exists(path: string): Promise<boolean>;
    read(path: string): Promise<string>;
  };
}

export type AtlasManifestDetectionStatus =
  | 'not-found'
  | 'detected'
  | 'invalid-manifest'
  | 'unreadable';

export interface AtlasRuntimeDetection {
  status: AtlasManifestDetectionStatus;
  manifestPath: string;
  pluginId: string | null;
  version: string | null;
  adapter: AtlasAdapterResolution;
  message: string;
}

function normalizeConfigDir(configDir: string): string {
  return configDir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Detects the original Atlas VTT installation through the Vault adapter.
 * This verifies the installed manifest; inspectAtlasRuntime() separately
 * determines whether the plugin instance and per-map services are currently loaded.
 */
export async function detectAtlasInstallation(vault: AtlasManifestStorage): Promise<AtlasRuntimeDetection> {
  const configDir = normalizeConfigDir(vault.configDir);
  const manifestPath = `${configDir ? `${configDir}/` : ''}plugins/${ATLAS_PLUGIN_ID}/manifest.json`;

  try {
    const exists = await vault.adapter.exists(manifestPath);
    if (!exists) {
      return {
        status: 'not-found',
        manifestPath,
        pluginId: null,
        version: null,
        adapter: resolveAtlasVersionAdapter(null),
        message: `Manifesto do Atlas VTT original não encontrado em ${manifestPath}. O Forge continuará funcionando em modo independente.`,
      };
    }

    const contents = await vault.adapter.read(manifestPath);
    let parsed: unknown;
    try {
      parsed = JSON.parse(contents) as unknown;
    } catch {
      return {
        status: 'invalid-manifest',
        manifestPath,
        pluginId: null,
        version: null,
        adapter: resolveAtlasVersionAdapter(null),
        message: 'O manifesto encontrado não contém JSON válido. Nenhum adaptador de runtime foi selecionado.',
      };
    }

    if (!isRecord(parsed) || parsed.id !== ATLAS_PLUGIN_ID || typeof parsed.version !== 'string') {
      return {
        status: 'invalid-manifest',
        manifestPath,
        pluginId: isRecord(parsed) && typeof parsed.id === 'string' ? parsed.id : null,
        version: isRecord(parsed) && typeof parsed.version === 'string' ? parsed.version : null,
        adapter: resolveAtlasVersionAdapter(null),
        message: 'O manifesto encontrado não corresponde ao Atlas VTT original ou não informa uma versão válida. Nenhum adaptador foi ativado.',
      };
    }

    const adapter = resolveAtlasVersionAdapter(parsed.version);
    if (adapter.kind === 'standalone') {
      return {
        status: 'invalid-manifest',
        manifestPath,
        pluginId: ATLAS_PLUGIN_ID,
        version: parsed.version,
        adapter,
        message: 'O Atlas foi localizado, mas sua versão não pôde ser interpretada. Nenhum adaptador de runtime foi selecionado.',
      };
    }

    const isRuntimeVerified = adapter.runtimeMode === 'internal-runtime';
    return {
      status: 'detected',
      manifestPath,
      pluginId: ATLAS_PLUGIN_ID,
      version: parsed.version,
      adapter,
      message: isRuntimeVerified
        ? `Atlas VTT ${parsed.version} encontrado. O perfil interno de runtime foi verificado contra o código-fonte original; os serviços são descobertos dinamicamente por mapa.`
        : `Atlas VTT ${parsed.version} encontrado. A versão não possui um perfil interno verificado; somente a compatibilidade por arquivo será considerada.`,
    };
  } catch (error) {
    return {
      status: 'unreadable',
      manifestPath,
      pluginId: null,
      version: null,
      adapter: resolveAtlasVersionAdapter(null),
      message: `Não foi possível ler o manifesto do Atlas: ${error instanceof Error ? error.message : String(error)}. O Forge continuará funcionando em modo independente.`,
    };
  }
}
