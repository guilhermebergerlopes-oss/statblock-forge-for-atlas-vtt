import { Component, MarkdownRenderer, type App } from 'obsidian';
/**
 * Shared Forge statblock renderer, also used by the editor preview.
 *
 * This module intentionally depends only on Forge's public data model and DOM
 * APIs. It does not import Atlas UI components or execute Script/Opaque blocks.
 */
import {
  headerFieldForPart,
  isRecord,
  cloneJson,
  type ForgeBlock,
  type ForgeField,
  type ForgeLayoutDocument,
  type ForgeTemplate,
  type JsonRecord,
} from '../templates/forgeTemplate.ts';
import { abilityPartsForField, type AbilityPart } from '../templates/abilityPartsModel.ts';
import { compendiumCategories, fieldCompendiumItems, fieldCompendiumLinkedFieldKeys, isCollectionFieldType } from '../templates/fieldCompendiumModel.ts';
import { appendFieldCompendiumItemValue } from '../statblocks/fieldCompendiumInsertionModel.ts';
import { releaseFieldCompendiumEntrySource, usedFieldCompendiumItemIdsAcrossValues } from '../statblocks/fieldCompendiumUsageModel.ts';
import { isAbilitiesTabs } from '../templates/abilityTabsModel.ts';
import { abilityCounterMaxForRow, defaultAbilityEntry, normalizeAbilityCounterMarks, splitAbilityPartListText, withAbilityCounterMaxForRow } from '../templates/abilityPartValues.ts';
import { buildBlockAppearanceCss, nestedLayoutInlineBleed, resolveBlockAppearanceForMode } from '../templates/blockAppearance.ts';
import { resolveForgeBlockLabel } from '../templates/blockLabelModel.ts';
import { bindImageFocalLayout } from '../templates/imageFramingFocus.ts';
import { resolveNestedLayoutInlineBleeds } from './nestedLayoutSizing.ts';
import { normalizeStatblockThemeId, themePaletteFor } from '../templates/statblockThemes.ts';
import { groupRowChildrenBySpan, packPhysicalGrid, packVisibleGrid, requiredRowsForBlock, requiredRowsForRowLines } from '../templates/gridLayout.ts';
import { foldedSectionFooterLabel, isFoldedSectionExpanded, setFoldedSectionExpanded } from '../templates/foldedSectionModel.ts';
import { alignTargetAtViewportY } from './foldedSectionPointerAnchor.ts';
import { DEFAULT_GRID_COLUMN_COUNT, GRID_COLUMN_COUNT, MAX_GRID_COLUMN_COUNT } from '../templates/layoutLimits.ts';
import { readTemplateGridGeometry } from '../views/templateGridGeometry.ts';
import { evaluatePreviewFormula, groupPreviewGroups } from './previewValueModel.ts';
import { createStatblockRenderModel, templatePreviewData } from './statblockRenderModel.ts';
import { calculateNumericFieldValue, hasNumericFieldFormulaSettings, isFormulaCapableNumericField } from '../templates/numericFieldModel.ts';
import { DEFAULT_METRIC_SLOTS_PER_ROW, metricPreviewRows, metricSlotFormula, metricSlotFormulaLabel } from '../templates/metricEditorModel.ts';
import type { ScoreTableEdit } from '../templates/tableEditorModel.ts';
import { forgeTableCellValue, forgeTableRowLabel, isForgeTableRowDeletable, readForgeTableRows, updateForgeTableRows, FORGE_TABLE_MAX_ROWS } from '../statblocks/tableRowsModel.ts';
import { translateForgeText, type ForgeLanguage } from '../i18n/localization.ts';
import { renderCompendiumAbilityPreview } from './compendiumAbilityPreview.ts';
import { inlineNumericFieldDraftValue, numberFieldAdvantageRollFormula, parseInlineNumericFieldDraft } from '../statblocks/inlineNumericFieldEditorModel.ts';
import { inlineTextFieldDraftValue, isInlineTextField, parseInlineTextFieldDraft } from '../statblocks/inlineTextFieldEditorModel.ts';
import { inlineSpellGroupsDraftValue, serializeInlineSpellGroups, type InlineSpellGroupDraft } from '../statblocks/inlineSpellsFieldEditorModel.ts';
import { isAtlasEmptyFieldValue } from '../statblocks/inlineFieldEmptinessModel.ts';
import { shouldShowWhenEmptyFallback, whenEmptyFallbackSourceFieldKeys } from '../templates/whenEmptyFallbackModel.ts';
import { diceAverageHint, isDiceFieldValue } from '../statblocks/diceFieldEditorModel.ts';
import { hasDiceFieldFormula, resolveDiceFieldFormula } from '../statblocks/diceFieldFormulaModel.ts';
import { addInlineListItem, inlineListItems, removeInlineListItem, splitInlineListText } from '../statblocks/inlineListFieldEditorModel.ts';
import { inlinePairName, inlinePairValueText, inlinePairsFromValue, serializeInlinePairsDraftRows, type InlinePairDraft } from '../statblocks/inlinePairsFieldEditorModel.ts';
import { inlineEntryDraftValue, insertInlineEntryValue, moveInlineEntryValue, removeInlineEntryValue, updateInlineEntriesValue, type InlineEntryDraft } from '../statblocks/inlineEntriesFieldEditorModel.ts';
import { inlineEntryDropIndex, inlineEntryIndexAfterMove, moveInlineEntryBetweenFields } from '../statblocks/inlineEntryDragModel.ts';
import { checkboxFieldOptions, checkboxOptionIsEnabled, withCheckboxOptionValue } from '../templates/checkboxFieldModel.ts';
import { parseSelectionFieldPicks, readSelectionField, serializeSelectionFieldPicks, type SelectionFieldPick } from '../templates/selectionFieldModel.ts';
import { resolveInlineCounterRows, updateInlineCounterUsedValue } from '../statblocks/inlineCountersFieldEditorModel.ts';
import { counterUsesNumericDisplay, shouldShowCounterNumericValue } from '../statblocks/counterDisplayModel.ts';
import { DEFAULT_COUNTERS_PER_ROW, normalizeCountersPerRow } from '../templates/counterLayoutModel.ts';
import { FORGE_RESOURCE_VALUES_KEY, forgeResourceValuesAreValid, forgeTrackedResourceCurrent, setForgeTrackedResourceCurrent } from '../statblocks/forgeResourceValues.ts';
import { forgeTrackValues } from '../statblocks/forgeTrackValueModel.ts';
import { trackedNumberDisplayForField } from '../statblocks/trackedNumberDisplayModel.ts';
import { expandStatblockPattern } from '../templates/patternValueModel.ts';
import { openImageSocketActionsMenu } from './imageSocketActionsMenu.ts';
import { imageReferenceText } from './vaultImageResolver.ts';
import { DEFAULT_STATBLOCK_IMAGE_FRAME, normalizeStatblockImageFrame, panStatblockImageFrame, statblockImagePanTranslation, type StatblockImageFrame, type StatblockImageFrames } from '../statblocks/statblockImageFraming.ts';
import { rollableBonusFormula } from '../statblocks/statblockValueRolls.ts';
import { tableCellRollFormulas } from '../statblocks/tableCellRollsModel.ts';
import { resolveTableRowFormulaValues, tableCellReferenceIndex, tableColumnAggregateContext, tableColumnFormulaValue, tableFormulaMap } from '../statblocks/tableFormulaModel.ts';
import { appendForgeStatblockDiceText, setForgeStatblockDiceLink } from './statblockDiceLinkElement.ts';
import { linkForgeStatblockDice } from './statblockDiceLinks.ts';

export const FORGE_STATBLOCK_SOURCE_DATA_CHANGED_EVENT = 'forge:statblock-source-data-changed';

const forgeTableColumnResizeObservers = new WeakMap<HTMLElement, ResizeObserver>();

export interface StatblockRenderOptions {
  /** Obsidian application instance used by the native Markdown renderer. */
  app: App;
  /** Parent component for Markdown child components (normally the Forge plugin). */
  markdownComponent?: Component;
  /** Vault path used to resolve Markdown links and embeds. */
  sourcePath?: string;
  template: ForgeTemplate;
  layout: ForgeLayoutDocument;
  /** Complete field-value record for the creature/statblock being displayed. */
  data: JsonRecord;
  /** Resolves a Vault path to a browser-safe resource URL. */
  resolveImage?: (path: string) => string | undefined;
  /** Present only in the editor canvas; makes a Table preview directly editable. */
  onScoreTableEdit?: (blockId: string, edit: ScoreTableEdit) => void;
  /** Enable sample-only Ability Counter mark and maximum controls in the editor preview. */
  interactiveCounters?: boolean;
  /** Enable per-entry maximum controls in a real statblock and persist the changed row through this callback. */
  onAbilityCounterMaxChange?: (fieldKey: string, entryIndex: number) => void;
  /** Persist a scalar Field value edited directly at its rendered position. */
  onFieldValueChange?: (fieldKey: string, value: unknown) => Promise<void> | void;
  /** Read the source view's latest bound values after asynchronous persistence. */
  getLiveFieldData?: () => JsonRecord;
  /** Open the Image block's socket actions; supplied only by editable statblock views. */
  onImageFieldAction?: (fieldKey: string, socket: HTMLButtonElement) => void;
  /** Select an Image block in the editable template Canvas instead of opening its action menu. */
  onImageBlockSelect?: (blockId: string) => void;
  /** Per-statblock zoom and focal point, keyed by stable image block ID. */
  imageFrames?: Readonly<StatblockImageFrames>;
  /** Persist zoom or focal-point changes from a rendered statblock image. */
  onImageFrameChange?: (blockId: string, frame: StatblockImageFrame) => void;
  /** Shared runtime for calculated Number Fields; created once per render. */
  numericFieldRuntime?: NumericFieldRuntime;
  /** Focus the first empty editable Field once after opening a newly-created statblock. */
  focusFirstEmpty?: boolean;
  /** Omit blocks marked Total Hidden from the final statblock. */
  hideTotalHiddenBlocks?: boolean;
  /** Move collapsible Sections into footer buttons instead of reserving their original Grid area. */
  foldSectionsIntoFooter?: boolean;
  /** Mutable per-view state for Sections explicitly expanded in the folded-section footer. */
  expandedSectionIds?: Set<string>;
  /** Mutable per-view state for Sections explicitly collapsed in the folded-section footer. */
  collapsedSectionIds?: Set<string>;
  /** Language used only for Forge-generated UI labels and empty placeholders. */
  language?: ForgeLanguage;
}

/** Editor preview options intentionally omit real data and use template.sample. */
export interface StatblockPreviewOptions extends Omit<StatblockRenderOptions, 'data'> {}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function markForgeUiText<T extends HTMLElement>(node: T, source: string): T {
  node.dataset.forgeUiText = source;
  return node;
}

/** Picks a native control palette that matches a Forge theme rather than the host app theme. */
function colorSchemeForThemeBackground(background: string): 'light' | 'dark' {
  const match = /^#([0-9a-f]{6})$/i.exec(background);
  if (!match) return 'dark';
  const hex = match[1]!;
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
  return luminance >= 0.42 ? 'light' : 'dark';
}

/** Localizes only renderer-owned text explicitly marked as UI, never user-authored values. */
export function localizeRendererUiText(root: Pick<ParentNode, 'querySelectorAll'>, language: ForgeLanguage): void {
  for (const node of Array.from(root.querySelectorAll<HTMLElement>('[data-forge-ui-text], [data-forge-ui-placeholder], [data-forge-ui-title], [data-forge-ui-aria-label], [data-forge-ui-alt]'))) {
    const text = node.dataset.forgeUiText;
    if (text !== undefined) node.textContent = translateForgeText(text, language);
    const placeholder = node.dataset.forgeUiPlaceholder;
    if (placeholder !== undefined) node.setAttribute('placeholder', translateForgeText(placeholder, language));
    const title = node.dataset.forgeUiTitle;
    if (title !== undefined) node.setAttribute('title', translateForgeText(title, language));
    const ariaLabel = node.dataset.forgeUiAriaLabel;
    if (ariaLabel !== undefined) node.setAttribute('aria-label', translateForgeText(ariaLabel, language));
    const alt = node.dataset.forgeUiAlt;
    if (alt !== undefined) node.setAttribute('alt', translateForgeText(alt, language));
  }
}

function object(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function list(value: unknown): ForgeBlock[] {
  return Array.isArray(value)
    ? value.filter((item): item is ForgeBlock => isRecord(item)
      && typeof item.id === 'string' && typeof item.type === 'string')
    : [];
}

function valueOf(sample: JsonRecord, key: unknown): unknown {
  return typeof key === 'string' ? sample[key] : undefined;
}


/** Adds a template-library picker. Selecting an item copies it into this statblock only. */
function appendFieldCompendiumPicker(
  parent: HTMLElement,
  field: ForgeField | undefined,
  layout: ForgeLayoutDocument,
  sample: JsonRecord,
  runtime: NumericFieldRuntime | undefined,
  language: ForgeLanguage,
): void {
  if (!field || !runtime?.canEdit || !isCollectionFieldType(field.type)) return;
  const items = fieldCompendiumItems(layout, field);
  const pt = language === 'pt-BR';
  const actionRow = parent.classList.contains('statblock-forge__entry-actions')
    ? parent
    : element('div', 'statblock-forge__entry-actions');
  const root = element('div', 'statblock-forge__compendium-picker');
  root.dataset.noBlockEdit = 'true';
  const trigger = element('button', 'statblock-forge__entry-action-button', 'Compendium');
  trigger.type = 'button';
  trigger.dataset.noBlockEdit = 'true';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', pt ? `Adicionar conteúdo de ${field.label || field.key}` : `Add content from ${field.label || field.key}`);
  root.append(trigger);

  const popover = element('section', 'statblock-forge__compendium-picker-popover');
  popover.addEventListener('click', (event) => event.stopPropagation());
  popover.hidden = true;
  popover.dataset.noBlockEdit = 'true';
  popover.tabIndex = -1;
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', pt ? `Biblioteca: ${field.label || field.key}` : `Library: ${field.label || field.key}`);
  const popoverHeader = element('div', 'statblock-forge__compendium-picker-header');
  const heading = element('div', 'statblock-forge__compendium-picker-heading');
  heading.append(element('strong', '', pt ? 'Adicionar do Compendium' : 'Add from Compendium'));
  const itemCount = element('span', '', `${field.label.trim() || field.key} · ${items.length} ${pt ? 'itens' : 'items'}`);
  heading.append(itemCount);
  const close = element('button', 'statblock-forge__compendium-picker-close', '×');
  close.type = 'button';
  close.dataset.noBlockEdit = 'true';
  close.setAttribute('aria-label', pt ? 'Fechar biblioteca' : 'Close library');
  popoverHeader.append(heading, close);
  popover.append(popoverHeader);
  popover.append(element('p', 'statblock-forge__compendium-picker-hint', pt
    ? 'Escolha um conteúdo para inserir uma cópia editável somente nesta ficha.'
    : 'Choose an item to insert an editable copy into this statblock only.'));

  const filters = element('div', 'statblock-forge__compendium-picker-filters');
  const search = element('input', 'statblock-forge__compendium-picker-search');
  search.type = 'search';
  search.placeholder = pt ? 'Buscar nome, categoria ou conteúdo…' : 'Search name, category, or content…';
  search.setAttribute('aria-label', pt ? 'Buscar na biblioteca' : 'Search library');
  const categoryFilter = element('select', 'statblock-forge__compendium-picker-category');
  const allCategories = element('option', '', pt ? 'Todas as categorias' : 'All categories');
  allCategories.value = '';
  categoryFilter.append(allCategories);
  for (const category of compendiumCategories(items)) {
    const option = element('option', '', category);
    option.value = category;
    categoryFilter.append(option);
  }
  if (items.some((item) => !item.category?.trim())) {
    const option = element('option', '', pt ? 'Sem categoria' : 'Uncategorized');
    option.value = '__uncategorized__';
    categoryFilter.append(option);
  }
  categoryFilter.setAttribute('aria-label', pt ? 'Filtrar por categoria' : 'Filter by category');
  filters.append(search, categoryFilter);
  popover.append(filters);

  const list = element('div', 'statblock-forge__compendium-picker-list');
  const emptyLibrary = element('p', 'statblock-forge__compendium-picker-empty', pt
    ? 'Esta biblioteca está vazia. Cadastre conteúdos na aba Compendium do Template Editor.'
    : 'This library is empty. Add content in the Template Editor Compendium tab.');
  emptyLibrary.hidden = items.length > 0;
  list.append(emptyLibrary);
  const categories = compendiumCategories(items);
  const grouped = new Map<string, typeof items>();
  for (const category of categories) grouped.set(category, items.filter((item) => (item.category ?? '').trim() === category));
  const uncategorized = items.filter((item) => !(item.category ?? '').trim());
  if (uncategorized.length) grouped.set('__uncategorized__', uncategorized);

  const itemRows: Array<{ row: HTMLElement; group: HTMLElement; itemId: string; category: string; searchText: string }> = [];
  for (const [categoryKey, categoryItems] of grouped) {
    const group = element('section', 'statblock-forge__compendium-picker-group');
    group.dataset.category = categoryKey;
    const groupHeading = element('div', 'statblock-forge__compendium-picker-group-heading');
    groupHeading.append(element('strong', '', categoryKey === '__uncategorized__'
      ? (pt ? 'Sem categoria' : 'Uncategorized') : categoryKey));
    groupHeading.append(element('span', '', String(categoryItems.length)));
    group.append(groupHeading);

    for (const item of categoryItems) {
      const row = element('article', 'statblock-forge__compendium-picker-item');
      const copy = element('div', 'statblock-forge__compendium-picker-item-copy');
      if (item.category?.trim()) copy.append(element('span', 'statblock-forge__compendium-picker-category-chip', item.category));
      let summaryText = '';
      if (field.type === 'entries') {
        const abilityPreview = renderCompendiumAbilityPreview(field, item.value, language, item.name);
        copy.append(abilityPreview);
        summaryText = JSON.stringify(item.value) ?? '';
      } else {
        copy.append(element('strong', '', item.name));
        const description = item.value;
        if (field.type === 'list' && typeof description === 'string') summaryText = description;
        else if (field.type === 'pairs' && isRecord(description)) {
          summaryText = Object.entries(description).map(([key, value]) => `${key}: ${String(value ?? '')}`).join(' · ');
        } else if (field.type === 'spells' && Array.isArray(description)) {
          summaryText = description.map((part) => {
            if (typeof part === 'string') return part;
            if (!isRecord(part)) return '';
            return Object.entries(part).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value ?? '')}`).join(' · ');
          }).filter(Boolean).join(' · ');
        }
        if (summaryText) copy.append(element('span', 'statblock-forge__compendium-picker-summary', summaryText));
      }
      const add = element('button', 'statblock-forge__compendium-picker-add', pt ? 'Adicionar' : 'Add');
      add.type = 'button';
      add.dataset.noBlockEdit = 'true';
      add.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (runtime.isSaving || !parent.isConnected) return;
        const currentData = runtime.getCurrentData();
        const next = appendFieldCompendiumItemValue(field.type, currentData[field.key], item.value, item.id);
        add.disabled = true;
        try {
          await runtime.setBaseValue(field.key, next);
          if (field.type === 'entries') runtime.refreshEntryList(field.key);
          closePopover(false);
        } catch (error) {
          add.disabled = false;
          const errorText = error instanceof Error ? error.message : String(error);
          row.append(element('span', 'statblock-forge__inline-field-editor-error', errorText));
        }
      });
      row.append(copy, add);
      group.append(row);
      itemRows.push({ row, group, itemId: item.id, category: item.category?.trim() ?? '', searchText: `${item.name} ${summaryText} ${item.category ?? ''} ${JSON.stringify(item.value) ?? ''}`.toLocaleLowerCase() });
    }
    list.append(group);
  }
  const noResults = element('p', 'statblock-forge__compendium-picker-empty', pt ? 'Nenhum conteúdo corresponde aos filtros.' : 'No content matches these filters.');
  noResults.hidden = true;
  list.append(noResults);
  const applyFilters = (): void => {
    const query = search.value.trim().toLocaleLowerCase();
    const category = categoryFilter.value;
    // Read live renderer data rather than the sample captured when this picker
    // was created. Inline entry edits and Counter controls can replace or mutate
    // a Field value without rebuilding the picker DOM.
    const currentData = runtime.getCurrentData();
    const linkedValues = field.type === 'entries'
      ? fieldCompendiumLinkedFieldKeys(layout, field).map((fieldKey) => currentData[fieldKey])
      : [];
    const usedIds = field.type === 'entries'
      ? usedFieldCompendiumItemIdsAcrossValues(items, linkedValues)
      : new Set<string>();
    let availableCount = 0;
    let visibleCount = 0;
    const visibleGroups = new Set<HTMLElement>();
    for (const item of itemRows) {
      const unavailable = usedIds.has(item.itemId);
      if (!unavailable) availableCount += 1;
      const categoryMatches = !category || (category === '__uncategorized__' ? !item.category : item.category === category);
      const visible = !unavailable && categoryMatches && (!query || item.searchText.includes(query));
      item.row.hidden = !visible;
      if (visible) {
        visibleCount += 1;
        visibleGroups.add(item.group);
      }
    }
    for (const group of grouped.keys()) {
      const node = Array.from(list.children).find((child): child is HTMLElement => child instanceof HTMLElement
        && child.classList.contains('statblock-forge__compendium-picker-group') && child.dataset.category === group);
      if (node) node.hidden = !visibleGroups.has(node);
    }
    itemCount.textContent = field.type === 'entries'
      ? `${field.label.trim() || field.key} · ${availableCount} ${pt ? 'disponíveis' : 'available'}`
      : `${field.label.trim() || field.key} · ${items.length} ${pt ? 'itens' : 'items'}`;
    noResults.textContent = field.type === 'entries' && availableCount === 0 && items.length > 0
      ? (pt ? 'Todas as habilidades desta biblioteca já estão nesta ficha. Edite ou apague uma para disponibilizá-la novamente.' : 'All abilities from this library are already in this statblock. Edit or delete one to make it available again.')
      : (pt ? 'Nenhum conteúdo corresponde aos filtros.' : 'No content matches these filters.');
    noResults.hidden = visibleCount > 0 || items.length === 0;
    emptyLibrary.hidden = items.length > 0;
  };
  search.addEventListener('input', applyFilters);
  categoryFilter.addEventListener('change', applyFilters);
  runtime.subscribeCompendiumAvailability(applyFilters);
  applyFilters();
  popover.append(list);

  let isOpen = false;
  const positionPopover = (): void => {
    if (!isOpen || !trigger.isConnected) return;
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    const width = Math.min(440, Math.max(280, viewportWidth - 24));
    const left = Math.max(12, Math.min(rect.left, viewportWidth - width - 12));
    const availableBelow = Math.max(0, viewportHeight - rect.bottom - 12);
    const availableAbove = Math.max(0, rect.top - 12);
    const openAbove = availableBelow < 280 && availableAbove > availableBelow;
    const maxHeight = Math.max(160, Math.min(480, (openAbove ? availableAbove : availableBelow) || 480));
    popover.setCssStyles({ position: 'fixed' });
    popover.setCssStyles({ left: `${left}px` });
    popover.setCssStyles({ width: `${Math.min(width, viewportWidth - 24)}px` });
    popover.setCssStyles({ maxHeight: `${maxHeight}px` });
    popover.setCssStyles({ top: openAbove
      ? `${Math.max(12, rect.top - maxHeight - 6)}px`
      : `${Math.min(viewportHeight - maxHeight - 12, rect.bottom + 6)}px` });
  };
  const closePopover = (restoreFocus = false): void => {
    if (!isOpen) return;
    isOpen = false;
    popover.hidden = true;
    popover.remove();
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onDocumentPointerDown, true);
    document.removeEventListener('keydown', onDocumentKeyDown, true);
    window.removeEventListener('resize', positionPopover);
    window.removeEventListener('scroll', positionPopover, true);
    if (restoreFocus && trigger.isConnected) trigger.focus();
  };
  const onDocumentPointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (target instanceof Node && (root.contains(target) || popover.contains(target))) return;
    closePopover();
  };
  const onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    closePopover(true);
  };
  const openPopover = (): void => {
    // Reconcile against the latest saved/in-memory data every time the picker
    // opens. This also repairs stale visibility after edits made while it was
    // closed or after another linked Collection Field changed.
    applyFilters();
    isOpen = true;
    popover.hidden = false;
    document.body.append(popover);
    trigger.setAttribute('aria-expanded', 'true');
    positionPopover();
    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    document.addEventListener('keydown', onDocumentKeyDown, true);
    window.addEventListener('resize', positionPopover);
    window.addEventListener('scroll', positionPopover, true);
    if (items.length) search.focus({ preventScroll: true });
    else close.focus();
  };
  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isOpen) closePopover();
    else openPopover();
  });
  close.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    closePopover(true);
  });
  root.addEventListener('click', (event) => event.stopPropagation());

  if (parent === actionRow) actionRow.append(root);
  else {
    actionRow.append(root);
    parent.append(actionRow);
  }
}

/** Adds an explicit statblock-only editing action to every editable Collection type. */
function appendCustomCollectionValueAction(
  actionRow: HTMLElement,
  field: ForgeField | undefined,
  runtime: NumericFieldRuntime | undefined,
  language: ForgeLanguage,
): void {
  if (!field || !runtime?.canEdit || !isCollectionFieldType(field.type) || field.type === 'entries') return;
  const pt = language === 'pt-BR';
  const add = element('button', 'statblock-forge__entry-action-button statblock-forge__entry-add-trigger', pt ? 'Personalizado' : 'Custom');
  add.type = 'button';
  add.dataset.noBlockEdit = 'true';
  // The card-level capture handler resolves the owning inline-edit region from
  // this trigger and its enclosing Field slot. This avoids relying on the
  // event reaching a particular nested Atlas block listener.
  add.dataset.forgeCustomField = field.key;
  add.title = pt
    ? 'Abre o editor para adicionar valores personalizados somente nesta ficha. Eles não serão adicionados ao Compêndio.'
    : 'Opens the editor to add custom values to this statblock only. They will not be added to the Compendium.';
  add.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    // Dispatch from the trigger itself. Resolving the nearest data-block-id
    // here can target an inner Atlas frame in nested layouts, which is not
    // necessarily the frame that owns this Field's registered inline editor.
    add.dispatchEvent(new CustomEvent('forge:edit-field', {
      bubbles: true,
      detail: { fieldKey: field.key },
    }));
  });
  actionRow.append(add);
}

export function readablePreviewValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(readablePreviewValue).filter(Boolean).join(', ');
  if (isRecord(value)) {
    return Object.entries(value)
      .filter(([key]) => key !== '_atlasCounterMaxes')
      .map(([key, item]) => `${key}: ${readablePreviewValue(item)}`)
      .filter((item) => !item.endsWith(': '))
      .join(' · ');
  }
  return String(value);
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

interface NumericFieldRuntime {
  readonly canEdit: boolean;
  readonly isSaving: boolean;
  readonly language: ForgeLanguage;
  value(field: ForgeField | undefined, sample: JsonRecord): number | null;
  /** Evaluate a numeric expression with access to the current statblock's Table cells. */
  evaluateFormula(formula: string, sample: Record<string, unknown>, slotValue: unknown, selfFieldKey?: string): number | null;
  /** Resolve a formula-backed Dice Field; null means no formula, empty means unresolved. */
  diceFormula(field: ForgeField, sample: JsonRecord): string | null;
  setBaseValue(fieldKey: string, value: unknown): Promise<void>;
  subscribe(fieldKey: string, update: () => void): void;
  /** Refresh every formula output after a non-numeric source Field changes. */
  subscribeAll(update: () => void): void;
  refreshAll(): void;
  /** Refresh the rendered rows for an Entries Field after a cross-tab move. */
  refreshEntryList(fieldKey: string): void;
  /** Read the renderer's current mutable statblock data. */
  getCurrentData(): JsonRecord;
  /** Subscribe only to updates that can change Compendium item availability. */
  subscribeCompendiumAvailability(update: () => void): void;
  /** Reconcile Compendium availability after an external source update. */
  refreshCompendiumAvailability(): void;
  /** Register the rendered Entries list so cross-tab moves can redraw it. */
  registerEntryList(fieldKey: string, refresh: () => void): void;
  /** Exit a field editor through the shared template-order navigation. */
  navigate(fieldKey: string, step: 1 | -1): Promise<void>;
  setNavigationHandler(handler: ((fieldKey: string, step: 1 | -1) => Promise<void>) | null): void;
}

function createNumericFieldRuntime(
  fields: readonly ForgeField[],
  data: JsonRecord,
  onValueChange?: (fieldKey: string, value: unknown) => Promise<void> | void,
  language: ForgeLanguage = 'en',
  getLiveFieldData?: () => JsonRecord,
  tableReferences: ReturnType<typeof tableCellReferenceIndex> = {},
): NumericFieldRuntime {
  const listeners = new Map<string, Set<() => void>>();
  const allListeners = new Set<() => void>();
  const compendiumAvailabilityListeners = new Set<() => void>();
  const notifyCompendiumAvailability = (): void => {
    for (const update of compendiumAvailabilityListeners) update();
  };
  const entryListRenderers = new Map<string, Set<() => void>>();
  const notify = (fieldKey: string): void => {
    for (const update of listeners.get(fieldKey) ?? []) update();
  };
  const notifyAll = (): void => {
    for (const group of listeners.values()) {
      for (const update of group) update();
    }
    for (const update of allListeners) update();
    notifyCompendiumAvailability();
  };
  let savingValue = false;
  let navigationHandler: ((fieldKey: string, step: 1 | -1) => Promise<void>) | null = null;
  const evaluateFormula = (formula: string, sample: Record<string, unknown>, slotValue: unknown, selfFieldKey?: string): number | null =>
    evaluatePreviewFormula(formula, sample, slotValue, fields, tableReferences, data, selfFieldKey);
  const runtime: NumericFieldRuntime = {
    canEdit: typeof onValueChange === 'function',
    get isSaving() { return savingValue; },
    language,
    value(field, sample) {
      if (!field) return null;
      return calculateNumericFieldValue(field, sample, evaluateFormula);
    },
    evaluateFormula,
    diceFormula(field, sample) {
      return resolveDiceFieldFormula(field, fields, sample, (sourceField) =>
        calculateNumericFieldValue(sourceField, sample, evaluateFormula));
    },
    async setBaseValue(fieldKey, value) {
      if (!onValueChange) throw new Error('A edição contextual não está habilitada nesta visualização.');
      const hadPrevious = Object.prototype.hasOwnProperty.call(data, fieldKey);
      const previous = data[fieldKey];
      if (hadPrevious && Object.is(previous, value)) return;
      data[fieldKey] = value;
      savingValue = true;
      notifyAll();
      try {
        await onValueChange(fieldKey, value);
        // Notify again after persistence: consumers such as the Compendium
        // picker must reconcile with the committed value, not only the draft
        // assigned before the asynchronous save completed.
        notifyAll();
      } catch (error) {
        if (hadPrevious) data[fieldKey] = previous;
        else delete data[fieldKey];
        notifyAll();
        throw error;
      } finally {
        savingValue = false;
        // Subscribers disable inline controls while a value is being saved.
        // Notify them again after clearing the flag so controls (including
        // Gauge +/- buttons) become available for subsequent interactions.
        notifyAll();
      }
    },
    subscribe(fieldKey, update) {
      const group = listeners.get(fieldKey) ?? new Set<() => void>();
      group.add(update);
      listeners.set(fieldKey, group);
    },
    subscribeAll(update) {
      allListeners.add(update);
    },
    refreshAll() {
      notifyAll();
    },
    refreshEntryList(fieldKey) {
      const renderers = entryListRenderers.get(fieldKey);
      if (!renderers) return;
      for (const refresh of Array.from(renderers)) refresh();
    },
    getCurrentData() {
      // The owning StatblockRenderSurface updates its source binding only after
      // the Vault write completes. Prefer that committed binding so the picker
      // never calculates availability from an older renderer snapshot.
      return getLiveFieldData?.() ?? data;
    },
    subscribeCompendiumAvailability(update) {
      compendiumAvailabilityListeners.add(update);
    },
    refreshCompendiumAvailability() {
      notifyCompendiumAvailability();
    },
    registerEntryList(fieldKey, refresh) {
      const renderers = entryListRenderers.get(fieldKey) ?? new Set<() => void>();
      renderers.add(refresh);
      entryListRenderers.set(fieldKey, renderers);
    },
    navigate(fieldKey, step) {
      return navigationHandler?.(fieldKey, step) ?? Promise.resolve();
    },
    setNavigationHandler(handler) {
      navigationHandler = handler;
    },
  };
  return runtime;
}

interface InlineEditSlot {
  slot: HTMLElement;
  rest: HTMLElement;
  open(layer: HTMLElement, display: HTMLElement): void;
  close(layer: HTMLElement, display: HTMLElement): void;
}

interface InlineBlockEditSession {
  fieldKey: string;
  control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  /** Composite editors use a containing element for focus/keyboard boundaries. */
  eventRoot?: HTMLElement;
  commit(): Promise<boolean>;
  close(): void;
  /** Optional key handler for controls whose keys have field-specific meanings (e.g. List chips). */
  handleKeyDown?(event: KeyboardEvent): boolean;
}

interface InlineSlotEditorDefinition {
  fieldKey: string;
  open(): InlineBlockEditSession | null;
}

interface FoldableSectionButton {
  id: string;
  label: string;
  expanded: boolean;
  initiallyExpanded: boolean;
}

interface StatblockLayoutUiState {
  omittedIds: Set<string>;
  totalHiddenIds: Set<string>;
  expandedSectionIds: Set<string>;
  collapsedSectionIds: Set<string>;
  unnamedSectionCount: number;
  foldableSections: FoldableSectionButton[];
  gridUpdates: Array<() => void>;
}


const inlineSlotEditors = new WeakMap<HTMLElement, InlineSlotEditorDefinition>();

const INLINE_FIELD_FORMAT_PROPERTIES = [
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-variant',
  'font-variant-numeric',
  'font-weight',
  'font-stretch',
  'font-kerning',
  'font-feature-settings',
  'font-variation-settings',
  'font-optical-sizing',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'text-align',
  'text-align-last',
  'text-decoration',
  'text-indent',
  'text-transform',
  'white-space',
  'overflow-wrap',
  'word-break',
  'hyphens',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'direction',
  'writing-mode',
  'vertical-align',
] as const;

/**
 * A native form control does not reliably inherit every typographic property
 * from its parent (notably text alignment and theme-specific Field colors).
 * Copy only the rendered value's typography to the temporary editor control;
 * layout chrome, backgrounds and borders remain owned by the surrounding slot.
 */
function preserveInlineFieldFormatting(control: HTMLElement, display: HTMLElement): void {
  const view = display.ownerDocument.defaultView;
  if (!view) return;
  const rendered = view.getComputedStyle(display);
  for (const property of INLINE_FIELD_FORMAT_PROPERTIES) {
    const value = rendered.getPropertyValue(property);
    if (value) control.setCssProps({ [property]: value });
  }

  // A native input's intrinsic width is usually much wider than the inline
  // value it replaces. That becomes visible with centered/right-aligned Fields:
  // the editor text is aligned inside the browser's default input width instead
  // of the exact text box occupied by the rendered value. Keep single-line
  // inputs fixed to the displayed value. A Markdown textarea is different: it
  // must use the full block width and remain comfortably writable even when
  // its current value is empty or only a few characters long.
  if (control instanceof HTMLInputElement && control.type !== 'checkbox' && control.type !== 'radio') {
    const bounds = display.getBoundingClientRect();
    // Static editor geometry and chrome are defined by the matching CSS class.
    // Only the measured dimensions vary with the currently rendered Field.
    control.classList.add('is-inline-measured');
    if (bounds.width > 0) control.setCssStyles({ width: `${bounds.width}px` });
    // Single-line controls have a browser-defined intrinsic height. Match the
    // rendered value's line box so the typed glyphs start on the same baseline.
    if (bounds.height > 0) control.setCssStyles({ height: `${bounds.height}px` });
  }
}

function registerInlineSlotEditor(
  slot: HTMLElement,
  fieldKey: string,
  open: () => InlineBlockEditSession | null,
  display?: HTMLElement,
): void {
  slot.dataset.forgeInlineField = fieldKey;
  inlineSlotEditors.set(slot, {
    fieldKey,
    open: () => {
      const session = open();
      if (session && display) preserveInlineFieldFormatting(session.control, display);
      return session;
    },
  });
}

/**
 * Mirrors Atlas' ValueSlot: the rendered value stays mounted in its own spot;
 * the input is layered over it only while its containing block is being edited.
 */
function createInlineEditSlot(
  tag: 'span' | 'div',
  className: string,
  display: HTMLElement,
  block = false,
): InlineEditSlot {
  const slot = element(tag, `atlas-sb-pane-slot statblock-forge__inline-edit-slot${block ? ' atlas-sb-pane-slot--blocks is-block' : ''} ${className}`);
  const rest = element(tag, 'atlas-sb-pane-slot__rest statblock-forge__inline-edit-slot-rest');
  rest.append(display);
  slot.append(rest);
  return {
    slot,
    rest,
    open(layer, trigger) {
      slot.classList.add('atlas-sb-pane-slot--editing', 'is-editing');
      rest.setAttribute('aria-hidden', 'true');
      rest.inert = true;
      trigger.dataset.editing = 'true';
      slot.append(layer);
    },
    close(layer, trigger) {
      layer.remove();
      slot.classList.remove('atlas-sb-pane-slot--editing', 'is-editing');
      rest.removeAttribute('aria-hidden');
      rest.inert = false;
      delete trigger.dataset.editing;
    },
  };
}

interface InlineEditRegion {
  root: HTMLElement;
  type: string;
  slots: Array<{ node: HTMLElement; definition: InlineSlotEditorDefinition }>;
  sessions: Map<string, InlineBlockEditSession>;
}

interface InlineNavigationTarget {
  fieldKey: string;
  region?: InlineEditRegion;
  entryRoot?: HTMLElement;
  tableFrame?: HTMLElement;
}


/**
 * Atlas' paneChrome/PaneSlot interaction, adapted to Forge's DOM renderer.
 * A leaf block is the hit target; all its supported values become inputs in
 * their existing slots. Tab follows template Field order across the card.
 */
function bindAtlasInlineBlockEditing(card: HTMLElement, template: ForgeTemplate, language: ForgeLanguage, numericRuntimeForCard: NumericFieldRuntime, data: JsonRecord, focusFirstEmpty = false): void {
  const regions: InlineEditRegion[] = [];
  const fieldsByKey = new Map(template.fields.map((field) => [field.key, field]));
  // Use Forge-owned block roots, not every Atlas element carrying a block id.
  // Atlas may introduce nested frames around container contents; those wrappers
  // are presentation details and must never steal ownership of a Selection slot.
  const frames = Array.from(card.querySelectorAll<HTMLElement>(
    '.statblock-forge__preview-block[data-block-id], .atlas-sb-header [data-block-id]',
  ));
  const entryRoots = Array.from(card.querySelectorAll<HTMLElement>('.statblock-forge__preview-entries[data-forge-entry-field]'));
  const tableFrames = Array.from(card.querySelectorAll<HTMLElement>('[data-table-live][data-forge-table-field]'));

  for (const root of frames) {
    const isForgeBlockRoot = root.matches('.statblock-forge__preview-block[data-block-id]');
    const slots = Array.from(root.querySelectorAll<HTMLElement>('.statblock-forge__inline-edit-slot[data-forge-inline-field]'))
      .filter((slot) => {
        if (isForgeBlockRoot) {
          // Resolve ownership by the nearest Forge-rendered block. Do not use
          // closest('[data-block-id]'): Atlas can insert nested frames with the
          // same attribute, which previously made every Selection inside those
          // containers disappear from the editor registry.
          return slot.closest('.statblock-forge__preview-block[data-block-id]') === root;
        }
        // Header values are generated by Atlas' header renderer and have no
        // Forge preview-block wrapper of their own.
        return slot.closest('[data-block-id]') === root;
      })
      .flatMap((node) => {
        const definition = inlineSlotEditors.get(node);
        return definition ? [{ node, definition }] : [];
      });
    if (slots.length === 0) continue;

    const unique = new Map<string, { node: HTMLElement; definition: InlineSlotEditorDefinition }>();
    for (const entry of slots) if (!unique.has(entry.definition.fieldKey)) unique.set(entry.definition.fieldKey, entry);
    const fieldOrder = new Map(template.fields.map((field, index) => [field.key, index]));
    const orderedSlots = [...unique.values()].sort((a, b) =>
      (fieldOrder.get(a.definition.fieldKey) ?? Number.MAX_SAFE_INTEGER)
      - (fieldOrder.get(b.definition.fieldKey) ?? Number.MAX_SAFE_INTEGER));

    root.classList.add('atlas-sb-pane-value');
    root.tabIndex = 0;
    root.setAttribute('role', 'button');
    const fieldNames = orderedSlots.map(({ definition }) => fieldsByKey.get(definition.fieldKey)?.label || definition.fieldKey);
    root.setAttribute('aria-label', `${language === 'pt-BR' ? 'Editar' : 'Edit'} ${fieldNames.join(', ')}`);
    regions.push({ root, type: root.dataset.block ?? '', slots: orderedSlots, sessions: new Map() });
  }

  if (regions.length === 0 && entryRoots.length === 0 && tableFrames.length === 0) return;

  // Atlas chooses the first visible block for each Field in card order, then
  // walks those Fields in template order. Keep those two rules separate: the
  // source element must be the first rendered occurrence, not whichever
  // renderer category happened to be processed first here.
  const candidateTargets: InlineNavigationTarget[] = [];
  for (const region of regions) {
    for (const slot of region.slots) {
      candidateTargets.push({ region, fieldKey: slot.definition.fieldKey });
    }
  }
  for (const entryRoot of entryRoots) {
    const fieldKey = entryRoot.dataset.forgeEntryField;
    if (fieldKey) candidateTargets.push({ entryRoot, fieldKey });
  }
  for (const tableFrame of tableFrames) {
    const fieldKey = tableFrame.dataset.forgeTableField;
    const root = tableFrame.closest<HTMLElement>('.atlas-sb-item[data-block-id]');
    if (!fieldKey || !root) continue;
    if (!root.classList.contains('atlas-sb-pane-value')) {
      root.classList.add('atlas-sb-pane-value');
      root.tabIndex = 0;
      root.setAttribute('role', 'button');
      const label = fieldsByKey.get(fieldKey)?.label || fieldKey;
      root.setAttribute('aria-label', `${language === 'pt-BR' ? 'Editar' : 'Edit'} ${label}`);
    }
    candidateTargets.push({ tableFrame, fieldKey });
  }
  const targetRoot = (target: InlineNavigationTarget): HTMLElement | null =>
    target.region?.root
    ?? target.entryRoot?.closest<HTMLElement>('.atlas-sb-item[data-block-id]')
    ?? target.tableFrame?.closest<HTMLElement>('.atlas-sb-item[data-block-id]')
    ?? target.entryRoot
    ?? target.tableFrame
    ?? null;
  candidateTargets.sort((a, b) => {
    const left = targetRoot(a);
    const right = targetRoot(b);
    if (!left || !right || left === right) return 0;
    const position = left.compareDocumentPosition(right);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
  const navigationByField = new Map<string, InlineNavigationTarget>();
  for (const target of candidateTargets) {
    if (!navigationByField.has(target.fieldKey)) navigationByField.set(target.fieldKey, target);
  }
  const navigation = [...navigationByField.values()].sort((a, b) =>
    template.fields.findIndex((field) => field.key === a.fieldKey)
    - template.fields.findIndex((field) => field.key === b.fieldKey));

  let active: InlineEditRegion | null = null;
  let transition: Promise<void> = Promise.resolve();
  const schedule = (work: () => Promise<void>): Promise<void> => {
    const next = transition.then(work, work);
    transition = next.then(() => undefined, () => undefined);
    return next;
  };

  const closeActive = async (commit: boolean): Promise<boolean> => {
    const region = active;
    if (!region) return true;
    if (commit) {
      for (const session of region.sessions.values()) {
        const saved = await session.commit();
        if (!saved) {
          session.control.focus();
          return false;
        }
      }
    }
    for (const session of region.sessions.values()) {
      if (!commit) session.control.dataset.forgeDiscarding = 'true';
      session.close();
    }
    region.sessions.clear();
    region.root.classList.remove('atlas-sb-pane-editing');
    active = null;
    return true;
  };

  const focusSession = (region: InlineEditRegion, fieldKey?: string): void => {
    const session = (fieldKey ? region.sessions.get(fieldKey) : null)
      ?? region.sessions.values().next().value as InlineBlockEditSession | undefined;
    if (!session) {
      region.root.focus();
      return;
    }
    session.control.focus();
    if (session.control instanceof HTMLTextAreaElement) {
      // Markdown is a document-like value: place the caret at the end instead
      // of selecting the entire contents. This lets users continue typing
      // naturally, while Ctrl+A remains available for an intentional replace.
      const end = session.control.value.length;
      session.control.setSelectionRange(end, end);
    } else if (session.control instanceof HTMLInputElement && session.control.type !== 'checkbox') {
      session.control.select();
    }
  };

  const openRegion = async (region: InlineEditRegion, fieldKey?: string): Promise<void> => {
    if (active !== region) {
      if (active && !(await closeActive(true))) return;
      active = region;
      region.root.classList.add('atlas-sb-pane-editing');
      const targets = region.type === 'metric'
        ? region.slots.filter(({ definition }) => definition.fieldKey === fieldKey).slice(0, 1)
        : region.slots;
      const selectedTargets = targets.length ? targets : region.slots.slice(0, 1);
      for (const { node, definition } of selectedTargets) {
        const session = definition.open();
        if (!session) continue;
        region.sessions.set(definition.fieldKey, session);
        const eventRoot = session.eventRoot ?? session.control;
        if (session.eventRoot) {
          session.eventRoot.addEventListener('focusout', (event) => {
            const nextTarget = event instanceof FocusEvent ? event.relatedTarget : null;
            if (nextTarget instanceof Node && session.eventRoot?.contains(nextTarget)) return;
            if (session.control.dataset.forgeDiscarding !== 'true') void session.commit();
          });
        } else {
          session.control.addEventListener('blur', () => {
            if (session.control.dataset.forgeDiscarding !== 'true') void session.commit();
          });
        }
        const onControlKeyDown = (event: Event): void => {
          if (!(event instanceof KeyboardEvent)) return;
          if (session.handleKeyDown?.(event)) return;
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            void schedule(async () => {
              await closeActive(false);
              region.root.focus();
            });
            return;
          }
          const multilineCommit = session.control instanceof HTMLTextAreaElement
            && event.key === 'Enter' && (event.ctrlKey || event.metaKey);
          if (event.key === 'Tab' && session.eventRoot) {
            const focusable = Array.from(session.eventRoot.querySelectorAll<HTMLElement>(
              'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])',
            ));
            const currentIndex = focusable.indexOf(event.target as HTMLElement);
            const insideEditor = currentIndex >= 0 && (event.shiftKey ? currentIndex > 0 : currentIndex < focusable.length - 1);
            if (insideEditor) return;
          }
          if (event.key === 'Tab') {
            event.preventDefault();
            event.stopPropagation();
            void schedule(async () => {
              if (!(await session.commit())) {
                session.control.focus();
                return;
              }
              const currentIndex = navigation.findIndex((entry) => entry.fieldKey === session.fieldKey);
              const next = navigation[currentIndex + (event.shiftKey ? -1 : 1)];
              if (!(await closeActive(true))) return;
              if (next) await openNavigationTarget(next, event.shiftKey ? -1 : 1);
              else region.root.focus();
            });
            return;
          }
          if (event.key === 'Enter' && (!(session.control instanceof HTMLTextAreaElement) || multilineCommit)) {
            event.preventDefault();
            event.stopPropagation();
            void schedule(async () => {
              if (await closeActive(true)) region.root.focus();
            });
          }
        };
        eventRoot.addEventListener('keydown', onControlKeyDown);
        if (session.control instanceof HTMLSelectElement && !session.eventRoot) {
          session.control.addEventListener('change', () => {
            void schedule(async () => {
              if (await closeActive(true)) region.root.focus();
            });
          });
        }
      }
    } else if (region.type === 'metric' && fieldKey && !region.sessions.has(fieldKey)) {
      // A Metric has one input at a time, selected by the number the user clicked.
      if (!(await closeActive(true))) return;
      await openRegion(region, fieldKey);
      return;
    }
    focusSession(region, fieldKey);
  };

  // Selection must be reachable from every Forge-rendered surface. Delegate
  // clicks from the statblock card and resolve the exact registered slot rather
  // than relying on the nearest Atlas [data-block-id], which may be a generated
  // nested frame. This single path covers ordinary blocks, nested Containers,
  // Metrics and Selection values rendered in other Forge-owned regions.
  const selectionRegionsBySlot = new Map<HTMLElement, InlineEditRegion>();
  for (const region of regions) {
    for (const slot of region.slots) {
      if (fieldsByKey.get(slot.definition.fieldKey)?.type === 'choice') {
        selectionRegionsBySlot.set(slot.node, region);
      }
    }
  }
  card.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const slot = target?.closest<HTMLElement>(
      '.statblock-forge__inline-edit-slot[data-forge-inline-field]',
    );
    if (!slot) return;
    const fieldKey = slot.dataset.forgeInlineField;
    if (!fieldKey || fieldsByKey.get(fieldKey)?.type !== 'choice') return;
    const region = selectionRegionsBySlot.get(slot);
    if (!region) return;
    // Once the Atlas combobox is open, its input, chips, number editors and
    // remove buttons own their interactions. Do not interpret those clicks as
    // a request to reopen the block editor.
    if (target.closest('.atlas-sb-pane-editor, .statblock-forge__selection-atlas, input, textarea, select, button, [data-no-block-edit]')) return;
    if (active === region && region.sessions.has(fieldKey)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void schedule(() => openRegion(region, fieldKey));
  }, true);

  // Handle Collection custom-value actions at the card boundary in capture
  // phase. Listening on each block root is unreliable when Atlas inserts
  // nested block frames: an intermediate frame can own the event path even
  // though the button belongs to a different inline Field editor. Resolve the
  // actual slot first, then use the region that registered that exact slot.
  card.addEventListener('forge:edit-field', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const trigger = target?.closest<HTMLElement>('[data-forge-custom-field]');
    const fieldKey = trigger?.dataset.forgeCustomField;
    if (!trigger || !fieldKey) return;
    const sourceSlot = trigger.closest<HTMLElement>(
      '.statblock-forge__inline-edit-slot[data-forge-inline-field]',
    );
    if (!sourceSlot || sourceSlot.dataset.forgeInlineField !== fieldKey) return;
    // Match by the exact slot node registered during the first render. Do not
    // resolve ownership again through data-block-id: Atlas may add nested frame
    // markers between the slot and its Forge block after rendering.
    const region = regions.find((candidate) =>
      candidate.slots.some((slot) => slot.node === sourceSlot && slot.definition.fieldKey === fieldKey));
    if (!region) return;
    event.preventDefault();
    event.stopPropagation();
    void schedule(() => openRegion(region, fieldKey));
  }, true);

  const openNavigationTarget = async (target: InlineNavigationTarget, direction: 1 | -1): Promise<void> => {
    if (target.region) {
      await openRegion(target.region, target.fieldKey);
      focusSession(target.region, target.fieldKey);
      return;
    }
    if (target.tableFrame) {
      target.tableFrame.dispatchEvent(new CustomEvent('forge:focus-table', { detail: { direction } }));
      return;
    }
    const root = target.entryRoot;
    if (!root) return;
    const rows = Array.from(root.querySelectorAll<HTMLElement>('.statblock-forge__preview-entry-list > .statblock-forge__preview-entry'));
    const row = direction > 0 ? rows[0] : rows[rows.length - 1];
    const clickTarget = direction > 0
      ? row?.querySelector<HTMLElement>('[data-entry-part="name"]') ?? row
      : row?.querySelector<HTMLElement>('[data-entry-part="text"]') ?? row;
    if (clickTarget) clickTarget.click();
    else root.querySelector<HTMLButtonElement>('.statblock-forge__entry-add-trigger')?.click();
  };

  const onEntryBoundaryTab = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab' || !(event.target instanceof HTMLElement)) return;
    const target = event.target;
    const forwardBoundary = target.dataset.entryPart === 'text' && !event.shiftKey;
    const backwardBoundary = target.dataset.entryPart === 'name' && event.shiftKey;
    if (!forwardBoundary && !backwardBoundary) return;
    const direction: 1 | -1 = event.shiftKey ? -1 : 1;
    const editor = target.closest<HTMLElement>('.atlas-sb-pane-entry-editor');
    const entryRoot = target.closest<HTMLElement>('.statblock-forge__preview-entries[data-forge-entry-field]');
    const fieldKey = entryRoot?.dataset.forgeEntryField;
    if (!editor || !entryRoot || !fieldKey) return;
    event.preventDefault();
    event.stopPropagation();
    void schedule(async () => {
      const session = inlineEntryEditorSessions.get(editor);
      if (session && !(await session.commit())) { target.focus(); return; }
      if (!(await closeActive(true))) return;
      const currentIndex = navigation.findIndex((entry) => entry.fieldKey === fieldKey);
      const next = navigation[currentIndex + direction];
      if (next) await openNavigationTarget(next, direction);
      else entryRoot.focus();
    });
  };
  card.addEventListener('keydown', onEntryBoundaryTab, true);

  const ownInteractions = 'a, button, input, textarea, select, [role="switch"], [data-no-block-edit], .statblock-forge__selection-editor, .statblock-forge__selection-atlas, .atlas-dice-link, .statblock-forge__dice-link, .internal-link';
  for (const region of regions) {
    region.root.addEventListener('forge:finish-field', (event) => {
      const detail = (event as CustomEvent<{ fieldKey?: unknown }>).detail;
      const fieldKey = detail?.fieldKey;
      if (typeof fieldKey !== 'string'
        || !region.slots.some((slot) => slot.definition.fieldKey === fieldKey)) return;
      event.preventDefault();
      event.stopPropagation();
      void schedule(async () => {
        if (active !== region) return;
        if (await closeActive(true)) region.root.focus();
      });
    });

    // Markdown values can sit inside Atlas/Obsidian click surfaces that
    // compete with the delegated block handler. Activate those editors at the
    // slot itself. Selection is handled by the shared card-level capture route
    // above so every block type follows one ownership and activation path.
    for (const { node, definition } of region.slots) {
      const slotFieldType = fieldsByKey.get(definition.fieldKey)?.type;
      if (slotFieldType !== 'markdown') continue;
      node.addEventListener('click', (event) => {
        if (region.root.classList.contains('atlas-sb-pane-editing')) return;
        const target = event.target instanceof Element ? event.target : null;
        if (!target || target.closest('a, button, input, textarea, select, [data-no-block-edit]')) return;
        event.preventDefault();
        event.stopPropagation();
        void schedule(() => openRegion(region, definition.fieldKey));
      }, true);
    }

    region.root.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      // Nested Atlas block frames own their clicks. Letting the event bubble
      // into a parent frame would activate two edit regions at once.
      if (target?.closest('[data-block-id]') !== region.root) return;
      // A visible Field name is an explicit edit shortcut. Check it before
      // generic link/button exclusions so a roll-linked value can still be
      // edited by clicking the associated name.
      const namedField = target?.closest<HTMLElement>('[data-forge-edit-field]');
      const isEditorControl = Boolean(target?.closest('.atlas-sb-pane-editor, input, textarea, select, button, [data-no-block-edit]'));
      if (namedField && !isEditorControl && namedField.closest('[data-block-id]') === region.root) {
        const fieldKey = namedField.dataset.forgeEditField;
        if (fieldKey) {
          event.preventDefault();
          event.stopPropagation();
          void schedule(() => openRegion(region, fieldKey));
          return;
        }
      }
      if (target?.closest(ownInteractions)) return;
      const slot = target?.closest<HTMLElement>('[data-forge-inline-field]');
      const fieldKey = slot?.dataset.forgeInlineField;
      void schedule(() => openRegion(region, fieldKey));
    });
    region.root.addEventListener('keydown', (event) => {
      if (!(event.target instanceof Element)) return;
      const namedField = event.target.closest<HTMLElement>('[data-forge-edit-field]');
      const isEditorControl = Boolean(event.target.closest('.atlas-sb-pane-editor, input, textarea, select, button, [data-no-block-edit]'));
      if (namedField && !isEditorControl && namedField.closest('[data-block-id]') === region.root
        && (event.key === 'Enter' || event.key === ' ')) {
        const fieldKey = namedField.dataset.forgeEditField;
        if (!fieldKey) return;
        event.preventDefault();
        event.stopPropagation();
        void schedule(() => openRegion(region, fieldKey));
        return;
      }
      if (event.target !== region.root || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      void schedule(() => openRegion(region));
    });
    region.root.addEventListener('focusout', (event) => {
      const next = event.relatedTarget as Node | null;
      if (next && region.root.contains(next)) return;
      void Promise.resolve().then(() => {
        if (active !== region || region.root.contains(document.activeElement)) return;
        void schedule(async () => { await closeActive(true); });
      });
    });
  }

  // A Scores table owns cell clicks itself. The enclosing BlockFrame remains
  // the keyboard-accessible Atlas pane target, and activates the first/last
  // cell when reached from another Field.
  for (const tableFrame of tableFrames) {
    const root = tableFrame.closest<HTMLElement>('.atlas-sb-item[data-block-id]');
    if (!root) continue;
    root.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('.atlas-sb-item[data-block-id]') !== root) return;
      if (target?.closest('[data-table-live], button, input, textarea, select, a, [data-no-block-edit]')) return;
      tableFrame.dispatchEvent(new CustomEvent('forge:focus-table', { detail: { direction: 1 } }));
    });
    root.addEventListener('keydown', (event) => {
      if (event.target !== root || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      tableFrame.dispatchEvent(new CustomEvent('forge:focus-table', { detail: { direction: 1 } }));
    });
  }

  numericRuntimeForCard.setNavigationHandler(async (fieldKey, step) => {
    await schedule(async () => {
      if (active && !(await closeActive(true))) return;
      const currentIndex = navigation.findIndex((entry) => entry.fieldKey === fieldKey);
      const next = navigation[currentIndex + step];
      if (next) {
        await openNavigationTarget(next, step);
        return;
      }
      const current = navigation[currentIndex];
      const root = current?.region?.root
        ?? current?.entryRoot?.closest<HTMLElement>('.atlas-sb-item[data-block-id]')
        ?? current?.tableFrame?.closest<HTMLElement>('.atlas-sb-item[data-block-id]');
      root?.focus({ preventScroll: true });
    });
  });

  if (focusFirstEmpty && navigation.length > 0) {
    // `navigation` is already in template Field order; Atlas uses this exact
    // order for the first-empty request, while each Field points to its first
    // rendered occurrence in the card.
    const target = navigation.find((entry) => isAtlasEmptyFieldValue(data[entry.fieldKey])) ?? navigation[0];
    if (target) {
      // The render surface inserts the card immediately after renderStatblock returns.
      // Waiting one frame ensures the selected input is connected before focus is requested.
      const view = card.ownerDocument.defaultView;
      if (view?.requestAnimationFrame) {
        view.requestAnimationFrame(() => { void schedule(() => openNavigationTarget(target, 1)); });
      } else {
        void schedule(() => openNavigationTarget(target, 1));
      }
    }
  }
}

function numericFieldDisplayText(
  field: ForgeField,
  sample: JsonRecord,
  runtime: NumericFieldRuntime | undefined,
  signed = false,
): string {
  const raw = sample[field.key];
  // A Number can explicitly hold a dice roll ending in adv/dis. Do not pass
  // that text through numeric formatting or display it as an unavailable value.
  if (field.type === 'number' && !hasNumericFieldFormulaSettings(field)
    && numberFieldAdvantageRollFormula(raw)) return String(raw).trim();
  // Plain Rating fields keep their original notation (e.g. 1/4). Once a formula
  // is configured, the displayed value is the evaluated numeric result.
  const numeric = field.type === 'rating' && !hasNumericFieldFormulaSettings(field)
    ? null
    : runtime ? runtime.value(field, sample) : numberValue(raw);
  if (field.type === 'rating' && !hasNumericFieldFormulaSettings(field)) return withUnit(raw, field);
  const shown = numeric === null ? '—' : `${signed && numeric > 0 ? '+' : ''}${String(Number(numeric.toFixed(4)))}`;
  return withUnit(shown, field);
}

function createInlineNumericFieldValue(
  field: ForgeField,
  sample: JsonRecord,
  runtime: NumericFieldRuntime | undefined,
  displayText: () => string,
  extraClass = '',
  options: { displayElement?: HTMLElement; preserveDisplayFormatting?: boolean; slotClass?: string } = {},
): HTMLElement {
  const value = options.displayElement
    ?? element('span', `statblock-forge__preview-numeric-field-value${extraClass ? ` ${extraClass}` : ''}`);
  const slot = createInlineEditSlot('span', options.slotClass ?? '', value);
  const redraw = (): void => {
    if (options.displayElement) return;
    const display = displayText();
    const rollFormula = field.type === 'number' && !hasNumericFieldFormulaSettings(field)
      ? numberFieldAdvantageRollFormula(sample[field.key])
      : null;
    value.textContent = display;
    setForgeStatblockDiceLink(value, rollFormula);
    if (rollFormula) value.dataset.rollName = field.label.trim() || field.key;
    else delete value.dataset.rollName;
  };
  redraw();

  if (runtime?.canEdit) {
    registerInlineSlotEditor(slot.slot, field.key, () => {
      if (!value.isConnected || runtime.isSaving) return null;
      const input = element('input', 'atlas-sb-pane-input statblock-forge__inline-numeric-editor');
      input.type = 'text';
      // Number Values may contain a valid dice expression ending in adv/dis.
      // A decimal mobile keyboard hides those letters, so request a text keyboard.
      input.inputMode = 'text';
      input.spellcheck = false;
      input.autocomplete = 'off';
      input.value = inlineNumericFieldDraftValue(sample[field.key]);
      input.setAttribute('aria-label', field.label || field.key);
      const layer = element('span', 'atlas-sb-pane-editor atlas-sb-value');
      layer.append(input);
      const error = element('span', 'statblock-forge__inline-field-editor-error');
      error.hidden = true;
      layer.append(error);
      slot.open(layer, value);

      let inFlight: Promise<boolean> | null = null;
      const commit = (): Promise<boolean> => {
        if (inFlight) return inFlight;
        let nextValue: unknown;
        try {
          nextValue = parseInlineNumericFieldDraft(field, input.value, runtime.language);
        } catch (caught) {
          error.textContent = caught instanceof Error ? caught.message : String(caught);
          error.hidden = false;
          input.setAttribute('aria-invalid', 'true');
          return Promise.resolve(false);
        }
        error.hidden = true;
        input.removeAttribute('aria-invalid');
        inFlight = runtime.setBaseValue(field.key, nextValue).then(() => true).catch((caught: unknown) => {
          error.textContent = caught instanceof Error ? caught.message : String(caught);
          error.hidden = false;
          input.setAttribute('aria-invalid', 'true');
          return false;
        }).finally(() => { inFlight = null; });
        return inFlight;
      };
      return {
        fieldKey: field.key,
        control: input,
        commit,
        close: () => {
          slot.close(layer, value);
          redraw();
        },
      };
    }, options.preserveDisplayFormatting === false ? undefined : value);
  }

  if (!options.displayElement) {
    runtime?.subscribe(field.key, redraw);
    runtime?.subscribeAll(redraw);
  }
  return slot.slot;
}

// Module-scoped counter keeps Atlas-style Selection editor IDs unique across
// every rendered statblock, Table cell, Metric, and template preview.
let nextSelectionEditorId = 0;

interface SelectionEditorDom {
  root: HTMLElement;
  control: HTMLInputElement;
  read(): { value: string; error: string | null; invalidControl?: HTMLInputElement };
  setValue(rawValue: unknown): void;
  destroy(): void;
}

/** Every configured Selection uses the Atlas combobox/chip interaction. */
function usesAtlasSelectionEditor(field: ForgeField): boolean {
  return field.type === 'choice'
    && ((Array.isArray(field.options) && field.options.length > 0) || field.open === true);
}

/** The value shown for a Selection, using Atlas' native comma-separated shape. */
function selectionFieldValueText(field: ForgeField, rawValue: unknown): string {
  const read = readSelectionField(field, rawValue);
  const configured = serializeSelectionFieldPicks(field, read.picks);
  return [configured, ...read.unread].filter((part) => part.trim() !== '').join(', ');
}

interface SelectionMenuOption {
  value: string;
  label: string;
  custom: boolean;
}

/**
 * Atlas-style Selection editor: a combobox with a floating option list, and
 * chips (with per-pick numbers) for multi/numbered choices. This intentionally
 * mirrors Atlas' ChoiceValueInput/ChoicePicksInput interaction instead of
 * presenting a separate checkbox grid in Forge.
 */
function createSelectionEditorDom(
  field: ForgeField,
  rawValue: unknown,
  language: ForgeLanguage,
  onChange?: (value: string) => void | Promise<void>,
): SelectionEditorDom {
  const pt = language === 'pt-BR';
  const options = Array.isArray(field.options)
    ? field.options.filter((option): option is string => typeof option === 'string' && option.trim().length > 0)
    : [];
  const initial = readSelectionField(field, rawValue);
  let picks: SelectionFieldPick[] = initial.picks.map((pick) => ({ ...pick }));
  let unread = [...initial.unread];
  const multiple = field.several === true;
  const numbered = field.numbered === true;
  const allowOther = field.open === true;
  const usesChips = multiple || numbered;
  const valueFromPicks = (): string => {
    const configured = serializeSelectionFieldPicks(field, picks);
    const extras = multiple ? unread : unread.slice(0, 1);
    return [configured, ...extras].filter((part) => part.trim() !== '').join(', ');
  };
  const notifyChange = (): void => {
    if (!onChange) return;
    try {
      const result = onChange(valueFromPicks());
      if (result && typeof (result as Promise<void>).catch === 'function') {
        void (result as Promise<void>).catch((error) => console.error('[Statblock Forge] Could not save Selection:', error));
      }
    } catch (error) {
      console.error('[Statblock Forge] Could not save Selection:', error);
    }
  };
  const ownerDocument = document;
  const view = ownerDocument.defaultView;
  const editorId = `forge-choice-${++nextSelectionEditorId}`;

  const root = element('span', `atlas-sb-pane-field atlas-sb-pane-choice statblock-forge__selection-atlas${usesChips ? ' atlas-sb-pane-chips' : ''}`);
  root.dataset.selectionEditor = 'true';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', field.label || field.key);
  const chips = usesChips ? element('span', 'atlas-sb-pane-selection-chips') : null;
  const add = usesChips ? element('span', 'atlas-sb-pane-pick__add') : null;
  const input = element('input', `atlas-sb-pane-input${usesChips ? ' atlas-sb-pane-chips__input' : ''}`);
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-label', field.label || field.key);
  input.setAttribute('aria-expanded', 'false');
  input.placeholder = usesChips
    ? (pt ? 'Adicionar…' : 'Add…')
    : (field.label || field.key);
  const chevron = element('span', 'atlas-sb-pane-choice__chevron', '▾');
  chevron.setAttribute('aria-hidden', 'true');
  if (chips) root.append(chips);
  if (add) {
    add.append(input, chevron);
    root.append(add);
  } else root.append(input, chevron);

  // Atlas portals ChoiceOptionList into its document-scoped host and marks
  // the menu with the surface that opened it. This is not cosmetic: Atlas'
  // panel focus scope uses data-atlas-owner to keep a menu interaction inside
  // the originating surface instead of treating the option press as a blur.
  const portalHost = (): HTMLElement => {
    const existing = ownerDocument.body.querySelector<HTMLElement>(':scope > .atlas-portal-host');
    if (existing) return existing;
    const created = element('div', 'atlas-portal-host');
    ownerDocument.body.append(created);
    return created;
  };
  const popup = element('div', 'atlas-vtt-plugin atlas-sb-pane-options');
  popup.setAttribute('role', 'listbox');
  popup.setAttribute('aria-label', field.label || field.key);
  popup.id = `${editorId}-options`;
  popup.hidden = true;
  input.setAttribute('aria-controls', popup.id);
  let opened = false;
  let typed = '';
  let activeOption = -1;
  let shownOptions: SelectionMenuOption[] = [];
  let optionNodes: HTMLElement[] = [];
  let destroyed = false;

  const makeOptionList = (): SelectionMenuOption[] => {
    const query = typed.trim().toLocaleLowerCase();
    const taken = new Set(picks.map((pick) => pick.option.toLocaleLowerCase()));
    const available = options.filter((option) => (!multiple || !taken.has(option.toLocaleLowerCase()))
      && option.toLocaleLowerCase().includes(query));
    const result: SelectionMenuOption[] = available.map((value) => ({ value, label: value, custom: false }));
    const trimmed = typed.trim();
    const exact = options.some((option) => option.toLocaleLowerCase() === trimmed.toLocaleLowerCase());
    if (allowOther && trimmed && !exact) {
      result.push({
        value: trimmed,
        label: pt ? `Usar “${trimmed}”` : `Use “${trimmed}”`,
        custom: true,
      });
    }
    return result;
  };

  const updateInputValue = (): void => {
    if (usesChips) {
      input.value = typed;
      input.placeholder = picks.length + unread.length === 0
        ? (pt ? 'Adicionar…' : 'Add…')
        : '';
    } else if (ownerDocument.activeElement !== input || typed === '') {
      input.value = picks[0]?.option ?? unread[0] ?? '';
    }
    input.setAttribute('aria-expanded', String(opened));
  };

  const updateChips = (): void => {
    if (!chips) return;
    chips.replaceChildren();
    picks.forEach((pick, index) => {
      const chip = element('span', `atlas-sb-pane-chip atlas-sb-pane-pick${pick.custom ? ' atlas-sb-pane-pick--custom' : ''}`);
      chip.append(element('span', 'atlas-sb-pane-chip__text', pick.option));
      if (numbered) {
        const amount = element('input', 'atlas-sb-pane-input atlas-sb-pane-pick__number');
        amount.type = 'text';
        amount.inputMode = 'decimal';
        amount.value = typeof pick.number === 'number' && Number.isFinite(pick.number) ? String(pick.number) : '';
        amount.placeholder = '#';
        amount.setAttribute('aria-label', pt ? `Número para ${pick.option}` : `Number for ${pick.option}`);
        const written = amount.value;
        const commitNumber = (): void => {
          const text = amount.value.trim();
          if (!text) {
            picks[index] = {
              option: pick.option,
              ...(pick.custom ? { custom: true } : {}),
              unit: pick.unit ?? (typeof field.unit === 'string' ? field.unit.trim() : ''),
            };
          } else {
            const parsed = Number(text.replace(/[−–]/g, '-'));
            if (!Number.isFinite(parsed)) {
              amount.value = written;
              return;
            }
            picks[index] = {
              option: pick.option,
              ...(pick.custom ? { custom: true } : {}),
              number: parsed,
              unit: pick.unit ?? (typeof field.unit === 'string' ? field.unit.trim() : ''),
            };
          }
          notifyChange();
        };
        amount.addEventListener('blur', commitNumber);
        amount.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commitNumber();
            input.focus();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            amount.value = written;
            input.focus();
          }
        });
        chip.append(amount);
        const unit = typeof pick.unit === 'string' ? pick.unit.trim() : (typeof field.unit === 'string' ? field.unit.trim() : '');
        if (unit) chip.append(element('span', 'atlas-sb-pane-pick__unit', unit));
      }
      const remove = element('button', 'atlas-sb-pane-chip__remove', '×');
      remove.type = 'button';
      remove.setAttribute('aria-label', pt ? `Remover ${pick.option}` : `Remove ${pick.option}`);
      remove.addEventListener('mousedown', (event) => event.preventDefault());
      remove.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        picks = picks.filter((_entry, at) => at !== index);
        updateChips();
        updateInputValue();
        notifyChange();
        input.focus();
      });
      chip.append(remove);
      chips.append(chip);
    });
    unread.forEach((part, index) => {
      const chip = element('span', 'atlas-sb-pane-chip atlas-sb-pane-pick--unread');
      chip.append(element('span', 'atlas-sb-pane-chip__text', part));
      const remove = element('button', 'atlas-sb-pane-chip__remove', '×');
      remove.type = 'button';
      remove.setAttribute('aria-label', pt ? `Remover ${part}` : `Remove ${part}`);
      remove.addEventListener('mousedown', (event) => event.preventDefault());
      remove.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        unread = unread.filter((_entry, at) => at !== index);
        updateChips();
        updateInputValue();
        notifyChange();
        input.focus();
      });
      chip.append(remove);
      chips.append(chip);
    });
  };

  const positionPopup = (): void => {
    if (!opened || !root.isConnected) return;
    const rect = root.getBoundingClientRect();
    const viewportWidth = ownerDocument.documentElement.clientWidth || view?.innerWidth || rect.right;
    const viewportHeight = ownerDocument.documentElement.clientHeight || view?.innerHeight || rect.bottom;
    const width = Math.min(Math.max(rect.width, 160), Math.max(120, viewportWidth - 16));
    const left = Math.max(8, Math.min(rect.left, viewportWidth - width - 8));
    const below = Math.max(0, viewportHeight - rect.bottom - 8);
    const above = Math.max(0, rect.top - 8);
    const preferred = Math.min(300, Math.max(36, shownOptions.length * 34));
    const openAbove = below < Math.min(preferred, 140) && above > below;
    const available = openAbove ? above : below;
    const height = Math.max(36, Math.min(preferred, available || preferred));
    popup.setCssStyles({ position: 'fixed' });
    popup.setCssStyles({ left: `${left}px` });
    popup.setCssStyles({ width: `${width}px` });
    popup.setCssStyles({ maxHeight: `${height}px` });
    popup.setCssStyles({ top: openAbove
      ? `${Math.max(8, rect.top - height - 4)}px`
      : `${Math.min(viewportHeight - height - 8, rect.bottom + 4)}px` });
  };

  const updateActive = (): void => {
    optionNodes.forEach((option, index) => {
      const active = index === activeOption;
      option.classList.toggle('is-active', active);
      option.setAttribute('aria-selected', String(active));
    });
    const activeNode = optionNodes[activeOption];
    if (activeNode) {
      input.setAttribute('aria-activedescendant', activeNode.id);
      activeNode.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  };

  const closePopup = (): void => {
    if (!opened) return;
    opened = false;
    popup.hidden = true;
    popup.remove();
    activeOption = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    view?.removeEventListener('scroll', positionPopup, true);
    view?.removeEventListener('resize', positionPopup);
  };

  const refreshPopup = (openIfNeeded = true): void => {
    shownOptions = makeOptionList();
    if (!openIfNeeded || shownOptions.length === 0) {
      closePopup();
      return;
    }
    activeOption = -1;
    optionNodes = shownOptions.map((option, index) => {
      const node = element('div', 'atlas-sb-pane-option', option.label);
      node.id = `${editorId}-option-${index}`;
      node.setAttribute('role', 'option');
      node.setAttribute('aria-selected', 'false');
      node.addEventListener('mouseenter', () => {
        activeOption = index;
        updateActive();
      });
      node.addEventListener('mousedown', (event) => event.preventDefault());
      node.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (option.custom) {
          const customPick: SelectionFieldPick = {
            option: option.value,
            custom: true,
            ...(numbered ? { unit: typeof field.unit === 'string' ? field.unit.trim() : '' } : {}),
          };
          if (multiple) {
            if (!picks.some((pick) => pick.option.toLocaleLowerCase() === option.value.toLocaleLowerCase())
              && !unread.some((part) => part.toLocaleLowerCase() === option.value.toLocaleLowerCase())) {
              picks = [...picks, customPick];
            }
          } else {
            picks = [customPick];
            unread = [];
          }
        } else if (multiple) {
          if (!picks.some((pick) => pick.option.toLocaleLowerCase() === option.value.toLocaleLowerCase())) {
            picks = [...picks, {
              option: option.value,
              ...(numbered ? { unit: typeof field.unit === 'string' ? field.unit.trim() : '' } : {}),
            }];
          }
        } else {
          const previousNumber = numbered ? picks[0]?.number : undefined;
          picks = [{
            option: option.value,
            ...(numbered ? {
              ...(typeof previousNumber === 'number' ? { number: previousNumber } : {}),
              unit: typeof field.unit === 'string' ? field.unit.trim() : '',
            } : {}),
          }];
          unread = [];
        }
        typed = '';
        closePopup();
        updateChips();
        updateInputValue();
        notifyChange();
        input.focus();
      });
      return node;
    });
    popup.replaceChildren(...optionNodes);
    popup.hidden = false;
    const surface = root.closest<HTMLElement>('[data-atlas-surface]')?.getAttribute('data-atlas-surface');
    if (surface !== null && surface !== undefined) popup.setAttribute('data-atlas-owner', surface);
    else popup.removeAttribute('data-atlas-owner');
    // Reuse Atlas' own portal host so its surface scope and stacking order
    // recognize this menu exactly like ChoiceValueInput/ChoicePicksInput.
    portalHost().append(popup);
    opened = true;
    input.setAttribute('aria-expanded', 'true');
    positionPopup();
    view?.removeEventListener('scroll', positionPopup, true);
    view?.removeEventListener('resize', positionPopup);
    view?.addEventListener('scroll', positionPopup, true);
    view?.addEventListener('resize', positionPopup);
  };

  const removeLastPick = (): void => {
    if (unread.length > 0) unread = unread.slice(0, -1);
    else if (picks.length > 0) picks = picks.slice(0, -1);
    updateChips();
    updateInputValue();
  };

  const onInput = (): void => {
    typed = input.value;
    refreshPopup(true);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      if (!opened) {
        refreshPopup(true);
        activeOption = shownOptions.length === 0 ? -1 : (event.key === 'ArrowDown' ? 0 : shownOptions.length - 1);
      } else {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        activeOption = Math.max(0, Math.min(shownOptions.length - 1,
          activeOption < 0 ? (step > 0 ? 0 : shownOptions.length - 1) : activeOption + step));
      }
      updateActive();
      return;
    }
    if (event.key === 'Escape' && opened) {
      event.preventDefault();
      event.stopPropagation();
      typed = '';
      closePopup();
      updateInputValue();
      return;
    }
    if (event.key === 'Enter' && opened && shownOptions[activeOption]) {
      event.preventDefault();
      event.stopPropagation();
      optionNodes[activeOption]?.click();
      return;
    }
    if (usesChips && event.key === 'Backspace' && input.value === '' && picks.length + unread.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      removeLastPick();
    }
  };
  const onFocus = (): void => {
    typed = '';
    if (usesChips) input.value = '';
    refreshPopup(true);
    updateInputValue();
  };
  // Atlas opens its option list on mouse-down as well as focus. Focus alone is
  // insufficient when a user picks an option and then clicks the same input
  // again: the input never blurred, so a second click would otherwise do nothing.
  const onInputMouseDown = (event: MouseEvent): void => {
    if (event.button === 0 && !opened) refreshPopup(true);
  };
  const onInputClick = (): void => {
    if (!opened) refreshPopup(true);
  };
  const onBlur = (): void => {
    closePopup();
    typed = '';
    updateInputValue();
  };
  const onRootMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest('input, button'))) return;
    event.preventDefault();
    input.focus();
    if (!opened) refreshPopup(true);
  };

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKeyDown);
  input.addEventListener('focus', onFocus);
  input.addEventListener('mousedown', onInputMouseDown);
  input.addEventListener('click', onInputClick);
  input.addEventListener('blur', onBlur);
  root.addEventListener('mousedown', onRootMouseDown);
  popup.addEventListener('mousedown', (event) => event.preventDefault());

  updateChips();
  if (usesChips) {
    input.value = '';
    input.placeholder = picks.length + unread.length === 0 ? (pt ? 'Adicionar…' : 'Add…') : '';
  } else {
    input.value = picks[0]?.option ?? unread[0] ?? '';
  }

  return {
    root,
    control: input,
    read() {
      return { value: valueFromPicks(), error: null };
    },
    setValue(nextRawValue: unknown) {
      const next = readSelectionField(field, nextRawValue);
      const nextPicks = next.picks.map((pick) => ({ ...pick }));
      const nextUnread = [...next.unread];
      const nextValue = [serializeSelectionFieldPicks(field, nextPicks), ...nextUnread].filter((part) => part.trim() !== '').join(', ');
      if (nextValue === valueFromPicks()) return;
      picks = nextPicks;
      unread = nextUnread;
      typed = '';
      closePopup();
      updateChips();
      updateInputValue();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      closePopup();
      input.removeEventListener('input', onInput);
      input.removeEventListener('keydown', onKeyDown);
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('mousedown', onInputMouseDown);
      input.removeEventListener('click', onInputClick);
      input.removeEventListener('blur', onBlur);
      root.removeEventListener('mousedown', onRootMouseDown);
    },
  };
}

function createInlineTextFieldValue(
  app: App,
  markdownComponent: Component,
  sourcePath: string,
  field: ForgeField,
  sample: JsonRecord,
  runtime: NumericFieldRuntime | undefined,
  extraClass = '',
): HTMLElement {
  const tag = field.type === 'markdown' ? 'div' : 'span';
  const display = element(tag, 'statblock-forge__preview-inline-text-value');
  const slot = createInlineEditSlot(tag, `statblock-forge__preview-inline-text-field${field.type === 'markdown' ? ' is-markdown' : ''}${extraClass ? ` ${extraClass}` : ''}`, display, field.type === 'markdown');
  const formulaBackedDice = field.type === 'dice' && hasDiceFieldFormula(field);
  const redraw = (): void => {
    display.replaceChildren();
    const raw = sample[field.key];
    const text = field.type === 'choice'
      ? selectionFieldValueText(field, raw)
      : inlineTextFieldDraftValue(raw);
    if (formulaBackedDice) {
      const formula = runtime?.diceFormula(field, sample) ?? '';
      display.classList.toggle('is-unresolved-dice-formula', !formula);
      if (formula) {
        display.removeAttribute('title');
        appendForgeStatblockDiceText(display, formula);
      } else {
        display.textContent = '—';
        display.title = runtime?.language === 'pt-BR'
          ? 'Não foi possível resolver a fórmula. Verifique os Fields referenciados e suas opções de Checkboxes/Selection.'
          : 'Could not resolve this formula. Check its referenced Fields and their Checkboxes/Selection options.';
      }
    } else if (field.type === 'markdown' && text) renderAtlasMarkdown(app, markdownComponent, sourcePath, display, text);
    else if (field.type === 'dice') appendForgeStatblockDiceText(display, text || '—');
    else display.textContent = text || '—';
  };
  redraw();

  // Selection is already a discrete Atlas combobox/chip control. Render that
  // control directly in every editable surface instead of placing it behind
  // the block-level inline editor activation. The old two-step activation
  // depended on parent click delegation and was intermittently swallowed by
  // Atlas/Obsidian event scopes, leaving every Selection looking clickable but
  // doing nothing when pressed.
  if (field.type === 'choice' && runtime?.canEdit && usesAtlasSelectionEditor(field)) {
    let pendingSave: Promise<void> = Promise.resolve();
    const saveSelection = (nextValue: string): Promise<void> => {
      const save = pendingSave.catch(() => undefined).then(() => runtime.setBaseValue(field.key, nextValue));
      pendingSave = save.then(() => undefined, () => undefined);
      return save;
    };
    const selection = createSelectionEditorDom(
      field,
      sample[field.key],
      runtime.language,
      saveSelection,
    );
    selection.root.classList.add('is-live-inline');
    selection.root.dataset.forgeSelectionField = field.key;
    runtime.subscribe(field.key, () => selection.setValue(sample[field.key]));
    return selection.root;
  }

  // A configured Dice Formula is derived from other Values, so users edit its
  // source Number/Rating Fields rather than overwriting the computed formula.
  if (runtime?.canEdit && !formulaBackedDice) {
    registerInlineSlotEditor(slot.slot, field.key, () => {
      if (!display.isConnected || runtime.isSaving) return null;
      const previous = inlineTextFieldDraftValue(sample[field.key]);
      const configuredOptions = field.type === 'choice' && Array.isArray(field.options)
        ? field.options.filter((option): option is string => typeof option === 'string')
        : [];
      let control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      let eventRoot: HTMLElement | undefined;
      let selectionEditor: SelectionEditorDom | undefined;
      if (usesAtlasSelectionEditor(field)) {
        selectionEditor = createSelectionEditorDom(field, sample[field.key], runtime.language);
        control = selectionEditor.control;
        eventRoot = selectionEditor.root;
      } else if (field.type === 'markdown') {
        const textarea = element('textarea', 'atlas-sb-pane-input atlas-sb-pane-textarea statblock-forge__inline-field-editor is-markdown');
        textarea.rows = 2;
        textarea.wrap = 'soft';
        textarea.spellcheck = true;
        textarea.readOnly = false;
        textarea.disabled = false;
        textarea.value = previous;
        control = textarea;
      } else if (field.type === 'choice' && configuredOptions.length > 0) {
        const select = element('select', 'atlas-sb-pane-input statblock-forge__inline-field-editor is-choice');
        const placeholder = element('option');
        placeholder.value = '';
        placeholder.textContent = runtime.language === 'pt-BR' ? '— Selecione —' : '— Select —';
        select.append(placeholder);
        if (previous && !configuredOptions.includes(previous)) {
          const legacy = element('option');
          legacy.value = previous;
          legacy.textContent = runtime.language === 'pt-BR' ? `${previous} (valor atual)` : `${previous} (current value)`;
          select.append(legacy);
        }
        for (const optionValue of configuredOptions) {
          const option = element('option');
          option.value = optionValue;
          option.textContent = optionValue;
          select.append(option);
        }
        select.value = previous;
        control = select;
      } else {
        const input = element('input', `atlas-sb-pane-input statblock-forge__inline-field-editor${field.type === 'dice' ? ' is-dice' : ''}`);
        input.type = 'text';
        input.value = previous;
        input.autocomplete = 'off';
        if (field.type === 'dice') input.spellcheck = false;
        control = input;
      }
      if (!selectionEditor) control.setAttribute('aria-label', field.label || field.key);
      const layer = element(tag, 'atlas-sb-pane-editor atlas-sb-value');
      let updateDiceFeedback: (() => void) | null = null;
      if (field.type === 'dice' && control instanceof HTMLInputElement) {
        const fieldWrap = element('span', 'atlas-sb-pane-field statblock-forge__dice-field-editor');
        const hint = element('span', 'atlas-sb-pane-hint statblock-forge__dice-average-hint');
        const warning = element('span', 'atlas-sb-pane-warning statblock-forge__dice-warning');
        warning.setAttribute('role', 'img');
        warning.setAttribute('aria-label', runtime.language === 'pt-BR' ? 'Notação de dados inválida' : 'Invalid dice notation');
        fieldWrap.append(control, hint, warning);
        updateDiceFeedback = () => {
          const average = diceAverageHint(control.value);
          hint.textContent = average ?? '';
          hint.hidden = average === null;
          const invalid = control.value.trim() !== '' && !isDiceFieldValue(control.value);
          control.classList.toggle('has-problem', invalid);
          control.setAttribute('aria-invalid', invalid ? 'true' : 'false');
          warning.hidden = !invalid;
        };
        control.addEventListener('input', updateDiceFeedback);
        updateDiceFeedback();
        layer.append(fieldWrap);
      } else if (selectionEditor) {
        layer.append(selectionEditor.root);
      } else {
        layer.append(control);
      }
      const error = element('span', 'statblock-forge__inline-field-editor-error');
      error.hidden = true;
      layer.append(error);
      slot.open(layer, display);

      let inFlight: Promise<boolean> | null = null;
      const commit = (): Promise<boolean> => {
        if (inFlight) return inFlight;
        let nextValue: string;
        try {
          if (selectionEditor) {
            const result = selectionEditor.read();
            if (result.error) {
              error.textContent = result.error;
              error.hidden = false;
              result.invalidControl?.setAttribute('aria-invalid', 'true');
              result.invalidControl?.focus();
              return Promise.resolve(false);
            }
            nextValue = result.value;
          } else {
            nextValue = parseInlineTextFieldDraft(field, control.value, sample[field.key], runtime.language);
          }
        } catch (caught) {
          error.textContent = caught instanceof Error ? caught.message : String(caught);
          error.hidden = false;
          control.setAttribute('aria-invalid', 'true');
          return Promise.resolve(false);
        }
        error.hidden = true;
        control.removeAttribute('aria-invalid');
        inFlight = runtime.setBaseValue(field.key, nextValue).then(() => true).catch((caught: unknown) => {
          error.textContent = caught instanceof Error ? caught.message : String(caught);
          error.hidden = false;
          control.setAttribute('aria-invalid', 'true');
          return false;
        }).finally(() => { inFlight = null; });
        return inFlight;
      };
      return {
        fieldKey: field.key,
        control,
        ...(eventRoot ? { eventRoot } : {}),
        commit,
        close: () => {
          selectionEditor?.destroy();
          slot.close(layer, display);
          redraw();
        },
      };
    }, display);
  }
  if (formulaBackedDice) runtime?.subscribeAll(redraw);
  else runtime?.subscribe(field.key, redraw);
  return slot.slot;
}

function renderNumericFieldValue(
  field: ForgeField,
  sample: JsonRecord,
  runtime: NumericFieldRuntime | undefined,
  signed = false,
  extraClass = '',
): HTMLElement {
  const wrapper = element('span', `statblock-forge__preview-numeric-field${extraClass ? ` ${extraClass}` : ''}`);
  const value = createInlineNumericFieldValue(field, sample, runtime, () => numericFieldDisplayText(field, sample, runtime, signed));
  wrapper.append(value);
  return wrapper;
}

function fieldOf(fields: readonly ForgeField[], key: unknown): ForgeField | undefined {
  return typeof key === 'string' ? fields.find((field) => field.key === key) : undefined;
}

function fieldLabel(field: ForgeField | undefined, key: unknown): string {
  // An existing Field with an empty label is intentionally value-only. The
  // key is an editing/accessibility identifier, not a visible-label fallback.
  return field
    ? (typeof field.label === 'string' ? field.label.trim() : '')
    : (typeof key === 'string' ? key : '');
}

function fieldBlockLabel(
  explicitLabel: unknown,
  field: ForgeField | undefined,
  key: unknown,
  fallbackToFieldLabel = true,
  fallbackToKeyWhenFieldIsMissing = true,
): string {
  return resolveForgeBlockLabel(explicitLabel, field, key, fallbackToFieldLabel, fallbackToKeyWhenFieldIsMissing);
}

/** No Label is a block-level override that suppresses either a stored label or a heading-derived label. */
function isBlockLabelHidden(block: ForgeBlock): boolean {
  return block.labelPlacement === 'none' || block.label === '';
}

function visibleFieldBlockLabel(
  block: ForgeBlock,
  explicitLabel: unknown,
  field: ForgeField | undefined,
  key: unknown,
  fallbackToFieldLabel = true,
  fallbackToKeyWhenFieldIsMissing = true,
): string {
  return isBlockLabelHidden(block)
    ? ''
    : fieldBlockLabel(explicitLabel, field, key, fallbackToFieldLabel, fallbackToKeyWhenFieldIsMissing);
}

function withUnit(value: unknown, field: ForgeField | undefined): string {
  const text = readablePreviewValue(value);
  if (!text) return '—';
  const unit = typeof field?.unit === 'string' ? field.unit.trim() : '';
  return unit ? `${text} ${unit}` : text;
}

/**
 * Render Paragraphs with Obsidian's native Markdown engine, as Atlas does for
 * fields whose type is `markdown`. Render into an attached child container so
 * Obsidian Markdown post-processors and links receive a normal DOM lifecycle.
 */
const markdownRenderVersions = new WeakMap<HTMLElement, number>();

function renderAtlasMarkdown(
  app: App,
  component: Component,
  sourcePath: string,
  target: HTMLElement,
  value: string,
): void {
  const version = (markdownRenderVersions.get(target) ?? 0) + 1;
  markdownRenderVersions.set(target, version);

  // Atlas renders Paragraphs into a live Markdown container owned by its
  // parent Component. Keep each render in its own mounted child so a slow
  // earlier render cannot overwrite a newer value after an edit.
  const renderRoot = target.ownerDocument.createElement('div');
  renderRoot.className = 'markdown-rendered';
  target.replaceChildren(renderRoot);
  const renderFallback = (error?: unknown): void => {
    if (markdownRenderVersions.get(target) !== version) return;
    if (error) console.error('[Statblock Forge] Falha ao renderizar Markdown com o Obsidian:', error);
    renderRoot.replaceChildren();
    applyTextWithBasicMarkdown(renderRoot, value);
  };
  // Use the same Obsidian MarkdownRenderer API used by Atlas for Paragraphs.
  // It can populate a detached container; the completed card is attached by
  // the caller immediately after construction. Deferring to requestAnimationFrame
  // made preview rendering race with Canvas refreshes, occasionally leaving an
  // empty Markdown block when its original node was replaced before the frame.
  try {
    void MarkdownRenderer.render(app, value, renderRoot, sourcePath, component).catch(renderFallback);
  } catch (error) {
    renderFallback(error);
  }
}

function applyTextWithBasicMarkdown(target: HTMLElement, value: string): void {
  // Safe, intentionally small inline Markdown subset. Raw HTML is always text.
  const lines = value.split(/\r?\n/);
  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) target.append(document.createElement('br'));
    const tokenPattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;
    let cursor = 0;
    for (const match of line.matchAll(tokenPattern)) {
      const index = match.index ?? 0;
      if (index > cursor) target.append(document.createTextNode(line.slice(cursor, index)));
      const token = match[0];
      const content = token.slice(token.startsWith('**') || token.startsWith('__') ? 2 : 1, - (token.startsWith('**') || token.startsWith('__') ? 2 : 1));
      const wrapper = token.startsWith('**') || token.startsWith('__')
        ? element('strong', undefined, content)
        : token.startsWith('`') ? element('code', undefined, content) : element('em', undefined, content);
      target.append(wrapper);
      cursor = index + token.length;
    }
    if (cursor < line.length) target.append(document.createTextNode(line.slice(cursor)));
  });
}

function applyBlockAppearance(node: HTMLElement, block: ForgeBlock, layout: ForgeLayoutDocument): void {
  const metadata = layout.blocks[block.id] ?? { span: 12, rows: 1, appearance: {}, appearanceMode: 'theme' as const };
  const mode = metadata.appearanceMode === 'custom' ? 'custom' : 'theme';
  node.dataset.appearanceMode = mode;
  node.dataset.themeAppearance = 'true';
  if (typeof block.className === 'string' && block.className.trim()) node.dataset.cls = block.className;
  // Nested layouts extend through this block's own inline padding/border.
  // The explicit appearance is the fallback for Forge's pseudo-element border;
  // after mount we merge it with the actual computed theme insets. Each block
  // receives local start/end values so offsets never accumulate from ancestors.
  const savedAppearance = metadata.appearance ?? {};
  const appearance = mode === 'custom' ? resolveBlockAppearanceForMode(savedAppearance, 'custom') : {};
  if (appearance.verticalAlign) node.dataset.forgeVerticalAlign = appearance.verticalAlign;
  // Horizontal block alignment applies to every visual element inside a leaf
  // block. Structural containers are excluded so their child blocks retain
  // their own independent alignment settings.
  if (appearance.textAlign && !['section', 'row', 'tabs'].includes(block.type)) {
    node.dataset.forgeBlockTextAlign = appearance.textAlign;
  }
  // A Forge Value is rendered as a native Stat or Track block. These blocks
  // must not inherit Atlas' trailing inset, and explicit text alignment needs
  // a full-width content surface so center/right alignment has room to work.
  if (block.type === 'stat' || block.type === 'track') {
    node.classList.add('is-forge-value-block');
    if (appearance.textAlign === 'center' || appearance.textAlign === 'end') {
      node.classList.add('has-forge-value-alignment');
      node.dataset.forgeValueTextAlign = appearance.textAlign;
    }
  }
  const nestedBleed = nestedLayoutInlineBleed(appearance);
  node.setCssProps({ ['--forge-nested-inline-bleed-start']: `${nestedBleed}px` });
  node.setCssProps({ ['--forge-nested-inline-bleed-end']: `${nestedBleed}px` });
  // Theme-following blocks deliberately receive no surface appearance values.
  if (mode !== 'custom') return;
  const borderPreset = appearance.borderPreset ?? 'default';
  if (borderPreset !== 'default') {
    node.dataset.borderPreset = borderPreset;
    if (borderPreset !== 'double') {
      node.classList.add('has-forge-border-frame');
      const frame = element('span', 'statblock-forge__custom-border-frame');
      frame.setAttribute('aria-hidden', 'true');
      node.append(frame);
    }
  }
  // Role flags make explicit Forge text-color overrides win over theme selectors
  // without changing theme colors for blocks that did not customize that role.
  if (appearance.textColor) node.dataset.customTextColor = 'true';
  if (appearance.labelColor) node.dataset.customLabelColor = 'true';
  if (appearance.valueColor) node.dataset.customValueColor = 'true';
  const css = buildBlockAppearanceCss(appearance);
  // Row-count-editable blocks use a column flex layout for their internal
  // scroll viewport. There the vertical axis is the main axis, so use
  // justify-content; align-items would affect the horizontal cross-axis.
  if (node.classList.contains('is-forge-row-count-editable') && appearance.verticalAlign) {
    delete css.alignItems;
    css.justifyContent = appearance.verticalAlign === 'start' ? 'flex-start'
      : appearance.verticalAlign === 'end' ? 'flex-end' : 'center';
  }
  for (const [property, value] of Object.entries(css)) {
    const cssProperty = property.startsWith('--') ? property : property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    node.setCssProps({ [cssProperty]: value });
  }
}

function applyGridPlacement(node: HTMLElement, placement: { x: number; y: number; span: number; rows: number } | undefined): void {
  if (!placement) return;
  node.setCssStyles({ gridColumn: `${placement.x + 1} / span ${placement.span}` });
  node.setCssStyles({ gridRow: `${placement.y + 1} / span ${placement.rows}` });
  node.setCssStyles({ minWidth: '0' });
  node.dataset.contentRows = String(placement.rows);
}

function renderFieldLine(
  sample: JsonRecord,
  fields: readonly ForgeField[],
  key: string,
  variant = 'default',
  signed = false,
): HTMLElement {
  const field = fieldOf(fields, key);
  const raw = valueOf(sample, key);
  let value = withUnit(raw, field);
  if (signed && typeof raw === 'number' && raw > 0) value = `+${raw}${field?.unit ? ` ${field.unit}` : ''}`;
  const line = element('div', `statblock-forge__preview-field${variant ? ` is-${variant}` : ''}`);
  const label = fieldLabel(field, key);
  if (label) line.append(element('span', 'statblock-forge__preview-field-label', label));
  else line.classList.add('is-value-only');
  line.append(element('span', 'statblock-forge__preview-field-value', value));
  return line;
}

function atlasHeaderFrame(
  part: string,
  blockType: string,
  fsType: string,
  field: ForgeField | undefined,
  content: HTMLElement,
  rowSize: 'fit' | 'fill' = 'fit',
  look?: string,
): HTMLElement {
  const frame = element('div', `atlas-sb-item atlas-sb-item--${rowSize}`);
  frame.dataset.type = fsType;
  frame.dataset.block = blockType;
  if (field?.key) frame.dataset.prop = field.key;
  frame.dataset.blockId = `header-${part}`;
  if (look) frame.dataset.look = look;
  frame.append(content);
  return frame;
}


/** Makes a Field's visible name an explicit shortcut to its inline editor.
 * This must take precedence over the dice-link click handler when a value is
 * rendered as a roll link, so users can still edit it by clicking its name.
 */
function markInlineFieldNameForEdit(
  node: HTMLElement,
  field: ForgeField | undefined,
  runtime: NumericFieldRuntime | undefined,
  editable = true,
): HTMLElement {
  if (!field || !runtime?.canEdit || !editable) return node;
  node.dataset.forgeEditField = field.key;
  node.setAttribute('role', 'button');
  node.tabIndex = 0;
  const label = field.label?.trim() || field.key;
  node.setAttribute('aria-label', `${runtime.language === 'pt-BR' ? 'Editar' : 'Edit'} ${label}`);
  return node;
}


function applyTokenFrameAppearance(node: HTMLElement, layout: ForgeLayoutDocument): void {
  const appearance = layout.tokenAppearance;
  if (appearance?.enabled !== true) return;
  const preset = appearance.borderPreset ?? 'default';
  node.classList.add('has-forge-token-border');
  node.dataset.tokenBorderPreset = preset;
  node.setCssProps({ ['--forge-token-border-color']: appearance.borderColor ?? 'var(--forge-theme-accent, var(--interactive-accent))' });
  node.setCssProps({ ['--forge-token-border-width']: `${appearance.borderWidth ?? (preset === 'double' ? 3 : 2)}px` });
  node.setCssProps({ ['--forge-token-inner']: 'var(--forge-theme-bg, var(--background-primary))' });
  const layer = element('span', 'statblock-forge__token-border-frame');
  layer.setAttribute('aria-hidden', 'true');
  node.append(layer);
}

function sampleHeader(
  app: App,
  markdownComponent: Component,
  sourcePath: string,
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  sample: JsonRecord,
  resolveImage?: (path: string) => string | undefined,
  numericRuntime?: NumericFieldRuntime,
  onImageFieldAction?: (fieldKey: string, socket: HTMLButtonElement) => void,
  imageFrames?: Readonly<StatblockImageFrames>,
  onImageFrameChange?: (blockId: string, frame: StatblockImageFrame) => void,
  header?: JsonRecord,
): HTMLElement {
  const headerNode = element('header', 'atlas-sb-header statblock-forge__preview-header');
  const textColumn = element('div', 'atlas-sb-header__text');
  const heading = element('div', 'atlas-sb-header__heading');
  const hiddenValue = object(template.header).hidden;
  const hidden = new Set(Array.isArray(hiddenValue)
    ? hiddenValue.filter((part): part is string => typeof part === 'string')
    : []);

  const name = headerFieldForPart(template.fields, 'name');
  if (!hidden.has('name')) {
    const titleText = readablePreviewValue(valueOf(sample, name?.key)) || template.id;
    const nameHeading = element('h1', 'atlas-sb-heading statblock-forge__preview-name');
    nameHeading.dataset.level = '1';
    if (isInlineTextField(name) && numericRuntime?.canEdit) nameHeading.append(createInlineTextFieldValue(app, markdownComponent, sourcePath, name, sample, numericRuntime));
    else nameHeading.textContent = titleText;
    heading.append(atlasHeaderFrame('name', 'title', 'heading', name, nameHeading, 'fill'));
  }

  const level = headerFieldForPart(template.fields, 'level');
  const type = headerFieldForPart(template.fields, 'type');
  const levelRaw = valueOf(sample, level?.key);
  const typeRaw = valueOf(sample, type?.key);
  const levelCalculated = level && (level.type === 'number' || (level.type === 'rating' && hasNumericFieldFormulaSettings(level)))
    ? numericRuntime?.value(level, sample) ?? null
    : null;
  const hasLevel = Boolean(level && !hidden.has('level') && (
    (levelRaw !== undefined && levelRaw !== null && levelRaw !== '') || levelCalculated !== null
    || (numericRuntime?.canEdit && (isFormulaCapableNumericField(level) || isInlineTextField(level)))
  ));
  const hasType = Boolean(type && !hidden.has('type') && (
    (typeRaw !== undefined && typeRaw !== null && typeRaw !== '') || (numericRuntime?.canEdit && isInlineTextField(type))
  ));
  if (hasLevel || hasType) {
    const subtitle = element('div', 'atlas-sb-header__subtitle');
    if (hasLevel && level) {
      const labelled = element('div', 'atlas-sb-labelled atlas-sb-labelled--run-in atlas-sb-stat');
      const label = fieldLabel(level, level.key);
      if (label) labelled.append(markInlineFieldNameForEdit(
        element('span', 'atlas-sb-label', label), level, numericRuntime, isFormulaCapableNumericField(level) || isInlineTextField(level),
      ));
      else labelled.classList.add('is-value-only');
      const value = element('span', 'atlas-sb-value');
      if (level.type === 'number' || level.type === 'rating') value.append(renderNumericFieldValue(level, sample, numericRuntime));
      else if (isInlineTextField(level) && numericRuntime?.canEdit) value.append(createInlineTextFieldValue(app, markdownComponent, sourcePath, level, sample, numericRuntime));
      else value.textContent = withUnit(levelRaw, level);
      labelled.append(value);
      subtitle.append(atlasHeaderFrame('level', 'stat', 'property', level, labelled, 'fit', 'run-in'));
    }
    if (hasLevel && hasType) subtitle.append(element('span', 'atlas-sb-header__dot', '·'));
    if (hasType && type) {
      const typeValue = element('span', 'atlas-sb-header__type');
      if (isInlineTextField(type) && numericRuntime?.canEdit) typeValue.append(createInlineTextFieldValue(app, markdownComponent, sourcePath, type, sample, numericRuntime));
      else typeValue.textContent = withUnit(typeRaw, type);
      subtitle.append(atlasHeaderFrame('type', 'stat', 'property', type, typeValue));
    }
    heading.append(subtitle);
  }
  if (heading.childElementCount > 0) textColumn.append(heading);

  const hp = headerFieldForPart(template.fields, 'hp');
  const hpRaw = valueOf(sample, hp?.key);
  const hpCalculated = hp && (hp.type === 'number' || (hp.type === 'rating' && hasNumericFieldFormulaSettings(hp)))
    ? numericRuntime?.value(hp, sample) ?? null
    : null;
  const hasHp = Boolean(hp && !hidden.has('hp') && (
    (hpRaw !== undefined && hpRaw !== null && hpRaw !== '') || hpCalculated !== null
    || (numericRuntime?.canEdit && (isFormulaCapableNumericField(hp) || isInlineTextField(hp)))
  ));
  if (hasHp && hp) {
    const labelled = element('div', 'atlas-sb-labelled atlas-sb-labelled--run-in atlas-sb-stat');
    const label = fieldLabel(hp, hp.key);
    if (label) labelled.append(markInlineFieldNameForEdit(
      element('span', 'atlas-sb-label', label), hp, numericRuntime, isFormulaCapableNumericField(hp) || isInlineTextField(hp),
    ));
    else labelled.classList.add('is-value-only');
    const value = element('span', 'atlas-sb-value');
    if (hp.type === 'number' || hp.type === 'rating') value.append(renderNumericFieldValue(hp, sample, numericRuntime));
    else if (isInlineTextField(hp) && numericRuntime?.canEdit) value.append(createInlineTextFieldValue(app, markdownComponent, sourcePath, hp, sample, numericRuntime));
    else value.textContent = withUnit(hpRaw, hp);
    labelled.append(value);
    textColumn.append(atlasHeaderFrame('hp', 'stat', 'property', hp, labelled, 'fit', 'run-in'));
  }

  const description = headerFieldForPart(template.fields, 'description');
  const descriptionValue = readablePreviewValue(valueOf(sample, description?.key));
  if (description && !hidden.has('description') && (
    descriptionValue
    || (numericRuntime?.canEdit && isInlineTextField(description))
  )) {
    const descriptionNode = element('div', 'atlas-sb-prose statblock-forge__preview-description');
    if (isInlineTextField(description) && numericRuntime?.canEdit) {
      descriptionNode.append(createInlineTextFieldValue(app, markdownComponent, sourcePath, description, sample, numericRuntime));
    } else if (description.type === 'markdown' && descriptionValue) {
      renderAtlasMarkdown(app, markdownComponent, sourcePath, descriptionNode, descriptionValue);
    } else {
      applyTextWithBasicMarkdown(descriptionNode, descriptionValue);
    }
    textColumn.append(atlasHeaderFrame('description', 'text', 'text', description, descriptionNode, 'fill'));
  }
  if (textColumn.childElementCount > 0) headerNode.append(textColumn);

  const nativeImageField = headerFieldForPart(template.fields, 'image');
  const imageField = nativeImageField?.type === 'image'
    ? nativeImageField
    : template.fields.find((field) => field.type === 'image' && ['token-image', 'token'].includes(field.key));
  const imageValue = imageReferenceText(valueOf(sample, imageField?.key));
  // Atlas treats token art as a fixed header part, not as an optional layout
  // block. Keep its socket visible when the field is empty so users can set
  // the sample image in the template editor or the image in a real statblock.
  // A non-interactive export only reserves the header slot when it has art.
  if (imageField && (imageValue || onImageFieldAction)) {
    const tokenBlock: ForgeBlock = {
      id: 'header-token',
      type: 'image',
      field: imageField.key,
      shape: 'token',
    };
    const art = renderImage(tokenBlock, imageField, sample, resolveImage, onImageFieldAction, imageFrames?.[tokenBlock.id], onImageFrameChange);
    art.classList.add('statblock-forge__header-token');
    // Atlas places token art at the start of the statblock body and floats it
    // right, allowing the name and introductory text to use the remaining
    // line width instead of forcing the whole header into two fixed columns.
    const tokenHeader = atlasHeaderFrame('token', 'image', 'image', imageField, art);
    tokenHeader.classList.add('statblock-forge__token-header-frame');
    applyTokenFrameAppearance(tokenHeader, layout);
    headerNode.prepend(tokenHeader);
  }
  return headerNode;
}

function expandedPattern(pattern: unknown, sample: JsonRecord): string | null {
  return expandStatblockPattern(pattern, sample, readablePreviewValue);
}

function renderTitle(app: App, markdownComponent: Component, sourcePath: string, block: ForgeBlock, fields: readonly ForgeField[], sample: JsonRecord, numericRuntime?: NumericFieldRuntime): HTMLElement {
  const raw = valueOf(sample, block.field);
  const pattern = expandedPattern(block.pattern, sample);
  const value = pattern ?? readablePreviewValue(raw);
  const level = Math.max(1, Math.min(3, Math.floor(Number(block.level) || 2)));
  const title = element(`h${level}` as 'h1' | 'h2' | 'h3', `atlas-sb-heading statblock-forge__preview-title level-${level}`);
  title.dataset.level = String(level);
  const field = fieldOf(fields, block.field);
  if (pattern === null && (field?.type === 'dice' && hasDiceFieldFormula(field) || isInlineTextField(field) && numericRuntime?.canEdit)) title.append(createInlineTextFieldValue(app, markdownComponent, sourcePath, field!, sample, numericRuntime));
  else if (pattern === null && field?.type === 'markdown' && value) renderAtlasMarkdown(app, markdownComponent, sourcePath, title, value);
  else title.textContent = value || '—';
  if (pattern !== null) {
    numericRuntime?.subscribeAll(() => {
      const next = expandedPattern(block.pattern, sample);
      if (next !== null && title.textContent !== next) title.textContent = next;
    });
  }
  return title;
}

function renderStat(app: App, markdownComponent: Component, sourcePath: string, block: ForgeBlock, fields: readonly ForgeField[], sample: JsonRecord, layout: ForgeLayoutDocument, sourceBlocks: readonly ForgeBlock[], header?: JsonRecord, numericRuntime?: NumericFieldRuntime): HTMLElement {
  const key = typeof block.field === 'string' ? block.field : '';
  const field = fieldOf(fields, key);
  const readNumber = (source: ForgeField): number | null => isFormulaCapableNumericField(source) && numericRuntime
    ? numericRuntime.value(source, sample)
    : numberValue(valueOf(sample, source.key));
  const trackedValue = field?.type === 'number'
    ? trackedNumberDisplayForField(field, fields, sample, readNumber, sourceBlocks, header)
    : null;
  // Atlas Patterns read a tracked Number's current value, not its maximum.
  const patternSample = trackedValue ? { ...sample, [key]: trackedValue.current } : sample;
  const raw = trackedValue ? trackedValue.current : valueOf(sample, key);
  const pattern = expandedPattern(block.pattern, patternSample);
  const signedRaw = block.display === 'signed' && typeof raw === 'number' && raw > 0 ? `+${raw}` : raw;
  const value = pattern ?? withUnit(signedRaw, field);
  // No Label is a block-level presentation choice. It overrides both a Field
  // label and an old explicit block-label copy in the final statblock renderer.
  const label = visibleFieldBlockLabel(block, block.label, field, key);
  const labelAboveValue = block.labelPlacement === 'above';
  const look = labelAboveValue || block.look === 'stacked' ? 'stacked' : 'run-in';
  const node = element('div', `atlas-sb-labelled atlas-sb-labelled--${look} atlas-sb-stat statblock-forge__preview-stat${look === 'stacked' ? ' is-stacked' : ' is-run-in'}${labelAboveValue ? ' is-above-label' : ''}${label ? '' : ' is-value-only'}`);
  const isNumericField = field !== undefined && (field.type === 'number' || field.type === 'rating');
  const labelNode = label ? markInlineFieldNameForEdit(
    element('span', 'atlas-sb-label statblock-forge__preview-stat-label', label),
    field, numericRuntime, pattern === null && (isNumericField || isInlineTextField(field)),
  ) : undefined;
  const valueNode = element('span', 'atlas-sb-value statblock-forge__preview-stat-value');
  let trackedCurrentText: Text | null = null;
  let trackedMaximumText: Text | null = null;
  let trackedMaximumContainer: HTMLElement | null = null;
  let trackedMaximumEditor: HTMLElement | null = null;
  const refreshTrackedDisplay = (): void => {
    if (!field || field.type !== 'number' || !trackedCurrentText || !trackedMaximumText) return;
    const next = trackedNumberDisplayForField(field, fields, sample, readNumber, sourceBlocks, header);
    if (!next) {
      trackedCurrentText.data = readablePreviewValue(valueOf(sample, key)) || '—';
      trackedMaximumText.data = '';
      trackedMaximumEditor?.remove();
      trackedMaximumEditor = null;
      return;
    }
    trackedCurrentText.data = String(next.current);
    const editsOwnMaximum = next.maxField.key === field.key && Boolean(numericRuntime?.canEdit);
    trackedMaximumText.data = editsOwnMaximum ? ' / ' : ` / ${next.maximum}`;
    if (editsOwnMaximum && numericRuntime && !trackedMaximumEditor && trackedMaximumContainer) {
      trackedMaximumEditor = createInlineNumericFieldValue(
        next.maxField,
        sample,
        numericRuntime,
        () => numericFieldDisplayText(next.maxField, sample, numericRuntime),
        'statblock-forge__tracked-number-maximum',
      );
      trackedMaximumEditor.setAttribute('aria-label', numericRuntime.language === 'pt-BR' ? `Máximo de ${field.label || field.key}` : `${field.label || field.key} maximum`);
      trackedMaximumContainer.append(trackedMaximumEditor);
    }
  };
  if (pattern === null && trackedValue) {
    const trackedNode = element('span', 'atlas-sb-tracked statblock-forge__tracked-number');
    trackedCurrentText = document.createTextNode(String(trackedValue.current));
    trackedMaximumText = document.createTextNode(` / ${trackedValue.maximum}`);
    trackedMaximumContainer = element('span', 'atlas-sb-tracked__max statblock-forge__tracked-number-max');
    trackedMaximumContainer.append(trackedMaximumText);
    trackedNode.append(trackedCurrentText, trackedMaximumContainer);
    valueNode.append(trackedNode);
    if (trackedValue.maxField.key === field?.key && numericRuntime?.canEdit) refreshTrackedDisplay();
  } else if (pattern === null && isNumericField && field) valueNode.append(renderNumericFieldValue(field, sample, numericRuntime, block.display === 'signed'));
  else if (pattern === null && field?.type === 'dice' && hasDiceFieldFormula(field)) valueNode.append(createInlineTextFieldValue(app, markdownComponent, sourcePath, field, sample, numericRuntime));
  else if (pattern === null && isInlineTextField(field) && numericRuntime?.canEdit) valueNode.append(createInlineTextFieldValue(app, markdownComponent, sourcePath, field, sample, numericRuntime));
  else if (pattern === null && field?.type === 'markdown' && value) renderAtlasMarkdown(app, markdownComponent, sourcePath, valueNode, value);
  else valueNode.textContent = value;
  const syncRollableValue = (): void => {
    if (trackedCurrentText) refreshTrackedDisplay();
    if (pattern !== null) {
      const nextTracked = field?.type === 'number'
        ? trackedNumberDisplayForField(field, fields, sample, readNumber, sourceBlocks, header)
        : null;
      const nextSample = nextTracked ? { ...sample, [key]: nextTracked.current } : sample;
      const next = expandedPattern(block.pattern, nextSample);
      if (next !== null && valueNode.textContent !== next) valueNode.textContent = next;
    }
    const rollText = trackedCurrentText ? trackedCurrentText.data : (valueNode.textContent ?? '');
    setForgeStatblockDiceLink(valueNode, rollableBonusFormula(rollText, block.rollable));
  };
  syncRollableValue();
  if (numericRuntime && trackedValue) {
    numericRuntime.subscribe(FORGE_RESOURCE_VALUES_KEY, syncRollableValue);
    numericRuntime.subscribe(trackedValue.maxField.key, syncRollableValue);
    numericRuntime.subscribeAll(syncRollableValue);
  }
  if (pattern !== null) numericRuntime?.subscribeAll(syncRollableValue);
  else if (field && numericRuntime && (field.type === 'number' || field.type === 'rating')) {
    numericRuntime.subscribe(field.key, syncRollableValue);
    numericRuntime.subscribeAll(syncRollableValue);
  }
  if (labelAboveValue) {
    // Above Label means the value precedes its descriptor in the vertical pair.
    node.append(valueNode);
    if (labelNode) node.append(labelNode);
  } else {
    if (labelNode) node.append(labelNode);
    node.append(valueNode);
  }
  return node;
}

function renderMetric(
  app: App,
  markdownComponent: Component,
  sourcePath: string,
  block: ForgeBlock,
  fields: readonly ForgeField[],
  sample: JsonRecord,
  layout: ForgeLayoutDocument,
  numericRuntime?: NumericFieldRuntime,
  showCanvasDropHint = false,
): HTMLElement {
  const wrapper = element('div', 'statblock-forge__preview-metric');
  const heading = isBlockLabelHidden(block) ? '' : (typeof block.heading === 'string' ? block.heading.trim() : '');
  const keys = Array.isArray(block.fields) ? block.fields.filter((key): key is string => typeof key === 'string') : [];
  if (heading) wrapper.append(element('strong', 'statblock-forge__preview-block-heading', heading));
  const numbers = element('div', 'statblock-forge__preview-metric-rows');
  if (keys.length === 0) {
    if (showCanvasDropHint) {
      numbers.append(markForgeUiText(
        element('div', 'statblock-forge__container-empty is-metric-placeholder', 'Drop a compatible Field here.'),
        'Drop a compatible Field here.',
      ));
    }
  } else {
    let offset = 0;
    const slotsPerRow = layout.blocks[block.id]?.metricSlotsPerRow ?? DEFAULT_METRIC_SLOTS_PER_ROW;
    for (const rowSize of metricPreviewRows(keys.length, slotsPerRow)) {
      const row = element('div', 'statblock-forge__preview-metric-grid');
      row.setCssStyles({ gridTemplateColumns: `repeat(${rowSize}, minmax(0, 1fr))` });
      keys.slice(offset, offset + rowSize).forEach((key, rowIndex) => {
        const slotIndex = offset + rowIndex;
        const field = fieldOf(fields, key);
        const formula = metricSlotFormula(block, slotIndex);
        const formulaLabel = metricSlotFormulaLabel(block, slotIndex);
        const diceField = !formula && field?.type === 'dice' ? field : undefined;
        const formulaBackedDice = Boolean(diceField && hasDiceFieldFormula(diceField));
        const label = formula
          ? (formulaLabel || formula)
          : fieldLabel(field, key);
        const getBaseValue = (): number | null => formula
          ? (numericRuntime?.evaluateFormula(formula, sample, undefined) ?? evaluatePreviewFormula(formula, sample, undefined, fields))
          : isFormulaCapableNumericField(field) && numericRuntime
            ? numericRuntime.value(field, sample)
            : numberValue(valueOf(sample, key));
        const getMetricDisplay = (): string => {
          const baseValue = getBaseValue();
          if (baseValue === null) return '—';
          const shown = String(Number(baseValue.toFixed(4)));
          return formula || (isFormulaCapableNumericField(field) && hasNumericFieldFormulaSettings(field))
            ? (field?.unit ? `${shown} ${field.unit}` : shown)
            : withUnit(baseValue, field);
        };
        const visibleLabel = label.trim();
        const cell = element('div', `statblock-forge__preview-metric-cell${visibleLabel ? '' : ' is-value-only'}`);
        if (block.rollable === true && visibleLabel) cell.dataset.rollName = visibleLabel;
        if (visibleLabel) cell.append(markInlineFieldNameForEdit(
          element('span', 'statblock-forge__preview-field-label', visibleLabel),
          field, numericRuntime, !formula && isFormulaCapableNumericField(field),
        ));
        const isSelectionMetric = !formula && field?.type === 'choice';
        const metricValue = isSelectionMetric && numericRuntime?.canEdit && field
          ? createInlineTextFieldValue(
            // Selection Fields use the same combobox/chip editor as Atlas' pane.
            // Registering the value slot lets the Metric block open only the
            // Field whose value the user clicked.
            app,
            markdownComponent,
            sourcePath,
            field,
            sample,
            numericRuntime,
          )
          : !formula && isFormulaCapableNumericField(field) && numericRuntime
            ? createInlineNumericFieldValue(field, sample, numericRuntime, getMetricDisplay, 'statblock-forge__preview-metric-value')
            : element('strong', 'statblock-forge__preview-metric-value');
        if (isSelectionMetric && field) {
          metricValue.classList.add('statblock-forge__preview-metric-value');
          metricValue.classList.add('is-live-metric');
        }
        const syncDiceMetric = (): void => {
          if (!diceField) return;
          metricValue.replaceChildren();
          const expression = formulaBackedDice
            ? numericRuntime?.diceFormula(diceField, sample) ?? ''
            : readablePreviewValue(valueOf(sample, key));
          if (expression) {
            metricValue.classList.remove('is-unresolved-dice-formula');
            metricValue.removeAttribute('title');
            appendForgeStatblockDiceText(metricValue, expression);
          } else {
            metricValue.classList.toggle('is-unresolved-dice-formula', formulaBackedDice);
            metricValue.textContent = '—';
            if (formulaBackedDice) metricValue.title = numericRuntime?.language === 'pt-BR'
              ? 'Não foi possível resolver a fórmula. Verifique os Fields referenciados e suas opções de Checkboxes/Selection.'
              : 'Could not resolve this formula. Check its referenced Fields and their Checkboxes/Selection options.';
          }
        };
        const syncRollableMetric = (): void => {
          if (isSelectionMetric) return;
          setForgeStatblockDiceLink(metricValue, rollableBonusFormula(metricValue.textContent ?? '', block.rollable));
        };
        if (diceField) syncDiceMetric();
        else if (isSelectionMetric) {
          if (!numericRuntime?.canEdit && field) {
            metricValue.textContent = selectionFieldValueText(field, valueOf(sample, key)) || '—';
          }
        } else if (!formula && !isFormulaCapableNumericField(field)) metricValue.textContent = getMetricDisplay();
        else syncRollableMetric();
        cell.append(metricValue);
        const redraw = (): void => {
          if (isSelectionMetric) return; // createInlineTextFieldValue owns Selection redraws.
          metricValue.textContent = getMetricDisplay();
          syncRollableMetric();
        };
        // Metric formulas can reference Checkboxes and Selection options directly.
        if (formula) numericRuntime?.subscribeAll(redraw);
        else if (diceField && numericRuntime) {
          if (formulaBackedDice) numericRuntime.subscribeAll(syncDiceMetric);
          else numericRuntime.subscribe(diceField.key, syncDiceMetric);
        } else if (field && numericRuntime && isFormulaCapableNumericField(field)) {
          numericRuntime.subscribe(field.key, syncRollableMetric);
          numericRuntime.subscribeAll(syncRollableMetric);
        }
        row.append(cell);
      });
      numbers.append(row);
      offset += rowSize;
    }
  }
  wrapper.append(numbers);
  return wrapper;
}

function normalizeTableCellValue(field: ForgeField, value: unknown): unknown {
  if ((field.type === 'number' || field.type === 'rating') && typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  return value;
}

function resolveTableFormulaRowValues(
  childFields: readonly ForgeField[],
  rowSample: JsonRecord,
  formulas: Record<string, string>,
  fields: readonly ForgeField[],
  runtime?: NumericFieldRuntime,
): Record<string, unknown> {
  // Start from the complete statblock sample. Table-local cells are already
  // overlaid by the caller, while non-Table Fields keep their current Values.
  const baseValues: Record<string, unknown> = { ...rowSample };
  for (const field of fields) {
    if ((field.type === 'number' || field.type === 'rating') && hasNumericFieldFormulaSettings(field)) {
      const raw = rowSample[field.key];
      const calculated = runtime?.value(field, rowSample)
        ?? (runtime?.evaluateFormula(String(field.formula ?? ''), rowSample, raw)
        ?? evaluatePreviewFormula(String(field.formula ?? ''), rowSample, raw, fields));
      baseValues[field.key] = calculated;
    }
  }
  return resolveTableRowFormulaValues(
    childFields,
    baseValues,
    formulas,
    (formula, values, slotValue, referenceFields, selfFieldKey) => runtime?.evaluateFormula(formula, values, slotValue, selfFieldKey)
      ?? evaluatePreviewFormula(formula, values, slotValue, referenceFields, {}, values, selfFieldKey),
    fields,
  );
}

function renderTableCalculatedValue(
  cell: HTMLTableCellElement,
  field: ForgeField,
  value: unknown,
  signed: boolean,
  rollable: boolean,
): void {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : null;
  const shown = numeric === null
    ? '—'
    : withUnit(`${signed && numeric > 0 ? '+' : ''}${String(Number(numeric.toFixed(4)))}`, field);
  const display = element('span', 'statblock-forge__preview-numeric-field-value statblock-forge__preview-table-formula-value', shown);
  display.dataset.noBlockEdit = 'true';
  display.setAttribute('aria-readonly', 'true');
  display.title = 'Calculated by Table formula';
  if (numeric !== null) {
    const rollText = `${(rollable && numeric > 0) ? '+' : ''}${String(Number(numeric.toFixed(4)))}`;
    const formulas = tableCellRollFormulas(rollText, rollable);
    if (formulas.length === 1) setForgeStatblockDiceLink(display, formulas[0]);
    else if (formulas.length > 1) appendForgeStatblockDiceText(display, rollText, rollable);
  }
  cell.append(display);
}

/** Builds formula text from the value actually shown in a Table cell. */
function tableCellRollText(
  field: ForgeField,
  sample: JsonRecord,
  runtime: NumericFieldRuntime | undefined,
  signed: boolean,
  rollable: boolean,
): string {
  const raw = sample[field.key];
  if (field.type === 'dice' && hasDiceFieldFormula(field)) {
    return runtime?.diceFormula(field, sample) ?? '';
  }
  if (field.type === 'number' || field.type === 'rating') {
    if (field.type === 'number' && !hasNumericFieldFormulaSettings(field)) {
      const written = numberFieldAdvantageRollFormula(raw);
      if (written) return written;
    }
    if (field.type === 'rating' && !hasNumericFieldFormulaSettings(field)) return readablePreviewValue(raw);
    const numeric = runtime ? runtime.value(field, sample) : numberValue(raw);
    if (numeric === null) return readablePreviewValue(raw);
    return `${(signed || rollable) && numeric > 0 ? '+' : ''}${String(Number(numeric.toFixed(4)))}`;
  }
  return readablePreviewValue(raw);
}

function renderTableSlotValue(
  cell: HTMLTableCellElement,
  field: ForgeField,
  sample: JsonRecord,
  app: App,
  markdownComponent: Component,
  sourcePath: string,
  fields: readonly ForgeField[],
  layout: ForgeLayoutDocument,
  resolveImage?: (path: string) => string | undefined,
  runtime?: NumericFieldRuntime,
  signed = false,
  rollable = false,
  onValueEdit?: (value: unknown) => void | Promise<void>,
  counterRowIndex?: number,
  language: ForgeLanguage = runtime?.language ?? 'en',
): void {
  const current = sample[field.key];
  // Structured Fields use their native renderer. The callback belongs to this
  // particular table cell, so additional rows never overwrite the base Field.
  if (field.type === 'counters') {
    const counterBlockId = `table-slot-counter-${field.key}`;
    const counterBlock = {
      id: counterBlockId,
      type: 'counters',
      field: field.key,
      label: '',
      labelPlacement: 'none',
    } as ForgeBlock;
    const counterLayout = {
      ...layout,
      blocks: {
        ...layout.blocks,
        [counterBlockId]: { countersPerRow: 1 },
      },
    } as ForgeLayoutDocument;
    cell.append(renderCounters(
      counterBlock,
      field,
      sample,
      counterLayout,
      runtime?.language ?? 'en',
      runtime,
      onValueEdit,
      counterRowIndex,
    ));
    return;
  }

  const nativeSlotBlockType: Record<string, string> = {
    checkboxes: 'checkboxes',
    list: 'tags',
    entries: 'entries',
    spells: 'spells',
    image: 'image',
  };
  const nativeBlockType = nativeSlotBlockType[field.type];
  if (nativeBlockType) {
    const slotBlock: ForgeBlock = {
      id: `table-slot-${field.key}`,
      type: nativeBlockType,
      field: field.key,
      label: '',
      heading: '',
      labelPlacement: 'none',
    };
    const onFieldValueChange = onValueEdit
      ? (_fieldKey: string, value: unknown) => onValueEdit(value)
      : runtime?.canEdit
        ? (fieldKey: string, value: unknown) => runtime.setBaseValue(fieldKey, value)
        : undefined;
    cell.append(renderLeafBlock(
      app,
      markdownComponent,
      sourcePath,
      slotBlock,
      fields,
      sample,
      layout,
      resolveImage,
      undefined,
      false,
      false,
      runtime?.language ?? 'en',
      undefined,
      runtime,
      onFieldValueChange,
    ));
    return;
  }

  // A Table Selection is an interactive Atlas combobox/chip control in its
  // cell, not a static value that first needs a click-to-edit wrapper. This is
  // shared by the live statblock and the Template Editor's sample preview.
  if (field.type === 'choice' && usesAtlasSelectionEditor(field)) {
    const writeSelection = onValueEdit
      ?? (runtime?.canEdit ? (nextValue: unknown) => runtime.setBaseValue(field.key, nextValue) : undefined);
    if (writeSelection) {
      let selection: SelectionEditorDom | null = null;
      let pendingSave: Promise<void> = Promise.resolve();
      const saveSelection = (nextValue: string): Promise<void> => {
        const save = pendingSave.catch(() => undefined).then(async () => {
          await writeSelection(nextValue);
          // Table edits redraw the row after persisting. Destroy the previous
          // popup instance after that redraw so no orphaned portal is left in
          // the document body.
          if (onValueEdit) selection?.destroy();
        });
        pendingSave = save.then(() => undefined, () => undefined);
        return save;
      };
      selection = createSelectionEditorDom(
        field,
        current,
        runtime?.language ?? language,
        saveSelection,
      );
      selection.root.classList.add('is-live-table');
      selection.root.dataset.forgeSelectionField = field.key;
      if (!onValueEdit && runtime?.canEdit) {
        runtime.subscribe(field.key, () => selection?.setValue(sample[field.key]));
      }
      cell.append(selection.root);
      return;
    }
  }

  const isFormulaBackedDice = field.type === 'dice' && hasDiceFieldFormula(field);
  const isPrimitiveValue = current === undefined || current === null
    || ['string', 'number', 'boolean'].includes(typeof current);

  // Live statblocks use one shared Table-cell editor for the first row and all
  // additional rows. This avoids the first row falling back to the normal Field
  // overlay while later rows use a differently styled Table input.
  if (onValueEdit && runtime?.canEdit && !isFormulaBackedDice && (isPrimitiveValue || field.type === 'choice')) {
    const valueNode = element('span', 'statblock-forge__preview-numeric-field-value statblock-forge__table-row-cell-value');
    let rollText = '';
    let displayText = readablePreviewValue(current);

    if (field.type === 'number' || field.type === 'rating') {
      rollText = tableCellRollText(field, sample, runtime, signed, rollable);
      // Match the normal Field display, including calculated Number/Rating values
      // and plain Rating notations such as 1/4. The editor still starts from the
      // stored raw value so formula-backed Fields retain their source data.
      displayText = numericFieldDisplayText(field, sample, runtime, signed);
      const formulas = tableCellRollFormulas(rollText, rollable);
      if (formulas.length === 1) setForgeStatblockDiceLink(valueNode, formulas[0]);
      else if (formulas.length > 1) appendForgeStatblockDiceText(valueNode, rollText, rollable);
      else valueNode.textContent = displayText;
    } else if (field.type === 'dice') {
      rollText = runtime.diceFormula(field, sample);
      displayText = rollText || '—';
      appendForgeStatblockDiceText(valueNode, displayText, rollable);
    } else if (field.type === 'choice') {
      displayText = selectionFieldValueText(field, current) || '—';
      valueNode.textContent = displayText;
    } else {
      rollText = readablePreviewValue(current);
      displayText = rollText || '—';
      appendForgeStatblockDiceText(valueNode, displayText, rollable);
    }

    if (valueNode.childNodes.length === 0) valueNode.textContent = displayText;
    valueNode.dataset.rollName = field.label.trim() || field.key;
    valueNode.tabIndex = 0;
    valueNode.dataset.noBlockEdit = 'true';
    valueNode.setAttribute('aria-keyshortcuts', 'F2');
    valueNode.title = runtime.language === 'pt-BR'
      ? 'Clique no espaço livre da célula ou pressione F2 para editar; clique no valor para rolar.'
      : 'Click the empty cell area or press F2 to edit; click the value to roll.';
    cell.append(valueNode);

    const openEditor = (): void => {
      if (!cell.isConnected || cell.querySelector('input, select, textarea')) return;
      let control: HTMLInputElement | HTMLSelectElement;
      let editorNode: HTMLElement;
      let selectionEditor: SelectionEditorDom | undefined;
      if (usesAtlasSelectionEditor(field)) {
        selectionEditor = createSelectionEditorDom(field, current, runtime.language);
        control = selectionEditor.control;
        editorNode = selectionEditor.root;
      } else if (field.type === 'choice' && Array.isArray(field.options)) {
        const select = element('select', 'statblock-forge__table-sample-cell-editor') as HTMLSelectElement;
        const currentText = current === undefined || current === null ? '' : String(current);
        const placeholder = element('option');
        placeholder.value = '';
        placeholder.textContent = runtime.language === 'pt-BR' ? '— Selecione —' : '— Select —';
        select.append(placeholder);
        const options = field.options.filter((option): option is string => typeof option === 'string');
        if (currentText && !options.includes(currentText)) {
          const legacy = element('option');
          legacy.value = currentText;
          legacy.textContent = currentText;
          select.append(legacy);
        }
        options.forEach((optionValue) => {
          const option = element('option');
          option.value = optionValue;
          option.textContent = optionValue;
          select.append(option);
        });
        select.value = currentText;
        control = select;
        editorNode = select;
      } else {
        const input = element('input', 'statblock-forge__table-sample-cell-editor') as HTMLInputElement;
        input.type = field.type === 'rating' ? 'number' : 'text';
        if (field.type === 'number') input.inputMode = 'text';
        input.value = current === undefined || current === null ? '' : String(current);
        control = input;
        editorNode = input;
      }
      if (!selectionEditor) control.setAttribute('aria-label', field.label.trim() || field.key);
      cell.replaceChildren(editorNode);
      control.focus();
      // Atlas Selection editors expose a text combobox as their primary control.
      // Keep the guard for native checkbox/radio editors used by other Field types.
      if (control instanceof HTMLInputElement && control.type !== 'checkbox' && control.type !== 'radio') {
        control.select();
      }
      let committed = false;
      const commit = (): void => {
        if (committed) return;
        committed = true;
        const selectionResult = selectionEditor?.read();
        if (selectionResult?.error) {
          committed = false;
          let errorNode = editorNode.querySelector<HTMLElement>('.statblock-forge__selection-editor-error');
          if (!errorNode) {
            errorNode = element('span', 'statblock-forge__selection-editor-error');
            editorNode.append(errorNode);
          }
          errorNode.textContent = selectionResult.error;
          selectionResult.invalidControl?.focus();
          return;
        }
        const next = selectionResult?.value ?? control.value;
        if (String(next ?? '') !== String(current ?? '')) {
          void Promise.resolve(onValueEdit(normalizeTableCellValue(field, next))).then(() => {
            selectionEditor?.destroy();
            if (cell.isConnected) cell.replaceChildren(valueNode);
          }).catch((error) => {
            committed = false;
            console.error('[Statblock Forge] Could not save Table cell:', error);
          });
        } else {
          selectionEditor?.destroy();
          cell.replaceChildren(valueNode);
        }
      };
      if (selectionEditor) {
        selectionEditor.root.addEventListener('focusout', (event) => {
          const nextTarget = event instanceof FocusEvent ? event.relatedTarget : null;
          if (nextTarget instanceof Node && selectionEditor?.root.contains(nextTarget)) return;
          commit();
        });
        selectionEditor.root.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            committed = true;
            selectionEditor?.destroy();
            cell.replaceChildren(valueNode);
            valueNode.focus();
          }
        });
      } else {
        control.addEventListener('change', commit);
        control.addEventListener('blur', commit);
        control.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            control.blur();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            committed = true;
            cell.replaceChildren(valueNode);
            valueNode.focus();
          }
        });
      }
    };

    valueNode.addEventListener('keydown', (event) => {
      if (event.key !== 'F2') return;
      event.preventDefault();
      event.stopPropagation();
      openEditor();
    });
    valueNode.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('.statblock-forge__dice-link')) return;
      event.preventDefault();
      event.stopPropagation();
      openEditor();
    });
    cell.addEventListener('click', (event) => {
      if (event.target !== cell) return;
      event.preventDefault();
      event.stopPropagation();
      openEditor();
    });
    return;
  }

  // Template Editor previews have an edit callback but no live statblock runtime.
  // Keep their direct sample controls, now shared by the first and later rows.
  if (onValueEdit && !runtime?.canEdit && (isPrimitiveValue || field.type === 'choice')) {
    if (usesAtlasSelectionEditor(field)) {
      const editor = createSelectionEditorDom(field, current, language);
      let committed = false;
      const commit = (): void => {
        if (committed) return;
        const result = editor.read();
        let errorNode = editor.root.querySelector<HTMLElement>('.statblock-forge__selection-editor-error');
        if (result.error) {
          if (!errorNode) {
            errorNode = element('span', 'statblock-forge__selection-editor-error');
            editor.root.append(errorNode);
          }
          errorNode.textContent = result.error;
          result.invalidControl?.focus();
          return;
        }
        committed = true;
        void Promise.resolve(onValueEdit(result.value)).then(
          () => editor.destroy(),
          (error) => {
            committed = false;
            console.error('[Statblock Forge] Could not save Table sample Selection:', error);
          },
        );
      };
      editor.root.addEventListener('focusout', (event) => {
        const nextTarget = event instanceof FocusEvent ? event.relatedTarget : null;
        if (nextTarget instanceof Node && editor.root.contains(nextTarget)) return;
        commit();
      });
      editor.root.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          committed = true;
          editor.destroy();
          cell.replaceChildren(element('span', 'statblock-forge__table-slot-value', readablePreviewValue(current) || '—'));
        }
      });
      cell.append(editor.root);
      editor.control.focus();
      return;
    }
    if (field.type === 'choice' && Array.isArray(field.options)) {
      const select = element('select', 'statblock-forge__table-sample-cell-editor') as HTMLSelectElement;
      const currentText = current === undefined || current === null ? '' : String(current);
      const placeholder = element('option');
      placeholder.value = '';
      placeholder.textContent = '—';
      select.append(placeholder);
      const options = field.options.filter((option): option is string => typeof option === 'string');
      if (currentText && !options.includes(currentText)) {
        const legacy = element('option');
        legacy.value = currentText;
        legacy.textContent = currentText;
        select.append(legacy);
      }
      options.forEach((optionValue) => {
        const option = element('option');
        option.value = optionValue;
        option.textContent = optionValue;
        select.append(option);
      });
      select.value = currentText;
      select.setAttribute('aria-label', field.label.trim() || field.key);
      select.addEventListener('change', () => onValueEdit(select.value));
      cell.append(select);
    } else {
      const input = element('input', 'statblock-forge__table-sample-cell-editor') as HTMLInputElement;
      input.type = field.type === 'rating' ? 'number' : 'text';
      if (field.type === 'number') input.inputMode = 'text';
      input.value = current === undefined || current === null ? '' : String(current);
      input.setAttribute('aria-label', field.label.trim() || field.key);
      input.addEventListener('change', () => onValueEdit(normalizeTableCellValue(field, input.value)));
      cell.append(input);
    }
    return;
  }

  if (field.type === 'number' || field.type === 'rating') {
    const numeric = renderNumericFieldValue(field, sample, runtime, signed);
    const formula = tableCellRollFormulas(tableCellRollText(field, sample, runtime, signed, rollable), rollable)[0];
    const valueNode = numeric.querySelector<HTMLElement>('.statblock-forge__preview-numeric-field-value');
    if (formula && valueNode) {
      setForgeStatblockDiceLink(valueNode, formula);
      valueNode.dataset.rollName = field.label.trim() || field.key;
    }
    cell.append(numeric);
    return;
  }
  if (field.type === 'dice' || field.type === 'choice' || isInlineTextField(field)) {
    cell.append(createInlineTextFieldValue(app, markdownComponent, sourcePath, field, sample, runtime));
    return;
  }
  const value = readablePreviewValue(current);
  cell.append(element('span', 'statblock-forge__table-slot-value', value || '—'));
}

function renderTableFields(
  block: ForgeBlock,
  storageFieldKey: string,
  sample: JsonRecord,
  childFields: readonly ForgeField[],
  app: App,
  markdownComponent: Component,
  sourcePath: string,
  fields: readonly ForgeField[],
  layout: ForgeLayoutDocument,
  resolveImage?: (path: string) => string | undefined,
  runtime?: NumericFieldRuntime,
  onEdit?: (edit: ScoreTableEdit) => void,
): HTMLElement {
  const editable = Boolean(onEdit || runtime?.canEdit);
  const wrapper = element('div', `statblock-forge__preview-scores statblock-forge__preview-table-block${editable ? ' statblock-forge__score-editor' : ''}`);
  const currentData = (): JsonRecord => runtime?.getCurrentData() ?? sample;
  const tableStorage = (): unknown => currentData()[storageFieldKey];

  if (childFields.length === 0) {
    const table = element('table', 'statblock-forge__preview-score-table statblock-forge__preview-table-grid');
    const body = element('tbody');
    const row = element('tr');
    const message = runtime?.language === 'pt-BR'
      ? 'Adicione Fields a esta Table para começar.'
      : 'Add Fields to this Table to begin.';
    row.append(markForgeUiText(element('td', 'statblock-forge__table-empty-cell', message), message));
    body.append(row);
    table.append(body);

    wrapper.append(table);
    return wrapper;
  }

  const language = runtime?.language ?? 'en';
  const rowLabelHeader = language === 'pt-BR' ? 'Linha' : 'Row';
  const addRowLabel = language === 'pt-BR' ? '＋ Adicionar linha' : '＋ Add row';
  const removeRowLabel = language === 'pt-BR' ? 'Excluir linha' : 'Delete row';
  const rowFormulaMap = tableFormulaMap(block, 'row');
  const columnFormulaMap = tableFormulaMap(block, 'column');

  const dispatchEdit = async (edit: ScoreTableEdit): Promise<void> => {
    if (onEdit) {
      onEdit(edit);
      return;
    }
    if (!runtime?.canEdit) return;
    if (edit.type === 'set-slot-value') {
      const field = childFields.find((candidate) => candidate.key === edit.fieldKey);
      await runtime.setBaseValue(edit.fieldKey, field ? normalizeTableCellValue(field, edit.value) : edit.value);
      return;
    }
    const previous = tableStorage();
    let normalizedEdit = edit;
    if (edit.type === 'set-row-cell') {
      const field = childFields.find((candidate) => candidate.key === edit.fieldKey);
      if (field) normalizedEdit = { ...edit, value: normalizeTableCellValue(field, edit.value) };
    }
    const next = updateForgeTableRows(previous, normalizedEdit);
    if (JSON.stringify(previous) !== JSON.stringify(next)) await runtime.setBaseValue(storageFieldKey, next);
  };

  const showColumnLabels = block.showColumnLabels !== false;
  const showRowLabels = block.showRowLabels === true;
  const editableRows = editable && block.allowRowAdd === true;
  const equalColumnCount = childFields.length + (showRowLabels ? 1 : 0);
  const actionsWidthRem = editableRows ? 2.1 : 0;
  const minimumDataColumnWidthRem = 2.25;

  // Resolve the equal data-column width against the Table's actual rendered
  // container width. This avoids relying on percentage widths on <col>, which
  // can be distributed differently when the host (Atlas/Obsidian) applies its
  // own table styles or when the Canvas block is resized.
  const updateTableColumnWidths = (): void => {
    if (equalColumnCount === 0 || !wrapper.isConnected) return;
    const table = wrapper.querySelector<HTMLTableElement>(':scope > .statblock-forge__preview-score-table');
    if (!table) return;
    const wrapperStyle = getComputedStyle(wrapper);
    const horizontalPadding = (Number.parseFloat(wrapperStyle.paddingLeft) || 0)
      + (Number.parseFloat(wrapperStyle.paddingRight) || 0);
    const availableWidth = Math.max(0, wrapper.clientWidth - horizontalPadding);
    if (availableWidth <= 0) return;

    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const actionsWidthPx = actionsWidthRem * rootFontSize;
    const minimumDataColumnWidthPx = minimumDataColumnWidthRem * rootFontSize;
    const dataColumnWidthPx = Math.max(
      minimumDataColumnWidthPx,
      (availableWidth - actionsWidthPx) / equalColumnCount,
    );
    const tableWidthPx = dataColumnWidthPx * equalColumnCount + actionsWidthPx;

    table.style.width = `${tableWidthPx}px`;
    table.style.minWidth = `${tableWidthPx}px`;
    table.setCssStyles({ maxWidth: 'none', tableLayout: 'fixed' });

    table.querySelectorAll<HTMLTableColElement>('col[data-table-data-column]').forEach((column) => {
      column.style.width = `${dataColumnWidthPx}px`;
    });
    table.querySelectorAll<HTMLElement>('[data-table-data-column]').forEach((cell) => {
      cell.style.width = `${dataColumnWidthPx}px`;
      cell.setCssStyles({ minWidth: '0', maxWidth: 'none', boxSizing: 'border-box' });
    });
    table.querySelectorAll<HTMLElement>(
      '.statblock-forge__preview-table-row-actions-column, .statblock-forge__preview-table-row-actions-heading, .statblock-forge__preview-table-row-actions-cell',
    ).forEach((actionTrack) => {
      actionTrack.style.width = `${actionsWidthPx}px`;
      actionTrack.style.minWidth = `${actionsWidthPx}px`;
      actionTrack.style.maxWidth = `${actionsWidthPx}px`;
      actionTrack.setCssStyles({ boxSizing: 'border-box' });
    });
  };

  const draw = (): void => {
    wrapper.replaceChildren();
    const table = element('table', `statblock-forge__preview-score-table statblock-forge__preview-table-grid${editable ? ' is-editable' : ''}${showColumnLabels ? '' : ' is-column-labels-hidden'}`);
    table.setAttribute('aria-label', 'Table');
    const current = currentData();
    const stored = readForgeTableRows(current[storageFieldKey]);
    const counterFields = childFields.filter((field) => field.type === 'counters');
    const counterRowCount = counterFields.reduce((count, field) =>
      Math.max(count, counterRows(valueOf(current, field.key), field)?.length ?? 0), 0);
    const rowCount = Math.min(FORGE_TABLE_MAX_ROWS, Math.max(1 + stored.extraRows.length, counterRowCount));
    const rowValues = Array.from({ length: rowCount }, (_unused, rowIndex) => {
      const rowSample: JsonRecord = rowIndex === 0 ? { ...current } : { ...current };
      if (rowIndex > 0) {
        childFields.forEach((field) => {
          if (field.type !== 'counters') rowSample[field.key] = forgeTableCellValue(current[storageFieldKey], rowIndex, field.key);
        });
      }
      const resolvedRow = resolveTableFormulaRowValues(childFields, rowSample, rowFormulaMap, fields, runtime);
      // Column Formula aggregates must summarize the values users actually see.
      // A Table Row Formula has priority for its cell; otherwise a Number/Rating
      // Field's own Formula supplies the displayed numeric value.
      for (const field of childFields) {
        if (rowFormulaMap[field.key] || !isFormulaCapableNumericField(field)) continue;
        const displayed = runtime?.value(field, rowSample);
        if (displayed !== null && displayed !== undefined) resolvedRow[field.key] = displayed;
      }
      return resolvedRow;
    });
    const columnFormulaContext = tableColumnAggregateContext(childFields, rowValues);
    const columnFormulaExternalValues = resolveTableFormulaRowValues([], current, {}, fields, runtime);

    // Keep percentage widths as a no-JS fallback. Once this wrapper is mounted,
    // updateTableColumnWidths assigns the exact same pixel width to every data
    // column and every corresponding cell, recalculating after container resize.
    const columnGroup = element('colgroup');
    let dataColumnIndex = 0;
    if (showRowLabels) {
      const rowLabelColumn = element('col', 'statblock-forge__preview-table-row-label-column') as HTMLTableColElement;
      rowLabelColumn.dataset.tableDataColumn = String(dataColumnIndex++);
      rowLabelColumn.style.width = equalColumnCount > 0 ? `${100 / equalColumnCount}%` : '';
      columnGroup.append(rowLabelColumn);
    }
    childFields.forEach((field) => {
      const column = element('col', `statblock-forge__preview-table-column statblock-forge__preview-table-column--${field.type}`) as HTMLTableColElement;
      column.dataset.tableDataColumn = String(dataColumnIndex++);
      column.style.width = equalColumnCount > 0 ? `${100 / equalColumnCount}%` : '';
      columnGroup.append(column);
    });
    if (editableRows) {
      const actionsColumn = element('col', 'statblock-forge__preview-table-row-actions-column');
      actionsColumn.style.width = `${actionsWidthRem}rem`;
      columnGroup.append(actionsColumn);
    }
    table.append(columnGroup);

    if (showColumnLabels || showRowLabels || editableRows) {
      const head = element('thead');
      const header = element('tr');
      if (showRowLabels) {
        // The row-label column remains structurally present, but its header
        // follows the same visibility setting as every other column label.
        const th = element('th', 'statblock-forge__preview-table-row-label-heading');
        th.dataset.tableDataColumn = '0';
        th.scope = 'col';
        // Row labels identify the row contents; the row-label column itself
        // intentionally has no visible heading ("Row" / "Linha").
        th.setAttribute('aria-label', rowLabelHeader);
        header.append(th);
      }
      if (showColumnLabels) childFields.forEach((field, fieldIndex) => {
        const th = element('th', 'statblock-forge__preview-table-column-label', field.label.trim() || field.key);
        th.dataset.tableColumnLabel = field.key;
        th.dataset.tableDataColumn = String(fieldIndex + (showRowLabels ? 1 : 0));
        th.scope = 'col';
        header.append(th);
      });
      if (editableRows) {
        const actionsHeading = element('th', 'statblock-forge__preview-table-row-actions-heading');
        actionsHeading.scope = 'col';
        // Keep a semantic heading without visible text so the delete control
        // does not force a wide, full-word action column in the Table.
        actionsHeading.setAttribute('aria-label', language === 'pt-BR' ? 'Ações da linha' : 'Row actions');
        header.append(actionsHeading);
      }
      head.append(header);
      table.append(head);
    }

    const body = element('tbody');
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const row = element('tr');
      if (showRowLabels) {
        const labelCell = element('th', 'statblock-forge__preview-table-row-label');
        labelCell.dataset.tableDataColumn = '0';
        labelCell.scope = 'row';
        const storedLabel = forgeTableRowLabel(current[storageFieldKey], rowIndex);
        const counterLabel = counterFields
          .map((field) => counterRows(valueOf(current, field.key), field)?.[rowIndex]?.name.trim() ?? '')
          .find((name) => name.length > 0) ?? '';
        const label = storedLabel || counterLabel;
        if (onEdit) {
          // Template Editor previews must allow authors to configure row Labels.
          // Live statblocks deliberately keep these labels read-only.
          const editor = element('input', 'statblock-forge__table-row-label-editor') as HTMLInputElement;
          editor.type = 'text';
          editor.value = storedLabel;
          editor.placeholder = label || String(rowIndex + 1);
          editor.setAttribute('aria-label', `${language === 'pt-BR' ? 'Rótulo da linha' : 'Row label'} ${rowIndex + 1}`);
          editor.addEventListener('change', () => {
            const value = editor.value;
            void dispatchEdit({ type: 'set-row-label', row: rowIndex, value });
          });
          editor.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') editor.blur();
          });
          labelCell.append(editor);
        } else {
          labelCell.textContent = label || String(rowIndex + 1);
        }
        row.append(labelCell);
      }
      childFields.forEach((field, fieldIndex) => {
        const cell = element('td', `statblock-forge__preview-table-cell statblock-forge__preview-table-cell--${field.type}`);
        cell.dataset.tableDataColumn = String(fieldIndex + (showRowLabels ? 1 : 0));
        // Counter Fields are row-oriented collections: their Nth configured
        // Counter is rendered on Table row N and keeps its own shared Field value.
        const isCounterField = field.type === 'counters';
        const rowSample: JsonRecord = isCounterField || rowIndex === 0
          ? current
          : { ...current, [field.key]: forgeTableCellValue(current[storageFieldKey], rowIndex, field.key) };
        const rowFormula = rowFormulaMap[field.key];
        if (rowFormula) {
          renderTableCalculatedValue(
            cell, field, rowValues[rowIndex]?.[field.key], block.display === 'signed', block.rollable === true,
          );
          row.append(cell);
          return;
        }
        // Every editable row uses the same Table cell interaction and visual editor.
        // Row zero writes the base Field; later rows write their own cell values.
        const onValueEdit = editable
          ? (value: unknown): Promise<void> => {
            const edit: ScoreTableEdit = isCounterField || rowIndex === 0
              ? { type: 'set-slot-value', fieldKey: field.key, value }
              : { type: 'set-row-cell', row: rowIndex, fieldKey: field.key, value };
            // Redraw after every committed edit so derived roll links always
            // reflect the latest persisted value.
            return dispatchEdit(edit).then(draw);
          }
          : undefined;
        renderTableSlotValue(
          cell, field, rowSample, app, markdownComponent, sourcePath, fields, layout,
          resolveImage, runtime, block.display === 'signed', block.rollable === true, onValueEdit,
          isCounterField ? rowIndex : undefined, language,
        );
        row.append(cell);
      });
      if (editableRows) {
        const actionCell = element('td', 'statblock-forge__preview-table-row-actions-cell');
        if (isForgeTableRowDeletable(rowIndex, counterRowCount, stored.extraRows.length)) {
          const removeRow = element('button', 'statblock-forge__inline-scores-table-action', '×') as HTMLButtonElement;
          removeRow.type = 'button';
          removeRow.title = removeRowLabel;
          removeRow.setAttribute('aria-label', `${removeRowLabel} ${rowIndex + 1}`);
          removeRow.addEventListener('click', () => {
            removeRow.disabled = true;
            void dispatchEdit({ type: 'remove-row', row: rowIndex }).then(draw).catch((error) => {
              removeRow.disabled = false;
              console.error('[Statblock Forge] Could not remove Table row:', error);
            });
          });
          actionCell.append(removeRow);
        }
        row.append(actionCell);
      }
      body.append(row);
    }
    table.append(body);

    if (Object.values(columnFormulaMap).some((formula) => formula.trim().length > 0)) {
      const foot = element('tfoot', 'statblock-forge__preview-table-formula-footer');
      const summary = element('tr', 'statblock-forge__preview-table-formula-row');
      if (showRowLabels) {
        const label = element('th', 'statblock-forge__preview-table-row-label statblock-forge__preview-table-formula-label', language === 'pt-BR' ? 'Resumo' : 'Summary');
        label.dataset.tableDataColumn = '0';
        label.scope = 'row';
        summary.append(label);
      }
      childFields.forEach((field, fieldIndex) => {
        const cell = element('td', `statblock-forge__preview-table-cell statblock-forge__preview-table-cell--${field.type} statblock-forge__preview-table-formula-cell`);
        cell.dataset.tableDataColumn = String(fieldIndex + (showRowLabels ? 1 : 0));
        const formula = columnFormulaMap[field.key];
        if (formula) {
          const value = tableColumnFormulaValue(
            formula, field.key, columnFormulaContext, fields,
            (source, values, slotValue, referenceFields, selfFieldKey) => runtime?.evaluateFormula(source, values, slotValue, selfFieldKey)
              ?? evaluatePreviewFormula(source, values, slotValue, referenceFields, {}, values, selfFieldKey),
            columnFormulaExternalValues,
          );
          renderTableCalculatedValue(cell, field, value, block.display === 'signed', block.rollable === true);
        }
        summary.append(cell);
      });
      if (editableRows) summary.append(element('td', 'statblock-forge__preview-table-row-actions-cell'));
      foot.append(summary);
      table.append(foot);
    }

    wrapper.append(table);
    updateTableColumnWidths();

    if (editableRows) {
      const actions = element('div', 'statblock-forge__table-row-actions');
      const addRow = element('button', 'statblock-forge__inline-scores-table-action', addRowLabel) as HTMLButtonElement;
      addRow.type = 'button';
      addRow.disabled = rowCount >= FORGE_TABLE_MAX_ROWS;
      addRow.addEventListener('click', () => {
        addRow.disabled = true;
        void dispatchEdit({ type: 'add-row', row: rowCount }).then(draw).catch((error) => {
          addRow.disabled = false;
          console.error('[Statblock Forge] Could not add Table row:', error);
        });
      });
      actions.append(addRow);
      wrapper.append(actions);
    }
  };

  draw();
  if (runtime && (Object.keys(rowFormulaMap).length > 0 || Object.keys(columnFormulaMap).length > 0)) {
    // Formula cells and the footer depend on other columns, so refresh the
    // complete Table whenever any source Field changes outside this Table.
    runtime.subscribeAll(draw);
  }
  if (typeof ResizeObserver !== 'undefined' && equalColumnCount > 0) {
    forgeTableColumnResizeObservers.get(wrapper)?.disconnect();
    const resizeObserver = new ResizeObserver(() => {
      if (!wrapper.isConnected) {
        // The returned wrapper is initially detached; keep observing until it
        // has been mounted at least once. Disconnect only after a mounted Table
        // is later removed from the document.
        if (wrapper.dataset.tableLayoutMounted === 'true') {
          resizeObserver.disconnect();
          forgeTableColumnResizeObservers.delete(wrapper);
        }
        return;
      }
      wrapper.dataset.tableLayoutMounted = 'true';
      updateTableColumnWidths();
    });
    forgeTableColumnResizeObservers.set(wrapper, resizeObserver);
    resizeObserver.observe(wrapper);
  }
  return wrapper;
}

function renderScores(
  app: App,
  markdownComponent: Component,
  sourcePath: string,
  block: ForgeBlock,
  sample: JsonRecord,
  fields: readonly ForgeField[],
  layout: ForgeLayoutDocument,
  resolveImage?: (path: string) => string | undefined,
  onEdit?: (edit: ScoreTableEdit) => void,
  runtime?: NumericFieldRuntime,
): HTMLElement {
  const linkedKeys = Array.isArray(block.fields)
    ? block.fields.filter((key): key is string => typeof key === 'string')
    : [];
  const childFields = [...new Set(linkedKeys)]
    .map((key) => fields.find((candidate) => candidate.key === key))
    .filter((candidate): candidate is ForgeField => Boolean(candidate)
      && candidate.type !== 'pairs' && candidate.type !== 'scores');
  const storageFieldKey = typeof block.field === 'string' ? block.field : '';
  return renderTableFields(
    block, storageFieldKey, sample, childFields, app, markdownComponent, sourcePath,
    fields, layout, resolveImage, runtime, onEdit,
  );
}

function tagItems(raw: unknown): string[] {
  return inlineListItems(raw);
}

function drawTagDisplay(display: HTMLElement, look: unknown, items: readonly string[]): void {
  display.replaceChildren();
  if (items.length === 0) {
    display.append(markForgeUiText(element('span', 'statblock-forge__hint', 'Nenhuma tag de exemplo.'), 'Nenhuma tag de exemplo.'));
    return;
  }
  if (look === 'comma') {
    const inline = element('span', 'statblock-forge__preview-tags-inline');
    items.forEach((item, index) => {
      if (index > 0) inline.append(document.createTextNode(', '));
      const value = element('span', 'statblock-forge__preview-tag-item', item);
      value.dataset.rollName = item;
      linkForgeStatblockDice(value);
      inline.append(value);
    });
    display.append(inline);
    return;
  }
  const listNode = element(look === 'numbered' ? 'ol' : 'ul', 'statblock-forge__preview-tag-list');
  for (const item of items) {
    const entry = element('li', look === 'chips' ? 'is-chip' : '');
    entry.dataset.rollName = item;
    applyTextWithBasicMarkdown(entry, item);
    // List values can contain inline dice just like Ability descriptions.
    // Reapply after every chip/list redraw so newly edited items remain rollable.
    linkForgeStatblockDice(entry);
    listNode.append(entry);
  }
  display.append(listNode);
}

function createInlineListFieldValue(
  field: ForgeField,
  sample: JsonRecord,
  runtime: NumericFieldRuntime,
  look: unknown,
  display: HTMLElement,
): HTMLElement {
  const slot = createInlineEditSlot(look === 'comma' ? 'span' : 'div', 'statblock-forge__preview-inline-list-field', display, look !== 'comma');
  const redraw = (): void => drawTagDisplay(display, look, inlineListItems(sample[field.key]));
  redraw();
  if (runtime.canEdit) {
    registerInlineSlotEditor(slot.slot, field.key, () => {
      if (!display.isConnected || runtime.isSaving) return null;
      let items = inlineListItems(sample[field.key]);
      let typed = '';
      let lastWrite: Promise<boolean> = Promise.resolve(true);
      const layer = element(look === 'comma' ? 'span' : 'div', 'atlas-sb-pane-editor atlas-sb-value');
      const chips = element('span', 'atlas-sb-pane-field atlas-sb-pane-chips statblock-forge__inline-list-chips');
      const input = element('input', 'atlas-sb-pane-input atlas-sb-pane-chips__input statblock-forge__inline-list-input');
      input.type = 'text';
      input.autocomplete = 'off';
      input.placeholder = field.label || field.key;
      input.setAttribute('aria-label', runtime.language === 'pt-BR' ? `Adicionar item a ${field.label || field.key}` : `Add item to ${field.label || field.key}`);
      const error = element('span', 'statblock-forge__inline-field-editor-error');
      error.hidden = true;

      const renderChips = (): void => {
        // Reuse keyed chip nodes and keep the input mounted. This preserves its
        // caret and prevents a pending blur-commit from detaching the × target
        // before the click event is delivered.
        if (input.parentElement !== chips) chips.append(input);
        const previous = new Map<string, HTMLElement>();
        for (const child of Array.from(chips.children)) {
          if (child !== input && child instanceof HTMLElement && child.dataset.chipKey) previous.set(child.dataset.chipKey, child);
        }
        const retained = new Set<HTMLElement>();
        for (const [index, item] of items.entries()) {
          const key = `${index}\u0000${item}`;
          let chip = previous.get(key);
          if (!chip) {
            chip = element('span', 'atlas-sb-pane-chip');
            const text = element('span', 'atlas-sb-pane-chip__text');
            const remove = element('button', 'atlas-sb-pane-chip__remove', '×');
            remove.type = 'button';
            remove.dataset.noBlockEdit = 'true';
            chip.append(text, remove);
          }
          chip.dataset.chipKey = key;
          const text = chip.querySelector<HTMLElement>('.atlas-sb-pane-chip__text');
          const remove = chip.querySelector<HTMLButtonElement>('.atlas-sb-pane-chip__remove');
          if (text) text.textContent = item;
          if (remove) {
            remove.dataset.removeIndex = String(index);
            remove.setAttribute('aria-label', runtime.language === 'pt-BR' ? `Remover ${item}` : `Remove ${item}`);
            remove.title = remove.getAttribute('aria-label') ?? '';
          }
          retained.add(chip);
          chips.insertBefore(chip, input);
        }
        for (const child of Array.from(chips.children)) {
          if (child !== input && child instanceof HTMLElement && !retained.has(child)) child.remove();
        }
      };
      chips.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-remove-index]') : null;
        if (!target) return;
        event.preventDefault();
        event.stopPropagation();
        const index = Number(target.dataset.removeIndex);
        if (!Number.isInteger(index)) return;
        void persist(removeInlineListItem(items, index)).then(() => input.focus());
      });
      const persist = (nextItems: string[]): Promise<boolean> => {
        items = [...nextItems];
        renderChips();
        const snapshot = [...items];
        lastWrite = lastWrite.then(async () => {
          try {
            await runtime.setBaseValue(field.key, snapshot);
            error.hidden = true;
            input.removeAttribute('aria-invalid');
            return true;
          } catch (caught) {
            error.textContent = caught instanceof Error ? caught.message : String(caught);
            error.hidden = false;
            input.setAttribute('aria-invalid', 'true');
            items = inlineListItems(sample[field.key]);
            renderChips();
            return false;
          }
        });
        return lastWrite;
      };
      const addTyped = async (): Promise<boolean> => {
        const item = typed.trim();
        if (item) {
          typed = '';
          input.value = '';
          return persist(addInlineListItem(items, item));
        }
        return lastWrite;
      };
      input.addEventListener('input', () => { typed = input.value; });
      renderChips();
      layer.append(chips, error);
      slot.open(layer, display);

      return {
        fieldKey: field.key,
        control: input,
        commit: addTyped,
        handleKeyDown: (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            void addTyped();
            return true;
          }
          if (event.key === 'Escape') {
            // Match the Atlas chip editor: discard only the pending text, then
            // let the shared pane controller close the edit session.
            typed = '';
            input.value = '';
            return false;
          }
          if (event.key === 'Backspace' && input.value === '' && items.length > 0) {
            event.preventDefault();
            event.stopPropagation();
            void persist(removeInlineListItem(items, items.length - 1)).then(() => input.focus());
            return true;
          }
          return false;
        },
        close: () => {
          slot.close(layer, display);
          redraw();
        },
      };
    }, display);
  }
  runtime.subscribe(field.key, redraw);
  runtime.subscribeAll(redraw);
  return slot.slot;
}

function renderTags(
  block: ForgeBlock,
  field: ForgeField | undefined,
  sample: JsonRecord,
  layout: ForgeLayoutDocument,
  numericRuntime?: NumericFieldRuntime,
  language: ForgeLanguage = 'en',
): HTMLElement {
  const wrapper = element('div', `statblock-forge__preview-tags is-${String(block.look ?? 'chips')}`);
  const label = visibleFieldBlockLabel(block, block.label, field, block.field, true, false);
  if (!label) wrapper.classList.add('is-value-only');
  if (label) wrapper.append(markInlineFieldNameForEdit(
    element('strong', 'statblock-forge__preview-block-heading', label), field, numericRuntime, field?.type === 'list',
  ));
  if (field?.type === 'list' && numericRuntime?.canEdit) {
    const display = element(block.look === 'comma' ? 'span' : 'div', 'statblock-forge__preview-tags-value');
    wrapper.append(createInlineListFieldValue(field, sample, numericRuntime, block.look, display));
  } else {
    const display = element(block.look === 'comma' ? 'span' : 'div', 'statblock-forge__preview-tags-value');
    drawTagDisplay(display, block.look, tagItems(valueOf(sample, block.field)));
    wrapper.append(display);
  }
  const actions = element('div', 'statblock-forge__entry-actions');
  appendCustomCollectionValueAction(actions, field, numericRuntime, language);
  appendFieldCompendiumPicker(actions, field, layout, sample, numericRuntime, language);
  if (actions.childElementCount > 0) wrapper.append(actions);
  return wrapper;
}

function renderEntryCounter(
  parent: HTMLElement,
  part: AbilityPart,
  record: JsonRecord,
  layout: ForgeLayoutDocument,
  fieldKey: string,
  entryIndex: number,
  interactive: boolean,
  onMaximumChange?: (fieldKey: string, entryIndex: number) => void,
  numericRuntime?: NumericFieldRuntime,
): void {
  let maximum = abilityCounterMaxForRow(record, part);
  let marks = normalizeAbilityCounterMarks(record[part.key], maximum);
  const partAppearance = layout.abilityParts?.[fieldKey]?.[part.key] ?? {};
  const hasLegacyPartColors = Boolean(partAppearance.trackFillColor || partAppearance.trackEmptyColor || partAppearance.trackBorderColor);
  const useCustomPartAppearance = partAppearance.appearanceMode === 'custom'
    || (partAppearance.appearanceMode === undefined && hasLegacyPartColors);
  const line = element('span', `statblock-forge__preview-entry-part is-counter${part.look === 'checkboxes' ? ' is-boxes' : ''}`);
  line.append(element('span', 'statblock-forge__preview-entry-part-label', `${part.label}:`));
  const count = element('span', 'statblock-forge__ability-counter-count statblock-forge__preview-counter-value', `${marks.filter(Boolean).length}/${maximum}`);
  line.append(count);
  const indicator = element('span', `statblock-forge__ability-counter${part.look === 'checkboxes' ? ' is-boxes' : ''}`);
  indicator.setCssProps({ ['--forge-part-fill']: useCustomPartAppearance && partAppearance.trackFillColor
    ? partAppearance.trackFillColor : 'var(--forge-theme-track-fill, var(--interactive-accent))' });
  indicator.setCssProps({ ['--forge-part-empty']: useCustomPartAppearance && partAppearance.trackEmptyColor
    ? partAppearance.trackEmptyColor : 'var(--forge-theme-track-empty, var(--background-primary))' });
  indicator.setCssProps({ ['--forge-part-border']: useCustomPartAppearance && partAppearance.trackBorderColor
    ? partAppearance.trackBorderColor : 'var(--forge-theme-track-border, var(--background-modifier-border))' });
  const renderMarks = (): void => {
    indicator.replaceChildren();
    marks = normalizeAbilityCounterMarks(record[part.key], maximum);
    marks.forEach((filled, index) => {
      if (interactive) {
        const mark = element('button', `statblock-forge__ability-counter-mark${filled ? ' is-filled' : ''}`);
        mark.type = 'button';
        mark.setAttribute('aria-label', `${part.label}: ${index + 1} of ${maximum}`);
        mark.setAttribute('aria-pressed', filled ? 'true' : 'false');
        mark.addEventListener('click', (event) => {
          event.stopPropagation();
          const next = [...marks];
          next[index] = !next[index];
          releaseFieldCompendiumEntrySource(record);
          record[part.key] = next;
          marks = next;
          count.textContent = `${marks.filter(Boolean).length}/${maximum}`;
          mark.classList.toggle('is-filled', next[index] === true);
          mark.setAttribute('aria-pressed', next[index] ? 'true' : 'false');
          numericRuntime?.refreshAll();
          onMaximumChange?.(fieldKey, entryIndex);
        });
        indicator.append(mark);
      } else {
        indicator.append(element('span', `statblock-forge__ability-counter-mark${filled ? ' is-filled' : ''}`));
      }
    });
  };
  renderMarks();
  line.append(indicator);
  if (interactive || onMaximumChange) {
    const maxControls = element('span', 'statblock-forge__ability-counter-max-controls');
    const decrement = element('button', 'statblock-forge__ability-counter-max-button', '−');
    decrement.type = 'button';
    decrement.title = 'Decrease this ability counter maximum';
    decrement.dataset.forgeUiTitle = 'Decrease this ability counter maximum';
    decrement.dataset.forgeUiAriaLabel = 'Decrease this ability counter maximum';
    decrement.disabled = maximum <= 1;
    decrement.addEventListener('click', (event) => {
      event.stopPropagation();
      if (maximum <= 1) return;
      maximum -= 1;
      releaseFieldCompendiumEntrySource(record);
      Object.assign(record, withAbilityCounterMaxForRow(record, part, maximum));
      renderMarks();
      count.textContent = `${marks.filter(Boolean).length}/${maximum}`;
      decrement.disabled = maximum <= 1;
      increment.disabled = maximum >= 12;
      numericRuntime?.refreshAll();
      onMaximumChange?.(fieldKey, entryIndex);
    });
    const increment = element('button', 'statblock-forge__ability-counter-max-button', '+');
    increment.type = 'button';
    increment.title = 'Increase this ability counter maximum';
    increment.dataset.forgeUiTitle = 'Increase this ability counter maximum';
    increment.dataset.forgeUiAriaLabel = 'Increase this ability counter maximum';
    increment.addEventListener('click', (event) => {
      event.stopPropagation();
      if (maximum >= 12) return;
      maximum += 1;
      releaseFieldCompendiumEntrySource(record);
      Object.assign(record, withAbilityCounterMaxForRow(record, part, maximum));
      renderMarks();
      count.textContent = `${marks.filter(Boolean).length}/${maximum}`;
      decrement.disabled = maximum <= 1;
      increment.disabled = maximum >= 12;
      numericRuntime?.refreshAll();
      onMaximumChange?.(fieldKey, entryIndex);
    });
    increment.disabled = maximum >= 12;
    maxControls.append(decrement, increment);
    line.append(maxControls);
  }
  parent.append(line);
}

let nextInlineEntryEditorId = 0;

interface EntryEditorFocus {
  kind: 'name' | 'text' | 'extra';
  key?: string;
}

interface EntryEditorHost {
  renderSaved(row: HTMLElement, entry: unknown, index: number): void;
  renderCancelled(row: HTMLElement, entry: unknown, index: number, isNew: boolean): void;
  removeRow(row: HTMLElement, index: number): void;
  moveRow(row: HTMLElement, from: number, to: number): void;
  startNext(afterIndex: number): void;
  startDuplicate(afterIndex: number): void;
  closed(row: HTMLElement): void;
}

interface EntryPartControl {
  focus: HTMLElement;
  read(): string;
}

interface InlineEntryEditorSession {
  commit(): Promise<boolean>;
  moveEntry(from: number, to: number, draggedRow: HTMLElement): Promise<boolean>;
}

/** Lets the card-level Atlas navigation commit an Entry before moving to the next Field. */
const inlineEntryEditorSessions = new WeakMap<HTMLElement, InlineEntryEditorSession>();

/** Insert a newline into the Atlas plaintext-only description without allowing rich HTML. */
function insertEntryTextAtCaret(target: HTMLElement, inserted: string): void {
  const current = target.textContent ?? '';
  const selection = target.ownerDocument.getSelection();
  let start = current.length;
  let end = current.length;
  if (selection?.rangeCount) {
    const selected = selection.getRangeAt(0);
    if (target.contains(selected.startContainer)) {
      const before = selected.cloneRange();
      before.selectNodeContents(target);
      before.setEnd(selected.startContainer, selected.startOffset);
      start = before.toString().length;
      end = start + selected.toString().length;
    }
  }
  const next = `${current.slice(0, start)}${inserted}${current.slice(end)}`;
  target.textContent = next;
  const node = target.firstChild ?? target;
  const range = target.ownerDocument.createRange();
  range.setStart(node, Math.min(start + inserted.length, node.textContent?.length ?? 0));
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function openInlineEntryEditor(
  row: HTMLElement,
  field: ForgeField,
  rawEntry: unknown,
  initialIndex: number,
  sample: JsonRecord,
  runtime: NumericFieldRuntime,
  language: ForgeLanguage,
  host: EntryEditorHost,
  options: { isNew?: boolean; afterIndex?: number | null; focus?: EntryEditorFocus } = {},
): InlineEntryEditorSession {
  const isNew = options.isNew === true;
  let rowIndex = initialIndex;
  let afterIndex = options.afterIndex ?? (initialIndex > -1 ? initialIndex - 1 : null);
  const noun = field.label.trim() || (language === 'pt-BR' ? 'Habilidade' : 'Entry');
  const draft = inlineEntryDraftValue(field, rawEntry);
  const parts = abilityPartsForField(field);
  const root = element('div', 'atlas-sb-pane-entry-editor');
  const editorOwner = `entry-editor-${++nextInlineEntryEditorId}`;
  const choicePickerCleanups: Array<() => void> = [];
  root.dataset.entryEditor = 'true';
  root.dataset.entryEditorOwner = editorOwner;
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', isNew
    ? (language === 'pt-BR' ? `Nova ${noun.toLowerCase()}` : `New ${noun.toLowerCase()}`)
    : (language === 'pt-BR' ? `Editar ${noun.toLowerCase()}` : `Edit ${noun.toLowerCase()}`));
  const nameWrap = element('span', 'atlas-sb-trait-name');
  const name = element('input', 'atlas-sb-pane-input atlas-sb-pane-entry__name');
  name.type = 'text';
  name.autocomplete = 'off';
  name.value = draft.name;
  name.dataset.entryPart = 'name';
  name.dataset.entryControl = 'true';
  name.placeholder = language === 'pt-BR' ? `Nome de ${noun.toLowerCase()}` : `${noun} name`;
  name.setAttribute('aria-label', name.placeholder);
  nameWrap.append(name);
  root.append(nameWrap);

  const extrasWrap = element('span', 'atlas-sb-pane-entry__parts');
  const controls = new Map<string, EntryPartControl>();
  const counterControls = new Map<string, { max: HTMLInputElement; marks: HTMLInputElement[] }>();

  const addSimplePart = (part: AbilityPart): void => {
    const wrap = element('span', 'atlas-sb-pane-entry__part');
    wrap.dataset.entryPart = 'extra';
    wrap.dataset.entryExtra = part.key;
    const label = element('span', 'atlas-sb-entry-extra-label', part.label);
    const input = element('input', 'atlas-sb-pane-input atlas-sb-pane-entry__control');
    input.type = 'text';
    input.dataset.entryControl = 'true';
    input.setAttribute('aria-label', part.label);
    if (part.type === 'number') input.inputMode = 'decimal';
    const initial = draft.parts[part.key] ?? '';
    input.value = part.type === 'list' ? initial.replace(/\r?\n/g, ', ') : initial;
    wrap.append(label, input);
    extrasWrap.append(wrap);
    controls.set(part.key, { focus: input, read: () => input.value });
  };

  const addChoicePart = (part: AbilityPart): void => {
    const optionsList = Array.isArray(part.options) ? part.options.filter((value): value is string => typeof value === 'string') : [];
    if (optionsList.length === 0) {
      addSimplePart(part);
      return;
    }
    const wrap = element('span', 'atlas-sb-pane-entry__part');
    wrap.dataset.entryPart = 'extra';
    wrap.dataset.entryExtra = part.key;
    wrap.append(element('span', 'atlas-sb-entry-extra-label', part.label));

    const multiple = part.several === true;
    let selected = multiple ? splitAbilityPartListText(draft.parts[part.key] ?? '') : (draft.parts[part.key] ?? '').trim() ? [draft.parts[part.key].trim()] : [];
    const fieldControl = element('span', `atlas-sb-pane-field atlas-sb-pane-choice atlas-sb-pane-entry__control${multiple ? ' atlas-sb-pane-chips' : ''}`);
    const chips = multiple ? element('span', 'atlas-sb-pane-entry__choice-chips') : null;
    const input = element('input', `atlas-sb-pane-input${multiple ? ' atlas-sb-pane-chips__input' : ''}`);
    input.type = 'text';
    input.readOnly = true;
    input.dataset.entryControl = 'true';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-label', part.label);
    input.setAttribute('aria-expanded', 'false');
    input.placeholder = multiple ? (language === 'pt-BR' ? 'Adicionar…' : 'Add…') : '—';
    const chevron = element('span', 'atlas-sb-pane-choice__chevron', '▾');
    chevron.setAttribute('aria-hidden', 'true');
    if (chips) fieldControl.append(chips);
    fieldControl.append(input, chevron);
    wrap.append(fieldControl);
    extrasWrap.append(wrap);

    const popup = element('div', 'atlas-sb-pane-options');
    popup.setAttribute('role', 'listbox');
    popup.setAttribute('aria-label', part.label);
    popup.dataset.entryEditorOwner = editorOwner;
    popup.hidden = true;
    let opened = false;
    let activeOption = -1;
    let shownOptions: string[] = [];
    let optionNodes: HTMLElement[] = [];

    const valueText = (): string => {
      if (!multiple) return selected[0] ?? '';
      const chosen = optionsList.flatMap((option) => {
        const match = selected.find((value) => value.toLowerCase() === option.toLowerCase());
        return match === undefined ? [] : [match];
      });
      const unread = selected.filter((value) => !optionsList.some((option) => option.toLowerCase() === value.toLowerCase()));
      return [...chosen, ...unread].join(', ');
    };
    const refreshValue = (): void => {
      if (multiple) {
        chips?.replaceChildren();
        selected.forEach((value, index) => {
          const chip = element('span', 'atlas-sb-pane-chip');
          chip.append(element('span', 'atlas-sb-pane-chip__text', value));
          const remove = element('button', 'atlas-sb-pane-chip__remove', '×');
          remove.type = 'button';
          remove.setAttribute('aria-label', language === 'pt-BR' ? `Remover ${value}` : `Remove ${value}`);
          remove.addEventListener('mousedown', (event) => event.preventDefault());
          remove.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            selected = selected.filter((_item, at) => at !== index);
            refreshValue();
            input.focus();
          });
          chip.append(remove);
          chips?.append(chip);
        });
        input.value = '';
        input.placeholder = selected.length === 0
          ? (language === 'pt-BR' ? 'Adicionar…' : 'Add…')
          : '';
      } else {
        input.value = selected[0] ?? '';
      }
      input.setAttribute('aria-expanded', String(opened));
    };
    const positionPopup = (): void => {
      if (!opened || !fieldControl.isConnected) return;
      const rect = fieldControl.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
      const width = Math.min(Math.max(rect.width, 150), Math.max(120, viewportWidth - 16));
      const left = Math.max(8, Math.min(rect.left, viewportWidth - width - 8));
      const below = Math.max(0, viewportHeight - rect.bottom - 8);
      const above = Math.max(0, rect.top - 8);
      const preferred = Math.min(240, Math.max(36, shownOptions.length * 34));
      const openAbove = below < Math.min(preferred, 140) && above > below;
      const available = openAbove ? above : below;
      const height = Math.max(36, Math.min(preferred, available || preferred));
      popup.setCssStyles({ position: 'fixed' });
      popup.setCssStyles({ left: `${left}px` });
      popup.setCssStyles({ width: `${width}px` });
      popup.setCssStyles({ maxHeight: `${height}px` });
      popup.setCssStyles({ top: openAbove
        ? `${Math.max(8, rect.top - height - 4)}px`
        : `${Math.min(viewportHeight - height - 8, rect.bottom + 4)}px` });
    };
    const updateActive = (): void => {
      optionNodes.forEach((option, index) => {
        const active = index === activeOption;
        option.classList.toggle('is-active', active);
        option.setAttribute('aria-selected', String(active));
      });
      const activeNode = optionNodes[activeOption];
      if (activeNode) {
        input.setAttribute('aria-activedescendant', activeNode.id);
        activeNode.scrollIntoView({ block: 'nearest' });
      } else input.removeAttribute('aria-activedescendant');
    };
    const closePopup = (): void => {
      if (!opened) return;
      opened = false;
      popup.hidden = true;
      popup.remove();
      activeOption = -1;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      window.removeEventListener('scroll', positionPopup, true);
      window.removeEventListener('resize', positionPopup);
    };
    const pick = (value: string): void => {
      if (multiple) {
        if (!selected.includes(value)) selected = [...selected, value];
      } else selected = value ? [value] : [];
      closePopup();
      refreshValue();
      input.focus();
    };
    const showPopup = (): void => {
      shownOptions = multiple
        ? optionsList.filter((value) => !selected.some((chosen) => chosen.toLowerCase() === value.toLowerCase()))
        : ['', ...optionsList];
      if (shownOptions.length === 0) return;
      activeOption = -1;
      optionNodes = shownOptions.map((value, index) => {
        const option = element('div', 'atlas-sb-pane-option', value || '—');
        option.id = `${editorOwner}-${part.key}-${index}`;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', 'false');
        option.addEventListener('mouseenter', () => {
          activeOption = index;
          updateActive();
        });
        option.addEventListener('mousedown', (event) => event.preventDefault());
        option.addEventListener('click', () => pick(value));
        return option;
      });
      popup.replaceChildren(...optionNodes);
      popup.hidden = false;
      document.body.append(popup);
      opened = true;
      input.setAttribute('aria-expanded', 'true');
      positionPopup();
      window.addEventListener('scroll', positionPopup, true);
      window.addEventListener('resize', positionPopup);
    };
    const togglePopup = (): void => { if (opened) closePopup(); else showPopup(); };
    const onPickerKeyDown = (event: KeyboardEvent): void => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        if (!opened) {
          showPopup();
          activeOption = event.key === 'ArrowDown' ? 0 : shownOptions.length - 1;
        } else {
          const step = event.key === 'ArrowDown' ? 1 : -1;
          activeOption = Math.max(0, Math.min(shownOptions.length - 1, activeOption < 0 ? (step > 0 ? 0 : shownOptions.length - 1) : activeOption + step));
        }
        updateActive();
        return;
      }
      if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        event.stopPropagation();
        togglePopup();
        return;
      }
      if (event.key === 'Escape' && opened) {
        event.preventDefault();
        event.stopPropagation();
        closePopup();
        return;
      }
      if (event.key === 'Enter' && opened && shownOptions[activeOption] !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        pick(shownOptions[activeOption]);
        return;
      }
      if (multiple && event.key === 'Backspace' && selected.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        selected = selected.slice(0, -1);
        refreshValue();
      }
    };
    input.addEventListener('keydown', onPickerKeyDown);
    input.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      input.focus();
      togglePopup();
    });
    fieldControl.addEventListener('mousedown', (event) => {
      if (event.button !== 0 || (event.target instanceof Element && event.target.closest('input, button'))) return;
      event.preventDefault();
      input.focus();
      showPopup();
    });
    input.addEventListener('blur', closePopup);
    const destroy = (): void => {
      closePopup();
      input.removeEventListener('keydown', onPickerKeyDown);
    };
    choicePickerCleanups.push(destroy);
    refreshValue();
    controls.set(part.key, { focus: input, read: valueText });
  };

  for (const part of parts) {
    if (part.type === 'counter') {
      const wrap = element('span', 'atlas-sb-pane-entry__part atlas-sb-pane-entry__counter-part');
      wrap.dataset.entryPart = 'extra';
      wrap.dataset.entryExtra = part.key;
      wrap.append(element('span', 'atlas-sb-entry-extra-label', part.label));
      const maximum = element('input', 'atlas-sb-pane-input atlas-sb-pane-entry__control');
      maximum.type = 'number';
      maximum.min = '1';
      maximum.max = '12';
      maximum.step = '1';
      maximum.value = String(draft.counterMaxes[part.key] ?? part.max ?? 3);
      maximum.dataset.entryControl = 'true';
      maximum.setAttribute('aria-label', language === 'pt-BR' ? `Máximo de ${part.label}` : `${part.label} maximum`);
      const marks = element('span', 'atlas-sb-pane-entry__counter-marks');
      const markInputs: HTMLInputElement[] = [];
      const initialMarks = draft.counterMarks[part.key] ?? [];
      for (let index = 0; index < 12; index += 1) {
        const mark = element('input');
        mark.type = 'checkbox';
        mark.checked = initialMarks[index] === true;
        mark.disabled = index >= Number(maximum.value);
        mark.dataset.entryControl = 'true';
        mark.setAttribute('aria-label', `${part.label}: ${index + 1}`);
        markInputs.push(mark);
        marks.append(mark);
      }
      maximum.addEventListener('input', () => {
        const max = Math.max(1, Math.min(12, Math.floor(Number(maximum.value) || 1)));
        markInputs.forEach((mark, index) => {
          mark.disabled = index >= max;
          if (mark.disabled) mark.checked = false;
        });
      });
      wrap.append(maximum, marks);
      extrasWrap.append(wrap);
      counterControls.set(part.key, { max: maximum, marks: markInputs });
      controls.set(part.key, { focus: maximum, read: () => maximum.value });
      continue;
    }
    if (part.type === 'choice') addChoicePart(part);
    else addSimplePart(part);
  }
  if (parts.length > 0) root.append(extrasWrap);

  const description = element('span', 'atlas-sb-pane-entry__text');
  description.contentEditable = 'plaintext-only';
  description.dataset.entryPart = 'text';
  description.setAttribute('role', 'textbox');
  description.setAttribute('aria-multiline', 'true');
  description.setAttribute('aria-label', language === 'pt-BR' ? `Descrição de ${noun.toLowerCase()}` : `${noun} description`);
  description.dataset.placeholder = language === 'pt-BR' ? 'O que faz?' : 'What it does';
  description.tabIndex = 0;
  description.textContent = draft.text;
  root.append(description);

  const error = element('span', 'statblock-forge__inline-field-editor-error');
  error.hidden = true;
  root.append(error);
  row.classList.add('is-editing');
  row.dataset.entryEditing = 'true';
  const dragHandle = row.querySelector<HTMLElement>(':scope > .statblock-forge__entry-drag-handle');
  row.replaceChildren(root);
  if (dragHandle) row.append(dragHandle);

  let finished = false;
  let saving = false;
  let commitTask: Promise<void> | null = null;
  let currentRaw = rawEntry;
  const readDraft = (): InlineEntryDraft => ({
    name: name.value,
    text: (description.textContent ?? '').replace(/\r/g, ''),
    parts: Object.fromEntries([...controls].map(([key, control]) => [key, control.read()])),
    counterMarks: Object.fromEntries([...counterControls].map(([key, value]) => [key, value.marks.map((mark) => mark.checked)])),
    counterMaxes: Object.fromEntries([...counterControls].map(([key, value]) => [key, Math.max(1, Math.min(12, Math.floor(Number(value.max.value) || 1)))])),
  });
  const cleanup = (): void => {
    document.removeEventListener('pointerdown', onDocumentPointerDown, true);
    choicePickerCleanups.forEach((dispose) => dispose());
    choicePickerCleanups.length = 0;
    inlineEntryEditorSessions.delete(root);
    row.classList.remove('is-editing');
    delete row.dataset.entryEditing;
    host.closed(row);
  };
  const restore = (): void => {
    if (finished) return;
    finished = true;
    cleanup();
    host.renderCancelled(row, currentRaw, rowIndex, isNew);
  };
  const showError = (caught: unknown): void => {
    error.textContent = caught instanceof Error ? caught.message : String(caught);
    error.hidden = false;
  };
  const removeBlank = async (): Promise<void> => {
    if (isNew) {
      finished = true;
      cleanup();
      host.removeRow(row, -1);
      return;
    }
    const next = removeInlineEntryValue(sample[field.key], rowIndex);
    await runtime.setBaseValue(field.key, next);
    finished = true;
    cleanup();
    host.removeRow(row, rowIndex);
  };
  const persist = async (keepOpen = false): Promise<{ entry: unknown; index: number } | null> => {
    if (saving || finished) return null;
    saving = true;
    error.hidden = true;
    try {
      const nextDraft = readDraft();
      if (!nextDraft.name.trim() && !nextDraft.text.trim()) {
        if (keepOpen) return null;
        await removeBlank();
        return null;
      }
      if (!isNew && JSON.stringify(nextDraft) === JSON.stringify(draft)) {
        if (!keepOpen) {
          finished = true;
          cleanup();
          host.renderSaved(row, currentRaw, rowIndex);
        }
        return { entry: currentRaw, index: rowIndex };
      }
      let nextRows: unknown[];
      let savedIndex: number;
      if (isNew && rowIndex < 0) {
        nextRows = insertInlineEntryValue(sample[field.key], field, afterIndex, nextDraft);
        savedIndex = afterIndex === null ? 0 : Math.max(0, Math.min((Array.isArray(sample[field.key]) ? sample[field.key] as unknown[] : []).length, afterIndex + 1));
      } else {
        nextRows = updateInlineEntriesValue(sample[field.key], field, rowIndex, nextDraft);
        savedIndex = rowIndex;
      }
      await runtime.setBaseValue(field.key, nextRows);
      const saved = nextRows[savedIndex];
      if (!isRecord(saved)) throw new Error('A habilidade salva possui um formato inválido.');
      rowIndex = savedIndex;
      afterIndex = savedIndex - 1;
      currentRaw = saved;
      if (!keepOpen) {
        finished = true;
        cleanup();
        host.renderSaved(row, saved, savedIndex);
      }
      return { entry: saved, index: savedIndex };
    } catch (caught) {
      showError(caught);
      throw caught;
    } finally {
      saving = false;
    }
  };
  const commit = (startNext = false): Promise<void> => {
    if (finished) return Promise.resolve();
    if (commitTask) return commitTask;
    commitTask = (async () => {
      try {
        const saved = await persist(false);
        if (saved && startNext) host.startNext(saved.index);
      } catch {
        // Keep the editor open so a failed write can be corrected and retried.
      }
    })().finally(() => { commitTask = null; });
    return commitTask;
  };
  const focusAfter = (from: HTMLElement): void => {
    const focusables = Array.from(root.querySelectorAll<HTMLElement>('[data-entry-control="true"]'))
      .filter((candidate) => !candidate.hasAttribute('disabled'));
    let next: HTMLElement | undefined;
    if (from === name) next = focusables[0];
    else {
      const index = focusables.indexOf(from);
      next = index >= 0 ? focusables[index + 1] : undefined;
    }
    (next ?? description).focus();
  };
  const moveEntry = async (from: number, to: number, draggedRow: HTMLElement): Promise<boolean> => {
    if (finished || saving || from < 0 || to < 0) return false;
    try {
      // As in Atlas, the text currently being typed is written before the move,
      // but the editor stays mounted and keeps its caret throughout the drag.
      const saved = await persist(true);
      if (!saved) return false;
      const currentValue = sample[field.key];
      const rows = Array.isArray(currentValue)
        ? currentValue as unknown[]
        : currentValue === undefined || currentValue === null || currentValue === '' ? [] : [currentValue];
      if (from >= rows.length || to >= rows.length || from === to) return false;
      const moved = moveInlineEntryValue(rows, from, to);
      await runtime.setBaseValue(field.key, moved);
      const active = root.contains(document.activeElement) && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      const selection = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
        ? [active.selectionStart, active.selectionEnd] as const
        : null;
      const textSelection = active === description && window.getSelection()?.rangeCount
        ? window.getSelection()?.getRangeAt(0).cloneRange() ?? null
        : null;
      rowIndex = inlineEntryIndexAfterMove(rowIndex, from, to);
      afterIndex = rowIndex - 1;
      host.moveRow(draggedRow, from, to);
      if (active?.isConnected) {
        active.focus();
        if (selection && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) {
          active.setSelectionRange(selection[0], selection[1]);
        } else if (textSelection) {
          const currentSelection = window.getSelection();
          currentSelection?.removeAllRanges();
          currentSelection?.addRange(textSelection);
        }
      }
      return true;
    } catch {
      // Keep current focus and draft after a failed write.
      return false;
    }
  };
  const saveAndMove = async (direction: -1 | 1): Promise<void> => {
    if (rowIndex < 0) return;
    const currentValue = sample[field.key];
    const rows = Array.isArray(currentValue)
      ? currentValue as unknown[]
      : currentValue === undefined || currentValue === null || currentValue === '' ? [] : [currentValue];
    const nextIndex = Math.max(0, Math.min(rows.length - 1, rowIndex + direction));
    if (nextIndex === rowIndex) return;
    await moveEntry(rowIndex, nextIndex, row);
  };
  const duplicate = async (): Promise<void> => {
    if (isNew || rowIndex < 0 || finished || saving) return;
    try {
      const saved = await persist(true);
      if (!saved) return;
      const nextRows = insertInlineEntryValue(sample[field.key], field, rowIndex, readDraft());
      await runtime.setBaseValue(field.key, nextRows);
      finished = true;
      cleanup();
      host.renderSaved(row, saved.entry, rowIndex);
      host.startDuplicate(rowIndex + 1);
    } catch {
      // Keep the editor open after an unsuccessful duplicate.
    }
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;
    const inName = target === name;
    const inText = target === description;
    const inControl = target.dataset.entryControl === 'true';
    if (event.key === 'Escape') {
      event.preventDefault();
      restore();
      return;
    }
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      void saveAndMove(event.key === 'ArrowUp' ? -1 : 1);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      void duplicate();
      return;
    }
    const modEnter = event.key === 'Enter' && (event.ctrlKey || event.metaKey);
    const partControl = inControl && target.tagName !== 'SELECT';
    if (event.isComposing) return;
    if (event.key === 'Enter' && (inName || partControl) && !modEnter) {
      event.preventDefault();
      focusAfter(target);
      return;
    }
    if (modEnter || (event.key === 'Enter' && inText && !event.shiftKey)) {
      event.preventDefault();
      void commit(true);
      return;
    }
    if (event.key === 'Enter' && inText && event.shiftKey) {
      event.preventDefault();
      insertEntryTextAtCaret(description, '\n');
      return;
    }
    if (event.key === 'Backspace' && (inName || inText) && !name.value.trim() && !description.innerText.trim()) {
      event.preventDefault();
      if (!event.repeat) void removeBlank().catch(showError);
    }
  };
  root.addEventListener('keydown', onKeyDown);
  const commitForNavigation = async (): Promise<boolean> => {
    await commit(false);
    return !root.isConnected;
  };
  inlineEntryEditorSessions.set(root, { commit: commitForNavigation, moveEntry });
  root.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('input, textarea, button, select, a, [contenteditable], [tabindex], [role="option"]')) {
      event.preventDefault();
    }
  });
  root.addEventListener('focusout', (event) => {
    const related = event.relatedTarget;
    if (related instanceof Node && root.contains(related)) return;
    void commit(false);
  });
  const onDocumentPointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (target instanceof Node && row.contains(target)) return;
    if (target instanceof Element && target.closest(`[data-entry-editor-owner="${editorOwner}"]`)) return;
    void commit(false);
  };
  document.addEventListener('pointerdown', onDocumentPointerDown, true);

  const focus = options.focus ?? { kind: 'name' as const };
  if (focus.kind === 'text') {
    description.focus();
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(description);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  } else if (focus.kind === 'extra' && focus.key) {
    (controls.get(focus.key)?.focus ?? name).focus();
  } else {
    name.focus();
    name.setSelectionRange(name.value.length, name.value.length);
  }
  return { commit: commitForNavigation, moveEntry };
}

function renderEntries(
  block: ForgeBlock,
  field: ForgeField | undefined,
  sample: JsonRecord,
  layout: ForgeLayoutDocument,
  interactiveCounters = false,
  insideTab = false,
  onAbilityCounterMaxChange?: (fieldKey: string, entryIndex: number) => void,
  numericRuntime?: NumericFieldRuntime,
  language: ForgeLanguage = 'en',
): HTMLElement {
  const wrapper = element('div', 'statblock-forge__preview-entries');
  if (field?.key) {
    wrapper.dataset.forgeEntryField = field.key;
    wrapper.tabIndex = -1;
  }
  const heading = visibleFieldBlockLabel(block, block.heading, field, block.field, !insideTab, false);
  if (heading) wrapper.append(element('strong', 'statblock-forge__preview-block-heading', heading));
  const entries = valueOf(sample, block.field);
  const rows = Array.isArray(entries)
    ? entries
    : entries === undefined || entries === null || entries === '' ? [] : [entries];
  const parts = field ? abilityPartsForField(field) : [];
  const empty = markForgeUiText(element('span', 'statblock-forge__hint', language === 'pt-BR' ? 'Nenhuma habilidade de exemplo.' : 'No example entries.'), 'Nenhuma habilidade de exemplo.');
  empty.hidden = rows.length > 0;
  wrapper.append(empty);
  const rowsContainer = element('div', 'statblock-forge__preview-entry-list');
  wrapper.append(rowsContainer);

  const renderDisplay = (rawEntry: unknown, entryIndex: number): HTMLElement => {
    const record = object(rawEntry);
    const valueDraft = inlineEntryDraftValue(field ?? ({ key: String(block.field), label: '', type: 'entries' } as ForgeField), rawEntry);
    const display = element('div', 'statblock-forge__preview-entry-content');
    // Roll metadata is attached to the whole Ability entry so every dice link
    // created below is reported to Atlas with the correct ability name.
    if (valueDraft.name.trim()) display.dataset.rollName = valueDraft.name.trim();
    if (valueDraft.name) {
      const name = element('strong', 'statblock-forge__preview-entry-name', valueDraft.name);
      name.dataset.entryPart = 'name';
      display.append(name);
    }
    if (valueDraft.text) {
      const desc = element('span', 'statblock-forge__preview-entry-description');
      desc.dataset.entryPart = 'text';
      applyTextWithBasicMarkdown(desc, valueDraft.text);
      // Ability descriptions support the same Atlas dice notation as other
      // statblock text. Link after Markdown parsing so emphasis/code wrappers
      // are preserved and each rendered text segment remains independently clickable.
      linkForgeStatblockDice(desc);
      display.append(desc);
    }
    const extras = element('span', 'statblock-forge__preview-parts');
    for (const part of parts) {
      if (part.type === 'counter') {
        renderEntryCounter(
          extras, part, record, layout, field?.key ?? String(block.field), entryIndex, interactiveCounters,
          onAbilityCounterMaxChange, numericRuntime,
        );
        continue;
      }
      const value = readablePreviewValue(record[part.key]);
      if (!value) continue;
      const item = element('span', 'statblock-forge__preview-entry-part');
      item.dataset.entryExtra = part.key;
      item.append(element('span', 'statblock-forge__preview-entry-part-label', `${part.label}:`));
      const partValue = element('span', 'statblock-forge__preview-entry-part-value', value);
      // Scan every visible Ability Part value, regardless of its schema type:
      // Dice formulas and explicit signed bonuses (e.g. 2d8+3 or +5) become
      // links. Plain unsigned numbers stay ordinary values, like other Fields.
      // Re-run this after every inline-editor redraw so newly saved values link too.
      linkForgeStatblockDice(partValue);
      item.append(partValue);
      extras.append(item);
    }
    if (extras.childElementCount > 0) display.append(extras);
    if (!display.childElementCount) display.append(element('span', 'statblock-forge__hint', '—'));
    return display;
  };

  const allRows = (): HTMLElement[] => Array.from(rowsContainer.querySelectorAll<HTMLElement>(':scope > .statblock-forge__preview-entry'));
  const updateIndexes = (): void => allRows().forEach((candidate, index) => {
    candidate.dataset.entryIndex = String(index);
    candidate.dataset.itemIndex = String(index);
    candidate.dataset.itemKey = `entry-${index}`;
    candidate.tabIndex = 0;
  });
  const renderSaved = (row: HTMLElement, entry: unknown, index: number): void => {
    row.classList.remove('is-new');
    const handle = row.querySelector<HTMLElement>(':scope > .statblock-forge__entry-drag-handle');
    row.replaceChildren(renderDisplay(entry, index));
    if (handle) row.append(handle);
    row.dataset.entryIndex = String(index);
    row.tabIndex = 0;
    empty.hidden = rowsContainer.childElementCount > 0;
  };
  const renderCancelled = (row: HTMLElement, entry: unknown, index: number, newRow: boolean): void => {
    if (newRow) {
      row.remove();
      updateIndexes();
      empty.hidden = rowsContainer.childElementCount > 0;
      return;
    }
    renderSaved(row, entry, index);
  };

  let openRowEditor: (row: HTMLElement, index: number, target?: EntryEditorFocus, newRow?: boolean, after?: number | null) => void;
  let activeRow: HTMLElement | null = null;
  let activeCommit: InlineEntryEditorSession | null = null;
  const startEntryDrag = (row: HTMLElement, handle: HTMLButtonElement, startEvent: PointerEvent): void => {
    if (!numericRuntime?.canEdit || startEvent.button !== 0 || startEvent.isPrimary === false) return;
    startEvent.preventDefault();
    startEvent.stopPropagation();
    const pointerId = startEvent.pointerId;
    const startX = startEvent.clientX;
    const startY = startEvent.clientY;
    const sourceRect = row.getBoundingClientRect();
    let started = false;
    let destination = Number(row.dataset.entryIndex ?? 0);
    let layer: HTMLElement | null = null;
    let ghost: HTMLElement | null = null;
    let line: HTMLElement | null = null;
    let targetRow: HTMLElement | null = null;
    let crossTargetEntries: HTMLElement | null = null;
    let crossTargetFieldKey: string | null = null;
    let crossDestination = 0;
    let hoverTabButton: HTMLButtonElement | null = null;
    let hoverTimer: number | null = null;
    const abilitiesTabs = row.closest<HTMLElement>('.statblock-forge__preview-tabs[data-forge-abilities-tabs="true"]');
    const sourcePanelId = row.closest<HTMLElement>('.statblock-forge__preview-tab-panel')?.dataset.tabPanelId ?? '';
    // The Entries wrapper is the visible scroll viewport; rowsContainer may be
    // taller than it when the block contains more abilities than can fit.
    const listRect = (): DOMRect => wrapper.getBoundingClientRect();
    const rowsInEntries = (entriesRoot: HTMLElement): HTMLElement[] =>
      Array.from(entriesRoot.querySelectorAll<HTMLElement>('.statblock-forge__preview-entry'))
        .filter((candidate) => candidate.closest('.statblock-forge__preview-entries') === entriesRoot);
    const clearRowMarkers = (entriesRoot: HTMLElement): void => {
      for (const candidate of rowsInEntries(entriesRoot)) candidate.classList.remove('is-drop-before', 'is-drop-after');
    };
    const clearTargets = (): void => {
      clearRowMarkers(wrapper);
      if (crossTargetEntries) {
        clearRowMarkers(crossTargetEntries);
        crossTargetEntries.classList.remove('is-ability-drop-target');
      }
      crossTargetEntries = null;
      crossTargetFieldKey = null;
      targetRow = null;
    };
    const clearHover = (): void => {
      if (hoverTimer !== null) window.clearTimeout(hoverTimer);
      hoverTimer = null;
      hoverTabButton?.classList.remove('is-drop-hover');
      hoverTabButton = null;
    };
    const tabPanelFor = (tabId: string): HTMLElement | null => {
      if (!abilitiesTabs) return null;
      return Array.from(abilitiesTabs.querySelectorAll<HTMLElement>('.statblock-forge__preview-tab-panel'))
        .find((panel) => panel.dataset.tabPanelId === tabId) ?? null;
    };
    const entriesForTab = (tabId: string): HTMLElement | null =>
      tabPanelFor(tabId)?.querySelector<HTMLElement>('.statblock-forge__preview-entries[data-forge-entry-field]') ?? null;
    const setCrossDestination = (entriesRoot: HTMLElement, pointerY: number): void => {
      const targetKey = entriesRoot.dataset.forgeEntryField ?? '';
      if (!targetKey || targetKey === field?.key || !entriesRoot.isConnected) return;
      if (crossTargetEntries !== entriesRoot) clearTargets();
      crossTargetEntries = entriesRoot;
      crossTargetFieldKey = targetKey;
      entriesRoot.classList.add('is-ability-drop-target');
      const candidates = rowsInEntries(entriesRoot);
      const rects = candidates.map((candidate) => candidate.getBoundingClientRect());
      const bounds = entriesRoot.getBoundingClientRect();
      const clampedY = Math.max(bounds.top, Math.min(bounds.bottom, pointerY));
      crossDestination = inlineEntryDropIndex(rects.map((rect) => ({ top: rect.top, bottom: rect.bottom, left: rect.left })), clampedY);
      clearRowMarkers(entriesRoot);
      targetRow = null;
      if (crossDestination < candidates.length) {
        targetRow = candidates[crossDestination] ?? null;
        targetRow?.classList.add('is-drop-before');
      } else if (candidates.length > 0) {
        targetRow = candidates[candidates.length - 1] ?? null;
        targetRow?.classList.add('is-drop-after');
      }
      if (line) {
        const lineY = crossDestination < rects.length
          ? (rects[crossDestination]?.top ?? bounds.bottom)
          : (rects[rects.length - 1]?.bottom ?? bounds.top + 4);
        line.setCssStyles({ left: `${bounds.left}px` });
        line.setCssStyles({ top: `${lineY - 1}px` });
        line.setCssStyles({ width: `${bounds.width}px` });
        line.setCssStyles({ height: '2px' });
      }
    };
    /**
     * Re-resolve the final target on pointerup. Pointer movement is not
     * guaranteed to fire for the last coordinate before release (especially
     * when releasing over a tab button), so relying only on pointermove can
     * lose a valid cross-tab destination or keep a stale one.
     */
    const resolveCrossDestinationAtPoint = (clientX: number, clientY: number): void => {
      if (!abilitiesTabs || !sourcePanelId || !field) {
        clearTargets();
        return;
      }
      const pointTarget = document.elementFromPoint(clientX, clientY);
      if (!(pointTarget instanceof Element)) {
        clearTargets();
        return;
      }
      const targetEntries = pointTarget.closest<HTMLElement>(
        '.statblock-forge__preview-entries[data-forge-entry-field]',
      );
      if (targetEntries && abilitiesTabs.contains(targetEntries)) {
        const targetKey = targetEntries.dataset.forgeEntryField ?? '';
        if (targetKey && targetKey !== field.key) {
          setCrossDestination(targetEntries, clientY);
          return;
        }
        clearTargets();
        return;
      }

      const tabButton = pointTarget.closest<HTMLButtonElement>(
        '.statblock-forge__preview-tab[data-tab-block-id]',
      );
      const targetPanel = pointTarget.closest<HTMLElement>('.statblock-forge__preview-tab-panel');
      const targetTabId = tabButton?.dataset.tabBlockId
        ?? targetPanel?.dataset.tabPanelId
        ?? '';
      if (!targetTabId || targetTabId === sourcePanelId) {
        clearTargets();
        return;
      }
      const targetEntriesRoot = entriesForTab(targetTabId);
      if (!targetEntriesRoot || !abilitiesTabs.contains(targetEntriesRoot)) {
        clearTargets();
        return;
      }
      const targetTabButton = tabButton ?? Array.from(
        abilitiesTabs.querySelectorAll<HTMLButtonElement>('.statblock-forge__preview-tab[data-tab-block-id]'),
      ).find((candidate) => candidate.dataset.tabBlockId === targetTabId) ?? null;
      const targetTabPanel = tabPanelFor(targetTabId);
      if (targetTabPanel?.hidden && targetTabButton) {
        targetTabButton.dataset.forgeDragActivate = 'true';
        targetTabButton.click();
      }
      // Releasing on the tab strip or panel padding means append to that tab.
      setCrossDestination(targetEntriesRoot, targetEntriesRoot.getBoundingClientRect().bottom);
    };

    const removeVisuals = (): void => {
      row.classList.remove('is-dragging');
      row.removeAttribute('data-sb-dragging');
      clearHover();
      clearTargets();
      layer?.remove();
      layer = null;
      ghost = null;
      line = null;
      document.body.classList.remove('statblock-forge__entry-dragging');
    };
    const createVisuals = (): void => {
      started = true;
      row.classList.add('is-dragging');
      row.setAttribute('data-sb-dragging', '');
      document.body.classList.add('statblock-forge__entry-dragging');
      layer = element('div', 'atlas-list-drag-layer statblock-forge__entry-drag-layer');
      layer.setCssStyles({ position: 'fixed' });
      layer.setCssStyles({ inset: '0' });
      layer.setCssStyles({ zIndex: '10000' });
      layer.setCssStyles({ pointerEvents: 'none' });
      ghost = row.cloneNode(true) as HTMLElement;
      ghost.querySelector('.statblock-forge__entry-drag-handle')?.remove();
      ghost.classList.remove('is-dragging', 'is-drop-before', 'is-drop-after');
      ghost.removeAttribute('data-sb-dragging');
      ghost.removeAttribute('data-entry-index');
      ghost.setCssStyles({ position: 'fixed' });
      ghost.setCssStyles({ left: `${sourceRect.left}px` });
      ghost.setCssStyles({ top: `${sourceRect.top}px` });
      ghost.setCssStyles({ width: `${sourceRect.width}px` });
      ghost.setCssStyles({ boxSizing: 'border-box' });
      ghost.setCssStyles({ margin: '0' });
      ghost.setCssStyles({ opacity: '1' });
      ghost.setCssStyles({ pointerEvents: 'none' });
      ghost.setCssStyles({ background: 'var(--background-primary)' });
      ghost.setCssStyles({ borderRadius: 'var(--radius-m)' });
      ghost.setCssStyles({ boxShadow: 'var(--shadow-l)' });
      ghost.setCssStyles({ padding: '0.3rem 0.45rem' });
      ghost.setCssStyles({ zIndex: '1' });
      const sourceControls = row.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select');
      const ghostControls = ghost.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select');
      sourceControls.forEach((control, index) => {
        const copy = ghostControls[index];
        if (!copy) return;
        if (control instanceof HTMLInputElement && copy instanceof HTMLInputElement) {
          copy.value = control.value;
          copy.checked = control.checked;
        } else copy.value = control.value;
      });
      const sourceEditable = row.querySelector<HTMLElement>('[contenteditable="true"]');
      const ghostEditable = ghost.querySelector<HTMLElement>('[contenteditable="true"]');
      if (sourceEditable && ghostEditable) ghostEditable.textContent = sourceEditable.textContent;
      line = element('div', 'atlas-list-drag-line statblock-forge__entry-drop-line');
      line.setCssStyles({ position: 'absolute' });
      line.setCssStyles({ background: 'var(--interactive-accent)' });
      line.setCssStyles({ borderRadius: '999px' });
      layer.append(ghost, line);
      document.body.append(layer);
    };
    const onMove = (event: PointerEvent): void => {
      if (event.pointerId !== pointerId) return;
      const distance = Math.hypot(event.clientX - startX, event.clientY - startY);
      if (!started && distance < 5) return;
      if (!started) createVisuals();
      event.preventDefault();
      const pointTarget = document.elementFromPoint(event.clientX, event.clientY);
      const hoveredTab = abilitiesTabs && pointTarget instanceof Element
        ? pointTarget.closest<HTMLButtonElement>('.statblock-forge__preview-tab[data-tab-block-id]')
        : null;
      const hoveredTabId = hoveredTab && abilitiesTabs?.contains(hoveredTab) ? hoveredTab.dataset.tabBlockId ?? '' : '';

      // Hovering another Ability tab opens it after a short dwell, just like
      // desktop file managers. A quick pass across the tab strip does nothing.
      if (hoveredTab && hoveredTabId && hoveredTabId !== sourcePanelId) {
        if (hoverTabButton !== hoveredTab) {
          clearHover();
          hoverTabButton = hoveredTab;
          hoverTabButton.classList.add('is-drop-hover');
          hoverTimer = window.setTimeout(() => {
            if (!started || hoverTabButton !== hoveredTab) return;
            hoverTimer = null;
            hoveredTab.classList.remove('is-drop-hover');
            // Activate through the tab's own handler but keep this synthetic
            // drag activation from bubbling into the template Canvas selector,
            // which would rebuild the card in the middle of the drag gesture.
            hoveredTab.dataset.forgeDragActivate = 'true';
            hoveredTab.click();
            const targetEntries = entriesForTab(hoveredTabId);
            if (targetEntries) setCrossDestination(targetEntries, targetEntries.getBoundingClientRect().bottom);
          }, 520);
        }
      } else if (!hoveredTab || hoveredTabId === sourcePanelId) {
        clearHover();
      }

      const targetEntries = abilitiesTabs && pointTarget instanceof Element
        ? pointTarget.closest<HTMLElement>('.statblock-forge__preview-entries[data-forge-entry-field]')
        : null;
      const targetBelongsToGroup = Boolean(targetEntries && abilitiesTabs?.contains(targetEntries));
      const targetFieldKey = targetBelongsToGroup ? targetEntries?.dataset.forgeEntryField ?? '' : '';
      if (targetEntries && targetFieldKey && targetFieldKey !== field?.key) {
        setCrossDestination(targetEntries, event.clientY);
      } else if (hoveredTab && hoveredTabId !== sourcePanelId && hoverTimer === null && crossTargetEntries?.isConnected) {
        // Keep an append destination while the pointer remains on the opened
        // tab button; users can then move down into the panel for exact placement.
        setCrossDestination(crossTargetEntries, crossTargetEntries.getBoundingClientRect().bottom);
      } else if (!abilitiesTabs || !abilitiesTabs.contains(pointTarget as Node)) {
        clearTargets();
      } else if (!targetEntries && !(hoveredTab && hoveredTabId !== sourcePanelId && hoverTimer === null)) {
        clearTargets();
      } else if (targetEntries && targetFieldKey === field?.key) {
        clearTargets();
      }

      if (crossTargetFieldKey && crossTargetEntries?.isConnected) {
        const targetBounds = crossTargetEntries.getBoundingClientRect();
        if (event.clientY < targetBounds.top + 22) {
          const scrollHost = crossTargetEntries.querySelector<HTMLElement>('.statblock-forge__preview-entry-list');
          if (scrollHost) scrollHost.scrollTop -= 4;
        } else if (event.clientY > targetBounds.bottom - 22) {
          const scrollHost = crossTargetEntries.querySelector<HTMLElement>('.statblock-forge__preview-entry-list');
          if (scrollHost) scrollHost.scrollTop += 4;
        }
      } else {
        const bounds = listRect();
        // Scroll the source Entries viewport while dragging near its edges.
        const edgeSize = Math.min(34, Math.max(18, bounds.height * 0.16));
        if (event.clientY < bounds.top + edgeSize) {
          const edgeDistance = bounds.top + edgeSize - event.clientY;
          wrapper.scrollTop -= Math.max(2, Math.ceil(edgeDistance / 3));
        } else if (event.clientY > bounds.bottom - edgeSize) {
          const edgeDistance = event.clientY - (bounds.bottom - edgeSize);
          wrapper.scrollTop += Math.max(2, Math.ceil(edgeDistance / 3));
        }
        const clampedY = Math.max(bounds.top, Math.min(bounds.bottom, event.clientY));
        const top = Math.max(bounds.top, Math.min(bounds.bottom - sourceRect.height, clampedY - (startY - sourceRect.top)));
        if (ghost) ghost.setCssStyles({ top: `${top}px` });
        const remaining = allRows().filter((candidate) => candidate !== row);
        const rects = remaining.map((candidate) => candidate.getBoundingClientRect());
        destination = inlineEntryDropIndex(rects.map((rect) => ({ top: rect.top, bottom: rect.bottom, left: rect.left })), clampedY);
        clearRowMarkers(wrapper);
        targetRow = null;
        if (destination < remaining.length) {
          targetRow = remaining[destination] ?? null;
          targetRow?.classList.add('is-drop-before');
        } else if (remaining.length > 0) {
          targetRow = remaining[remaining.length - 1] ?? null;
          targetRow?.classList.add('is-drop-after');
        }
        if (line) {
          const lineY = destination < rects.length
            ? (rects[destination]?.top ?? bounds.bottom)
            : (rects[rects.length - 1]?.bottom ?? bounds.top);
          line.setCssStyles({ left: `${bounds.left}px` });
          line.setCssStyles({ top: `${lineY - 1}px` });
          line.setCssStyles({ width: `${bounds.width}px` });
          line.setCssStyles({ height: '2px' });
        }
      }
    };
    const settle = (drop: boolean): void => {
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', onUp, true);
      document.removeEventListener('pointercancel', onCancel, true);
      document.removeEventListener('keydown', onEscape, true);
      const didStart = started;
      const destinationFieldKey = crossTargetFieldKey;
      const destinationEntries = crossTargetEntries;
      const destinationIndex = crossDestination;
      removeVisuals();
      if (!drop || !didStart || !field || !numericRuntime) return;

      if (destinationFieldKey && destinationFieldKey !== field.key && destinationEntries?.isConnected) {
        void (async () => {
          // Finish any inline edit before reading either Field's current value.
          if (activeCommit) await activeCommit.commit();
          const currentIndex = allRows().indexOf(row);
          if (currentIndex < 0) return;
          const transfer = moveInlineEntryBetweenFields(
            sample[field.key], sample[destinationFieldKey], currentIndex, destinationIndex,
          );
          if (!transfer) return;
          try {
            await numericRuntime.setBaseValue(field.key, transfer.sourceAfter);
            try {
              await numericRuntime.setBaseValue(destinationFieldKey, transfer.destinationAfter);
            } catch (error) {
              // Keep the move atomic from the user's perspective if saving the
              // destination Field fails after the source was already updated.
              await numericRuntime.setBaseValue(field.key, transfer.sourceBefore).catch(() => undefined);
              throw error;
            }
            numericRuntime.refreshEntryList(field.key);
            numericRuntime.refreshEntryList(destinationFieldKey);
          } catch {
            // The existing inline editor reports persistence errors. Do not
            // leave either list visually half-updated when a save fails.
            numericRuntime.refreshEntryList(field.key);
            numericRuntime.refreshEntryList(destinationFieldKey);
          }
        })();
        return;
      }

      const currentIndex = allRows().indexOf(row);
      const rowsWithoutSource = allRows().filter((candidate) => candidate !== row);
      const to = Math.max(0, Math.min(rowsWithoutSource.length, destination));
      if (currentIndex < 0 || currentIndex === to || to >= allRows().length) return;
      if (activeCommit) {
        void activeCommit.moveEntry(currentIndex, to, row);
      } else {
        const nextRows = moveInlineEntryValue(sample[field.key], currentIndex, to);
        void numericRuntime.setBaseValue(field.key, nextRows).then(() => host.moveRow(row, currentIndex, to)).catch(() => undefined);
      }
    };
    const onUp = (event: PointerEvent): void => {
      if (event.pointerId !== pointerId) return;
      event.preventDefault();
      resolveCrossDestinationAtPoint(event.clientX, event.clientY);
      settle(true);
    };
    const onCancel = (event: PointerEvent): void => {
      if (event.pointerId !== pointerId) return;
      settle(false);
    };
    const onEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      settle(false);
    };
    document.addEventListener('pointermove', onMove, { capture: true, passive: false });
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onCancel, true);
    document.addEventListener('keydown', onEscape, true);
  };
  const makeRow = (rawEntry: unknown, entryIndex: number): HTMLElement => {
    const row = element('div', 'statblock-forge__preview-entry atlas-sb-trait');
    row.dataset.entryIndex = String(entryIndex);
    row.dataset.itemIndex = String(entryIndex);
    row.dataset.itemKey = `entry-${entryIndex}`;
    row.tabIndex = 0;
    row.dataset.itemIndex = String(entryIndex);
    row.append(renderDisplay(rawEntry, entryIndex));
    const handle = element('button', 'statblock-forge__entry-drag-handle atlas-sb-handle', '⋮⋮');
    handle.type = 'button';
    handle.tabIndex = -1;
    handle.dataset.glyph = 'grip';
    handle.dataset.atlasChrome = 'true';
    handle.dataset.noBlockEdit = 'true';
    handle.setAttribute('aria-label', language === 'pt-BR' ? 'Arrastar para reordenar ou mover para outra aba' : 'Drag to reorder or move to another tab');
    handle.title = language === 'pt-BR' ? 'Arrastar para reordenar ou mover para outra aba' : 'Drag to reorder or move to another tab';
    handle.addEventListener('pointerdown', (event) => startEntryDrag(row, handle, event));
    row.append(handle);
    row.addEventListener('click', (event) => {
      if (row.classList.contains('is-editing')) return;
      const target = event.target instanceof Element ? event.target : null;
      // Dice links inside an Ability description or Part are actions, not edit
      // targets. Let the statblock-level Dice Tool handler receive the click
      // without opening this Ability's inline editor first.
      if (target?.closest('button, input, textarea, select, a, [contenteditable="true"], .statblock-forge__dice-link, .atlas-dice-link')) return;
      const name = target?.closest<HTMLElement>('[data-entry-part="name"]');
      const text = target?.closest<HTMLElement>('[data-entry-part="text"]');
      const extra = target?.closest<HTMLElement>('[data-entry-extra]');
      const focus: EntryEditorFocus = name ? { kind: 'name' }
        : text ? { kind: 'text' }
          : extra ? { kind: 'extra', key: extra.dataset.entryExtra }
            : { kind: 'name' };
      openRowEditor(row, Number(row.dataset.entryIndex ?? entryIndex), focus);
    });
    row.addEventListener('keydown', (event) => {
      if (event.target !== row || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      openRowEditor(row, Number(row.dataset.entryIndex ?? entryIndex), { kind: 'name' });
    });
    return row;
  };

  const host: EntryEditorHost = {
    renderSaved,
    renderCancelled,
    removeRow(row, index) {
      row.remove();
      updateIndexes();
      empty.hidden = rowsContainer.childElementCount > 0;
      if (index > 0) {
        const previous = allRows()[Math.min(index - 1, allRows().length - 1)];
        if (previous) openRowEditor(previous, Number(previous.dataset.entryIndex ?? index - 1), { kind: 'text' });
      }
    },
    moveRow(row, from, to) {
      const current = allRows();
      const target = current[to];
      if (target && target !== row) rowsContainer.insertBefore(row, to > from ? target.nextSibling : target);
      updateIndexes();
    },
    startNext(afterIndex) {
      const next = createNewRow(afterIndex, null);
      if (next) openRowEditor(next, -1, { kind: 'name' }, true, afterIndex);
    },
    startDuplicate(afterIndex) {
      const value = Array.isArray(sample[field?.key ?? String(block.field)])
        ? (sample[field?.key ?? String(block.field)] as unknown[])[afterIndex]
        : undefined;
      if (value === undefined) return;
      const duplicate = makeRow(value, afterIndex);
      const following = allRows()[afterIndex + 1];
      rowsContainer.insertBefore(duplicate, following ?? null);
      updateIndexes();
      openRowEditor(duplicate, afterIndex, { kind: 'name' });
    },
    closed(row) {
      if (activeRow !== row) return;
      activeRow = null;
      activeCommit = null;
    },
  };

  openRowEditor = (row, index, focus = { kind: 'name' }, newRow = false, after = null) => {
    if (!field || !numericRuntime?.canEdit || row.classList.contains('is-editing')) return;
    const begin = (): void => {
      if (activeRow || row.classList.contains('is-editing') || !row.isConnected) return;
      const raw = newRow ? {} : (Array.isArray(sample[field.key]) ? (sample[field.key] as unknown[])[index] : undefined);
      activeRow = row;
      activeCommit = openInlineEntryEditor(row, field, raw, index, sample, numericRuntime, language, host, {
        isNew: newRow,
        afterIndex: after,
        focus,
      });
    };
    if (activeRow && activeRow !== row && activeCommit) {
      const finishActive = activeCommit;
      void finishActive.commit().then(() => { if (!activeRow) begin(); });
      return;
    }
    begin();
  };

  const createNewRow = (afterIndex: number, duplicate: unknown): HTMLElement | null => {
    if (!field || !numericRuntime?.canEdit) return null;
    const row = makeRow(duplicate ?? {}, -1);
    row.classList.add('is-new');
    const current = allRows();
    const following = current[afterIndex + 1];
    rowsContainer.insertBefore(row, following ?? null);
    updateIndexes();
    empty.hidden = true;
    return row;
  };

  rows.forEach((rawEntry, entryIndex) => rowsContainer.append(makeRow(rawEntry, entryIndex)));
  if (!rows.length) empty.hidden = false;
  if (field?.key && numericRuntime?.canEdit) {
    numericRuntime.registerEntryList(field.key, () => {
      if (!wrapper.isConnected) return;
      const latestRows = Array.isArray(sample[field.key]) ? sample[field.key] as unknown[] : [];
      rowsContainer.replaceChildren(...latestRows.map((entry, index) => makeRow(entry, index)));
      updateIndexes();
      empty.hidden = latestRows.length > 0;
    });
  }
  const actions = element('div', 'statblock-forge__entry-actions');
  if (field?.type === 'entries' && numericRuntime?.canEdit) {
    const add = element('button', 'statblock-forge__entry-action-button statblock-forge__entry-add-trigger', language === 'pt-BR' ? 'Personalizado' : 'Custom');
    add.type = 'button';
    add.dataset.noBlockEdit = 'true';
    add.title = language === 'pt-BR'
      ? 'Cria uma habilidade apenas neste statblock. Ela não será adicionada ao Compêndio.'
      : 'Creates an ability only in this statblock. It will not be added to the Compendium.';
    add.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const addNew = (): void => {
        const afterIndex = allRows().length - 1;
        const newRow = createNewRow(afterIndex, null);
        if (newRow) openRowEditor(newRow, -1, { kind: 'name' }, true, afterIndex < 0 ? null : afterIndex);
      };
      if (activeCommit) {
        const finishActive = activeCommit;
        void finishActive.commit().then(() => { if (!activeRow) addNew(); });
      } else addNew();
    });
    actions.append(add);
  }
  appendFieldCompendiumPicker(actions, field, layout, sample, numericRuntime, language);
  if (actions.childElementCount > 0) wrapper.append(actions);
  return wrapper;
}

function createInlinePairsFieldValue(
  field: ForgeField,
  sample: JsonRecord,
  runtime: NumericFieldRuntime | undefined,
  signed: boolean,
  display: HTMLElement,
  rollable = false,
): HTMLElement {
  display.classList.add('statblock-forge__preview-pair-list');
  const slot = createInlineEditSlot('div', 'statblock-forge__preview-inline-pairs-field', display, true);
  const redraw = (): void => {
    display.replaceChildren();
    const pairs = inlinePairsFromValue(sample[field.key]);
    if (pairs.length === 0) {
      const fallback = readablePreviewValue(sample[field.key]);
      if (fallback) display.textContent = fallback;
      else {
        const emptyText = runtime?.language === 'pt-BR' ? 'Nenhum par configurado. Clique para adicionar.' : 'No pairs configured. Click to add.';
        display.append(markForgeUiText(element('span', 'statblock-forge__hint', emptyText), emptyText));
      }
      return;
    }
    pairs.forEach((pair) => {
      const name = inlinePairName(pair.key);
      const value = inlinePairValueText(pair.value, signed);
      const item = element('span', 'statblock-forge__preview-pair');
      if (name) item.dataset.rollName = name;
      if (name) item.append(markInlineFieldNameForEdit(
        element('strong', 'statblock-forge__preview-pair-key', name), field, runtime, true,
      ));
      if (name && value) item.append(document.createTextNode(': '));
      if (value) {
        const valueNode = element('span', 'statblock-forge__preview-pair-value');
        // Explicit dice formulas are always links; `Roll as a bonus` additionally
        // turns signed whole-number values such as +5 into clickable rolls.
        appendForgeStatblockDiceText(valueNode, value, rollable);
        item.append(valueNode);
      }
      display.append(item);
    });
  };
  redraw();

  if (runtime?.canEdit) {
    registerInlineSlotEditor(slot.slot, field.key, () => {
      if (!display.isConnected || runtime.isSaving) return null;
      const drafts: InlinePairDraft[] = inlinePairsFromValue(sample[field.key]).map((pair) => ({
        key: pair.key,
        value: inlinePairValueText(pair.value, false),
      }));
      const layer = element('div', 'atlas-sb-pane-editor atlas-sb-value statblock-forge__pairs-editor');
      const rowsRoot = element('div', 'statblock-forge__pairs-editor-rows');
      const addPair = element('button', 'statblock-forge__pairs-editor-add', runtime.language === 'pt-BR' ? '+ Adicionar par' : '+ Add pair');
      addPair.type = 'button';
      addPair.dataset.noBlockEdit = 'true';
      const pt = runtime.language === 'pt-BR';
      const helper = element('span', 'statblock-forge__pairs-editor-help', pt
        ? 'Use números ou fórmulas de dados. Ex.: +5 ou 2d8+3.'
        : 'Use numbers or dice formulas. E.g. +5 or 2d8+3.');
      const error = element('span', 'statblock-forge__inline-field-editor-error');
      error.hidden = true;
      layer.append(rowsRoot, helper, addPair, error);
      slot.open(layer, display);

      let primaryControl: HTMLInputElement | null = null;
      let inFlight: Promise<boolean> | null = null;
      let lastCommitted = JSON.stringify(sample[field.key]);

      const renderRows = (focus?: { index: number; control: 'key' | 'value' }): void => {
        rowsRoot.replaceChildren();
        if (drafts.length === 0) {
          const empty = element('span', 'statblock-forge__hint', pt ? 'Nenhum par ainda. Adicione o primeiro.' : 'No pairs yet. Add the first one.');
          rowsRoot.append(empty);
        }
        drafts.forEach((draft, index) => {
          const row = element('div', 'statblock-forge__pairs-editor-row');
          const keyLabel = element('label', 'statblock-forge__pairs-editor-control');
          keyLabel.append(element('span', 'statblock-forge__pairs-editor-label', pt ? 'Nome' : 'Name'));
          const keyInput = index === 0 && primaryControl ? primaryControl : element('input', 'atlas-sb-pane-input');
          if (index === 0) primaryControl = keyInput;
          keyInput.type = 'text';
          keyInput.value = draft.key;
          keyInput.placeholder = pt ? 'Ex.: Destreza' : 'e.g. Dexterity';
          keyInput.setAttribute('aria-label', pt ? 'Nome do par' : 'Pair name');
          keyInput.dataset.pairIndex = String(index);
          keyInput.dataset.pairControl = 'key';
          keyInput.oninput = () => { draft.key = keyInput.value; };
          keyLabel.append(keyInput);

          const valueLabel = element('label', 'statblock-forge__pairs-editor-control');
          valueLabel.append(element('span', 'statblock-forge__pairs-editor-label', pt ? 'Valor' : 'Value'));
          const valueInput = element('input', 'atlas-sb-pane-input');
          valueInput.type = 'text';
          valueInput.value = draft.value;
          valueInput.placeholder = pt ? 'Ex.: +5 ou 2d8+3' : 'e.g. +5 or 2d8+3';
          valueInput.setAttribute('aria-label', pt ? 'Valor numérico ou fórmula de dados' : 'Number or dice formula');
          valueInput.dataset.pairIndex = String(index);
          valueInput.dataset.pairControl = 'value';
          valueInput.oninput = () => { draft.value = valueInput.value; };
          valueLabel.append(valueInput);

          const remove = element('button', 'statblock-forge__pairs-editor-remove', '×');
          remove.type = 'button';
          remove.dataset.noBlockEdit = 'true';
          remove.setAttribute('aria-label', pt ? `Remover ${draft.key || 'par'}` : `Remove ${draft.key || 'pair'}`);
          remove.title = remove.getAttribute('aria-label') ?? '';
          remove.addEventListener('click', () => {
            drafts.splice(index, 1);
            if (drafts.length === 0) drafts.push({ key: '', value: '' });
            renderRows({ index: Math.max(0, index - 1), control: 'key' });
          });
          row.append(keyLabel, valueLabel, remove);
          rowsRoot.append(row);
        });
        if (focus) {
          const target = rowsRoot.querySelector<HTMLInputElement>(`[data-pair-index="${focus.index}"][data-pair-control="${focus.control}"]`);
          target?.focus();
          target?.select();
        }
      };
      renderRows();
      addPair.addEventListener('click', () => {
        drafts.push({ key: '', value: '' });
        renderRows({ index: drafts.length - 1, control: 'key' });
      });

      const persist = (): Promise<boolean> => {
        if (inFlight) return inFlight;
        let nextValue: Array<Record<string, number | string>> | undefined;
        try {
          nextValue = serializeInlinePairsDraftRows(drafts, runtime.language);
        } catch (caught) {
          error.textContent = caught instanceof Error ? caught.message : String(caught);
          error.hidden = false;
          return Promise.resolve(false);
        }
        const serialized = JSON.stringify(nextValue);
        if (serialized === lastCommitted) return Promise.resolve(true);
        error.hidden = true;
        primaryControl?.removeAttribute('aria-invalid');
        inFlight = runtime.setBaseValue(field.key, nextValue).then(() => {
          lastCommitted = serialized;
          return true;
        }).catch((caught: unknown) => {
          error.textContent = caught instanceof Error ? caught.message : String(caught);
          error.hidden = false;
          primaryControl?.setAttribute('aria-invalid', 'true');
          return false;
        }).finally(() => { inFlight = null; });
        return inFlight;
      };

      layer.addEventListener('keydown', (event) => {
        if (!(event instanceof KeyboardEvent) || event.key !== 'Tab') return;
        const controls = Array.from(layer.querySelectorAll<HTMLElement>(
          'input:not([disabled]), button:not([disabled])',
        ));
        const index = controls.indexOf(event.target as HTMLElement);
        const atBoundary = event.shiftKey ? index === 0 : index === controls.length - 1;
        if (index < 0 || !atBoundary) return;
        event.preventDefault();
        event.stopPropagation();
        void runtime.navigate(field.key, event.shiftKey ? -1 : 1);
      });

      return {
        fieldKey: field.key,
        control: primaryControl ?? addPair,
        commit: persist,
        close: () => {
          slot.close(layer, display);
          redraw();
        },
        handleKeyDown: (event) => event.key === 'Tab',
      };
    }, display);
  }
  runtime?.subscribe(field.key, redraw);
  runtime?.subscribeAll(redraw);
  return slot.slot;
}

/** Atlas Pairs is a labelled run-in line; clicking the block edits its whole Field in place. */
function renderPairs(
  block: ForgeBlock,
  field: ForgeField | undefined,
  sample: JsonRecord,
  layout: ForgeLayoutDocument,
  runtime?: NumericFieldRuntime,
  language: ForgeLanguage = 'en',
): HTMLElement {
  const heading = visibleFieldBlockLabel(block, block.label, field, block.field, true, false);
  const wrapper = element('div', `atlas-sb-labelled atlas-sb-labelled--run-in atlas-sb-pairs statblock-forge__preview-pairs${heading ? '' : ' is-value-only'}`);
  if (heading) wrapper.append(markInlineFieldNameForEdit(
    element('span', 'atlas-sb-label', heading), field, runtime, field?.type === 'pairs',
  ));
  const display = element('span', 'atlas-sb-value');
  if (field?.type === 'pairs') {
    wrapper.append(createInlinePairsFieldValue(field, sample, runtime, block.display === 'signed', display, block.rollable === true));
  } else {
    const value = readablePreviewValue(valueOf(sample, block.field));
    display.textContent = value || '—';
    wrapper.append(display);
  }
  const actions = element('div', 'statblock-forge__entry-actions');
  appendCustomCollectionValueAction(actions, field, runtime, language);
  appendFieldCompendiumPicker(actions, field, layout, sample, runtime, language);
  if (actions.childElementCount > 0) wrapper.append(actions);
  return wrapper;
}

function renderTrack(block: ForgeBlock, field: ForgeField | undefined, sample: JsonRecord, layout: ForgeLayoutDocument, fields: readonly ForgeField[], numericRuntime?: NumericFieldRuntime): HTMLElement {
  const wrapper = element('div', `statblock-forge__preview-track${block.look === 'gauge' ? ' is-gauge' : ' is-boxes'}`);
  const fieldKey = typeof block.field === 'string' ? block.field : '';
  const fieldTracks = object(field?.tracks);
  const hasFieldTracking = fieldTracks.counts === 'down' || fieldTracks.counts === 'up';
  const isUnboundTrack = block.type === 'track' && !block.resource;
  const counts = hasFieldTracking ? fieldTracks.counts : block.counts === 'up' ? 'up' : 'down';
  const isTrackedNumber = field?.type === 'number' && (hasFieldTracking || isUnboundTrack);
  const requestedMaximumKey = typeof fieldTracks.max === 'string' ? fieldTracks.max : fieldKey;
  const requestedMaximumField = fields.find((candidate) => candidate.key === requestedMaximumKey && candidate.type === 'number');
  // Atlas falls back to the tracked field itself when max is absent or does not name a Number field.
  const selfTracked = Boolean(isTrackedNumber && (!requestedMaximumField || requestedMaximumField.key === fieldKey));
  const maximumField = selfTracked ? field : requestedMaximumField ?? field;
  const readMaximum = (): number | null => isFormulaCapableNumericField(maximumField) && numericRuntime
    ? numericRuntime.value(maximumField, sample)
    : numberValue(valueOf(sample, maximumField?.key ?? fieldKey));
  const currentValue = (): number | null => selfTracked
    ? forgeTrackedResourceCurrent(sample, fieldKey, Math.max(0, Math.floor(readMaximum() ?? 0)), counts)
    : isFormulaCapableNumericField(field) && numericRuntime
      ? numericRuntime.value(field, sample)
      : numberValue(valueOf(sample, fieldKey));
  const initialValues = forgeTrackValues(readMaximum(), currentValue(), counts);
  const max = initialValues.maximum;
  const filled = initialValues.current;
  const label = visibleFieldBlockLabel(block, block.label, field, fieldKey);
  if (!label) wrapper.classList.add('is-value-only');
  if (label) wrapper.append(element('strong', 'statblock-forge__preview-block-heading', label));

  const blockMeta = layout.blocks[block.id];
  const appearance = blockMeta?.appearanceMode === 'custom' ? blockMeta.appearance ?? {} : {};
  const track = element('div', 'statblock-forge__track-preview');
  const trackContent = element('span', 'statblock-forge__track-content');
  trackContent.setCssStyles({ display: 'inline-flex' });
  trackContent.setCssStyles({ minWidth: '0' });
  trackContent.setCssStyles({ maxWidth: '100%' });
  const accessibleLabel = label || field?.label?.trim() || fieldKey || 'Track';
  // In Boxes mode, show the trailing /maximum only when this Value owns its
  // maximum. The value remains editable in place; Gauge exposes this edit by
  // clicking the bar itself when the Number is its own maximum.
  const trailingMaximum = block.look === 'gauge' || !selfTracked
    ? null
    : element('span', 'statblock-forge__preview-track-maximum');
  if (trailingMaximum) {
    trailingMaximum.append(document.createTextNode('/'));
    if (numericRuntime && maximumField && isFormulaCapableNumericField(maximumField)) {
      const maximumNumber = createInlineNumericFieldValue(
        maximumField,
        sample,
        numericRuntime,
        () => numericFieldDisplayText(maximumField, sample, numericRuntime),
        'statblock-forge__preview-track-maximum-number',
      );
      maximumNumber.setAttribute('aria-label', numericRuntime.language === 'pt-BR'
        ? `Máximo de ${accessibleLabel}`
        : `${accessibleLabel} maximum`);
      trailingMaximum.append(maximumNumber);
    } else {
      trailingMaximum.append(document.createTextNode(String(max)));
    }
    trailingMaximum.title = numericRuntime?.language === 'pt-BR' ? 'Clique para editar o máximo' : 'Click to edit the maximum';
    trailingMaximum.setCssStyles({ alignSelf: 'flex-end' });
  }
  track.append(trackContent);
  if (trailingMaximum) track.append(trailingMaximum);

  const useGauge = block.look === 'gauge';
  let gaugeTrack: HTMLElement | null = null;
  let gaugeFill: HTMLElement | null = null;
  let gaugeMinus: HTMLButtonElement | null = null;
  let gaugePlus: HTMLButtonElement | null = null;
  if (useGauge) {
    // Gauge keeps its controls and meter mounted. This is important when the
    // bar itself opens the Number editor: a saved maximum must not replace the
    // active editor node while its commit is completing.
    const gauge = element('span', 'atlas-sb-gauge statblock-forge__track-gauge');
    const canAdjust = Boolean(numericRuntime?.canEdit && field && isFormulaCapableNumericField(field));
    const changeCurrent = (delta: number): void => {
      if (!numericRuntime || !field || numericRuntime.isSaving) return;
      const current = currentValue();
      if (current === null) return;
      const currentMax = Math.max(0, Math.floor(readMaximum() ?? 0));
      const next = Math.max(0, Math.min(currentMax, current + delta));
      if (next === current) return;
      if (selfTracked) {
        if (!forgeResourceValuesAreValid(sample)) return;
        const nextData: JsonRecord = { [FORGE_RESOURCE_VALUES_KEY]: sample[FORGE_RESOURCE_VALUES_KEY] };
        if (!setForgeTrackedResourceCurrent(nextData, fieldKey, next)) return;
        void numericRuntime.setBaseValue(FORGE_RESOURCE_VALUES_KEY, nextData[FORGE_RESOURCE_VALUES_KEY]).catch(() => undefined);
      } else {
        void numericRuntime.setBaseValue(fieldKey, next).catch(() => undefined);
      }
    };
    if (canAdjust) {
      gaugeMinus = element('button', 'atlas-sb-counter__step statblock-forge__track-gauge-step', '−') as HTMLButtonElement;
      gaugeMinus.type = 'button';
      gaugeMinus.setAttribute('aria-label', numericRuntime?.language === 'pt-BR' ? `Diminuir ${accessibleLabel}` : `Decrease ${accessibleLabel}`);
      gaugeMinus.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        changeCurrent(-1);
      });
      gauge.append(gaugeMinus);
    }

    gaugeTrack = element('span', 'atlas-sb-gauge-track statblock-forge__track-gauge-track');
    gaugeFill = element('span', 'atlas-sb-gauge-fill statblock-forge__track-gauge-fill');
    gaugeTrack.setCssStyles({ backgroundColor: appearance.trackEmptyColor ?? 'var(--background-modifier-border)' });
    gaugeTrack.setAttribute('role', 'meter');
    gaugeTrack.setAttribute('aria-label', `${accessibleLabel}: ${filled} de ${max}`);
    gaugeTrack.setAttribute('aria-valuemin', '0');
    gaugeTrack.setAttribute('aria-valuemax', String(max));
    gaugeTrack.setAttribute('aria-valuenow', String(filled));
    if (appearance.trackBorderColor) gaugeTrack.setCssStyles({ border: `1px solid ${appearance.trackBorderColor}` });
    gaugeTrack.append(gaugeFill);

    if (selfTracked && numericRuntime?.canEdit && field && isFormulaCapableNumericField(field)) {
      const maximumEditor = createInlineNumericFieldValue(field, sample, numericRuntime, () => '', '', {
        displayElement: gaugeTrack,
        preserveDisplayFormatting: false,
        slotClass: 'statblock-forge__track-gauge-edit-slot',
      });
      maximumEditor.setAttribute('aria-label', numericRuntime.language === 'pt-BR'
        ? `Clique para editar o máximo de ${accessibleLabel}`
        : `Click to edit ${accessibleLabel} maximum`);
      maximumEditor.title = numericRuntime.language === 'pt-BR'
        ? 'Clique no gauge para editar o máximo'
        : 'Click the gauge to edit its maximum';
      gauge.append(maximumEditor);
    } else {
      gauge.append(gaugeTrack);
    }

    if (canAdjust) {
      gaugePlus = element('button', 'atlas-sb-counter__step statblock-forge__track-gauge-step', '+') as HTMLButtonElement;
      gaugePlus.type = 'button';
      gaugePlus.setAttribute('aria-label', numericRuntime?.language === 'pt-BR' ? `Aumentar ${accessibleLabel}` : `Increase ${accessibleLabel}`);
      gaugePlus.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        changeCurrent(1);
      });
      gauge.append(gaugePlus);
    }
    trackContent.append(gauge);
  }

  const drawTrack = (safeFilled: number, safeMax: number): void => {
    track.dataset.currentValue = String(safeFilled);
    track.dataset.maximumValue = String(safeMax);
    // The selected display mode is authoritative: Boxes stays boxes and
    // Gauge stays a gauge. Gauge controls flank the bar; its maximum editor
    // lives on the bar itself only when the Number is self-tracked.
    if (useGauge) {
      if (!gaugeTrack || !gaugeFill) return;
      gaugeFill.setCssProps({ ['--atlas-sb-gauge-share']: String(safeMax > 0 ? safeFilled / safeMax : 0) });
      gaugeFill.setCssStyles({ backgroundColor: appearance.trackFillColor ?? 'var(--text-accent)' });
      gaugeTrack.setAttribute('aria-label', `${accessibleLabel}: ${safeFilled} de ${safeMax}`);
      gaugeTrack.setAttribute('aria-valuemax', String(safeMax));
      gaugeTrack.setAttribute('aria-valuenow', String(safeFilled));
      if (gaugeMinus) gaugeMinus.disabled = safeFilled <= 0 || Boolean(numericRuntime?.isSaving);
      if (gaugePlus) gaugePlus.disabled = safeFilled >= safeMax || Boolean(numericRuntime?.isSaving);
      return;
    }

    trackContent.replaceChildren();
    // Atlas draws at most twelve 12px boxes per line, with 4px gaps, and
    // switches to a gauge above 36 boxes. The class names intentionally match
    // Atlas so its semantics remain familiar while Forge keeps its own scope.
    const boxes = element('span', 'atlas-sb-track-boxes statblock-forge__track-boxes');
    boxes.setAttribute('role', 'meter');
    boxes.setAttribute('aria-label', `${accessibleLabel}: ${safeFilled} de ${safeMax}`);
    boxes.setAttribute('aria-valuemin', '0');
    boxes.setAttribute('aria-valuemax', String(safeMax));
    boxes.setAttribute('aria-valuenow', String(safeFilled));
    if (safeMax === 0) {
      // An explicit zero maximum is a real value, not an empty/missing Field.
      // Show the zero rather than forcing a phantom one-box track.
      const zero = element('span', 'statblock-forge__track-zero-value', '0');
      zero.setAttribute('aria-hidden', 'true');
      boxes.append(zero);
    }
    for (let index = 0; index < safeMax; index += 1) {
      const marked = index < safeFilled;
      const canSet = Boolean(numericRuntime?.canEdit && field && isFormulaCapableNumericField(field));
      const box = element(canSet ? 'button' : 'span', `atlas-sb-track-box statblock-forge__track-box${marked ? ' is-marked' : ''}`) as HTMLElement;
      if (canSet) {
        const button = box as HTMLButtonElement;
        button.type = 'button';
        button.setAttribute('aria-pressed', String(marked));
        button.setAttribute('aria-label', `${accessibleLabel}: ${index + 1} de ${safeMax}`);
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!numericRuntime || !field || numericRuntime.isSaving) return;
          const next = safeFilled === index + 1 ? index : index + 1;
          if (selfTracked) {
            const nextData: JsonRecord = { [FORGE_RESOURCE_VALUES_KEY]: sample[FORGE_RESOURCE_VALUES_KEY] };
            if (!setForgeTrackedResourceCurrent(nextData, fieldKey, next)) return;
            void numericRuntime.setBaseValue(FORGE_RESOURCE_VALUES_KEY, nextData[FORGE_RESOURCE_VALUES_KEY]).then(() => { const latest = forgeTrackValues(readMaximum(), currentValue(), counts); drawTrack(latest.current, latest.maximum); }).catch(() => undefined);
          } else {
            void numericRuntime.setBaseValue(fieldKey, next).then(() => { const latest = forgeTrackValues(readMaximum(), currentValue(), counts); drawTrack(latest.current, latest.maximum); }).catch(() => undefined);
          }
        });
      }
      if (marked && appearance.trackFillColor) box.setCssStyles({ backgroundColor: appearance.trackFillColor });
      else if (!marked && appearance.trackEmptyColor) box.setCssStyles({ backgroundColor: appearance.trackEmptyColor });
      if (appearance.trackBorderColor) box.setCssStyles({ borderColor: appearance.trackBorderColor });
      boxes.append(box);
    }
    trackContent.append(boxes);
    // Keep the maximum immediately after the final box. Its value is the
    // actual maximum source Field and is edited in place when permitted.
    if (trailingMaximum) trailingMaximum.hidden = false;
  };
  drawTrack(filled, max);
  wrapper.append(track);
  if (numericRuntime && field) {
    const redrawTrack = (): void => {
      const next = forgeTrackValues(readMaximum(), currentValue(), counts);
      drawTrack(next.current, next.maximum);
    };
    numericRuntime.subscribe(field.key, redrawTrack);
    if (maximumField && maximumField.key !== field.key) numericRuntime.subscribe(maximumField.key, redrawTrack);
    numericRuntime.subscribe(FORGE_RESOURCE_VALUES_KEY, redrawTrack);
    numericRuntime.subscribeAll(redrawTrack);
  }
  return wrapper;
}

function counterRows(raw: unknown, field: ForgeField | undefined): Array<{ name: string; max: number; used: number; remaining: number; reset: string | null; regain?: string }> | null {
  const rows = resolveInlineCounterRows(raw, field);
  if (!rows) return null;
  return rows.filter((row) => row.max > 0).map((row) => ({
    name: row.name,
    max: row.max,
    used: row.used,
    remaining: Math.max(0, row.max - row.used),
    reset: typeof row.reset === 'string' ? row.reset : null,
    ...(typeof row.regain === 'string' && row.regain ? { regain: row.regain } : {}),
  }));
}

/** A Counters block follows Atlas' CountersGrid: pips set the remaining uses, large counters use −/+. */
function renderCounters(
  block: ForgeBlock,
  field: ForgeField | undefined,
  sample: JsonRecord,
  layout: ForgeLayoutDocument,
  language: ForgeLanguage,
  numericRuntime?: NumericFieldRuntime,
  onCounterValueChange?: (value: unknown) => void,
  onlyRowIndex?: number,
): HTMLElement {
  const wrapper = element('div', 'statblock-forge__preview-counters atlas-sb-counters');
  const heading = visibleFieldBlockLabel(block, block.label, field, block.field, true, false);
  if (!heading) wrapper.classList.add('is-value-only');
  if (heading) wrapper.append(element('strong', 'statblock-forge__preview-block-heading', heading));
  const body = element('span', 'atlas-sb-counters__body');
  const cells = element('span', 'atlas-sb-counters__cells');
  const countersPerRow = normalizeCountersPerRow(layout.blocks[block.id]?.countersPerRow ?? DEFAULT_COUNTERS_PER_ROW);
  // Apply the column template inline on the grid itself. The editor Canvas and
  // live statblock share this renderer but may sit under different stylesheet
  // scopes; the layout must not depend on a scoped custom-property rule.
  cells.setCssStyles({
    display: 'grid',
    gridTemplateColumns: `repeat(${countersPerRow}, minmax(0, 1fr))`,
    width: '100%',
    minWidth: '0',
  });
  body.append(cells);
  wrapper.append(body);
  const blockMeta = layout.blocks[block.id];
  const appearance = blockMeta?.appearanceMode === 'custom' ? blockMeta.appearance ?? {} : {};
  const isEditable = Boolean(field?.type === 'counters' && (numericRuntime?.canEdit || onCounterValueChange));

  const persistUsed = (displayedIndex: number, used: number): void => {
    if (!field || field.type !== 'counters') return;
    const next = updateInlineCounterUsedValue(sample[field.key], field, displayedIndex, used);
    if (Object.is(next, sample[field.key])) return;
    if (onCounterValueChange) {
      onCounterValueChange(next);
      return;
    }
    if (numericRuntime?.canEdit) void numericRuntime.setBaseValue(field.key, next).catch(() => undefined);
  };
  const draw = (): void => {
    cells.replaceChildren();
    const rows = counterRows(valueOf(sample, block.field), field);
    if (rows === null) {
      cells.append(element('span', 'statblock-forge__preview-score-mismatch', readablePreviewValue(valueOf(sample, block.field))));
      return;
    }
    if (!rows.length) {
      cells.append(markForgeUiText(element('span', 'statblock-forge__hint', 'Nenhum Counter configurado.'), 'Nenhum Counter configurado.'));
      return;
    }
    const rowsToRender = onlyRowIndex === undefined
      ? rows.map((rowData, rowIndex) => ({ rowData, rowIndex }))
      : rows[onlyRowIndex] ? [{ rowData: rows[onlyRowIndex]!, rowIndex: onlyRowIndex }] : [];
    if (onlyRowIndex !== undefined && rowsToRender.length === 0) {
      cells.append(element('span', 'statblock-forge__table-slot-value', '—'));
      return;
    }

    rowsToRender.forEach(({ rowData, rowIndex }) => {
      const row = element('span', 'atlas-sb-counter statblock-forge__preview-counter-row');
      const main = element('span', 'statblock-forge__preview-counter-main');
      // Each Counter occupies one grid cell: its name is the first line and
      // its indicators are rendered beneath that name in a separate row.
      main.setCssStyles({ display: 'flex' });
      main.setCssStyles({ flexDirection: 'column' });
      main.setCssStyles({ flexWrap: 'nowrap' });
      main.setCssStyles({ alignItems: 'center' });
      main.setCssStyles({ justifyContent: 'center' });
      main.setCssStyles({ gap: '0.28rem' });
      main.setCssStyles({ width: '100%' });
      main.setCssStyles({ minWidth: '0' });
      main.setCssStyles({ maxWidth: '100%' });
      // Counter names are optional. An empty name must remain visually empty;
      // the generic text below is used only for accessible control labels.
      const counterName = rowData.name.trim();
      if (counterName) {
        const name = element('span', 'statblock-forge__preview-counter-name', counterName);
        name.setCssStyles({ display: 'block' });
        name.setCssStyles({ width: '100%' });
        name.setCssStyles({ lineHeight: '1' });
        name.setCssStyles({ margin: '0' });
        name.setCssStyles({ flex: '0 0 auto' });
        row.append(name);
      }
      const showNumericValue = shouldShowCounterNumericValue(field?.showCounterValue === true, rowData.max);
      const accessibleName = counterName || `Counter ${rowIndex + 1}`;
      const setUsed = (used: number): void => persistUsed(rowIndex, used);
      if (counterUsesNumericDisplay(rowData.max)) {
        const stepper = element('span', 'atlas-sb-counter__stepper');
        const decrease = element(isEditable ? 'button' : 'span', 'atlas-sb-counter__step', '−');
        if (decrease instanceof HTMLButtonElement) {
          decrease.type = 'button';
          decrease.disabled = rowData.remaining <= 0;
          decrease.setAttribute('aria-label', numericRuntime?.language === 'pt-BR' ? `Usar ${accessibleName}` : `Use ${accessibleName}`);
          decrease.addEventListener('click', (event) => {
            event.stopPropagation();
            setUsed(rowData.used + 1);
          });
        }
        const count = showNumericValue ? element('span', 'atlas-sb-counter__count statblock-forge__preview-counter-value', `${rowData.remaining} / ${rowData.max}`) : null;
        const increase = element(isEditable ? 'button' : 'span', 'atlas-sb-counter__step', '+');
        if (increase instanceof HTMLButtonElement) {
          increase.type = 'button';
          increase.disabled = rowData.used <= 0;
          increase.setAttribute('aria-label', numericRuntime?.language === 'pt-BR' ? `Recuperar ${accessibleName}` : `Restore ${accessibleName}`);
          increase.addEventListener('click', (event) => {
            event.stopPropagation();
            setUsed(rowData.used - 1);
          });
        }
        stepper.append(decrease);
        if (count) stepper.append(count);
        stepper.append(increase);
        main.append(stepper);
      } else {
        const pips = element('span', 'atlas-sb-counter__pips statblock-forge__preview-counter-pips');
        pips.setCssStyles({ display: 'inline-flex' });
        pips.setCssStyles({ flexWrap: 'wrap' });
        pips.setCssStyles({ alignItems: 'center' });
        pips.setCssStyles({ justifyContent: 'center' });
        pips.setCssStyles({ gap: '0' });
        pips.setCssStyles({ width: 'max-content' });
        pips.setCssStyles({ maxWidth: '100%' });
        pips.setCssStyles({ boxSizing: 'border-box' });
        pips.setCssStyles({ margin: '0 auto' });
        pips.setCssStyles({ lineHeight: '0' });
        pips.setAttribute('role', isEditable ? 'group' : 'img');
        pips.setAttribute('aria-label', `${accessibleName}: ${rowData.remaining}/${rowData.max}`);
        for (let index = 0; index < rowData.max; index += 1) {
          const left = index < rowData.remaining;
          const pip = element('span', `atlas-sb-counter__pip${left ? ' is-left' : ''}`);
          pip.setCssStyles({ borderColor: appearance.trackBorderColor ?? 'var(--forge-track-border, var(--forge-theme-track-border, var(--atlas-sb-track-box-color, var(--background-modifier-border))))' });
          pip.setCssStyles({ backgroundColor: left
            ? appearance.trackFillColor ?? 'var(--forge-track-fill, var(--forge-theme-track-fill, var(--atlas-sb-track-box-color, var(--interactive-accent))))'
            : appearance.trackEmptyColor ?? 'var(--forge-track-empty, var(--forge-theme-track-empty, var(--background-primary)))' });
          if (isEditable) {
            const button = element('button', 'atlas-sb-counter__pip-button');
            button.type = 'button';
            button.setAttribute('aria-pressed', left ? 'true' : 'false');
            button.setAttribute('aria-label', numericRuntime?.language === 'pt-BR'
              ? `${accessibleName}, marcador ${index + 1} de ${rowData.max}`
              : `${accessibleName}, pip ${index + 1} of ${rowData.max}`);
            button.addEventListener('click', (event) => {
              event.stopPropagation();
              const remaining = index < rowData.remaining ? index : index + 1;
              setUsed(rowData.max - remaining);
            });
            button.append(pip);
            pips.append(button);
          } else {
            const hitbox = element('span', 'atlas-sb-counter__pip-hitbox');
            hitbox.append(pip);
            pips.append(hitbox);
          }
        }
        main.append(pips);
        if (showNumericValue) main.append(element('span', 'atlas-sb-counter__count statblock-forge__preview-counter-value', `${rowData.remaining} / ${rowData.max}`));
      }
      row.append(main);
      if (rowData.regain) {
        const regain = element('small', 'atlas-sb-counter__regain', `Recupera: ${rowData.regain}`);
        regain.dataset.forgeUiText = `Recupera: ${rowData.regain}`;
        row.append(regain);
      }
      cells.append(row);
    });
  };

  draw();
  if (field?.type === 'counters' && numericRuntime) {
    numericRuntime.subscribe(field.key, draw);
    numericRuntime.subscribeAll(draw);
  }
  return wrapper;
}

function imageFrameForLayoutBlock(layout: ForgeLayoutDocument, blockId: string): StatblockImageFrame {
  const appearance = layout.blocks[blockId]?.appearance ?? {};
  // Template object-position remains the baseline focal point. Note-local
  // panning starts neutral and is stored as a separate additive translation.
  return normalizeStatblockImageFrame({
    zoom: appearance.imageZoom,
    x: 50,
    y: 50,
  });
}

function renderImage(
  block: ForgeBlock,
  field: ForgeField | undefined,
  sample: JsonRecord,
  resolveImage?: (path: string) => string | undefined,
  onImageFieldAction?: (fieldKey: string, socket: HTMLButtonElement) => void,
  initialFrame?: StatblockImageFrame,
  onImageFrameChange?: (blockId: string, frame: StatblockImageFrame) => void,
  onImageBlockSelect?: (blockId: string) => void,
  templateFocus: { x: number; y: number } = { x: 50, y: 50 },
): HTMLElement {
  const isReservedToken = block.id === 'header-token' && field?.type === 'image'
    && ['image', 'token-image', 'token'].includes(field.key);
  const shape = isReservedToken ? 'token' : 'portrait';
  const wrapper = element('div', `statblock-forge__preview-image is-${shape}`);
  const raw = valueOf(sample, block.field);
  const path = imageReferenceText(raw);
  let src: string | undefined;
  if (/^(https?:|data:image\/)/i.test(path)) src = path;
  else if (path && resolveImage) src = resolveImage(path);

  const interactive = Boolean((onImageFieldAction || onImageBlockSelect) && field?.type === 'image');
  const canFrameImage = Boolean(src && onImageFrameChange);
  const face = interactive
    ? element('button', 'statblock-forge__image-socket')
    : element('div', 'statblock-forge__image-socket is-static');
  let suppressNextClick = false;
  let currentFrame = normalizeStatblockImageFrame(initialFrame ?? DEFAULT_STATBLOCK_IMAGE_FRAME);
  let imageLayout: ReturnType<typeof bindImageFocalLayout> | null = null;
  const applyFrame = (next: StatblockImageFrame, persist: boolean): void => {
    currentFrame = normalizeStatblockImageFrame(next);
    wrapper.dataset.imageZoom = String(currentFrame.zoom);
    wrapper.classList.toggle('is-image-zoomed', currentFrame.zoom > 100);
    imageLayout?.update();
    if (persist) onImageFrameChange?.(block.id, currentFrame);
  };
  if (canFrameImage) {
    wrapper.classList.add('is-framing-interactive');
    applyFrame(currentFrame, false);

    // Normal wheel input scrolls the statblock, including when the pointer is
    // over artwork. Hold Ctrl to explicitly zoom the image instead.
    face.addEventListener('wheel', (event) => {
      if (!event.deltaY || !event.ctrlKey || event.altKey || event.metaKey) return;
      const nextZoom = Math.min(300, Math.max(100, currentFrame.zoom + (event.deltaY < 0 ? 10 : -10)));
      // At the zoom bounds the root wheel router takes over and scrolls vertically.
      if (nextZoom === currentFrame.zoom) return;
      event.preventDefault();
      event.stopPropagation();
      applyFrame({ ...currentFrame, zoom: nextZoom }, true);
    }, { passive: false });

    let drag: { pointerId: number; startX: number; startY: number; frame: StatblockImageFrame; moved: boolean } | null = null;
    face.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.isPrimary === false || currentFrame.zoom <= 100) return;
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        frame: { ...currentFrame },
        moved: false,
      };
      wrapper.classList.add('is-image-dragging');
      try { face.setPointerCapture(event.pointerId); } catch { /* Some embedded webviews do not expose pointer capture. */ }
    });
    face.addEventListener('pointermove', (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(deltaX, deltaY) < 3) return;
      drag.moved = true;
      event.preventDefault();
      const rect = face.getBoundingClientRect();
      applyFrame(panStatblockImageFrame(drag.frame, deltaX, deltaY, rect.width, rect.height), false);
    });
    const finishDrag = (event: PointerEvent, cancelled = false): void => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const completed = drag;
      drag = null;
      wrapper.classList.remove('is-image-dragging');
      if (completed.moved && !cancelled) {
        suppressNextClick = true;
        applyFrame(currentFrame, true);
      } else if (cancelled) {
        applyFrame(completed.frame, false);
      }
    };
    face.addEventListener('pointerup', (event) => finishDrag(event));
    face.addEventListener('pointercancel', (event) => finishDrag(event, true));
    face.addEventListener('lostpointercapture', (event) => finishDrag(event as PointerEvent, true));
  }
  if (face instanceof HTMLButtonElement) {
    face.type = 'button';
    if (!onImageBlockSelect) {
      face.setAttribute('aria-haspopup', 'menu');
      face.setAttribute('aria-expanded', 'false');
    }
    const label = field?.label || (shape === 'token' ? 'Token art' : 'Image');
    face.setAttribute('aria-label', onImageBlockSelect
      ? `${label}: ${path || 'select image block; right-click for image actions'}`
      : `${label}: ${path || 'choose image'}`);
    face.addEventListener('click', (event) => {
      if (suppressNextClick) {
        suppressNextClick = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (onImageBlockSelect) onImageBlockSelect(block.id);
      else if (field) onImageFieldAction?.(field.key, face);
    });
    if (onImageBlockSelect && onImageFieldAction && field) {
      face.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        onImageFieldAction(field.key, face);
      });
    }
  }

  const frame = element('span', 'statblock-forge__image-socket-frame');
  if (src) {
    frame.classList.add('has-image');
    const image = element('img', 'statblock-forge__image-socket-art');
    image.src = src;
    image.alt = field?.label ?? 'Imagem';
    if (!field?.label) image.dataset.forgeUiAlt = 'Imagem';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.draggable = false;
    frame.append(image);
    // Use the real intrinsic image dimensions for cover/zoom/focal positioning.
    // The same geometry routine is used by the template inspector preview.
    imageLayout = bindImageFocalLayout(image, frame, () => {
      const localPan = statblockImagePanTranslation(currentFrame);
      return {
        zoom: currentFrame.zoom,
        x: templateFocus.x,
        y: templateFocus.y,
        panXPercent: localPan.x,
        panYPercent: localPan.y,
      };
    });
    if (interactive) frame.append(element('span', 'statblock-forge__image-socket-link-badge', '↗'));
  } else {
    frame.classList.add('is-empty');
    frame.append(element('span', 'statblock-forge__image-socket-plus', '+'));
  }
  face.append(frame);

  if (!src && shape !== 'token') {
    const promptText = path
      ? `Arquivo não encontrado: ${path}. Escolha outra imagem.`
      : 'Clique para adicionar uma imagem.';
    const prompt = element('span', 'statblock-forge__image-socket-prompt', promptText);
    face.append(markForgeUiText(prompt, promptText));
  }
  wrapper.append(face);
  return wrapper;
}

function renderGroupsDisplay(block: ForgeBlock, field: ForgeField | undefined, sample: JsonRecord, fields: readonly ForgeField[], language: ForgeLanguage = 'en', canEdit = false): HTMLElement {
  const wrapper = element('div', 'statblock-forge__preview-spells');
  const heading = visibleFieldBlockLabel(block, block.heading, field, block.field, true, false);
  if (heading) wrapper.append(element('strong', 'statblock-forge__preview-block-heading', heading));
  const nameField = headerFieldForPart(fields, 'name');
  const sourceCreatureName = readablePreviewValue(valueOf(sample, nameField?.key ?? 'name'));
  const creatureName = sourceCreatureName || translateForgeText('Creature', language);
  const groups = groupPreviewGroups(valueOf(sample, block.field), creatureName);
  if (!sourceCreatureName && language === 'pt-BR') {
    for (const group of groups) {
      if (group.header === `${creatureName} has the following values:`) group.header = `${creatureName} possui os seguintes valores:`;
    }
  }
  if (!groups.length) {
    const emptyText = language === 'pt-BR'
      ? (canEdit ? 'Nenhum grupo configurado. Clique para adicionar um grupo.' : 'Nenhum grupo configurado.')
      : (canEdit ? 'No groups configured. Click to add a group.' : 'No groups configured.');
    wrapper.append(markForgeUiText(element('span', 'statblock-forge__hint', emptyText), emptyText));
    return wrapper;
  }

  const appendGroupValue = (list: HTMLElement, text: string, level?: string): void => {
    const names = splitInlineListText(text);
    const visibleNames = names.length > 0 ? names : [text];
    for (const valueName of visibleNames) {
      const item = element('li', 'statblock-forge__preview-spell-item');
      item.dataset.rollName = valueName;
      if (level) item.append(element('strong', 'statblock-forge__preview-spell-level', `${level}: `));
      const name = element('span', 'statblock-forge__preview-spell-name');
      applyTextWithBasicMarkdown(name, valueName);
      // Group values may include damage/effect formulas (e.g. `Fireball (8d6)`).
      // Keep the roll link local so it also survives a spell editor redraw.
      linkForgeStatblockDice(name);
      item.append(name);
      list.append(item);
    }
  };

  groups.forEach((group) => {
    const groupNode = element('section', 'statblock-forge__preview-spell-group');
    if (group.header) groupNode.append(element('strong', 'statblock-forge__preview-spell-header', group.header));
    if (block.look === 'tabs') {
      const loose = group.values.filter((spell) => !spell.level);
      if (loose.length) {
        const listNode = element('ul', 'statblock-forge__preview-spell-list');
        loose.forEach((spell) => appendGroupValue(listNode, spell.text));
        groupNode.append(listNode);
      }
      const levels = [...new Set(group.values.flatMap((spell) => spell.level ? [spell.level] : []))];
      if (levels.length) {
        const tabs = element('div', 'statblock-forge__preview-spell-tabs');
        const strip = element('div', 'statblock-forge__preview-tab-strip');
        strip.setAttribute('role', 'tablist');
        const panels = element('div', 'statblock-forge__preview-spell-panels');
        const buttons: HTMLButtonElement[] = [];
        const panelNodes: HTMLElement[] = [];
        levels.forEach((level, index) => {
          const tabButton = element('button', `statblock-forge__preview-tab${index === 0 ? ' is-active' : ''}`, level);
          tabButton.type = 'button';
          tabButton.setAttribute('role', 'tab');
          tabButton.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
          const panel = element('ul', 'statblock-forge__preview-spell-list');
          panel.setAttribute('role', 'tabpanel');
          panel.hidden = index !== 0;
          group.values.filter((spell) => spell.level === level).forEach((spell) => appendGroupValue(panel, spell.text));
          tabButton.addEventListener('click', () => {
            buttons.forEach((candidate) => {
              const active = candidate === tabButton;
              candidate.classList.toggle('is-active', active);
              candidate.setAttribute('aria-selected', active ? 'true' : 'false');
            });
            panelNodes.forEach((candidate) => { candidate.hidden = candidate !== panel; });
          });
          buttons.push(tabButton);
          panelNodes.push(panel);
          strip.append(tabButton);
          panels.append(panel);
        });
        tabs.append(strip, panels);
        groupNode.append(tabs);
      }
    } else {
      const listNode = element('ul', 'statblock-forge__preview-spell-list');
      group.values.forEach((spell) => appendGroupValue(listNode, spell.text, spell.level));
      if (group.values.length) groupNode.append(listNode);
    }
    wrapper.append(groupNode);
  });
  return wrapper;
}

/** Atlas-compatible structured editor for Groups, categories and values. */
function renderGroups(
  block: ForgeBlock,
  field: ForgeField | undefined,
  sample: JsonRecord,
  fields: readonly ForgeField[],
  layout: ForgeLayoutDocument,
  language: ForgeLanguage = 'en',
  runtime?: NumericFieldRuntime,
): HTMLElement {
  const display = renderGroupsDisplay(block, field, sample, fields, language, runtime?.canEdit === true);
  if (!field || field.type !== 'spells' || !runtime?.canEdit) {
    appendFieldCompendiumPicker(display, field, layout, sample, runtime, language);
    return display;
  }

  const slot = createInlineEditSlot('div', 'statblock-forge__preview-inline-text-field is-markdown', display, true);
  // Keep the actions outside `display`: Groups redraws replace the display's
  // children, but custom editing and the Compendium picker must remain available.
  const actions = element('div', 'statblock-forge__entry-actions');
  appendCustomCollectionValueAction(actions, field, runtime, language);
  appendFieldCompendiumPicker(actions, field, layout, sample, runtime, language);
  if (actions.childElementCount > 0) slot.slot.append(actions);
  const redraw = (): void => {
    const next = renderGroupsDisplay(block, field, sample, fields, language, runtime?.canEdit === true);
    display.replaceChildren(...Array.from(next.childNodes));
  };

  const pt = language === 'pt-BR';
  const defaultLevel = pt ? 'Geral' : 'General';
  const buttonText = (node: HTMLButtonElement, text: string): HTMLButtonElement => {
    node.textContent = text;
    node.dataset.noBlockEdit = 'true';
    node.type = 'button';
    return node;
  };
  const makeEditorLabel = (text: string): HTMLSpanElement =>
    markForgeUiText(element('span', 'statblock-forge__spell-editor-label', text), text);

  registerInlineSlotEditor(slot.slot, field.key, () => {
    if (!display.isConnected || runtime.isSaving) return null;

    let groups: InlineSpellGroupDraft[] = inlineSpellGroupsDraftValue(sample[field.key]);
    if (groups.length === 0) groups = [{ heading: '', lines: [{ level: defaultLevel, spells: '' }] }];
    groups = groups.map((group) => ({
      heading: group.heading,
      lines: group.lines.length > 0 ? group.lines.map((line) => ({ ...line })) : [{ level: defaultLevel, spells: '' }],
    }));

    const layer = element('div', 'atlas-sb-pane-editor atlas-sb-value statblock-forge__spell-editor');
    const groupsRoot = element('div', 'statblock-forge__spell-editor-groups');
    const addGroup = buttonText(element('button', 'statblock-forge__spell-editor-add'), pt ? '+ Adicionar grupo' : '+ Add group');
    const editorActions = element('div', 'statblock-forge__spell-editor-actions');
    const saveGroups = buttonText(element('button', 'statblock-forge__spell-editor-save'), pt ? 'Concluir' : 'Done');
    saveGroups.setAttribute('aria-label', pt ? 'Salvar valores dos grupos' : 'Save Groups values');
    const error = element('span', 'statblock-forge__inline-field-editor-error');
    error.hidden = true;
    editorActions.append(saveGroups);
    layer.append(groupsRoot, addGroup, editorActions, error);

    let primaryControl: HTMLInputElement | null = null;
    let lastCommitted = JSON.stringify(serializeInlineSpellGroups(inlineSpellGroupsDraftValue(sample[field.key]), defaultLevel));
    let inFlight: Promise<boolean> | null = null;
    let requireGroupValue = false;

    const renderGroups = (focus?: { group: number; line?: number; control: 'heading' | 'level' | 'spells' }): void => {
      groupsRoot.replaceChildren();

      groups.forEach((group, groupIndex) => {
        const card = element('section', 'statblock-forge__spell-editor-group');
        const groupHead = element('div', 'statblock-forge__spell-editor-group-heading');
        const headingLabel = element('label', 'statblock-forge__spell-editor-control statblock-forge__spell-editor-heading-control');
        headingLabel.append(makeEditorLabel(pt ? 'Nome do grupo' : 'Group name'));
        const headingInput = groupIndex === 0 && primaryControl
          ? primaryControl
          : element('input', 'atlas-sb-pane-input');
        headingInput.type = 'text';
        headingInput.value = group.heading;
        headingInput.placeholder = pt ? 'Ex.: Habilidades ofensivas' : 'e.g. Offensive abilities';
        headingInput.setAttribute('aria-label', pt ? 'Nome do grupo' : 'Group name');
        headingInput.dataset.spellGroupIndex = String(groupIndex);
        headingInput.dataset.spellControl = 'heading';
        if (groupIndex === 0) {
          primaryControl = headingInput;
          headingInput.oninput = () => { if (groups[0]) groups[0].heading = headingInput.value; error.hidden = true; primaryControl?.removeAttribute('aria-invalid'); };
        } else {
          headingInput.addEventListener('input', () => { group.heading = headingInput.value; error.hidden = true; primaryControl?.removeAttribute('aria-invalid'); });
        }
        headingLabel.append(headingInput);
        const removeGroup = buttonText(element('button', 'statblock-forge__spell-editor-remove'), '×');
        removeGroup.setAttribute('aria-label', pt ? 'Remover grupo' : 'Remove group');
        removeGroup.title = removeGroup.getAttribute('aria-label') ?? '';
        removeGroup.addEventListener('click', () => {
          groups.splice(groupIndex, 1);
          if (groups.length === 0) groups.push({ heading: '', lines: [{ level: defaultLevel, spells: '' }] });
          renderGroups({ group: Math.max(0, groupIndex - 1), control: 'heading' });
        });
        groupHead.append(headingLabel, removeGroup);
        card.append(groupHead);

        group.lines.forEach((line, lineIndex) => {
          const row = element('div', 'statblock-forge__spell-editor-line');
          const levelLabel = element('label', 'statblock-forge__spell-editor-control statblock-forge__spell-editor-level-control');
          levelLabel.append(makeEditorLabel(pt ? 'Uso / categoria' : 'Use / category'));
          const levelInput = element('input', 'atlas-sb-pane-input');
          levelInput.type = 'text';
          levelInput.value = line.level;
          levelInput.placeholder = pt ? 'Ex.: 3 usos/dia, Fase 1, Recarga 5–6' : 'e.g. 3 uses/day, Phase 1, Recharge 5–6';
          levelInput.setAttribute('aria-label', pt ? 'Categoria ou frequência do valor' : 'Value category or frequency');
          levelInput.dataset.spellGroupIndex = String(groupIndex);
          levelInput.dataset.spellLineIndex = String(lineIndex);
          levelInput.dataset.spellControl = 'level';
          levelInput.addEventListener('input', () => { line.level = levelInput.value; error.hidden = true; primaryControl?.removeAttribute('aria-invalid'); });
          levelLabel.append(levelInput);

          const valuesLabel = element('label', 'statblock-forge__spell-editor-control statblock-forge__spell-editor-names-control');
          valuesLabel.append(makeEditorLabel(pt ? 'Valores' : 'Values'));
          const valuesInput = element('input', 'atlas-sb-pane-input');
          valuesInput.type = 'text';
          valuesInput.value = line.spells;
          valuesInput.placeholder = pt ? 'Ex.: Furtividade, Escalada, Natação' : 'e.g. Stealth, Climbing, Swimming';
          valuesInput.setAttribute('aria-label', pt ? 'Nomes dos valores, separados por vírgula' : 'Value names, separated by commas');
          valuesInput.dataset.spellGroupIndex = String(groupIndex);
          valuesInput.dataset.spellLineIndex = String(lineIndex);
          valuesInput.dataset.spellControl = 'spells';
          valuesInput.addEventListener('input', () => { line.spells = valuesInput.value; error.hidden = true; primaryControl?.removeAttribute('aria-invalid'); });
          valuesLabel.append(valuesInput);

          const removeLine = buttonText(element('button', 'statblock-forge__spell-editor-remove'), '×');
          removeLine.setAttribute('aria-label', pt ? 'Remover linha de valores' : 'Remove value row');
          removeLine.title = removeLine.getAttribute('aria-label') ?? '';
          removeLine.addEventListener('click', () => {
            group.lines.splice(lineIndex, 1);
            renderGroups({ group: groupIndex, control: 'heading' });
          });
          row.append(levelLabel, valuesLabel, removeLine);
          card.append(row);
        });

        const addLine = buttonText(element('button', 'statblock-forge__spell-editor-add-line'), pt ? '+ Adicionar categoria / uso' : '+ Add category / use');
        addLine.addEventListener('click', () => {
          group.lines.push({ level: defaultLevel, spells: '' });
          renderGroups({ group: groupIndex, line: group.lines.length - 1, control: 'spells' });
        });
        card.append(addLine);
        groupsRoot.append(card);
      });

      if (focus) {
        const selector = `[data-spell-group-index="${focus.group}"]${focus.line === undefined ? '' : `[data-spell-line-index="${focus.line}"]`}[data-spell-control="${focus.control}"]`;
        groupsRoot.querySelector<HTMLInputElement>(selector)?.focus();
      }
    };

    renderGroups();
    saveGroups.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      requireGroupValue = true;
      saveGroups.dispatchEvent(new CustomEvent('forge:finish-field', {
        bubbles: true,
        detail: { fieldKey: field.key },
      }));
    });
    addGroup.addEventListener('click', () => {
      groups.push({
        heading: pt ? 'Grupo adicional' : 'Additional group',
        lines: [{ level: defaultLevel, spells: '' }],
      });
      renderGroups({ group: groups.length - 1, control: 'heading' });
    });

    const persist = (): Promise<boolean> => {
      if (inFlight) return inFlight.then((saved) => saved ? persist() : false);
      const nextValue = serializeInlineSpellGroups(groups, defaultLevel);
      if (!groups.some((group) => group.lines.some((line) => line.spells.trim().length > 0))) {
        if (!requireGroupValue) return Promise.resolve(true);
        error.textContent = pt ? 'Adicione pelo menos um valor antes de concluir.' : 'Add at least one value before finishing.';
        error.hidden = false;
        primaryControl?.setAttribute('aria-invalid', 'true');
        return Promise.resolve(false);
      }
      const serialized = JSON.stringify(nextValue);
      if (serialized === lastCommitted) return Promise.resolve(true);
      error.hidden = true;
      primaryControl?.removeAttribute('aria-invalid');
      inFlight = runtime.setBaseValue(field.key, nextValue).then(() => {
        lastCommitted = serialized;
        return true;
      }).catch((caught: unknown) => {
        error.textContent = caught instanceof Error ? caught.message : String(caught);
        error.hidden = false;
        primaryControl?.setAttribute('aria-invalid', 'true');
        return false;
      }).finally(() => { inFlight = null; });
      return inFlight;
    };

    // Keep Tab navigation inside this multi-control editor, then hand off to
    // Atlas' shared Field navigation at the first/last control boundary.
    layer.addEventListener('keydown', (event) => {
      if (!(event instanceof KeyboardEvent)) return;
      if (event.key === 'Escape' && event.target !== primaryControl) {
        event.preventDefault();
        event.stopPropagation();
        primaryControl?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: false }));
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(layer.querySelectorAll<HTMLElement>(
        'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])',
      ));
      const index = controls.indexOf(event.target as HTMLElement);
      const atBoundary = event.shiftKey ? index === 0 : index === controls.length - 1;
      if (index < 0 || !atBoundary) return;
      event.preventDefault();
      event.stopPropagation();
      void runtime.navigate(field.key, event.shiftKey ? -1 : 1);
    });

    // The shared inline editor listens to its primary control for navigation.
    // Let the editor's own boundary handler manage Tab for every control.
    const control = primaryControl ?? element('input');
    return {
      fieldKey: field.key,
      control,
      commit: persist,
      close: () => {
        slot.close(layer, display);
        redraw();
      },
      handleKeyDown: (event) => event.key === 'Tab',
    };
  }, display);
  runtime.subscribe(field.key, () => {
    if (!slot.slot.classList.contains('is-editing')) redraw();
  });
  return slot.slot;
}

function renderCheckboxes(
  block: ForgeBlock,
  field: ForgeField | undefined,
  data: JsonRecord,
  onFieldValueChange?: (fieldKey: string, value: unknown) => Promise<void> | void,
  numericRuntime?: NumericFieldRuntime,
): HTMLElement {
  const wrapper = element('div', 'statblock-forge__preview-checkboxes');
  const label = visibleFieldBlockLabel(block, block.label, field, block.field, true, false);
  if (label) wrapper.append(element('strong', 'statblock-forge__preview-block-heading', label));
  if (!field || field.type !== 'checkboxes') {
    return wrapper;
  }
  const options = checkboxFieldOptions(field);
  if (options.length === 0) {
    wrapper.append(markForgeUiText(element('span', 'statblock-forge__hint', 'Nenhuma opção configurada.'), 'Nenhuma opção configurada.'));
    return wrapper;
  }
  const list = element('div', 'statblock-forge__preview-checkboxes-list');
  const syncCheckboxInputs = (): void => {
    for (const input of Array.from(list.querySelectorAll<HTMLInputElement>('input[data-checkbox-option-key]'))) {
      const optionKey = input.dataset.checkboxOptionKey;
      if (optionKey) input.checked = checkboxOptionIsEnabled(data, field, optionKey);
    }
  };
  for (const option of options) {
    const optionLabel = element('label', 'statblock-forge__preview-checkbox-option');
    const checkbox = element('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checkboxOptionIsEnabled(data, field, option.key);
    checkbox.dataset.checkboxFieldKey = field.key;
    checkbox.dataset.checkboxOptionKey = option.key;
    checkbox.setAttribute('aria-label', `${option.label} (${field.key}.${option.key})`);
    checkbox.addEventListener('change', () => {
      const hadPrevious = Object.prototype.hasOwnProperty.call(data, field.key);
      const previous = data[field.key];
      const next = withCheckboxOptionValue(data, field, option.key, checkbox.checked);
      data[field.key] = next;
      syncCheckboxInputs();
      numericRuntime?.refreshAll();
      try {
        const result = onFieldValueChange?.(field.key, next);
        if (result && typeof (result as Promise<void>).then === 'function') {
          void (result as Promise<void>).catch(() => {
            if (hadPrevious) data[field.key] = previous;
            else delete data[field.key];
            syncCheckboxInputs();
            numericRuntime?.refreshAll();
          });
        }
      } catch {
        if (hadPrevious) data[field.key] = previous;
        else delete data[field.key];
        syncCheckboxInputs();
        numericRuntime?.refreshAll();
      }
    });
    optionLabel.append(checkbox, document.createTextNode(option.label));
    optionLabel.title = `${field.key}.${option.key}`;
    list.append(optionLabel);
  }
  wrapper.append(list);
  return wrapper;
}

function renderLeafBlock(
  app: App,
  markdownComponent: Component,
  sourcePath: string,
  block: ForgeBlock,
  fields: readonly ForgeField[],
  sample: JsonRecord,
  layout: ForgeLayoutDocument,
  resolveImage?: (path: string) => string | undefined,
  onScoreTableEdit?: (blockId: string, edit: ScoreTableEdit) => void,
  interactiveCounters = false,
  insideTab = false,
  language: ForgeLanguage = 'en',
  onAbilityCounterMaxChange?: (fieldKey: string, entryIndex: number) => void,
  numericRuntime?: NumericFieldRuntime,
  onFieldValueChange?: (fieldKey: string, value: unknown) => Promise<void> | void,
  onImageFieldAction?: (fieldKey: string, socket: HTMLButtonElement) => void,
  onImageBlockSelect?: (blockId: string) => void,
  imageFrames?: Readonly<StatblockImageFrames>,
  onImageFrameChange?: (blockId: string, frame: StatblockImageFrame) => void,
  header?: JsonRecord,
  sourceBlocks: readonly ForgeBlock[] = [],
): HTMLElement {
  const key = typeof block.field === 'string' ? block.field : '';
  const field = fieldOf(fields, key);
  switch (block.type) {
    case 'divider': {
      const separator = element('span', 'statblock-forge__preview-divider');
      separator.setAttribute('role', 'separator');
      separator.setAttribute('aria-orientation', 'horizontal');
      return separator;
    }
    case 'vertical-divider': {
      const separator = element('span', 'statblock-forge__preview-vertical-divider');
      separator.setAttribute('role', 'separator');
      separator.setAttribute('aria-orientation', 'vertical');
      return separator;
    }
    case 'heading': {
      const heading = element('div', `statblock-forge__preview-heading is-${block.level === 'minor' ? 'minor' : 'section'}`);
      applyTextWithBasicMarkdown(heading, String(block.text ?? 'Novo título'));
      return heading;
    }
    case 'title': return renderTitle(app, markdownComponent, sourcePath, block, fields, sample, numericRuntime);
    case 'line': {
      const keys = Array.isArray(block.fields) ? block.fields.filter((value): value is string => typeof value === 'string') : [];
      const line = element('div', 'statblock-forge__preview-line');
      const pattern = expandedPattern(block.pattern, sample);
      if (pattern !== null) {
        line.textContent = pattern;
        numericRuntime?.subscribeAll(() => {
          const next = expandedPattern(block.pattern, sample);
          if (next !== null && line.textContent !== next) line.textContent = next;
        });
      } else keys.forEach((fieldKey, index) => {
        if (index) line.append(document.createTextNode(typeof block.separator === 'string' ? block.separator : ' · '));
        const field = fieldOf(fields, fieldKey);
        const raw = sample[fieldKey];
        const useFormula = field?.type === 'number' || field?.type === 'rating';
        const label = isBlockLabelHidden(block) ? '' : fieldLabel(field, fieldKey);
        if (label) line.append(markInlineFieldNameForEdit(
          element('strong', 'statblock-forge__preview-line-label', `${label} `),
          field, numericRuntime, Boolean(field && (useFormula || isInlineTextField(field))),
        ));
        if (useFormula && field) {
          line.append(renderNumericFieldValue(field, sample, numericRuntime, false, 'statblock-forge__preview-line-value'));
        } else if (field?.type === 'dice' && hasDiceFieldFormula(field)) {
          line.append(createInlineTextFieldValue(app, markdownComponent, sourcePath, field, sample, numericRuntime, 'statblock-forge__preview-line-value'));
        } else if (isInlineTextField(field) && numericRuntime?.canEdit) {
          line.append(createInlineTextFieldValue(app, markdownComponent, sourcePath, field, sample, numericRuntime, 'statblock-forge__preview-line-value'));
        } else if (field?.type === 'markdown' && raw !== undefined && raw !== null && raw !== '') {
          const markdown = element('div', 'statblock-forge__preview-line-value atlas-sb-prose');
          renderAtlasMarkdown(app, markdownComponent, sourcePath, markdown, readablePreviewValue(raw));
          line.append(markdown);
        } else {
          const value = readablePreviewValue(raw);
          line.append(element('span', 'statblock-forge__preview-line-value', value || '—'));
        }
      });
      return line;
    }
    case 'stat': return renderStat(app, markdownComponent, sourcePath, block, fields, sample, layout, sourceBlocks, header, numericRuntime);
    case 'metric': return renderMetric(app, markdownComponent, sourcePath, block, fields, sample, layout, numericRuntime, Boolean(onScoreTableEdit));
    case 'scores': return renderScores(app, markdownComponent, sourcePath, block, sample, fields, layout, resolveImage, onScoreTableEdit
      ? (edit) => onScoreTableEdit(block.id, edit)
      : undefined, numericRuntime);
    case 'tags': return renderTags(block, field, sample, layout, numericRuntime, language);
    case 'text': {
      const wrapper = element('div', 'statblock-forge__preview-text');
      // A linked Field is the source of truth even if an older editor version
      // left a literal block.text value behind. Otherwise a Markdown Field can
      // silently turn into a static text block and never expose its textarea.
      const isFieldSource = typeof block.field === 'string' && block.field.trim().length > 0;
      const textHeading = visibleFieldBlockLabel(block, block.heading, isFieldSource ? field : undefined, key, false, false);
      if (textHeading) wrapper.append(markInlineFieldNameForEdit(
        element('strong', 'statblock-forge__preview-block-heading', textHeading),
        isFieldSource ? field : undefined, numericRuntime, isFieldSource && isInlineTextField(field),
      ));
      const value = isFieldSource ? readablePreviewValue(valueOf(sample, key)) : block.text as string;
      const content = element('div', 'atlas-sb-prose statblock-forge__preview-text-content');
      if (isFieldSource && field?.type === 'dice' && hasDiceFieldFormula(field)) content.append(createInlineTextFieldValue(app, markdownComponent, sourcePath, field, sample, numericRuntime));
      else if (isFieldSource && isInlineTextField(field) && numericRuntime?.canEdit) content.append(createInlineTextFieldValue(app, markdownComponent, sourcePath, field, sample, numericRuntime));
      else if (value) renderAtlasMarkdown(app, markdownComponent, sourcePath, content, value);
      else markForgeUiText(content, 'Nenhum texto de exemplo.');
      wrapper.append(content);
      return wrapper;
    }
    case 'entries': return renderEntries(block, field, sample, layout, interactiveCounters, insideTab, onAbilityCounterMaxChange, numericRuntime, language);
    case 'pairs': return renderPairs(block, field, sample, layout, numericRuntime, language);
    case 'track': return renderTrack(block, field, sample, layout, fields, numericRuntime);
    case 'counters': return renderCounters(block, field, sample, layout, language, numericRuntime);
    case 'checkboxes': return renderCheckboxes(block, field, sample, onFieldValueChange, numericRuntime);
    case 'image': {
      const appearance = layout.blocks[block.id]?.appearance ?? {};
      return renderImage(block, field, sample, resolveImage, onImageFieldAction, imageFrames?.[block.id] ?? imageFrameForLayoutBlock(layout, block.id), onImageFrameChange, onImageBlockSelect, {
        x: Number(appearance.imagePositionX ?? 50),
        y: Number(appearance.imagePositionY ?? 50),
      });
    }
    case 'spells': return renderGroups(block, field, sample, fields, layout, language, numericRuntime);
    case 'script': return markForgeUiText(element('span', 'statblock-forge__hint', 'Bloco Script preservado; código não é executado na prévia independente.'), 'Bloco Script preservado; código não é executado na prévia independente.');
    case 'opaque': { const message = `Bloco desconhecido preservado: ${String(block.type ?? 'opaque')}.`; return markForgeUiText(element('span', 'statblock-forge__hint', message), message); }
    case 'section':
    case 'row':
    case 'tabs': return markForgeUiText(element('span', 'statblock-forge__container-empty', 'Container sem conteúdo.'), 'Container sem conteúdo.');
    default: { const message = `Bloco não suportado: ${block.type}.`; return markForgeUiText(element('span', 'statblock-forge__hint', message), message); }
  }
}

function sectionHeading(block: ForgeBlock, sample: JsonRecord): string {
  const fromField = typeof block.headingField === 'string' ? readablePreviewValue(sample[block.headingField]) : '';
  return fromField || (typeof block.heading === 'string' ? block.heading.trim() : '');
}

const ATLAS_FS_TYPE_BY_FORGE_BLOCK: Readonly<Record<string, string | undefined>> = {
  section: 'group', row: 'inline', tabs: 'group', title: 'heading', heading: 'text', line: 'subheading',
  stat: 'property', metric: 'table', scores: 'table', tags: 'property', text: 'text', entries: 'traits',
  pairs: 'saves', track: 'property', counters: 'property', checkboxes: 'property', image: 'image', spells: 'spells',
  divider: undefined, script: 'javascript', opaque: undefined,
};

const ATLAS_FIT_BLOCK_TYPES = new Set(['stat', 'track', 'image']);

function atlasBlockLook(block: ForgeBlock): string | undefined {
  if (['stat', 'tags', 'track'].includes(block.type) && typeof block.look === 'string') return block.look;
  // Table orientation was a legacy second presentation. Forge Tables now use
  // the same grid presentation regardless of saved legacy orientation values.
  if (block.type === 'image' && typeof block.shape === 'string') return block.shape;
  return undefined;
}

function atlasBlockRowSize(block: ForgeBlock): 'fit' | 'fill' {
  return block.size === 'fit' || block.size === 'fill'
    ? block.size
    : ATLAS_FIT_BLOCK_TYPES.has(block.type) ? 'fit' : 'fill';
}

function isAtlasLineBlock(block: ForgeBlock): boolean {
  return (block.type === 'stat' && block.look === 'run-in')
    || block.type === 'pairs'
    || (block.type === 'tags' && block.look === 'comma');
}

function applyAtlasBlockFrame(node: HTMLElement, block: ForgeBlock): void {
  node.classList.add('atlas-sb-item', `atlas-sb-item--${atlasBlockRowSize(block)}`);
  if (isAtlasLineBlock(block)) node.classList.add('atlas-sb-item--line');
  const fsType = ATLAS_FS_TYPE_BY_FORGE_BLOCK[block.type];
  if (fsType) node.dataset.type = fsType;
  node.dataset.block = block.type;
  if (typeof block.field === 'string' && block.field) node.dataset.prop = block.field;
  if (typeof block.className === 'string' && block.className.trim()) node.dataset.cls = block.className;
  node.dataset.blockId = block.id;
  const look = atlasBlockLook(block);
  if (look) node.dataset.look = look;
}

function nestedBlocks(block: ForgeBlock): ForgeBlock[] {
  return Array.isArray(block.blocks)
    ? block.blocks.filter((child): child is ForgeBlock =>
      Boolean(child && typeof child === 'object' && 'id' in child && 'type' in child),
    )
    : [];
}

/** True when the Forge sidecar marks this block as completely hidden. */
function isTotalHiddenBlock(layout: ForgeLayoutDocument, block: ForgeBlock): boolean {
  return layout.blocks[block.id]?.visibility === 'total-hidden';
}

/** Collect all nodes removed from the final layout; Total Hidden never gets a footer action. */
function collectOmittedBlockIds(
  blocks: readonly ForgeBlock[],
  layout: ForgeLayoutDocument,
  options: StatblockRenderOptions,
  expandedSectionIds: ReadonlySet<string>,
  collapsedSectionIds: ReadonlySet<string>,
): { omittedIds: Set<string>; totalHiddenIds: Set<string> } {
  const omittedIds = new Set<string>();
  const totalHiddenIds = new Set<string>();
  const markTotalHiddenTree = (block: ForgeBlock): void => {
    totalHiddenIds.add(block.id);
    omittedIds.add(block.id);
    nestedBlocks(block).forEach(markTotalHiddenTree);
  };
  const visit = (siblings: readonly ForgeBlock[]): void => {
    for (const block of siblings) {
      if (options.hideTotalHiddenBlocks === true && isTotalHiddenBlock(layout, block)) {
        markTotalHiddenTree(block);
        continue;
      }
      const foldable = options.foldSectionsIntoFooter === true && block.type === 'section'
        && (block.collapsible === 'open' || block.collapsible === 'closed');
      if (foldable && !isFoldedSectionExpanded(block.id, block.collapsible === 'open', {
        expanded: expandedSectionIds,
        collapsed: collapsedSectionIds,
      })) omittedIds.add(block.id);
      const children = nestedBlocks(block);
      if (block.type === 'tabs') {
        // A Section directly under Tabs is a tab panel, not a footer-folded Section.
        for (const tab of children) {
          if (options.hideTotalHiddenBlocks === true && isTotalHiddenBlock(layout, tab)) {
            markTotalHiddenTree(tab);
            continue;
          }
          visit(nestedBlocks(tab));
        }
      } else if (children.length > 0) {
        visit(children);
      }
    }
  };
  visit(blocks);
  return { omittedIds, totalHiddenIds };
}

function registerFoldableSection(
  uiState: StatblockLayoutUiState | undefined,
  block: ForgeBlock,
  sample: JsonRecord,
  options: StatblockRenderOptions,
): void {
  if (!uiState || block.type !== 'section' || options.foldSectionsIntoFooter !== true
    || (block.collapsible !== 'open' && block.collapsible !== 'closed')
    || uiState.totalHiddenIds.has(block.id)
    || uiState.foldableSections.some((item) => item.id === block.id)) return;
  // No Label only changes the Section's own rendered heading. The footer
  // remains a navigation list, so it keeps the configured heading when one exists.
  const heading = sectionHeading(block, sample);
  if (!heading.trim()) uiState.unnamedSectionCount += 1;
  const label = foldedSectionFooterLabel(
    heading,
    options.language === 'pt-BR' ? 'pt-BR' : 'en',
    uiState.unnamedSectionCount,
  );
  const initiallyExpanded = block.collapsible === 'open';
  uiState.foldableSections.push({
    id: block.id,
    // The footer needs a distinct target even when the actual Section label is intentionally hidden.
    label,
    initiallyExpanded,
    expanded: isFoldedSectionExpanded(block.id, initiallyExpanded, {
      expanded: uiState.expandedSectionIds,
      collapsed: uiState.collapsedSectionIds,
    }),
  });
}

function renderBlockNode(
  block: ForgeBlock,
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  sample: JsonRecord,
  options: StatblockRenderOptions,
  placement?: { x: number; y: number; span: number; rows: number },
  insideTab = false,
  language: ForgeLanguage = 'en',
  uiState?: StatblockLayoutUiState,
): HTMLElement {
  const node = element('div', `atlas-sb-item statblock-forge__preview-block is-${block.type}`);
  applyAtlasBlockFrame(node, block);
  const boundField = typeof block.field === 'string'
    ? template.fields.find((candidate) => candidate.key === block.field)
    : undefined;
  // Vertical scrolling is reserved for block types whose row/line count can
  // be changed directly from the rendered statblock. Fixed-layout values,
  // counters, metrics, images and decorative blocks never receive this flag.
  const supportsInlineRowCountChanges = (
    (block.type === 'entries' && boundField?.type === 'entries')
    || (block.type === 'scores' && boundField?.type === 'scores')
    || (block.type === 'spells' && boundField?.type === 'spells')
  );
  node.classList.toggle('is-forge-row-count-editable', supportsInlineRowCountChanges);
  node.dataset.blockType = block.type;
  node.tabIndex = -1;
  applyBlockAppearance(node, block, layout);
  applyGridPlacement(node, placement);
  // Every descendant Grid uses the root statblock's global tracks. Do not
  // shrink the grid's column count to the containing block's physical span.
  if (block.type === 'section') node.append(renderSection(block, template, layout, sample, options, false, uiState));
  else if (block.type === 'row') node.append(renderRow(block, template, layout, sample, options, uiState));
  else if (block.type === 'tabs') node.append(renderTabs(block, template, layout, sample, options, uiState));
  else {
    const source = renderLeafBlock(
      options.app, options.markdownComponent!, options.sourcePath ?? '', block, template.fields, sample, layout, options.resolveImage, options.onScoreTableEdit,
      options.interactiveCounters, insideTab, options.language ?? 'en', options.onAbilityCounterMaxChange, options.numericFieldRuntime, options.onFieldValueChange, options.onImageFieldAction, options.onImageBlockSelect, options.imageFrames, options.onImageFrameChange, template.header, template.layout.blocks,
    );
    node.append(source);
    appendWhenEmptyFallback(node, source, block, sample, options);
  }
  return node;
}

/**
 * Keeps the real Forge block mounted for inline editing, but overlays the
 * configured fallback while every Field used by the block is empty. Hide and
 * Fold are intentionally not interpreted here: those remain Forge layout
 * behaviors and are handled by their own mechanisms.
 */
function appendWhenEmptyFallback(
  blockNode: HTMLElement,
  sourceNode: HTMLElement,
  block: ForgeBlock,
  sample: JsonRecord,
  options: StatblockRenderOptions,
): void {
  if (block.whenEmpty !== 'fallback' || typeof block.fallback !== 'string' || !block.fallback.trim()) return;
  if (whenEmptyFallbackSourceFieldKeys(block, options.template.fields).length === 0) return;

  const fieldKey = typeof block.field === 'string' ? block.field : '';
  const field = fieldOf(options.template.fields, fieldKey);
  const overlay = element('div', `statblock-forge__preview-when-empty-fallback${block.type === 'title' ? ' atlas-sb-heading statblock-forge__preview-title' : ''}${block.type === 'line' ? ' statblock-forge__preview-line' : ''}`);
  overlay.setAttribute('aria-hidden', 'true');
  overlay.hidden = true;

  let heading = '';
  let headingClass = 'statblock-forge__preview-block-heading';
  let stacked = false;
  let statValue = false;
  switch (block.type) {
    case 'stat':
      heading = visibleFieldBlockLabel(block, block.label, field, fieldKey);
      headingClass = 'atlas-sb-label statblock-forge__preview-stat-label';
      stacked = block.labelPlacement === 'above' || block.look === 'stacked';
      statValue = true;
      overlay.classList.add('atlas-sb-labelled', `atlas-sb-labelled--${stacked ? 'stacked' : 'run-in'}`, 'atlas-sb-stat', 'statblock-forge__preview-stat');
      if (stacked) overlay.classList.add('is-stacked');
      else overlay.classList.add('is-run-in');
      if (block.labelPlacement === 'above') overlay.classList.add('is-above-label');
      break;
    case 'tags':
      heading = visibleFieldBlockLabel(block, block.label, field, fieldKey, true, false);
      stacked = block.look !== 'comma';
      break;
    case 'pairs':
      heading = visibleFieldBlockLabel(block, block.label, field, fieldKey, true, false);
      break;
    case 'track':
    case 'counters':
    case 'checkboxes':
      heading = visibleFieldBlockLabel(block, block.label, field, fieldKey, true, false);
      stacked = true;
      break;
    case 'text':
      heading = visibleFieldBlockLabel(block, block.heading, field, fieldKey, false, false);
      stacked = true;
      break;
    case 'entries':
    case 'spells':
    case 'metric':
      heading = isBlockLabelHidden(block) ? '' : (typeof block.heading === 'string' ? block.heading.trim() : '');
      stacked = true;
      break;
    default:
      break;
  }

  const labelNode = heading ? element('strong', headingClass, heading) : null;
  const content = element('div', `statblock-forge__preview-when-empty-fallback-content${statValue ? ' atlas-sb-value statblock-forge__preview-stat-value' : ''}`);
  if (statValue && block.labelPlacement === 'above') {
    overlay.append(content);
    if (labelNode) overlay.append(labelNode);
  } else {
    if (labelNode) overlay.append(labelNode);
    overlay.append(content);
  }
  if (stacked && !statValue) overlay.classList.add('is-stacked');
  if (statValue && !heading) overlay.classList.add('is-value-only');
  blockNode.append(overlay);

  let lastRenderedText: string | null = null;
  let wasActive = false;
  const sync = (): void => {
    const expanded = expandedPattern(block.fallback, sample) ?? '';
    const active = shouldShowWhenEmptyFallback(block, sample, options.template.fields) && expanded.trim().length > 0;
    if (active !== wasActive) {
      wasActive = active;
      blockNode.classList.toggle('is-showing-when-empty-fallback', active);
      sourceNode.classList.toggle('is-when-empty-fallback-source', active);
      overlay.hidden = !active;
    }
    if (!active || expanded === lastRenderedText) return;
    lastRenderedText = expanded;
    renderAtlasMarkdown(
      options.app,
      options.markdownComponent!,
      options.sourcePath ?? '',
      content,
      expanded,
    );
  };

  sync();
  options.numericFieldRuntime?.subscribeAll(sync);
}

function renderBlockList(
  blocks: readonly ForgeBlock[],
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  sample: JsonRecord,
  options: StatblockRenderOptions,
  context: 'root' | 'section' = 'root',
  insideTab = false,
  language: ForgeLanguage = 'en',
  uiState?: StatblockLayoutUiState,
): HTMLElement {
  const safeColumns = Math.max(4, Math.min(MAX_GRID_COLUMN_COUNT, Math.round(layout.columns || DEFAULT_GRID_COLUMN_COUNT)));
  const grid = element('div', `statblock-forge__preview-grid atlas-sb-forge-grid${context === 'section' ? ' atlas-sb-stack' : ' is-root'} is-${context}${layout.dense ? ' is-dense' : ''}`);
  grid.dataset.columnCount = String(safeColumns);
  grid.setCssProps({ ['--forge-grid-column-count']: String(safeColumns) });
  const nodeById = new Map<string, HTMLElement>();
  for (const block of blocks) {
    registerFoldableSection(uiState, block, sample, options);
    const node = renderBlockNode(block, template, layout, sample, options, undefined, insideTab, language, uiState);
    nodeById.set(block.id, node);
    grid.append(node);
  }
  const updatePlacements = (): void => {
    const omittedIds = uiState?.omittedIds ?? new Set<string>();
    const placements = packVisibleGrid(blocks, layout, omittedIds, sample);
    const placementById = new Map(placements.map((placement) => [placement.id, placement]));
    for (const block of blocks) {
      const node = nodeById.get(block.id);
      if (!node) continue;
      const omitted = omittedIds.has(block.id);
      node.hidden = omitted;
      if (!omitted) applyGridPlacement(node, placementById.get(block.id));
    }
  };
  if (uiState) uiState.gridUpdates.push(updatePlacements);
  updatePlacements();
  if (blocks.length === 0) grid.append(markForgeUiText(element('div', 'statblock-forge__container-empty is-grid-placeholder', 'Este container ainda não possui blocos.'), 'Este container ainda não possui blocos.'));
  if (context === 'root') syncSquareGridTrackHeight(grid);
  return grid;
}

/**
 * Measure the standard square track once at the root Grid. Every nested
 * Section Grid inherits this value; it must not recompute row height from its
 * own narrower width or the dimensions of its containing Section.
 */
function syncSquareGridTrackHeight(grid: HTMLElement): void {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return;

  let resizeObserver: ResizeObserver | undefined;
  const measure = (): void => {
    window.requestAnimationFrame(() => {
      if (!grid.isConnected) {
        resizeObserver?.disconnect();
        return;
      }

      const geometry = readTemplateGridGeometry(grid);
      const squareTrackSize = geometry.columnWidths[0] ?? 1;
      if (squareTrackSize <= 0) return;
      const nextTrackSize = `${squareTrackSize.toFixed(4).replace(/\.?0+$/, '')}px`;
      if (grid.style.getPropertyValue('--forge-preview-grid-row-height') !== nextTrackSize) {
        grid.setCssProps({ ['--forge-preview-grid-row-height']: nextTrackSize });
      }
    });
  };

  measure();
  let observedWidth = readTemplateGridGeometry(grid).contentWidth;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      if (!grid.isConnected) {
        resizeObserver?.disconnect();
        return;
      }
      const nextWidth = entries[0]?.contentRect.width ?? readTemplateGridGeometry(grid).contentWidth;
      if (Math.abs(nextWidth - observedWidth) < 0.01) return;
      observedWidth = nextWidth;
      measure();
    });
    resizeObserver.observe(grid);
  } else {
    window.addEventListener('resize', measure, { passive: true });
  }
}

function renderSection(
  block: ForgeBlock,
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  sample: JsonRecord,
  options: StatblockRenderOptions,
  inTab: boolean,
  uiState?: StatblockLayoutUiState,
): HTMLElement {
  const heading = isBlockLabelHidden(block) && !inTab ? '' : sectionHeading(block, sample);
  const wrapper = element(
    'section',
    `atlas-sb-section statblock-forge__preview-section${inTab ? ' is-tab-panel' : ''}${heading && !inTab ? ' has-heading' : ''}`,
  );
  const children = renderBlockList(list(block.blocks), template, layout, sample, options, 'section', inTab, options.language ?? 'en', uiState);
  // The nested Grid needs to identify its owning Section when a user drops a
  // block into empty space rather than onto one of its existing children.
  children.dataset.parentId = block.id;
  if (!inTab && options.foldSectionsIntoFooter !== true
    && (block.collapsible === 'open' || block.collapsible === 'closed')) {
    const details = element('details', 'statblock-forge__preview-collapsible');
    details.open = block.collapsible === 'open';
    const summary = heading
      ? element('summary', 'atlas-sb-section-heading statblock-forge__preview-section-heading', heading)
      : isBlockLabelHidden(block)
        ? element('summary', 'atlas-sb-section-heading statblock-forge__preview-section-heading')
        : markForgeUiText(element('summary', 'atlas-sb-section-heading statblock-forge__preview-section-heading', 'Section'), 'Section');
    if (!heading) summary.setAttribute('aria-label', 'Section');
    details.append(summary, children);
    wrapper.append(details);
  } else {
    if (heading && !inTab) wrapper.append(element('h4', 'atlas-sb-section-heading statblock-forge__preview-section-heading', heading));
    wrapper.append(children);
  }
  return wrapper;
}

function renderRow(
  block: ForgeBlock,
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  sample: JsonRecord,
  options: StatblockRenderOptions,
  uiState?: StatblockLayoutUiState,
): HTMLElement {
  const align = block.align === 'center' || block.align === 'spread' ? block.align : 'start';
  const wrapper = element('div', `atlas-sb-row statblock-forge__preview-row align-${align}${layout.dense ? ' is-dense' : ''}`);
  wrapper.dataset.align = align;
  const children = list(block.blocks);
  const lines = groupRowChildrenBySpan(children, layout);
  const gapRem = layout.dense ? 0.18 : 0.5;
  const childNodes = new Map<string, HTMLElement>();
  const lineWrappers: Array<{ node: HTMLElement; children: ForgeBlock[] }> = [];
  for (const line of lines) {
    const lineSpans = line.map((child) => Math.max(1, Math.min(12, layout.blocks[child.id]?.span ?? 6)));
    const lineTotalSpan = lineSpans.reduce((total, span) => total + span, 0) || 1;
    const lineWrapper = element('div', `statblock-forge__preview-row-line align-${align}`);
    lineWrappers.push({ node: lineWrapper, children: line });
    for (const [index, child] of line.entries()) {
      registerFoldableSection(uiState, child, sample, options);
      const span = lineSpans[index] ?? 6;
      const gapShare = line.length > 1 ? ((line.length - 1) * gapRem * span / lineTotalSpan) : 0;
      const width = `calc(${(span / 12 * 100).toFixed(4)}% - ${gapShare.toFixed(4)}rem)`;
      const node = renderBlockNode(child, template, layout, sample, options, undefined, false, options.language ?? 'en', uiState);
      node.setCssStyles({ flex: `0 1 ${width}` });
      node.setCssStyles({ width: width });
      node.setCssStyles({ minWidth: '0' });
      childNodes.set(child.id, node);
      lineWrapper.append(node);
    }
    wrapper.append(lineWrapper);
  }
  const updateRowChildren = (): void => {
    const lineRowsByIndex = requiredRowsForRowLines(
      lines,
      layout,
      uiState?.omittedIds ?? new Set<string>(),
      sample,
    );
    let totalRows = 0;
    lineWrappers.forEach((line, index) => {
      const lineRows = lineRowsByIndex[index] ?? 0;
      line.node.hidden = lineRows === 0;
      // Give every visual line a definite height matching its own Grid tracks.
      // Percentage-height children then resolve against this line instead of
      // stretching the first line to the full height of the entire Row.
      line.node.setCssStyles({ height: lineRows > 0
        ? `calc(${lineRows} * var(--forge-preview-grid-row-height, 3.5rem) + ${lineRows - 1} * var(--forge-preview-grid-row-gap, ${gapRem}rem))`
        : '0px' });
      totalRows += lineRows;
    });
    for (const child of children) {
      const node = childNodes.get(child.id);
      if (!node) continue;
      const omitted = uiState?.omittedIds.has(child.id) === true;
      node.classList.toggle('is-layout-omitted', omitted);
      node.setCssStyles({ visibility: omitted ? 'hidden' : '' });
      node.setCssStyles({ height: omitted ? '0' : '' });
      node.setCssStyles({ minHeight: omitted ? '0' : '' });
      node.setCssStyles({ maxHeight: omitted ? '0' : '' });
      node.setCssStyles({ overflow: omitted ? 'hidden' : '' });
      const rows = omitted ? 0 : requiredRowsForBlock(child, layout, false, uiState?.omittedIds, sample);
      node.dataset.contentRows = String(rows);
      if (!omitted && rows > 1) {
        const rowHeight = 'var(--forge-preview-grid-row-height, 3.5rem)';
        const rowGap = `var(--forge-preview-grid-row-gap, ${gapRem}rem)`;
        node.setCssStyles({ minHeight: `calc(${rows} * ${rowHeight} + ${rows - 1} * ${rowGap})` });
      } else if (!omitted) {
        node.setCssStyles({ minHeight: '' });
      }
    }
    wrapper.dataset.contentRows = String(Math.max(1, totalRows));
  };
  if (uiState) uiState.gridUpdates.push(updateRowChildren);
  updateRowChildren();
  if (children.length === 0) wrapper.append(markForgeUiText(element('div', 'statblock-forge__container-empty is-row-placeholder', 'Este container ainda não possui blocos.'), 'Este container ainda não possui blocos.'));
  return wrapper;
}

function renderTabs(
  block: ForgeBlock,
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  sample: JsonRecord,
  options: StatblockRenderOptions,
  uiState?: StatblockLayoutUiState,
): HTMLElement {
  const hasHeading = !isBlockLabelHidden(block) && typeof block.heading === 'string' && block.heading.trim().length > 0;
  const wrapper = element(
    'div',
    `atlas-sb-tabs statblock-forge__preview-tabs${hasHeading ? ' has-heading' : ''}`,
  );
  if (isAbilitiesTabs(template, block)) wrapper.dataset.forgeAbilitiesTabs = 'true';
  if (hasHeading) {
    wrapper.append(element('strong', 'statblock-forge__preview-block-heading', block.heading as string));
  }
  const children = list(block.blocks).filter((child) => !uiState?.omittedIds.has(child.id));
  const sections = children.filter((child) => child.type === 'section');
  const invalidChildren = children.filter((child) => child.type !== 'section');
  if (sections.length === 0) {
    wrapper.append(markForgeUiText(element('div', 'statblock-forge__container-empty is-tabs-placeholder', 'Adicione uma Section para criar uma aba.'), 'Adicione uma Section para criar uma aba.'));
  } else {
    const strip = element('div', 'statblock-forge__preview-tab-strip');
    strip.setAttribute('role', 'tablist');
    const panels = element('div', 'statblock-forge__preview-tab-panels');
    const buttons: HTMLButtonElement[] = [];
    const panelNodes: HTMLElement[] = [];
    sections.forEach((section, index) => {
      const hideTabLabel = isBlockLabelHidden(section);
      const heading = hideTabLabel ? '' : sectionHeading(section, sample);
      const fallbackTabLabel = `Aba ${index + 1}`;
      const tab = element('button', `statblock-forge__preview-tab${index === 0 ? ' is-active' : ''}`, hideTabLabel ? '' : heading || fallbackTabLabel);
      if (!heading && !hideTabLabel) tab.dataset.forgeUiText = fallbackTabLabel;
      tab.setAttribute('aria-label', heading || fallbackTabLabel);
      tab.type = 'button';
      tab.dataset.tabBlockId = section.id;
      tab.dataset.tabsBlockId = block.id;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      // A tab panel is an independent Grid, just like a normal Section.
      // Giving it the same tracks makes the tab's Section block itself
      // selectable/resizable, while its own children continue using the
      // Section's nested Grid.
      const panel = element(
        'div',
        `statblock-forge__preview-tab-panel statblock-forge__preview-grid is-section${layout.dense ? ' is-dense' : ''}`,
      );
      const panelColumns = Math.max(4, Math.min(MAX_GRID_COLUMN_COUNT, Math.round(layout.columns || DEFAULT_GRID_COLUMN_COUNT)));
      panel.dataset.columnCount = String(panelColumns);
      panel.setCssProps({ ['--forge-grid-column-count']: String(panelColumns) });
      panel.dataset.tabPanelId = section.id;
      panel.dataset.tabsBlockId = block.id;
      panel.setAttribute('role', 'tabpanel');
      panel.hidden = index !== 0;
      const sectionNode = element('div', 'atlas-sb-item statblock-forge__preview-block is-section');
      applyAtlasBlockFrame(sectionNode, section);
      sectionNode.dataset.blockType = 'section';
      sectionNode.tabIndex = -1;
      applyBlockAppearance(sectionNode, section, layout);
      const tabSectionPlacement = packPhysicalGrid([section], { ...layout, dense: true }, true, sample)[0];
      applyGridPlacement(sectionNode, tabSectionPlacement);
      sectionNode.append(renderSection(section, template, layout, sample, options, true, uiState));
      panel.append(sectionNode);
      tab.addEventListener('click', (event) => {
        if (tab.dataset.forgeDragActivate === 'true') {
          delete tab.dataset.forgeDragActivate;
          event.stopPropagation();
        }
        buttons.forEach((button) => {
          const active = button === tab;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        panelNodes.forEach((panelNode) => { panelNode.hidden = panelNode === panel ? false : true; });
      });
      buttons.push(tab);
      panelNodes.push(panel);
      strip.append(tab);
      panels.append(panel);
    });
    wrapper.append(strip, panels);
  }
  if (invalidChildren.length > 0) {
    const note = markForgeUiText(element('p', 'statblock-forge__warning', 'O Atlas exige que Tabs contenha somente Sections. Os filhos incompatíveis continuam preservados no template.'), 'O Atlas exige que Tabs contenha somente Sections. Os filhos incompatíveis continuam preservados no template.');
    wrapper.append(note);
  }
  return wrapper;
}

interface PreviewAncestorScrollPosition {
  element: HTMLElement;
  top: number;
  left: number;
}


/** Preserve Obsidian/workspace scrollports when a folded Section changes height. */
function readPreviewAncestorScrollPositions(root: HTMLElement): PreviewAncestorScrollPosition[] {
  const positions: PreviewAncestorScrollPosition[] = [];
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

/** Re-resolve scrollports from the actual footer button after every reflow. */
function readPreviewButtonScrollports(action: HTMLElement): HTMLElement[] {
  const scrollports: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  const view = action.ownerDocument.defaultView;
  let ancestor = action.parentElement;
  while (ancestor) {
    const style = view?.getComputedStyle(ancestor);
    const overflowY = style?.overflowY ?? '';
    const canScrollVertically = /^(auto|scroll|overlay|hidden)$/.test(overflowY)
      || ancestor.scrollHeight > ancestor.clientHeight + 1
      || ancestor.scrollTop !== 0;
    if (canScrollVertically) {
      scrollports.push(ancestor);
      seen.add(ancestor);
    }
    ancestor = ancestor.parentElement;
  }
  const documentScroller = action.ownerDocument.scrollingElement as HTMLElement | null;
  if (documentScroller && !seen.has(documentScroller)) scrollports.push(documentScroller);
  return scrollports;
}

/**
 * Resolve the real inline insets after the card is mounted. Theme padding and
 * borders are not stored in Forge's appearance sidecar, so a CSS-only fallback
 * of zero makes every nested level narrower when the active Atlas theme adds
 * its own block frame. Measuring each block independently prevents cumulative
 * width loss across Section -> Grid -> Block -> Section chains.
 */
function syncNestedLayoutInlineBleedsAfterMount(card: HTMLElement): void {
  const view = card.ownerDocument.defaultView;
  if (!view || typeof view.requestAnimationFrame !== 'function') return;
  view.requestAnimationFrame(() => {
    if (!card.isConnected) return;
    const blocks = card.querySelectorAll<HTMLElement>('.statblock-forge__preview-block');
    const readPx = (value: string): number => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    for (const block of Array.from(blocks)) {
      const computed = view.getComputedStyle(block);
      const bleed = resolveNestedLayoutInlineBleeds({
        fallbackStart: readPx(block.style.getPropertyValue('--forge-nested-inline-bleed-start')),
        fallbackEnd: readPx(block.style.getPropertyValue('--forge-nested-inline-bleed-end')),
        paddingStart: readPx(computed.paddingInlineStart || computed.paddingLeft),
        paddingEnd: readPx(computed.paddingInlineEnd || computed.paddingRight),
        borderStart: readPx(computed.borderInlineStartWidth || computed.borderLeftWidth),
        borderEnd: readPx(computed.borderInlineEndWidth || computed.borderRightWidth),
      });
      block.setCssProps({ ['--forge-nested-inline-bleed-start']: `${bleed.start}px` });
      block.setCssProps({ ['--forge-nested-inline-bleed-end']: `${bleed.end}px` });
    }
  });
}

/**
 * Canonical renderer for both final statblocks and the editor preview.
 * All block, Grid, container, Ability Part, and appearance rules flow through
 * this function. A final statblock never falls back to template.sample.
 */
export function renderStatblock(options: StatblockRenderOptions): HTMLElement {
  const model = createStatblockRenderModel(options.template, options.layout, options.data);
  const { template, layout, data } = model;
  const tableReferences = tableCellReferenceIndex(template.layout.blocks);
  const numericRuntime = createNumericFieldRuntime(
    template.fields, data, options.onFieldValueChange, options.language ?? 'en', options.getLiveFieldData,
    tableReferences,
  );
  const markdownComponent = options.markdownComponent ?? new Component();
  if (!options.markdownComponent) markdownComponent.load();
  const renderOptions: StatblockRenderOptions = { ...options, markdownComponent, numericFieldRuntime: numericRuntime };
  const card = element('div', 'atlas-statblock atlas-sb-sheet atlas-sb-sheet--full statblock-forge__statblock statblock-forge__preview-card');
  card.addEventListener(FORGE_STATBLOCK_SOURCE_DATA_CHANGED_EVENT, () => {
    numericRuntime.refreshCompendiumAvailability();
  });
  card.dataset.templateId = template.id;
  card.dataset.template = template.id;
  card.dataset.layout = template.id;
  card.dataset.renderSurface = 'statblock';
  card.dataset.dense = String(layout.dense);
  card.classList.toggle('is-dense', layout.dense);
  const customTheme = layout.customTheme;
  const themeId = customTheme ? 'custom' : normalizeStatblockThemeId(layout.themeId);
  card.dataset.forgeTheme = themeId;
  card.dataset.forgeAppearanceApplied = 'true';
  const themeOverride = customTheme?.palette ?? layout.themeOverrides?.[normalizeStatblockThemeId(themeId)];
  if (customTheme || themeId !== 'default' || (themeOverride && Object.keys(themeOverride).length > 0)) {
    const paletteForControls = customTheme?.palette ?? { ...themePaletteFor(themeId), ...themeOverride };
    card.setCssStyles({ colorScheme: colorSchemeForThemeBackground(paletteForControls.background) });
  }
  if (themeOverride && Object.keys(themeOverride).length > 0) {
    card.dataset.hasThemeOverrides = 'true';
    const cssVariables: Record<string, string> = {
      background: '--forge-theme-bg', surface: '--forge-theme-surface', raised: '--forge-theme-raised',
      border: '--forge-theme-border', accent: '--forge-theme-accent', accentStrong: '--forge-theme-accent-strong',
      text: '--forge-theme-text', muted: '--forge-theme-muted',
    };
    const obsidianVariables: Record<string, string[]> = {
      background: ['--background-primary'],
      surface: ['--background-primary-alt', '--background-secondary'],
      raised: ['--background-secondary-alt', '--background-modifier-form-field'],
      border: ['--background-modifier-border'],
      accent: ['--text-accent', '--interactive-accent'],
      accentStrong: ['--interactive-accent-hover'],
      text: ['--text-normal'],
      muted: ['--text-muted'],
    };
    const resolvedPalette = customTheme?.palette ?? { ...themePaletteFor(themeId), ...themeOverride };
    for (const [key, variable] of Object.entries(cssVariables)) {
      const value = resolvedPalette[key as keyof typeof resolvedPalette];
      if (typeof value !== 'string') continue;
      card.setCssProps({ [variable]: value });
      if (themeId === 'default') {
        for (const obsidianVariable of obsidianVariables[key] ?? []) card.setCssProps({ [obsidianVariable]: value });
      }
    }
  }
  const frame = layout.frame;
  if (frame) {
    card.dataset.forgeFrame = 'custom';
    card.dataset.forgeFrameInner = String(frame.inner);
    card.setCssProps({ ['--forge-frame-style']: frame.style });
    card.setCssProps({ ['--forge-frame-width']: `${frame.width}px` });
    card.setCssProps({ ['--forge-frame-color']: frame.color });
    card.setCssProps({ ['--forge-frame-radius']: `${frame.radius}px` });
    card.setCssProps({ ['--forge-frame-inner-color']: frame.innerColor });
    card.setCssProps({ ['--forge-frame-inner-width']: `${frame.innerWidth}px` });
    card.setCssProps({ ['--forge-frame-inner-gap']: `${frame.innerGap}px` });
  }
  const body = element('div', 'atlas-statblock-body statblock-forge__preview-body');
  body.append(sampleHeader(
    options.app, markdownComponent, options.sourcePath ?? '', template, layout, data,
    options.resolveImage, numericRuntime, options.onImageFieldAction, options.imageFrames,
    options.onImageFrameChange,
  ));
  const layoutHost = element('div', 'statblock-forge__layout-content');
  const expandedSectionIds = options.expandedSectionIds ?? new Set<string>();
  const collapsedSectionIds = options.collapsedSectionIds ?? new Set<string>();
  const omissions = collectOmittedBlockIds(
    list(template.layout.blocks), renderOptions.layout, renderOptions, expandedSectionIds, collapsedSectionIds,
  );
  const uiState: StatblockLayoutUiState = {
    omittedIds: omissions.omittedIds,
    totalHiddenIds: omissions.totalHiddenIds,
    expandedSectionIds,
    collapsedSectionIds,
    unnamedSectionCount: 0,
    foldableSections: [],
    gridUpdates: [],
  };
  const grid = renderBlockList(list(template.layout.blocks), template, layout, data, renderOptions, 'root', false, options.language ?? 'en', uiState);
  layoutHost.append(grid);
  const footerButtons = new Map<string, HTMLButtonElement>();
  let foldedSectionScrollRestoreSequence = 0;
  // Keep pointer coordinates per button. A WeakMap avoids the pointerup/RAF
  // race in which a global pending snapshot could be cleared before click.
  const pointerAnchors = new WeakMap<HTMLButtonElement, { clientY: number; buttonOffsetY: number }>();
  const capturePointerAnchor = (event: MouseEvent | PointerEvent, action: HTMLButtonElement): void => {
    if (event.button !== 0 || pointerAnchors.has(action)) return;
    const rect = action.getBoundingClientRect();
    pointerAnchors.set(action, {
      clientY: event.clientY,
      buttonOffsetY: event.clientY - rect.top,
    });
  };
  if (uiState.foldableSections.length > 0) {
    const footer = element('div', 'statblock-forge__folded-section-footer');
    for (const section of uiState.foldableSections) {
      const action = element('button', 'statblock-forge__folded-section-button', section.label);
      action.type = 'button';
      action.dataset.sectionId = section.id;
      action.classList.toggle('is-expanded', section.expanded);
      action.setAttribute('aria-expanded', String(section.expanded));
      const actionLabel = (expanded: boolean): string => options.language === 'pt-BR'
        ? `${expanded ? 'Recolher' : 'Mostrar'} seção: ${section.label}`
        : `${expanded ? 'Collapse' : 'Show'} section: ${section.label}`;
      action.setAttribute('aria-label', actionLabel(section.expanded));
      // Capture before native focus can scroll the Obsidian leaf. The button's
      // own WeakMap entry survives pointerup until this click consumes it.
      action.addEventListener('pointerdown', (event) => capturePointerAnchor(event, action), true);
      action.addEventListener('mousedown', (event) => capturePointerAnchor(event, action), true);
      action.addEventListener('pointercancel', () => { pointerAnchors.delete(action); }, true);
      action.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const capturedPointerAnchor = pointerAnchors.get(action);
        pointerAnchors.delete(action);
        const isPointerClick = event.detail > 0;
        const pointerAnchor = isPointerClick
          ? capturedPointerAnchor ?? {
            clientY: event.clientY,
            buttonOffsetY: event.clientY - action.getBoundingClientRect().top,
          }
          : null;
        const ancestorScrollPositions = readPreviewAncestorScrollPositions(card);
        // The footer action moves down when its Section is restored to the
        // layout. Keeping that button focused during reflow can make Chromium
        // scroll it back into view, which looks like the whole screen jumps.
        // Release focus before reflow. Keyboard activation restores focus
        // with preventScroll; pointer activation keeps focus off the moving
        // footer button so the browser cannot perform a second scroll.
        const restoreActionFocus = card.ownerDocument.activeElement === action;
        if (restoreActionFocus) action.blur();
        const expansionState = {
          expanded: uiState.expandedSectionIds,
          collapsed: uiState.collapsedSectionIds,
        };
        const wasExpanded = isFoldedSectionExpanded(section.id, section.initiallyExpanded, expansionState);
        const targetNode = Array.from(card.querySelectorAll<HTMLElement>('.statblock-forge__preview-block[data-block-id]'))
          .find((candidate) => candidate.dataset.blockId === section.id);
        let mustRevealContainer = false;
        let ancestor = targetNode?.parentElement;
        while (ancestor && ancestor !== card) {
          if (ancestor.matches('.statblock-forge__preview-block.is-section[data-block-id]')) {
            const ancestorId = (ancestor as HTMLElement).dataset.blockId;
            if (ancestorId && uiState.omittedIds.has(ancestorId) && !uiState.totalHiddenIds.has(ancestorId)) {
              const ancestorSection = uiState.foldableSections.find((item) => item.id === ancestorId);
              setFoldedSectionExpanded(ancestorId, true, ancestorSection?.initiallyExpanded === true, expansionState);
              mustRevealContainer = true;
            }
          }
          ancestor = ancestor.parentElement;
        }
        const targetPanel = targetNode?.closest<HTMLElement>('.statblock-forge__preview-tab-panel');
        if (targetPanel?.hidden) mustRevealContainer = true;
        // If this nested action is currently behind a folded parent or an
        // inactive tab, reveal the container first and keep the target open.
        setFoldedSectionExpanded(section.id, !wasExpanded || mustRevealContainer, section.initiallyExpanded, expansionState);
        const nextOmissions = collectOmittedBlockIds(
          list(template.layout.blocks), layout, renderOptions, uiState.expandedSectionIds, uiState.collapsedSectionIds,
        );
        uiState.omittedIds = nextOmissions.omittedIds;
        uiState.totalHiddenIds = nextOmissions.totalHiddenIds;
        for (const update of uiState.gridUpdates) update();
        // A nested Section may live in an inactive Tabs panel; activate its
        // tab after reflow so the footer action never appears to do nothing.
        if (targetPanel?.hidden) {
          const tabButton = Array.from(card.querySelectorAll<HTMLButtonElement>('.statblock-forge__preview-tab'))
            .find((candidate) => candidate.dataset.tabBlockId === targetPanel.dataset.tabPanelId);
          tabButton?.click();
        }
        syncNestedLayoutInlineBleedsAfterMount(card);
        const restoreSequence = ++foldedSectionScrollRestoreSequence;
        const restorePointerButtonAtMouse = (): number => {
          if (!pointerAnchor || !action.isConnected) return 0;
          const targetButtonTop = pointerAnchor.clientY - pointerAnchor.buttonOffsetY;
          // Re-read scrollports from the live button after each layout pass.
          // The actual scroll owner can differ between published, stacked and
          // Canvas views, and can become scrollable only after expansion.
          return alignTargetAtViewportY(
            action,
            readPreviewButtonScrollports(action),
            targetButtonTop,
          );
        };
        const restoreAncestorScroll = (): number => {
          if (restoreSequence !== foldedSectionScrollRestoreSequence) return 0;
          for (const position of ancestorScrollPositions) {
            if (!position.element.isConnected) continue;
            if (!pointerAnchor && Math.abs(position.element.scrollTop - position.top) > 0.5) {
              position.element.scrollTop = position.top;
            }
            if (Math.abs(position.element.scrollLeft - position.left) > 0.5) position.element.scrollLeft = position.left;
          }
          // Pointer activation does not restore focus: native focus on a footer
          // button can trigger another browser scroll after the anchor is set.
          if (!pointerAnchor && restoreActionFocus && action.isConnected && card.ownerDocument.activeElement !== action) {
            action.focus({ preventScroll: true });
            for (const position of ancestorScrollPositions) {
              if (!position.element.isConnected) continue;
              if (Math.abs(position.element.scrollTop - position.top) > 0.5) {
                position.element.scrollTop = position.top;
              }
              if (Math.abs(position.element.scrollLeft - position.left) > 0.5) {
                position.element.scrollLeft = position.left;
              }
            }
          }
          return pointerAnchor ? restorePointerButtonAtMouse() : 0;
        };
        restoreAncestorScroll();
        const view = card.ownerDocument.defaultView;
        if (view && typeof view.requestAnimationFrame === 'function') {
          // Re-align after layout, ResizeObserver and nested-grid measurements.
          // Stop only after the actual button has stayed on target for two
          // consecutive frames, with a hard cap to avoid a permanent RAF loop.
          let remainingFrames = 18;
          let stableFrames = 0;
          const targetButtonTop = pointerAnchor
            ? pointerAnchor.clientY - pointerAnchor.buttonOffsetY
            : null;
          const restoreAcrossFrames = (): void => {
            if (restoreSequence !== foldedSectionScrollRestoreSequence) return;
            const residual = restoreAncestorScroll();
            if (targetButtonTop !== null) {
              stableFrames = Math.abs(residual) <= 0.75 ? stableFrames + 1 : 0;
            }
            remainingFrames -= 1;
            if (remainingFrames > 0 && (targetButtonTop === null || stableFrames < 2)) {
              view.requestAnimationFrame(restoreAcrossFrames);
            }
          };
          view.requestAnimationFrame(restoreAcrossFrames);
        }
        for (const [id, button] of footerButtons) {
          const foldable = uiState.foldableSections.find((item) => item.id === id);
          const expanded = isFoldedSectionExpanded(id, foldable?.initiallyExpanded === true, {
            expanded: uiState.expandedSectionIds,
            collapsed: uiState.collapsedSectionIds,
          });
          button.classList.toggle('is-expanded', expanded);
          button.setAttribute('aria-expanded', String(expanded));
          const label = foldable?.label ?? 'Section';
          button.setAttribute('aria-label', options.language === 'pt-BR'
            ? `${expanded ? 'Recolher' : 'Mostrar'} seção: ${label}`
            : `${expanded ? 'Collapse' : 'Show'} section: ${label}`);
        }
      });
      footerButtons.set(section.id, action);
      footer.append(action);
    }
    layoutHost.append(footer);
  }
  body.append(layoutHost);
  card.append(body);
  syncNestedLayoutInlineBleedsAfterMount(card);
  if (numericRuntime.canEdit) bindAtlasInlineBlockEditing(card, template, options.language ?? 'en', numericRuntime, data, options.focusFirstEmpty === true);
  localizeRendererUiText(card, options.language ?? 'en');
  return card;
}

/** Builds the editor preview through the exact same renderer as final output. */
export function renderStatblockPreview(options: StatblockPreviewOptions): HTMLElement {
  return renderStatblock({
    ...options,
    data: templatePreviewData(options.template),
  });
}
