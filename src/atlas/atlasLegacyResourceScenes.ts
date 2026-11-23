import type { App, TFile } from 'obsidian';
import { atlasSceneFileShowsLegacySecondaryResource } from './atlasResourceCatalog.ts';

interface AtlasSceneFileLike extends TFile {
  readonly path: string;
  readonly extension: string;
}

interface AtlasSceneVaultLike {
  getFiles?: () => AtlasSceneFileLike[];
  cachedRead?: (file: TFile) => Promise<string>;
}

/**
 * Reads every .atlasmap belonging to a collection, including closed scenes. This mirrors
 * Atlas collectionMapFiles() + storeLegacyResources() instead of relying on whichever maps
 * happen to be open when Forge performs a Resource lookup.
 */
export async function atlasCollectionUsesLegacySecondaryResource(
  app: App,
  collectionId: string,
  getCollectionForMap: (mapPath: string) => string | null | undefined,
): Promise<boolean> {
  const vault = (app as unknown as { vault?: AtlasSceneVaultLike }).vault;
  if (typeof vault?.getFiles !== 'function' || typeof vault.cachedRead !== 'function') return false;

  const scenes = vault.getFiles().filter((file) => file.extension.toLowerCase() === 'atlasmap'
    && getCollectionForMap(file.path) === collectionId);
  for (const scene of scenes) {
    try {
      if (atlasSceneFileShowsLegacySecondaryResource(await vault.cachedRead(scene))) return true;
    } catch {
      // Atlas' migration ignores a scene it cannot parse and continues with the others.
    }
  }
  return false;
}
