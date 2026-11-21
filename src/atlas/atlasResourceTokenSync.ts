import type { App, EventRef, TFile } from 'obsidian';
import { parseTemplateFileText } from '../templates/forgeFileFormat.ts';
import { loadStatblockSource } from '../statblocks/statblockDataSources.ts';
import { forgeStatblockTemplateLinkFromFrontmatter } from '../statblocks/forgeTemplateLink.ts';
import type { ForgeTemplate } from '../templates/forgeTemplate.ts';
import { getAtlasMapViewContexts, inspectAtlasRuntime } from './atlasRuntime.ts';
import { atlasResourceReadsForgeField, effectiveAtlasCampaignResources, effectiveAtlasCollectionResources } from './atlasResourceCatalog.ts';
import {
  atlasResourceSourceValues,
  syncAtlasResourcesForToken,
  type AtlasResourceSourceSpec,
} from './atlasResourceTokenSyncModel.ts';

interface UnknownRecord { [key: string]: unknown }

interface AtlasResourceValueLike {
  current: number;
  max: number;
}

interface AtlasPlacedTokenLike {
  statblockPath?: string;
  resources?: Record<string, AtlasResourceValueLike>;
  overriddenMax?: string[];
}

interface AtlasStoreStateLike {
  mapPath?: string | null;
  mapLoaded?: boolean;
  isMapLoading?: boolean;
  isPlayerView?: boolean;
  objects?: { tokens?: Record<string, AtlasPlacedTokenLike> };
  updateTokens?: (entries: Array<{ id: string; changes: { resources: Record<string, AtlasResourceValueLike> } }>) => void;
}

interface AtlasHistoryLike {
  untracked?: (operation: () => void) => void;
}

interface AtlasStoreLike {
  getState(): AtlasStoreStateLike;
  temporal?: { getState?: () => AtlasHistoryLike };
}

interface AtlasAssetServiceLike {
  getCollectionForMap?(mapPath: string): string | null;
  getCollectionSettings?(collectionId: string): unknown;
}

interface AtlasRuntimeMapLike {
  readonly view: unknown;
  readonly store: unknown;
  readonly assetService: unknown;
  readonly diagnostics: { readonly ready: boolean };
}

interface VaultFileLike extends TFile {
  readonly path: string;
  readonly basename: string;
  readonly extension: string;
}

const PLAYED_CAMPAIGN_STORAGE_KEY = 'atlas-vtt:table-campaign';
const CAMPAIGNS_FOLDER = 'atlas-vtt/campaigns/';
const SYSTEM_PRESETS_FOLDER = 'atlas-vtt/system-presets/';

function isAtlasRulesRecordPath(path: string): boolean {
  return (path.startsWith(CAMPAIGNS_FOLDER) && /^atlas-vtt\/campaigns\/[^/]+\/campaign\.json$/i.test(path))
    || (path.startsWith(SYSTEM_PRESETS_FOLDER) && path.toLowerCase().endsWith('.json'));
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVaultFile(value: unknown): value is VaultFileLike {
  return isRecord(value) && typeof value.path === 'string'
    && typeof value.basename === 'string' && typeof value.extension === 'string';
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

function assetServiceForMap(map: AtlasRuntimeMapLike): AtlasAssetServiceLike | null {
  if (!isRecord(map.assetService)) return null;
  return map.assetService as AtlasAssetServiceLike;
}

function storeForMap(map: AtlasRuntimeMapLike): AtlasStoreLike | null {
  return isRecord(map.store) && typeof map.store.getState === 'function'
    ? map.store as unknown as AtlasStoreLike : null;
}

function resourceSpecsForTemplate(template: ForgeTemplate, resources: ReturnType<typeof effectiveAtlasCollectionResources>): AtlasResourceSourceSpec[] {
  const specs: AtlasResourceSourceSpec[] = [];
  for (const resource of resources) {
    const field = template.fields.find((candidate) => atlasResourceReadsForgeField(resource, candidate));
    if (field) specs.push({ resource, field });
  }
  return specs;
}

function runAtlasUntracked(store: AtlasStoreLike, operation: () => void): void {
  try {
    const history = store.temporal?.getState?.();
    if (typeof history?.untracked === 'function') {
      history.untracked(operation);
      return;
    }
  } catch {
    // A store without a temporal history still accepts updateTokens directly.
  }
  operation();
}

/**
 * Keeps Atlas token Resources in step with Forge v2 statblock Fields. The
 * service mirrors the StatblockTokenSync behavior inspected in Atlas 0.17.0 and 0.18.0:
 * updateTokens(), untracked history writes, max overrides, per-map rules and
 * PartySync observation are all preserved.
 */
export class AtlasForgeResourceTokenSync {
  private started = false;
  private destroyed = false;
  private running = false;
  private pendingAll = false;
  private readonly pendingNotes = new Set<string>();
  private readonly metadataRef: EventRef;
  private readonly vaultModifyRef: EventRef;
  private readonly vaultCreateRef: EventRef;
  private readonly vaultDeleteRef: EventRef;
  private readonly vaultRenameRef: EventRef;
  private readonly workspaceRefs: EventRef[] = [];
  /** Last Resource field paths followed per open map, matching Atlas' refielded-resource logic. */
  private readonly followedRules = new Map<string, Map<string, string>>();
  private readonly app: App;

  constructor(app: App) {
    this.app = app;
    this.metadataRef = app.metadataCache.on('changed', (file) => {
      if (file?.extension?.toLowerCase() === 'md') this.scheduleNote(file.path);
    });
    this.vaultModifyRef = app.vault.on('modify', (file) => {
      if (file?.extension?.toLowerCase() === 'forgetemplate' || isAtlasRulesRecordPath(file?.path ?? '')) this.scheduleAll();
    });
    this.vaultCreateRef = app.vault.on('create', (file) => {
      if (isAtlasRulesRecordPath(file?.path ?? '')) this.scheduleAll();
    });
    this.vaultDeleteRef = app.vault.on('delete', (file) => {
      if (isAtlasRulesRecordPath(file?.path ?? '')) this.scheduleAll();
    });
    this.vaultRenameRef = app.vault.on('rename', (file, oldPath) => {
      if (file?.extension?.toLowerCase() === 'forgetemplate'
        || file?.extension?.toLowerCase() === 'md'
        || isAtlasRulesRecordPath(file?.path ?? '')
        || isAtlasRulesRecordPath(typeof oldPath === 'string' ? oldPath : '')) this.scheduleAll();
    });
    const workspace = app.workspace as unknown as { on?: (name: string, callback: (...args: unknown[]) => void) => EventRef };
    if (typeof workspace.on === 'function') {
      for (const eventName of ['layout-change', 'atlas-vtt:refresh-assets', 'atlas-vtt:scene-opened', 'atlas-vtt:collection-settings-changed']) {
        this.workspaceRefs.push(workspace.on(eventName, () => this.scheduleAll()));
      }
    }
  }

  start(): void {
    if (this.started || this.destroyed) return;
    this.started = true;
    this.app.workspace.onLayoutReady(() => this.scheduleAll());
    this.scheduleAll();
  }

  stop(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.app.metadataCache.offref(this.metadataRef);
    this.app.vault.offref(this.vaultModifyRef);
    this.app.vault.offref(this.vaultCreateRef);
    this.app.vault.offref(this.vaultDeleteRef);
    this.app.vault.offref(this.vaultRenameRef);
    for (const ref of this.workspaceRefs) this.app.workspace.offref(ref);
    this.pendingNotes.clear();
    this.pendingAll = false;
    this.followedRules.clear();
  }

  /** Public entry used by diagnostics and focused tests; does not cache Atlas handles. */
  async syncNote(notePath: string): Promise<number> {
    return this.syncNoteWithRules(notePath, null);
  }

  private async syncNoteWithRules(
    notePath: string,
    sharedRules: ReadonlyMap<string, AtlasResourceRuleTransition> | null,
  ): Promise<number> {
    if (this.destroyed || !inspectAtlasRuntime(this.app).runtimeSupported) return 0;
    const note = this.app.vault.getAbstractFileByPath(notePath);
    if (!isVaultFile(note) || note.extension.toLowerCase() !== 'md') return 0;
    const frontmatter = this.app.metadataCache.getFileCache(note as TFile)?.frontmatter;
    const link = forgeStatblockTemplateLinkFromFrontmatter(frontmatter);
    // Atlas-published Forge v1 notes are already native statblocks; only Forge v2 needs this sync.
    if (!link || link.version !== 2 || link.atlasTemplateId) return 0;

    const templateFile = await this.resolveTemplateFile(link.templatePath, link.templateId);
    if (!templateFile || this.destroyed) return 0;
    const parsedTemplate = parseTemplateFileText(await this.app.vault.cachedRead(templateFile as TFile), templateFile.extension);
    if (parsedTemplate.fileFormat !== 'forge' || parsedTemplate.template.id !== link.templateId) return 0;
    const source = await loadStatblockSource(this.app, note as TFile, parsedTemplate.template);
    if (this.destroyed) return 0;

    const maps = getAtlasMapViewContexts(this.app) as unknown as AtlasRuntimeMapLike[];
    const localRules = new Map<string, AtlasResourceRuleTransition>();
    let updated = 0;
    for (const map of maps) {
      if (this.destroyed || !map.diagnostics.ready) continue;
      const store = storeForMap(map);
      const assets = assetServiceForMap(map);
      if (!store || !assets) continue;
      const state = store.getState();
      if (state.isPlayerView === true || state.mapLoaded !== true || state.isMapLoading === true) continue;
      const mapPath = typeof state.mapPath === 'string' ? state.mapPath : '';
      let rules = sharedRules?.get(mapPath) ?? localRules.get(mapPath);
      if (!rules) {
        const definitions = await this.resourceDefinitionsForMap(mapPath, assets);
        rules = this.createRuleTransition(mapPath, definitions);
        localRules.set(mapPath, rules);
      }
      if (this.destroyed || rules.definitions.length === 0) continue;
      const specs = resourceSpecsForTemplate(parsedTemplate.template, rules.definitions);
      if (specs.length === 0) continue;
      // loadStatblockSource exposes its allow-listed Field values through binding.data.
      const sources = atlasResourceSourceValues(source.binding.data, specs);
      const liveTokens = store.getState().objects?.tokens ?? {};
      const updates: Array<{ id: string; changes: { resources: Record<string, AtlasResourceValueLike> } }> = [];
      for (const [id, token] of Object.entries(liveTokens)) {
        if (token.statblockPath !== note.path) continue;
        const result = syncAtlasResourcesForToken(token, sources, { refieldedKeys: rules.refieldedKeys });
        if (result.changed) updates.push({ id, changes: { resources: result.resources } });
      }
      if (updates.length === 0) continue;
      const liveState = store.getState();
      if (typeof liveState.updateTokens !== 'function') continue;
      runAtlasUntracked(store, () => liveState.updateTokens?.(updates));
      updated += updates.length;
    }

    // A syncAll pass shares its rule snapshot across every linked note on the map,
    // then commits it once. A direct note update owns and commits its own snapshot.
    if (sharedRules === null) {
      for (const [mapPath, rules] of localRules) this.followedRules.set(mapPath, rules.currentFields);
    }
    return updated;
  }

  async syncAll(): Promise<number> {
    if (this.destroyed || !inspectAtlasRuntime(this.app).runtimeSupported) return 0;
    const paths = new Set<string>();
    const seenMapPaths = new Set<string>();
    const rulesByMap = new Map<string, AtlasResourceRuleTransition>();
    const maps = getAtlasMapViewContexts(this.app) as unknown as AtlasRuntimeMapLike[];
    for (const map of maps) {
      if (!map.diagnostics.ready) continue;
      const store = storeForMap(map);
      const assets = assetServiceForMap(map);
      if (!store || !assets) continue;
      const state = store.getState();
      const mapPath = typeof state.mapPath === 'string' ? state.mapPath : '';
      if (mapPath) seenMapPaths.add(mapPath);
      if (state.isPlayerView === true || state.mapLoaded !== true || state.isMapLoading === true) continue;
      const definitions = await this.resourceDefinitionsForMap(mapPath, assets);
      rulesByMap.set(mapPath, this.createRuleTransition(mapPath, definitions));
      for (const token of Object.values(state.objects?.tokens ?? {})) {
        if (typeof token.statblockPath === 'string' && token.statblockPath.length > 0) paths.add(token.statblockPath);
      }
    }
    let updated = 0;
    for (const path of paths) {
      if (this.destroyed) break;
      try { updated += await this.syncNoteWithRules(path, rulesByMap); }
      catch (error) { console.error(`[Statblock Forge] Could not synchronize Atlas Resources for ${path}:`, error); }
    }
    if (this.destroyed) return updated;
    for (const [mapPath, rules] of rulesByMap) this.followedRules.set(mapPath, rules.currentFields);
    for (const mapPath of this.followedRules.keys()) {
      if (!seenMapPaths.has(mapPath)) this.followedRules.delete(mapPath);
    }
    return updated;
  }

  private createRuleTransition(
    mapPath: string,
    definitions: ReturnType<typeof effectiveAtlasCollectionResources>,
  ): AtlasResourceRuleTransition {
    const currentFields = new Map(definitions.map((resource) => [resource.key, resource.field]));
    const previousFields = this.followedRules.get(mapPath);
    const refieldedKeys = new Set<string>();
    if (previousFields) {
      for (const resource of definitions) {
        const previousField = previousFields.get(resource.key);
        if (previousField !== undefined && previousField !== resource.field) refieldedKeys.add(resource.key);
      }
    }
    return { definitions, currentFields, refieldedKeys };
  }

  private scheduleNote(path: string): void {
    if (this.destroyed || !path) return;
    this.pendingNotes.add(path);
    this.drainQueue();
  }

  private scheduleAll(): void {
    if (this.destroyed) return;
    this.pendingAll = true;
    this.drainQueue();
  }

  private drainQueue(): void {
    if (this.running || this.destroyed) return;
    this.running = true;
    void Promise.resolve().then(async () => {
      try {
        while (!this.destroyed && (this.pendingAll || this.pendingNotes.size > 0)) {
          if (this.pendingAll) {
            this.pendingAll = false;
            this.pendingNotes.clear();
            await this.syncAll();
            continue;
          }
          const [path] = this.pendingNotes;
          if (!path) continue;
          this.pendingNotes.delete(path);
          try { await this.syncNote(path); }
          catch (error) { console.error(`[Statblock Forge] Could not synchronize Atlas Resources for ${path}:`, error); }
        }
      } finally {
        this.running = false;
        if (!this.destroyed && (this.pendingAll || this.pendingNotes.size > 0)) this.drainQueue();
      }
    });
  }

  private async resolveTemplateFile(path: string, templateId: string): Promise<VaultFileLike | null> {
    const exact = this.app.vault.getAbstractFileByPath(path);
    if (isVaultFile(exact) && exact.extension.toLowerCase() === 'forgetemplate') {
      try {
        const parsed = parseTemplateFileText(await this.app.vault.cachedRead(exact as TFile), exact.extension);
        if (parsed.fileFormat === 'forge' && parsed.template.id === templateId) return exact;
      } catch { /* A moved or stale exact link falls through to stable-ID recovery. */ }
    }
    for (const candidate of this.app.vault.getFiles()) {
      if (candidate.extension.toLowerCase() !== 'forgetemplate') continue;
      try {
        const parsed = parseTemplateFileText(await this.app.vault.cachedRead(candidate), candidate.extension);
        if (parsed.fileFormat === 'forge' && parsed.template.id === templateId) return candidate;
      } catch { /* Ignore malformed unrelated templates. */ }
    }
    return null;
  }

  private async resourceDefinitionsForMap(
    mapPath: string,
    assets: AtlasAssetServiceLike,
  ) {
    const played = await this.playedCampaignSystem();
    if (played) return this.resourceDefinitionsForCampaign(played);
    const collectionId = assets.getCollectionForMap?.(mapPath) ?? null;
    if (collectionId) return effectiveAtlasCollectionResources(assets.getCollectionSettings?.(collectionId));
    // Atlas maps outside collections use the legacy HP + secondary resource bars.
    return effectiveAtlasCollectionResources({ defaultWidgets: { stressBar: true } });
  }

  private resourceDefinitionsForCampaign(system: UnknownRecord) {
    return effectiveAtlasCampaignResources(system);
  }

  private async playedCampaignSystem(): Promise<UnknownRecord | null> {
    const app = this.app as App & { loadLocalStorage?: (key: string) => unknown };
    let campaignId: unknown;
    try { campaignId = app.loadLocalStorage?.(PLAYED_CAMPAIGN_STORAGE_KEY); }
    catch { return null; }
    if (typeof campaignId !== 'string' || !campaignId) return null;
    const files = this.app.vault.getFiles().filter((file) => file.path.startsWith(CAMPAIGNS_FOLDER)
      && file.path.endsWith('/campaign.json'));
    for (const file of files) {
      try {
        const parsed: unknown = JSON.parse(await this.app.vault.cachedRead(file));
        if (!isRecord(parsed) || parsed.id !== campaignId || !isRecord(parsed.system)) continue;
        // Mirror Atlas parseSystemRules(): campaigns without valid measurement rules are not played systems.
        if (!isUsableCampaignGridDefaults(parsed.system.gridDefaults) || !Array.isArray(parsed.system.conditions)) return null;
        return parsed.system;
      } catch {
        // A partially synced campaign file is treated like Atlas' not-yet-loaded campaign entry.
        return null;
      }
    }
    return null;
  }
}
