import type { App, TFile } from 'obsidian';

export type AtlasSystemPresetRules = Record<string, unknown>;

interface VaultFileLike {
  readonly path: string;
}

interface VaultLike {
  getFiles?: () => VaultFileLike[];
  cachedRead?: (file: TFile) => Promise<string>;
}

interface PresetRuleCache {
  readonly rules: Map<string, AtlasSystemPresetRules | null>;
  readonly pending: Map<string, Promise<AtlasSystemPresetRules | null>>;
}

const PRESETS_FOLDER = 'atlas-vtt/system-presets/';
const cacheByApp = new WeakMap<App, PresetRuleCache>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cacheFor(app: App): PresetRuleCache {
  let cache = cacheByApp.get(app);
  if (!cache) {
    cache = { rules: new Map(), pending: new Map() };
    cacheByApp.set(app, cache);
  }
  return cache;
}

/**
 * Loads the rules of a user-made Atlas system preset from its canonical Vault folder.
 * The preset id inside the JSON is authoritative; filenames are deliberately ignored,
 * matching Atlas' SystemPresetService/SystemPresetFiles lookup.
 */
export async function loadAtlasSystemPresetRules(
  app: App,
  presetId: string | null | undefined,
): Promise<AtlasSystemPresetRules | null> {
  if (!presetId || presetId.startsWith('builtin:')) return null;
  const cache = cacheFor(app);
  if (cache.rules.has(presetId)) return cache.rules.get(presetId) ?? null;
  const pending = cache.pending.get(presetId);
  if (pending) return pending;

  const operation = (async (): Promise<AtlasSystemPresetRules | null> => {
    const vault = (app as unknown as { vault?: VaultLike }).vault;
    if (typeof vault?.getFiles !== 'function' || typeof vault.cachedRead !== 'function') return null;
    for (const file of vault.getFiles()) {
      if (!file.path.startsWith(PRESETS_FOLDER) || !file.path.toLowerCase().endsWith('.json')) continue;
      try {
        const parsed: unknown = JSON.parse(await vault.cachedRead(file as TFile));
        if (isRecord(parsed) && parsed.id === presetId && isRecord(parsed.rules)) return parsed.rules;
      } catch {
        // A partially synced or invalid preset is ignored; Atlas likewise exposes only parsed presets.
      }
    }
    return null;
  })();

  cache.pending.set(presetId, operation);
  try {
    const rules = await operation;
    // A file change may have invalidated this read while it was in flight.
    if (cache.pending.get(presetId) === operation) cache.rules.set(presetId, rules);
    return rules;
  } finally {
    if (cache.pending.get(presetId) === operation) cache.pending.delete(presetId);
  }
}

/** Rules already loaded by a live Atlas feature; synchronous consumers can use this snapshot. */
export function cachedAtlasSystemPresetRules(
  app: App,
  presetId: string | null | undefined,
): AtlasSystemPresetRules | null {
  if (!presetId || presetId.startsWith('builtin:')) return null;
  return cacheByApp.get(app)?.rules.get(presetId) ?? null;
}

/** Invalidates preset snapshots after Atlas' user preset files are created, edited, renamed or deleted. */
export function invalidateAtlasSystemPresetRules(app: App): void {
  const cache = cacheByApp.get(app);
  cache?.rules.clear();
  cache?.pending.clear();
}

export function isAtlasSystemPresetPath(path: string): boolean {
  return path.startsWith(PRESETS_FOLDER) && path.toLowerCase().endsWith('.json');
}
