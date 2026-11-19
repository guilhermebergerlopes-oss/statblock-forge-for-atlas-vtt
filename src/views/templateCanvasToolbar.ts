/** Canvas toolbar composition for the Forge template editor.
 *
 * This module owns the toolbar controls and their layout-model operations.
 * The FileView coordinator supplies selection updates, render scheduling,
 * notices, and the shared component-help picker through callbacks.
 */
import {
  LAYOUT_BLOCK_TYPES,
  addLayoutBlock,
  canMoveLayoutBlock,
  findLayoutBlock,
  findLayoutParentId,
  moveLayoutBlock,
  resolveLayoutInsertionTarget,
  ungroupLayoutRow,
  type LayoutBlockType,
} from '../templates/layoutEditorModel.ts';
import { addTabToContainer } from '../templates/tabsEditorModel.ts';
import { templateFields } from '../templates/fieldEditorModel.ts';
import { titleFieldsForTemplate } from '../templates/titleEditorModel.ts';
import { captureGridPlacementAnchors, clearGridPlacementAnchors, toggleDenseLayout } from '../templates/gridLayout.ts';
import type { ForgeBlock, ForgeLayoutDocument, ForgeTemplate } from '../templates/forgeTemplate.ts';
import { translateForgeText, type ForgeLanguage } from '../i18n/localization.ts';
import type { ComponentHelpGroup } from './componentHelp.ts';
import { button, el, labeledControl, selectInput } from './templateEditorDom.ts';
import { DEFAULT_FORGE_SHEET_WIDTH, MAX_FORGE_SHEET_WIDTH, MIN_FORGE_SHEET_WIDTH, STEP_FORGE_SHEET_WIDTH, normalizeForgeSheetWidth } from '../templates/sheetWidth.ts';

/** Mount a canvas action panel in the document layer so scroll containers and sticky headers cannot clip it. */
function mountCanvasActionMenu(
  details: HTMLDetailsElement,
  content: HTMLElement,
  preferredWidth: number,
): (() => void) | null {
  if (typeof document === 'undefined' || !document.body || content.classList.contains('is-portal')) return null;
  const summary = details.querySelector<HTMLElement>(':scope > summary');
  if (!summary) return null;

  document.body.append(content);
  content.classList.add('is-portal');

  // Obsidian/Electron may expose a partial visualViewport shim. Use its metrics
  // when present, but only subscribe when it actually implements EventTarget.
  const viewport = window.visualViewport;
  const viewportEventTarget = viewport
    && typeof viewport.addEventListener === 'function'
    && typeof viewport.removeEventListener === 'function'
    ? viewport
    : null;
  let disposed = false;
  let cleanup = (): void => undefined;

  const positionMenu = (): void => {
    if (disposed || !details.open || !content.isConnected || !summary.isConnected) return;
    const rect = summary.getBoundingClientRect();
    const viewportWidth = viewport && Number.isFinite(viewport.width) && viewport.width > 0
      ? viewport.width
      : window.innerWidth;
    const viewportHeight = viewport && Number.isFinite(viewport.height) && viewport.height > 0
      ? viewport.height
      : window.innerHeight;
    const viewportLeft = viewport && Number.isFinite(viewport.offsetLeft) ? viewport.offsetLeft : 0;
    const viewportTop = viewport && Number.isFinite(viewport.offsetTop) ? viewport.offsetTop : 0;
    const margin = 8;
    const gap = 5;
    const availableWidth = Math.max(1, viewportWidth - margin * 2);
    const panelWidth = Math.min(preferredWidth, availableWidth);
    const usableHeight = Math.max(1, viewportHeight - margin * 2);
    const desiredHeight = Math.min(Math.max(content.scrollHeight, 120), usableHeight);
    const below = Math.max(0, viewportTop + viewportHeight - rect.bottom - gap - margin);
    const above = Math.max(0, rect.top - viewportTop - gap - margin);
    const openBelow = below >= Math.min(desiredHeight, 280) || below >= above;
    const availableHeight = openBelow ? below : above;
    const maxHeight = Math.max(1, Math.min(desiredHeight, availableHeight || usableHeight));
    const rawTop = openBelow ? rect.bottom + gap : rect.top - gap - maxHeight;
    const top = Math.max(
      viewportTop + margin,
      Math.min(rawTop, viewportTop + viewportHeight - margin - maxHeight),
    );
    const left = Math.max(
      viewportLeft + margin,
      Math.min(rect.left, viewportLeft + viewportWidth - panelWidth - margin),
    );

    content.style.position = 'fixed';
    content.style.left = `${left}px`;
    content.style.top = `${top}px`;
    content.style.width = `${panelWidth}px`;
    content.style.maxHeight = `${maxHeight}px`;
  };

  const schedulePosition = (): void => { window.requestAnimationFrame(positionMenu); };
  const ownerObserver = new MutationObserver(() => {
    if (!summary.isConnected && details.open) {
      details.open = false;
      cleanup();
    }
  });
  ownerObserver.observe(document.body, { childList: true, subtree: true });

  const onOutsidePointer = (event: PointerEvent): void => {
    const target = event.target;
    if (target instanceof Node && !content.contains(target) && !summary.contains(target)) {
      details.open = false;
    }
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && details.open) {
      event.preventDefault();
      details.open = false;
      summary.focus();
    }
  };

  document.addEventListener('scroll', schedulePosition, true);
  document.addEventListener('pointerdown', onOutsidePointer, true);
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('resize', schedulePosition);
  if (viewportEventTarget) {
    viewportEventTarget.addEventListener('resize', schedulePosition);
    viewportEventTarget.addEventListener('scroll', schedulePosition);
  }

  cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    document.removeEventListener('scroll', schedulePosition, true);
    document.removeEventListener('pointerdown', onOutsidePointer, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('resize', schedulePosition);
    if (viewportEventTarget) {
      viewportEventTarget.removeEventListener('resize', schedulePosition);
      viewportEventTarget.removeEventListener('scroll', schedulePosition);
    }
    ownerObserver.disconnect();
    content.classList.remove('is-portal');
    content.style.removeProperty('position');
    content.style.removeProperty('left');
    content.style.removeProperty('top');
    content.style.removeProperty('width');
    content.style.removeProperty('max-height');
    if (content.parentElement === document.body) details.append(content);
  };

  positionMenu();
  return cleanup;
}

export interface TemplateCanvasToolbarOptions {
  template: ForgeTemplate;
  layout: ForgeLayoutDocument;
  language: ForgeLanguage;
  statblockMode: boolean;
  setStatblockMode(enabled: boolean): void;
  selectedBlockId: string | null;
  selectedBlockIds: readonly string[];
  renderComponentHelpPicker(
    group: ComponentHelpGroup,
    options: Array<{ value: string; label: string; disabled?: boolean }>,
    selectedValue: string,
    onSelect: (value: string) => void,
    sections?: Array<{ label: string; values: readonly string[] }>,
  ): HTMLElement;
  setSelection(blockId: string | null, blockIds: string[]): void;
  setSidebarModeToOptions(): void;
  render(): void;
  showNotice(message: string): void;
  showCanvasGrid: boolean;
  setShowCanvasGrid(visible: boolean): void;
  setSheetWidth(width: number, commit: boolean): void;
}

/** Build the Canvas settings, insertion, and selection toolbar groups. */
export function renderTemplateCanvasToolbar(options: TemplateCanvasToolbarOptions): HTMLElement {
  const {
    template,
    layout,
    language,
    statblockMode,
    setStatblockMode,
    selectedBlockId,
    selectedBlockIds,
    renderComponentHelpPicker,
    setSelection,
    setSidebarModeToOptions,
    render,
    showNotice,
    showCanvasGrid,
    setShowCanvasGrid,
    setSheetWidth,
  } = options;
  const toolbar = el('div', `statblock-forge__canvas-toolbar${statblockMode ? ' is-statblock-mode' : ''}`);
  const modeGroup = el('div', 'statblock-forge__canvas-toolbar-group statblock-forge__canvas-toolbar-group--mode');
  const settingsGroup = el('div', 'statblock-forge__canvas-toolbar-group statblock-forge__canvas-toolbar-group--settings');
  const insertGroup = el('div', 'statblock-forge__canvas-toolbar-group statblock-forge__canvas-toolbar-group--insert');
  const selectionGroup = el('div', 'statblock-forge__canvas-toolbar-group statblock-forge__canvas-toolbar-group--selection');
  const moreTools = el('details', 'statblock-forge__canvas-more-tools');
  const moreToolsSummary = el('summary', '', translateForgeText('More options', language));
  const moreToolsContent = el('div', 'statblock-forge__canvas-more-tools-content');
  moreTools.append(moreToolsSummary, moreToolsContent);
  moreTools.addEventListener('toggle', () => {
    moreToolsSummary.textContent = translateForgeText(moreTools.open ? 'Hide options' : 'More options', language);
  });

  const modeToggle = button('', () => setStatblockMode(!statblockMode), true);
  modeToggle.classList.add('statblock-forge__dense-toggle', 'statblock-forge__statblock-mode-toggle');
  modeToggle.classList.toggle('is-active', statblockMode);
  modeToggle.setAttribute('aria-pressed', String(statblockMode));
  modeToggle.setAttribute('aria-label', translateForgeText('Statblock mode', language));
  modeToggle.title = translateForgeText('Interactive preview of the final statblock. Test its controls; changes are temporary and do not modify the template.', language);
  modeToggle.append(
    el('span', 'statblock-forge__dense-toggle-icon', '▣'),
    el('span', 'statblock-forge__dense-toggle-label', translateForgeText('Statblock mode', language)),
    el('span', 'statblock-forge__dense-toggle-state', translateForgeText(statblockMode ? 'On' : 'Off', language)),
  );
  modeGroup.append(modeToggle);
  toolbar.append(modeGroup);

  const nativeColumns = selectInput(String(template.layout.maxColumns ?? 2), [
    { value: '1', label: 'Atlas: 1 col' },
    { value: '2', label: 'Atlas: 2 cols' },
    { value: '3', label: 'Atlas: 3 cols' },
  ]);
  nativeColumns.addEventListener('change', () => {
    template.layout.maxColumns = Number(nativeColumns.value);
    render();
  });
  settingsGroup.append(nativeColumns);

  const columnsControl = el('label', 'statblock-forge__canvas-columns-control');
  columnsControl.append(el('span', '', translateForgeText('Grid columns', language)));
  const columnsInput = el('input', 'statblock-forge__canvas-columns-input');
  columnsInput.type = 'number';
  columnsInput.min = '4';
  columnsInput.max = '24';
  columnsInput.step = '1';
  columnsInput.value = String(Math.max(4, Math.min(24, Math.round(layout.columns || 12))));
  columnsInput.setAttribute('aria-label', translateForgeText('Grid columns', language));
  columnsInput.title = translateForgeText('Choose how many alignment columns the template uses. Existing block widths remain proportional.', language);
  columnsInput.addEventListener('change', () => {
    const next = Math.max(4, Math.min(24, Math.round(Number(columnsInput.value) || 12)));
    columnsInput.value = String(next);
    if (layout.columns === next) return;
    layout.columns = next;
    render();
  });
  columnsControl.append(columnsInput);
  settingsGroup.append(columnsControl);

  const denseToggle = button('', () => {
    // Freeze the currently visible Grid positions when switching to sparse
    // mode. Re-enabling Dense keeps those anchors dormant for the next toggle.
    if (layout.dense) captureGridPlacementAnchors(
      template.layout.blocks,
      layout,
      template.sample as Record<string, unknown> | undefined,
    );
    toggleDenseLayout(layout);
    render();
  }, true);
  denseToggle.classList.add('statblock-forge__dense-toggle');
  denseToggle.classList.toggle('is-active', layout.dense);
  denseToggle.dataset.dense = String(layout.dense);
  denseToggle.setAttribute('aria-pressed', String(layout.dense));
  denseToggle.setAttribute('aria-label', translateForgeText('Dense layout', language));
  denseToggle.title = translateForgeText('Compacts block spacing and fills reachable gaps.', language);
  denseToggle.append(
    el('span', 'statblock-forge__dense-toggle-icon', '▤'),
    el('span', 'statblock-forge__dense-toggle-label', translateForgeText('Dense layout', language)),
    el('span', 'statblock-forge__dense-toggle-state', translateForgeText(layout.dense ? 'On' : 'Off', language)),
  );
  settingsGroup.append(denseToggle);

  const gridToggle = button('', () => {
    setShowCanvasGrid(!showCanvasGrid);
    render();
  }, true);
  gridToggle.classList.add('statblock-forge__dense-toggle', 'statblock-forge__grid-toggle');
  gridToggle.classList.toggle('is-active', showCanvasGrid);
  gridToggle.dataset.grid = String(showCanvasGrid);
  gridToggle.setAttribute('aria-pressed', String(showCanvasGrid));
  gridToggle.setAttribute('aria-label', translateForgeText('Background grid', language));
  gridToggle.append(
    el('span', 'statblock-forge__dense-toggle-icon', '▦'),
    el('span', 'statblock-forge__dense-toggle-label', translateForgeText('Background grid', language)),
    el('span', 'statblock-forge__dense-toggle-state', translateForgeText(showCanvasGrid ? 'On' : 'Off', language)),
  );
  settingsGroup.append(gridToggle);

  const sheetWidth = normalizeForgeSheetWidth(layout.sheetWidth, DEFAULT_FORGE_SHEET_WIDTH);
  const widthDetails = el('details', 'statblock-forge__canvas-width-control');
  const widthSummary = el('summary', '', `${translateForgeText('Sheet width', language)} · ${sheetWidth} px`);
  const widthPanel = el('div', 'statblock-forge__canvas-width-panel');
  const widthLabel = el('label', 'statblock-forge__canvas-width-label', translateForgeText('Sheet width', language));
  const widthValue = el('output', 'statblock-forge__canvas-width-value', `${sheetWidth} px`);
  const widthInput = el('input', 'statblock-forge__canvas-width-slider');
  widthInput.type = 'range';
  widthInput.min = String(MIN_FORGE_SHEET_WIDTH);
  widthInput.max = String(MAX_FORGE_SHEET_WIDTH);
  widthInput.step = String(STEP_FORGE_SHEET_WIDTH);
  widthInput.value = String(sheetWidth);
  widthInput.setAttribute('aria-label', translateForgeText('Sheet width', language));
  widthInput.addEventListener('input', () => {
    const value = normalizeForgeSheetWidth(Number(widthInput.value));
    widthValue.textContent = `${value} px`;
    widthSummary.textContent = `${translateForgeText('Sheet width', language)} · ${value} px`;
    setSheetWidth(value, false);
  });
  widthInput.addEventListener('change', () => setSheetWidth(normalizeForgeSheetWidth(Number(widthInput.value)), true));
  widthLabel.append(widthInput);
  widthPanel.append(widthLabel, widthValue);
  widthDetails.append(widthSummary, widthPanel);
  settingsGroup.append(widthDetails);
  moreToolsContent.append(settingsGroup);

  const fieldChoices = templateFields(template).map((field) => ({ value: field.key, label: field.label.trim() || field.key }));
  const titleFieldChoices = titleFieldsForTemplate(template).map((field) => ({ value: field.key, label: field.label.trim() || field.key }));
  // selectedBlockIds preserves selection order; its final item is the last
  // block explicitly selected and therefore the insertion anchor.
  const insertionSelectionId = selectedBlockIds.length > 0
    ? selectedBlockIds[selectedBlockIds.length - 1] ?? selectedBlockId
    : selectedBlockId;

  // Add Block exposes presentation choices rather than every native renderer
  // separately. Collections and Resources resolve to their specific renderer
  // from the selected Field type; Title is resolved from Heading when a
  // title Field is selected. Vertical divider is offered as its own block type.
  type AddBlockChoice = LayoutBlockType | 'collections' | 'resources';
  const blockGroups: Array<{ label: string; values: readonly AddBlockChoice[] }> = [
    { label: 'Content & layout', values: ['heading', 'text', 'line', 'divider', 'vertical-divider'] },
    { label: 'Values & tables', values: ['stat', 'metric', 'scores'] },
    { label: 'Collections & resources', values: ['collections', 'resources'] },
    { label: 'Specialized', values: ['image', 'track'] },
  ];
  const blockDetails = el('details', 'statblock-forge__canvas-action statblock-forge__canvas-action--add-block');
  blockDetails.append(el('summary', '', translateForgeText('Add block', language)));
  const blockControls = el('div', 'statblock-forge__canvas-action-content statblock-forge__canvas-action-content--blocks');
  blockControls.setAttribute('role', 'group');
  blockControls.setAttribute('aria-label', 'Add block options');
  let blockMenuCleanup: (() => void) | null = null;

  const unmountBlockMenu = (): void => {
    blockMenuCleanup?.();
    blockMenuCleanup = null;
  };

  const closeBlockMenu = (): void => {
    blockDetails.open = false;
    unmountBlockMenu();
  };

  const mountBlockMenu = (): void => {
    if (blockMenuCleanup) return;
    blockMenuCleanup = mountCanvasActionMenu(blockDetails, blockControls, 336);
  };

  blockDetails.addEventListener('toggle', () => {
    if (blockDetails.open) mountBlockMenu();
    else unmountBlockMenu();
  });

  const compatibleTypesByChoice: Partial<Record<AddBlockChoice, readonly string[]>> = {
    stat: ['text', 'number', 'rating', 'dice', 'choice'],
    metric: ['text', 'number', 'rating', 'dice', 'choice'],
    scores: ['scores'],
    collections: ['list', 'entries', 'pairs', 'spells'],
    resources: ['counters', 'checkboxes'],
    image: ['image'],
    track: ['number'],
  };
  const nativeBlockForFieldType: Record<string, LayoutBlockType> = {
    list: 'tags',
    entries: 'entries',
    pairs: 'pairs',
    spells: 'spells',
    counters: 'counters',
    checkboxes: 'checkboxes',
  };
  const blockChoiceDefinitions: Array<{ value: AddBlockChoice; label: string; requiresField: boolean }> = [
    { value: 'heading', label: 'Heading', requiresField: false },
    { value: 'text', label: 'Text', requiresField: false },
    { value: 'line', label: 'Line', requiresField: false },
    { value: 'divider', label: 'Divider', requiresField: false },
    { value: 'vertical-divider', label: 'Vertical divider', requiresField: false },
    { value: 'stat', label: 'Stat', requiresField: true },
    { value: 'metric', label: 'Metric', requiresField: true },
    { value: 'scores', label: 'Table', requiresField: true },
    { value: 'collections', label: 'Collections', requiresField: true },
    { value: 'resources', label: 'Resources', requiresField: true },
    { value: 'image', label: 'Image', requiresField: true },
    { value: 'track', label: 'Track', requiresField: true },
  ];
  const hasCompatibleField = (choice: AddBlockChoice): boolean => {
    const compatibleTypes = compatibleTypesByChoice[choice];
    return Boolean(compatibleTypes && template.fields.some((item) => compatibleTypes.includes(item.type)));
  };
  // A block that cannot be created with any Field in this template is not
  // offered. This keeps the menu focused and prevents invalid Field bindings.
  const availableBlockChoices = blockChoiceDefinitions.filter((item) =>
    !item.requiresField || hasCompatibleField(item.value),
  );
  const availableChoiceValues = new Set(availableBlockChoices.map((item) => item.value));
  const availableBlockGroups = blockGroups
    .map((group) => ({ ...group, values: group.values.filter((value) => availableChoiceValues.has(value)) }))
    .filter((group) => group.values.length > 0);

  let selectedBlockType: AddBlockChoice = 'heading';
  const field = el('select', 'statblock-forge__select');
  const fieldControl = labeledControl(translateForgeText('Field', language), field);
  const fieldControlLabel = fieldControl.querySelector<HTMLElement>('.statblock-forge__control-label');

  const create = button(translateForgeText('Add block', language), () => {
    try {
      const choiceDefinition = blockChoiceDefinitions.find((item) => item.value === selectedBlockType);
      if (!choiceDefinition) throw new Error('This block type is not allowed in the selected container.');

      let resolvedBlockType: LayoutBlockType;
      if (selectedBlockType === 'heading') {
        resolvedBlockType = field.value ? 'title' : 'heading';
      } else if (selectedBlockType === 'collections' || selectedBlockType === 'resources') {
        const selectedField = template.fields.find((item) => item.key === field.value);
        const mappedBlockType = selectedField ? nativeBlockForFieldType[selectedField.type] : undefined;
        if (!mappedBlockType || !compatibleTypesByChoice[selectedBlockType]?.includes(selectedField?.type ?? '')) {
          throw new Error('Choose a compatible Field before adding this block.');
        }
        resolvedBlockType = mappedBlockType;
      } else {
        resolvedBlockType = selectedBlockType;
      }

      const resolvedDefinition = LAYOUT_BLOCK_TYPES.find((item) => item.value === resolvedBlockType);
      if (!resolvedDefinition) throw new Error('This block type is not allowed in the selected container.');
      const needsField = resolvedDefinition.requiresField;
      if (needsField && !field.value) throw new Error('Choose a compatible Field before adding this block.');
      const insertion = resolveLayoutInsertionTarget(template, insertionSelectionId, resolvedBlockType);
      const block = addLayoutBlock(
        template,
        layout,
        resolvedBlockType,
        needsField ? field.value : null,
        insertion.targetContainerId,
        insertion.insertAfterBlockId,
      );
      closeBlockMenu();
      setSelection(block.id, [block.id]);
      setSidebarModeToOptions();
      render();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showNotice(message === 'Choose a compatible Field before adding this block.'
        ? translateForgeText(message, language)
        : message);
    }
  }, true);

  const fieldTypeDisplayNames: Record<string, string> = {
    list: 'List', entries: 'Entries / Abilities', pairs: 'Pairs', spells: 'Spells',
    counters: 'Counters', checkboxes: 'Checkboxes',
  };
  const updateCreateFieldEnabled = (): void => {
    const choiceDefinition = blockChoiceDefinitions.find((item) => item.value === selectedBlockType);
    const isHeading = selectedBlockType === 'heading';
    const needsField = Boolean(choiceDefinition?.requiresField);
    const compatibleTypes = compatibleTypesByChoice[selectedBlockType];
    const choices = isHeading
      ? titleFieldChoices
      : needsField
        ? fieldChoices.filter((option) => {
          const fieldDefinition = template.fields.find((item) => item.key === option.value);
          return Boolean(fieldDefinition && compatibleTypes?.includes(fieldDefinition.type));
        }).map((option) => {
          const fieldDefinition = template.fields.find((item) => item.key === option.value);
          const typeLabel = fieldDefinition && fieldTypeDisplayNames[fieldDefinition.type];
          return {
            ...option,
            label: (selectedBlockType === 'collections' || selectedBlockType === 'resources') && typeLabel
              ? `${option.label} · ${translateForgeText(typeLabel, language)}`
              : option.label,
          };
        })
        : [];
    const previous = field.value;
    const preferred = choices.some((option) => option.value === previous)
      ? previous
      : isHeading
        ? ''
        : choices[0]?.value ?? '';
    field.replaceChildren();
    const placeholderText = isHeading
      ? 'Static heading (no Field)'
      : needsField
        ? (choices.length ? 'Choose a compatible Field' : 'No compatible Field available')
        : 'Not required';
    const placeholder = el('option', '', translateForgeText(placeholderText, language));
    placeholder.value = '';
    field.append(placeholder);
    for (const choice of choices) {
      const option = el('option', '', choice.label);
      option.value = choice.value;
      field.append(option);
    }
    field.value = preferred;
    fieldControl.hidden = !isHeading && !needsField;
    if (fieldControlLabel) {
      fieldControlLabel.textContent = translateForgeText(isHeading ? 'Text field (optional)' : 'Field', language);
    }
    field.disabled = !choices.length;
    create.disabled = needsField && !field.value;
  };

  const typePicker = renderComponentHelpPicker(
    'blocks',
    availableBlockChoices.map((item) => ({ value: item.value, label: item.label })),
    selectedBlockType,
    (value) => { selectedBlockType = value as AddBlockChoice; updateCreateFieldEnabled(); },
    availableBlockGroups,
  );
  field.addEventListener('change', updateCreateFieldEnabled);
  updateCreateFieldEnabled();
  const blockFooter = el('div', 'statblock-forge__canvas-action-footer statblock-forge__canvas-action-footer--blocks');
  blockFooter.append(fieldControl, create);
  blockControls.append(typePicker, blockFooter);
  blockDetails.append(blockControls);
  insertGroup.append(blockDetails);

  // Container choices use the same portal positioning and cleanup as Add Block.
  const containerDetails = el('details', 'statblock-forge__canvas-action statblock-forge__canvas-action--add-container');
  containerDetails.append(el('summary', '', 'Add container'));
  const containerControls = el('div', 'statblock-forge__canvas-action-content statblock-forge__canvas-action-content--containers');
  const containerOptions = [
    { value: 'section', label: 'Section', disabled: false },
    { value: 'row', label: 'Row', disabled: false },
    { value: 'tabs', label: 'Tabs container', disabled: false },
  ];
  let selectedContainerType = 'section';
  const containerPicker = renderComponentHelpPicker('containers', containerOptions, selectedContainerType, (value) => {
    selectedContainerType = value;
  });
  let containerMenuCleanup: (() => void) | null = null;
  const unmountContainerMenu = (): void => {
    containerMenuCleanup?.();
    containerMenuCleanup = null;
  };
  const closeContainerMenu = (): void => {
    containerDetails.open = false;
    unmountContainerMenu();
  };
  const mountContainerMenu = (): void => {
    if (containerMenuCleanup) return;
    containerMenuCleanup = mountCanvasActionMenu(containerDetails, containerControls, 304);
  };
  containerDetails.addEventListener('toggle', () => {
    if (containerDetails.open) mountContainerMenu();
    else unmountContainerMenu();
  });

  const addContainer = button('Add container', () => {
    try {
      const containerType = selectedContainerType as LayoutBlockType;
      const insertion = resolveLayoutInsertionTarget(template, insertionSelectionId, containerType);
      const insertionParent = insertion.targetContainerId
        ? findLayoutBlock(template, insertion.targetContainerId)
        : null;
      let container: ForgeBlock;
      if (containerType === 'section' && insertionParent?.type === 'tabs' && !insertion.insertAfterBlockId) {
        container = addTabToContainer(template, layout, insertion.targetContainerId as string);
      } else {
        container = addLayoutBlock(
          template, layout, containerType, null, insertion.targetContainerId, insertion.insertAfterBlockId,
        );
      }
      closeContainerMenu();
      setSelection(container.id, [container.id]);
      setSidebarModeToOptions();
      render();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : String(error));
    }
  }, true);
  containerControls.append(containerPicker, addContainer);
  containerDetails.append(containerControls);
  insertGroup.append(containerDetails);
  toolbar.append(insertGroup);

  const selectedBlock = selectedBlockId ? findLayoutBlock(template, selectedBlockId) : null;
  if (selectedBlock && selectedBlockIds.length <= 1) {
    const resetMovedSiblingAnchors = (): void => {
      const parentId = findLayoutParentId(template, selectedBlock.id);
      const parent = parentId ? findLayoutBlock(template, parentId) : null;
      const siblings = parent && Array.isArray(parent.blocks)
        ? parent.blocks.filter((item): item is ForgeBlock => Boolean(item && typeof item === 'object' && 'id' in item && 'type' in item))
        : template.layout.blocks;
      clearGridPlacementAnchors(siblings, layout);
    };
    const moveUp = button('↑', () => {
      if (moveLayoutBlock(template, selectedBlock.id, -1)) {
        resetMovedSiblingAnchors();
        render();
      }
    }, true);
    moveUp.classList.add('statblock-forge__canvas-move-button');
    moveUp.title = 'Move block up';
    moveUp.setAttribute('aria-label', 'Move block up');
    moveUp.disabled = !canMoveLayoutBlock(template, selectedBlock.id, -1);

    const moveDown = button('↓', () => {
      if (moveLayoutBlock(template, selectedBlock.id, 1)) {
        resetMovedSiblingAnchors();
        render();
      }
    }, true);
    moveDown.classList.add('statblock-forge__canvas-move-button');
    moveDown.title = 'Move block down';
    moveDown.setAttribute('aria-label', 'Move block down');
    moveDown.disabled = !canMoveLayoutBlock(template, selectedBlock.id, 1);
    selectionGroup.append(moveUp, moveDown);
  }

  if (selectedBlock?.type === 'row') {
    selectionGroup.append(button('Ungroup', () => {
      try {
        const parentId = findLayoutParentId(template, selectedBlock.id);
        const children = ungroupLayoutRow(template, layout, selectedBlock.id);
        const parent = parentId ? findLayoutBlock(template, parentId) : null;
        const siblings = parent && Array.isArray(parent.blocks)
          ? parent.blocks.filter((item): item is ForgeBlock => Boolean(item && typeof item === 'object' && 'id' in item && 'type' in item))
          : template.layout.blocks;
        clearGridPlacementAnchors(siblings, layout);
        const firstId = children[0]?.id ?? null;
        setSelection(firstId, firstId ? [firstId] : []);
        render();
      } catch (error) {
        showNotice(error instanceof Error ? error.message : String(error));
      }
    }, true));
  }
  if (selectionGroup.childElementCount > 0) moreToolsContent.append(selectionGroup);
  toolbar.append(moreTools);

  return toolbar;
}
