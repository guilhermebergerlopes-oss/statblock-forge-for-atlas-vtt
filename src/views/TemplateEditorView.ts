import { FileView, Notice, TFile, TFolder, type WorkspaceLeaf } from 'obsidian';
import type StatblockForgePlugin from '../../main';
import {
  blockLabel,
  cloneJson,
  createBlankTemplate,
  createForgeLayout,
  isRecord,
  isForgeField,
  parseForgeLayout,
  serializeForgeEditorTemplate,
  type ForgeBlock,
  type ForgeField,
  type ForgeLayoutDocument,
  type ForgeTemplate,
} from '../templates/forgeTemplate';
import { ensureForgeContainers, isContainerDataField } from '../templates/containerEditorModel';
import {
  saveTemplateDocument,
  TemplateNameConflictError,
  type TemplateOverwriteConfirmation,
} from '../templates/templateRepository';
import { createTemplateVaultStorage } from '../templates/templateVaultStorage.ts';
import { ensureAtlasNativeTemplateMirror } from '../atlas/atlasNativeTemplateBridge.ts';
import {
  captureTemplateEditorDirtyBaseline,
  hasUnsavedTemplateEditorChanges,
  type TemplateEditorDirtyBaseline,
} from '../templates/templateEditorDirtyState.ts';
import { FORGE_TEMPLATE_EXTENSION, parseTemplateFileText } from '../templates/forgeFileFormat';
import {
  abilityPartsForField,
  removeAbilityPartAppearanceField,
  renameAbilityPartAppearanceField,
  renameAbilityPartAppearanceKey,
  validateAbilityParts,
} from '../templates/abilityPartsModel';
import { GRID_COLUMN_COUNT, MAX_BLOCK_ROWS } from '../templates/layoutLimits';
import { canvasSelectionHandlePosition } from '../templates/canvasSelectionHandleModel.ts';
import { groupRowChildrenBySpan, packPhysicalGrid } from '../templates/gridLayout.ts';
import {
  findLayoutBlock,
  removeLayoutBlock,
  resizeLayoutBlock,
  validateLayoutDocument,
} from '../templates/layoutEditorModel';
import { abilityFieldsForField } from '../templates/abilityTabsModel.ts';
import {
  addFieldCompendiumItem, compendiumCategories, compendiumSummary, ensureFieldId, fieldCompendiumItems, isCollectionFieldType,
  removeFieldCompendium, removeFieldCompendiumItem, updateFieldCompendiumItem,
  fieldCompendiumSourceKey, setFieldCompendiumSource,
} from '../templates/fieldCompendiumModel.ts';
import { inlineEntryDraftValue, serializeInlineEntryDraft } from '../statblocks/inlineEntriesFieldEditorModel.ts';
import { parseInlinePairText } from '../statblocks/inlinePairsFieldEditorModel.ts';
import { inlineSpellGroupsDraftValue, serializeInlineSpellGroups, type InlineSpellGroupDraft } from '../statblocks/inlineSpellsFieldEditorModel.ts';
import type { ForgeFieldCategory } from '../templates/fieldCategoryModel.ts';
import {
  templateFieldKeyToOpenForBlock,
  reorderTemplateField,
  removeTemplateField,
  templateFields,
  validateTemplateFields,
} from '../templates/fieldEditorModel';
import { resolveVaultImageResource } from '../render/vaultImageResolver.ts';
import { gridResizeSpanFromStep, resizeAutoScrollSpeed, resizeRowsMinHeight, rowResizePreviewWidth, rowResizeSpanFromDelta } from './templateCanvasResize.ts';
import { readTemplateGridGeometry, templateGridColumnPitch } from './templateGridGeometry.ts';
import { openImageSocketActionsMenu } from '../render/imageSocketActionsMenu.ts';
import { localizeForgeElement, normalizeForgeLanguage, translateForgeText } from '../i18n/localization';
import { normalizeStatblockThemeId } from '../templates/statblockThemes.ts';
import { atlasResourceFieldKeysForTemplate } from '../atlas/atlasRestResources.ts';
import { isPinnedTemplateImage, isSupportedVaultImagePath, setPinnedTemplateImage, setTemplateSampleImage, removePinnedTemplateImageField } from '../templates/imageFieldModel.ts';
import { VaultImagePickerModal } from './StatblockFilePickers.ts';
import { TemplateSaveModal, type TemplateSaveRequest } from './TemplateSaveModal.ts';
import { TemplateOverwriteModal } from './TemplateOverwriteModal.ts';
import { UnsavedTemplateChangesModal } from './UnsavedTemplateChangesModal.ts';
import { DestructiveActionConfirmationModal } from './DestructiveActionConfirmationModal.ts';
import { createTemplateEditorRecoveryDraftId, type ClosedTemplateEditorDraft } from './closedTemplateEditorDraft.ts';
import { shouldPersistTemplateEditorDraftContent, templateEditorDraftContentSnapshot } from '../templates/templateEditorDraftPersistence.ts';
import { editScoresTable } from '../templates/tableEditorModel';
import { validateCheckboxFieldOptions } from '../templates/checkboxFieldModel.ts';
import { readTemplateJson, reconcileLayoutAfterJsonEdit } from '../templates/jsonEditorModel';
import {
  createRecoveryAction, createRecoveryButton, createRecoveryChoice, defaultRecoveryRuleForFields,
  recoveryButtonsOf, recoveryButtonsForEditing, recoveryDiagnosticsOf, recoveryFields, setRecoveryButtons, toggleRecoveryRows, validateRecoveryButtons,
  normalizeRecoveryChoicePickLimits, recoveryChoicePickCapacity, withRecoveryChoicePickLimit,
  MAX_RECOVERY_ACTIONS, MAX_RECOVERY_BUTTONS, MAX_RECOVERY_CHOICES, MAX_RECOVERY_RULES,
  type RecoveryAction, type RecoveryButton, type RecoveryChoice, type RecoveryRule,
} from '../templates/recoveryEditorModel.ts';
import { diceSetOptions, readDiceSetOption, type DiceSetOption } from '../templates/diceSetPickerModel.ts';
import { componentHelpEntry, componentHelpExamples, renderComponentHelpExample, type ComponentHelpExampleSpec, type ComponentHelpGroup } from './componentHelp.ts';
import { placeHelpTooltip } from './componentHelpPlacement.ts';
import {
  el,
  button,
  inputText,
  textareaInput,
  checkboxInput,
  toggleControl,
  numberInput,
  selectInput,
  labeledControl,
  section,
  fieldTypeLabel,
} from './templateEditorDom.ts';
import { renderForgeColorControl, renderTemplateThemeAppearance } from './templateAppearanceEditor.ts';
import {
  renderNumericFieldFormulaEditor,
  renderTemplateFieldCard,
  renderAddTemplateField,
  type TemplateFieldEditorContext,
} from './templateFieldEditor.ts';
import { renderTemplateHeaderFields } from './templateHeaderEditor.ts';
import { renderBlockStructureProperties } from './templateBlockStructureInspector.ts';
import { renderLineBlockOptions } from './templateLineBlockInspector.ts';
import { renderCheckboxFieldOptions } from './templateCheckboxFieldEditor.ts';
import { renderEntryExtras } from './templateAbilityPartsEditor.ts';
import { renderCounterPresets } from './templateCounterPresetsEditor.ts';
import type { TemplateSpecializedFieldEditorContext } from './templateSpecializedFieldEditorContext.ts';
import { renderScoresBlockInspector } from './templateScoresBlockInspector.ts';
import { renderMetricBlockInspector } from './templateMetricBlockInspector.ts';
import { renderCountersBlockInspector } from './templateCountersBlockInspector.ts';
import { hasNumericTrackingForBlock, renderValueBlockInspector } from './templateValueBlockInspector.ts';
import { renderPlayerAccessInspector } from './templatePlayerAccessInspector.ts';
import { renderBlockAppearanceInspector, type BlockAppearanceSectionKey } from './templateBlockAppearanceInspector.ts';
import { renderTemplateFieldTypographyInspector } from './templateFieldTypographyInspector.ts';
import { captureDisclosureOpenState, restoreDisclosureOpenState, type DisclosureOpenState } from './disclosureOpenState.ts';
import { renderTemplateCanvasSurface, restoreTemplateCanvasTabs } from './templateCanvasSurface.ts';
import { renderStatblock, renderStatblockPreview } from '../render/statblockPreviewRenderer.ts';
import { renderCompendiumAbilityPreview } from '../render/compendiumAbilityPreview.ts';
import { templatePreviewData } from '../render/statblockRenderModel.ts';
import { attachForgeStatblockDiceRolling } from '../render/statblockDiceLinks.ts';
import { normalizeForgeSheetWidth } from '../templates/sheetWidth.ts';
import { attachTemplateCanvasZoom } from './templateCanvasZoom.ts';
import {
  applyCanvasDrop,
  attachCanvasBlockDragSource,
  attachCanvasFieldDragSource,
  attachTemplateCanvasDropZone,
  findFirstBlockForField,
} from './templateCanvasDragDrop.ts';
import { renderTemplateCanvasToolbar } from './templateCanvasToolbar.ts';
import { findJsonTextMatches, revealJsonTextMatch, type JsonSearchMatch } from './jsonEditorSearch.ts';

export const STATBLOCK_FORGE_EDITOR_VIEW = 'statblock-forge-template-editor';

const FIELD_ORDER_DRAG_TYPE = 'application/x-statblock-forge-field-order';
const FIELD_ORDER_DRAG_FALLBACK = 'forge-field-order:';

let componentHelpTooltipSequence = 0;
let activeComponentHelpTooltip: HTMLElement | null = null;
let activeComponentHelpRotationCleanup: (() => void) | null = null;

function dismissActiveComponentHelpTooltip(): void {
  activeComponentHelpRotationCleanup?.();
  activeComponentHelpRotationCleanup = null;
  activeComponentHelpTooltip?.remove();
  activeComponentHelpTooltip = null;
}

interface CanvasScrollPosition {
  top: number;
  left: number;
}

/** Read the actual Canvas scrollport (the dropzone), not its clipped outer column. */
function readCanvasScrollPosition(root: ParentNode): CanvasScrollPosition | null {
  const scrollport = root.querySelector<HTMLElement>('.statblock-forge__canvas-dropzone');
  return scrollport ? { top: scrollport.scrollTop, left: scrollport.scrollLeft } : null;
}

interface EditorAncestorScrollPosition {
  element: HTMLElement;
  top: number;
  left: number;
}

/** Capture Obsidian's outer view scrollports as well as the document viewport. */
function readEditorAncestorScrollPositions(root: HTMLElement): EditorAncestorScrollPosition[] {
  const positions: EditorAncestorScrollPosition[] = [];
  const seen = new Set<HTMLElement>();
  const view = root.ownerDocument.defaultView;
  let ancestor = root.parentElement;
  while (ancestor) {
    const style = view?.getComputedStyle(ancestor);
    const hasScrollOverflow = /^(auto|scroll|overlay)$/.test(style?.overflowY ?? '')
      || /^(auto|scroll|overlay)$/.test(style?.overflowX ?? '');
    if (hasScrollOverflow || ancestor.scrollTop !== 0 || ancestor.scrollLeft !== 0
      || ancestor.scrollHeight > ancestor.clientHeight + 1
      || ancestor.scrollWidth > ancestor.clientWidth + 1) {
      positions.push({ element: ancestor, top: ancestor.scrollTop, left: ancestor.scrollLeft });
      seen.add(ancestor);
    }
    ancestor = ancestor.parentElement;
  }
  const documentScroller = root.ownerDocument.scrollingElement as HTMLElement | null;
  if (documentScroller && !seen.has(documentScroller)) {
    positions.push({ element: documentScroller, top: documentScroller.scrollTop, left: documentScroller.scrollLeft });
  }
  return positions;
}


const CANVAS_RESIZE_PARENT_SELECTOR = '.statblock-forge__preview-grid, .statblock-forge__preview-row, .statblock-forge__preview-row-line';

/** Resolve the layout container that owns a block's resize geometry. Tab panels
 * can introduce a non-layout wrapper between a block and its Grid; resolving
 * the nearest actual layout container keeps the resize affordance available. */
function canvasResizeParent(node: HTMLElement): HTMLElement | null {
  const directParent = node.parentElement;
  if (!directParent) return null;
  if (directParent.matches(CANVAS_RESIZE_PARENT_SELECTOR)) return directParent;
  const ancestor = directParent.closest<HTMLElement>(CANVAS_RESIZE_PARENT_SELECTOR);
  return ancestor && ancestor.contains(node) ? ancestor : null;
}

export class TemplateEditorView extends FileView {
  /** Allow this FileView to represent an unsaved, file-less template draft. */
  allowNoFile = true;

  private template: ForgeTemplate | null = null;
  private layout: ForgeLayoutDocument | null = null;
  private originalText: string | null = null;
  private displayName = 'New Template';
  private selectedBlockId: string | null = null;
  private selectedBlockIds: string[] = [];
  private lineAddingValueForBlockId: string | null = null;
  private sidebarMode: 'fields' | 'field' | 'options' | 'json' | 'rests' | 'dice' = 'fields';
  private sidebarTab: 'structure' | 'properties' | 'appearance' | 'compendium' = 'structure';
  private compendiumFieldKey: string | null = null;
  private compendiumFieldId: string | null = null;
  private compendiumEditingItemId: string | null = null;
  private selectedTemplateFieldKey: string | null = null;
  private appearanceFieldKey: string | null = null;
  private addFieldFormOpen = false;
  private addFieldCategory: ForgeFieldCategory = 'values';
  private addFieldType = 'number';
  private headerFieldsOpen = false;
  private readonly propertiesDisclosureOpen = new Map<string, boolean>();
  private readonly persistentDisclosureOpen: DisclosureOpenState = new Map();
  private jsonDraftText: string | null = null;
  private jsonAppliedText: string | null = null;
  private jsonStatus = '';
  private jsonStatusElement: HTMLElement | null = null;
  private diceOptions: DiceSetOption[] = diceSetOptions([]);
  private readonly activeTabsById = new Map<string, string>();
  private readonly expandedCanvasSectionIds = new Set<string>();
  private readonly collapsedCanvasSectionIds = new Set<string>();
  /** Rest-card disclosure state is editor UI state and is never written to the template JSON. */
  private readonly collapsedRecoveryButtonIds = new Set<string>();
  private warnings: string[] = [];
  private saving = false;
  private editorDirtyBaseline: TemplateEditorDirtyBaseline | null = null;
  private recoveryDraftId: string | null = null;
  private persistedRecoveryDraftId: string | null = null;
  private discardingRecoveryDraftId: string | null = null;
  private recoveryPersistenceTimer: number | null = null;
  private lastPersistedRecoveryContentSnapshot: string | null = null;
  private pendingRecoveryContentSnapshot: string | null = null;
  private recoveryListenersRegistered = false;
  private canOverwriteCurrentFile = true;
  private missingTemplatePath: string | null = null;
  private themeAdvancedOpen = false;
  private tokenBorderAppearanceOpen = false;
  private blockAppearanceAdvancedOpen = false;
  private readonly blockAppearanceSectionsOpen = new Map<string, Partial<Record<BlockAppearanceSectionKey, boolean>>>();
  private abilityAppearanceAdvancedOpen = false;
  private canvasScrollRestoreSequence = 0;
  private editorViewportScrollRestoreSequence = 0;
  private canvasZoom = 1;
  private statblockMode = false;
  private statblockPreviewData: Record<string, unknown> | null = null;
  private statblockPreviewSampleSnapshot: string | null = null;
  private statblockPreviewDiceCleanup: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: StatblockForgePlugin) {
    super(leaf);
  }

  getViewType(): string { return STATBLOCK_FORGE_EDITOR_VIEW; }
  getDisplayText(): string { return this.file?.basename ?? (normalizeForgeLanguage(this.plugin.settings.language) === 'pt-BR' ? 'Novo template Forge' : 'New Forge template'); }
  getIcon(): string { return 'layout-template'; }
  canAcceptExtension(extension: string): boolean { return extension.toLowerCase() === FORGE_TEMPLATE_EXTENSION; }

  /** Identifies the source template currently open in this editor tab. */
  getLoadedFilePath(): string | null {
    return this.file?.path ?? null;
  }

  getRecoveryDraftId(): string | null {
    return this.recoveryDraftId;
  }

  refreshForSettings(): void {
    if (this.template && this.layout) this.render();
  }

  /** Toggle the interactive final-statblock preview from the toolbar or its Obsidian command. */
  toggleStatblockMode(): void {
    if (!this.template || !this.layout) return;
    this.statblockMode = !this.statblockMode;
    this.render();
  }

  getState(): Record<string, unknown> {
    // FileView owns the file path in Obsidian's workspace layout state.
    return { ...super.getState() };
  }

  /** Whether the current template/layout/JSON draft differs from the last loaded or saved state. */
  get hasUnsavedChanges(): boolean {
    return hasUnsavedTemplateEditorChanges(this.editorDirtyBaseline, {
      template: this.template,
      layout: this.layout,
      jsonDraftText: this.jsonDraftText,
      jsonAppliedText: this.jsonAppliedText,
    });
  }

  private rememberEditorDirtyBaseline(): void {
    this.editorDirtyBaseline = this.template && this.layout
      ? captureTemplateEditorDirtyBaseline(this.template, this.layout)
      : null;
  }

  async onLoadFile(file: TFile): Promise<void> {
    this.commitActiveEditorInput();
    await this.flushDraftPersistence();
    // Some FileView transitions arrive without a preceding onUnloadFile (for
    // example, replacing an unsaved new-template draft with a real file).
    // Hand off that draft before loading the new template into this view.
    const replacedDraft = this.takeClosedDraft();
    this.missingTemplatePath = null;
    await super.onLoadFile(file);
    await this.loadTemplate(file);
    this.promptForClosedDraft(replacedDraft);
  }

  async onUnloadFile(file: TFile): Promise<void> {
    this.commitActiveEditorInput();
    await this.flushDraftPersistence();
    // Atlas asks about a dirty session when its view lets go of the file,
    // including when another template is opened in the same tab.
    const unloadedDraft = this.takeClosedDraft(file.path);
    await super.onUnloadFile(file);
    this.promptForClosedDraft(unloadedDraft);
  }

  async onOpen(): Promise<void> {
    // Give the editor a dedicated, height-constrained host so its sidebar and
    // Canvas can use the full vertical space provided by the Obsidian leaf.
    this.contentEl.classList.add('statblock-forge__template-editor-content');
    if (!this.recoveryListenersRegistered) {
      this.registerDomEvent(this.contentEl, 'input', () => this.scheduleDraftPersistence());
      this.registerDomEvent(this.contentEl, 'change', () => this.scheduleDraftPersistence());
      this.registerDomEvent(this.contentEl, 'click', (event) => this.handleCanvasOutsideClick(event));
      this.registerDomEvent(this.contentEl, 'keydown', (event) => this.handleCanvasSelectionKeydown(event));
      this.recoveryListenersRegistered = true;
    }
    // Opening a `.forgetemplate` from the File Explorer is the normal entry point.
    if (this.file && !this.template) await this.loadTemplate(this.file);
    else if (!this.file && !this.template) await this.loadTemplate(null);
  }

  async onClose(): Promise<void> {
    this.statblockPreviewDiceCleanup?.();
    this.statblockPreviewDiceCleanup = null;
    this.statblockPreviewData = null;
    this.statblockPreviewSampleSnapshot = null;
    this.commitActiveEditorInput();
    await this.flushDraftPersistence();
    // FileView cannot veto a tab close. Keep an immutable in-memory handoff and
    // ask after Obsidian has finished closing the editor, like Atlas does.
    const closedDraft = this.takeClosedDraft();
    this.contentEl.replaceChildren();
    this.contentEl.classList.remove('statblock-forge__template-editor-content');
    this.promptForClosedDraft(closedDraft);
  }

  /** Capture and detach the current draft before this view changes files or closes. */
  private takeClosedDraft(filePath: string | null = this.file?.path ?? null): ClosedTemplateEditorDraft | null {
    const draft = this.captureClosedDraft(filePath);
    this.statblockPreviewData = null;
    this.statblockPreviewSampleSnapshot = null;
    dismissActiveComponentHelpTooltip();
    this.clearRecoveryPersistenceTimer();
    this.recoveryDraftId = null;
    this.persistedRecoveryDraftId = null;
    this.discardingRecoveryDraftId = null;
    this.lastPersistedRecoveryContentSnapshot = null;
    this.pendingRecoveryContentSnapshot = null;
    this.jsonStatusElement = null;
    this.jsonDraftText = null;
    this.jsonAppliedText = null;
    this.jsonStatus = '';
    this.template = null;
    this.layout = null;
    this.editorDirtyBaseline = null;
    return draft;
  }

  /** Ask after the incoming file has loaded, leaving that file visible in its current tab. */
  private promptForClosedDraft(closedDraft: ClosedTemplateEditorDraft | null): void {
    if (!closedDraft) return;
    const language = normalizeForgeLanguage(this.plugin.settings.language);
    this.plugin.markEditorRecoveryDraftPrompted(closedDraft.recoveryDraftId);
    window.setTimeout(() => {
      new UnsavedTemplateChangesModal(
        this.app,
        language,
        closedDraft.displayName,
        () => this.reopenClosedDraft(closedDraft, true),
        () => this.reopenClosedDraft(closedDraft, false),
        () => this.plugin.discardTemplateEditorDraft(closedDraft.recoveryDraftId),
      ).open();
    }, 0);
  }

  private captureClosedDraft(filePath: string | null = this.file?.path ?? null): ClosedTemplateEditorDraft | null {
    if (!this.hasUnsavedChanges || !this.template || !this.layout || !this.editorDirtyBaseline) return null;
    this.recoveryDraftId ??= createTemplateEditorRecoveryDraftId();
    return {
      recoveryDraftId: this.recoveryDraftId,
      filePath,
      displayName: this.displayName,
      template: cloneJson(this.template),
      layout: cloneJson(this.layout),
      originalText: this.originalText,
      canOverwriteCurrentFile: this.canOverwriteCurrentFile,
      dirtyBaseline: { ...this.editorDirtyBaseline },
      jsonDraftText: this.jsonDraftText,
      jsonAppliedText: this.jsonAppliedText,
      jsonStatus: this.jsonStatus,
      sidebarMode: this.sidebarMode,
      sidebarTab: this.sidebarTab,
      compendiumFieldKey: this.compendiumFieldKey,
      compendiumFieldId: this.compendiumFieldId,
      compendiumEditingItemId: this.compendiumEditingItemId,
      selectedBlockId: this.selectedBlockId,
      selectedBlockIds: [...this.selectedBlockIds],
      selectedTemplateFieldKey: this.selectedTemplateFieldKey,
    };
  }

  /** Restore the closed editor's exact editable data while retaining its dirty baseline. */
  private restoreClosedDraft(draft: ClosedTemplateEditorDraft): void {
    this.statblockPreviewData = null;
    this.statblockPreviewSampleSnapshot = null;
    this.recoveryDraftId = draft.recoveryDraftId;
    this.persistedRecoveryDraftId = draft.recoveryDraftId;
    this.discardingRecoveryDraftId = null;
    this.displayName = draft.displayName;
    this.template = cloneJson(draft.template);
    this.layout = cloneJson(draft.layout);
    this.originalText = this.file ? draft.originalText : null;
    this.canOverwriteCurrentFile = this.file ? draft.canOverwriteCurrentFile : !draft.filePath;
    this.editorDirtyBaseline = { ...draft.dirtyBaseline };
    this.jsonDraftText = draft.jsonDraftText;
    this.jsonAppliedText = draft.jsonAppliedText;
    this.jsonStatus = draft.jsonStatus;
    this.lastPersistedRecoveryContentSnapshot = templateEditorDraftContentSnapshot(
      draft.template, draft.layout, draft.jsonDraftText, draft.jsonAppliedText,
    );
    this.pendingRecoveryContentSnapshot = null;
    this.sidebarMode = draft.sidebarMode;
    this.sidebarTab = draft.sidebarTab;
    this.compendiumFieldKey = draft.compendiumFieldKey ?? null;
    this.compendiumFieldId = draft.compendiumFieldId ?? null;
    this.compendiumEditingItemId = draft.compendiumEditingItemId ?? null;
    this.selectedBlockId = draft.selectedBlockId;
    this.selectedBlockIds = [...draft.selectedBlockIds];
    this.selectedTemplateFieldKey = draft.selectedTemplateFieldKey;
    this.render();
  }

  private async reopenClosedDraft(draft: ClosedTemplateEditorDraft, openSaveDialog: boolean): Promise<void> {
    const leaf = this.app.workspace.getLeaf('tab');
    if (!leaf) throw new Error('Não foi possível abrir uma aba para recuperar o rascunho.');
    const source = draft.filePath
      ? this.app.vault.getAbstractFileByPath(draft.filePath)
      : null;
    const sourceFile = source instanceof TFile ? source : null;
    await leaf.setViewState({
      type: STATBLOCK_FORGE_EDITOR_VIEW,
      state: sourceFile ? { file: sourceFile.path } : {},
      active: true,
    });
    await leaf.loadIfDeferred();
    if (!(leaf.view instanceof TemplateEditorView)) throw new Error('O editor de templates não ficou disponível.');
    const editor = leaf.view;
    if (sourceFile) {
      if (editor.getLoadedFilePath() !== sourceFile.path) await editor.loadTemplate(sourceFile);
    } else {
      await editor.loadTemplate(null);
    }
    editor.restoreClosedDraft(draft);
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
    await this.app.workspace.revealLeaf(leaf);
    if (openSaveDialog) window.setTimeout(() => editor.openSaveDialog(), 0);
  }

  async restorePersistedDraft(draft: ClosedTemplateEditorDraft, openSaveDialog: boolean): Promise<void> {
    const source = draft.filePath ? this.app.vault.getAbstractFileByPath(draft.filePath) : null;
    await this.loadTemplate(source instanceof TFile ? source : null);
    this.restoreClosedDraft(draft);
    this.app.workspace.setActiveLeaf(this.leaf, { focus: true });
    await this.app.workspace.revealLeaf(this.leaf);
    if (openSaveDialog) window.setTimeout(() => this.openSaveDialog(), 0);
  }

  async loadTemplate(file: TFile | null): Promise<void> {
    this.statblockPreviewDiceCleanup?.();
    this.statblockPreviewDiceCleanup = null;
    this.statblockPreviewData = null;
    this.statblockPreviewSampleSnapshot = null;
    this.missingTemplatePath = null;
    this.file = file;
    this.jsonDraftText = null;
    this.jsonAppliedText = null;
    this.jsonStatus = '';
    this.warnings = [];
    this.statblockMode = false;
    this.expandedCanvasSectionIds.clear();
    this.collapsedCanvasSectionIds.clear();
    this.collapsedRecoveryButtonIds.clear();
    if (file) {
      const text = await this.app.vault.cachedRead(file);
      const parsed = parseTemplateFileText(text, file.extension);
      this.template = parsed.template;
      this.warnings = [...parsed.warnings];
      const duplicateTemplateIds = (await createTemplateVaultStorage(this.app).listTemplateIds())
        .filter((entry) => entry.id.toLowerCase() === parsed.template.id.toLowerCase() && entry.path !== file.path);
      if (duplicateTemplateIds.length > 0) {
        this.warnings.push(`Este template compartilha o ID "${parsed.template.id}" com outro arquivo (${duplicateTemplateIds.map((entry) => entry.path).join(', ')}). Atualizar este arquivo fica bloqueado até resolver a colisão; salvar como cópia gera um ID novo.`);
      }
      this.canOverwriteCurrentFile = parsed.canOverwrite;
      this.displayName = file.basename;
      this.originalText = text;
      this.layout = parsed.layout ?? await this.loadLayout(parsed.template);
    } else {
      this.displayName = 'New Template';
      this.template = createBlankTemplate(this.displayName);
      this.originalText = null;
      this.canOverwriteCurrentFile = true;
      this.layout = createForgeLayout(this.template);
    }
    this.rememberEditorDirtyBaseline();
    this.persistedRecoveryDraftId = null;
    this.discardingRecoveryDraftId = null;
    this.lastPersistedRecoveryContentSnapshot = templateEditorDraftContentSnapshot(
      this.template, this.layout, this.jsonDraftText, this.jsonAppliedText,
    );
    this.pendingRecoveryContentSnapshot = null;
    this.selectedBlockId = this.template.layout.blocks[0]?.id ?? null;
    this.selectedBlockIds = this.selectedBlockId ? [this.selectedBlockId] : [];
    this.selectedTemplateFieldKey = null;
    const firstCompendiumField = this.template.fields.find((field) => isForgeField(field) && isCollectionFieldType(field.type));
    this.compendiumFieldKey = firstCompendiumField?.key ?? null;
    this.compendiumFieldId = firstCompendiumField && this.layout ? ensureFieldId(this.layout, firstCompendiumField) : null;
    this.compendiumEditingItemId = null;
    this.headerFieldsOpen = false;
    this.propertiesDisclosureOpen.clear();
    this.setSidebarMode('fields');
    this.render();
  }

  private sidecarPath(template: ForgeTemplate): string {
    return `${this.plugin.settings.templateFolder}/.statblock-forge/layouts/${template.id}.json`;
  }

  private async loadLayout(template: ForgeTemplate): Promise<ForgeLayoutDocument> {
    const path = this.sidecarPath(template);
    const abstract = this.app.vault.getAbstractFileByPath(path);
    if (abstract instanceof TFile) {
      return parseForgeLayout(await this.app.vault.cachedRead(abstract), template);
    }
    return createForgeLayout(template);
  }

  private setSidebarMode(mode: 'fields' | 'field' | 'options' | 'json' | 'rests' | 'dice'): void {
    this.sidebarMode = mode;
    this.sidebarTab = mode === 'field' || mode === 'options' ? 'properties' : 'structure';
  }

  /** Clear Canvas and linked-Field selection when the user clicks elsewhere in the editor. */
  private handleCanvasOutsideClick(event: MouseEvent): void {
    if (!this.selectedBlockId && this.selectedBlockIds.length === 0 && !this.selectedTemplateFieldKey) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    // Block clicks are handled by their own listeners (which stop propagation).
    // Controls and disclosures must keep their own interaction/focus semantics.
    if (target.closest('[data-block-id]')) return;
    if (target.closest(
      'button,input,select,textarea,a,[contenteditable="true"],summary,details,' +
      '.statblock-forge__canvas-toolbar,.statblock-forge__more-tools,' +
      '.statblock-forge__field-row,.statblock-forge__properties-disclosure,' +
      '.statblock-forge__resize-handle',
    )) return;

    this.clearCanvasSelection();
  }

  /** Escape closes an active Canvas disclosure first; otherwise it deselects Canvas elements. */
  private handleCanvasSelectionKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('input,textarea,select,[contenteditable="true"]')) return;

    const openDisclosure = target?.closest<HTMLDetailsElement>('details[open]');
    if (openDisclosure && openDisclosure.matches(
      '.statblock-forge__canvas-action,.statblock-forge__more-tools,.statblock-forge__field-definitions,.statblock-forge__properties-disclosure',
    )) {
      openDisclosure.open = false;
      event.preventDefault();
      return;
    }

    if (!this.selectedBlockId && this.selectedBlockIds.length === 0 && !this.selectedTemplateFieldKey) return;
    event.preventDefault();
    this.clearCanvasSelection();
  }

  private clearCanvasSelection(): void {
    if (!this.selectedBlockId && this.selectedBlockIds.length === 0 && !this.selectedTemplateFieldKey) return;
    this.selectedBlockId = null;
    this.selectedBlockIds = [];
    this.selectedTemplateFieldKey = null;
    // Clear the contextual Fields mode without changing the user's active tab.
    // In particular, keep Properties open and show its empty-state message.
    if (this.sidebarMode === 'field' || this.sidebarMode === 'options') this.sidebarMode = 'fields';
    this.refreshSelectionView();
  }

  private renderSidebarNavigation(): HTMLElement {
    const language = normalizeForgeLanguage(this.plugin.settings.language);
    const navigation = el('div', 'statblock-forge__sidebar-navigation');
    navigation.setAttribute('role', 'group');
    navigation.setAttribute('aria-label', translateForgeText('Editor panels', language));
    const primary = el('div', 'statblock-forge__sidebar-navigation-primary');
    const secondary = el('div', 'statblock-forge__sidebar-navigation-secondary');

    const createTab = (id: 'structure' | 'properties' | 'appearance' | 'compendium', label: string): HTMLButtonElement => {
      const control = button(translateForgeText(label, language), () => {
        if (this.sidebarTab === id) return;
        // Leaving JSON applies the current draft first. Invalid JSON keeps the user
        // in the editor instead of silently discarding the draft.
        if (this.sidebarMode === 'json' && id !== 'structure') {
          this.closeJsonSidebar();
          if (this.sidebarMode === 'json') return;
        }
        if (id === 'structure') {
          this.setSidebarMode('fields');
        } else if (id === 'properties') {
          const validField = this.selectedTemplateFieldKey
            && templateFields(this.template as ForgeTemplate).some((field) => field.key === this.selectedTemplateFieldKey);
          if (this.sidebarMode === 'field' && validField) {
            this.setSidebarMode('field');
          } else if (this.selectedBlockId && findLayoutBlock(this.template as ForgeTemplate, this.selectedBlockId)) {
            this.setSidebarMode('options');
          } else if (validField) {
            this.setSidebarMode('field');
          } else {
            this.sidebarTab = 'properties';
            this.sidebarMode = 'fields';
          }
        } else if (id === 'compendium') {
          const fields = (this.template?.fields ?? []).filter((field) => isCollectionFieldType(field.type));
          const selectedField = fields.find((field) => this.layout && ensureFieldId(this.layout, field) === this.compendiumFieldId);
          const fallbackField = selectedField ?? fields[0];
          this.compendiumFieldKey = fallbackField?.key ?? null;
          this.compendiumFieldId = fallbackField && this.layout ? ensureFieldId(this.layout, fallbackField) : null;
          this.compendiumEditingItemId = null;
          this.sidebarMode = 'fields';
          this.sidebarTab = 'compendium';
        } else {
          this.sidebarTab = 'appearance';
        }
        this.render();
      }, true);
      control.classList.add('statblock-forge__sidebar-tab');
      control.classList.toggle('is-active', this.sidebarTab === id);
      control.setAttribute('aria-pressed', String(this.sidebarTab === id));
      control.dataset.sidebarTab = id;
      if (id === 'compendium') control.classList.add('statblock-forge__sidebar-tab--compendium');
      return control;
    };

    // Keep the library and visual theme together in the first row, with
    // structure and selection-specific settings directly beneath them.
    primary.append(
      createTab('compendium', 'Compendium'),
      createTab('appearance', 'Appearance'),
    );
    secondary.append(
      createTab('structure', 'Data'),
      createTab('properties', 'Properties'),
    );
    navigation.append(primary, secondary);
    return navigation;
  }

  private propertyDisclosure(
    key: string,
    summary: string,
    content: HTMLElement,
  ): HTMLDetailsElement {
    const details = el('details', 'statblock-forge__properties-disclosure');
    details.dataset.forgeDisclosure = `properties-${key}`;
    details.open = this.propertiesDisclosureOpen.get(key) ?? true;
    details.addEventListener('toggle', () => {
      this.propertiesDisclosureOpen.set(key, details.open);
    });
    details.append(el('summary', '', summary), content);
    return details;
  }

  private fieldKeysForBlock(block: ForgeBlock | null): string[] {
    if (!block) return [];
    const keys: string[] = [];
    const add = (value: unknown): void => {
      if (typeof value === 'string' && value.trim() && !keys.includes(value)) keys.push(value);
    };
    if (block.type !== 'scores') add(block.field);
    add(block.headingField);
    add(block.rollFrom);
    add(block.introField);
    if (Array.isArray(block.fields)) block.fields.forEach(add);
    if (isRecord(block.showWhen)) add(block.showWhen.field);
    if (block.type !== 'scores' && Array.isArray(block.columns)) {
      for (const column of block.columns) if (isRecord(column)) add(column.field);
    }
    return keys;
  }

  private renderCompendiumPanel(): HTMLElement {
    const template = this.template as ForgeTemplate;
    const layout = this.layout as ForgeLayoutDocument;
    const language = normalizeForgeLanguage(this.plugin.settings.language);
    const pt = language === 'pt-BR';
    const panel = section(translateForgeText('Compendium', language));
    panel.classList.add('statblock-forge__compendium-panel');
    const fields = template.fields.filter((field) => isForgeField(field) && isCollectionFieldType(field.type));
    const selectedField = fields.find((field) => ensureFieldId(layout, field) === this.compendiumFieldId);
    const activeField = selectedField ?? fields[0];
    this.compendiumFieldKey = activeField?.key ?? null;
    this.compendiumFieldId = activeField ? ensureFieldId(layout, activeField) : null;
    if (fields.length === 0) {
      panel.append(el('p', 'statblock-forge__empty-note', pt
        ? 'Adicione um Field de Collections.'
        : 'Add a Collections Field.'));
      return panel;
    }

    const fieldSelect = selectInput(this.compendiumFieldId ?? ensureFieldId(layout, fields[0]!), fields.map((field) => {
      const fieldLabel = field.label.trim();
      return {
        value: ensureFieldId(layout, field),
        // Show the internal key beside the user-facing label to disambiguate
        // Collections with similar or identical labels.
        label: fieldLabel && fieldLabel !== field.key ? `${fieldLabel} (${field.key})` : field.key,
      };
    }));
    fieldSelect.addEventListener('change', () => {
      const selected = fields.find((field) => ensureFieldId(layout, field) === fieldSelect.value);
      this.compendiumFieldKey = selected?.key ?? null;
      this.compendiumFieldId = selected ? ensureFieldId(layout, selected) : null;
      this.compendiumEditingItemId = null;
      this.render();
    });
    panel.append(labeledControl('Field', fieldSelect));

    const field = fields.find((item) => ensureFieldId(layout, item) === this.compendiumFieldId) ?? fields[0]!;
    const compatibleFields = fields.filter((candidate) => candidate.key !== field.key && candidate.type === field.type);
    let linkedSourceKey = fieldCompendiumSourceKey(layout, field);
    let linkedSource = compatibleFields.find((candidate) => candidate.key === linkedSourceKey) ?? null;
    if (linkedSourceKey && !linkedSource) {
      // A source Field may have been deleted or changed to an incompatible type.
      setFieldCompendiumSource(layout, field, null);
      linkedSourceKey = null;
    }
    if (compatibleFields.length > 0) {
      const sourceSelect = selectInput(linkedSourceKey ?? '', [
        { value: '', label: pt ? 'Compendium próprio' : 'Own Compendium' },
        ...compatibleFields.map((candidate) => ({
          value: candidate.key,
          label: `${candidate.label.trim() || candidate.key} (${candidate.key})`,
        })),
      ]);
      sourceSelect.setAttribute('aria-label', pt ? 'Usar Compendium de outra Collection' : 'Use another Collection Compendium');
      sourceSelect.addEventListener('change', () => {
        const nextSource = compatibleFields.find((candidate) => candidate.key === sourceSelect.value) ?? null;
        if (setFieldCompendiumSource(layout, field, nextSource)) this.render();
      });
      panel.append(labeledControl(
        pt ? 'Origem do Compendium' : 'Compendium source',
        sourceSelect,
        pt
          ? 'Compartilha a biblioteca de outra Collection do mesmo tipo. Os itens continuam armazenados no Field de origem.'
          : 'Share the library of another Collection of the same type. Items remain stored in the source Field.',
      ));
      if (linkedSource) {
        panel.append(el('small', 'statblock-forge__detail', pt
          ? `Esta Collection utiliza o Compendium de ${linkedSource.label.trim() || linkedSource.key}. Adições, edições e exclusões afetam a biblioteca compartilhada.`
          : `This Collection uses the Compendium from ${linkedSource.label.trim() || linkedSource.key}. Adding, editing, or deleting items changes the shared library.`));
      }
    }
    const items = fieldCompendiumItems(layout, field);
    const header = el('div', 'statblock-forge__compendium-list-heading');
    const title = el('div', 'statblock-forge__compendium-list-title');
    title.append(el('strong', '', field.label.trim() || field.key));
    title.append(el('small', '', `${items.length} ${pt ? 'itens' : 'items'}`));
    const add = button(pt ? '+ Novo' : '+ Add', () => {
      this.compendiumEditingItemId = '__new__';
      this.render();
    }, true);
    add.classList.add('statblock-forge__compendium-action-button', 'statblock-forge__compendium-add-button');
    header.append(title, add);
    panel.append(header);

    // Keep the create/edit form above the existing entries so it is immediately
    // visible when opened, rather than appending it below a potentially long list.
    if (this.compendiumEditingItemId) {
      const current = this.compendiumEditingItemId === '__new__'
        ? null
        : items.find((item) => item.id === this.compendiumEditingItemId) ?? null;
      if (current || this.compendiumEditingItemId === '__new__') {
        panel.append(this.renderCompendiumItemForm(field, current));
      }
    }

    const categories = compendiumCategories(items);
    const filters = el('div', 'statblock-forge__compendium-filters');
    const search = inputText('', pt ? 'Buscar...' : 'Search...');
    search.classList.add('statblock-forge__compendium-search');
    search.setAttribute('aria-label', pt ? 'Buscar conteúdo do Compendium' : 'Search Compendium content');
    const categoryFilter = selectInput('', [
      { value: '', label: pt ? 'Todas as categorias' : 'All categories' },
      ...categories.map((category) => ({ value: category, label: category })),
      ...(items.some((item) => !item.category?.trim()) ? [{ value: '__uncategorized__', label: pt ? 'Sem categoria' : 'Uncategorized' }] : []),
    ]);
    categoryFilter.setAttribute('aria-label', pt ? 'Filtrar por categoria' : 'Filter by category');
    filters.append(search, categoryFilter);
    panel.append(filters);

    const list = el('div', 'statblock-forge__compendium-items');
    if (items.length === 0) {
      list.append(el('p', 'statblock-forge__empty-note', pt
        ? 'Nenhum conteúdo.'
        : 'No content yet.'));
    }

    const grouped = new Map<string, typeof items>();
    for (const category of categories) grouped.set(category, items.filter((item) => (item.category ?? '').trim() === category));
    const uncategorized = items.filter((item) => !(item.category ?? '').trim());
    if (uncategorized.length) grouped.set('__uncategorized__', uncategorized);

    const itemRows: Array<{ row: HTMLElement; group: HTMLElement; searchText: string; category: string }> = [];
    for (const [categoryKey, categoryItems] of grouped) {
      const group = el('section', 'statblock-forge__compendium-category-group');
      group.dataset.category = categoryKey;
      const groupHeading = el('div', 'statblock-forge__compendium-category-heading');
      const categoryName = categoryKey === '__uncategorized__' ? (pt ? 'Sem categoria' : 'Uncategorized') : categoryKey;
      groupHeading.append(el('strong', '', categoryName));
      groupHeading.append(el('span', '', String(categoryItems.length)));
      group.append(groupHeading);
      for (const item of categoryItems) {
        const card = el('article', 'statblock-forge__compendium-item');
        const details = el('div', 'statblock-forge__compendium-item-content');
        const summary = field.type === 'entries' ? '' : compendiumSummary(field, item.value);
        if (field.type === 'entries') {
          details.append(renderCompendiumAbilityPreview(field, item.value, language, item.name));
        } else {
          details.append(el('strong', '', item.name));
          if (summary) details.append(el('p', '', summary));
        }
        const actions = el('div', 'statblock-forge__compendium-item-actions');
        const edit = button(pt ? 'Editar' : 'Edit', () => {
          this.compendiumEditingItemId = item.id;
          this.render();
        }, true);
        edit.classList.add('statblock-forge__compendium-action-button');
        edit.setAttribute('aria-label', `${pt ? 'Editar' : 'Edit'} ${item.name}`);
        edit.title = pt ? 'Editar' : 'Edit';
        actions.append(edit);
        const remove = button(pt ? 'Excluir' : 'Delete', () => this.confirmDelete(
          `${pt ? 'Conteúdo' : 'Compendium item'} “${item.name}”`,
          () => {
            removeFieldCompendiumItem(layout, field, item.id);
            if (this.compendiumEditingItemId === item.id) this.compendiumEditingItemId = null;
            this.render();
          },
        ), true);
        remove.classList.add('statblock-forge__compendium-action-button');
        remove.setAttribute('aria-label', `${pt ? 'Excluir' : 'Delete'} ${item.name}`);
        remove.title = pt ? 'Excluir' : 'Delete';
        actions.append(remove);
        card.append(details, actions);
        group.append(card);
        itemRows.push({ row: card, group, category: item.category?.trim() ?? '', searchText: `${item.name} ${summary} ${item.category ?? ''} ${JSON.stringify(item.value) ?? ''}`.toLocaleLowerCase() });
      }
      list.append(group);
    }

    const emptyResults = el('p', 'statblock-forge__empty-note', pt ? 'Nenhum resultado.' : 'No results.');
    emptyResults.hidden = true;
    const applyFilters = (): void => {
      const query = search.value.trim().toLocaleLowerCase();
      const selectedCategory = categoryFilter.value;
      let visibleCount = 0;
      const visibleByGroup = new Map<HTMLElement, number>();
      for (const item of itemRows) {
        const categoryMatches = !selectedCategory
          || (selectedCategory === '__uncategorized__' ? !item.category : item.category === selectedCategory);
        const visible = categoryMatches && (!query || item.searchText.includes(query));
        item.row.hidden = !visible;
        if (visible) {
          visibleCount += 1;
          visibleByGroup.set(item.group, (visibleByGroup.get(item.group) ?? 0) + 1);
        }
      }
      for (const group of grouped.keys()) {
        const node = Array.from(list.children).find((child): child is HTMLElement => child instanceof HTMLElement
          && child.classList.contains('statblock-forge__compendium-category-group') && child.dataset.category === group);
        if (node) node.hidden = !(visibleByGroup.get(node) ?? 0);
      }
      emptyResults.hidden = visibleCount > 0 || items.length === 0;
    };
    search.addEventListener('input', applyFilters);
    categoryFilter.addEventListener('change', applyFilters);
    list.append(emptyResults);
    panel.append(list);

    return panel;
  }

  private renderCompendiumItemForm(field: ForgeField, existing: { id: string; name: string; value: unknown; category?: string } | null): HTMLElement {
    const language = normalizeForgeLanguage(this.plugin.settings.language);
    const pt = language === 'pt-BR';
    const form = el('section', 'statblock-forge__compendium-form');
    form.append(el('h4', '', existing ? (pt ? 'Editar conteúdo' : 'Edit content') : (pt ? 'Novo conteúdo' : 'New content')));
    const name = inputText(existing?.name ?? '', pt ? 'Nome do conteúdo' : 'Content name');
    form.append(labeledControl(pt ? 'Nome' : 'Name', name));
    const category = inputText(existing?.category ?? '', pt ? 'Ex.: Ações, Traços, Reações' : 'e.g. Actions, Traits, Reactions');
    const categoryListId = `forge-compendium-categories-${ensureFieldId(this.layout as ForgeLayoutDocument, field)}`;
    category.setAttribute('list', categoryListId);
    const categoryList = el('datalist');
    categoryList.id = categoryListId;
    for (const categoryName of compendiumCategories(fieldCompendiumItems(this.layout, field))) {
      const option = el('option');
      option.value = categoryName;
      categoryList.append(option);
    }
    form.append(labeledControl(pt ? 'Categoria' : 'Category', category), categoryList);
    form.append(el('p', 'statblock-forge__compendium-category-help', pt
      ? 'Use uma categoria existente ou digite uma nova. As categorias pertencem somente a esta biblioteca.'
      : 'Choose an existing category or type a new one. Categories belong only to this Field library.'));
    const entryDraft = field.type === 'entries'
      ? inlineEntryDraftValue(field, existing?.value ?? {})
      : null;
    if (entryDraft) name.value = entryDraft.name || existing?.name || '';
    const listValue = field.type === 'list' && typeof existing?.value === 'string' ? existing.value : '';
    const pair = field.type === 'pairs' && isRecord(existing?.value)
      ? Object.entries(existing!.value as Record<string, unknown>)[0] ?? ['', '']
      : ['', ''];
    let spellGroups = field.type === 'spells' ? inlineSpellGroupsDraftValue(existing?.value ?? []) : [];
    if (field.type === 'spells' && spellGroups.length === 0) {
      spellGroups = [{ heading: '', lines: [{ level: pt ? 'Geral' : 'General', spells: '' }] }];
    }
    const entryInputs: Array<{ key: string; input: HTMLInputElement | HTMLTextAreaElement }> = [];
    let description: HTMLTextAreaElement | null = null;
    let listItem: HTMLInputElement | null = null;
    let pairKey: HTMLInputElement | null = null;
    let pairValue: HTMLInputElement | null = null;
    let spellGroupsRoot: HTMLElement | null = null;

    if (field.type === 'entries' && entryDraft) {
      description = textareaInput(entryDraft.text, pt ? 'Descrição da habilidade' : 'Ability description', 3);
      form.append(labeledControl(pt ? 'Descrição' : 'Description', description));
      const partsHeading = el('strong', 'statblock-forge__compendium-parts-heading', pt ? 'Partes' : 'Parts');
      form.append(partsHeading);
      for (const part of abilityPartsForField(field)) {
        if (part.type === 'counter') {
          const max = Math.max(1, Math.min(12, Math.floor(Number(entryDraft.counterMaxes[part.key] ?? part.max ?? 3))));
          const count = (entryDraft.counterMarks[part.key] ?? Array.from({ length: max }, () => false)).filter(Boolean).length;
          const input = numberInput(count, 0, max);
          entryInputs.push({ key: part.key, input });
          form.append(labeledControl(`${part.label} (${pt ? 'máx.' : 'max'} ${max})`, input));
        } else {
          const value = entryDraft.parts[part.key] ?? '';
          const input = part.type === 'text' || part.type === 'list'
            ? textareaInput(value, part.label, part.type === 'list' ? 2 : 3)
            : inputText(value, part.label);
          entryInputs.push({ key: part.key, input });
          form.append(labeledControl(part.label, input));
        }
      }
    } else if (field.type === 'list') {
      listItem = inputText(listValue, pt ? 'Texto do item' : 'Item text');
      form.append(labeledControl(pt ? 'Item' : 'Item', listItem));
    } else if (field.type === 'pairs') {
      pairKey = inputText(String(pair[0] ?? ''), pt ? 'Nome / rótulo' : 'Name / label');
      pairValue = inputText(String(pair[1] ?? ''), pt ? 'Número ou fórmula (ex.: +5 ou 2d8+3)' : 'Number or formula (e.g. +5 or 2d8+3)');
      form.append(labeledControl(pt ? 'Nome' : 'Name', pairKey), labeledControl(pt ? 'Valor' : 'Value', pairValue));
    } else if (field.type === 'spells') {
      spellGroupsRoot = el('div', 'statblock-forge__compendium-spell-groups');
      const renderSpellGroups = (): void => {
        if (!spellGroupsRoot) return;
        spellGroupsRoot.replaceChildren();
        spellGroups.forEach((group, groupIndex) => {
          const groupCard = el('section', 'statblock-forge__compendium-spell-group');
          const groupHeading = el('div', 'statblock-forge__compendium-spell-group-heading');
          groupHeading.append(el('strong', '', `${pt ? 'Grupo' : 'Group'} ${groupIndex + 1}`));
          groupHeading.append(button(pt ? 'Remover grupo' : 'Remove group', () => {
            spellGroups = spellGroups.filter((_item, index) => index !== groupIndex);
            renderSpellGroups();
          }, true));
          groupCard.append(groupHeading);
          const headingInput = inputText(group.heading, pt ? 'Ex.: Habilidades ofensivas' : 'e.g. Offensive abilities');
          headingInput.addEventListener('input', () => { group.heading = headingInput.value; });
          groupCard.append(labeledControl(pt ? 'Nome do grupo' : 'Group name', headingInput));
          const linesRoot = el('div', 'statblock-forge__compendium-spell-lines');
          group.lines.forEach((line, lineIndex) => {
            const lineCard = el('div', 'statblock-forge__compendium-spell-line');
            const lineHeading = el('div', 'statblock-forge__compendium-spell-line-heading');
            lineHeading.append(el('span', '', `${pt ? 'Categoria / uso' : 'Category / use'} ${lineIndex + 1}`));
            lineHeading.append(button(pt ? 'Remover' : 'Remove', () => {
              group.lines = group.lines.filter((_item, index) => index !== lineIndex);
              if (group.lines.length === 0) group.lines.push({ level: pt ? 'Geral' : 'General', spells: '' });
              renderSpellGroups();
            }, true));
            const levelInput = inputText(line.level, pt ? 'Ex.: 3 usos/dia, Fase 1, Recarga 5–6' : 'e.g. 3 uses/day, Phase 1, Recharge 5–6');
            levelInput.addEventListener('input', () => { line.level = levelInput.value; });
            const spellsInput = textareaInput(line.spells, pt ? 'Valores separados por vírgula' : 'Comma-separated values', 2);
            spellsInput.addEventListener('input', () => { line.spells = spellsInput.value; });
            lineCard.append(lineHeading,
              labeledControl(pt ? 'Categoria / uso' : 'Category / use', levelInput),
              labeledControl(pt ? 'Valores' : 'Values', spellsInput));
            linesRoot.append(lineCard);
          });
          groupCard.append(linesRoot);
          groupCard.append(button(pt ? '+ Adicionar categoria / uso' : '+ Add category / use', () => {
            group.lines.push({ level: pt ? 'Geral' : 'General', spells: '' });
            renderSpellGroups();
          }, true));
          spellGroupsRoot?.append(groupCard);
        });
      };
      renderSpellGroups();
      form.append(spellGroupsRoot);
      form.append(button(pt ? '+ Adicionar grupo' : '+ Add group', () => {
        spellGroups.push({ heading: '', lines: [{ level: pt ? 'Geral' : 'General', spells: '' }] });
        renderSpellGroups();
      }, true));
    }

    const error = el('p', 'statblock-forge__inline-field-editor-error');
    error.hidden = true;
    const actions = el('div', 'statblock-forge__compendium-form-actions');
    actions.append(button(pt ? 'Cancelar' : 'Cancel', () => {
      this.compendiumEditingItemId = null;
      this.render();
    }, true));
    actions.append(button(pt ? 'Salvar conteúdo' : 'Save content', () => {
      try {
        let value: unknown;
        let itemName = name.value.trim();
        if (field.type === 'entries' && entryDraft && description) {
          const draft = {
            ...entryDraft,
            name: itemName,
            text: description.value,
            parts: { ...entryDraft.parts },
            counterMarks: { ...entryDraft.counterMarks },
            counterMaxes: { ...entryDraft.counterMaxes },
          };
          for (const part of abilityPartsForField(field)) {
            const input = entryInputs.find((candidate) => candidate.key === part.key)?.input;
            if (!input) continue;
            if (part.type === 'counter') {
              const max = draft.counterMaxes[part.key] ?? Math.max(1, Math.min(12, Math.floor(Number(part.max) || 3)));
              const count = Math.max(0, Math.min(max, Math.floor(Number(input.value) || 0)));
              draft.counterMarks[part.key] = Array.from({ length: max }, (_value, index) => index < count);
            } else draft.parts[part.key] = input.value;
          }
          value = serializeInlineEntryDraft(field, existing?.value ?? undefined, draft);
          itemName = draft.name.trim();
        } else if (field.type === 'list' && listItem) {
          value = listItem.value.trim();
          itemName = itemName || String(value);
          if (!String(value).trim()) throw new Error(pt ? 'Informe o texto do item.' : 'Enter the item text.');
        } else if (field.type === 'pairs' && pairKey && pairValue) {
          const pairText = `${pairKey.value.trim()}: ${pairValue.value.trim()}`;
          const parsed = parseInlinePairText(pairText);
          if (!parsed) throw new Error(pt ? 'O valor precisa ser numérico ou uma fórmula de dados válida.' : 'The value must be numeric or a valid dice formula.');
          value = { [parsed.key]: parsed.value };
          itemName = itemName || parsed.key;
        } else if (field.type === 'spells' && spellGroupsRoot) {
          const groups: InlineSpellGroupDraft[] = spellGroups.map((group) => ({
            heading: group.heading.trim(),
            lines: group.lines.map((line) => ({ level: line.level.trim(), spells: line.spells.trim() })),
          }));
          const serialized = serializeInlineSpellGroups(groups, pt ? 'Geral' : 'General');
          if (!serialized?.length) throw new Error(pt ? 'Informe pelo menos um valor.' : 'Enter at least one value.');
          value = serialized;
          const firstGroup = groups.find((group) => group.heading || group.lines.some((line) => line.spells));
          const firstLine = firstGroup?.lines.find((line) => line.spells);
          itemName = itemName || firstGroup?.heading || firstLine?.spells.split(',')[0]?.trim() || (pt ? 'Grupo' : 'Group');
        } else {
          throw new Error(pt ? 'Não foi possível preparar este conteúdo.' : 'Could not prepare this content.');
        }
        if (!itemName) throw new Error(pt ? 'Informe um nome.' : 'Enter a name.');
        if (existing) updateFieldCompendiumItem(this.layout as ForgeLayoutDocument, field, existing.id, itemName, value, category.value);
        else addFieldCompendiumItem(this.layout as ForgeLayoutDocument, field, itemName, value, category.value);
        this.compendiumEditingItemId = null;
        this.render();
      } catch (caught) {
        error.textContent = caught instanceof Error ? caught.message : String(caught);
        error.hidden = false;
      }
    }, true));
    form.append(error, actions);
    return form;
  }

  private renderPropertiesPanel(): HTMLElement {
    const template = this.template as ForgeTemplate;
    const language = normalizeForgeLanguage(this.plugin.settings.language);
    const panel = section('Properties', 'Configure the selected Fields and Canvas block.');
    panel.classList.add('statblock-forge__properties-panel');
    const selectedBlock = this.selectedBlockId ? findLayoutBlock(template, this.selectedBlockId) : null;
    const fieldKeys = this.fieldKeysForBlock(selectedBlock);
    if (this.selectedTemplateFieldKey && template.fields.some((field) => isForgeField(field) && field.key === this.selectedTemplateFieldKey && field.type !== 'scores' && field.forgeInternal !== 'table-storage')
      && (this.sidebarMode === 'field' || !selectedBlock || fieldKeys.includes(this.selectedTemplateFieldKey))
      && !fieldKeys.includes(this.selectedTemplateFieldKey)) {
      fieldKeys.unshift(this.selectedTemplateFieldKey);
    }

    const appendSelectedBlockProperties = (): void => {
      if (!selectedBlock || !this.layout) return;
      const blockContent = this.renderBlockInspector();
      const blockLabelText = `${translateForgeText('Block', language)} · ${blockLabel(selectedBlock, template.fields)}`;
      panel.append(this.propertyDisclosure(`block:${selectedBlock.id}`, blockLabelText, blockContent));
    };

    // Text blocks now render arbitrary Markdown children (paragraphs, links,
    // lists, etc.). Keep their own layout settings at the top of Properties so
    // selecting the rendered Markdown does not leave the block inspector below
    // a long Field editor.
    if (selectedBlock?.type === 'text') appendSelectedBlockProperties();

    for (const fieldKey of fieldKeys) {
      const field = template.fields.find((item) => isForgeField(item) && item.key === fieldKey);
      if (!field) continue;
      const content = this.renderSelectedTemplateFieldProperties(field);
      const fieldLabel = `${translateForgeText('Field', language)} · ${field.label.trim() || field.key}`;
      panel.append(this.propertyDisclosure(`field:${field.key}`, fieldLabel, content));
    }

    if (selectedBlock && selectedBlock.type !== 'text') appendSelectedBlockProperties();

    if (fieldKeys.length === 0 && !selectedBlock) {
      panel.classList.add('statblock-forge__properties-empty');
      panel.append(el('p', 'statblock-forge__empty-note', language === 'pt-BR' ? 'Nenhum elemento selecionado.' : 'No element selected.'));
    }
    return panel;
  }

  private renderSidebar(): HTMLElement {
    const sidebar = el('aside', 'statblock-forge__editor-sidebar');
    sidebar.append(this.renderSidebarNavigation());

    if (this.sidebarTab === 'compendium') {
      sidebar.append(this.renderCompendiumPanel());
    } else if (this.sidebarTab === 'appearance') {
      const appearanceHeading = section('Appearance', 'Choose the statblock theme and customize its palette. Element-specific appearance remains available in Properties.');
      appearanceHeading.classList.add('statblock-forge__sidebar-section-heading');
      sidebar.append(appearanceHeading, this.renderThemeAppearanceSettings());
    } else if (this.sidebarTab === 'properties') {
      sidebar.append(this.renderPropertiesPanel());
    } else {
      sidebar.append(this.sidebarMode === 'json' ? this.renderJsonSidebar()
        : this.sidebarMode === 'rests' ? this.renderRecoverySidebar()
          : this.sidebarMode === 'dice' ? this.renderDiceSidebar() : this.renderFieldSidebar());
    }
    return sidebar;
  }

  /**
   * Restore the Canvas' own scrollport after its preview contents are rebuilt.
   * The preview column is clipped; the scrollable element is the inner dropzone.
   * The animation-frame restore runs before paint, after the new content has
   * participated in layout, and a sequence token prevents stale renders from
   * overriding a more recent scroll position.
   */
  private restoreCanvasScrollPosition(position: CanvasScrollPosition | null): void {
    if (!position) return;
    const sequence = ++this.canvasScrollRestoreSequence;
    const restore = (): void => {
      if (sequence !== this.canvasScrollRestoreSequence) return;
      const scrollport = this.contentEl.querySelector<HTMLElement>('.statblock-forge__canvas-dropzone');
      if (!scrollport) return;
      scrollport.scrollTop = position.top;
      scrollport.scrollLeft = position.left;
    };
    restore();
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(restore);
    }
  }

  /** Restore the surrounding Obsidian pane when a selection changes its content height. */
  private restoreEditorAncestorScrollPositions(positions: EditorAncestorScrollPosition[]): void {
    if (positions.length === 0) return;
    const sequence = ++this.editorViewportScrollRestoreSequence;
    const restore = (): void => {
      if (sequence !== this.editorViewportScrollRestoreSequence) return;
      for (const position of positions) {
        if (!position.element.isConnected) continue;
        position.element.scrollTop = position.top;
        position.element.scrollLeft = position.left;
      }
    };
    restore();
    const view = this.contentEl.ownerDocument.defaultView;
    if (view && typeof view.requestAnimationFrame === 'function') view.requestAnimationFrame(restore);
  }

  /**
   * Refreshes selection-dependent UI without replacing the FileView root.
   * Canvas selection is intentionally an in-place operation: replacing the
   * focused preview node can trigger browser scroll anchoring and move the
   * surrounding Obsidian pane unexpectedly.
   */
  private refreshSelectionView(refreshCanvas: boolean = false): void {
    const sidebar = this.contentEl.querySelector<HTMLElement>('.statblock-forge__editor-sidebar');
    const previewColumn = this.contentEl.querySelector<HTMLElement>('.statblock-forge__editor-preview-column');
    if (!sidebar || (refreshCanvas && !previewColumn)) {
      this.render();
      return;
    }

    dismissActiveComponentHelpTooltip();
    // Preserve explicitly keyed disclosure panels through the sidebar rebuild.
    captureDisclosureOpenState(this.contentEl, this.persistentDisclosureOpen);
    const ancestorScrollPositions = readEditorAncestorScrollPositions(this.contentEl);
    const sidebarScrollTop = sidebar.scrollTop;
    const nextSidebar = this.renderSidebar();
    // Selection refreshes replace only the sidebar, bypassing the full render()
    // localization pass. Localize the new Properties controls before attaching.
    localizeForgeElement(nextSidebar, normalizeForgeLanguage(this.plugin.settings.language));
    sidebar.replaceChildren(...Array.from(nextSidebar.childNodes));
    sidebar.scrollTop = sidebarScrollTop;

    if (refreshCanvas && previewColumn) {
      const canvasScrollPosition = readCanvasScrollPosition(previewColumn);
      previewColumn.replaceChildren(this.renderCanvas());
      this.restoreCanvasScrollPosition(canvasScrollPosition);
      this.restoreEditorAncestorScrollPositions(ancestorScrollPositions);
      return;
    }

    this.contentEl.querySelectorAll<HTMLElement>('.statblock-forge__canvas-sheet [data-block-id]').forEach((node) => {
      const blockId = node.dataset.blockId ?? '';
      const isPrimarySelection = blockId === this.selectedBlockId;
      node.classList.toggle('is-forge-selected', this.selectedBlockIds.includes(blockId));
      node.classList.toggle('is-forge-resize-selected', isPrimarySelection);
      const isSelected = this.selectedBlockIds.includes(blockId);
      const sectionSelectHandle = node.querySelector<HTMLButtonElement>(':scope > .statblock-forge__section-select-handle');
      if (sectionSelectHandle) sectionSelectHandle.setAttribute('aria-pressed', String(isSelected));
      const rowSelectHandle = node.querySelector<HTMLButtonElement>(':scope > .statblock-forge__row-select-handle');
      if (rowSelectHandle) rowSelectHandle.setAttribute('aria-pressed', String(isSelected));
      let resizeHandle = node.querySelector<HTMLButtonElement>(':scope > .statblock-forge__resize-handle');
      const canResize = canvasResizeParent(node) !== null;
      if (isPrimarySelection && canResize) {
        const block = findLayoutBlock(this.template as ForgeTemplate, blockId);
        if (block && !resizeHandle) this.attachResizeHandle(node, block);
        resizeHandle = node.querySelector<HTMLButtonElement>(':scope > .statblock-forge__resize-handle');
        if (resizeHandle) resizeHandle.tabIndex = 0;
      } else {
        // Keep the resize control out of the DOM for every unselected block;
        // CSS opacity alone made hidden grips discoverable and could leave
        // stale controls behind after in-place selection changes.
        resizeHandle?.remove();
        node.classList.remove('has-resize-handle');
      }
    });
    this.restoreEditorAncestorScrollPositions(ancestorScrollPositions);
  }

  private render(): void {
    if (!this.template || !this.layout) return;
    // Capture every keyed disclosure before any full editor rebuild. Some
    // confirmation actions call render() directly (rather than
    // refreshSelectionView()), so relying on the selection refresh path alone
    // makes the Text/Field Typography panels collapse after confirmation.
    captureDisclosureOpenState(this.contentEl, this.persistentDisclosureOpen);
    this.statblockPreviewDiceCleanup?.();
    this.statblockPreviewDiceCleanup = null;
    // Preserve the two independent scroll positions when the editor rerenders
    // after a field, block, theme or selection change.
    const ancestorScrollPositions = readEditorAncestorScrollPositions(this.contentEl);
    const previousSidebarScrollTop = this.contentEl.querySelector<HTMLElement>('.statblock-forge__editor-sidebar')?.scrollTop ?? null;
    const previousCanvasScrollPosition = readCanvasScrollPosition(this.contentEl);
    // Help examples are portaled to <body> so fixed viewport coordinates are
    // not offset by Obsidian's transformed workspace/modal containers.
    dismissActiveComponentHelpTooltip();
    const currentHeaderFields = this.contentEl.querySelector<HTMLDetailsElement>('details[data-forge-disclosure="header-fields"]');
    if (currentHeaderFields) this.headerFieldsOpen = currentHeaderFields.open;
    this.contentEl.querySelectorAll<HTMLDetailsElement>('details[data-forge-disclosure^="properties-"]').forEach((details) => {
      const key = details.dataset.forgeDisclosure?.slice('properties-'.length);
      if (key) this.propertiesDisclosureOpen.set(key, details.open);
    });
    const template = this.template;
    const existingRoot = this.contentEl.querySelector<HTMLElement>(':scope > .statblock-forge__editor');
    const activeElement = this.contentEl.ownerDocument.activeElement;
    const focusRegion = activeElement instanceof HTMLElement
      ? activeElement.closest<HTMLElement>(
        '.statblock-forge__editor-header, .statblock-forge__editor-sidebar, .statblock-forge__editor-preview-column',
      )
      : null;
    const focusRegionName = focusRegion?.classList.contains('statblock-forge__editor-header') ? 'header'
      : focusRegion?.classList.contains('statblock-forge__editor-sidebar') ? 'sidebar'
        : focusRegion?.classList.contains('statblock-forge__editor-preview-column') ? 'canvas' : null;
    const focusPath: number[] = [];
    if (activeElement instanceof HTMLElement && focusRegion) {
      let current: HTMLElement | null = activeElement;
      while (current && current !== focusRegion) {
        const parent: HTMLElement | null = current.parentElement;
        if (!parent) { focusPath.length = 0; break; }
        focusPath.unshift(Array.prototype.indexOf.call(parent.children, current) as number);
        current = parent;
      }
    }
    const focusSignature = activeElement instanceof HTMLElement ? {
      tagName: activeElement.tagName,
      type: activeElement instanceof HTMLInputElement || activeElement instanceof HTMLButtonElement
        ? activeElement.type : undefined,
      id: activeElement.id,
      name: activeElement.getAttribute('name') ?? '',
      ariaLabel: activeElement.getAttribute('aria-label') ?? '',
      labelText: activeElement.closest('label')?.querySelector<HTMLElement>('.statblock-forge__control-label')?.textContent?.trim() ?? '',
    } : null;
    const root = el('div', 'statblock-forge statblock-forge__editor');
    const header = el('header', 'statblock-forge__editor-header');
    const headerText = el('div');
    headerText.append(el('h2', 'statblock-forge__title', this.file ? 'Editar template' : 'Novo template'));
    const headerActions = el('div', 'statblock-forge__actions');
    const saveButton = button('Salvar', () => this.openSaveDialog());
    saveButton.classList.add('statblock-forge__save-button');
    headerActions.append(saveButton);
    const tools = el('details', 'statblock-forge__more-tools');
    tools.append(el('summary', '', 'Tools'));
    const toolActions = el('div', 'statblock-forge__more-tools-list');
    toolActions.append(button(this.sidebarMode === 'json' ? 'Close JSON' : 'Edit JSON', () => {
      if (this.sidebarMode === 'json') this.closeJsonSidebar();
      else this.openJsonSidebar();
    }, true));
    toolActions.append(button('Rest', () => this.openRestSidebar(), true));
    toolActions.append(button('Set Dice', () => { void this.openDiceSidebar(); }, true));
    if (this.file) {
      if (this.file.extension === FORGE_TEMPLATE_EXTENSION) {
      }
    }
    tools.append(toolActions);
    headerActions.append(tools);
    headerText.append(el('p', 'statblock-forge__editor-subtitle', this.displayName));
    header.append(headerText, headerActions);
    root.append(header);
    const warningLanguage = normalizeForgeLanguage(this.plugin.settings.language);
    for (const warning of this.warnings) {
      root.append(el('div', 'statblock-forge__warning', translateForgeText(warning, warningLanguage)));
    }

    const columns = el('div', 'statblock-forge__editor-columns');
    const sidebar = this.renderSidebar();
    const canvas = el('div', 'statblock-forge__editor-preview-column');
    canvas.append(this.renderCanvas());
    columns.append(sidebar, canvas);
    root.append(columns);

    localizeForgeElement(root, normalizeForgeLanguage(this.plugin.settings.language));

    // Keep the editor's scroll containers mounted across option changes. Replacing
    // the entire FileView root causes Chromium/Obsidian scroll anchoring to pick a
    // new anchor while controls are rebuilt; the result is a visible jump toward
    // the top even though the inner Canvas/sidebar scrollTop values are restored.
    const nextHeader = root.querySelector<HTMLElement>('.statblock-forge__editor-header');
    const nextSidebar = root.querySelector<HTMLElement>('.statblock-forge__editor-sidebar');
    if (nextSidebar) restoreDisclosureOpenState(nextSidebar, this.persistentDisclosureOpen);
    const nextCanvas = root.querySelector<HTMLElement>('.statblock-forge__editor-preview-column');
    const nextColumns = root.querySelector<HTMLElement>('.statblock-forge__editor-columns');
    const currentHeader = existingRoot?.querySelector<HTMLElement>(':scope > .statblock-forge__editor-header');
    const currentColumns = existingRoot?.querySelector<HTMLElement>(':scope > .statblock-forge__editor-columns');
    const currentSidebar = currentColumns?.querySelector<HTMLElement>(':scope > .statblock-forge__editor-sidebar');
    const currentCanvas = currentColumns?.querySelector<HTMLElement>(':scope > .statblock-forge__editor-preview-column');

    if (existingRoot && currentHeader && currentColumns && currentSidebar && currentCanvas
      && nextHeader && nextColumns && nextSidebar && nextCanvas) {
      currentHeader.replaceChildren(...Array.from(nextHeader.childNodes));
      for (const warning of Array.from(existingRoot.children)) {
        if (warning.classList.contains('statblock-forge__warning')) warning.remove();
      }
      for (const warning of Array.from(root.children)) {
        if (warning instanceof HTMLElement && warning.classList.contains('statblock-forge__warning')) {
          existingRoot.insertBefore(warning, currentColumns);
        }
      }
      currentSidebar.replaceChildren(...Array.from(nextSidebar.childNodes));
      currentCanvas.replaceChildren(...Array.from(nextCanvas.childNodes));
      currentColumns.className = nextColumns.className;
      existingRoot.className = root.className;

      if (previousSidebarScrollTop !== null) currentSidebar.scrollTop = previousSidebarScrollTop;
      this.restoreCanvasScrollPosition(previousCanvasScrollPosition);

      // Reattach focus to the equivalent control without asking the browser to
      // scroll it into view. This matters for selects/toggles that rebuild their
      // inspector after a change: keyboard users can continue from that control.
      const targetRegion = focusRegionName === 'header' ? currentHeader
        : focusRegionName === 'sidebar' ? currentSidebar
          : focusRegionName === 'canvas' ? currentCanvas : null;
      if (targetRegion && focusSignature) {
        let target: HTMLElement | null = targetRegion;
        for (const childIndex of focusPath) {
          const child = target?.children.item(childIndex);
          if (!(child instanceof HTMLElement)) { target = null; break; }
          target = child;
        }
        const matchesSignature = (candidate: HTMLElement): boolean =>
          candidate.tagName === focusSignature.tagName
          && (!focusSignature.type || !('type' in candidate) || (candidate as HTMLInputElement).type === focusSignature.type);
        if (!target || !matchesSignature(target)) {
          const candidates = Array.from(targetRegion.querySelectorAll<HTMLElement>(
            'button,input,select,textarea,summary,[tabindex]',
          ));
          target = candidates.find((candidate) => {
            if (!matchesSignature(candidate)) return false;
            if (focusSignature.id && candidate.id !== focusSignature.id) return false;
            if (focusSignature.name && candidate.getAttribute('name') !== focusSignature.name) return false;
            if (focusSignature.ariaLabel && candidate.getAttribute('aria-label') !== focusSignature.ariaLabel) return false;
            if (focusSignature.labelText) {
              const label = candidate.closest('label')?.querySelector<HTMLElement>('.statblock-forge__control-label')?.textContent?.trim() ?? '';
              if (label !== focusSignature.labelText) return false;
            }
            return true;
          }) ?? null;
        }
        if (target && matchesSignature(target) && typeof target.focus === 'function') {
          target.focus({ preventScroll: true });
        }
      }
    } else {
      this.contentEl.replaceChildren(root);
      const mountedSidebar = root.querySelector<HTMLElement>('.statblock-forge__editor-sidebar');
      if (mountedSidebar && previousSidebarScrollTop !== null) mountedSidebar.scrollTop = previousSidebarScrollTop;
      this.restoreCanvasScrollPosition(previousCanvasScrollPosition);
    }
    this.restoreEditorAncestorScrollPositions(ancestorScrollPositions);
    this.scheduleDraftPersistence();
  }

  private showNotice(message: string, duration?: number): void {
    const language = normalizeForgeLanguage(this.plugin.settings.language);
    new Notice(translateForgeText(message, language), duration);
  }

  private confirmDelete(itemName: string, onConfirm: () => void): void {
    new DestructiveActionConfirmationModal(
      this.app,
      normalizeForgeLanguage(this.plugin.settings.language),
      itemName,
      onConfirm,
    ).open();
  }

  private confirmResetAppearance(itemName: string, onConfirm: () => void): void {
    const language = normalizeForgeLanguage(this.plugin.settings.language);
    new DestructiveActionConfirmationModal(
      this.app,
      language,
      itemName,
      onConfirm,
      undefined,
      {
        title: translateForgeText('Confirm appearance reset', language),
        question: language === 'pt-BR'
          ? `Deseja realmente restaurar a aparência padrão de ${itemName}?`
          : `Are you sure you want to restore the default ${itemName}?`,
        confirmLabel: translateForgeText('Restore', language),
        detail: translateForgeText('Only visual settings will be reset. Content and values will remain unchanged.', language),
      },
    ).open();
  }

  private commitActiveEditorInput(): void {
    const active = this.contentEl.ownerDocument.activeElement;
    if (!active || !this.contentEl.contains(active)) return;
    if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement)) return;
    active.dispatchEvent(new Event('change', { bubbles: true }));
  }

  private clearRecoveryPersistenceTimer(): void {
    if (this.recoveryPersistenceTimer !== null) window.clearTimeout(this.recoveryPersistenceTimer);
    this.recoveryPersistenceTimer = null;
  }

  private scheduleDraftPersistence(): void {
    const currentSnapshot = templateEditorDraftContentSnapshot(
      this.template, this.layout, this.jsonDraftText, this.jsonAppliedText,
    );
    if (!this.hasUnsavedChanges || !this.template || !this.layout) {
      this.clearRecoveryPersistenceTimer();
      this.pendingRecoveryContentSnapshot = null;
      const recoveryDraftId = this.recoveryDraftId;
      if (recoveryDraftId && this.persistedRecoveryDraftId === recoveryDraftId) {
        void this.discardPersistedRecoveryDraft(recoveryDraftId);
      } else if (recoveryDraftId && this.discardingRecoveryDraftId !== recoveryDraftId) {
        // The debounce had not fired yet, so no recovery record exists in
        // data.json. Drop the local draft ID without issuing a JSON write.
        this.recoveryDraftId = null;
        if (currentSnapshot !== null) this.lastPersistedRecoveryContentSnapshot = currentSnapshot;
      } else if (currentSnapshot !== null && !recoveryDraftId) {
        this.lastPersistedRecoveryContentSnapshot = currentSnapshot;
      }
      return;
    }
    if (!shouldPersistTemplateEditorDraftContent(
      currentSnapshot,
      this.lastPersistedRecoveryContentSnapshot,
      this.pendingRecoveryContentSnapshot,
    )) {
      // A render caused by selecting a block, changing tabs or opening a
      // disclosure must not refresh the debounce or rewrite plugin data.json.
      if (currentSnapshot === this.lastPersistedRecoveryContentSnapshot) {
        this.clearRecoveryPersistenceTimer();
        this.pendingRecoveryContentSnapshot = null;
      }
      return;
    }
    this.recoveryDraftId ??= createTemplateEditorRecoveryDraftId();
    this.clearRecoveryPersistenceTimer();
    this.pendingRecoveryContentSnapshot = currentSnapshot;
    this.recoveryPersistenceTimer = window.setTimeout(() => {
      this.recoveryPersistenceTimer = null;
      this.pendingRecoveryContentSnapshot = null;
      void this.persistCurrentDraft();
    }, 500);
  }

  private async persistCurrentDraft(): Promise<void> {
    const draft = this.captureClosedDraft();
    if (!draft) return;
    const contentSnapshot = templateEditorDraftContentSnapshot(
      draft.template, draft.layout, draft.jsonDraftText, draft.jsonAppliedText,
    );
    try {
      await this.plugin.persistTemplateEditorDraft(draft);
      // Do not let a delayed write from a view being replaced overwrite the
      // recovery bookkeeping of the template that is now open in this view.
      if (this.recoveryDraftId === draft.recoveryDraftId) {
        this.persistedRecoveryDraftId = draft.recoveryDraftId;
        this.lastPersistedRecoveryContentSnapshot = contentSnapshot;
        // The user may have reverted the template while this asynchronous
        // write was in flight. Remove that stale recovery record immediately.
        if (!this.hasUnsavedChanges) await this.discardPersistedRecoveryDraft(draft.recoveryDraftId);
      } else {
        await this.plugin.discardTemplateEditorDraft(draft.recoveryDraftId);
      }
    } catch (error) {
      this.showNotice(`Não foi possível salvar uma cópia de recuperação: ${error instanceof Error ? error.message : String(error)}`, 10000);
    }
  }

  private async discardPersistedRecoveryDraft(recoveryDraftId: string): Promise<void> {
    if (this.persistedRecoveryDraftId !== recoveryDraftId
      || this.discardingRecoveryDraftId === recoveryDraftId) return;
    this.discardingRecoveryDraftId = recoveryDraftId;
    try {
      await this.plugin.discardTemplateEditorDraft(recoveryDraftId);
      if (this.persistedRecoveryDraftId === recoveryDraftId) this.persistedRecoveryDraftId = null;
      const currentSnapshot = templateEditorDraftContentSnapshot(
        this.template, this.layout, this.jsonDraftText, this.jsonAppliedText,
      );
      if (!this.hasUnsavedChanges) {
        this.lastPersistedRecoveryContentSnapshot = currentSnapshot;
        if (this.recoveryDraftId === recoveryDraftId) this.recoveryDraftId = null;
      } else {
        // The saved recovery record was removed while the user was editing
        // again. Force the pending content to be written under the same ID.
        this.lastPersistedRecoveryContentSnapshot = null;
      }
    } catch (error) {
      this.showNotice(`Não foi possível remover o rascunho recuperável: ${error instanceof Error ? error.message : String(error)}`, 8000);
    } finally {
      if (this.discardingRecoveryDraftId === recoveryDraftId) this.discardingRecoveryDraftId = null;
    }
  }

  private async flushDraftPersistence(): Promise<void> {
    this.clearRecoveryPersistenceTimer();
    this.pendingRecoveryContentSnapshot = null;
    if (this.hasUnsavedChanges && this.template && this.layout) {
      await this.persistCurrentDraft();
      return;
    }
    if (this.recoveryDraftId && this.persistedRecoveryDraftId === this.recoveryDraftId) {
      const recoveryDraftId = this.recoveryDraftId;
      await this.discardPersistedRecoveryDraft(recoveryDraftId);
    } else {
      this.recoveryDraftId = null;
      this.persistedRecoveryDraftId = null;
      this.pendingRecoveryContentSnapshot = null;
    }
  }

  private async clearPersistedDraftAfterSave(): Promise<void> {
    this.clearRecoveryPersistenceTimer();
    this.pendingRecoveryContentSnapshot = null;
    this.lastPersistedRecoveryContentSnapshot = templateEditorDraftContentSnapshot(
      this.template, this.layout, this.jsonDraftText, this.jsonAppliedText,
    );
    const recoveryDraftId = this.recoveryDraftId;
    if (!recoveryDraftId || this.persistedRecoveryDraftId !== recoveryDraftId) {
      this.recoveryDraftId = null;
      this.persistedRecoveryDraftId = null;
      return;
    }
    try {
      await this.plugin.discardTemplateEditorDraft(recoveryDraftId);
      if (this.recoveryDraftId === recoveryDraftId) this.recoveryDraftId = null;
      if (this.persistedRecoveryDraftId === recoveryDraftId) this.persistedRecoveryDraftId = null;
    } catch (error) {
      this.showNotice(`Template salvo, mas a cópia de recuperação não pôde ser removida: ${error instanceof Error ? error.message : String(error)}`, 10000);
    }
  }

  private openJsonSidebar(): void {
    if (!this.template) return;
    this.jsonDraftText = serializeForgeEditorTemplate(this.template);
    this.jsonAppliedText = this.jsonDraftText;
    this.jsonStatus = '';
    this.setSidebarMode('json');
    this.render();
  }

  private closeJsonSidebar(): void {
    if (this.jsonDraftText !== null && this.jsonDraftText !== this.jsonAppliedText) {
      if (!this.applyJsonDraft()) return;
    }
    this.jsonDraftText = null;
    this.jsonAppliedText = null;
    this.jsonStatus = '';
    this.jsonStatusElement = null;
    this.setSidebarMode('fields');
    this.render();
  }

  private setJsonStatus(message: string, invalid = false): void {
    this.jsonStatus = message;
    if (!this.jsonStatusElement) return;
    this.jsonStatusElement.textContent = message;
    this.jsonStatusElement.classList.toggle('is-error', invalid);
    this.jsonStatusElement.classList.toggle('is-success', !invalid && Boolean(message));
    this.jsonStatusElement.setAttribute('role', invalid ? 'alert' : 'status');
  }

  private applyJsonDraft(): boolean {
    if (!this.template || !this.layout || this.jsonDraftText === null) return true;
    const reading = readTemplateJson(this.jsonDraftText, this.template.id);
    if (!reading.template) {
      this.setJsonStatus(`Not applied: ${reading.problems.join(' ')}`, true);
      return false;
    }

    const nextTemplate = reading.template;
    const nextLayout = reconcileLayoutAfterJsonEdit(nextTemplate, this.layout);
    const changed = JSON.stringify(nextTemplate) !== JSON.stringify(this.template)
      || JSON.stringify(nextLayout) !== JSON.stringify(this.layout);
    this.template = nextTemplate;
    this.layout = nextLayout;
    if (this.selectedBlockId && !findLayoutBlock(nextTemplate, this.selectedBlockId)) {
      this.selectedBlockId = nextTemplate.layout.blocks[0]?.id ?? null;
      this.selectedBlockIds = this.selectedBlockId ? [this.selectedBlockId] : [];
    } else {
      this.selectedBlockIds = this.selectedBlockIds.filter((id) => Boolean(findLayoutBlock(nextTemplate, id)));
      if (this.selectedBlockId && !this.selectedBlockIds.includes(this.selectedBlockId)) {
        this.selectedBlockIds = [this.selectedBlockId];
      }
    }

    const canonical = serializeForgeEditorTemplate(nextTemplate);
    this.jsonDraftText = canonical;
    this.jsonAppliedText = canonical;
    const notices = [...reading.warnings];
    if (changed) notices.unshift('JSON changes applied to the preview.');
    this.jsonStatus = notices.join(' ');

    const active = this.contentEl.querySelector<HTMLTextAreaElement>('.statblock-forge__json-editor');
    const selection = active ? [active.selectionStart, active.selectionEnd] as const : null;
    const scrollTop = active?.scrollTop ?? 0;
    const keepFocus = active !== null && document.activeElement === active;
    this.render();
    if (keepFocus) {
      const next = this.contentEl.querySelector<HTMLTextAreaElement>('.statblock-forge__json-editor');
      if (next) {
        next.focus({ preventScroll: true });
        if (selection) next.setSelectionRange(selection[0], selection[1]);
        next.scrollTop = scrollTop;
      }
    }
    return true;
  }

  private renderJsonSidebar(): HTMLElement {
    const template = this.template as ForgeTemplate;
    const panel = section('Edit JSON', 'Edit the Forge Template JSON. Field types use the reorganized Forge IDs; Apply JSON normalizes them for the editor and Forge JSON save. Typing does not refresh the preview.');
    panel.classList.add('statblock-forge__json-panel');
    const header = el('div', 'statblock-forge__json-header');
    const heading = panel.querySelector<HTMLElement>('.statblock-forge__panel-title');
    if (heading) {
      panel.prepend(header);
      header.append(heading);
    }
    const canonical = serializeForgeEditorTemplate(template);
    if (this.jsonDraftText === null || this.jsonDraftText === this.jsonAppliedText) {
      this.jsonDraftText = canonical;
      this.jsonAppliedText = canonical;
    }

    const search = el('input', 'statblock-forge__input statblock-forge__json-search') as HTMLInputElement;
    search.type = 'search';
    search.placeholder = normalizeForgeLanguage(this.plugin.settings.language) === 'pt-BR'
      ? 'Buscar palavras no JSON' : 'Search words in JSON';
    search.setAttribute('aria-label', search.placeholder);

    const editor = textareaInput(this.jsonDraftText, 'Forge template JSON', 24);
    editor.classList.add('statblock-forge__json-editor');
    editor.spellcheck = false;
    editor.setAttribute('autocapitalize', 'off');
    editor.setAttribute('autocorrect', 'off');
    editor.addEventListener('input', () => {
      // Keep keystrokes in this live textarea. Parsing and rendering here would
      // rebuild the sidebar while the user is typing and reset the JSON editor.
      this.jsonDraftText = editor.value;
      this.setJsonStatus(translateForgeText(
        'JSON draft changed. Apply JSON to update the preview.',
        normalizeForgeLanguage(this.plugin.settings.language),
      ));
      // The editor's delegated input listener schedules recovery persistence;
      // it does not reload this textarea or apply the JSON.
    });

    const status = el('div', 'statblock-forge__json-status', this.jsonStatus);
    status.setAttribute('role', this.jsonStatus.startsWith('Not applied:') ? 'alert' : 'status');
    if (this.jsonStatus.startsWith('Not applied:')) status.classList.add('is-error');
    else if (this.jsonStatus) status.classList.add('is-success');
    this.jsonStatusElement = status;

    const searchActions = el('div', 'statblock-forge__json-search-actions');
    searchActions.setAttribute('role', 'group');
    searchActions.setAttribute('aria-label', normalizeForgeLanguage(this.plugin.settings.language) === 'pt-BR'
      ? 'Pesquisar no JSON' : 'Search JSON');
    const searchStatus = el('span', 'statblock-forge__json-search-status');
    searchStatus.setAttribute('role', 'status');
    searchStatus.setAttribute('aria-live', 'polite');
    let lastSearch = '';
    let matchIndexes: JsonSearchMatch[] = [];
    let activeMatch = -1;
    const noMatchLabel = (): string => normalizeForgeLanguage(this.plugin.settings.language) === 'pt-BR'
      ? 'Nenhum resultado' : 'No matches';
    const matchCountLabel = (count: number): string => {
      if (normalizeForgeLanguage(this.plugin.settings.language) === 'pt-BR') {
        return `${count} ${count === 1 ? 'resultado' : 'resultados'}`;
      }
      return `${count} ${count === 1 ? 'match' : 'matches'}`;
    };
    const updateSearchStatus = (): void => {
      if (!lastSearch) {
        searchStatus.setText('');
      } else if (matchIndexes.length === 0) {
        searchStatus.setText(noMatchLabel());
      } else if (activeMatch < 0) {
        searchStatus.setText(matchCountLabel(matchIndexes.length));
      } else {
        searchStatus.setText(`${activeMatch + 1} / ${matchIndexes.length}`);
      }
    };
    const collectMatches = (): void => {
      matchIndexes = findJsonTextMatches(editor.value, search.value);
    };
    const revealActiveMatch = (): void => {
      const match = matchIndexes[activeMatch];
      if (!match) {
        editor.setSelectionRange(0, 0);
        return;
      }
      revealJsonTextMatch(editor, match);
    };
    const updateSearchPreview = (): void => {
      lastSearch = search.value.trim();
      collectMatches();
      // Live preview makes the first occurrence visible while the user types.
      // If the JSON textarea itself emitted this event, only refresh the count:
      // never replace the user's JSON caret/selection while they are editing.
      const searchHasFocus = search.ownerDocument.activeElement === search;
      activeMatch = matchIndexes.length > 0 && searchHasFocus ? 0 : -1;
      if (activeMatch >= 0) revealActiveMatch();
      updateSearchStatus();
    };
    const findNext = (backwards = false): void => {
      const query = search.value.trim();
      if (!query) {
        lastSearch = '';
        matchIndexes = [];
        activeMatch = -1;
        updateSearchStatus();
        editor.setSelectionRange(0, 0);
        search.focus({ preventScroll: true });
        return;
      }
      if (query !== lastSearch) {
        lastSearch = query;
        collectMatches();
        activeMatch = matchIndexes.length > 0 ? 0 : -1;
      } else if (matchIndexes.length > 0) {
        activeMatch = backwards
          ? (activeMatch <= 0 ? matchIndexes.length - 1 : activeMatch - 1)
          : (activeMatch + 1) % matchIndexes.length;
      }
      revealActiveMatch();
      updateSearchStatus();
      // Arrow buttons take focus on click. Return it to the search input, but
      // never focus the textarea; its selection and scroll position persist.
      search.focus({ preventScroll: true });
    };
    const previousMatchButton = button('↑', () => findNext(true), true);
    previousMatchButton.classList.add('statblock-forge__json-search-nav');
    previousMatchButton.setAttribute('aria-label', normalizeForgeLanguage(this.plugin.settings.language) === 'pt-BR'
      ? 'Resultado anterior' : 'Previous match');
    previousMatchButton.title = previousMatchButton.getAttribute('aria-label') ?? '';
    const nextMatchButton = button('↓', () => findNext(false), true);
    nextMatchButton.classList.add('statblock-forge__json-search-nav');
    nextMatchButton.setAttribute('aria-label', normalizeForgeLanguage(this.plugin.settings.language) === 'pt-BR'
      ? 'Próximo resultado' : 'Next match');
    nextMatchButton.title = nextMatchButton.getAttribute('aria-label') ?? '';
    search.addEventListener('input', updateSearchPreview);
    editor.addEventListener('input', updateSearchPreview);
    search.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); findNext(event.shiftKey); }
      else if (event.key === 'Escape' && search.value) {
        event.preventDefault();
        search.value = '';
        updateSearchPreview();
      }
    });
    searchActions.append(search, previousMatchButton, nextMatchButton, searchStatus);
    header.append(searchActions);

    const actions = el('div', 'statblock-forge__json-actions');
    actions.append(button('Reset draft', () => {
      const language = normalizeForgeLanguage(this.plugin.settings.language);
      new DestructiveActionConfirmationModal(this.app, language, 'JSON draft', () => {
        const fresh = serializeForgeEditorTemplate(this.template as ForgeTemplate);
        this.jsonDraftText = fresh;
        this.jsonAppliedText = fresh;
        this.jsonStatus = '';
        this.render();
      }, undefined, {
        title: language === 'pt-BR' ? 'Redefinir rascunho JSON?' : 'Reset JSON draft?',
        question: language === 'pt-BR'
          ? 'Deseja descartar as alterações não aplicadas e restaurar o JSON atual do template?'
          : 'Discard unapplied changes and restore the current template JSON?',
        confirmLabel: language === 'pt-BR' ? 'Redefinir rascunho' : 'Reset draft',
        detail: language === 'pt-BR' ? 'As alterações não aplicadas serão perdidas.' : 'Unapplied changes will be lost.',
      }).open();
    }, true));
    actions.append(button('Apply JSON', () => { this.applyJsonDraft(); }, true));
    actions.append(button('Done', () => this.closeJsonSidebar()));
    panel.append(editor, status, actions);
    return panel;
  }

  private openRestSidebar(): void {
    if (this.jsonDraftText !== null && this.jsonDraftText !== this.jsonAppliedText && !this.applyJsonDraft()) return;
    this.setSidebarMode('rests');
    this.render();
  }

  private async openDiceSidebar(): Promise<void> {
    if (this.jsonDraftText !== null && this.jsonDraftText !== this.jsonAppliedText && !this.applyJsonDraft()) return;
    this.setSidebarMode('dice');
    this.diceOptions = diceSetOptions([]);
    this.render();
    const files = this.app.vault.getFiles().filter((file: TFile) => file.path.startsWith('atlas-vtt/dice-sets/')
      && file.extension.toLowerCase() === 'json');
    const stored: DiceSetOption[] = [];
    for (const file of files) {
      try {
        const option = readDiceSetOption(JSON.parse(await this.app.vault.cachedRead(file)), file.path);
        if (option) stored.push(option);
      } catch {
        // Invalid files are ignored here; the source remains untouched in the Vault.
      }
    }
    if (this.sidebarMode !== 'dice' || !this.template) return;
    this.diceOptions = diceSetOptions(stored);
    this.render();
  }

  private updateRecoveryButtons(buttons: readonly RecoveryButton[]): void {
    if (!this.template) return;
    const remainingIds = new Set(buttons.map((item) => item.id));
    for (const id of this.collapsedRecoveryButtonIds) {
      if (!remainingIds.has(id)) this.collapsedRecoveryButtonIds.delete(id);
    }
    setRecoveryButtons(this.template, buttons);
    this.render();
  }

  private renderRecoverySidebar(): HTMLElement {
    const template = this.template as ForgeTemplate;
    const panel = section('Rest', 'Configure what a rest restores and optional choices offered to players.');
    panel.classList.add('statblock-forge__recovery-panel');
    panel.append(button('← Fields', () => { this.setSidebarMode('fields'); this.render(); }, true));

    const raw = template.recovery;
    if (raw !== undefined && !Array.isArray(raw)) {
      panel.append(el('p', 'statblock-forge__warning', 'The recovery property is not an array. Edit it in JSON to preserve and repair the original data.'));
      return panel;
    }
    const buttons = recoveryButtonsForEditing(template);
    const recoveryDiagnostics = recoveryDiagnosticsOf(template);
    if (recoveryDiagnostics.length > 0) {
      panel.append(el('p', 'statblock-forge__warning', 'Some Rest entries contain rules or steps the Forge cannot interpret. Supported entries remain editable; unrecognized JSON is preserved.'));
      const details = el('ul', 'statblock-forge__recovery-diagnostics');
      recoveryDiagnostics.slice(0, 20).forEach((diagnostic) => details.append(el('li', '', diagnostic)));
      if (recoveryDiagnostics.length > 20) details.append(el('li', '', `And ${recoveryDiagnostics.length - 20} more issue(s).`));
      panel.append(details);
    }

    const addButton = button('Add Rest', () => {
      if (buttons.length >= MAX_RECOVERY_BUTTONS) return;
      this.updateRecoveryButtons([...buttons, createRecoveryButton(buttons)]);
    });
    addButton.classList.add('statblock-forge__recovery-add-rest');
    addButton.disabled = buttons.length >= MAX_RECOVERY_BUTTONS;
    panel.append(addButton, el('small', 'statblock-forge__hint', `${buttons.length}/${MAX_RECOVERY_BUTTONS} Rest buttons`));
    if (buttons.length === 0) panel.append(el('p', 'statblock-forge__empty-note', 'No Rest buttons configured.'));

    buttons.forEach((rest, restIndex) => {
      const card = el('section', 'statblock-forge__recovery-card');
      const titleRow = el('div', 'statblock-forge__recovery-card-head');
      const name = inputText(rest.name, 'Rest name');
      name.addEventListener('change', () => {
        const next = buttons.map((item) => item.id === rest.id ? { ...item, name: name.value.trim() } : item);
        this.updateRecoveryButtons(next);
      });
      titleRow.append(labeledControl('Name', name));
      const moveUp = button('↑', () => {
        if (restIndex < 1) return;
        const next = [...buttons];
        const current = next[restIndex];
        const previous = next[restIndex - 1];
        if (!current || !previous) return;
        next[restIndex - 1] = current;
        next[restIndex] = previous;
        this.updateRecoveryButtons(next);
      }, true);
      moveUp.disabled = restIndex === 0;
      const moveDown = button('↓', () => {
        if (restIndex >= buttons.length - 1) return;
        const next = [...buttons];
        const current = next[restIndex];
        const following = next[restIndex + 1];
        if (!current || !following) return;
        next[restIndex] = following;
        next[restIndex + 1] = current;
        this.updateRecoveryButtons(next);
      }, true);
      moveDown.disabled = restIndex >= buttons.length - 1;
      const removeRest = button('Delete Rest', () => this.confirmDelete(`Rest button “${rest.name || 'Rest'}”`, () => this.updateRecoveryButtons(buttons.filter((item) => item.id !== rest.id))), true);
      removeRest.classList.add('is-danger', 'statblock-forge__recovery-delete-button');
      removeRest.title = `Delete the ${rest.name || 'Rest'} button`;
      removeRest.setAttribute('aria-label', `Delete the ${rest.name || 'Rest'} button`);
      moveUp.classList.add('statblock-forge__recovery-order-button');
      moveDown.classList.add('statblock-forge__recovery-order-button');
      const collapsed = this.collapsedRecoveryButtonIds.has(rest.id);
      const cardBody = el('div', 'statblock-forge__recovery-card-content');
      cardBody.hidden = collapsed;
      const collapseRest = button(collapsed ? '▸' : '▾', () => {
        const nextCollapsed = !this.collapsedRecoveryButtonIds.has(rest.id);
        if (nextCollapsed) this.collapsedRecoveryButtonIds.add(rest.id);
        else this.collapsedRecoveryButtonIds.delete(rest.id);
        cardBody.hidden = nextCollapsed;
        card.classList.toggle('is-collapsed', nextCollapsed);
        collapseRest.textContent = nextCollapsed ? '▸' : '▾';
        collapseRest.setAttribute('aria-expanded', String(!nextCollapsed));
        const language = normalizeForgeLanguage(this.plugin.settings.language);
        const accessibleLabel = nextCollapsed ? 'Expand Rest settings' : 'Collapse Rest settings';
        collapseRest.setAttribute('aria-label', translateForgeText(accessibleLabel, language));
        collapseRest.title = translateForgeText(accessibleLabel, language);
      }, true);
      collapseRest.classList.add('statblock-forge__recovery-collapse-button');
      collapseRest.setAttribute('aria-expanded', String(!collapsed));
      const collapseLabel = translateForgeText(collapsed ? 'Expand Rest settings' : 'Collapse Rest settings', normalizeForgeLanguage(this.plugin.settings.language));
      collapseRest.setAttribute('aria-label', collapseLabel);
      collapseRest.title = collapseLabel;
      titleRow.append(moveUp, moveDown, collapseRest, removeRest);
      card.classList.toggle('is-collapsed', collapsed);

      const updateRest = (nextRest: RecoveryButton): void => this.updateRecoveryButtons(buttons.map((item) => item.id === rest.id ? nextRest : item));
      cardBody.append(this.renderRecoveryRules(rest.rules, (rules) => updateRest({ ...rest, rules }), `Rules (${rest.rules.length}/${MAX_RECOVERY_RULES})`));
      cardBody.append(this.renderRecoveryChoices(rest, updateRest));
      card.append(titleRow, cardBody);
      panel.append(card);
    });
    return panel;
  }

  private renderRecoveryRules(
    rules: RecoveryRule[],
    onChange: (rules: RecoveryRule[]) => void,
    heading = 'Rules',
  ): HTMLElement {
    const group = el('div', 'statblock-forge__recovery-rules');
    const title = el('div', 'statblock-forge__recovery-subtitle', heading);
    group.append(title);
    const template = this.template as ForgeTemplate;
    const collectionResourceFields = atlasResourceFieldKeysForTemplate(this.app, template);
    const fields = recoveryFields(template.fields, template.layout.blocks, template.header, collectionResourceFields);
    const fieldOptions = fields.map((field) => ({
      value: field.key,
      label: `${field.label.trim() || field.key} (${field.key})${collectionResourceFields.includes(field.key) ? ' · Atlas collection Resource' : ''}`,
    }));
    const restButtons = recoveryButtonsOf(template);

    const renderRule = (rule: RecoveryRule, index: number): HTMLElement => {
      const card = el('div', 'statblock-forge__recovery-rule');
      const head = el('div', 'statblock-forge__recovery-rule-head');
      const type = selectInput(rule.does, [
        { value: 'full', label: 'Restore to full' }, { value: 'amount', label: 'Restore formula' },
        { value: 'share', label: 'Restore a share' }, { value: 'set', label: 'Set value' },
        { value: 'spend', label: 'Spend another resource' },
      ]);
      type.addEventListener('change', () => {
        const nextKind = type.value as RecoveryRule['does'];
        const next = defaultRecoveryRuleForFields(nextKind, template.fields, template.layout.blocks, template.header, collectionResourceFields);
        onChange(rules.map((item, at) => at === index ? next : item));
      });
      const removeRule = button('×', () => this.confirmDelete(`recovery rule ${index + 1}`, () => onChange(rules.filter((_item, at) => at !== index))), true);
      removeRule.classList.add('is-danger', 'statblock-forge__destructive-icon-button');
      removeRule.setAttribute('aria-label', `Remove recovery rule ${index + 1}`);
      head.append(type, removeRule);
      card.append(head);

      const currentField = rule.target.field;
        const target = selectInput(currentField, fieldOptions);
        target.addEventListener('change', () => {
          const selectedField = fields.find((field) => field.key === target.value);
          const targetValue = selectedField?.type === 'counters'
            ? { kind: 'counters' as const, field: target.value, rows: 'all' as const }
            : { kind: 'resource' as const, field: target.value };
          onChange(rules.map((item, at) => at === index ? { ...rule, target: targetValue } as RecoveryRule : item));
        });
        card.append(labeledControl('Target field', target));
        if (rule.target.kind === 'counters') {
          const counterTarget = rule.target;
          card.append(this.renderRecoveryRowsSelector(counterTarget.rows, restButtons, (rows) => {
            onChange(rules.map((item, at) => at === index
              ? { ...rule, target: { ...counterTarget, rows } } as RecoveryRule : item));
          }));
        }

      const update = (patch: Partial<RecoveryRule>): void => onChange(rules.map((item, at) => at === index ? { ...rule, ...patch } as RecoveryRule : item));
      if (rule.does === 'amount') {
        const formula = inputText(rule.formula, 'Formula');
        formula.addEventListener('change', () => update({ formula: formula.value } as Partial<RecoveryRule>));
        card.append(labeledControl('Formula', formula));
        const min = numberInput(rule.min ?? 0, 0);
        if (rule.min === undefined) min.value = '';
        min.addEventListener('change', () => update({ min: min.value.trim() === '' ? undefined : min.valueAsNumber } as Partial<RecoveryRule>));
        card.append(labeledControl('Minimum (optional)', min));
      } else if (rule.does === 'share') {
        const share = selectInput(String(rule.share), [{ value: '0.25', label: '25%' }, { value: '0.5', label: '50%' }]);
        share.addEventListener('change', () => update({ share: Number(share.value) as 0.25 | 0.5 } as Partial<RecoveryRule>));
        const round = selectInput(rule.round, [{ value: 'down', label: 'Round down' }, { value: 'up', label: 'Round up' }]);
        round.addEventListener('change', () => update({ round: round.value as 'down' | 'up' } as Partial<RecoveryRule>));
        card.append(labeledControl('Share', share), labeledControl('Rounding', round));
        const min = numberInput(rule.min ?? 0, 0);
        if (rule.min === undefined) min.value = '';
        min.addEventListener('change', () => update({ min: min.value === '' ? undefined : min.valueAsNumber } as Partial<RecoveryRule>));
        card.append(labeledControl('Minimum (optional)', min));
      } else if (rule.does === 'set') {
        const useField = typeof rule.to === 'object' && rule.to !== null;
        card.append(toggleControl('Use another field as the value', useField, (checked) => update({ to: checked ? { field: fieldOptions[0]?.value ?? '' } : 0 } as Partial<RecoveryRule>)));
        if (useField) {
          const numericOptions = template.fields.filter((field) => isForgeField(field) && (field.type === 'number' || field.type === 'rating')).map((field) => ({ value: field.key, label: `${field.label.trim() || field.key} (${field.key})` }));
          const valueField = selectInput(typeof rule.to === 'object' && rule.to !== null ? rule.to.field : '', numericOptions);
          valueField.addEventListener('change', () => update({ to: { field: valueField.value } } as Partial<RecoveryRule>));
          card.append(labeledControl('Value field', valueField));
        } else {
          const value = numberInput(typeof rule.to === 'number' ? rule.to : 0, 0);
          value.addEventListener('change', () => update({ to: value.valueAsNumber } as Partial<RecoveryRule>));
          card.append(labeledControl('Value', value));
        }
      } else if (rule.does === 'spend') {
        const source = selectInput(rule.from.field, fieldOptions);
        source.addEventListener('change', () => {
          const sourceField = fields.find((field) => field.key === source.value);
          update({ from: sourceField?.type === 'counters'
            ? { kind: 'counters', field: source.value, rows: 'all' }
            : { kind: 'resource', field: source.value } } as Partial<RecoveryRule>);
        });
        card.append(labeledControl('Spend from', source));
        const each = inputText(rule.each, 'Formula');
        each.addEventListener('change', () => update({ each: each.value } as Partial<RecoveryRule>));
        card.append(labeledControl('Per unit', each));
        const most = numberInput(rule.most ?? 0, 0);
        if (rule.most === undefined) most.value = '';
        most.addEventListener('change', () => update({ most: most.value === '' ? undefined : most.valueAsNumber } as Partial<RecoveryRule>));
        card.append(labeledControl('Maximum spent (optional)', most));
      }
      if (fieldOptions.length === 0) card.append(el('small', 'statblock-forge__warning', 'Add a Counter field, a tracked Number field, or use a field read by a Resource in the Atlas collection.'));
      return card;
    };

    rules.forEach((rule, index) => group.append(renderRule(rule, index)));
    const add = button('Add rule', () => onChange([...rules, defaultRecoveryRuleForFields('full', template.fields, template.layout.blocks, template.header, collectionResourceFields)]), true);
    add.classList.add('statblock-forge__recovery-add-rule');
    add.disabled = rules.length >= MAX_RECOVERY_RULES;
    group.append(add);
    return group;
  }

  /** Mirrors Atlas' RowsChips: visible Rest names, stable IDs in stored data, and All rows. */
  private renderRecoveryRowsSelector(
    rows: 'all' | readonly string[],
    buttons: readonly RecoveryButton[],
    onChange: (rows: 'all' | string[]) => void,
  ): HTMLElement {
    const group = el('div', 'statblock-forge__recovery-row-filter');
    group.append(el('span', 'statblock-forge__control-label', 'Counter rows'));
    const chips = el('div', 'statblock-forge__recovery-row-chips');
    chips.setAttribute('role', 'group');
    chips.setAttribute('aria-label', 'Counter rows restored by these Rest buttons');

    const addChip = (label: string, selected: boolean, change: () => void): void => {
      const chip = button(label, change, true);
      chip.classList.add('statblock-forge__recovery-chip');
      chip.classList.toggle('is-selected', selected);
      chip.setAttribute('aria-pressed', String(selected));
      chips.append(chip);
    };

    addChip('All rows', rows === 'all', () => onChange('all'));
    buttons.forEach((rest) => {
      addChip(rest.name, rows !== 'all' && rows.includes(rest.id), () => {
        onChange(toggleRecoveryRows(rows, buttons, rest.id));
      });
    });
    group.append(chips);
    return group;
  }

  private renderRecoveryChoices(rest: RecoveryButton, onChange: (rest: RecoveryButton) => void): HTMLElement {
    const group = el('div', 'statblock-forge__recovery-choices');
    group.append(el('div', 'statblock-forge__recovery-subtitle', `Player choices (${rest.choices?.length ?? 0}/${MAX_RECOVERY_CHOICES})`));
    const choices = rest.choices ?? [];
    choices.forEach((choice, choiceIndex) => {
      const card = el('div', 'statblock-forge__recovery-choice');
      const updateChoice = (next: RecoveryChoice): void => onChange({
        ...rest,
        choices: choices.map((item) => item.id === choice.id ? normalizeRecoveryChoicePickLimits(next) : item),
      });
      const prompt = inputText(choice.prompt, 'Prompt shown to the player');
      prompt.addEventListener('change', () => updateChoice({ ...choice, prompt: prompt.value }));
      const pickCapacity = recoveryChoicePickCapacity(choice);
      const min = numberInput(choice.min, 0, pickCapacity);
      min.addEventListener('change', () => updateChoice(withRecoveryChoicePickLimit(choice, 'min', min.valueAsNumber)));
      const max = numberInput(choice.max, 1, pickCapacity);
      max.addEventListener('change', () => updateChoice(withRecoveryChoicePickLimit(choice, 'max', max.valueAsNumber)));
      const header = el('div', 'statblock-forge__recovery-rule-head');
      const removeStep = button('Remove step', () => this.confirmDelete(`Choice Step ${choiceIndex + 1}`, () => onChange({ ...rest, choices: choices.filter((item) => item.id !== choice.id) })), true);
      removeStep.classList.add('is-danger', 'statblock-forge__recovery-delete-button');
      header.append(el('strong', '', `Step ${choiceIndex + 1}`), removeStep);
      card.append(header, labeledControl('Prompt', prompt), labeledControl('Minimum picks', min), labeledControl('Maximum picks', max));
      if (choice.repeat !== true) {
        card.append(el('small', 'statblock-forge__hint', translateForgeText(
          'Without repeats, maximum picks cannot exceed the number of actions.',
          normalizeForgeLanguage(this.plugin.settings.language),
        )));
      }
      card.append(toggleControl('Allow the same action more than once', choice.repeat === true, (checked) => {
        const next = { ...choice };
        if (checked) next.repeat = true; else delete next.repeat;
        updateChoice(next);
      }));
      choice.actions.forEach((action, actionIndex) => {
        const actionCard = el('div', 'statblock-forge__recovery-action');
        const actionName = inputText(action.name, 'Action name');
        actionName.addEventListener('change', () => updateChoice({ ...choice, actions: choice.actions.map((item) => item.id === action.id ? { ...item, name: actionName.value.trim() } : item) }));
        const text = inputText(action.text ?? '', 'Optional player-facing description');
        text.addEventListener('change', () => updateChoice({ ...choice, actions: choice.actions.map((item) => item.id === action.id ? { ...item, text: text.value } : item) }));
        const actionHead = el('div', 'statblock-forge__recovery-rule-head');
        const removeAction = button('Remove', () => this.confirmDelete(`action “${action.name || `Action ${actionIndex + 1}`}”`, () => updateChoice({ ...choice, actions: choice.actions.filter((item) => item.id !== action.id) })), true);
        removeAction.classList.add('is-danger', 'statblock-forge__recovery-delete-button');
        actionHead.append(el('strong', '', `Action ${actionIndex + 1}`), removeAction);
        actionCard.append(actionHead, labeledControl('Name', actionName), labeledControl('Description', text));
        actionCard.append(toggleControl('May be taken for another character', action.forOthers === true, (checked) => {
          const next = { ...action };
          if (checked) next.forOthers = true; else delete next.forOthers;
          updateChoice({ ...choice, actions: choice.actions.map((item) => item.id === action.id ? next : item) });
        }));
        actionCard.append(this.renderRecoveryRules(action.rules, (rules) => updateChoice({
          ...choice, actions: choice.actions.map((item) => item.id === action.id ? { ...item, rules } : item),
        }), `Action rules (${action.rules.length}/${MAX_RECOVERY_RULES})`));
        card.append(actionCard);
      });
      const addAction = button('Add action', () => updateChoice({ ...choice, actions: [...choice.actions, createRecoveryAction(choice.actions)] }), true);
      addAction.classList.add('statblock-forge__recovery-add-action');
      addAction.disabled = choice.actions.length >= MAX_RECOVERY_ACTIONS;
      card.append(addAction);
      group.append(card);
    });
    const addChoice = button('Add choice step', () => onChange({ ...rest, choices: [...choices, createRecoveryChoice(choices)] }), true);
    addChoice.classList.add('statblock-forge__recovery-add-choice');
    addChoice.disabled = choices.length >= MAX_RECOVERY_CHOICES;
    group.append(addChoice);
    return group;
  }

  private renderDiceSidebar(): HTMLElement {
    const template = this.template as ForgeTemplate;
    const panel = section('Set Dice', 'Choose which dice set is used for bare stat bonuses in this template.');
    panel.append(button('← Fields', () => { this.setSidebarMode('fields'); this.render(); }, true));
    const options = [...this.diceOptions];
    const currentId = typeof template.diceSetId === 'string' ? template.diceSetId : null;
    if (currentId && !options.some((option) => option.id === currentId)) {
      options.push({ id: currentId, name: `Unavailable set (${currentId})`, details: 'This ID is not present in the Vault dice-set folder.' });
    }
    const select = selectInput(currentId ?? '', options.map((option) => ({ value: option.id ?? '', label: option.name })));
    select.addEventListener('change', () => {
      if (select.value) template.diceSetId = select.value;
      else delete template.diceSetId;
      this.render();
    });
    panel.append(labeledControl('Dice set', select, 'Collection default removes diceSetId and lets Atlas use the collection setting.'));
    const selected = options.find((option) => option.id === currentId) ?? options[0];
    if (selected) panel.append(el('p', 'statblock-forge__detail', selected.details));
    if (selected?.path) panel.append(el('small', 'statblock-forge__path', selected.path));
    return panel;
  }

  private renderHeaderFields(): HTMLElement {
    const context = this.templateFieldEditorContext();
    return renderTemplateHeaderFields({
      template: context.template,
      render: context.render,
      showNotice: context.showNotice,
      renderNumberFieldFormulaEditor: (field) => renderNumericFieldFormulaEditor(context, field),
    });
  }

  private renderFieldCard(field: ForgeField, showRemoveButton = true): HTMLElement {
    return renderTemplateFieldCard(this.templateFieldEditorContext(), field, showRemoveButton);
  }

  private templateSpecializedFieldEditorContext(): TemplateSpecializedFieldEditorContext {
    return {
      template: this.template as ForgeTemplate,
      language: normalizeForgeLanguage(this.plugin.settings.language),
      getLayout: () => this.layout,
      ensureLayout: () => {
        this.layout ??= createForgeLayout(this.template as ForgeTemplate);
        return this.layout;
      },
      render: () => this.render(),
      renderPreviewOnly: () => this.renderPreviewOnly(),
      showNotice: (message) => this.showNotice(message),
      confirmDelete: (itemName, onConfirm) => this.confirmDelete(itemName, onConfirm),
      getAbilityAppearanceAdvancedOpen: () => this.abilityAppearanceAdvancedOpen,
      setAbilityAppearanceAdvancedOpen: (open) => { this.abilityAppearanceAdvancedOpen = open; },
      renderColorControl: (name, current, onChange, description) =>
        this.renderColorControl(name, current, onChange, description),
    };
  }

  private templateFieldEditorContext(): TemplateFieldEditorContext {
    const specialized = this.templateSpecializedFieldEditorContext();
    return {
      template: this.template as ForgeTemplate,
      getLayout: () => this.layout,
      getSelectedTemplateFieldKey: () => this.selectedTemplateFieldKey,
      setSelectedTemplateFieldKey: (key) => { this.selectedTemplateFieldKey = key; },
      getAddFieldSelection: () => ({ category: this.addFieldCategory, type: this.addFieldType }),
      setAddFieldSelection: (category, type) => { this.addFieldCategory = category; this.addFieldType = type; },
      language: normalizeForgeLanguage(this.plugin.settings.language),
      render: () => this.render(),
      renderPreviewOnly: () => this.renderPreviewOnly(),
      showNotice: (message) => this.showNotice(message),
      confirmDelete: (itemName, onConfirm) => this.confirmDelete(itemName, onConfirm),
      removeField: (key) => this.removeField(key),
      renderComponentHelpPicker: (group, options, selectedValue, onSelect, sections) =>
        this.renderComponentHelpPicker(group, options, selectedValue, onSelect, sections),
      renderEntryExtras: (fields) => renderEntryExtras(specialized, fields),
      renderCounterPresets: (field) => renderCounterPresets(specialized, field),
      renderCheckboxFieldOptions: (field) => renderCheckboxFieldOptions(specialized, field),
    };
  }

  private renderComponentHelpPicker(
    group: ComponentHelpGroup,
    options: Array<{ value: string; label: string; disabled?: boolean }>,
    selectedValue: string,
    onSelect: (value: string) => void,
    sections?: Array<{ label: string; values: readonly string[] }>,
  ): HTMLElement {
    const language = normalizeForgeLanguage(this.plugin.settings.language);
    const themeId = normalizeStatblockThemeId(this.layout?.themeId);
    const picker = el('div', 'statblock-forge__help-picker');
    picker.setAttribute('role', 'group');
    picker.setAttribute('aria-label', translateForgeText(
      group === 'fields' ? 'Field categories' : group === 'fieldTypes' ? 'Field data types' : group === 'blocks' ? 'Block types' : 'Container types', language,
    ));
    const buttons: Array<{ button: HTMLButtonElement; wrapper: HTMLElement; value: string }> = [];
    const optionMap = new Map(options.map((option) => [option.value, option]));

    const appendOption = (value: string): void => {
      const option = optionMap.get(value);
      const help = componentHelpEntry(group, value);
      if (!option || !help) return;
      const wrapper = el('div', 'statblock-forge__help-choice');
      const trigger = button(translateForgeText(option.label, language), () => {
        if (option.disabled) return;
        for (const item of buttons) {
          const selected = item.value === value;
          item.button.classList.toggle('is-selected', selected);
          item.wrapper.classList.toggle('is-selected', selected);
          item.button.setAttribute('aria-pressed', String(selected));
        }
        onSelect(value);
      }, true);
      trigger.classList.add('statblock-forge__help-choice-trigger');
      trigger.classList.toggle('is-selected', value === selectedValue);
      wrapper.classList.toggle('is-selected', value === selectedValue);
      trigger.disabled = Boolean(option.disabled);
      trigger.setAttribute('aria-pressed', String(value === selectedValue));
      trigger.setAttribute('aria-describedby', `statblock-forge-help-${++componentHelpTooltipSequence}`);
      const tooltipId = trigger.getAttribute('aria-describedby') ?? '';
      const tooltip = el('div', 'statblock-forge__help-tooltip');
      tooltip.id = tooltipId;
      tooltip.setAttribute('role', 'tooltip');
      const examples = componentHelpExamples(group, value, help);
      const exampleStage = el('div', 'statblock-forge__help-example-stage');
      const exampleFooter = el('div', 'statblock-forge__help-example-footer');
      const exampleDots = el('div', 'statblock-forge__help-example-dots');
      const exampleCounter = el('span', 'statblock-forge__help-example-counter');
      exampleFooter.hidden = examples.length <= 1;
      exampleFooter.append(exampleDots, exampleCounter);
      tooltip.append(
        el('strong', 'statblock-forge__help-tooltip-title', translateForgeText(help.label, language)),
        el('p', 'statblock-forge__help-tooltip-description', help.description[language]),
        exampleStage,
        exampleFooter,
      );
      const positionTooltip = (): void => {
        // The tooltip lives under document.body, outside transformed workspace
        // panes. Its fixed coordinates therefore match getBoundingClientRect().
        if (!tooltip.isConnected) return;
        // Measure the hidden popup, then anchor it beside the hovered choice.
        tooltip.setCssStyles({ display: 'grid' });
        tooltip.setCssStyles({ visibility: 'hidden' });
        tooltip.setCssStyles({ maxHeight: '' });
        // In the Canvas block/container menus, anchor the preview to the
        // whole choices panel instead of the hovered button. Anchoring to an
        // individual button can make the preview flip over the neighboring
        // choices (especially for items in the right-hand column).
        const canvasChoicesPanel = (group === 'blocks' || group === 'containers')
          ? picker.closest<HTMLElement>('.statblock-forge__canvas-action-content')
          : null;
        const anchorRect = (canvasChoicesPanel ?? trigger).getBoundingClientRect();
        const popupRect = tooltip.getBoundingClientRect();
        const viewport = window.visualViewport;
        const viewportWidth = viewport?.width ?? window.innerWidth;
        const viewportHeight = viewport?.height ?? window.innerHeight;
        const viewportLeft = viewport?.offsetLeft ?? 0;
        const viewportTop = viewport?.offsetTop ?? 0;
        const anchor = {
          left: anchorRect.left, right: anchorRect.right, top: anchorRect.top, bottom: anchorRect.bottom,
          width: anchorRect.width, height: anchorRect.height,
        };
        const viewportSize = { width: viewportWidth, height: viewportHeight };
        let position = placeHelpTooltip(anchor, { width: popupRect.width, height: popupRect.height }, viewportSize);
        if (position.maxHeight !== undefined) {
          tooltip.setCssStyles({ maxHeight: `${position.maxHeight}px` });
          const constrainedRect = tooltip.getBoundingClientRect();
          position = placeHelpTooltip(anchor, { width: constrainedRect.width, height: constrainedRect.height }, viewportSize);
        }
        tooltip.dataset.placement = position.placement;
        tooltip.setCssStyles({ left: `${position.left + viewportLeft}px` });
        tooltip.setCssStyles({ top: `${position.top + viewportTop}px` });
        tooltip.setCssStyles({ visibility: '' });
        tooltip.setCssStyles({ display: '' });
      };
      let currentExampleIndex = 0;
      let rotationTimer: number | null = null;
      const clearExampleRotation = (): void => {
        if (rotationTimer !== null) window.clearInterval(rotationTimer);
        rotationTimer = null;
      };
      const renderExample = (index: number): void => {
        const spec: ComponentHelpExampleSpec = examples[index] ?? examples[0] ?? { kind: help.example };
        exampleStage.replaceChildren(renderComponentHelpExample(spec.kind, themeId, language, spec.variant ?? 0));
        exampleCounter.textContent = language === 'pt-BR'
          ? `Exemplo ${index + 1} de ${examples.length}`
          : `Example ${index + 1} of ${examples.length}`;
        exampleDots.replaceChildren(...examples.map((_, dotIndex) => {
          const dot = el('span', `statblock-forge__help-example-dot${dotIndex === index ? ' is-active' : ''}`);
          dot.setAttribute('aria-hidden', 'true');
          return dot;
        }));
        if (tooltip.isConnected) {
          positionTooltip();
          window.requestAnimationFrame(() => {
            if (activeComponentHelpTooltip === tooltip && wrapper.isConnected) positionTooltip();
          });
        }
      };
      renderExample(0);
      const hideTooltip = (): void => {
        clearExampleRotation();
        tooltip.dataset.visible = 'false';
        tooltip.remove();
        if (activeComponentHelpTooltip === tooltip) {
          activeComponentHelpTooltip = null;
          activeComponentHelpRotationCleanup = null;
        }
      };
      const showTooltip = (): void => {
        if (activeComponentHelpTooltip === tooltip && tooltip.dataset.visible === 'true') {
          positionTooltip();
          return;
        }
        if (activeComponentHelpTooltip && activeComponentHelpTooltip !== tooltip) {
          activeComponentHelpRotationCleanup?.();
          activeComponentHelpTooltip.remove();
          activeComponentHelpTooltip = null;
          activeComponentHelpRotationCleanup = null;
        }
        activeComponentHelpTooltip = tooltip;
        activeComponentHelpRotationCleanup = clearExampleRotation;
        if (!tooltip.isConnected) document.body.append(tooltip);
        tooltip.dataset.suppressed = 'false';
        tooltip.dataset.visible = 'true';
        // Re-measure for the current option. Canvas insert menus use the whole
        // choices panel as a stable side anchor; other pickers use this control.
        positionTooltip();
        tooltip.dataset.positioned = 'true';
        const allowAutomaticRotation = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (examples.length > 1 && allowAutomaticRotation) {
          rotationTimer = window.setInterval(() => {
            if (activeComponentHelpTooltip !== tooltip || !tooltip.isConnected || !wrapper.isConnected) {
              clearExampleRotation();
              return;
            }
            currentExampleIndex = (currentExampleIndex + 1) % examples.length;
            renderExample(currentExampleIndex);
          }, 2600);
        }
        window.requestAnimationFrame(() => {
          if (activeComponentHelpTooltip === tooltip && wrapper.isConnected) positionTooltip();
        });
      };
      trigger.addEventListener('pointerenter', showTooltip);
      trigger.addEventListener('focus', showTooltip);
      trigger.addEventListener('blur', () => {
        window.requestAnimationFrame(() => {
          if (!wrapper.matches(':hover') && !wrapper.matches(':focus-within')) hideTooltip();
        });
      });
      trigger.addEventListener('click', () => {
        tooltip.dataset.suppressed = 'true';
        hideTooltip();
      }, { capture: true });
      wrapper.addEventListener('mouseleave', () => {
        if (!wrapper.matches(':focus-within')) hideTooltip();
      });
      wrapper.append(trigger);
      picker.append(wrapper);
      buttons.push({ button: trigger, wrapper, value });
    };

    if (sections?.length) {
      for (const section of sections) {
        picker.append(el('div', 'statblock-forge__help-picker-heading', translateForgeText(section.label, language)));
        const row = el('div', 'statblock-forge__help-picker-options');
        const before = picker.childNodes.length;
        for (const value of section.values) appendOption(value);
        while (picker.childNodes.length > before) row.append(picker.childNodes[before]!);
        picker.append(row);
      }
    } else {
      const row = el('div', 'statblock-forge__help-picker-options');
      const before = picker.childNodes.length;
      for (const option of options) appendOption(option.value);
      while (picker.childNodes.length > before) row.append(picker.childNodes[before]!);
      picker.append(row);
    }
    return picker;
  }

  private openImageSampleActions(template: ForgeTemplate, fieldKey: string, socket: HTMLButtonElement): void {
    const sample = isRecord(template.sample) ? template.sample : {};
    const currentPath = typeof sample[fieldKey] === 'string' ? String(sample[fieldKey]).trim() : '';
    const language = normalizeForgeLanguage(this.plugin.settings.language);
    const isPortuguese = language === 'pt-BR';
    const layout = this.layout as ForgeLayoutDocument | null;
    const isPinned = isPinnedTemplateImage(layout, fieldKey);
    if (['image', 'token-image', 'token'].includes(fieldKey)) {
      this.showNotice(isPortuguese
        ? 'Arte do token deve ser vinculada pelo Atlas. Use um Field do tipo Image para imagens comuns.'
        : 'Token art must be linked through Atlas. Use an Image Field for ordinary pictures.');
      return;
    }
    openImageSocketActionsMenu(socket, {
      label: isPortuguese ? 'Ações da imagem de exemplo' : 'Image sample actions',
      actions: [
        {
          id: 'choose-sample-image',
          label: isPortuguese ? 'Escolher do Vault…' : 'Choose from Vault…',
          icon: 'image',
          run: () => this.openImagePicker(fieldKey),
        },
        {
          id: 'pin-sample-image',
          label: isPinned
            ? (isPortuguese ? 'Imagem fixada nos statblocks' : 'Image pinned to statblocks')
            : (isPortuguese ? 'Fixar imagem nos statblocks' : 'Pin image to statblocks'),
          icon: 'help',
          checked: isPinned,
          disabled: !currentPath || !layout,
          title: !currentPath
            ? (isPortuguese ? 'Escolha uma imagem primeiro.' : 'Choose an image first.')
            : undefined,
          run: () => {
            if (!layout) return;
            if (setPinnedTemplateImage(template, layout, fieldKey, !isPinned)) this.render();
            else if (!isPinned) this.showNotice(isPortuguese
              ? 'Escolha uma imagem para este Field antes de fixá-la.'
              : 'Choose an image for this Field before pinning it.');
          },
        },
        {
          id: 'clear-sample-image',
          label: isPortuguese ? 'Limpar imagem de exemplo' : 'Clear sample image',
          icon: 'clear',
          disabled: !currentPath || isPinned,
          title: isPinned
            ? (isPortuguese ? 'Desafixe a imagem antes de removê-la do template.' : 'Unpin the image before removing it from the template.')
            : undefined,
          run: () => this.confirmDelete('sample image', () => {
            if (setTemplateSampleImage(template, fieldKey, null, layout)) this.render();
          }),
        },
      ],
      ...(isPinned ? { hint: isPortuguese
        ? 'Esta imagem será incluída em todos os novos statblocks e não poderá ser substituída ou removida neles.'
        : 'This image is included in every new statblock and cannot be replaced or removed there.' } : {}),
    });
  }

  private openImagePicker(fieldKey: string): void {
    if (fieldKey === 'image') {
      this.showNotice('Token art is reserved for Atlas token links.');
      return;
    }
    const template = this.template as ForgeTemplate | null;
    if (!template || !fieldKey) return;
    const images = this.app.vault.getFiles().filter((file) => isSupportedVaultImagePath(file.path));
    if (images.length === 0) {
      this.showNotice('No supported image files were found in the Vault.');
      return;
    }
    new VaultImagePickerModal(this.app, (file) => {
      if (setTemplateSampleImage(template, fieldKey, file.path)) this.render();
    }, normalizeForgeLanguage(this.plugin.settings.language)).open();
  }

  private renderThemeAppearanceSettings(): HTMLElement {
    const content = renderTemplateThemeAppearance({
      layout: this.layout as ForgeLayoutDocument,
      language: normalizeForgeLanguage(this.plugin.settings.language),
      advancedOpen: this.themeAdvancedOpen,
      setAdvancedOpen: (open) => { this.themeAdvancedOpen = open; },
      tokenBorderOpen: this.tokenBorderAppearanceOpen,
      setTokenBorderOpen: (open) => { this.tokenBorderAppearanceOpen = open; },
      customThemes: this.plugin.settings.customThemes,
      customBorders: this.plugin.settings.customBorders,
      saveCustomTheme: (theme) => {
        this.plugin.settings.customThemes = [
          ...this.plugin.settings.customThemes.filter((item) => item.id !== theme.id),
          { ...theme, palette: { ...theme.palette } },
        ];
        void this.plugin.saveSettings();
      },
      deleteCustomTheme: (id) => this.confirmDelete('custom theme from the style library', () => {
        this.plugin.settings.customThemes = this.plugin.settings.customThemes.filter((item) => item.id !== id);
        void this.plugin.saveSettings();
        this.render();
      }),
      saveCustomBorder: (border) => {
        this.plugin.settings.customBorders = [
          ...this.plugin.settings.customBorders.filter((item) => item.id !== border.id),
          { ...border },
        ];
        void this.plugin.saveSettings();
      },
      deleteCustomBorder: (id) => this.confirmDelete('custom border from the style library', () => {
        this.plugin.settings.customBorders = this.plugin.settings.customBorders.filter((item) => item.id !== id);
        void this.plugin.saveSettings();
        this.render();
      }),
      exportStylePackage: (name, themes, borders) => this.plugin.exportStylePackage(name, themes, borders),
      importStyleFile: (file) => this.plugin.importStyleFile(file),
      render: () => this.render(),
      renderPreviewOnly: () => this.renderPreviewOnly(),
      confirmReset: (itemName, onConfirm) => this.confirmResetAppearance(itemName, onConfirm),
    });
    if (this.template && this.layout) {
      content.append(renderTemplateFieldTypographyInspector({
        template: this.template,
        layout: this.layout,
        language: normalizeForgeLanguage(this.plugin.settings.language),
        selectedFieldKey: this.appearanceFieldKey ?? this.selectedTemplateFieldKey,
        setSelectedFieldKey: (key) => { this.appearanceFieldKey = key; },
        render: () => this.render(),
        renderPreviewOnly: () => this.renderPreviewOnly(),
      }));
    }
    return content;
  }

  private renderBlockInspector(): HTMLElement {
    const template = this.template as ForgeTemplate;
    const block = this.selectedBlockId ? findLayoutBlock(template, this.selectedBlockId) : null;
    const panel = el('div', 'statblock-forge__properties-content statblock-forge__block-properties-content');
    if (!block || !this.layout) return panel;
    const meta = this.layout.blocks[block.id] ?? { span: 12, rows: 1, appearance: {}, appearanceMode: 'theme' as const };
    meta.appearanceMode ??= 'theme';
    this.layout.blocks[block.id] = meta;

    const specialized = this.templateSpecializedFieldEditorContext();
    renderBlockStructureProperties({
      template,
      layout: this.layout,
      block,
      renderLineBlockOptions: () => renderLineBlockOptions({
        template,
        block,
        lineAddingValueForBlockId: this.lineAddingValueForBlockId,
        setLineAddingValueForBlockId: (value) => { this.lineAddingValueForBlockId = value; },
        render: () => this.render(),
        showNotice: (message) => this.showNotice(message),
        confirmDelete: (itemName, onConfirm) => this.confirmDelete(itemName, onConfirm),
      }),
      render: () => this.render(),
      renderPreviewOnly: () => this.renderPreviewOnly(),
      showNotice: (message) => this.showNotice(message),
      confirmDelete: (itemName, onConfirm) => this.confirmDelete(itemName, onConfirm),
      setSidebarMode: (mode) => this.setSidebarMode(mode),
      selectBlock: (id) => {
        this.selectedBlockId = id;
        this.selectedBlockIds = id ? [id] : [];
      },
      setActiveTab: (containerId, tabId) => {
        if (tabId) this.activeTabsById.set(containerId, tabId);
        else this.activeTabsById.delete(containerId);
      },
      renderEntryExtras: (fields) => renderEntryExtras(specialized, fields),
    }, panel);

    const blockInspectorContext = {
      template,
      layout: this.layout as ForgeLayoutDocument,
      block,
      language: normalizeForgeLanguage(this.plugin.settings.language),
      render: () => this.render(),
      renderPreviewOnly: () => this.renderPreviewOnly(),
      showNotice: (message: string) => this.showNotice(message),
      confirmDelete: (itemName: string, onConfirm: () => void) => this.confirmDelete(itemName, onConfirm),
      confirmReset: (itemName: string, onConfirm: () => void) => this.confirmResetAppearance(itemName, onConfirm),
      openImagePicker: (fieldKey: string) => this.openImagePicker(fieldKey),
      resolveImage: (path: string) => resolveVaultImageResource(this.app, path, this.file?.path),
      getImagePreviewGeometry: (blockId: string) => {
        const blockNode = this.contentEl.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(blockId)}"]`);
        const viewport = blockNode?.querySelector<HTMLElement>('.statblock-forge__preview-image.is-portrait');
        if (!viewport) return undefined;
        const frame = viewport.querySelector<HTMLElement>('.statblock-forge__image-socket-frame') ?? viewport;
        const rect = frame.getBoundingClientRect();
        if (!(rect.width > 0 && rect.height > 0)) return undefined;
        const view = this.contentEl.ownerDocument.defaultView;
        const viewportStyle = view?.getComputedStyle(viewport);
        const frameStyle = view?.getComputedStyle(frame);
        return {
          aspectRatio: rect.width / rect.height,
          ...(viewportStyle?.clipPath && viewportStyle.clipPath !== 'none' ? { clipPath: viewportStyle.clipPath } : {}),
          ...(frameStyle?.borderRadius ? { borderRadius: frameStyle.borderRadius } : {}),
        };
      },
      getDisclosureOpen: (key: string) => this.propertiesDisclosureOpen.get(key) ?? false,
      setDisclosureOpen: (key: string, open: boolean) => this.propertiesDisclosureOpen.set(key, open),
      setTemplate: (next: ForgeTemplate) => { this.template = next; },
      renderFieldCard: (field: ForgeField, showRemoveButton = false) => this.renderFieldCard(field, showRemoveButton),
    };
    renderScoresBlockInspector(blockInspectorContext, panel);
    renderMetricBlockInspector(blockInspectorContext, panel);
    renderCountersBlockInspector(blockInspectorContext, panel);
    if (block.type === 'section' || block.type === 'row' || block.type === 'tabs') {
    }
    renderValueBlockInspector(blockInspectorContext, panel);
    if (block.type !== 'stat') {
      const noLabel = block.labelPlacement === 'none' || block.label === '';
      const labelMode = selectInput(noLabel ? 'none' : 'show', [
        { value: 'show', label: 'Show Label' },
        { value: 'none', label: 'No Label' },
      ]);
      labelMode.addEventListener('change', () => {
        if (labelMode.value === 'none') {
          // Keep the original heading/Field label intact. The explicit
          // placement flag suppresses every renderer label source, including
          // Section headings and headings resolved from a linked Field.
          block.labelPlacement = 'none';
        } else {
          delete block.labelPlacement;
          if (block.label === '') delete block.label;
        }
        this.renderPreviewOnly();
      });
      panel.append(labeledControl('Label', labelMode));
    }
    renderPlayerAccessInspector(blockInspectorContext, panel);
    const hasNumericTracking = hasNumericTrackingForBlock(template, block);

    // Span remains a 12-part relative value in saved template data. Nested
    // Section grids translate it into physical tracks in the renderer/packer.
    const span = numberInput(meta.span, 1, GRID_COLUMN_COUNT);
    span.addEventListener('change', () => { resizeLayoutBlock(this.layout as ForgeLayoutDocument, block, Number(span.value), meta.rows); this.render(); });
    const rows = numberInput(meta.rows, 1, MAX_BLOCK_ROWS);
    rows.addEventListener('change', () => { resizeLayoutBlock(this.layout as ForgeLayoutDocument, block, meta.span, Number(rows.value)); this.render(); });
    const inspectorLanguage = normalizeForgeLanguage(this.plugin.settings.language);
    const widthLabel = translateForgeText('Width (12 parts)', inspectorLanguage);
    const heightLabel = translateForgeText(`Altura (linhas — até ${MAX_BLOCK_ROWS.toLocaleString('pt-BR')})`, inspectorLanguage);
    panel.append(labeledControl(widthLabel, span), labeledControl(heightLabel, rows));

    panel.append(renderBlockAppearanceInspector({
      context: blockInspectorContext,
      metadata: meta,
      advancedOpen: this.blockAppearanceAdvancedOpen,
      setAdvancedOpen: (open) => { this.blockAppearanceAdvancedOpen = open; },
      hasNumericTracking,
      sectionsOpen: this.blockAppearanceSectionsOpen.get(block.id) ?? {},
      setSectionOpen: (section, open) => {
        const current = this.blockAppearanceSectionsOpen.get(block.id) ?? {};
        this.blockAppearanceSectionsOpen.set(block.id, { ...current, [section]: open });
      },
    }));
    const deleteBlockLabel = translateForgeText('Delete Block', inspectorLanguage);
    const deleteBlock = button(deleteBlockLabel, () => this.removeSelectedBlocks([block.id]), true);
    deleteBlock.classList.add('is-danger', 'statblock-forge__block-delete-button', 'statblock-forge__property-delete-button');
    deleteBlock.title = `${deleteBlockLabel}: ${blockLabel(block, template.fields)}`;
    deleteBlock.setAttribute('aria-label', `${deleteBlockLabel}: ${blockLabel(block, template.fields)}`);
    panel.append(deleteBlock);
    return panel;
  }

  private renderColorControl(
    name: string,
    current: string | undefined,
    onChange: (value: string | undefined) => void,
    description?: string,
  ): HTMLElement {
    return renderForgeColorControl({
      name,
      current,
      language: normalizeForgeLanguage(this.plugin.settings.language),
      onChange,
      renderPreviewOnly: () => this.renderPreviewOnly(),
      description,
    });
  }

  private renderFieldSidebar(): HTMLElement {
    const template = this.template as ForgeTemplate;
    const language = normalizeForgeLanguage(this.plugin.settings.language);
    const panel = section('Fields', 'Drag the handle to reorder Fields; drag a Field name onto the canvas to place it.');
    if (this.layout) ensureForgeContainers(template, this.layout);
    const fields = templateFields(template).filter((field) => !this.layout || !isContainerDataField(this.layout, field.key));
    const customField = el('details', 'statblock-forge__field-definitions statblock-forge__add-field-disclosure');
    customField.open = this.addFieldFormOpen;
    customField.addEventListener('toggle', () => { this.addFieldFormOpen = customField.open; });
    const addFieldTrigger = el('summary', 'statblock-forge__add-field-trigger', 'Add Field');
    addFieldTrigger.setAttribute('aria-label', 'Add a new Field');
    customField.append(addFieldTrigger, renderAddTemplateField(this.templateFieldEditorContext()));
    panel.append(customField);
    if (fields.length === 0) panel.append(el('p', 'statblock-forge__empty-inline', 'No fields yet.'));
    const chips = el('div', 'statblock-forge__field-palette');
    for (const field of fields) {
      const row = el('div', 'statblock-forge__field-row');
      const handle = button('⠿', () => undefined, true);
      handle.classList.add('statblock-forge__field-order-handle');
      handle.draggable = true;
      handle.dataset.fieldOrderHandle = field.key;
      handle.setAttribute('aria-label', `Reorder field ${field.label.trim() || field.key}. Use the arrow keys or drag this handle.`);
      handle.title = 'Drag to reorder; use ↑ and ↓ when the handle is focused.';
      handle.addEventListener('dragstart', (event) => {
        if (!event.dataTransfer) return;
        event.stopPropagation();
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(FIELD_ORDER_DRAG_TYPE, field.key);
        event.dataTransfer.setData('text/plain', `${FIELD_ORDER_DRAG_FALLBACK}${field.key}`);
        row.classList.add('is-reordering');
      });
      handle.addEventListener('dragend', () => {
        row.classList.remove('is-reordering', 'is-drop-before', 'is-drop-after');
        chips.querySelectorAll('.statblock-forge__field-row').forEach((item) => {
          item.classList.remove('is-drop-before', 'is-drop-after');
        });
      });
      handle.addEventListener('keydown', (event) => {
        const direction = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
        if (!direction) return;
        const currentIndex = fields.findIndex((item) => item.key === field.key);
        const target = fields[currentIndex + direction];
        if (!target) return;
        event.preventDefault();
        if (!reorderTemplateField(template, field.key, target.key, direction > 0)) return;
        this.render();
        [...this.contentEl.querySelectorAll<HTMLButtonElement>('[data-field-order-handle]')]
          .find((item) => item.dataset.fieldOrderHandle === field.key)?.focus();
      });

      const chip = el('button', 'statblock-forge__field-chip');
      chip.type = 'button';
      chip.draggable = true;
      chip.dataset.fieldKey = field.key;
      chip.append(el('span', 'statblock-forge__field-chip-name statblock-forge__user-content', field.label.trim() || field.key));
      // The palette labels a Field by its real value type. Legacy saved
      // categories such as `table` are normalized by the Field editor and
      // must never make an ordinary Field appear to be a Table Block.
      chip.append(el('small', 'statblock-forge__field-chip-type', translateForgeText(fieldTypeLabel(field.type), language)));
      const isPlaced = template.layout.blocks.some((block) => this.treeUsesField(block, field.key));
      if (isPlaced) chip.classList.add('is-placed');
      const isSelected = this.selectedTemplateFieldKey === field.key;
      chip.classList.toggle('is-selected', isSelected);
      chip.setAttribute('aria-pressed', String(isSelected));
      chip.title = isPlaced ? 'Click to edit field settings; drag to move the block' : 'Click to edit field settings; drag to add to canvas';
      chip.setAttribute('aria-label', `Select field settings: ${field.label.trim() || field.key}`);
      attachCanvasFieldDragSource(chip, field.key);
      chip.addEventListener('click', () => this.openTemplateFieldEditor(field.key));
      row.addEventListener('dragover', (event) => {
        const transfer = event.dataTransfer;
        if (!transfer || !Array.from(transfer.types).includes(FIELD_ORDER_DRAG_TYPE)) return;
        event.preventDefault();
        transfer.dropEffect = 'move';
        const after = event.clientY > row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
        row.classList.toggle('is-drop-before', !after);
        row.classList.toggle('is-drop-after', after);
      });
      row.addEventListener('dragleave', (event) => {
        if (event.relatedTarget instanceof Node && row.contains(event.relatedTarget)) return;
        row.classList.remove('is-drop-before', 'is-drop-after');
      });
      row.addEventListener('drop', (event) => {
        const transfer = event.dataTransfer;
        if (!transfer || !Array.from(transfer.types).includes(FIELD_ORDER_DRAG_TYPE)) return;
        const customKey = transfer.getData(FIELD_ORDER_DRAG_TYPE);
        const fallback = transfer.getData('text/plain');
        const sourceKey = customKey || (fallback.startsWith(FIELD_ORDER_DRAG_FALLBACK)
          ? fallback.slice(FIELD_ORDER_DRAG_FALLBACK.length)
          : '');
        if (!sourceKey) return;
        event.preventDefault();
        event.stopPropagation();
        const bounds = row.getBoundingClientRect();
        const after = event.clientY > bounds.top + bounds.height / 2;
        row.classList.remove('is-drop-before', 'is-drop-after');
        if (!reorderTemplateField(template, sourceKey, field.key, after)) return;
        this.render();
        [...this.contentEl.querySelectorAll<HTMLButtonElement>('[data-field-order-handle]')]
          .find((item) => item.dataset.fieldOrderHandle === sourceKey)?.focus();
      });
      const removeField = button('×', () => this.removeField(field.key), true);
      removeField.classList.add('statblock-forge__field-delete-button', 'statblock-forge__destructive-icon-button', 'is-danger');
      const removeFieldLabel = translateForgeText('Remove Field', language);
      removeField.title = `${removeFieldLabel}: ${field.label.trim() || field.key}`;
      removeField.setAttribute('aria-label', `${removeFieldLabel}: ${field.label.trim() || field.key}`);
      removeField.addEventListener('click', (event) => event.stopPropagation());
      row.append(handle, chip, removeField);
      chips.append(row);
    }
    panel.append(chips);
    const definitions = el('details', 'statblock-forge__field-definitions');
    definitions.dataset.forgeDisclosure = 'header-fields';
    definitions.open = this.headerFieldsOpen;
    definitions.addEventListener('toggle', () => { this.headerFieldsOpen = definitions.open; });
    definitions.append(el('summary', '', 'Header fields'), this.renderHeaderFields());
    panel.append(definitions);
    return panel;
  }

  private openTemplateFieldEditor(key: string): void {
    const template = this.template as ForgeTemplate | null;
    if (!template || !templateFields(template).some((field) => field.key === key)) return;
    this.selectedTemplateFieldKey = key;
    const current = this.selectedBlockId ? findLayoutBlock(template, this.selectedBlockId) : null;
    const block = current && this.blockDirectlyUsesField(current, key) ? current : findFirstBlockForField(template, key);
    this.selectedBlockId = block?.id ?? null;
    this.selectedBlockIds = block ? [block.id] : [];
    this.setSidebarMode('field');
    this.render();
  }

  private renderSelectedTemplateFieldProperties(field: ForgeField): HTMLElement {
    const content = el('div', 'statblock-forge__properties-content statblock-forge__field-properties-content');
    content.append(this.renderFieldCard(field, false));
    const remove = button(translateForgeText('Remove Field', normalizeForgeLanguage(this.plugin.settings.language)), () => this.removeField(field.key), true);
    remove.classList.add('statblock-forge__field-remove', 'statblock-forge__property-delete-button', 'is-danger');
    content.append(remove);
    return content;
  }

  private blockDirectlyUsesField(block: ForgeBlock, key: string): boolean {
    return this.fieldKeysForBlock(block).includes(key);
  }

  private treeUsesField(block: ForgeBlock, key: string): boolean {
    if (this.blockDirectlyUsesField(block, key)) return true;
    return Array.isArray(block.blocks)
      && block.blocks.some((child) => isRecord(child) && this.treeUsesField(child as ForgeBlock, key));
  }

  private renderCanvas(): HTMLElement {
    const template = this.template as ForgeTemplate;
    const layout = this.layout as ForgeLayoutDocument;
    const language = normalizeForgeLanguage(this.plugin.settings.language);
    const gridDescription = language === 'pt-BR'
      ? `${layout.columns} colunas · arraste para organizar · redimensione pelo canto.`
      : `${layout.columns} columns · drag to arrange · resize from the corner.`;
    const panel = section(
      this.statblockMode ? 'Template preview' : 'Canvas',
      this.statblockMode
        ? 'Interactive preview. Test boxes, counters, checkboxes, tabs, entries and dice rolls. Changes are temporary.'
        : gridDescription,
    );
    panel.classList.add('statblock-forge__canvas-panel');
    panel.classList.toggle('is-statblock-mode', this.statblockMode);
    const stickyHeader = el('div', 'statblock-forge__canvas-sticky-header');
    stickyHeader.setAttribute('role', 'group');
    stickyHeader.setAttribute('aria-label', 'Canvas header');
    const panelTitle = panel.querySelector<HTMLElement>('.statblock-forge__panel-title');
    if (panelTitle) stickyHeader.append(panelTitle);
    const toolbar = renderTemplateCanvasToolbar({
      template,
      layout,
      language,
      statblockMode: this.statblockMode,
      setStatblockMode: (enabled) => {
        this.statblockMode = enabled;
        this.render();
      },
      selectedBlockId: this.selectedBlockId,
      selectedBlockIds: this.selectedBlockIds,
      // The Canvas toolbar is not rebuilt for an in-place selection change.
      // Read the latest selection at click time instead of capturing the
      // selection from the render that originally created the toolbar.
      getInsertionSelectionId: () => this.selectedBlockIds[this.selectedBlockIds.length - 1] ?? this.selectedBlockId,
      renderComponentHelpPicker: (group, options, selectedValue, onSelect, sections) =>
        this.renderComponentHelpPicker(group, options, selectedValue, onSelect, sections),
      setSelection: (blockId, blockIds) => {
        this.selectedBlockId = blockId;
        this.selectedBlockIds = blockIds;
      },
      setSidebarModeToOptions: () => this.setSidebarMode('options'),
      render: () => this.render(),
      showNotice: (message) => this.showNotice(message),
      showCanvasGrid: this.plugin.settings.showCanvasGrid,
      setShowCanvasGrid: (visible) => {
        this.plugin.settings.showCanvasGrid = visible;
        void this.plugin.saveSettings().then(() => {
          this.plugin.refreshOpenViews();
        }).catch((error: unknown) => {
          this.showNotice(`Could not save Canvas display preference: ${error instanceof Error ? error.message : String(error)}`);
        });
      },
      setSheetWidth: (width, commit) => {
        layout.sheetWidth = width;
        const sheet = this.contentEl.querySelector<HTMLElement>('.statblock-forge__canvas-sheet');
        sheet?.setCssProps({ '--statblock-forge-sheet-width': `${width}px` });
        if (commit) this.render();
      },
    });
    stickyHeader.append(toolbar);
    panel.append(stickyHeader);

    // Both modes use the canonical statblock renderer. Construction mode adds
    // Canvas-only grid, drag/drop and block selection. Statblock mode enables
    // the final statblock controls against an isolated, temporary sample copy.
    const resolveImage = (path: string): string | undefined =>
      resolveVaultImageResource(this.app, path, this.file?.path);
    let dropzone: HTMLElement;
    if (this.statblockMode) {
      dropzone = el('div', 'statblock-forge__canvas-dropzone statblock-forge__statblock-mode-dropzone');
      // The live preview uses an isolated deep copy of sample data. It enables
      // the same runtime callbacks as a published statblock, but edits are kept
      // only in this editor session and never touch template.sample or Vault.
      const sampleSnapshot = JSON.stringify(template.sample ?? {});
      if (!this.statblockPreviewData || this.statblockPreviewSampleSnapshot !== sampleSnapshot) {
        this.statblockPreviewData = templatePreviewData(template);
        this.statblockPreviewSampleSnapshot = sampleSnapshot;
      }
      const previewData = this.statblockPreviewData;
      const card = renderStatblock({
        app: this.app,
        markdownComponent: this.plugin,
        sourcePath: this.file?.path ?? '',
        template,
        layout,
        data: previewData,
        language,
        resolveImage,
        interactiveCounters: true,
        // Keep the interactive statblock mode faithful to the published
        // player-facing layout, including folded Sections and Total Hidden blocks.
        foldSectionsIntoFooter: true,
        expandedSectionIds: this.expandedCanvasSectionIds,
        collapsedSectionIds: this.collapsedCanvasSectionIds,
        hideTotalHiddenBlocks: true,
        // renderStatblock mutates its supplied preview record before calling
        // this callback. Returning successfully enables the normal inline
        // Field editors, checkbox controls, tracked boxes and Counters.
        onFieldValueChange: (fieldKey, value) => {
          previewData[fieldKey] = value;
        },
        // Keep the reserved token socket visible in Statblock Mode even when
        // the template sample has no linked token art. Atlas remains the owner
        // of the actual token link; this callback only exposes the guidance.
        onImageFieldAction: (fieldKey, socket) => this.openImageSampleActions(template, fieldKey, socket),
      });
      card.classList.add('statblock-forge__canvas-sheet', 'statblock-forge__template-statblock-mode-card');
      card.setCssProps({ ['--statblock-forge-sheet-width']: `${normalizeForgeSheetWidth(layout.sheetWidth)}px` });
      restoreTemplateCanvasTabs(card, this.activeTabsById);
      this.statblockPreviewDiceCleanup = attachForgeStatblockDiceRolling(card, {
        app: this.app,
        template,
        statblockPath: this.file?.path ?? `template-preview:${template.id}`,
        statblockName: this.displayName,
        language,
      });
      dropzone.append(card);
    } else {
      dropzone = renderTemplateCanvasSurface({
        app: this.app,
        markdownComponent: this.plugin,
        sourcePath: this.file?.path ?? '',
        template,
        layout,
        language,
        // Template samples may contain Vault-root paths, encoded spaces,
        // wiki links or Markdown image references depending on their origin.
        resolveImage,
        onScoreTableEdit: (blockId, edit) => {
          try {
            if (editScoresTable(template, blockId, edit)) this.render();
          } catch (error) {
            this.showNotice(error instanceof Error ? error.message : String(error));
          }
        },
        onImageFieldAction: (fieldKey, socket) => this.openImageSampleActions(template, fieldKey, socket),
        onImageBlockSelect: (blockId) => {
          this.selectedBlockId = blockId;
          this.selectedBlockIds = [blockId];
          this.selectedTemplateFieldKey = null;
          this.setSidebarMode('options');
          this.refreshSelectionView();
        },
        activeTabsById: this.activeTabsById,
        expandedSectionIds: this.expandedCanvasSectionIds,
        collapsedSectionIds: this.collapsedCanvasSectionIds,
        showGrid: this.plugin.settings.showCanvasGrid,
        attachInteractions: (target, card) => this.attachCanvasInteractions(target, card),
      });
    }
    const zoomHint = translateForgeText('Ctrl + scroll to zoom the template.', language);
    dropzone.title = zoomHint;
    dropzone.setAttribute('aria-label', zoomHint);
    const sheet = dropzone.querySelector<HTMLElement>('.statblock-forge__canvas-sheet');
    if (sheet) {
      attachTemplateCanvasZoom(dropzone, sheet, this.canvasZoom, (zoom) => { this.canvasZoom = zoom; });
    }
    panel.append(dropzone);
    return panel;
  }

  /** Select a block from the Canvas and keep the Properties sidebar in sync. */
  private selectCanvasBlock(block: ForgeBlock, additive = false): void {
    if (additive) {
      const selected = new Set(this.selectedBlockIds);
      if (selected.has(block.id)) selected.delete(block.id);
      else selected.add(block.id);
      this.selectedBlockIds = [...selected];
      this.selectedBlockId = this.selectedBlockIds[this.selectedBlockIds.length - 1] ?? null;
    } else {
      this.selectedBlockId = block.id;
      this.selectedBlockIds = [block.id];
    }
    const template = this.template as ForgeTemplate;
    // A Text block's Properties panel contains both its Block inspector and
    // linked Field settings. Prefer the Block inspector as the active context;
    // the Field remains available immediately below it.
    const linkedFieldKey = block.type === 'text' ? null : templateFieldKeyToOpenForBlock(
      block,
      template.fields.filter(isForgeField).map((field) => field.key),
      additive,
    );
    if (linkedFieldKey) {
      this.selectedTemplateFieldKey = linkedFieldKey;
      this.setSidebarMode('field');
    } else {
      this.selectedTemplateFieldKey = null;
      this.setSidebarMode('options');
    }
    this.refreshSelectionView();
  }

  private attachCanvasInteractions(dropzone: HTMLElement, card: HTMLElement): void {
    const template = this.template as ForgeTemplate;
    const blocksById = new Map<string, ForgeBlock>();
    const parentByBlockId = new Map<string, string | null>();
    const indexTree = (blocks: ForgeBlock[], parentId: string | null): void => {
      for (const block of blocks) {
        blocksById.set(block.id, block);
        parentByBlockId.set(block.id, parentId);
        if (Array.isArray(block.blocks)) indexTree(block.blocks.filter(isRecord) as ForgeBlock[], block.id);
      }
    };
    indexTree(template.layout.blocks, null);
    const nearestAncestorSection = (blockId: string): ForgeBlock | null => {
      let parentId = parentByBlockId.get(blockId) ?? null;
      while (parentId) {
        const parent = blocksById.get(parentId);
        if (!parent) return null;
        if (parent.type === 'section') return parent;
        parentId = parentByBlockId.get(parentId) ?? null;
      }
      return null;
    };
    const selectionNestingDepth = (blockId: string): number => {
      let depth = 0;
      let parentId = parentByBlockId.get(blockId) ?? null;
      while (parentId) {
        const parent = blocksById.get(parentId);
        if (!parent) break;
        if (parent.type === 'section' || parent.type === 'row') depth += 1;
        parentId = parentByBlockId.get(parentId) ?? null;
      }
      return depth;
    };
    const positionContainerSelectionHandle = (handle: HTMLButtonElement, node: HTMLElement, blockId: string): void => {
      const position = canvasSelectionHandlePosition(selectionNestingDepth(blockId), node.getBoundingClientRect().width || node.clientWidth);
      handle.setCssStyles({ top: `${position.topPx}px` });
      handle.setCssStyles({ right: `${position.rightPx}px` });
    };
    const annotateParents = (blocks: ForgeBlock[], parentId: string | null): void => {
      for (const block of blocks) {
        const node = card.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(block.id)}"]`);
        if (node) {
          node.dataset.parentId = parentId ?? '';
          const isPrimarySelection = block.id === this.selectedBlockId;
          node.classList.toggle('is-forge-selected', this.selectedBlockIds.includes(block.id));
          node.classList.toggle('is-forge-resize-selected', isPrimarySelection);
          node.draggable = true;
          node.setAttribute('aria-label', `${blockLabel(block, template.fields)}; draggable block`);
          if (block.type === 'section') {
            let sectionHandle = node.querySelector<HTMLButtonElement>(':scope > .statblock-forge__section-select-handle');
            if (!sectionHandle) {
              sectionHandle = el('button', 'statblock-forge__section-select-handle');
              sectionHandle.type = 'button';
              sectionHandle.draggable = false;
              sectionHandle.tabIndex = 0;
              const ownSection = node.querySelector<HTMLElement>(':scope > .statblock-forge__preview-section');
              const renderedHeading = ownSection?.querySelector<HTMLElement>(
                ':scope > .statblock-forge__preview-section-heading, :scope > .statblock-forge__preview-collapsible > .statblock-forge__preview-section-heading',
              )?.textContent?.trim();
              const configuredHeading = typeof block.heading === 'string' ? block.heading.trim() : '';
              const sectionFallback = translateForgeText('Section', normalizeForgeLanguage(this.plugin.settings.language));
              const sectionName = configuredHeading || renderedHeading || sectionFallback;
              const sectionIcon = el('span', 'statblock-forge__section-select-icon', '▤');
              sectionIcon.setAttribute('aria-hidden', 'true');
              sectionHandle.append(sectionIcon); // Keep the selector compact; the Section name remains available in its tooltip and accessible label.
              const isPortuguese = normalizeForgeLanguage(this.plugin.settings.language) === 'pt-BR';
              sectionHandle.title = isPortuguese
                ? `Selecionar seção: ${sectionName}. Alt+clique em um bloco filho para selecionar a seção que o contém.`
                : `Select Section: ${sectionName}. Alt-click a child block to select its containing Section.`;
              sectionHandle.setAttribute('aria-label', isPortuguese ? `Selecionar seção: ${sectionName}` : `Select Section: ${sectionName}`);
              sectionHandle.setAttribute('aria-pressed', String(this.selectedBlockIds.includes(block.id)));
              sectionHandle.addEventListener('pointerdown', (event) => event.stopPropagation());
              sectionHandle.addEventListener('mousedown', (event) => event.preventDefault());
              sectionHandle.addEventListener('dragstart', (event) => event.preventDefault());
              sectionHandle.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                // Alt-clicking the Section handle selects the next outer Section,
                // which makes arbitrarily deep nesting navigable from the same edge.
                const targetSection = event.altKey ? nearestAncestorSection(block.id) ?? block : block;
                this.selectCanvasBlock(targetSection);
              });
              node.append(sectionHandle);
            }
            positionContainerSelectionHandle(sectionHandle, node, block.id);
          } else if (block.type === 'row') {
            let rowHandle = node.querySelector<HTMLButtonElement>(':scope > .statblock-forge__row-select-handle');
            if (!rowHandle) {
              rowHandle = el('button', 'statblock-forge__row-select-handle');
              rowHandle.type = 'button';
              rowHandle.draggable = false;
              rowHandle.tabIndex = 0;
              const rowName = blockLabel(block, template.fields) || translateForgeText('Row', normalizeForgeLanguage(this.plugin.settings.language));
              const rowIcon = el('span', 'statblock-forge__row-select-icon', '☷');
              rowIcon.setAttribute('aria-hidden', 'true');
              rowHandle.append(rowIcon);
              const isPortuguese = normalizeForgeLanguage(this.plugin.settings.language) === 'pt-BR';
              rowHandle.title = isPortuguese
                ? `Selecionar linha: ${rowName}. Alt+clique para selecionar a seção que a contém.`
                : `Select Row: ${rowName}. Alt-click to select its containing Section.`;
              rowHandle.setAttribute('aria-label', isPortuguese ? `Selecionar linha: ${rowName}` : `Select Row: ${rowName}`);
              rowHandle.setAttribute('aria-pressed', String(this.selectedBlockIds.includes(block.id)));
              rowHandle.addEventListener('pointerdown', (event) => event.stopPropagation());
              rowHandle.addEventListener('mousedown', (event) => event.preventDefault());
              rowHandle.addEventListener('dragstart', (event) => event.preventDefault());
              rowHandle.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const targetSection = event.altKey ? nearestAncestorSection(block.id) : null;
                this.selectCanvasBlock(targetSection ?? block);
              });
              node.append(rowHandle);
            }
            positionContainerSelectionHandle(rowHandle, node, block.id);
          }
          // MarkdownRenderer may install handlers on rendered descendants (most
          // notably links) that prevent the Canvas' delegated click listener
          // from receiving the eventual click. Select Text blocks at the start
          // of the pointer gesture instead; this keeps the block selectable
          // while preserving the link's native click/navigation behavior.
          if (block.type === 'text' && node.dataset.forgeMarkdownSelectionBound !== 'true') {
            node.dataset.forgeMarkdownSelectionBound = 'true';
            node.tabIndex = 0;
            node.addEventListener('pointerdown', (event) => {
              if (event.button !== 0 || event.isPrimary === false) return;
              const target = event.target instanceof Element
                ? event.target
                : event.target instanceof Node ? event.target.parentElement : null;
              if (target?.closest(
                'button,input,select,textarea,[contenteditable="true"],[data-no-block-edit],' +
                '.statblock-forge__resize-handle,.statblock-forge__section-select-handle,.statblock-forge__row-select-handle,.statblock-forge__preview-tab',
              )) return;
              const additive = event.ctrlKey || event.metaKey || event.shiftKey;
              if (event.altKey) {
                const section = block.type === 'section' ? block : nearestAncestorSection(block.id);
                if (section) this.selectCanvasBlock(section, additive);
                else this.selectCanvasBlock(block, additive);
              } else {
                this.selectCanvasBlock(block, additive);
              }
            }, true);
            node.addEventListener('keydown', (event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              const target = event.target instanceof Element ? event.target : null;
              if (target && target !== node && target.closest(
                'a,button,input,select,textarea,[contenteditable="true"],[data-no-block-edit]',
              )) return;
              event.preventDefault();
              this.selectCanvasBlock(block, event.ctrlKey || event.metaKey || event.shiftKey);
            });
          }
          attachCanvasBlockDragSource(node, block.id);
          if (isPrimarySelection && canvasResizeParent(node)) {
            this.attachResizeHandle(node, block);
          }
        }
        if (Array.isArray(block.blocks)) annotateParents(block.blocks.filter(isRecord) as ForgeBlock[], block.id);
      }
    };
    annotateParents(template.layout.blocks, null);

    // The Canvas surface is assembled before its containing panel is attached
    // to the editor. Recompute positions once the browser has measured the
    // actual nested block widths, especially for narrow one-column containers.
    const view = card.ownerDocument.defaultView;
    view?.requestAnimationFrame(() => {
      if (!card.isConnected) return;
      for (const block of blocksById.values()) {
        if (block.type !== 'section' && block.type !== 'row') continue;
        const node = card.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(block.id)}"]`);
        if (!node) continue;
        const handleClass = block.type === 'section'
          ? '.statblock-forge__section-select-handle'
          : '.statblock-forge__row-select-handle';
        const handle = node.querySelector<HTMLButtonElement>(`:scope > ${handleClass}`);
        if (handle) positionContainerSelectionHandle(handle, node, block.id);
      }
    });

    // Use one capture-phase delegate for Canvas selection. Obsidian's native
    // MarkdownRenderer creates nested elements (including links) after the
    // synchronous Canvas render; per-block bubbling listeners can miss clicks
    // when those rendered children handle or stop the event themselves. The
    // nearest data-block-id always resolves to the deepest Forge block.
    card.addEventListener('click', (event) => {
      const target = event.target instanceof Element
        ? event.target
        : event.target instanceof Node ? event.target.parentElement : null;
      if (!target) return;

      const tabButton = target.closest<HTMLElement>('[data-tab-block-id][data-tabs-block-id]');
      if (tabButton && card.contains(tabButton)) {
        const tabId = tabButton.dataset.tabBlockId;
        const tabsId = tabButton.dataset.tabsBlockId;
        if (tabId && tabsId && blocksById.has(tabId)) {
          event.preventDefault();
          event.stopPropagation();
          this.activeTabsById.set(tabsId, tabId);
          this.selectedBlockId = tabId;
          this.selectedBlockIds = [tabId];
          this.selectedTemplateFieldKey = null;
          this.setSidebarMode('options');
          this.refreshSelectionView(true);
        }
        return;
      }

      // Keep real controls independent. Markdown links are deliberately not
      // excluded: they still perform their normal navigation, while selecting
      // the Text block underneath them for the Properties inspector.
      if (target.closest('button,input,select,textarea,[contenteditable="true"]')) return;
      const blockNode = target.closest<HTMLElement>('.statblock-forge__preview-block[data-block-id]');
      if (!blockNode || !card.contains(blockNode)) return;
      const blockId = blockNode.dataset.blockId ?? '';
      const block = blocksById.get(blockId);
      if (!block) return;
      // Pointer activation already selected Text blocks on pointerdown, before
      // Markdown/link handlers can consume the click. Keep click for keyboard
      // and programmatic activation (detail === 0), and avoid toggling additive
      // selection twice for an ordinary mouse/touch gesture.
      if (block.type === 'text' && event.detail > 0) return;

      // Normal click keeps selecting the deepest child. Alt-click is the
      // deliberate parent-navigation gesture: it selects the nearest
      // containing Section instead, without changing drag/drop behavior.
      if (event.altKey) {
        const section = block.type === 'section' ? block : nearestAncestorSection(block.id);
        if (section) {
          event.preventDefault();
          this.selectCanvasBlock(section);
          return;
        }
      }
      const additive = event.ctrlKey || event.metaKey || event.shiftKey;
      this.selectCanvasBlock(block, additive);
    }, true);

    attachTemplateCanvasDropZone(dropzone, template, ({ payload, location }) => {
      try {
        const block = applyCanvasDrop(
          template,
          this.layout as ForgeLayoutDocument,
          this.activeTabsById,
          payload,
          location,
        );
        if (!block) return;
        this.selectedBlockId = block.id;
        this.selectedBlockIds = [block.id];
        this.setSidebarMode('options');
        this.render();
      } catch (error) {
        this.showNotice(error instanceof Error ? error.message : String(error));
      }
    });
  }

  private attachResizeHandle(node: HTMLElement, block: ForgeBlock): void {
    const layout = this.layout as ForgeLayoutDocument;
    const grid = canvasResizeParent(node);
    if (!grid) return;
    if (node.querySelector(':scope > .statblock-forge__resize-handle')) return;
    const isRow = grid.classList.contains('statblock-forge__preview-row')
      || grid.classList.contains('statblock-forge__preview-row-line');
    const isTabPanel = grid.classList.contains('statblock-forge__preview-tab-panel');
    const metadata = layout.blocks[block.id] ?? { span: isRow ? 6 : 12, rows: 1, appearance: {} };
    node.classList.add('has-resize-handle');
    // The resize handle is an overlay. Do not reserve space with inline/block padding:
    // that changes text wrapping and scrollHeight, which the content-aware grid
    // measures as intrinsic content and can incorrectly convert into an extra row.
    const handle = el('button', 'statblock-forge__resize-handle', '↘');
    handle.type = 'button';
    handle.tabIndex = block.id === this.selectedBlockId ? 0 : -1;
    handle.draggable = false;
    handle.title = 'Drag to resize';
    handle.setAttribute('aria-label', 'Resize block');
    handle.addEventListener('dragstart', (event) => event.preventDefault());
    handle.addEventListener('pointerdown', (event) => {
      if (block.id !== this.selectedBlockId) return;
      if (event.button !== 0 || event.isPrimary === false) return;
      event.preventDefault();
      event.stopPropagation();
      const parent = grid;
      if (!parent || node.classList.contains('is-resizing')) return;
      // The dropzone is the Canvas' actual scrollport. Edge autoscroll must
      // target it rather than the clipped preview column around the panel.
      const scrollContainer = node.closest<HTMLElement>('.statblock-forge__canvas-dropzone');
      const style = window.getComputedStyle(parent);
      const heightGrid = node.closest<HTMLElement>('.statblock-forge__preview-grid');
      const gridGeometry = heightGrid ? readTemplateGridGeometry(heightGrid) : null;
      const parentGridGeometry = !isRow && parent.matches('.statblock-forge__preview-grid')
        ? (gridGeometry ?? readTemplateGridGeometry(parent))
        : null;
      const rowHeight = gridGeometry?.rowHeight ?? (Number.parseFloat(style.gridAutoRows) || 56);
      const rowGap = gridGeometry?.rowGap ?? (Number.parseFloat(style.rowGap) || 0);
      const columnGap = parentGridGeometry?.columnGap ?? (Number.parseFloat(style.columnGap) || 0);
      const columnStep = parentGridGeometry ? templateGridColumnPitch(parentGridGeometry) : 0;
      const gridColumns = parentGridGeometry?.columns ?? GRID_COLUMN_COUNT;
      const startSpan = Math.max(1, Math.min(GRID_COLUMN_COUNT, metadata.span));
      const startPhysicalSpan = Math.max(1, Math.min(gridColumns, Math.round(startSpan * gridColumns / GRID_COLUMN_COUNT)));
      // Structural containers may reserve additional rows for their nested
      // content. Start from the actual rendered allocation so the indicator
      // matches the area occupied by the selected block.
      const renderedRows = Number.parseInt(node.dataset.contentRows ?? '', 10);
      const startRows = Math.max(1, metadata.rows, Number.isFinite(renderedRows) ? renderedRows : 1);
      const startX = event.clientX;
      const startY = event.clientY;
      // Row children wrap into independent visual lines at 12 logical parts.
      // Resize a child against only the other blocks on its own line; counting
      // every child in the Row makes wrapped blocks jump in width and produces
      // a preview that disagrees with the saved/rendered layout.
      const rowBlockNode = isRow
        ? parent.closest<HTMLElement>('.statblock-forge__preview-block.is-row[data-block-id]')
        : null;
      const rowBlockId = rowBlockNode?.dataset.blockId ?? '';
      const rowBlock = rowBlockId ? findLayoutBlock(this.template as ForgeTemplate, rowBlockId) : null;
      const rowLines = isRow && rowBlock?.type === 'row' && Array.isArray(rowBlock.blocks)
        ? groupRowChildrenBySpan(rowBlock.blocks.filter(isRecord) as ForgeBlock[], layout)
        : [];
      const activeRowLine = rowLines.find((line) => line.some((child) => child.id === block.id)) ?? null;
      const activeLineIds = activeRowLine ? new Set(activeRowLine.map((child) => child.id)) : null;
      const rowChildren = isRow
        ? Array.from(parent.children).filter((child): child is HTMLElement =>
          child instanceof HTMLElement
          && Boolean(child.dataset.blockId)
          && (!activeLineIds || activeLineIds.has(child.dataset.blockId ?? '')),
        )
        : [];
      const otherSpanTotal = isRow
        ? rowChildren.reduce((total, sibling) => {
          if (sibling.dataset.blockId === block.id) return total;
          const siblingId = sibling.dataset.blockId ?? '';
          return total + (layout.blocks[siblingId]?.span ?? 6);
        }, 0)
        : 0;
      const gridChildren = isRow
        ? []
        : Array.from(parent.children).filter((child): child is HTMLElement => child instanceof HTMLElement && Boolean(child.dataset.blockId));
      const gridNodesById = new Map<string, HTMLElement>(gridChildren.map((child) => [child.dataset.blockId ?? '', child] as const));
      const gridBlocks = gridChildren.flatMap((child) => {
        const childId = child.dataset.blockId;
        if (!childId) return [];
        const siblingBlock = findLayoutBlock(this.template as ForgeTemplate, childId);
        return siblingBlock ? [siblingBlock] : [];
      });
      const originalGridStyles = gridChildren.map((child) => ({
        node: child,
        gridColumn: child.style.gridColumn,
        gridRow: child.style.gridRow,
      }));
      const rowAvailableWidth = isRow
        ? Math.max(1, parent.clientWidth
          - (Number.parseFloat(style.paddingLeft) || 0)
          - (Number.parseFloat(style.paddingRight) || 0))
        : 1;
      const rowStep = rowHeight + rowGap;
      const originalStyle = {
        gridColumn: node.style.gridColumn,
        gridRow: node.style.gridRow,
        flex: node.style.flex,
        width: node.style.width,
        minHeight: node.style.minHeight,
      };
      const originalHandleOpacity = handle.style.opacity;
      const resizeIndicator = el('div', 'statblock-forge__resize-indicator');
      resizeIndicator.setAttribute('aria-hidden', 'true');
      resizeIndicator.textContent = `${startSpan}×${startRows}`;
      resizeIndicator.setCssStyles({ left: `${startX}px` });
      resizeIndicator.setCssStyles({ top: `${startY}px` });
      document.body.append(resizeIndicator);
      const wasDraggable = node.draggable;
      const pointerId = event.pointerId;
      let nextSpan = startSpan;
      let nextPhysicalSpan = startPhysicalSpan;
      let nextRows = startRows;
      let finished = false;
      let latestPointerX = startX;
      let latestPointerY = startY;
      let autoScrollOffset = 0;
      let autoScrollFrame = 0;
      let lastAutoScrollFrameTime = 0;
      node.draggable = false;
      node.classList.add('is-resizing');
      handle.setCssStyles({ opacity: '0' });
      const restorePreview = (): void => {
        for (const original of originalGridStyles) {
          original.node.setCssStyles({ gridColumn: original.gridColumn });
          original.node.setCssStyles({ gridRow: original.gridRow });
        }
        node.setCssStyles({ gridColumn: originalStyle.gridColumn });
        node.setCssStyles({ gridRow: originalStyle.gridRow });
        node.setCssStyles({ flex: originalStyle.flex });
        node.setCssStyles({ width: originalStyle.width });
        node.setCssStyles({ minHeight: originalStyle.minHeight });
      };
      const finish = (commit: boolean): void => {
        if (finished) return;
        finished = true;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        if (autoScrollFrame) window.cancelAnimationFrame(autoScrollFrame);
        autoScrollFrame = 0;
        lastAutoScrollFrameTime = 0;
        try {
          if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
        } catch {
          // Pointer capture may already have been released by the browser.
        }
        node.draggable = wasDraggable;
        node.classList.remove('is-resizing');
        if (originalHandleOpacity) handle.setCssStyles({ opacity: originalHandleOpacity });
        else handle.style.removeProperty('opacity');
        resizeIndicator.remove();
        if (commit && (nextSpan !== startSpan || nextRows !== startRows)) {
          resizeLayoutBlock(layout, block, nextSpan, nextRows);
          this.render();
        } else {
          restorePreview();
        }
      };
      const updateResizePreview = (): void => {
        if (isRow) {
          nextSpan = rowResizeSpanFromDelta(
            startSpan, otherSpanTotal, latestPointerX - startX, rowAvailableWidth, rowChildren.length, columnGap,
          );
          nextPhysicalSpan = nextSpan;
          const width = rowResizePreviewWidth(nextSpan, otherSpanTotal, rowChildren.length, columnGap);
          node.setCssStyles({ flex: `0 1 ${width}` });
          node.setCssStyles({ width: width });
        } else {
          nextPhysicalSpan = gridResizeSpanFromStep(
            startPhysicalSpan,
            latestPointerX - startX,
            columnStep || (parent.clientWidth + columnGap) / gridColumns,
            gridColumns,
          );
          nextSpan = Math.max(1, Math.min(GRID_COLUMN_COUNT, Math.round(nextPhysicalSpan * GRID_COLUMN_COUNT / gridColumns)));
        }
        // Include the scroll distance in the logical pointer delta. This lets
        // the block keep growing while the pointer remains near an edge as
        // the Canvas scrolls underneath it.
        const verticalDelta = latestPointerY - startY + autoScrollOffset;
        nextRows = Math.max(1, Math.min(MAX_BLOCK_ROWS, startRows + Math.round(verticalDelta / Math.max(1, rowStep))));
        node.setCssStyles({ minHeight: isRow && nextRows > 1
          ? resizeRowsMinHeight(nextRows, rowHeight, rowGap)
          : originalStyle.minHeight });
        if (!isRow && gridBlocks.length > 0) {
          // Preview the whole sibling grid through the same collision-aware
          // packer used by the renderer. This lets an expanded block move to
          // the next available row and pushes/reflows its siblings immediately,
          // instead of clipping at the columns remaining on its current row.
          const previewLayout: ForgeLayoutDocument = { ...layout, dense: isTabPanel ? true : layout.dense, blocks: { ...layout.blocks } };
          for (const sibling of gridBlocks) {
            const siblingNode = gridNodesById.get(sibling.id);
            const originalMetadata = layout.blocks[sibling.id] ?? { span: 12, rows: 1, appearance: {} };
            const measuredRows = Number.parseInt(siblingNode?.dataset.contentRows ?? '', 10);
            const rows = Number.isFinite(measuredRows) ? Math.max(originalMetadata.rows, measuredRows) : originalMetadata.rows;
            previewLayout.blocks[sibling.id] = {
              ...originalMetadata,
              span: sibling.id === block.id ? nextSpan : originalMetadata.span,
              rows: sibling.id === block.id ? Math.max(nextRows, rows) : rows,
            };
          }
          const previewPlacements = packPhysicalGrid(
            gridBlocks,
            previewLayout,
            false,
            (this.template as ForgeTemplate).sample as Record<string, unknown> | undefined,
          );
          for (const placement of previewPlacements) {
            const siblingNode = gridNodesById.get(placement.id);
            if (!siblingNode) continue;
            siblingNode.setCssStyles({ gridColumn: `${placement.x + 1} / span ${placement.span}` });
            siblingNode.setCssStyles({ gridRow: `${placement.y + 1} / span ${placement.rows}` });
          }
        }
        // Use a viewport-fixed indicator rather than positioning the original
        // grip inside a block whose origin moves whenever Grid reflows. Client
        // coordinates now map directly to the indicator's fixed coordinates.
        resizeIndicator.textContent = `${nextPhysicalSpan}×${nextRows}`;
        resizeIndicator.setCssStyles({ left: `${latestPointerX}px` });
        resizeIndicator.setCssStyles({ top: `${latestPointerY}px` });
      };
      const runAutoScrollFrame = (time: number): void => {
        autoScrollFrame = 0;
        if (finished || !scrollContainer || scrollContainer.clientHeight <= 0) return;
        const bounds = scrollContainer.getBoundingClientRect();
        const speed = resizeAutoScrollSpeed(latestPointerY, bounds.top, bounds.bottom);
        if (speed === 0) {
          lastAutoScrollFrameTime = 0;
          return;
        }
        const elapsed = lastAutoScrollFrameTime > 0 ? Math.min(32, Math.max(0, time - lastAutoScrollFrameTime)) : 16.667;
        lastAutoScrollFrameTime = time;
        const previousScrollTop = scrollContainer.scrollTop;
        scrollContainer.scrollTop += speed * (elapsed / 16.667);
        const appliedScroll = scrollContainer.scrollTop - previousScrollTop;
        if (appliedScroll !== 0) {
          autoScrollOffset += appliedScroll;
          updateResizePreview();
          autoScrollFrame = window.requestAnimationFrame(runAutoScrollFrame);
        } else {
          lastAutoScrollFrameTime = 0;
        }
      };
      const scheduleAutoScroll = (): void => {
        if (!scrollContainer || autoScrollFrame || finished || scrollContainer.scrollHeight <= scrollContainer.clientHeight) return;
        autoScrollFrame = window.requestAnimationFrame(runAutoScrollFrame);
      };
      const onMove = (moveEvent: PointerEvent): void => {
        if (moveEvent.pointerId !== pointerId || finished) return;
        moveEvent.preventDefault();
        latestPointerX = moveEvent.clientX;
        latestPointerY = moveEvent.clientY;
        updateResizePreview();
        scheduleAutoScroll();
      };
      const onUp = (upEvent: PointerEvent): void => {
        if (upEvent.pointerId === pointerId) finish(true);
      };
      const onCancel = (cancelEvent: PointerEvent): void => {
        if (cancelEvent.pointerId === pointerId) finish(false);
      };
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      try {
        handle.setPointerCapture?.(pointerId);
      } catch {
        // Window-level pointer listeners remain as the WebView fallback.
      }
    });
    node.append(handle);
  }

  private renderPreview(): HTMLElement {
    return this.renderCanvas();
  }

  private renderPreviewOnly(): void {
    // Re-render to ensure grid placement, custom colors and appearance all use the same metadata.
    this.render();
  }

  private ensureBlockLayout(block: ForgeBlock, span: number): void {
    if (!this.layout) return;
    resizeLayoutBlock(this.layout, block, span, this.layout.blocks[block.id]?.rows ?? 1);
  }

  private removeSelectedBlocks(targetIds?: readonly string[]): void {
    if (!this.template || !this.layout) return;
    const selectedIds = targetIds ? [...targetIds] : this.selectedBlockIds.length > 0
      ? [...this.selectedBlockIds]
      : this.selectedBlockId ? [this.selectedBlockId] : [];
    if (selectedIds.length === 0) return;
    const labels = selectedIds.map((id) => {
      const block = findLayoutBlock(this.template as ForgeTemplate, id);
      return block ? blockLabel(block, (this.template as ForgeTemplate).fields) : id;
    });
    const subject = selectedIds.length === 1 ? `block “${labels[0]}”` : `${selectedIds.length} selected blocks`;
    this.confirmDelete(subject, () => this.performRemoveSelectedBlocks(selectedIds));
  }

  private performRemoveSelectedBlocks(selectedIds: readonly string[]): void {
    if (!this.template || !this.layout) return;
    const tableDataFields = new Set<string>();
    const collectTableDataFields = (block: ForgeBlock): void => {
      if (block.type === 'scores' && typeof block.field === 'string' && block.field) {
        tableDataFields.add(block.field);
      }
      if (Array.isArray(block.blocks)) {
        block.blocks.filter(isRecord).forEach((child) => collectTableDataFields(child as ForgeBlock));
      }
    };
    let removedCount = 0;
    for (const id of selectedIds) {
      const removed = removeLayoutBlock(this.template, this.layout, id);
      if (!removed) continue;
      removedCount += 1;
      collectTableDataFields(removed);
    }
    if (removedCount === 0) return;

    const remainingTableDataFields = new Set<string>();
    const collectRemainingTableDataFields = (blocks: ForgeBlock[]): void => {
      for (const block of blocks) {
        if (block.type === 'scores' && typeof block.field === 'string' && block.field) {
          remainingTableDataFields.add(block.field);
        }
        if (Array.isArray(block.blocks)) collectRemainingTableDataFields(block.blocks.filter(isRecord) as ForgeBlock[]);
      }
    };
    collectRemainingTableDataFields(this.template.layout.blocks);
    for (const fieldKey of tableDataFields) {
      if (remainingTableDataFields.has(fieldKey)) continue;
      try {
        removeTemplateField(this.template, fieldKey);
        removeFieldCompendium(this.layout, fieldKey);
        if (this.layout.fieldKinds) delete this.layout.fieldKinds[fieldKey];
      } catch (error) {
        // Keep an unbound backing Field rather than losing dependent data if a
        // legacy template has explicitly referenced this internal storage key.
        this.showNotice(error instanceof Error ? error.message : String(error));
      }
    }

    for (const [tabsId, activeTabId] of this.activeTabsById) {
      if (!findLayoutBlock(this.template, activeTabId)) this.activeTabsById.delete(tabsId);
    }
    this.selectedBlockId = this.template.layout.blocks[0]?.id ?? null;
    this.selectedBlockIds = this.selectedBlockId ? [this.selectedBlockId] : [];
    this.setSidebarMode('fields');
    this.render();
  }

  private removeField(key: string): void {
    const field = templateFields(this.template as ForgeTemplate).find((item) => item.key === key);
    if (!field) return;
    this.confirmDelete(`Field “${field.label.trim() || field.key}”`, () => this.performRemoveField(key));
  }

  private performRemoveField(key: string): void {
    const template = this.template as ForgeTemplate;
    const previouslySelectedBlock = this.selectedBlockId
      ? findLayoutBlock(template, this.selectedBlockId)
      : null;
    const selectedBlockWasLinked = previouslySelectedBlock
      ? this.fieldKeysForBlock(previouslySelectedBlock).includes(key)
      : false;
    try {
      removeTemplateField(template, key);
      if (this.layout) {
        removeAbilityPartAppearanceField(this.layout, key);
        removePinnedTemplateImageField(this.layout, key);
        removeFieldCompendium(this.layout, key);
        if (this.layout.fieldKinds) delete this.layout.fieldKinds[key];
      }
    } catch (error) {
      this.showNotice(error instanceof Error ? error.message : String(error));
      return;
    }

    if (this.selectedTemplateFieldKey === key) this.selectedTemplateFieldKey = null;
    if (selectedBlockWasLinked && previouslySelectedBlock) {
      // Keep the now-unbound block selected so the user can immediately assign
      // another Field from its Properties inspector.
      this.selectedBlockId = previouslySelectedBlock.id;
      this.selectedBlockIds = [previouslySelectedBlock.id];
      this.setSidebarMode('options');
    } else if (this.selectedTemplateFieldKey === null) {
      if (!this.selectedBlockId || !findLayoutBlock(template, this.selectedBlockId)) {
        this.selectedBlockId = template.layout.blocks[0]?.id ?? null;
        this.selectedBlockIds = this.selectedBlockId ? [this.selectedBlockId] : [];
      }
      if (!selectedBlockWasLinked) this.setSidebarMode('fields');
    }
    this.render();
  }

  private templateNameTaken(name: string): boolean {
    const normalized = name.trim().toLocaleLowerCase();
    if (!normalized) return false;
    const folderPath = this.file?.parent?.path ?? this.plugin.settings.templateFolder;
    const targetPath = folderPath ? `${folderPath}/${name.trim()}.forgetemplate` : `${name.trim()}.forgetemplate`;

    // A same-folder Forge template is allowed through to the repository, which
    // raises TemplateNameConflictError and requires explicit overwrite consent.
    const templateAlreadyExists = this.app.vault.getFiles().some((file) =>
      ['forgetemplate', 'atlastemplate'].includes(file.extension.toLocaleLowerCase())
      && file.basename.toLocaleLowerCase() === normalized
      && file.path !== targetPath);
    if (templateAlreadyExists) return true;

    // A Markdown note beside the destination template also reserves its name.
    const notePath = folderPath ? `${folderPath}/${name.trim()}.md` : `${name.trim()}.md`;
    const exactNote = this.app.vault.getAbstractFileByPath(notePath);
    if (exactNote) return true;
    const folder = folderPath ? this.app.vault.getAbstractFileByPath(folderPath) : this.app.vault.getRoot();
    const children = folder instanceof TFolder ? folder.children : [];
    return children.some((child) => child instanceof TFile
      && child.extension.toLocaleLowerCase() === 'md'
      && child.basename.toLocaleLowerCase() === normalized);
  }

  private confirmTemplateOverwrite(conflict: TemplateNameConflictError): Promise<TemplateOverwriteConfirmation | null> {
    return new Promise((resolve) => {
      new TemplateOverwriteModal(
        this.app,
        conflict,
        normalizeForgeLanguage(this.plugin.settings.language),
        resolve,
      ).open();
    });
  }

  private openSaveDialog(): void {
    if (this.saving || !this.template || !this.layout) return;
    const subject = { name: this.displayName, unsaved: !this.file };
    const language = normalizeForgeLanguage(this.plugin.settings.language);
    const modal = new TemplateSaveModal(
      this.app,
      language,
      subject,
      (name) => this.templateNameTaken(name),
      (request) => this.save(request),
    );
    modal.open();
  }

  private async save(request: TemplateSaveRequest): Promise<string | null> {
    if (this.saving || !this.template || !this.layout) return 'Não há template disponível para salvar.';
    if (this.jsonDraftText !== null && this.jsonDraftText !== this.jsonAppliedText && !this.applyJsonDraft()) {
      return 'Corrija o JSON antes de salvar o template.';
    }
    if (request.kind === 'update' && !this.canOverwriteCurrentFile) {
      return 'Este .forgetemplate está em formato desconhecido ou danificado e foi protegido contra sobrescrita. Salve como novo para criar uma versão recuperada.';
    }
    this.saving = true;
    try {
      const template = cloneJson(this.template);
      const layout = cloneJson(this.layout);
      const issues = validateTemplateFields(template);
      const partIssues = validateAbilityParts(template.fields);
      const checkboxIssues = validateCheckboxFieldOptions(template.fields);
      const recoveryIssues = validateRecoveryButtons(recoveryButtonsForEditing(template));
      const layoutIssues = validateLayoutDocument(template, layout);
      if (issues.length > 0 || partIssues.length > 0 || checkboxIssues.length > 0
        || recoveryIssues.length > 0 || layoutIssues.length > 0) {
        const messages = [
          ...issues.map((issue) => issue.message),
          ...partIssues.map((issue) => issue.message),
          ...checkboxIssues.map((issue) => issue.message),
          ...recoveryIssues.map((issue) => issue.message),
          ...layoutIssues.map((issue) => issue.message),
        ];
        const language = normalizeForgeLanguage(this.plugin.settings.language);
        const localizedMessages = messages.slice(0, 4).map((message) => translateForgeText(message, language));
        const summary = localizedMessages.join(' ');
        const additional = messages.length > 4
          ? language === 'en' ? ` (+${messages.length - 4} problems)` : ` (+${messages.length - 4} problemas)`
          : '';
        return `${translateForgeText('Could not save:', language)} ${summary}${additional}`;
      }
      const saveOptions = {
        storage: createTemplateVaultStorage(this.app),
        templateFolder: this.plugin.settings.templateFolder,
        name: request.name,
        template,
        layout,
        sourcePath: this.file?.path ?? null,
        originalText: this.originalText,
        saveAsCopy: request.kind === 'new',
      };
      let result: Awaited<ReturnType<typeof saveTemplateDocument>>;
      try {
        result = await saveTemplateDocument(saveOptions);
      } catch (error) {
        if (!(error instanceof TemplateNameConflictError)) throw error;
        const confirmation = await this.confirmTemplateOverwrite(error);
        if (!confirmation) return 'Sobrescrita cancelada. O template existente foi mantido.';
        result = await saveTemplateDocument({
          ...saveOptions,
          overwriteExistingPath: confirmation.overwriteExistingPath,
          expectedOverwriteText: confirmation.expectedOverwriteText,
        });
      }
      const savedAbstract = this.app.vault.getAbstractFileByPath(result.file.path);
      if (!(savedAbstract instanceof TFile)) throw new Error('O arquivo salvo não foi encontrado no Vault.');
      // Atlas' Role selector only reads native .atlastemplate files. Publish
      // the matching native mirror as part of every successful Forge save.
      // A mirror failure must not roll back the user's already-saved Forge file.
      try {
        await ensureAtlasNativeTemplateMirror(this.app, savedAbstract);
      } catch (mirrorError) {
        console.error('[Statblock Forge] Template was saved, but its Atlas Role mirror could not be updated:', mirrorError);
        this.showNotice(`Template salvo, mas não apareceu nas Roles do Atlas: ${mirrorError instanceof Error ? mirrorError.message : String(mirrorError)}`, 10000);
      }
      const currentPath = this.file?.path ?? null;
      const wasRecoveryDraft = this.recoveryDraftId !== null;
      this.canOverwriteCurrentFile = true;
      this.originalText = result.serializedTemplate;
      this.template = result.template;
      this.layout = result.layout;
      this.displayName = savedAbstract.basename;
      this.rememberEditorDirtyBaseline();
      await this.clearPersistedDraftAfterSave();
      if (currentPath !== savedAbstract.path) {
        await this.leaf.openFile(savedAbstract, { active: true });
      } else {
        // Saving an existing template must update statblocks already open in
        // Markdown side panels and standalone Forge render views immediately.
        // Their refresh reloads the template schema but keeps each note's own YAML values.
        await this.plugin.refreshStatblocksUsingTemplate(savedAbstract.path);
        this.render();
      }
      if (wasRecoveryDraft) this.plugin.continueEditorDraftRecovery();
      this.showNotice(result.createdCopy
        ? `Novo template salvo: ${savedAbstract.name}`
        : `Template atualizado: ${savedAbstract.name}`);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    } finally {
      this.saving = false;
    }
  }


}
