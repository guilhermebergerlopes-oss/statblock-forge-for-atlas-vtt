import { ItemView, TFile, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import type StatblockForgePlugin from '../../main';
import { StatblockRenderSurface } from './StatblockRenderSurface.ts';

export const STATBLOCK_FORGE_RENDER_VIEW = 'statblock-forge-statblock-view';

interface StatblockRenderViewState extends Record<string, unknown> {
  sourcePath?: string;
  templatePath?: string;
}

/** Standalone preview surface for JSON sources and explicitly opened render previews. */
export class StatblockRenderView extends ItemView {
  private sourcePath: string | null = null;
  private templatePath: string | null = null;
  private surface: StatblockRenderSurface;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: StatblockForgePlugin) {
    super(leaf);
    this.surface = new StatblockRenderSurface(this.app, plugin, this.contentEl);
  }

  getViewType(): string { return STATBLOCK_FORGE_RENDER_VIEW; }
  getDisplayText(): string {
    return this.sourcePath?.split('/').pop()?.replace(/\.[^.]+$/, '')
      ?? (this.plugin.settings.language === 'pt-BR' ? 'Statblock Forge — Ficha' : 'Statblock Forge — Statblock');
  }
  getIcon(): string { return 'scroll-text'; }

  getState(): StatblockRenderViewState {
    return {
      ...(this.sourcePath ? { sourcePath: this.sourcePath } : {}),
      ...(this.templatePath ? { templatePath: this.templatePath } : {}),
    };
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const next = state && typeof state === 'object' ? state as StatblockRenderViewState : {};
    this.sourcePath = typeof next.sourcePath === 'string' ? next.sourcePath : null;
    this.templatePath = typeof next.templatePath === 'string' ? next.templatePath : null;
    await super.setState(state, result);
  }

  matchesStatblock(sourcePath: string, templatePath: string): boolean {
    return this.sourcePath === sourcePath && this.templatePath === templatePath;
  }

  matchesTemplatePath(templatePath: string): boolean {
    return this.templatePath === templatePath;
  }

  async onOpen(): Promise<void> {
    if (!this.sourcePath || !this.templatePath) return;
    const source = this.app.vault.getAbstractFileByPath(this.sourcePath);
    const template = this.app.vault.getAbstractFileByPath(this.templatePath);
    if (!(source instanceof TFile) || !(template instanceof TFile)) {
      await this.surface.loadPaths(this.sourcePath, this.templatePath);
      return;
    }

    await this.surface.loadStatblock(source, template);
  }

  async onClose(): Promise<void> {
    await this.surface.dispose();
  }

  async loadStatblock(
    source: TFile,
    templateFile: TFile,
    initialData?: Record<string, unknown>,
    options: { focusFirstEmpty?: boolean } = {},
  ): Promise<void> {
    this.sourcePath = source.path;
    this.templatePath = templateFile.path;
    await this.surface.loadStatblock(source, templateFile, initialData, options);
  }

  async refresh(): Promise<void> {
    await this.surface.refresh();
  }
}
