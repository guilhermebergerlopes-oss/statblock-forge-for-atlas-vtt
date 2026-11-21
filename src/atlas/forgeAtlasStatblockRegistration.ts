import type { App, TFile } from 'obsidian';
import {
  ensureForgeStatblockIsDiscoverableByAtlas,
  forgeStatblockTemplateLinkFromFrontmatter,
  type ForgeAtlasStatblockDiscoveryResult,
} from '../statblocks/forgeTemplateLink.ts';

/**
 * Registers an existing Forge-native v2 note in Atlas' standard Link Statblock
 * dialog. Atlas discovers note-backed entries through `statblock: true`; Forge
 * adds that marker without assigning an `atlas-template` or changing its own
 * `statblock-forge` template link.
 */
const registrationsInFlight = new WeakMap<App, Map<string, Promise<ForgeAtlasStatblockDiscoveryResult>>>();

async function registerForgeStatblockNoteInAtlasPickerNow(
  app: App,
  file: TFile,
): Promise<ForgeAtlasStatblockDiscoveryResult> {
  if (file.extension.toLowerCase() !== 'md') return 'not-forge-v2';
  const cached = app.metadataCache.getFileCache(file)?.frontmatter;
  if (!cached || forgeStatblockTemplateLinkFromFrontmatter(cached)?.version !== 2) return 'not-forge-v2';

  const currentMarker = (cached as Record<string, unknown>).statblock;
  if (currentMarker === true || currentMarker === 'true') return 'already-registered';
  if (Object.prototype.hasOwnProperty.call(cached, 'statblock')) return 'conflict';

  let result: ForgeAtlasStatblockDiscoveryResult = 'not-forge-v2';
  await app.fileManager.processFrontMatter(file, (frontmatter) => {
    result = ensureForgeStatblockIsDiscoverableByAtlas(frontmatter as Record<string, unknown>);
  });
  return result;
}

/** Coalesce concurrent metadata/startup scans so the same note is only written once. */
export async function registerForgeStatblockNoteInAtlasPicker(
  app: App,
  file: TFile,
): Promise<ForgeAtlasStatblockDiscoveryResult> {
  let byPath = registrationsInFlight.get(app);
  if (!byPath) {
    byPath = new Map();
    registrationsInFlight.set(app, byPath);
  }
  const pending = byPath.get(file.path);
  // A concurrent caller is observing the same migration, not performing a
  // second registration. Report that result as already handled so parallel
  // startup scans do not both log the same note as newly registered.
  if (pending) {
    const result = await pending;
    return result === 'registered' ? 'already-registered' : result;
  }

  const task = registerForgeStatblockNoteInAtlasPickerNow(app, file);
  byPath.set(file.path, task);
  try {
    return await task;
  } finally {
    if (byPath.get(file.path) === task) byPath.delete(file.path);
  }
}

export interface ForgeAtlasStatblockRegistrationSummary {
  scanned: number;
  registered: number;
  alreadyRegistered: number;
  conflicts: string[];
  failed: Array<{ path: string; message: string }>;
}

/** One-time/startup pass for Forge v2 notes created before the Atlas discovery marker existed. */
export async function registerExistingForgeStatblocksInAtlasPicker(app: App): Promise<ForgeAtlasStatblockRegistrationSummary> {
  const summary: ForgeAtlasStatblockRegistrationSummary = {
    scanned: 0,
    registered: 0,
    alreadyRegistered: 0,
    conflicts: [],
    failed: [],
  };
  for (const file of app.vault.getMarkdownFiles()) {
    const cached = app.metadataCache.getFileCache(file)?.frontmatter;
    if (!cached || forgeStatblockTemplateLinkFromFrontmatter(cached)?.version !== 2) continue;
    summary.scanned += 1;
    try {
      const result = await registerForgeStatblockNoteInAtlasPicker(app, file);
      if (result === 'registered') summary.registered += 1;
      else if (result === 'already-registered') summary.alreadyRegistered += 1;
      else if (result === 'conflict') summary.conflicts.push(file.path);
    } catch (error) {
      summary.failed.push({ path: file.path, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return summary;
}
