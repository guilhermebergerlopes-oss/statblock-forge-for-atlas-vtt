import { MarkdownView, Menu, Notice, Platform, Plugin, TFile, TFolder } from 'obsidian';
import { ForgeSettingTab } from './src/settings/ForgeSettingTab';
import { DEFAULT_TOGGLE_STATBLOCK_MODE_SHORTCUT, matchesForgeShortcut, normalizeForgeShortcut } from './src/settings/forgeShortcut.ts';
import { TemplateEditorView, STATBLOCK_FORGE_EDITOR_VIEW } from './src/views/TemplateEditorView';
import { StatblockCreationModal } from './src/views/StatblockCreationModal.ts';
import { StatblockRenderView, STATBLOCK_FORGE_RENDER_VIEW } from './src/views/StatblockRenderView';
import { StatblockNotePanels } from './src/views/StatblockNotePanels.ts';
import { ForgeTemplatePickerModal } from './src/views/StatblockFilePickers';
import { TemplateDeletionModal } from './src/views/TemplateDeletionModal';
import { TemplateOverwriteModal } from './src/views/TemplateOverwriteModal.ts';
import { UnsavedTemplateChangesModal } from './src/views/UnsavedTemplateChangesModal.ts';
import { normalizeTemplateFolder, FORGE_TEMPLATE_EXTENSION } from './src/templates/templateFormat';
import { parseTemplateFileText } from './src/templates/forgeFileFormat.ts';
import { createInitialStatblockData } from './src/templates/statblockCreationModel.ts';
import { saveTemplateDocument, TemplateNameConflictError, type TemplateOverwriteConfirmation } from './src/templates/templateRepository.ts';
import { createTemplateVaultStorage } from './src/templates/templateVaultStorage.ts';
import { createForgeLayout, isRecord } from './src/templates/forgeTemplate.ts';
import { createForgeStatblockNoteFromTemplate } from './src/statblocks/forgeStatblockNoteCreator.ts';
import { openForgeStatblockNoteForEditing } from './src/statblocks/forgeStatblockEditorWorkflow.ts';
import { readForgeTemplateLink, resolveForgeTemplateForNote } from './src/atlas/forgeTemplateLinkResolver';
import { registerForgeAtlasSheetProvider } from './src/atlas/atlasSheetProvider.ts';
import { refreshForgeStatblockTemplateLinkPath } from './src/statblocks/forgeTemplateLink';
import { assessAtlasTokenCreation, dispatchAtlasCreateTokenCommand } from './src/atlas/atlasTokenWorkflow';
import { normalizeForgeLanguage, translateForgeText, type ForgeLanguage } from './src/i18n/localization';
import { DEFAULT_DOCUMENTATION_FOLDER, documentationFolderForLanguage, normalizeDocumentationFolder, writeForgeDocumentation } from './src/documentation/documentationPackage.ts';
import { normalizeForgeCustomBorders, normalizeForgeCustomThemes, type ForgeCustomBorder, type ForgeCustomTheme } from './src/templates/styleLibrary.ts';
import { createForgeStylePackage, downloadForgeStylePackage, MAX_FORGE_STYLE_PACKAGE_BYTES, parseForgeStylePackage } from './src/templates/stylePackage.ts';
import { StylePackageImportModal } from './src/views/StylePackageImportModal.ts';
import { readPersistedTemplateEditorDrafts, upsertPersistedTemplateEditorDrafts, removePersistedTemplateEditorDraft, type PersistedTemplateEditorDraft } from './src/templates/templateEditorDraftStorage.ts';
import type { ClosedTemplateEditorDraft } from './src/views/closedTemplateEditorDraft.ts';
import {
  createEmptyForgeTokenLinkStore,
  removeForgeAssetTokenLink as applyRemoveForgeAssetTokenLink,
  removeForgeTokenInstanceOverride as applyRemoveForgeTokenInstanceOverride,
  resolveForgeTokenLink,
  setForgeAssetTokenLink as applySetForgeAssetTokenLink,
  setForgeTokenInstanceOverride as applySetForgeTokenInstanceOverride,
  type ForgeTokenLinkIdentity,
  type ForgeTokenLinkResolution,
  type ForgeTokenLinkStore,
  type ForgeTokenLinkStoreParseResult,
  type ForgeTokenLinkTarget,
} from './src/atlas/forgeTokenLinkModel';
import {
  cloneForgeTokenLinksForPersistence,
  FORGE_TOKEN_LINKS_DATA_KEY,
  readPersistedForgeTokenLinks,
} from './src/atlas/forgeTokenLinkStorage';

export interface StatblockForgeSettings {
  templateFolder: string;
  statblockFolder: string;
  documentationFolder: string;
  language: ForgeLanguage;
  /** Reusable visual themes shared by Forge templates. */
  customThemes: ForgeCustomTheme[];
  /** Reusable outer frames shared by Forge templates. */
  customBorders: ForgeCustomBorder[];
  /** Whether to display alignment guides in the template Canvas. */
  showCanvasGrid: boolean;
  /** Keyboard shortcut for toggling Statblock Mode while the Forge editor is active. */
  toggleStatblockModeShortcut: string;
}

const DEFAULT_SETTINGS: StatblockForgeSettings = {
  templateFolder: 'atlas-vtt/statblock-templates',
  statblockFolder: 'atlas-vtt/statblocks',
  documentationFolder: DEFAULT_DOCUMENTATION_FOLDER,
  language: 'en',
  customThemes: [],
  customBorders: [],
  showCanvasGrid: true,
  toggleStatblockModeShortcut: DEFAULT_TOGGLE_STATBLOCK_MODE_SHORTCUT,
};

export default class StatblockForgePlugin extends Plugin {
  settings: StatblockForgeSettings = { ...DEFAULT_SETTINGS };
  private statblockNotePanels: StatblockNotePanels | null = null;
  private editorRecoveryDrafts: PersistedTemplateEditorDraft[] = [];
  private forgeTokenLinkStore: ForgeTokenLinkStore | null = createEmptyForgeTokenLinkStore();
  private forgeTokenLinkStoreStatus: ForgeTokenLinkStoreParseResult['status'] = 'empty';
  private forgeTokenLinkStoreIssues: string[] = [];
  private persistedForgeTokenLinksRaw: unknown = undefined;
  private hasPersistedForgeTokenLinks = false;
  private forgeTokenLinkStoreDirty = false;
  private dataWriteQueue: Promise<void> = Promise.resolve();
  private readonly promptedEditorRecoveryDrafts = new Set<string>();
  private editorRecoveryPromptOpen = false;

  async onload(): Promise<void> {
    const storedData = await this.loadData() as (Partial<StatblockForgeSettings> & { editorDrafts?: unknown; forgeTokenLinks?: unknown }) | null;
    const { editorDrafts, forgeTokenLinks: storedForgeTokenLinks, ...storedSettings } = storedData ?? {};
    this.editorRecoveryDrafts = readPersistedTemplateEditorDrafts(editorDrafts);
    this.hasPersistedForgeTokenLinks = Object.prototype.hasOwnProperty.call(storedData ?? {}, FORGE_TOKEN_LINKS_DATA_KEY);
    this.persistedForgeTokenLinksRaw = storedForgeTokenLinks;
    const tokenLinkLoad = readPersistedForgeTokenLinks(storedForgeTokenLinks);
    this.forgeTokenLinkStore = tokenLinkLoad.data;
    this.forgeTokenLinkStoreStatus = tokenLinkLoad.status;
    this.forgeTokenLinkStoreIssues = [...tokenLinkLoad.issues];
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...storedSettings,
      templateFolder: normalizeTemplateFolder(storedSettings.templateFolder ?? DEFAULT_SETTINGS.templateFolder),
      statblockFolder: normalizeTemplateFolder(storedSettings.statblockFolder ?? DEFAULT_SETTINGS.statblockFolder),
      documentationFolder: normalizeDocumentationFolder(storedSettings.documentationFolder ?? DEFAULT_SETTINGS.documentationFolder),
      language: normalizeForgeLanguage(storedSettings.language),
      customThemes: normalizeForgeCustomThemes(storedSettings.customThemes),
      customBorders: normalizeForgeCustomBorders(storedSettings.customBorders),
      showCanvasGrid: storedSettings.showCanvasGrid !== false,
      toggleStatblockModeShortcut: normalizeForgeShortcut(storedSettings.toggleStatblockModeShortcut),
    };

    // The Atlas fork owns map scenes and the hover-preview lifecycle. Forge supplies its
    // renderer through Atlas' public sheet-provider API, so Ctrl-hover can display the
    // exact Forge statblock instead of the Atlas-native fallback. Retry at layout-ready
    // because Obsidian may load this plugin before the Atlas fork.
    let unregisterAtlasProvider: (() => void) | null = null;
    const tryRegisterAtlasProvider = (): void => {
      if (unregisterAtlasProvider) return;
      unregisterAtlasProvider = registerForgeAtlasSheetProvider(this.app, this);
      if (unregisterAtlasProvider) this.register(() => {
        unregisterAtlasProvider?.();
        unregisterAtlasProvider = null;
      });
    };
    tryRegisterAtlasProvider();
    this.app.workspace.onLayoutReady(tryRegisterAtlasProvider);

    this.registerView(STATBLOCK_FORGE_EDITOR_VIEW, (leaf) => new TemplateEditorView(leaf, this));
    this.registerExtensions([FORGE_TEMPLATE_EXTENSION], STATBLOCK_FORGE_EDITOR_VIEW);
    this.registerView(STATBLOCK_FORGE_RENDER_VIEW, (leaf) => new StatblockRenderView(leaf, this));
    this.statblockNotePanels = new StatblockNotePanels(this.app, this);
    this.statblockNotePanels.start();
    this.register(() => { void this.statblockNotePanels?.stop(); this.statblockNotePanels = null; });
    this.addCommand({
      id: 'new-forge-template',
      name: this.uiLabel('Create new Forge template', 'Criar novo template Forge'),
      callback: () => { void this.openTemplateEditor(null); },
    });
    this.addCommand({
      id: 'toggle-statblock-mode',
      name: this.uiLabel('Toggle Statblock mode', 'Alternar Modo statblock'),
      checkCallback: (checking) => {
        const activeView = this.app.workspace.getActiveViewOfType(TemplateEditorView);
        if (!(activeView instanceof TemplateEditorView)) return false;
        if (!checking) activeView.toggleStatblockMode();
        return true;
      },
    });
    this.addCommand({
      id: 'recover-unsaved-forge-template-drafts',
      name: this.uiLabel('Recover unsaved Forge template drafts', 'Recuperar rascunhos não salvos de templates Forge'),
      callback: () => this.promptForNextEditorRecoveryDraft(true),
    });
    this.addCommand({
      id: 'open-forge-template',
      name: this.uiLabel('Open template in Forge…', 'Abrir template no Forge…'),
      callback: () => {
        new ForgeTemplatePickerModal(
          this.app,
          (file) => { void this.openTemplateEditor(file); },
          normalizeForgeLanguage(this.settings.language),
        ).open();
      },
    });
    this.addCommand({
      id: 'create-statblock-from-template',
      name: this.uiLabel('Create statblock from Forge template…', 'Criar statblock a partir de template Forge…'),
      callback: () => {
        new ForgeTemplatePickerModal(
          this.app,
          (file) => { void this.promptCreateStatblockFromTemplate(file); },
          normalizeForgeLanguage(this.settings.language),
          true,
        ).open();
      },
    });
    this.addCommand({
      id: 'delete-forge-template',
      name: this.uiLabel('Delete template…', 'Excluir template…'),
      callback: () => {
        new ForgeTemplatePickerModal(
          this.app,
          (file) => this.confirmDeleteTemplate(file),
          normalizeForgeLanguage(this.settings.language),
        ).open();
      },
    });
    this.addCommand({
      id: 'render-current-statblock',
      name: this.uiLabel('Render current note with a Forge template', 'Visualizar nota atual com um template Forge'),
      callback: () => this.renderCurrentNote(),
    });
    this.registerDomEvent(document, 'keydown', (event: KeyboardEvent) => {
      const activeView = this.app.workspace.getActiveViewOfType(TemplateEditorView);
      if (!(activeView instanceof TemplateEditorView) || event.defaultPrevented || event.isComposing || event.repeat) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || !!target.closest('input, textarea, select, [contenteditable="true"], .cm-editor'))) return;
      if (!matchesForgeShortcut(event, this.settings.toggleStatblockModeShortcut, Platform.isMacOS)) return;
      event.preventDefault();
      event.stopPropagation();
      activeView.toggleStatblockMode();
    });
    this.addSettingTab(new ForgeSettingTab(this.app, this));

    const refreshIfOpen = (file: { path?: string }): void => this.refreshOpenViews(file.path);
    this.registerEvent(this.app.vault.on('create', refreshIfOpen));
    this.registerEvent(this.app.vault.on('modify', refreshIfOpen));
    this.registerEvent(this.app.vault.on('delete', refreshIfOpen));
    this.registerEvent(this.app.vault.on('rename', refreshIfOpen));
    // Register after the initial plugin/layout setup so folder actions are
    // appended after handlers that Atlas registered during its onload phase.
    // This uses only Obsidian's public file-menu event and Menu.addItem API.
    let fileMenuRegistrationActive = true;
    this.register(() => { fileMenuRegistrationActive = false; });
    this.app.workspace.onLayoutReady(() => {
      if (!fileMenuRegistrationActive) return;
      this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
        if (file instanceof TFolder) {
          menu.addItem((item) => item
            .setTitle(this.uiLabel('Add Forge statblock here', 'Adicionar statblock Forge aqui'))
            .setIcon('file-plus')
            .onClick(() => this.openForgeTemplatePickerForFolder(file)));
          return;
        }
        if (!(file instanceof TFile) || file.extension.toLowerCase() !== 'md') return;
        const tokenAssessment = assessAtlasTokenCreation(this.app, file);
        if (tokenAssessment.status === 'ready') {
          menu.addItem((item) => item
            .setTitle(this.uiLabel('Create Atlas token from this statblock', 'Criar token Atlas a partir deste statblock'))
            .setIcon('user-round-plus')
            .onClick(() => { void this.createAtlasTokenFromStatblock(file); }));
        }
        if (!readForgeTemplateLink(this.app, file)) return;
        menu.addItem((item) => item
          .setTitle(this.uiLabel('Render statblock with Forge', 'Visualizar statblock com Forge'))
          .setIcon('scroll-text')
          .onClick(() => { void this.openLinkedForgeStatblock(file); }));
        menu.addItem((item) => item
          .setTitle(this.uiLabel('Edit linked Forge template', 'Editar template Forge vinculado'))
          .setIcon('layout-template')
          .onClick(() => { void this.openLinkedForgeTemplate(file); }));
      }));
    });

    this.addCommand({
      id: 'edit-linked-forge-template',
      name: this.uiLabel('Edit Forge template linked to current statblock note', 'Editar template Forge vinculado à nota atual'),
      callback: () => this.editLinkedForgeTemplateForCurrentNote(),
    });

    this.addCommand({
      id: 'create-atlas-token-from-current-statblock',
      name: this.uiLabel('Create Atlas token from current Forge statblock note', 'Criar token Atlas a partir da nota atual'),
      checkCallback: (checking) => {
        const active = this.app.workspace.getActiveFile();
        if (!(active instanceof TFile)) return false;
        const assessment = assessAtlasTokenCreation(this.app, active);
        if (assessment.status !== 'ready') return false;
        if (!checking) void this.createAtlasTokenFromStatblock(active);
        return true;
      },
    });

    const ribbonButton = this.addRibbonIcon(
      'layout-template',
      this.uiLabel('Statblock Forge', 'Statblock Forge'),
      (event) => this.openRibbonMenu(event),
    );
    ribbonButton.setAttribute('aria-label', this.uiLabel('Statblock Forge actions', 'Ações do Statblock Forge'));
    ribbonButton.addClass('statblock-forge-ribbon-icon');

    this.app.workspace.onLayoutReady(() => {
      window.setTimeout(() => this.promptForNextEditorRecoveryDraft(false), 250);
    });

  }

  private showNotice(message: string, duration?: number): void {
    const language = normalizeForgeLanguage(this.settings.language);
    new Notice(translateForgeText(message, language), duration);
  }

  private uiLabel(en: string, pt: string): string {
    return normalizeForgeLanguage(this.settings.language) === 'pt-BR' ? pt : en;
  }

  private renderCurrentNote(): void {
    const source = this.app.workspace.getActiveFile();
    if (!(source instanceof TFile) || !['md', 'json'].includes(source.extension.toLowerCase())) {
      this.showNotice('Abra uma nota Markdown ou um arquivo JSON antes de renderizar.');
      return;
    }
    this.chooseTemplateForSource(source);
  }

  private editLinkedForgeTemplateForCurrentNote(): void {
    const active = this.app.workspace.getActiveFile();
    if (!(active instanceof TFile) || active.extension.toLowerCase() !== 'md') {
      this.showNotice('Abra uma nota Markdown publicada pelo Forge/Atlas primeiro.');
      return;
    }
    void this.openLinkedForgeTemplate(active);
  }

  private openRibbonMenu(event: MouseEvent): void {
    const menu = new Menu();
    menu.addItem((item) => item
      .setTitle(this.uiLabel('Create new template', 'Criar novo template'))
      .setIcon('file-plus')
      .onClick(() => { void this.openTemplateEditor(null); }));
    menu.addItem((item) => item
      .setTitle(this.uiLabel('Open template', 'Abrir template'))
      .setIcon('folder-open')
      .onClick(() => {
        new ForgeTemplatePickerModal(
          this.app,
          (file) => { void this.openTemplateEditor(file); },
          normalizeForgeLanguage(this.settings.language),
        ).open();
      }));
    menu.addItem((item) => item
      .setTitle(this.uiLabel('Create statblock', 'Criar statblock'))
      .setIcon('scroll-text')
      .onClick(() => {
        new ForgeTemplatePickerModal(
          this.app,
          (file) => { void this.promptCreateStatblockFromTemplate(file); },
          normalizeForgeLanguage(this.settings.language),
          true,
        ).open();
      }));

    const active = this.app.workspace.getActiveFile();
    if (active instanceof TFile && ['md', 'json'].includes(active.extension.toLowerCase())) {
      menu.addSeparator();
      menu.addItem((item) => item
        .setTitle(this.uiLabel('Render current note', 'Visualizar nota atual'))
        .setIcon('eye')
        .onClick(() => this.renderCurrentNote()));
    }
    if (active instanceof TFile && active.extension.toLowerCase() === 'md' && readForgeTemplateLink(this.app, active)) {
      menu.addItem((item) => item
        .setTitle(this.uiLabel('Edit linked template', 'Editar template vinculado'))
        .setIcon('layout-template')
        .onClick(() => this.editLinkedForgeTemplateForCurrentNote()));
    }
    if (active instanceof TFile && active.extension.toLowerCase() === 'md'
      && assessAtlasTokenCreation(this.app, active).status === 'ready') {
      menu.addItem((item) => item
        .setTitle(this.uiLabel('Create Atlas token', 'Criar token Atlas'))
        .setIcon('user-round-plus')
        .onClick(() => { void this.createAtlasTokenFromStatblock(active); }));
    }
    menu.showAtMouseEvent(event);
  }

  private confirmDeleteTemplate(file: TFile): void {
    new TemplateDeletionModal(
      this.app,
      file,
      normalizeForgeLanguage(this.settings.language),
      (path) => this.showNotice(`${this.uiLabel('Template moved to trash:', 'Template movido para a lixeira:')} ${path}`),
      (message) => this.showNotice(`${this.uiLabel('Could not delete template:', 'Não foi possível excluir o template:')} ${message}`, 10000),
    ).open();
  }

  private openForgeTemplatePickerForFolder(folder: TFolder): void {
    const forgeTemplates = this.app.vault.getFiles().filter((file) => file.extension.toLowerCase() === FORGE_TEMPLATE_EXTENSION);
    if (forgeTemplates.length === 0) {
      this.showNotice('Nenhum template .forgetemplate foi encontrado. Crie primeiro um template Forge pela Paleta de Comando.');
      return;
    }
    new ForgeTemplatePickerModal(
      this.app,
      (file) => {
        const currentFolder = folder.path
          ? this.app.vault.getAbstractFileByPath(folder.path)
          : this.app.vault.getRoot();
        if (!(currentFolder instanceof TFolder)) {
          this.showNotice('A pasta selecionada não existe mais no Vault.');
          return;
        }
        void this.promptCreateStatblockFromTemplate(file, currentFolder);
      },
      normalizeForgeLanguage(this.settings.language),
      true,
    ).open();
  }

  async promptCreateStatblockFromTemplate(file: TFile, destinationFolder?: TFolder): Promise<void> {
    if (file.extension.toLowerCase() !== 'forgetemplate') {
      this.showNotice('A criação direta de statblocks está disponível para arquivos .forgetemplate.');
      return;
    }
    try {
      const currentFile = this.app.vault.getAbstractFileByPath(file.path);
      if (!(currentFile instanceof TFile) || currentFile.extension.toLowerCase() !== 'forgetemplate') {
        throw new Error('O arquivo .forgetemplate selecionado não existe mais no Vault.');
      }
      // Parsing here validates the source before the creation modal is shown.
      await this.app.vault.cachedRead(currentFile).then((text) => parseTemplateFileText(text, currentFile.extension));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.showNotice(`${this.uiLabel('Could not prepare statblock creation:', 'Não foi possível preparar a criação do statblock:')} ${message}`, 10000);
      return;
    }
    new StatblockCreationModal(
      this.app,
      file.basename,
      normalizeForgeLanguage(this.settings.language),
      (name, useSampleValues) => this.createStatblockFromTemplate(file, name, useSampleValues, destinationFolder),
      destinationFolder?.path ?? (destinationFolder ? '' : undefined),
    ).open();
  }

  async createStatblockFromTemplate(file: TFile, name: string, useSampleValues = false, destinationFolder?: TFolder): Promise<void> {
    try {
      let targetFolderPath = this.settings.statblockFolder;
      if (destinationFolder) {
        const currentFolder = destinationFolder.path
          ? this.app.vault.getAbstractFileByPath(destinationFolder.path)
          : this.app.vault.getRoot();
        if (currentFolder !== destinationFolder) throw new Error('A pasta selecionada não existe mais no Vault.');
        targetFolderPath = destinationFolder.path;
      }
      const currentFile = this.app.vault.getAbstractFileByPath(file.path);
      if (!(currentFile instanceof TFile) || currentFile.extension.toLowerCase() !== 'forgetemplate') {
        throw new Error('O arquivo .forgetemplate selecionado não existe mais no Vault.');
      }
      const parsed = parseTemplateFileText(await this.app.vault.cachedRead(currentFile), currentFile.extension);
      const template = parsed.template;
      const data = createInitialStatblockData(template, name, useSampleValues, parsed.layout);
      const result = await createForgeStatblockNoteFromTemplate({
        app: this.app,
        template,
        data,
        statblockFolder: targetFolderPath,
        fallbackName: name,
        templateSourcePath: currentFile.path,
      });

      // The Markdown note owns the YAML; the editable statblock is attached
      // beside it inside the same MarkdownView, matching Atlas' note-panel flow.
      await openForgeStatblockNoteForEditing(this.app, result.statblockFile, {
        openForgeEditor: () => this.openStatblockView(result.statblockFile, currentFile, data, { focusFirstEmpty: true }),
      });

      this.showNotice(
        `${this.uiLabel('Forge statblock created:', 'Statblock Forge criado:')} ${result.statblockFile.path}. `
        + `${this.uiLabel('The YAML note and editable statblock are open together in the same tab.', 'A nota YAML e o statblock editável estão abertos juntos na mesma aba.')} `
        + `${this.uiLabel('The original .forgetemplate remains the source of layout, formulas and appearance.', 'O .forgetemplate original continua sendo a fonte do layout, das fórmulas e da aparência.')}`,
        12000,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.showNotice(`${this.uiLabel('Could not create statblock:', 'Não foi possível criar o statblock:')} ${message}`, 10000);
      throw error;
    }
  }

  private async createForgeCopyFromAtlas(
    source: TFile,
    overwrite?: TemplateOverwriteConfirmation,
  ): Promise<TFile> {
    const currentSource = this.app.vault.getAbstractFileByPath(source.path);
    if (!(currentSource instanceof TFile) || currentSource.extension.toLowerCase() !== 'atlastemplate') {
      throw new Error('O template Atlas de origem não existe mais no Vault.');
    }
    const parsed = parseTemplateFileText(await this.app.vault.cachedRead(currentSource), currentSource.extension);
    const copied = await saveTemplateDocument({
      storage: createTemplateVaultStorage(this.app),
      templateFolder: this.settings.templateFolder,
      name: currentSource.basename,
      template: parsed.template,
      layout: parsed.layout ?? createForgeLayout(parsed.template),
      saveAsCopy: true,
      ...(overwrite ? {
        overwriteExistingPath: overwrite.overwriteExistingPath,
        expectedOverwriteText: overwrite.expectedOverwriteText,
      } : {}),
    });
    const copiedFile = this.app.vault.getAbstractFileByPath(copied.file.path);
    if (!(copiedFile instanceof TFile)) throw new Error('A cópia Forge não foi encontrada no Vault.');
    this.showNotice(copied.overwrittenExisting
      ? `${this.uiLabel('Template replaced:', 'Template substituído:')} ${copiedFile.path}. Backup: ${copied.backupPath ?? 'indisponível'}`
      : `${this.uiLabel('Created Forge copy:', 'Cópia Forge criada:')} ${copiedFile.path}`);
    return copiedFile;
  }

  async openTemplateEditor(file: TFile | null): Promise<void> {
    if (!file) {
      try {
        const leaf = this.app.workspace.getLeaf('tab');
        if (!leaf) throw new Error('Não foi possível abrir uma aba para o template.');

        // TemplateEditorView explicitly supports a file-less state, matching
        // Atlas's own TemplateEditorView implementation. A new template is a
        // true in-memory draft; no placeholder .forgetemplate is written to Vault.
        await leaf.setViewState({
          type: STATBLOCK_FORGE_EDITOR_VIEW,
          state: {},
          active: true,
        });
        await leaf.loadIfDeferred();
        if (!(leaf.view instanceof TemplateEditorView)) {
          throw new Error(`A visualização registrada não foi carregada (view: ${leaf.view?.getViewType?.() ?? 'indisponível'}).`);
        }
        await leaf.view.loadTemplate(null);
        this.app.workspace.setActiveLeaf(leaf, { focus: true });
        await this.app.workspace.revealLeaf(leaf);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.showNotice(`${this.uiLabel('Could not create a new template draft:', 'Não foi possível abrir um rascunho de template:')} ${message}`, 10000);
      }
      return;
    }

    let target = file;
    if (target.extension.toLowerCase() === 'atlastemplate') {
      const atlasSource = target;
      try {
        target = await this.createForgeCopyFromAtlas(atlasSource);
      } catch (error) {
        if (error instanceof TemplateNameConflictError) {
          new TemplateOverwriteModal(
            this.app,
            error,
            normalizeForgeLanguage(this.settings.language),
            (confirmation) => {
              if (!confirmation) return;
              void this.createForgeCopyFromAtlas(atlasSource, confirmation)
                .then((copiedFile) => this.openTemplateEditor(copiedFile))
                .catch((overwriteError: unknown) => {
                  const message = overwriteError instanceof Error ? overwriteError.message : String(overwriteError);
                  this.showNotice(`${this.uiLabel('Could not import Atlas template:', 'Não foi possível importar o template Atlas:')} ${message}`, 10000);
                });
            },
          ).open();
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        this.showNotice(`${this.uiLabel('Could not import Atlas template:', 'Não foi possível importar o template Atlas:')} ${message}`, 10000);
        return;
      }
    }
    if (target.extension.toLowerCase() !== FORGE_TEMPLATE_EXTENSION) {
      this.showNotice(this.uiLabel('Open a `.forgetemplate` file to edit a Forge template.', 'Abra um arquivo `.forgetemplate` para editar um template Forge.'));
      return;
    }

    const existing = this.app.workspace.getLeavesOfType(STATBLOCK_FORGE_EDITOR_VIEW).find((candidate) =>
      candidate.view instanceof TemplateEditorView && candidate.view.getLoadedFilePath() === target?.path);
    if (existing) {
      await this.app.workspace.revealLeaf(existing);
      this.app.workspace.setActiveLeaf(existing, { focus: true });
      return;
    }

    const leaf = this.app.workspace.getLeaf('tab');
    if (!leaf) {
      this.showNotice('Statblock Forge: could not open a template tab.');
      return;
    }
    await leaf.openFile(target, { active: true });
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  async openLinkedForgeStatblock(source: TFile): Promise<void> {
    const resolution = await resolveForgeTemplateForNote(this.app, source);
    if (resolution.status === 'invalid') {
      this.showNotice('Esta nota não possui um vínculo válido com um template .forgetemplate.');
      return;
    }
    if (resolution.status === 'missing') {
      this.showNotice(`O template Forge vinculado não foi encontrado: ${resolution.link.templatePath}.`);
      return;
    }
    if (resolution.status === 'ambiguous') {
      this.showNotice(`Há mais de um .forgetemplate com o ID ${resolution.link.templateId}. Corrija a duplicação antes de renderizar.`);
      return;
    }
    if (resolution.pathWasMoved) {
      await this.repairMovedForgeTemplatePath(source, resolution.file, resolution.link.templatePath);
    }
    await this.openStatblockView(source, resolution.file);
  }

  async openLinkedForgeTemplate(note: TFile): Promise<void> {
    const resolution = await resolveForgeTemplateForNote(this.app, note);
    if (resolution.status === 'invalid') {
      this.showNotice('Esta nota não possui um vínculo válido com um template .forgetemplate.');
      return;
    }
    if (resolution.status === 'missing') {
      this.showNotice(`O template Forge vinculado não foi encontrado: ${resolution.link.templatePath}.`);
      return;
    }
    if (resolution.status === 'ambiguous') {
      this.showNotice(`Há mais de um .forgetemplate com o ID ${resolution.link.templateId}. Corrija a duplicação antes de editar.`);
      return;
    }
    if (resolution.pathWasMoved) {
      await this.repairMovedForgeTemplatePath(note, resolution.file, resolution.link.templatePath);
    }
    await this.openTemplateEditor(resolution.file);
  }

  private async repairMovedForgeTemplatePath(note: TFile, template: TFile, previousPath: string): Promise<void> {
    try {
      await this.app.fileManager.processFrontMatter(note, (frontmatter: unknown) => {
        if (!isRecord(frontmatter)) {
          throw new Error('O frontmatter YAML não contém um objeto válido.');
        }
        refreshForgeStatblockTemplateLinkPath(frontmatter, template.path);
      });
      this.showNotice(`O template foi encontrado em ${template.path}; a referência YAML foi atualizada (antes: ${previousPath}).`);
    } catch {
      this.showNotice(`O template foi encontrado em ${template.path}, mas não foi possível atualizar automaticamente o caminho no YAML.`);
    }
  }

  async createAtlasTokenFromStatblock(note: TFile, fallbackValues: Record<string, unknown> = {}): Promise<void> {
    const assessment = assessAtlasTokenCreation(this.app, note, fallbackValues, true);
    if (assessment.status !== 'ready') {
      this.showNotice(assessment.message, 9000);
      return;
    }

    const leaf = this.app.workspace.getLeaf(false);
    if (!leaf) {
      this.showNotice('Não foi possível abrir a nota do statblock para o Atlas.');
      return;
    }
    await leaf.openFile(note);
    await this.app.workspace.revealLeaf(leaf);

    // Opening the note makes it the active context required by Atlas' documented command.
    const openedAssessment = assessAtlasTokenCreation(this.app, note, fallbackValues, true);
    if (openedAssessment.status !== 'ready') {
      this.showNotice(openedAssessment.message, 9000);
      return;
    }

    if (openedAssessment.commandAccess === 'direct') {
      const dispatch = dispatchAtlasCreateTokenCommand(this.app);
      if (dispatch.status === 'dispatched') {
        this.showNotice('Comando do Atlas acionado. O Atlas está preparando o token e fará o vínculo com esta nota; confira o resultado no Gerenciador de Recursos.', 10000);
        return;
      }
      if (dispatch.status === 'failed') {
        this.showNotice(`Não foi possível acionar o comando do Atlas: ${dispatch.message}. Com a nota aberta, execute “Atlas VTT: Create token from statblock image” na paleta de comandos.`, 12000);
        return;
      }
      if (dispatch.status === 'rejected') {
        this.showNotice('O Atlas não aceitou o comando para esta nota. Confira se o frontmatter já foi atualizado e tente novamente pela paleta de comandos.', 12000);
        return;
      }
    }

    this.showNotice('A nota está aberta. Execute “Atlas VTT: Create token from statblock image” na paleta de comandos do Obsidian para criar e vincular o token.', 12000);
  }

  async openStatblockView(
    source: TFile,
    template: TFile,
    initialData?: Record<string, unknown>,
    options: { focusFirstEmpty?: boolean } = {},
  ): Promise<void> {
    // Markdown statblocks keep their YAML note as the owning tab. The editable
    // Forge surface is injected beside that note, as Atlas does; JSON sources
    // retain the standalone Forge view because they have no Markdown frontmatter.
    if (source.extension.toLowerCase() === 'md') {
      const existing = this.app.workspace.getLeavesOfType('markdown').find((candidate) =>
        candidate.view instanceof MarkdownView && candidate.view.file?.path === source.path);
      const leaf = existing ?? this.app.workspace.getLeaf('tab');
      if (!leaf) {
        this.showNotice('Statblock Forge: não foi possível abrir a nota do statblock.');
        return;
      }
      if (!(leaf.view instanceof MarkdownView && leaf.view.file?.path === source.path)) {
        await leaf.openFile(source, { active: true });
      }
      await leaf.loadIfDeferred();
      this.app.workspace.setActiveLeaf(leaf, { focus: true });
      const revealed = await this.statblockNotePanels?.reveal(leaf, source, template, initialData, options) ?? false;
      if (!revealed) {
        this.showNotice('Statblock Forge: não foi possível anexar a ficha à aba Markdown.');
        return;
      }
      await this.app.workspace.revealLeaf(leaf);
      return;
    }

    const existing = this.app.workspace.getLeavesOfType(STATBLOCK_FORGE_RENDER_VIEW).find((candidate) =>
      candidate.view instanceof StatblockRenderView && candidate.view.matchesStatblock(source.path, template.path));
    const leaf = existing ?? this.app.workspace.getLeaf('tab');
    if (!leaf) {
      this.showNotice('Statblock Forge: não foi possível abrir uma aba para o statblock.');
      return;
    }
    await leaf.setViewState({
      type: STATBLOCK_FORGE_RENDER_VIEW,
      state: { sourcePath: source.path, templatePath: template.path },
      active: true,
    });
    if (leaf.view instanceof StatblockRenderView) await leaf.view.loadStatblock(source, template, initialData, options);
    await this.app.workspace.revealLeaf(leaf);
  }

  /** Write the bundled documentation into the Vault only after an explicit settings action. */
  async downloadDocumentation(): Promise<void> {
    try {
      const language = normalizeForgeLanguage(this.settings.language);
      const destination = documentationFolderForLanguage(this.settings.documentationFolder, language);
      const result = await writeForgeDocumentation(this.app.vault, destination, language);
      this.settings.documentationFolder = result.folder;
      await this.saveSettings();
      const message = normalizeForgeLanguage(this.settings.language) === 'pt-BR'
        ? `Documentação salva em ${result.folder}: ${result.created} notas criadas; ${result.preserved} notas existentes preservadas.`
        : `Documentation saved to ${result.folder}: ${result.created} notes created; ${result.preserved} existing notes preserved.`;
      this.showNotice(message, 8000);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.showNotice(`${this.uiLabel('Could not download documentation:', 'Não foi possível baixar a documentação:')} ${detail}`, 10000);
    }
  }

  exportStylePackage(name: string, themes: readonly ForgeCustomTheme[], borders: readonly ForgeCustomBorder[]): void {
    try {
      const stylePackage = createForgeStylePackage(name, themes, borders);
      downloadForgeStylePackage(stylePackage, name);
      this.showNotice(this.uiLabel('Style package export started.', 'A exportação do pacote de estilos foi iniciada.'));
    } catch (error) {
      this.showNotice(`${this.uiLabel('Could not export style package:', 'Não foi possível exportar o pacote de estilos:')} ${error instanceof Error ? error.message : String(error)}`, 8000);
    }
  }

  importStyleFile(file: File): void {
    if (file.size > MAX_FORGE_STYLE_PACKAGE_BYTES) {
      this.showNotice('The .forgestyle file is too large. Maximum size is 512 KB.', 8000);
      return;
    }
    if (!file.name.toLowerCase().endsWith('.forgestyle') && file.type !== 'application/json') {
      this.showNotice('Choose a .forgestyle file.');
      return;
    }
    void file.text().then((contents) => {
      // parseForgeStylePackage accepts allowlisted JSON data only. No imported
      // script, markup, CSS, URL, or executable expression reaches the UI/runtime.
      const stylePackage = parseForgeStylePackage(contents);
      new StylePackageImportModal(
        this.app,
        stylePackage,
        this.settings.customThemes,
        this.settings.customBorders,
        normalizeForgeLanguage(this.settings.language),
        (result) => {
          this.settings.customThemes = result.themes;
          this.settings.customBorders = result.borders;
          void this.saveSettings().then(() => {
            this.refreshOpenViews();
            const summary = normalizeForgeLanguage(this.settings.language) === 'pt-BR'
              ? `${result.addedThemes} tema(s) adicionado(s), ${result.replacedThemes} substituído(s), ${result.skippedThemes} ignorado(s); ${result.addedBorders} borda(s) adicionada(s), ${result.replacedBorders} substituída(s), ${result.skippedBorders} ignorada(s)`
              : `${result.addedThemes} theme(s) added, ${result.replacedThemes} replaced, ${result.skippedThemes} skipped; ${result.addedBorders} border(s) added, ${result.replacedBorders} replaced, ${result.skippedBorders} skipped`;
            this.showNotice(`${this.uiLabel('Style package imported', 'Pacote de estilos importado')}: ${summary}.`);
          }).catch((error: unknown) => {
            this.showNotice(`${this.uiLabel('Could not save imported styles:', 'Não foi possível salvar os estilos importados:')} ${error instanceof Error ? error.message : String(error)}`, 8000);
          });
        },
      ).open();
    }).catch((error: unknown) => {
      this.showNotice(`${this.uiLabel('Could not import style package:', 'Não foi possível importar o pacote de estilos:')} ${error instanceof Error ? error.message : String(error)}`, 8000);
    });
  }

  async saveSettings(): Promise<void> {
    await this.persistPluginData();
  }

  /** Returns a detached snapshot of all currently persisted Forge token links. */
  getForgeTokenLinkStore(): ForgeTokenLinkStore {
    return cloneForgeTokenLinksForPersistence(this.requireForgeTokenLinkStore());
  }

  /** Exposes parser health without leaking Atlas objects or mutable store references. */
  getForgeTokenLinkStorageDiagnostics(): {
    status: ForgeTokenLinkStoreParseResult['status'];
    issues: string[];
    assetLinkCount: number;
    instanceOverrideCount: number;
  } {
    return {
      status: this.forgeTokenLinkStoreStatus,
      issues: [...this.forgeTokenLinkStoreIssues],
      assetLinkCount: this.forgeTokenLinkStore ? Object.keys(this.forgeTokenLinkStore.assetLinks).length : 0,
      instanceOverrideCount: this.forgeTokenLinkStore ? Object.keys(this.forgeTokenLinkStore.instanceOverrides).length : 0,
    };
  }

  /** Resolves an instance override first, then its inherited Asset ID link. */
  resolveForgeTokenLink(identity: ForgeTokenLinkIdentity): ForgeTokenLinkResolution {
    const result = resolveForgeTokenLink(this.requireForgeTokenLinkStore(), identity);
    return result.status === 'linked'
      ? { ...result, link: { ...result.link } }
      : result;
  }

  /** Persists a shared Asset ID link using only Forge's own plugin data. */
  async setForgeAssetTokenLink(assetId: string, target: ForgeTokenLinkTarget): Promise<void> {
    const next = applySetForgeAssetTokenLink(this.requireForgeTokenLinkStore(), assetId, target);
    await this.persistUpdatedForgeTokenLinkStore(next);
  }

  /** Removes a shared Asset ID link. Instance-specific overrides are retained. */
  async removeForgeAssetTokenLink(assetId: string): Promise<void> {
    const next = applyRemoveForgeAssetTokenLink(this.requireForgeTokenLinkStore(), assetId);
    await this.persistUpdatedForgeTokenLinkStore(next);
  }

  /** Persists an instance-specific link or an explicit null opt-out. */
  async setForgeTokenInstanceOverride(
    mapPath: string,
    tokenId: string,
    target: ForgeTokenLinkTarget | null,
  ): Promise<void> {
    const next = applySetForgeTokenInstanceOverride(this.requireForgeTokenLinkStore(), mapPath, tokenId, target);
    await this.persistUpdatedForgeTokenLinkStore(next);
  }

  /** Removes an instance exception, restoring Asset ID inheritance. */
  async removeForgeTokenInstanceOverride(mapPath: string, tokenId: string): Promise<void> {
    const next = applyRemoveForgeTokenInstanceOverride(this.requireForgeTokenLinkStore(), mapPath, tokenId);
    await this.persistUpdatedForgeTokenLinkStore(next);
  }

  private requireForgeTokenLinkStore(): ForgeTokenLinkStore {
    if (this.forgeTokenLinkStore) return this.forgeTokenLinkStore;
    const detail = this.forgeTokenLinkStoreIssues.length > 0 ? ` ${this.forgeTokenLinkStoreIssues.join(' ')}` : '';
    throw new Error(`O armazenamento de vínculos do Forge está inválido ou usa uma versão mais recente; ele foi preservado sem alterações.${detail}`);
  }

  private async persistUpdatedForgeTokenLinkStore(next: ForgeTokenLinkStore): Promise<void> {
    this.forgeTokenLinkStore = next;
    this.forgeTokenLinkStoreDirty = true;
    await this.persistPluginData();
  }

  async persistTemplateEditorDraft(draft: ClosedTemplateEditorDraft): Promise<void> {
    this.editorRecoveryDrafts = upsertPersistedTemplateEditorDrafts(this.editorRecoveryDrafts, draft);
    await this.persistPluginData();
  }

  async discardTemplateEditorDraft(recoveryDraftId: string): Promise<void> {
    this.editorRecoveryDrafts = removePersistedTemplateEditorDraft(this.editorRecoveryDrafts, recoveryDraftId);
    await this.persistPluginData();
  }

  getPersistedTemplateEditorDrafts(): PersistedTemplateEditorDraft[] {
    return readPersistedTemplateEditorDrafts(this.editorRecoveryDrafts);
  }

  markEditorRecoveryDraftPrompted(recoveryDraftId: string): void {
    this.promptedEditorRecoveryDrafts.add(recoveryDraftId);
  }

  continueEditorDraftRecovery(): void {
    this.editorRecoveryPromptOpen = false;
    window.setTimeout(() => this.promptForNextEditorRecoveryDraft(false), 0);
  }

  private persistPluginData(): Promise<void> {
    // Build the snapshot inside the serialized queue. Settings, drafts and
    // token links therefore cannot overwrite one another with stale snapshots
    // when two save operations are requested close together.
    const write = this.dataWriteQueue.then(async () => {
      const snapshot: Record<string, unknown> = {
        ...this.settings,
        editorDrafts: this.editorRecoveryDrafts,
      };
      const currentStore = this.forgeTokenLinkStore;
      const shouldWriteTokenStore = currentStore !== null
        && (this.forgeTokenLinkStoreDirty || !this.hasPersistedForgeTokenLinks);
      if (shouldWriteTokenStore && currentStore) {
        snapshot[FORGE_TOKEN_LINKS_DATA_KEY] = cloneForgeTokenLinksForPersistence(currentStore);
      } else if (this.hasPersistedForgeTokenLinks) {
        // Preserve an existing value during unrelated settings/draft writes.
        // This includes recovered data and unknown future versions, which must
        // not be silently normalized or replaced without an explicit link edit.
        snapshot[FORGE_TOKEN_LINKS_DATA_KEY] = this.persistedForgeTokenLinksRaw;
      }

      await this.saveData(snapshot);
      if (shouldWriteTokenStore && currentStore) {
        this.persistedForgeTokenLinksRaw = snapshot[FORGE_TOKEN_LINKS_DATA_KEY];
        this.hasPersistedForgeTokenLinks = true;
        if (this.forgeTokenLinkStore === currentStore) {
          this.forgeTokenLinkStoreDirty = false;
          this.forgeTokenLinkStoreStatus = 'ready';
          this.forgeTokenLinkStoreIssues = [];
        }
      }
    });
    this.dataWriteQueue = write.catch(() => undefined);
    return write;
  }

  private promptForNextEditorRecoveryDraft(manual: boolean): void {
    if (this.editorRecoveryPromptOpen) return;
    const openIds = new Set(this.app.workspace.getLeavesOfType(STATBLOCK_FORGE_EDITOR_VIEW)
      .filter((leaf) => leaf.view instanceof TemplateEditorView)
      .map((leaf) => (leaf.view as TemplateEditorView).getRecoveryDraftId())
      .filter((id): id is string => Boolean(id)));
    const next = this.editorRecoveryDrafts.find((entry) =>
      !this.promptedEditorRecoveryDrafts.has(entry.draft.recoveryDraftId)
      && !openIds.has(entry.draft.recoveryDraftId));
    if (!next) {
      if (manual) this.showNotice(this.uiLabel('No unsaved template drafts were found.', 'Nenhum rascunho de template não salvo foi encontrado.'));
      return;
    }

    const draft = next.draft;
    this.promptedEditorRecoveryDrafts.add(draft.recoveryDraftId);
    this.editorRecoveryPromptOpen = true;
    const recover = async (openSaveDialog: boolean): Promise<void> => {
      try {
        await this.reopenPersistedTemplateEditorDraft(draft, openSaveDialog);
      } catch (error) {
        this.promptedEditorRecoveryDrafts.delete(draft.recoveryDraftId);
        this.editorRecoveryPromptOpen = false;
        throw error;
      }
      this.editorRecoveryPromptOpen = false;
      if (!openSaveDialog) window.setTimeout(() => this.promptForNextEditorRecoveryDraft(false), 0);
    };
    new UnsavedTemplateChangesModal(
      this.app,
      normalizeForgeLanguage(this.settings.language),
      draft.displayName,
      () => recover(true),
      () => recover(false),
      async () => {
        await this.discardTemplateEditorDraft(draft.recoveryDraftId);
        this.editorRecoveryPromptOpen = false;
        window.setTimeout(() => this.promptForNextEditorRecoveryDraft(false), 0);
      },
      true,
    ).open();
  }

  private async reopenPersistedTemplateEditorDraft(draft: ClosedTemplateEditorDraft, openSaveDialog: boolean): Promise<void> {
    const leaf = this.app.workspace.getLeaf('tab');
    if (!leaf) throw new Error('Não foi possível abrir uma aba para recuperar o rascunho.');
    const source = draft.filePath ? this.app.vault.getAbstractFileByPath(draft.filePath) : null;
    const sourceFile = source instanceof TFile ? source : null;
    await leaf.setViewState({
      type: STATBLOCK_FORGE_EDITOR_VIEW,
      state: sourceFile ? { file: sourceFile.path } : {},
      active: true,
    });
    await leaf.loadIfDeferred();
    if (!(leaf.view instanceof TemplateEditorView)) throw new Error('O editor de templates não ficou disponível.');
    await leaf.view.restorePersistedDraft(draft, openSaveDialog);
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  async refreshStatblocksUsingTemplate(templatePath: string): Promise<void> {
    await this.statblockNotePanels?.refreshTemplate(templatePath);
    const refreshes: Promise<void>[] = [];
    for (const leaf of this.app.workspace.getLeavesOfType(STATBLOCK_FORGE_RENDER_VIEW)) {
      if (leaf.view instanceof StatblockRenderView && leaf.view.matchesTemplatePath(templatePath)) {
        refreshes.push(leaf.view.refresh());
      }
    }
    await Promise.all(refreshes);
  }

  refreshOpenViews(changedPath?: string): void {
    this.statblockNotePanels?.refresh(changedPath);
    for (const leaf of this.app.workspace.getLeavesOfType(STATBLOCK_FORGE_EDITOR_VIEW)) {
      if (leaf.view instanceof TemplateEditorView) leaf.view.refreshForSettings();
    }
    for (const leaf of this.app.workspace.getLeavesOfType(STATBLOCK_FORGE_RENDER_VIEW)) {
      if (leaf.view instanceof StatblockRenderView) void leaf.view.refresh();
    }
  }
}
