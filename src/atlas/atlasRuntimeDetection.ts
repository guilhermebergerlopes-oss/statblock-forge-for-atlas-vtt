import { resolveAtlasVersionAdapter, type AtlasAdapterResolution } from './atlasVersionAdapter.ts';

export const ATLAS_PLUGIN_ID = 'forked-atlas-vtt-compatibility-for-statblock-forge';

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
 * Detects the Atlas installation by reading only its public Obsidian plugin
 * manifest through Vault.configDir and Vault.adapter. This does not prove the
 * plugin is enabled or currently running.
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
        message: `Manifesto do Atlas não encontrado em ${manifestPath}. Isso não impede importar e exportar templates por arquivo.`,
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
        message: 'O manifesto encontrado não contém JSON válido. O Forge permanecerá em modo independente.',
      };
    }

    if (!isRecord(parsed) || parsed.id !== ATLAS_PLUGIN_ID || typeof parsed.version !== 'string') {
      return {
        status: 'invalid-manifest',
        manifestPath,
        pluginId: isRecord(parsed) && typeof parsed.id === 'string' ? parsed.id : null,
        version: isRecord(parsed) && typeof parsed.version === 'string' ? parsed.version : null,
        adapter: resolveAtlasVersionAdapter(null),
        message: 'O manifesto encontrado não corresponde ao plugin Atlas VTT ou não informa uma versão válida. Nenhum adaptador foi ativado.',
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
        message: 'O Atlas foi localizado, mas sua versão não pôde ser interpretada. O Forge permanecerá em modo independente.',
      };
    }

    const isVerified = adapter.kind === 'verified-version';
    return {
      status: 'detected',
      manifestPath,
      pluginId: ATLAS_PLUGIN_ID,
      version: parsed.version,
      adapter,
      message: isVerified
        ? `Manifesto do Atlas ${parsed.version} encontrado. O formato de arquivos corresponde ao snapshot de código inspecionado; APIs de runtime permanecem desativadas.`
        : `Manifesto do Atlas ${parsed.version} encontrado. Será usada somente compatibilidade genérica por arquivo, sem hooks de runtime.`,
    };
  } catch (error) {
    return {
      status: 'unreadable',
      manifestPath,
      pluginId: null,
      version: null,
      adapter: resolveAtlasVersionAdapter(null),
      message: `Não foi possível ler o manifesto do Atlas: ${error instanceof Error ? error.message : String(error)}. O Forge permanecerá em modo independente.`,
    };
  }
}
