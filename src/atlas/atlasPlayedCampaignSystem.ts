import type { App, TFile } from 'obsidian';

export interface AtlasPlayedCampaignSystem {
  readonly campaignId: string;
  readonly settings: Record<string, unknown>;
}

interface VaultFileLike extends TFile {
  readonly path: string;
}

interface VaultLike {
  getFiles?: () => VaultFileLike[];
  cachedRead?: (file: TFile) => Promise<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUsableCampaignGridDefaults(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!['feet', 'yards', 'meters', 'units', 'custom'].includes(String(value.unitType))) return false;
  if (value.measurementMode !== 'metric' && value.measurementMode !== 'abstract') return false;
  if (typeof value.unitDistance !== 'number' || !Number.isFinite(value.unitDistance)
    || value.unitDistance < 0.000001 || value.unitDistance > 1_000_000) return false;
  if (Array.isArray(value.abstractRangeBands) && value.abstractRangeBands.some((band) =>
    !isRecord(band) || typeof band.name !== 'string'
      || typeof band.maxSquares !== 'number' || !Number.isInteger(band.maxSquares) || band.maxSquares < 1)) return false;
  return true;
}

/**
 * Reads the system Atlas is currently playing. Campaign settings override the collection's
 * game-system rules for every map; an invalid or only partly synced campaign is ignored just
 * as Atlas ignores a campaign whose SystemRules have not loaded yet.
 */
export async function loadAtlasPlayedCampaignSystem(app: App): Promise<AtlasPlayedCampaignSystem | null> {
  const atlasApp = app as App & { loadLocalStorage?: (key: string) => unknown };
  let campaignId: unknown;
  try { campaignId = atlasApp.loadLocalStorage?.('atlas-vtt:table-campaign'); }
  catch { return null; }
  if (typeof campaignId !== 'string' || !campaignId) return null;

  const vault = (app as unknown as { vault?: VaultLike }).vault;
  if (typeof vault?.getFiles !== 'function' || typeof vault.cachedRead !== 'function') return null;

  const files = vault.getFiles().filter((file) => file.path.startsWith('atlas-vtt/campaigns/')
    && /^atlas-vtt\/campaigns\/[^/]+\/campaign\.json$/i.test(file.path));
  for (const file of files) {
    try {
      const parsed: unknown = JSON.parse(await vault.cachedRead(file));
      if (!isRecord(parsed) || parsed.id !== campaignId || !isRecord(parsed.system)) continue;
      if (!isUsableCampaignGridDefaults(parsed.system.gridDefaults) || !Array.isArray(parsed.system.conditions)) return null;
      return { campaignId, settings: parsed.system };
    } catch {
      // A partially synced campaign file is treated as Atlas' not-yet-loaded campaign entry.
      return null;
    }
  }
  return null;
}
