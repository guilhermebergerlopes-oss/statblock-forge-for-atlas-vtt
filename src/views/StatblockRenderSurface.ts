import { Notice, TFile, type App } from 'obsidian';
import type StatblockForgePlugin from '../../main';
import { projectForgeStatblockDataForLegacyNote } from '../atlas/atlasTemplateAdapter.ts';
import { assessAtlasTokenCreation } from '../atlas/atlasTokenWorkflow.ts';
import {
  ATLAS_TOKEN_IMAGE_EXTENSIONS, assessForgeTokenAssetCreation, createForgeTokenAssetFromImage,
  forgeTokenAssetAssessmentMessage,
} from '../atlas/atlasForgeTokenAssetCreation.ts';
import {
  inspectSelectedAtlasTokenLinks, isForgeNativeV2StatblockNote, linkSelectedAtlasTokensToStatblock, unlinkSelectedAtlasTokensFromStatblock,
} from '../atlas/atlasTokenLinkAdapter.ts';
import { applyPinnedTemplateImages, isSupportedVaultImagePath, pinnedTemplateImageValue } from '../templates/imageFieldModel.ts';
import { isInternalTemplateField } from '../templates/fieldEditorModel.ts';
import { createForgeLayout, headerFieldForPart, isRecord, parseForgeLayout, type ForgeLayoutDocument, type ForgeTemplate, type JsonRecord } from '../templates/forgeTemplate.ts';
import { parseTemplateFileText } from '../templates/forgeFileFormat.ts';
import { createLoadedStatblockSource, loadStatblockSource, type LoadedStatblockSource } from '../statblocks/statblockDataSources.ts';
import { FORGE_STATBLOCK_SOURCE_DATA_CHANGED_EVENT, renderStatblock } from '../render/statblockPreviewRenderer.ts';
import { withTemplateImagePreviewFallback } from '../render/statblockRenderModel.ts';
import { resolveVaultImageResource } from '../render/vaultImageResolver.ts';
import { renderStatblockCardActionsMenu } from '../render/statblockCardActionsMenu.ts';
import { attachForgeStatblockDiceRolling } from '../render/statblockDiceLinks.ts';
import { openImageSocketActionsMenu, type ImageSocketMenuAction } from '../render/imageSocketActionsMenu.ts';
import { VaultImagePickerModal } from './StatblockFilePickers.ts';
import { localizeForgeElement, normalizeForgeLanguage, translateForgeText } from '../i18n/localization.ts';
import { parseStatblockFieldEditorValue, statblockFieldEditorInitialValue, statblockFieldEditorMode, type StatblockFieldEditorMode } from '../statblocks/statblockFieldEditorModel.ts';
import { recoveryButtonsOf, type RecoveryButton } from '../templates/recoveryEditorModel.ts';
import { openForgeRestChooser } from './ForgeRestChooser.ts';
import type { RestChoicePick } from '../statblocks/restChoiceSelectionModel.ts';
import { calculateRestCounters, restCounterSpendOptions } from '../statblocks/restRecoveryModel.ts';
import { restRequestValidationMessage, validateRestRequest } from '../statblocks/restRequestValidationModel.ts';
import { FORGE_RESOURCE_VALUES_KEY, forgeRestDataWithResources, forgeTrackedResourceForField } from '../statblocks/forgeResourceValues.ts';
import { loadForgeRestDiceSet, rollForgeRestFormula } from '../statblocks/restDiceRoller.ts';
import { rollForgeRestWithAtlasDiceTool } from '../statblocks/atlasRestDiceTool.ts';
import { runRestNotePersistenceWithAtlasRollback } from '../statblocks/restPersistenceTransaction.ts';
import {
  atlasRestResourceContextForNote, persistAtlasRestResourceChangesWithReceipt, rollbackAtlasRestResourceChanges,
  type AtlasRestResourceContext, type AtlasRestResourceRollbackReceipt,
} from '../atlas/atlasRestResources.ts';
import { RestResultModal, type ForgeRestResultAction, type ForgeRestResultSpend } from './RestResultModal.ts';
import { FORGE_STATBLOCK_IMAGE_FRAMES_KEY, readStatblockImageFrames, withStatblockImageFrame, type StatblockImageFrame, type StatblockImageFrames } from '../statblocks/statblockImageFraming.ts';
import { DEFAULT_FORGE_SHEET_WIDTH, FORGE_STATBLOCK_SHEET_WIDTH_KEY, MAX_FORGE_SHEET_WIDTH, MIN_FORGE_SHEET_WIDTH, STEP_FORGE_SHEET_WIDTH, resolveForgeSheetWidth, normalizeForgeSheetWidth } from '../templates/sheetWidth.ts';
import { routeStatblockWheel } from './statblockWheelNavigation.ts';
import { preserveUnchangedFieldCompendiumEntrySources } from '../statblocks/fieldCompendiumUsageModel.ts';
import { SourceMetadataRefreshGate } from './sourceMetadataRefreshGate.ts';

function atlasTokenLinkInspectionMessage(
  inspection: ReturnType<typeof inspectSelectedAtlasTokenLinks> | null,
  language: 'en' | 'pt-BR',
): string | undefined {
  if (!inspection) return undefined;
  const pt = language === 'pt-BR';
  switch (inspection.status) {
    case 'atlas-not-open': return pt ? 'Abra uma cena do Atlas para acessar os tokens.' : 'Open an Atlas scene to access its tokens.';
    case 'no-selection': return pt ? 'Selecione um ou mais tokens em uma cena do Atlas.' : 'Select one or more tokens in an Atlas scene.';
    case 'ambiguous-map': return pt ? 'Há seleções em mais de uma cena. Ative a cena desejada primeiro.' : 'More than one Atlas scene has a selection. Activate the intended scene first.';
    case 'no-token-image': return pt ? 'Os tokens selecionados não possuem uma imagem vinculável.' : 'The selected tokens do not have linkable artwork.';
    case 'link-service-unavailable': return pt ? 'O serviço de vínculos do Atlas ainda não está disponível.' : 'Atlas token linking is not available yet.';
    case 'invalid-statblock': return pt ? 'A nota atual não é um statblock válido do Forge.' : 'The current note is not a valid Forge statblock.';
    case 'ready': return undefined;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isRecord(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  return value;
}

function sameStoredValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

/** Reserved header Token-art keys supported by Forge templates, including legacy aliases. */
function isTokenArtFieldKey(fieldKey: string): boolean {
  return ['image', 'token-image', 'token'].includes(fieldKey);
}

/** Rest failures are transient UI feedback, never a permanent statblock status. */
const REST_ERROR_NOTICE_DURATION_MS = 6_000;

/** Shared editable statblock surface, usable in a standalone view or beside its Markdown note. */
export class StatblockRenderSurface {
  private sourcePath: string | null = null;
  private templatePath: string | null = null;
  private template: ForgeTemplate | null = null;
  private layout: ForgeLayoutDocument | null = null;
  private loadedSource: LoadedStatblockSource | null = null;
  private initialSourceData: JsonRecord | null = null;
  private initialSourceFormat: LoadedStatblockSource['format'] | null = null;
  private refreshSequence = 0;
  private counterSaveQueue: Promise<void> = Promise.resolve();
  private savingFieldEdits = false;
  private readonly sourceMetadataRefreshGate = new SourceMetadataRefreshGate();
  private imageFrames: StatblockImageFrames = {};
  private readonly expandedSectionIds = new Set<string>();
  private readonly collapsedSectionIds = new Set<string>();
  private expansionTemplateId: string | null = null;
  private focusFirstEmptyOnNextRender = false;
  private imageFrameSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingImageFrameSave: { source: LoadedStatblockSource; frames: StatblockImageFrames } | null = null;
  private imageSocketMenuClose: ((restoreFocus?: boolean) => void) | null = null;
  private restChooserClose: (() => void) | null = null;
  private diceLinkCleanup: (() => void) | null = null;

  constructor(
    private readonly app: App,
    private readonly plugin: StatblockForgePlugin,
    private readonly contentEl: HTMLElement,
  ) {
    // Give both the standalone ItemView and the embedded Markdown note panel
    // an explicit sizing context. Without a bounded flex host, a percentage-
    // height render surface can resolve to its content height and never
    // overflow vertically.
    this.contentEl.classList.add('statblock-forge__render-host');
  }

  async loadStatblock(
    source: TFile,
    templateFile: TFile,
    initialData?: JsonRecord,
    options: { focusFirstEmpty?: boolean } = {},
  ): Promise<void> {
    if (options.focusFirstEmpty === true) this.focusFirstEmptyOnNextRender = true;
    await this.loadPaths(source.path, templateFile.path, initialData);
  }

  async loadPaths(sourcePath: string, templatePath: string, initialData?: JsonRecord): Promise<void> {
    await this.flushImageFrameSave();
    this.sourcePath = sourcePath;
    this.templatePath = templatePath;
    this.initialSourceData = initialData ? { ...initialData } : null;
    const extension = sourcePath.split('.').pop()?.toLowerCase();
    this.initialSourceFormat = initialData ? (extension === 'json' ? 'json' : 'markdown-frontmatter') : null;
    await this.refresh();
  }

  /** Consume the metadata-cache event generated by this surface's own frontmatter write. */
  consumeExpectedSourceMetadataRefresh(path: string): boolean {
    return this.sourceMetadataRefreshGate.consume(path);
  }

  async dispose(): Promise<void> {
    await this.flushImageFrameSave();
    this.sourceMetadataRefreshGate.clear();
    this.imageSocketMenuClose?.(false);
    this.imageSocketMenuClose = null;
    this.restChooserClose?.();
    this.restChooserClose = null;
    this.diceLinkCleanup?.();
    this.diceLinkCleanup = null;
    this.refreshSequence += 1;
    this.contentEl.replaceChildren();
    this.contentEl.classList.remove('statblock-forge__render-host');
    this.loadedSource = null;
    this.initialSourceData = null;
    this.expandedSectionIds.clear();
    this.collapsedSectionIds.clear();
    this.expansionTemplateId = null;
    this.initialSourceFormat = null;
  }

  async refresh(): Promise<void> {
    await this.flushImageFrameSave();
    if (this.savingFieldEdits) return;
    const sequence = ++this.refreshSequence;
    if (!this.sourcePath || !this.templatePath) return;
    this.imageSocketMenuClose?.(false);
    this.imageSocketMenuClose = null;
    this.restChooserClose?.();
    this.restChooserClose = null;
    this.diceLinkCleanup?.();
    this.diceLinkCleanup = null;
    this.contentEl.replaceChildren();

    try {
      const sourceFile = this.app.vault.getAbstractFileByPath(this.sourcePath);
      const templateFile = this.app.vault.getAbstractFileByPath(this.templatePath);
      if (!(sourceFile instanceof TFile)) throw new Error('A fonte do statblock não existe mais no Vault.');
      if (!(templateFile instanceof TFile)) throw new Error('O template selecionado não existe mais no Vault.');

      const templateText = await this.app.vault.cachedRead(templateFile);
      const parsed = parseTemplateFileText(templateText, templateFile.extension);
      const template = parsed.template;
      let layout = parsed.layout;
      if (!layout) {
        const sidecarPath = `${this.plugin.settings.templateFolder}/.statblock-forge/layouts/${template.id}.json`;
        const sidecar = this.app.vault.getAbstractFileByPath(sidecarPath);
        layout = sidecar instanceof TFile
          ? parseForgeLayout(await this.app.vault.cachedRead(sidecar), template)
          : createForgeLayout(template);
      }
      let source: LoadedStatblockSource;
      if (this.initialSourceData) {
        // A just-created note may not have been indexed by Obsidian's metadata
        // cache yet. Render immediately from the exact values used to create it.
        source = createLoadedStatblockSource({
          path: sourceFile.path,
          basename: sourceFile.basename,
          format: this.initialSourceFormat ?? (sourceFile.extension.toLowerCase() === 'json' ? 'json' : 'markdown-frontmatter'),
          raw: this.initialSourceData,
          template,
          resolveImageLink: (linkPath) => this.app.metadataCache.getFirstLinkpathDest(linkPath, sourceFile.path)?.path,
        });
      } else {
        source = await loadStatblockSource(this.app, sourceFile, template);
      }
      if (sequence !== this.refreshSequence) return;
      // The template remains authoritative for pinned image Fields. This also
      // repairs linked statblocks whose data predates the pin.
      applyPinnedTemplateImages(template, layout, source.binding.data);

      this.initialSourceData = null;
      this.initialSourceFormat = null;
      if (this.expansionTemplateId !== template.id) {
        this.expandedSectionIds.clear();
        this.collapsedSectionIds.clear();
        this.expansionTemplateId = template.id;
      }
      this.template = template;
      this.layout = layout;
      this.loadedSource = source;
      this.imageFrames = readStatblockImageFrames(source.raw[FORGE_STATBLOCK_IMAGE_FRAMES_KEY]);
      const focusFirstEmpty = this.focusFirstEmptyOnNextRender;
      this.focusFirstEmptyOnNextRender = false;
      this.renderSurface(template, layout, source, focusFirstEmpty);
    } catch (error) {
      if (sequence !== this.refreshSequence) return;
      const message = error instanceof Error ? error.message : String(error);
      const panel = el('section', 'statblock-forge__status');
      panel.append(el('strong', '', 'Não foi possível renderizar o statblock'), el('p', '', message));
      localizeForgeElement(panel, normalizeForgeLanguage(this.plugin.settings.language));
      this.contentEl.replaceChildren(panel);
      this.showNotice(`Statblock Forge: ${message}`);
    }
  }

  private renderSurface(template: ForgeTemplate, layout: ForgeLayoutDocument, source: LoadedStatblockSource, focusFirstEmpty = false): void {
    const language = normalizeForgeLanguage(this.plugin.settings.language);
    const root = el('div', 'statblock-forge statblock-forge__render-view');
    // Route wheel input through the nearest scrollable child, statblock surface,
    // and finally the Obsidian note pane. Alt selects horizontal scrolling;
    // Ctrl is reserved for image zoom where zooming is still possible.
    root.addEventListener('wheel', (event: WheelEvent) => {
      const scrolled = routeStatblockWheel(root, event.target, event);
      if (!scrolled) return;
      event.preventDefault();
      event.stopPropagation();
    }, { capture: true, passive: false });

    const sheetWidth = resolveForgeSheetWidth(source.raw[FORGE_STATBLOCK_SHEET_WIDTH_KEY], layout.sheetWidth);
    root.setCssProps({ ['--statblock-forge-sheet-width']: `${sheetWidth}px` });
    const sheetWidthControl = this.renderSheetWidthControl(source, layout, root, language, sheetWidth);
    let editPanel: HTMLElement | null = null;
    let card: HTMLElement | null = null;
    const toggleEditPanel = (): void => {
      if (editPanel?.isConnected) {
        editPanel.remove();
        editPanel = null;
        return;
      }
      editPanel = this.createFieldEditPanel(template, source, language, () => { editPanel = null; });
      if (card?.isConnected) root.insertBefore(editPanel, card);
      else root.prepend(editPanel);
    };
    const cardMenuLabel = language === 'pt-BR' ? 'Opções do statblock' : 'Statblock options';
    const cardMenu = renderStatblockCardActionsMenu({
      label: cardMenuLabel,
      actions: () => {
        const tokenLinkInspection = inspectSelectedAtlasTokenLinks(this.app, source.path);
        const canLinkSelectedTokens = tokenLinkInspection.status === 'ready'
          && tokenLinkInspection.targets.some((target) => !target.alreadyLinkedToTarget);
        const canUnlinkSelectedTokens = tokenLinkInspection.status === 'ready'
          && tokenLinkInspection.targets.some((target) => target.alreadyLinkedToTarget);
        return [
          {
            id: 'refresh',
            label: language === 'pt-BR' ? 'Atualizar statblock' : 'Refresh statblock',
            icon: 'refresh',
            run: () => this.refresh(),
          },
          {
            id: 'edit-values',
            label: editPanel?.isConnected
              ? (language === 'pt-BR' ? 'Fechar formulário de valores' : 'Close values form')
              : (language === 'pt-BR' ? 'Editar todos os valores' : 'Edit all values'),
            icon: 'edit',
            run: toggleEditPanel,
          },
          {
            id: 'link-selected-atlas-tokens',
            label: language === 'pt-BR'
              ? `Vincular tokens selecionados${tokenLinkInspection.status === 'ready' ? ` (${tokenLinkInspection.targets.length})` : ''}`
              : `Link selected Atlas tokens${tokenLinkInspection.status === 'ready' ? ` (${tokenLinkInspection.targets.length})` : ''}`,
            icon: 'link',
            disabled: false,
            title: canLinkSelectedTokens
              ? (language === 'pt-BR' ? 'Vincula os Tokens e Characters selecionados na cena ativa do Atlas a esta ficha.' : 'Link the selected Atlas Tokens and Characters in the active scene to this statblock.')
              : atlasTokenLinkInspectionMessage(tokenLinkInspection, language) ?? '',
            run: () => this.applySelectedAtlasTokenLinks(source.path, language, false),
          },
          ...(canUnlinkSelectedTokens ? [{
            id: 'unlink-selected-atlas-tokens',
            label: language === 'pt-BR'
              ? `Desvincular tokens selecionados (${tokenLinkInspection.targets.filter((target) => target.alreadyLinkedToTarget).length})`
              : `Unlink selected Atlas tokens (${tokenLinkInspection.targets.filter((target) => target.alreadyLinkedToTarget).length})`,
            icon: 'unlink',
            run: () => this.applySelectedAtlasTokenLinks(source.path, language, true),
          }] : []),
        ];
      },
    });
    const statblockData = forgeRestDataWithResources(source.binding.data, source.raw);
    const renderData = withTemplateImagePreviewFallback(template, statblockData);
    // Template sample art is only a visual fallback for absent Image values.
    // Resolve those paths relative to the template file before rendering so
    // similarly named files beside the statblock cannot replace the template art.
    const templateSample = isRecord(template.sample) ? template.sample : {};
    for (const field of template.fields) {
      if (field.type !== 'image') continue;
      const isTemplateFallback = !Object.prototype.hasOwnProperty.call(statblockData, field.key);
      const isPinnedTemplateImage = pinnedTemplateImageValue(template, layout, field.key) !== null;
      if (!isTemplateFallback && !isPinnedTemplateImage) continue;
      if (!Object.prototype.hasOwnProperty.call(templateSample, field.key)) continue;
      const resolved = resolveVaultImageResource(this.app, templateSample[field.key], this.templatePath ?? source.path);
      renderData[field.key] = resolved ?? '';
    }
    const renderedCard = renderStatblock({
      app: this.app,
      markdownComponent: this.plugin,
      sourcePath: this.sourcePath ?? source.path,
      template,
      layout,
      data: renderData,
      // Keep live Compendium availability tied to the current source binding.
      // The rendered draft is a shallow top-level copy, so reading only that
      // snapshot can leave a released item hidden until the view is reopened.
      getLiveFieldData: () => forgeRestDataWithResources(source.binding.data, source.raw),
      language,
      focusFirstEmpty,
      interactiveCounters: true,
      // Published statblocks follow Atlas folding: collapsible Sections are
      // moved to footer actions, while Total Hidden blocks are omitted from the final statblock.
      foldSectionsIntoFooter: true,
      expandedSectionIds: this.expandedSectionIds,
      collapsedSectionIds: this.collapsedSectionIds,
      hideTotalHiddenBlocks: true,
      onAbilityCounterMaxChange: (fieldKey) => this.queueAbilityCounterMaximumSave(template, source, fieldKey),
      onFieldValueChange: (fieldKey, value) => this.saveInlineFieldValue(source, fieldKey, value),
      onImageFieldAction: (fieldKey, socket) => this.openImageFieldActions(template, source, fieldKey, socket),
      imageFrames: this.imageFrames,
      onImageFrameChange: (blockId, frame) => this.queueImageFrameSave(source, blockId, frame),
      // Match Atlas image resolution for plain Vault paths, wiki links,
      // Markdown embeds, root-relative references and percent-encoded paths.
      resolveImage: (path) => resolveVaultImageResource(this.app, path, source.path),
    });
    renderedCard.classList.add('statblock-forge__final-card');
    renderedCard.dataset.forgeRenderTarget = 'final';
    this.diceLinkCleanup = attachForgeStatblockDiceRolling(renderedCard, {
      app: this.app,
      template,
      statblockPath: source.path,
      statblockName: source.basename,
      language,
    });
    card = renderedCard;
    // Keep the statblock surface focused on its content. Source metadata and
    // binding diagnostics are intentionally omitted from the rendered view.
    // Keep link and editing actions immediately visible above the sheet.
    // The menu is not nested inside the rendered card, so Atlas styling and
    // clipping cannot suppress its pointer interaction.
    const recoveryActions = this.renderRecoveryActions(template, source, language);
    root.append(sheetWidthControl, cardMenu, renderedCard);
    if (recoveryActions) {
      const body = renderedCard.querySelector('.atlas-statblock-body');
      const header = body?.firstElementChild;
      if (body && header) body.insertBefore(recoveryActions, header.nextSibling);
      else root.insertBefore(recoveryActions, cardMenu);
    }
    this.contentEl.replaceChildren(root);
  }

  private renderSheetWidthControl(
    source: LoadedStatblockSource,
    layout: ForgeLayoutDocument,
    root: HTMLElement,
    language: 'en' | 'pt-BR',
    initialWidth: number,
  ): HTMLElement {
    const portuguese = language === 'pt-BR';
    const inherited = typeof source.raw[FORGE_STATBLOCK_SHEET_WIDTH_KEY] !== 'number';
    const templateWidth = normalizeForgeSheetWidth(layout.sheetWidth, DEFAULT_FORGE_SHEET_WIDTH);
    const details = el('details', 'statblock-forge__sheet-width-control');
    const summary = el('summary', '', `${portuguese ? 'Largura da ficha' : 'Sheet width'} · ${initialWidth} px${inherited ? (portuguese ? ' (template)' : ' (template)') : ''}`);
    const panel = el('div', 'statblock-forge__sheet-width-panel');
    const label = el('label', 'statblock-forge__sheet-width-label', portuguese ? 'Largura da ficha' : 'Sheet width');
    const output = el('output', 'statblock-forge__sheet-width-value', `${initialWidth} px`);
    const slider = el('input', 'statblock-forge__sheet-width-slider');
    slider.type = 'range';
    slider.min = String(MIN_FORGE_SHEET_WIDTH);
    slider.max = String(MAX_FORGE_SHEET_WIDTH);
    slider.step = String(STEP_FORGE_SHEET_WIDTH);
    slider.value = String(initialWidth);
    slider.setAttribute('aria-label', translateForgeText('Statblock width in pixels', language));
    let resetButton: HTMLButtonElement | null = null;
    slider.addEventListener('input', () => {
      const width = normalizeForgeSheetWidth(Number(slider.value));
      output.textContent = `${width} px`;
      summary.textContent = `${portuguese ? 'Largura da ficha' : 'Sheet width'} · ${width} px`;
      root.setCssProps({ ['--statblock-forge-sheet-width']: `${width}px` });
      if (resetButton) resetButton.disabled = false;
    });
    slider.addEventListener('change', () => {
      const width = normalizeForgeSheetWidth(Number(slider.value));
      void this.saveStatblockSheetWidth(source, width, language).catch((error: unknown) => {
        this.showNotice(error instanceof Error ? error.message : String(error), 10000);
      });
    });
    label.append(slider);
    const reset = el('button', 'statblock-forge__sheet-width-reset', translateForgeText('Use template width', language));
    resetButton = reset;
    reset.type = 'button';
    reset.disabled = inherited;
    reset.addEventListener('click', () => {
      slider.value = String(templateWidth);
      output.textContent = `${templateWidth} px`;
      summary.textContent = `${portuguese ? 'Largura da ficha' : 'Sheet width'} · ${templateWidth} px (template)`;
      root.setCssProps({ ['--statblock-forge-sheet-width']: `${templateWidth}px` });
      reset.disabled = true;
      void this.saveStatblockSheetWidth(source, null, language).catch((error: unknown) => {
        this.showNotice(error instanceof Error ? error.message : String(error), 10000);
        reset.disabled = false;
      });
    });
    panel.append(label, output, reset);
    details.append(summary, panel);
    return details;
  }

  private saveStatblockSheetWidth(
    source: LoadedStatblockSource,
    width: number | null,
    language: 'en' | 'pt-BR',
  ): Promise<void> {
    const operation = this.counterSaveQueue.then(async () => {
      const sourceFile = this.app.vault.getAbstractFileByPath(source.path);
      if (!(sourceFile instanceof TFile)) throw new Error('A nota deste statblock não está disponível no Vault.');
      this.savingFieldEdits = true;
      try {
        if (source.format === 'markdown-frontmatter') {
          await this.app.fileManager.processFrontMatter(sourceFile, (frontmatter) => {
            if (!isRecord(frontmatter)) throw new Error('O frontmatter do statblock não contém um objeto válido.');
            if (width === null) delete frontmatter[FORGE_STATBLOCK_SHEET_WIDTH_KEY];
            else frontmatter[FORGE_STATBLOCK_SHEET_WIDTH_KEY] = width;
          });
        } else {
          await this.app.vault.process(sourceFile, (contents) => {
            const parsed: unknown = JSON.parse(contents);
            if (!isRecord(parsed)) throw new Error('O JSON do statblock não contém um objeto na raiz.');
            const root = parsed;
            const target = root.format === 'statblock-forge-data' && isRecord(root.data) ? root.data : root;
            if (width === null) delete target[FORGE_STATBLOCK_SHEET_WIDTH_KEY];
            else target[FORGE_STATBLOCK_SHEET_WIDTH_KEY] = width;
            return `${JSON.stringify(root, null, 2)}\n`;
          });
        }
        if (width === null) delete source.raw[FORGE_STATBLOCK_SHEET_WIDTH_KEY];
        else source.raw[FORGE_STATBLOCK_SHEET_WIDTH_KEY] = width;
      } finally {
        this.savingFieldEdits = false;
      }
    });
    this.counterSaveQueue = operation.catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      this.showNotice(language === 'pt-BR'
        ? `Não foi possível salvar a largura da ficha: ${detail}`
        : `Could not save statblock width: ${detail}`, 10000);
    });
    return operation;
  }

  /** Shows the Template's Rest action buttons beneath the statblock. Conditions are managed by Atlas. */
  private renderRecoveryActions(template: ForgeTemplate, source: LoadedStatblockSource, language: 'en' | 'pt-BR'): HTMLElement | null {
    const buttons = recoveryButtonsOf(template);
    if (buttons.length === 0) return null;
    const portuguese = language === 'pt-BR';
    const section = el('section', 'statblock-forge__rest-actions');
    section.setAttribute('aria-label', portuguese ? 'Ações de descanso' : 'Rest actions');
    const controls = el('div', 'statblock-forge__rest-actions-list');
    for (const rest of buttons) {
      const hasChoices = (rest.choices?.length ?? 0) > 0;
      const hasDirectSpend = rest.rules.some((rule) => rule.does === 'spend');
      const control = el('button', 'statblock-forge__rest-action-button');
      control.type = 'button';
      control.append(el('span', 'statblock-forge__rest-action-icon', '↻'), el('span', '', rest.name));
      control.setAttribute('aria-expanded', 'false');
      control.dataset.state = 'closed';
      if (hasChoices || hasDirectSpend) {
        control.setAttribute('aria-haspopup', 'dialog');
        control.addEventListener('click', () => {
          if (control.dataset.state === 'open') {
            this.restChooserClose?.();
            this.restChooserClose = null;
            return;
          }
          this.restChooserClose?.();
          const collectionResources = atlasRestResourceContextForNote(this.app, source.path)?.resources ?? [];
          this.restChooserClose = openForgeRestChooser(control, rest, template, forgeRestDataWithResources(source.binding.data, source.raw), language, async (picks, spends) => {
            await this.executeRestRecovery(template, source, rest, picks, spends, language);
            this.restChooserClose = null;
          }, collectionResources);
        });
      } else {
        control.addEventListener('click', () => {
          if (control.disabled) return;
          control.disabled = true;
          void this.executeRestRecovery(template, source, rest, [], new Map(), language)
            .catch(() => { if (control.isConnected) control.disabled = false; });
        });
      }
      controls.append(control);
    }
    section.append(controls);
    return section;
  }

  /** Serializes the whole Rest operation, so each recovery is calculated from the latest saved values. */
  private executeRestRecovery(
    template: ForgeTemplate,
    source: LoadedStatblockSource,
    rest: RecoveryButton,
    picks: readonly RestChoicePick[],
    spends: ReadonlyMap<string, number>,
    language: 'en' | 'pt-BR',
  ): Promise<void> {
    const operation = this.counterSaveQueue.then(() => this.runRestRecovery(template, source, rest, picks, spends, language));
    this.counterSaveQueue = operation.catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      // Keep execution errors visible long enough to read, but never persist them
      // in the statblock or leave a permanent warning in the Rest controls.
      this.showNotice(language === 'pt-BR'
        ? `Não foi possível executar ou salvar o descanso: ${detail}`
        : `Could not execute or save the rest: ${detail}`, REST_ERROR_NOTICE_DURATION_MS);
    });
    return operation;
  }

  /** Calculates against the file's current values and persists only the tracked Resources and Counter fields changed by this Rest. */
  private async runRestRecovery(
    template: ForgeTemplate,
    source: LoadedStatblockSource,
    rest: RecoveryButton,
    picks: readonly RestChoicePick[],
    spends: ReadonlyMap<string, number>,
    language: 'en' | 'pt-BR',
  ): Promise<void> {
    const portuguese = language === 'pt-BR';
    const sourceFile = this.app.vault.getAbstractFileByPath(source.path);
    if (!(sourceFile instanceof TFile)) throw new Error('A nota deste statblock não está disponível no Vault.');

    const diceSet = await loadForgeRestDiceSet(this.app, template);
    const rolledFormulas: Array<{ formula: string; label: string; total: number; engine: 'atlas' | 'forge' }> = [];
    const requestedDiceSet = typeof template.diceSetId === 'string' ? template.diceSetId : '';
    const explicitDiceSet = requestedDiceSet && diceSet.id === requestedDiceSet ? diceSet : null;
    const resultState: { value: ReturnType<typeof calculateRestCounters> | null } = { value: null };
    let persisted = false;
    const atlasResourceContextState: { value: AtlasRestResourceContext | null } = { value: null };
    const atlasResourceCommit: { receipt: AtlasRestResourceRollbackReceipt | null } = { receipt: null };

    const calculate = (
      record: JsonRecord,
      registerAtlasReceipt: (receipt: AtlasRestResourceRollbackReceipt) => void,
    ): ReturnType<typeof calculateRestCounters> => {
      const currentSource = createLoadedStatblockSource({
        path: source.path, basename: source.basename, format: source.format, raw: record, template,
      });
      const currentData = forgeRestDataWithResources(currentSource.binding.data, record);
      // Collection Resources belong to the linked Atlas player character, not to the statblock file.
      // Resolve the current values from open Atlas maps at execution time, not from the chooser snapshot.
      const atlasResourceContext = atlasRestResourceContextForNote(this.app, source.path);
      atlasResourceContextState.value = atlasResourceContext;
      const collectionResources = atlasResourceContext?.resources ?? [];
      // Rebuild the offer against the latest note contents inside the serialized write callback.
      // Invalid or stale requests abort before the calculator can write any recovery result.
      const invalidRequest = validateRestRequest({ template, data: currentData, button: rest, picks, spends, collectionResources });
      if (invalidRequest) throw new Error(restRequestValidationMessage(invalidRequest, language));
      const calculated = calculateRestCounters({
        template, data: currentData, button: rest, picks, spends, collectionResources,
        roll: (formula, label) => {
          const nameField = headerFieldForPart(template.fields, 'name');
          const rawName = nameField ? currentData[nameField.key] : undefined;
          const tokenName = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : source.basename;
          const atlasAttempt = rollForgeRestWithAtlasDiceTool(this.app, formula, {
            statblockPath: source.path,
            tokenName,
            abilityName: label,
          }, explicitDiceSet);
          if (atlasAttempt.available) {
            if (!atlasAttempt.roll) return null;
            rolledFormulas.push({ formula: atlasAttempt.roll.formula, label, total: atlasAttempt.roll.total, engine: atlasAttempt.engine === 'forge' ? 'forge' : 'atlas' });
            return atlasAttempt.roll.total;
          }

          // No Atlas map owns an available Dice Tool. Keep Rest usable in a
          // standalone Forge view, but make the local fallback explicit in
          // the result modal instead of pretending it entered Atlas history.
          const rolled = rollForgeRestFormula(formula, diceSet);
          if (!rolled) return null;
          rolledFormulas.push({ formula: rolled.formula, label, total: rolled.total, engine: 'forge' });
          return rolled.total;
        },
      });
      const atlasChanges = calculated.resourceChanges.filter((change) => change.storage === 'atlas' && typeof change.resourceKey === 'string')
        .map((change) => ({ resourceKey: change.resourceKey!, from: change.from, to: change.to, max: change.max, direction: change.direction }));
      if (atlasChanges.length > 0) {
        if (!atlasResourceContext) throw new Error('O personagem não está disponível em um mapa Atlas aberto; os Resources da coleção não podem ser gravados.');
        // Commit Atlas Resources inside the same synchronous latest-file callback. Keep a per-copy
        // receipt: forms can have different maxima, so an inverse change based on the first form
        // cannot safely restore every token if the note write fails afterwards.
        const commit = persistAtlasRestResourceChangesWithReceipt(atlasResourceContext, atlasChanges);
        atlasResourceCommit.receipt = commit.receipt;
        registerAtlasReceipt(commit.receipt);
        persisted = persisted || commit.updated > 0;
      }
      return calculated;
    };


    const changedRecoveryKeys = (calculated: ReturnType<typeof calculateRestCounters>, original: JsonRecord): string[] => {
      const counterKeys = calculated.changes.map((change) => change.field);
      const resourceKeys = calculated.resourceChanges.filter((change) => change.storage !== 'atlas').map((change) => change.field);
      const resourceStateChanged = !sameStoredValue(calculated.data[FORGE_RESOURCE_VALUES_KEY], original[FORGE_RESOURCE_VALUES_KEY]);
      const resourceStateKeys = resourceStateChanged ? [FORGE_RESOURCE_VALUES_KEY] : [];
      const trackedFields = new Set(template.fields
        .filter((field) => forgeTrackedResourceForField(template, field.key) !== undefined)
        .map((field) => field.key));
      return [...new Set([...counterKeys, ...resourceKeys, ...resourceStateKeys])].filter((key) => {
        if (key === FORGE_RESOURCE_VALUES_KEY) return true;
        const field = template.fields.find((candidate) => candidate.key === key);
        if (field?.type === 'counters') return true;
        if (!trackedFields.has(key)) return false;
        const tracked = forgeTrackedResourceForField(template, key);
        return tracked !== undefined && tracked.maxField.key !== tracked.field.key;
      });
    };

    const writeChangedKeys = (target: JsonRecord, calculated: ReturnType<typeof calculateRestCounters>, keys: readonly string[]): void => {
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(calculated.data, key)) target[key] = calculated.data[key];
        else delete target[key];
      }
    };

    // Keep this entire operation inside the same queue as inline field edits and other rests.
    // The calculation runs inside Obsidian's latest-file callback, not against a stale render snapshot.
    // Atlas receipts are registered immediately after the runtime commit; if the Vault write then
    // rejects, the transaction coordinator compensates the Atlas stores before propagating the error.
    this.savingFieldEdits = true;
    try {
      await runRestNotePersistenceWithAtlasRollback(async (registerAtlasReceipt) => {
        if (source.format === 'markdown-frontmatter') {
          await this.app.fileManager.processFrontMatter(sourceFile, (frontmatter) => {
            if (!isRecord(frontmatter)) throw new Error('O frontmatter do statblock não contém um objeto válido.');
            const calculated = calculate(frontmatter, registerAtlasReceipt);
            resultState.value = calculated;
            const keys = changedRecoveryKeys(calculated, frontmatter);
            writeChangedKeys(frontmatter, calculated, keys);
            persisted = persisted || keys.length > 0;
          });
        } else {
          await this.app.vault.process(sourceFile, (contents) => {
            const parsed: unknown = JSON.parse(contents);
            if (!isRecord(parsed)) throw new Error('O JSON do statblock não contém um objeto na raiz.');
            const root = parsed;
            const target = root.format === 'statblock-forge-data' && isRecord(root.data) ? root.data : root;
            const calculated = calculate(target, registerAtlasReceipt);
            resultState.value = calculated;
            const keys = changedRecoveryKeys(calculated, target);
            if (keys.length === 0) return contents;
            writeChangedKeys(target, calculated, keys);
            persisted = true;
            return `${JSON.stringify(root, null, 2)}\n`;
          });
        }
      }, rollbackAtlasRestResourceChanges);
    } finally {
      this.savingFieldEdits = false;
    }

    const result = resultState.value;
    if (!result) throw new Error('O Forge não conseguiu calcular o resultado do descanso.');

    const reasonLabels: Record<string, string> = portuguese ? {
      'unsupported-target': 'Alvo ainda não suportado pelo Forge',
      'unsupported-spend-source': 'Origem do gasto ainda não suportada',
      'unknown-field': 'Campo não encontrado',
      'invalid-counters': 'Dados de Counter inválidos',
      'invalid-resource': 'Valor de recurso inválido',
      'invalid-resource-track': 'Configure uma trilha numérica com campo de máximo separado',
      'static-resource': 'Este Resource da coleção é estático e não pode ser recuperado',
      'no-resource-value': 'O personagem não possui um valor atual deste Resource no Atlas',
      'invalid-value': 'Valor inválido',
      'invalid-formula': 'Fórmula inválida',
      'missing-reference': 'Referência de campo não encontrada',
      'dice-roll-unavailable': 'Não foi possível resolver uma rolagem para esta fórmula',
      'roll-failed': 'A rolagem falhou',
      'for-other-character': 'Ação destinada a outro personagem; esta ficha não foi alterada',
      'unknown-action': 'Opção selecionada não encontrada',
    } : {
      'unsupported-target': 'Target not yet supported by Forge',
      'unsupported-spend-source': 'Spend source not yet supported',
      'unknown-field': 'Field not found',
      'invalid-counters': 'Invalid Counter data',
      'invalid-resource': 'Invalid resource value',
      'invalid-resource-track': 'Configure a numeric track with a separate maximum field',
      'static-resource': 'This collection Resource is static and cannot be recovered',
      'no-resource-value': 'The character has no current value for this Atlas Resource',
      'invalid-value': 'Invalid value',
      'invalid-formula': 'Invalid formula',
      'missing-reference': 'Field reference not found',
      'dice-roll-unavailable': 'Could not resolve a dice roll for this formula',
      'roll-failed': 'Dice roll failed',
      'for-other-character': 'Action taken for another character; this statblock was not changed',
      'unknown-action': 'Selected option not found',
    };

    const selectedActionsByKey = new Map<string, ForgeRestResultAction>();
    for (const pick of picks) {
      const choice = rest.choices?.find((candidate) => candidate.id === pick.choice);
      const action = choice?.actions.find((candidate) => candidate.id === pick.action);
      if (!choice || !action) continue;
      const forOther = pick.forOther === true && action.forOthers === true;
      const key = `${choice.id}\u0000${action.id}\u0000${forOther ? 'other' : 'self'}`;
      const previous = selectedActionsByKey.get(key);
      if (previous) previous.count += 1;
      else selectedActionsByKey.set(key, {
        choice: choice.prompt,
        action: action.name,
        count: 1,
        forOther,
      });
    }

    const spendLabels = new Map(restCounterSpendOptions({
      template,
      data: result.data,
      button: rest,
      picks,
      collectionResources: atlasResourceContextState.value?.resources ?? [],
    }).map((option) => [option.ref, option.label]));
    const displayedSpends: ForgeRestResultSpend[] = [...spends.entries()]
      .filter(([, count]) => Number.isFinite(count) && count > 0)
      .map(([ref, count]) => ({ label: spendLabels.get(ref) ?? ref, count: Math.trunc(count) }));

    const otherCharacterLabels: string[] = [];
    const warningLabels: string[] = [];
    for (const skipped of result.skipped) {
      const message = `${skipped.label || skipped.field || rest.name}: ${reasonLabels[skipped.reason] ?? skipped.reason}`;
      if (skipped.reason === 'for-other-character') otherCharacterLabels.push(message);
      else warningLabels.push(message);
    }

    let refreshWarning: string | null = null;
    if (persisted) {
      this.initialSourceData = null;
      this.initialSourceFormat = null;
      try {
        await this.refresh();
      } catch (error) {
        // The Vault/Atlas writes have already succeeded. A view refresh failure must not turn
        // a committed Rest into a misleading save failure or trigger compensation after commit.
        const detail = error instanceof Error ? error.message : String(error);
        refreshWarning = portuguese
          ? `Os valores foram salvos, mas a ficha não pôde ser atualizada na tela: ${detail}`
          : `Values were saved, but the statblock view could not be refreshed: ${detail}`;
      }
    }
    if (refreshWarning) warningLabels.push(refreshWarning);

    const hasChanges = result.changes.length > 0
      || result.resourceChanges.length > 0;
    const label = (en: string, pt: string): string => portuguese ? pt : en;
    let status: string;
    let noChangeNote: string | null = null;
    const savedToAtlasCollection = !!atlasResourceCommit.receipt
      && (atlasResourceCommit.receipt.tokenEntries.length > 0 || atlasResourceCommit.receipt.partyEntries.length > 0);
    const savedToStatblock = result.changes.length > 0
      || result.resourceChanges.some((change) => change.storage !== 'atlas');
    if (persisted) {
      status = result.skipped.length > 0
        ? label('Recovery saved. Some rules were not applied; see the warnings below.', 'Recuperação salva. Algumas regras não foram aplicadas; consulte os avisos abaixo.')
        : savedToAtlasCollection && savedToStatblock
          ? label('Recovery saved to this statblock and the Atlas collection.', 'Recuperação salva nesta ficha e na coleção do Atlas.')
          : savedToAtlasCollection
            ? label('Recovery saved to the linked Atlas collection.', 'Recuperação salva na coleção Atlas vinculada.')
            : label('Recovery applied and saved to this statblock.', 'Recuperação aplicada e salva nesta ficha.');
    } else if (result.skipped.length > 0 && !hasChanges) {
      status = otherCharacterLabels.length > 0 && warningLabels.length === 0
        ? label('No changes were made to this statblock.', 'Esta ficha não foi alterada.')
        : label('No recovery changes were saved.', 'Nenhuma alteração de recuperação foi salva.');
    } else if (hasChanges) {
      status = label('The calculated changes could not be saved to this statblock.', 'As alterações calculadas não puderam ser salvas nesta ficha.');
    } else {
      status = label('No values needed to change.', 'Nenhum valor precisou ser alterado.');
    }

    if (!hasChanges && result.skipped.length === 0) {
      noChangeNote = label(
        'No changes were calculated. Check the selected options, spend amounts and current values.',
        'Nenhuma alteração foi calculada. Verifique as opções selecionadas, os gastos e os valores atuais.',
      );
    } else if (!persisted && hasChanges) {
      noChangeNote = label(
        'The calculation returned changes, but no compatible Counter or tracked Resource value was written.',
        'O cálculo retornou alterações, mas nenhum Counter ou Resource rastreado compatível foi gravado.',
      );
    }

    const usedAtlasDiceTool = rolledFormulas.some((roll) => roll.engine === 'atlas');
    const usedForgeDiceFallback = rolledFormulas.some((roll) => roll.engine === 'forge');
    const atlasCollectionDefault = usedAtlasDiceTool && explicitDiceSet === null;
    const resultDiceSetName = atlasCollectionDefault
      ? label('Atlas collection default', 'Padrão da coleção Atlas')
      : diceSet.name;
    const diceSetNote = usedAtlasDiceTool
      ? atlasCollectionDefault
        ? label('Rolls were sent to the Atlas Dice Tool and recorded in its history, using the current collection Dice Set.', 'As rolagens foram enviadas ao Dice Tool do Atlas e registradas no histórico, usando o Dice Set atual da coleção.')
        : label('Rolls were sent to the Atlas Dice Tool and recorded in its history.', 'As rolagens foram enviadas ao Dice Tool do Atlas e registradas no histórico.')
      : usedForgeDiceFallback
        ? label('No Atlas map Dice Tool was available. The Forge local roller was used; these rolls were not added to Atlas roll history.', 'Nenhum Dice Tool de mapa do Atlas estava disponível. Foi usado o motor local do Forge; essas rolagens não foram adicionadas ao histórico do Atlas.')
        : requestedDiceSet && requestedDiceSet !== diceSet.id
          ? label(`The requested Dice Set was not found; ${diceSet.name} was used instead.`, `O Dice Set solicitado não foi encontrado; foi utilizado ${diceSet.name}.`)
          : !requestedDiceSet
            ? label(`The Forge default Dice Set was used: ${diceSet.name}.`, `Foi utilizado o Dice Set padrão do Forge: ${diceSet.name}.`)
            : null;

    new RestResultModal(this.app, {
      title: `${rest.name}: ${label('recovery result', 'resultado da recuperação')}`,
      diceSetName: resultDiceSetName,
      diceSetNote,
      saved: persisted,
      status,
      noChangeNote,
      rolls: rolledFormulas,
      actions: [...selectedActionsByKey.values()],
      spends: displayedSpends,
      result,
      warningLabels,
      otherCharacterLabels,
      language,
    }).open();
  }

  private createFieldEditPanel(
    template: ForgeTemplate,
    source: LoadedStatblockSource,
    language: 'en' | 'pt-BR',
    onClose: () => void,
  ): HTMLElement {
    const panel = el('section', 'statblock-forge__field-editor');
    const heading = el('div', 'statblock-forge__field-editor-heading');
    heading.append(
      el('h3', '', language === 'pt-BR' ? 'Editar valores do statblock' : 'Edit statblock values'),
    );
    panel.append(heading);

    const form = el('form', 'statblock-forge__field-editor-form');
    form.noValidate = true;
    const editors: Array<{ field: ForgeTemplate['fields'][number]; mode: StatblockFieldEditorMode; control: HTMLInputElement | HTMLTextAreaElement }> = [];
    for (const field of template.fields) {
      if (isInternalTemplateField(field)) continue;
      if (pinnedTemplateImageValue(template, this.layout, field.key) !== null) continue;
      // The native Atlas image field is a token link, not an ordinary image
      // value. Keep it out of the free-form value editor to prevent a pasted
      // picture path or URL from replacing a token reference.
      if (field.key === 'image' && field.type === 'image') continue;
      const mode = statblockFieldEditorMode(field, source.binding.data[field.key]);
      const label = el('label', 'statblock-forge__field-editor-control');
      const title = el('span', 'statblock-forge__field-editor-label', field.label || field.key);
      const control = mode === 'multiline' || mode === 'list' || mode === 'json'
        ? el('textarea', 'statblock-forge__field-editor-input')
        : el('input', 'statblock-forge__field-editor-input');
      if (control instanceof HTMLInputElement) {
        // Number Values may also contain a validated `adv`/`dis` dice expression.
        // Keep a text input so the browser does not reject the alphabetic suffix.
        control.type = 'text';
        if (mode === 'number') {
          control.inputMode = 'text';
          control.spellcheck = false;
        }
      } else {
        control.rows = mode === 'json' ? 7 : mode === 'list' ? 4 : 3;
        if (mode === 'json') control.spellcheck = false;
      }
      control.dataset.fieldKey = field.key;
      control.value = statblockFieldEditorInitialValue(mode, source.binding.data[field.key], field.type);
      label.append(title, control);
      form.append(label);
      editors.push({ field, mode, control });


    }

    const error = el('p', 'statblock-forge__field-editor-error');
    error.hidden = true;
    const actions = el('div', 'statblock-forge__field-editor-actions');
    const cancel = el('button', 'statblock-forge__button is-secondary', language === 'pt-BR' ? 'Cancelar' : 'Cancel');
    cancel.type = 'button';
    cancel.addEventListener('click', () => { panel.remove(); onClose(); });
    const save = el('button', 'statblock-forge__button', language === 'pt-BR' ? 'Salvar alterações' : 'Save changes');
    save.type = 'submit';
    actions.append(cancel, save);
    form.append(error, actions);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const draft: JsonRecord = { ...source.binding.data };
      try {
        for (const editor of editors) {
          draft[editor.field.key] = parseStatblockFieldEditorValue(editor.field, editor.mode, editor.control.value);
        }

      } catch (caught) {
        error.textContent = caught instanceof Error ? caught.message : String(caught);
        error.hidden = false;
        return;
      }
      error.hidden = true;
      save.disabled = true;
      cancel.disabled = true;
      void this.saveFieldEditDraft(template, source, draft).then(() => {
        panel.remove();
        onClose();
      }).catch((caught: unknown) => {
        error.textContent = caught instanceof Error ? caught.message : String(caught);
        error.hidden = false;
        save.disabled = false;
        cancel.disabled = false;
      });
    });
    panel.append(form);
    return panel;
  }

  private openImageFieldActions(
    template: ForgeTemplate,
    source: LoadedStatblockSource,
    fieldKey: string,
    socket: HTMLButtonElement,
  ): void {
    this.imageSocketMenuClose?.(false);
    this.imageSocketMenuClose = null;

    const language = normalizeForgeLanguage(this.plugin.settings.language);
    const isPortuguese = language === 'pt-BR';
    const pinnedValue = pinnedTemplateImageValue(template, this.layout, fieldKey);
    if (pinnedValue !== null) {
      this.imageSocketMenuClose = openImageSocketActionsMenu(socket, {
        label: isPortuguese ? 'Imagem fixada pelo template' : 'Image pinned by template',
        actions: [],
        hint: isPortuguese
          ? 'Esta imagem é controlada pelo template e não pode ser substituída ou removida neste statblock.'
          : 'This image is controlled by the template and cannot be replaced or removed in this statblock.',
        onClose: () => { this.imageSocketMenuClose = null; },
      });
      return;
    }
    const sourceFile = this.app.vault.getAbstractFileByPath(source.path);
    const current = source.binding.data[fieldKey];
    const hasImage = typeof current === 'string' && current.trim().length > 0;
    const tokenName = typeof source.binding.data.name === 'string' && source.binding.data.name.trim()
      ? source.binding.data.name.trim() : source.basename;
    const isNativeImageField = isTokenArtFieldKey(fieldKey)
      && template.fields.some((field) => field.key === fieldKey && field.type === 'image');
    const isForgeV2Note = sourceFile instanceof TFile && isNativeImageField
      && isForgeNativeV2StatblockNote(this.app, sourceFile.path);
    const atlasTokenAssessment = !isForgeV2Note && sourceFile instanceof TFile && sourceFile.extension.toLowerCase() === 'md'
      ? assessAtlasTokenCreation(this.app, sourceFile, { ...source.raw, ...source.binding.data })
      : {
        status: 'not-statblock' as const,
        message: isPortuguese
          ? 'A criação pelo importador nativo exige um statblock Atlas publicado.'
          : 'The native importer requires a published Atlas statblock.',
      };

    const actions: ImageSocketMenuAction[] = [];
    const linkInspection = isNativeImageField && sourceFile instanceof TFile
      ? inspectSelectedAtlasTokenLinks(this.app, sourceFile.path)
      : null;
    // Ordinary Image fields accept Vault images. Forge v2 Token art also accepts
    // a local Vault image, which the next action can register as a native Atlas
    // TokenAsset. Existing Atlas-published notes keep their native importer path.
    if (!isNativeImageField || isForgeV2Note) {
      actions.push({
        id: isForgeV2Note ? 'choose-token-art' : 'choose-image',
        label: isForgeV2Note
          ? (isPortuguese ? 'Escolher arte do token…' : 'Choose Token art…')
          : (isPortuguese ? 'Escolher do Vault…' : 'Choose from Vault…'),
        icon: 'image',
        run: () => this.openStatblockImagePicker(source, fieldKey, language),
      });
    }
    actions.push({
      id: 'clear-image',
      label: isPortuguese ? 'Remover imagem' : 'Remove image',
      icon: 'clear',
      disabled: !hasImage,
      run: () => { void this.clearStatblockImage(source, fieldKey); },
    });
    if (isNativeImageField) {
      if (isForgeV2Note && sourceFile instanceof TFile) {
        const forgeAssetAssessment = assessForgeTokenAssetCreation(this.app, sourceFile.path, current);
        actions.push({
          id: 'create-forge-token-asset',
          label: isPortuguese ? 'Criar token na biblioteca do Atlas' : 'Create token in Atlas library',
          icon: 'token',
          disabled: forgeAssetAssessment.status !== 'ready',
          title: forgeTokenAssetAssessmentMessage(forgeAssetAssessment, language),
          run: () => { void this.createAtlasTokenAssetFromForgeImage(sourceFile.path, tokenName, current, language); },
        });
      } else {
        actions.push({
          id: 'create-token',
          label: isPortuguese ? 'Criar token no Atlas' : 'Create token in Atlas',
          icon: 'token',
          disabled: atlasTokenAssessment.status !== 'ready',
          title: atlasTokenAssessment.status === 'ready' ? atlasTokenAssessment.commandName : atlasTokenAssessment.message,
          run: () => {
            if (sourceFile instanceof TFile) void this.plugin.createAtlasTokenFromStatblock(sourceFile, source.binding.data);
          },
        });
      }
      const inspection = linkInspection;
      const hasUnlinkedSelection = inspection?.status === 'ready'
        && inspection.targets.some((target) => !target.alreadyLinkedToTarget);
      const hasLinkedSelection = inspection?.status === 'ready'
        && inspection.targets.some((target) => target.alreadyLinkedToTarget);
      actions.push({
        id: 'link-selected-atlas-tokens',
        label: isPortuguese
          ? `Vincular tokens selecionados${inspection?.status === 'ready' ? ` (${inspection.targets.length})` : ''}`
          : `Link selected Atlas tokens${inspection?.status === 'ready' ? ` (${inspection.targets.length})` : ''}`,
        icon: 'link',
        disabled: false,
        title: hasUnlinkedSelection
          ? (isPortuguese
            ? 'Vincula os tokens selecionados nesta cena à ficha atual. Um vínculo anterior será substituído conforme as regras do Atlas.'
            : 'Links the selected tokens in this scene to the current statblock. Any previous link is replaced using Atlas rules.')
          : atlasTokenLinkInspectionMessage(inspection, language) ?? (isPortuguese ? 'Não há tokens selecionados para vincular.' : 'There are no selected tokens to link.'),
        run: () => { void this.applySelectedAtlasTokenLinks(sourceFile instanceof TFile ? sourceFile.path : source.path, language, false); },
      });
      if (hasLinkedSelection) {
        actions.push({
          id: 'unlink-selected-atlas-tokens',
          label: isPortuguese
            ? `Desvincular tokens selecionados (${inspection.targets.filter((target) => target.alreadyLinkedToTarget).length})`
            : `Unlink selected Atlas tokens (${inspection.targets.filter((target) => target.alreadyLinkedToTarget).length})`,
          icon: 'unlink',
          run: () => { void this.applySelectedAtlasTokenLinks(sourceFile instanceof TFile ? sourceFile.path : source.path, language, true); },
        });
      }
    }

    this.imageSocketMenuClose = openImageSocketActionsMenu(socket, {
      label: isPortuguese ? 'Ações da imagem' : 'Image actions',
      actions,
      ...(isNativeImageField ? {
        hint: isForgeV2Note
          ? (isPortuguese
            ? 'Escolha uma imagem local para Token art e crie um TokenAsset na biblioteca do Atlas. Para vincular Characters ou Tokens existentes, use também Opções do statblock acima da ficha.'
            : 'Choose a local image for Token art and create an Atlas TokenAsset in the library. To link existing Characters or Tokens, you can also use Statblock options above the sheet.')
          : (isPortuguese
            ? 'Token art aceita tokens vinculados pelo Atlas. Selecione tokens em uma cena e use Vincular tokens selecionados; para imagens comuns, crie um Field do tipo Image.'
            : 'Token art accepts tokens linked through Atlas. Select tokens in a map and use Link selected Atlas tokens; create an Image Field for ordinary pictures.'),
      } : {}),
      onClose: () => { this.imageSocketMenuClose = null; },
    });
  }

  private async createAtlasTokenAssetFromForgeImage(
    statblockPath: string,
    tokenName: string,
    imageValue: unknown,
    language: 'en' | 'pt-BR',
  ): Promise<void> {
    const isPortuguese = language === 'pt-BR';
    try {
      const result = await createForgeTokenAssetFromImage(this.app, statblockPath, tokenName, imageValue);
      if (result.status === 'created') {
        this.showNotice(isPortuguese
          ? `Token criado na biblioteca do Atlas: ${result.asset.name}.`
          : `Token created in the Atlas library: ${result.asset.name}.`, 7000);
        return;
      }
      if (result.status === 'already-exists') {
        this.showNotice(isPortuguese
          ? `Esta ficha já possui um TokenAsset na biblioteca do Atlas: ${result.asset.name}.`
          : `This statblock already has an Atlas TokenAsset: ${result.asset.name}.`, 9000);
        return;
      }
      this.showNotice(result.message, 9000);
    } catch (error) {
      this.showNotice(isPortuguese
        ? `Falha ao criar o token no Atlas: ${error instanceof Error ? error.message : String(error)}`
        : `Could not create the Atlas token: ${error instanceof Error ? error.message : String(error)}`, 9000);
    }
  }

  private async applySelectedAtlasTokenLinks(
    statblockPath: string,
    language: 'en' | 'pt-BR',
    unlink: boolean,
  ): Promise<void> {
    const isPortuguese = language === 'pt-BR';
    try {
      const result = unlink
        ? await unlinkSelectedAtlasTokensFromStatblock(this.app, statblockPath, { updateStatblockAvatar: false, notify: false, notice: false })
        : await linkSelectedAtlasTokensToStatblock(this.app, statblockPath, { updateStatblockAvatar: false, notice: false });
      if (result.status !== 'linked' && result.status !== 'unlinked') {
        this.showNotice(result.message, 9000);
        return;
      }
      const action = result.status === 'linked'
        ? (isPortuguese ? 'Tokens vinculados' : 'Tokens linked')
        : (isPortuguese ? 'Tokens desvinculados' : 'Tokens unlinked');
      const summary = isPortuguese
        ? `${action}: ${result.changedCount}. Ignorados: ${result.skippedCount}.`
        : `${action}: ${result.changedCount}. Skipped: ${result.skippedCount}.`;
      this.showNotice(summary, 7000);
    } catch (error) {
      this.showNotice(isPortuguese
        ? `Falha ao atualizar os vínculos dos tokens: ${error instanceof Error ? error.message : String(error)}`
        : `Could not update token links: ${error instanceof Error ? error.message : String(error)}`, 9000);
    }
  }

  private openStatblockImagePicker(
    source: LoadedStatblockSource,
    fieldKey: string,
    language: 'en' | 'pt-BR',
  ): void {
    const template = this.template;
    if (template && pinnedTemplateImageValue(template, this.layout, fieldKey) !== null) {
      this.showNotice(language === 'pt-BR'
        ? 'Esta imagem está fixada pelo template e não pode ser substituída.'
        : 'This image is pinned by the template and cannot be replaced.');
      return;
    }
    if (isTokenArtFieldKey(fieldKey) && !isForgeNativeV2StatblockNote(this.app, source.path)) {
      this.showNotice(language === 'pt-BR'
        ? 'O campo Token art aceita imagens locais para fichas Forge v2 ou tokens vinculados pelo Atlas. Use um Field do tipo Image para imagens comuns.'
        : 'Token art accepts local images for Forge v2 statblocks or tokens linked through Atlas. Use an Image Field for ordinary pictures.');
      return;
    }
    const images = this.app.vault.getFiles().filter((file) => isSupportedVaultImagePath(file.path)
      && (!isTokenArtFieldKey(fieldKey) || ATLAS_TOKEN_IMAGE_EXTENSIONS.has(file.extension.toLowerCase())));
    if (images.length === 0) {
      this.showNotice(language === 'pt-BR' ? 'Nenhuma imagem compatível foi encontrada no Vault.' : 'No supported image files were found in the Vault.');
      return;
    }
    new VaultImagePickerModal(this.app, (file) => {
      void (async () => {
        await this.saveInlineFieldValue(source, fieldKey, file.path);
        await this.refresh();
      })().catch((error: unknown) => {
        this.showNotice(`Falha ao salvar a imagem: ${error instanceof Error ? error.message : String(error)}`, 9000);
      });
    }, language).open();
  }

  private async clearStatblockImage(source: LoadedStatblockSource, fieldKey: string): Promise<void> {
    const template = this.template;
    if (template && pinnedTemplateImageValue(template, this.layout, fieldKey) !== null) {
      this.showNotice(normalizeForgeLanguage(this.plugin.settings.language) === 'pt-BR'
        ? 'Esta imagem está fixada pelo template e não pode ser removida.'
        : 'This image is pinned by the template and cannot be removed.');
      return;
    }
    try {
      await this.saveInlineFieldValue(source, fieldKey, null);
      await this.refresh();
    } catch (error) {
      this.showNotice(`Falha ao remover a imagem: ${error instanceof Error ? error.message : String(error)}`, 9000);
    }
  }

  /** Queue note-local image framing metadata without changing template-wide layout. */
  private queueImageFrameSave(source: LoadedStatblockSource, blockId: string, frame: StatblockImageFrame): void {
    this.imageFrames = withStatblockImageFrame(this.imageFrames, blockId, frame);
    this.pendingImageFrameSave = { source, frames: { ...this.imageFrames } };
    if (this.imageFrameSaveTimer !== null) window.clearTimeout(this.imageFrameSaveTimer);
    this.imageFrameSaveTimer = window.setTimeout(() => {
      this.imageFrameSaveTimer = null;
      void this.flushImageFrameSave();
    }, 350);
  }

  /** Persist the latest framing snapshot in the Forge-owned note metadata key. */
  private async flushImageFrameSave(): Promise<void> {
    if (this.imageFrameSaveTimer !== null) {
      window.clearTimeout(this.imageFrameSaveTimer);
      this.imageFrameSaveTimer = null;
    }
    const pending = this.pendingImageFrameSave;
    if (!pending) return;
    this.pendingImageFrameSave = null;

    const sourceFile = this.app.vault.getAbstractFileByPath(pending.source.path);
    if (!(sourceFile instanceof TFile)) {
      this.showNotice('Não foi possível salvar o enquadramento: a nota do statblock não está disponível.');
      return;
    }

    const frames = pending.frames;
    const save = this.counterSaveQueue.then(async () => {
      this.savingFieldEdits = true;
      try {
        if (pending.source.format === 'markdown-frontmatter') {
          await this.app.fileManager.processFrontMatter(sourceFile, (frontmatter) => {
            if (!isRecord(frontmatter)) throw new Error('O frontmatter do statblock não contém um objeto válido.');
            frontmatter[FORGE_STATBLOCK_IMAGE_FRAMES_KEY] = frames;
          });
        } else {
          await this.app.vault.process(sourceFile, (contents) => {
            const parsed: unknown = JSON.parse(contents);
            if (!isRecord(parsed)) throw new Error('O JSON do statblock não contém um objeto na raiz.');
            const target = parsed.format === 'statblock-forge-data' && isRecord(parsed.data) ? parsed.data : parsed;
            target[FORGE_STATBLOCK_IMAGE_FRAMES_KEY] = frames;
            return `${JSON.stringify(parsed, null, 2)}\n`;
          });
        }
        pending.source.raw[FORGE_STATBLOCK_IMAGE_FRAMES_KEY] = frames;
        this.initialSourceData = { ...pending.source.raw, ...pending.source.binding.data };
        this.initialSourceFormat = pending.source.format;
      } finally {
        this.savingFieldEdits = false;
      }
    });
    this.counterSaveQueue = save.catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.showNotice(`Falha ao salvar o enquadramento da imagem: ${message}`, 9000);
    });
    await save.catch(() => undefined);

    // A new drag/wheel event may have arrived while this snapshot was being written.
    if (this.pendingImageFrameSave && this.imageFrameSaveTimer === null) {
      this.imageFrameSaveTimer = window.setTimeout(() => {
        this.imageFrameSaveTimer = null;
        void this.flushImageFrameSave();
      }, 0);
    }
  }

  /** Save one Number/Rating Field edited directly in the rendered statblock. */
  private async saveInlineFieldValue(source: LoadedStatblockSource, fieldKey: string, value: unknown): Promise<void> {
    const template = this.template;
    const pinnedValue = template ? pinnedTemplateImageValue(template, this.layout, fieldKey) : null;
    if (pinnedValue !== null && value !== pinnedValue) {
      throw new Error(normalizeForgeLanguage(this.plugin.settings.language) === 'pt-BR'
        ? 'Esta imagem está fixada pelo template e não pode ser substituída ou removida.'
        : 'This image is pinned by the template and cannot be replaced or removed.');
    }
    const sourceFile = this.app.vault.getAbstractFileByPath(source.path);
    if (!(sourceFile instanceof TFile)) throw new Error('A nota deste statblock não está disponível no Vault.');

    const save = this.counterSaveQueue.then(async () => {
      this.savingFieldEdits = true;
      try {
        if (source.format === 'markdown-frontmatter') {
          // The note-panel manager also listens to metadataCache.changed. This
          // marker lets it distinguish our inline value write from an external
          // note edit, avoiding a full statblock rebuild (and viewport jump).
          this.sourceMetadataRefreshGate.expect(source.path);
          try {
            await this.app.fileManager.processFrontMatter(sourceFile, (frontmatter) => {
              if (value === undefined) delete frontmatter[fieldKey];
              else frontmatter[fieldKey] = value;
            });
          } catch (error) {
            this.sourceMetadataRefreshGate.cancel(source.path);
            throw error;
          }
          return;
        }
        await this.app.vault.process(sourceFile, (contents) => {
          const parsed: unknown = JSON.parse(contents);
          if (!isRecord(parsed)) throw new Error('O JSON do statblock não contém um objeto na raiz.');
          const root = parsed;
          const target = root.format === 'statblock-forge-data' && isRecord(root.data) ? root.data : root;
          if (value === undefined) delete target[fieldKey];
          else target[fieldKey] = value;
          return `${JSON.stringify(root, null, 2)}\n`;
        });
      } finally {
        this.savingFieldEdits = false;
      }
    });
    this.counterSaveQueue = save.catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.showNotice(`Falha ao salvar o campo ${fieldKey}: ${message}`);
    });
    await save;
    // The renderer owns the same mutable data record and updates every derived
    // value through its inline-edit runtime. Rebuilding the whole view here
    // would destroy focus and interrupt Atlas-style multi-Field block editing.
    source.binding.data[fieldKey] = value;
    this.initialSourceData = { ...source.raw, ...source.binding.data };
    this.initialSourceFormat = source.format;
    // The picker is rendered in a body-level popover and keeps its own DOM.
    // Notify the existing card after the Vault write and binding update so
    // availability is recalculated immediately without reopening the view.
    this.contentEl.querySelector<HTMLElement>(
      '.statblock-forge__statblock[data-render-surface="statblock"]',
    )?.dispatchEvent(new Event(FORGE_STATBLOCK_SOURCE_DATA_CHANGED_EVENT));
    this.showNotice(normalizeForgeLanguage(this.plugin.settings.language) === 'pt-BR'
      ? `Campo "${fieldKey}" salvo.`
      : `Field "${fieldKey}" saved.`);
  }

  private async saveFieldEditDraft(template: ForgeTemplate, source: LoadedStatblockSource, draft: JsonRecord): Promise<void> {
    const sourceFile = this.app.vault.getAbstractFileByPath(source.path);
    if (!(sourceFile instanceof TFile)) throw new Error('A nota deste statblock não está disponível no Vault.');
    const normalizedDraft: JsonRecord = { ...draft };
    for (const field of template.fields) {
      if (field.type === 'entries' && Object.prototype.hasOwnProperty.call(normalizedDraft, field.key)) {
        normalizedDraft[field.key] = preserveUnchangedFieldCompendiumEntrySources(
          source.binding.data[field.key], normalizedDraft[field.key],
        );
      }
    }
    const changedFields = template.fields.filter((field) =>
      Object.prototype.hasOwnProperty.call(normalizedDraft, field.key)
      && !sameStoredValue(normalizedDraft[field.key], source.binding.data[field.key]));
    let latestData: JsonRecord | null = null;

    const save = this.counterSaveQueue.then(async () => {
      this.savingFieldEdits = true;
      try {
        if (changedFields.length === 0) {
          this.initialSourceData = null;
          this.initialSourceFormat = null;
          return;
        }
        if (source.format === 'markdown-frontmatter') {
          await this.app.fileManager.processFrontMatter(sourceFile, (frontmatter) => {
            if (!isRecord(frontmatter)) throw new Error('O frontmatter do statblock não contém um objeto válido.');
            for (const field of changedFields) {
              // A full-field editor may have stayed open while a Rest or another edit saved.
              // Refuse to overwrite that concurrent change instead of silently restoring stale data.
              if (!sameStoredValue(frontmatter[field.key], source.raw[field.key])) {
                throw new Error(`O campo "${field.label || field.key}" mudou desde que o editor foi aberto. Reabra o editor e tente novamente.`);
              }
              frontmatter[field.key] = normalizedDraft[field.key];
            }
            latestData = { ...frontmatter };
          });
        } else {
          await this.app.vault.process(sourceFile, (contents) => {
            const parsed: unknown = JSON.parse(contents);
            if (!isRecord(parsed)) throw new Error('O JSON do statblock não contém um objeto na raiz.');
            const root = parsed;
            const target = root.format === 'statblock-forge-data' && isRecord(root.data) ? root.data : root;
            for (const field of changedFields) {
              if (!sameStoredValue(target[field.key], source.raw[field.key])) {
                throw new Error(`O campo "${field.label || field.key}" mudou desde que o editor foi aberto. Reabra o editor e tente novamente.`);
              }
              target[field.key] = normalizedDraft[field.key];
            }
            latestData = { ...target };
            return `${JSON.stringify(root, null, 2)}\n`;
          });
        }
        this.initialSourceData = latestData;
        this.initialSourceFormat = source.format;
      } finally {
        this.savingFieldEdits = false;
      }
    });
    this.counterSaveQueue = save.catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.showNotice(`Falha ao salvar os valores do statblock: ${message}`);
    });
    await save;
    await this.refresh();
    this.showNotice(normalizeForgeLanguage(this.plugin.settings.language) === 'pt-BR'
      ? 'Valores do statblock salvos.'
      : 'Statblock values saved.');
  }

  /** Persist a per-ability Counter maximum without changing the template-wide default.
   *  Forge's typed marks are projected to Atlas' `used/max` text representation
   *  before writing, so the individual maximum survives reloads in existing Atlas-origin notes.
   */
  private queueAbilityCounterMaximumSave(
    template: ForgeTemplate,
    source: LoadedStatblockSource,
    fieldKey: string,
  ): void {
    const sourceFile = this.app.vault.getAbstractFileByPath(source.path);
    if (!(sourceFile instanceof TFile)) {
      this.showNotice('Não foi possível salvar o máximo individual: a nota não está disponível.');
      return;
    }

    const save = this.counterSaveQueue.then(async () => {
      const projection = projectForgeStatblockDataForLegacyNote(template, source.binding.data);
      if (!Object.prototype.hasOwnProperty.call(projection.data, fieldKey)) return;

      if (source.format === 'markdown-frontmatter') {
        await this.app.fileManager.processFrontMatter(sourceFile, (frontmatter) => {
          frontmatter[fieldKey] = projection.data[fieldKey];
        });
        return;
      }

      // JSON sources remain JSON; preserve an optional Forge data envelope.
      await this.app.vault.process(sourceFile, (contents) => {
        const parsed: unknown = JSON.parse(contents);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('O JSON do statblock não contém um objeto na raiz.');
        }
        const root = parsed as Record<string, unknown>;
        const target = root.format === 'statblock-forge-data'
          && root.data && typeof root.data === 'object' && !Array.isArray(root.data)
          ? root.data as Record<string, unknown>
          : root;
        target[fieldKey] = projection.data[fieldKey];
        return `${JSON.stringify(root, null, 2)}\n`;
      });
    });

    this.counterSaveQueue = save.catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.showNotice(`Falha ao salvar o máximo individual: ${message}`);
    });
  }

  private showNotice(message: string, duration?: number): void {
    const language = normalizeForgeLanguage(this.plugin.settings.language);
    new Notice(translateForgeText(message, language), duration);
  }


}
