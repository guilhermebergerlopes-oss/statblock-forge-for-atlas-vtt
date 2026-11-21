import { MarkdownView, TFile, type App, type WorkspaceLeaf } from 'obsidian';
import type StatblockForgePlugin from '../../main';
import { registerExistingForgeStatblocksInAtlasPicker, registerForgeStatblockNoteInAtlasPicker } from '../atlas/forgeAtlasStatblockRegistration.ts';
import { readForgeTemplateLink, resolveForgeTemplateForNote } from '../atlas/forgeTemplateLinkResolver.ts';
import type { JsonRecord } from '../templates/forgeTemplate.ts';
import { StatblockRenderSurface } from './StatblockRenderSurface.ts';
import { StatblockMarkdownFieldsPanel } from './StatblockMarkdownFieldsPanel.ts';

const NOTE_LAYOUT_CLASS = 'statblock-forge__note-layout';
const NOTE_STACKED_CLASS = 'statblock-forge__note-layout--stacked';

/** One editor surface attached to a MarkdownView, beside the note that owns its YAML. */
class StatblockNotePanel {
  private readonly host: HTMLDivElement;
  private readonly surface: StatblockRenderSurface;
  private readonly resizeObserver: ResizeObserver | null;
  private sourcePath: string;
  private templatePath: string;
  manual: boolean;

  constructor(
    private readonly view: MarkdownView,
    private readonly plugin: StatblockForgePlugin,
    source: TFile,
    template: TFile,
    initialData: JsonRecord | undefined,
    manual: boolean,
    options: { focusFirstEmpty?: boolean } = {},
  ) {
    this.sourcePath = source.path;
    this.templatePath = template.path;
    this.manual = manual;
    this.host = document.createElement('aside');
    this.host.className = 'statblock-forge__note-panel';
    this.host.setAttribute('aria-label', plugin.settings.language === 'pt-BR' ? 'Editor de statblock' : 'Statblock editor');
    this.view.contentEl.appendChild(this.host);
    this.view.containerEl.classList.add(NOTE_LAYOUT_CLASS);
    this.surface = new StatblockRenderSurface(plugin.app, plugin, this.host);
    this.resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.measure());
    this.resizeObserver?.observe(this.view.contentEl);
    this.measure();
    void this.surface.loadStatblock(source, template, initialData, options);
  }

  matches(sourcePath: string, templatePath: string): boolean {
    return this.sourcePath === sourcePath && this.templatePath === templatePath;
  }

  belongsTo(sourcePath: string): boolean {
    return this.sourcePath === sourcePath;
  }

  usesTemplate(templatePath: string): boolean {
    return this.templatePath === templatePath;
  }

  consumeOwnSourceMetadataRefresh(path: string): boolean {
    return path === this.sourcePath && this.surface.consumeExpectedSourceMetadataRefresh(path);
  }

  async setStatblock(
    source: TFile,
    template: TFile,
    initialData?: JsonRecord,
    options: { focusFirstEmpty?: boolean } = {},
  ): Promise<void> {
    if (this.matches(source.path, template.path) && initialData === undefined && !options.focusFirstEmpty) return;
    this.sourcePath = source.path;
    this.templatePath = template.path;
    await this.surface.loadStatblock(source, template, initialData, options);
  }

  async refresh(): Promise<void> {
    await this.surface.refresh();
  }

  async detach(): Promise<void> {
    this.resizeObserver?.disconnect();
    await this.surface.dispose();
    this.host.remove();
    this.view.containerEl.classList.remove(NOTE_LAYOUT_CLASS, NOTE_STACKED_CLASS);
  }

  private measure(): void {
    const stacked = this.view.contentEl.clientWidth > 0 && this.view.contentEl.clientWidth < 1100;
    this.view.containerEl.classList.toggle(NOTE_STACKED_CLASS, stacked);
  }
}

/**
 * Mirrors Atlas' note-panel approach: decorate each MarkdownView holding a
 * Forge-linked statblock with a live editable panel in that same view/leaf.
 */
export class StatblockNotePanels {
  private readonly panels = new Map<MarkdownView, StatblockNotePanel>();
  private readonly markdownPanels = new Map<MarkdownView, StatblockMarkdownFieldsPanel>();
  private readonly stops: Array<() => void> = [];
  private generation = 0;
  private started = false;

  constructor(private readonly app: App, private readonly plugin: StatblockForgePlugin) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    const refresh = (): void => this.refresh();
    const layout = this.app.workspace.on('layout-change', refresh);
    const active = this.app.workspace.on('active-leaf-change', refresh);
    const opened = this.app.workspace.on('file-open', refresh);
    const metadata = this.app.metadataCache.on('changed', (file) => {
      this.registerStatblockForAtlasPicker(file);
      refresh(file.path);
    });
    const renamed = this.app.vault.on('rename', refresh);
    const deleted = this.app.vault.on('delete', refresh);
    this.stops.push(
      () => this.app.workspace.offref(layout),
      () => this.app.workspace.offref(active),
      () => this.app.workspace.offref(opened),
      () => this.app.metadataCache.offref(metadata),
      () => this.app.vault.offref(renamed),
      () => this.app.vault.offref(deleted),
    );
    const registerExisting = (): void => {
      if (!this.started) return;
      // Atlas' native Link Statblock dialog discovers notes with `statblock: true`.
      // Migrate pre-marker Forge v2 notes from the always-started note-panel service,
      // rather than relying on the optional Ctrl-hover preview bridge to be active.
      void registerExistingForgeStatblocksInAtlasPicker(this.app).then((summary) => {
        if (summary.registered > 0) {
          console.info(`[Statblock Forge] Registered ${summary.registered} existing Forge statblock(s) in Atlas' Link Statblock list.`);
        }
        for (const path of summary.conflicts) {
          console.warn(`[Statblock Forge] Could not add "${path}" to Atlas' Link Statblock list because it already has a different \`statblock\` value. The existing value was preserved.`);
        }
        for (const failure of summary.failed) {
          console.error(`[Statblock Forge] Could not register "${failure.path}" in Atlas' Link Statblock list: ${failure.message}`);
        }
      }).catch((error: unknown) => {
        console.error('[Statblock Forge] Could not scan existing Forge statblocks for Atlas link discovery:', error);
      });
      refresh();
    };
    // `resolved` covers large Vaults where the initial metadata scan can finish
    // after workspace layout readiness. The registration helper coalesces both calls.
    const resolved = this.app.metadataCache.on('resolved', registerExisting);
    this.stops.push(() => this.app.metadataCache.offref(resolved));
    this.app.workspace.onLayoutReady(registerExisting);
  }

  private registerStatblockForAtlasPicker(file: TFile): void {
    if (!this.started || file.extension.toLowerCase() !== 'md') return;
    void registerForgeStatblockNoteInAtlasPicker(this.app, file).then((result) => {
      if (result === 'conflict') {
        console.warn(`[Statblock Forge] Could not add "${file.path}" to Atlas' Link Statblock list because it already has a different \`statblock\` value. The existing value was preserved.`);
      }
    }).catch((error: unknown) => {
      console.error(`[Statblock Forge] Could not register "${file.path}" in Atlas' Link Statblock list:`, error);
    });
  }

  async stop(): Promise<void> {
    this.generation += 1;
    for (const stop of this.stops.splice(0)) stop();
    for (const panel of this.panels.values()) await panel.detach();
    this.panels.clear();
    for (const panel of this.markdownPanels.values()) panel.detach();
    this.markdownPanels.clear();
    this.started = false;
  }

  /** Reconcile panels after a note/tab change; template files can request a content refresh. */
  refresh(changedPath?: string): void {
    const generation = ++this.generation;
    const seen = new Set<MarkdownView>();
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (!(leaf.view instanceof MarkdownView)) return;
      seen.add(leaf.view);
      void this.evaluate(leaf.view, generation, changedPath);
    });
    for (const [view, panel] of this.panels) {
      if (seen.has(view)) continue;
      this.panels.delete(view);
      void panel.detach();
    }
    for (const [view, panel] of this.markdownPanels) {
      if (seen.has(view)) continue;
      this.markdownPanels.delete(view);
      panel.detach();
    }
  }

  /** Refresh only open notes linked to a template that has just been saved. */
  async refreshTemplate(templatePath: string): Promise<void> {
    const refreshes: Promise<void>[] = [];
    for (const panel of this.panels.values()) {
      if (panel.usesTemplate(templatePath)) refreshes.push(panel.refresh());
    }
    for (const panel of this.markdownPanels.values()) {
      if (panel.usesTemplate(templatePath)) refreshes.push(panel.refresh());
    }
    await Promise.all(refreshes);
  }

  /** Force the side-by-side editor for the leaf an entry point has just opened. */
  async reveal(
    leaf: WorkspaceLeaf,
    source: TFile,
    template: TFile,
    initialData?: JsonRecord,
    options: { focusFirstEmpty?: boolean } = {},
  ): Promise<boolean> {
    const view = leaf.view;
    if (!(view instanceof MarkdownView) || source.extension.toLowerCase() !== 'md') return false;
    const link = readForgeTemplateLink(this.app, source);
    const manual = link?.version !== 2;
    const markdownPanel = this.markdownPanels.get(view);
    if (markdownPanel) {
      this.markdownPanels.delete(view);
      markdownPanel.detach();
    }
    const existing = this.panels.get(view);
    if (existing && existing.belongsTo(source.path)) {
      existing.manual = manual;
      await existing.setStatblock(source, template, initialData, options);
      return true;
    }
    if (existing) {
      this.panels.delete(view);
      await existing.detach();
    }
    const panel = new StatblockNotePanel(view, this.plugin, source, template, initialData, manual, options);
    this.panels.set(view, panel);
    return true;
  }

  private async evaluate(view: MarkdownView, generation: number, changedPath?: string): Promise<void> {
    const file = view.file;
    const current = this.panels.get(view);
    if (!(file instanceof TFile) || file.extension.toLowerCase() !== 'md') {
      if (current) {
        this.panels.delete(view);
        await current.detach();
      }
      const markdownPanel = this.markdownPanels.get(view);
      if (markdownPanel) {
        this.markdownPanels.delete(view);
        markdownPanel.detach();
      }
      return;
    }

    // Inline frontmatter saves update the live card in place. Consume their
    // metadata event before link resolution can yield to another event; a full
    // refresh here would replace the card DOM and shift the note viewport.
    if (changedPath === file.path && current?.belongsTo(file.path)
      && current.consumeOwnSourceMetadataRefresh(file.path)) return;

    const link = readForgeTemplateLink(this.app, file);
    // Atlas-linked v1 notes use Atlas' native card. Atlas does not expose a
    // public renderer-extension API, so Forge adds a small Markdown-only editor
    // beneath the native card instead of mounting a duplicate full statblock.
    if (link?.version === 1) {
      if (current && current.manual && current.belongsTo(file.path)) {
        const markdownPanel = this.markdownPanels.get(view);
        if (markdownPanel) {
          this.markdownPanels.delete(view);
          markdownPanel.detach();
        }
        if (changedPath === file.path) await current.refresh();
        return;
      }
      if (current) {
        this.panels.delete(view);
        await current.detach();
      }
      const resolution = await resolveForgeTemplateForNote(this.app, file);
      if (generation !== this.generation || view.file?.path !== file.path) return;
      if (resolution.status !== 'linked') {
        const markdownPanel = this.markdownPanels.get(view);
        if (markdownPanel) {
          this.markdownPanels.delete(view);
          markdownPanel.detach();
        }
        return;
      }
      const existingMarkdownPanel = this.markdownPanels.get(view);
      if (existingMarkdownPanel && existingMarkdownPanel.matches(file.path, resolution.file.path)) {
        if (changedPath === file.path || changedPath === resolution.file.path || changedPath?.includes('/.statblock-forge/layouts/')) {
          await existingMarkdownPanel.refresh();
        }
        return;
      }
      if (existingMarkdownPanel) {
        this.markdownPanels.delete(view);
        existingMarkdownPanel.detach();
      }
      const markdownPanel = new StatblockMarkdownFieldsPanel(view, this.app, file, resolution.file, this.plugin.settings.language);
      this.markdownPanels.set(view, markdownPanel);
      return;
    }

    const markdownPanel = this.markdownPanels.get(view);
    if (markdownPanel) {
      this.markdownPanels.delete(view);
      markdownPanel.detach();
    }
    if (!link || link.version !== 2) {
      if (current && current.manual && current.belongsTo(file.path)) {
        if (changedPath === file.path) await current.refresh();
        return;
      }
      if (current) {
        this.panels.delete(view);
        await current.detach();
      }
      return;
    }

    const resolution = await resolveForgeTemplateForNote(this.app, file);
    if (generation !== this.generation || view.file?.path !== file.path) return;
    if (resolution.status !== 'linked') {
      const latest = this.panels.get(view);
      if (latest && !latest.manual) {
        this.panels.delete(view);
        await latest.detach();
      }
      return;
    }

    // A user entry point may reveal the panel while template resolution is
    // still pending. Re-check the map after the await to avoid mounting a
    // second host into the same MarkdownView.
    const latest = this.panels.get(view);
    if (latest && latest.matches(file.path, resolution.file.path)) {
      latest.manual = false;
      if (changedPath === file.path || changedPath === resolution.file.path || changedPath?.includes('/.statblock-forge/layouts/')) {
        await latest.refresh();
      }
      return;
    }
    if (latest) {
      this.panels.delete(view);
      await latest.detach();
    }
    this.panels.set(view, new StatblockNotePanel(view, this.plugin, file, resolution.file, undefined, false));
  }
}
