/**
 * Block structure and text/container properties for the Forge template Inspector.
 * This module composes DOM controls only; the FileView coordinator owns
 * selection, editor state, notices and full/preview render lifecycles.
 */
import {
  type ForgeBlock,
  type ForgeField,
  type ForgeLayoutDocument,
  type ForgeTemplate,
} from '../templates/forgeTemplate.ts';
import { templateFields } from '../templates/fieldEditorModel.ts';
import {
  bindLayoutBlock,
  layoutBlockAllowsFieldBinding,
  findLayoutBlock,
  findLayoutParentId,
} from '../templates/layoutEditorModel.ts';
import { canWrapEntriesBlockInTabs, isTabSection, moveTab, addTabToContainer, removeTab, renameTab } from '../templates/tabsEditorModel.ts';
import { abilityFieldsForTabs, addAbilityTab, isAbilitiesTabs, moveAbilityTab, removeAbilityTab, splitEntriesIntoAbilityTabs } from '../templates/abilityTabsModel.ts';
import { setTitleField, setTitleLevel, setTitlePattern, titleFieldsForTemplate } from '../templates/titleEditorModel.ts';
import { el, button, inputText, textareaInput, selectInput, labeledControl } from './templateEditorDom.ts';

export interface TemplateBlockStructureInspectorContext {
  template: ForgeTemplate;
  layout: ForgeLayoutDocument;
  block: ForgeBlock;
  renderLineBlockOptions(): HTMLElement;
  render(): void;
  renderPreviewOnly(): void;
  showNotice(message: string): void;
  confirmDelete(itemName: string, onConfirm: () => void): void;
  setSidebarMode(mode: 'options'): void;
  selectBlock(blockId: string | null): void;
  setActiveTab(containerId: string, tabId: string | null): void;
  renderEntryExtras(fields: ForgeField[]): HTMLElement;
}

export function renderBlockStructureProperties(
  context: TemplateBlockStructureInspectorContext,
  panel: HTMLElement,
): void {
  const { template, layout, block } = context;
  const availableForBlock = block.type === 'title' ? titleFieldsForTemplate(template)
    : block.type === 'checkboxes' ? templateFields(template).filter((field) => field.type === 'checkboxes')
      : templateFields(template);
  const fieldOptions = availableForBlock.map((field) => ({ value: field.key, label: field.label.trim() || field.key }));

  if (layoutBlockAllowsFieldBinding(block)) {
    const currentField = typeof block.field === 'string' ? block.field : '';
    const validCurrentField = fieldOptions.some((option) => option.value === currentField);
    const isTitle = block.type === 'title';
    const field = selectInput(isTitle && !validCurrentField ? '' : currentField, [
      ...(isTitle ? [{ value: '', label: '(selecione um campo In-line)' }] : [{ value: '', label: '(sem vínculo)' }]),
      ...fieldOptions,
    ]);
    if (isTitle && fieldOptions.length === 0) field.disabled = true;
    field.addEventListener('change', () => {
      if (isTitle && !field.value) return;
      try {
        if (isTitle) setTitleField(template, block.id, field.value);
        else bindLayoutBlock(template, block.id, field.value || null);
        context.render();
      } catch (error) { context.showNotice(error instanceof Error ? error.message : String(error)); }
    });
    panel.append(labeledControl('Campo vinculado', field));
    if (isTitle && fieldOptions.length === 0) {
    }
  }

  if (block.type === 'title') {
    const level = selectInput(String(block.level ?? 1), [
      { value: '1', label: 'H1 · principal' },
      { value: '2', label: 'H2 · secundário' },
      { value: '3', label: 'H3 · terciário' },
    ]);
    level.addEventListener('change', () => {
      try { setTitleLevel(template, block.id, Number(level.value)); context.renderPreviewOnly(); }
      catch (error) { context.showNotice(error instanceof Error ? error.message : String(error)); }
    });
    const pattern = textareaInput(String(block.pattern ?? ''), 'Ex.: {name} — {type}', 2);
    pattern.addEventListener('change', () => {
      try { setTitlePattern(template, block.id, pattern.value); context.renderPreviewOnly(); }
      catch (error) { context.showNotice(error instanceof Error ? error.message : String(error)); }
    });
    panel.append(
      labeledControl('Heading level', level),
      labeledControl('Pattern', pattern, 'Optional. Use {fieldKey} to include values from other fields; leave empty to show the linked field.'),
    );
  }

  if (block.type === 'heading' || block.type === 'text' || block.type === 'entries' || block.type === 'tabs' || block.type === 'section') {
    // A Text block can either contain literal text or display a linked Field.
    // When it is linked, this control edits the optional heading, never the
    // body text: writing block.text here would make the renderer mistake the
    // Field-backed block for a literal-text block and hide its Markdown editor.
    const isFieldBoundTextBlock = block.type === 'text'
      && typeof block.field === 'string' && block.field.trim().length > 0;
    const initialText = block.type === 'heading'
      ? block.text
      : isFieldBoundTextBlock ? block.heading : block.text ?? block.heading;
    const controlLabel = block.type === 'heading'
      ? 'Text'
      : isFieldBoundTextBlock ? 'Heading' : 'Text';
    const text = inputText(String(initialText ?? ''), block.type === 'heading' ? 'Heading text' : 'Heading');
    text.addEventListener('change', () => {
      if (block.type === 'heading') block.text = text.value;
      else if (block.type === 'text' && isFieldBoundTextBlock) {
        if (text.value.trim()) block.heading = text.value;
        else delete block.heading;
      } else if (block.type === 'text') block.text = text.value;
      else if (block.type === 'section' && isTabSection(template, block.id)) renameTab(template, block.id, text.value);
      else block.heading = text.value;
      context.render();
    });
    panel.append(labeledControl(controlLabel, text));
  }

  if (block.type === 'entries') {
    const parentId = findLayoutParentId(template, block.id);
    const parent = parentId ? findLayoutBlock(template, parentId) : null;
    const alreadyInTab = parent?.type === 'section' && isTabSection(template, parent.id);
    if (!alreadyInTab) {
      const canWrap = canWrapEntriesBlockInTabs(template, block.id);
      const wrapButton = button('Split into tabs', () => {
        const wrapped = splitEntriesIntoAbilityTabs(template, layout, block.id);
        if (!wrapped) {
          context.showNotice('This Entries block cannot be split into Ability tabs at its current position.');
          return;
        }
        const firstTab = Array.isArray(wrapped.blocks)
          ? wrapped.blocks.find((child) => child.type === 'section')
          : null;
        context.selectBlock(wrapped.id);
        if (firstTab) context.setActiveTab(wrapped.id, firstTab.id);
        context.setSidebarMode('options');
        context.render();
      }, true);
      wrapButton.disabled = !canWrap;
      wrapButton.classList.add('statblock-forge__properties-secondary-action');
      panel.append(wrapButton);
      if (parent?.type === 'row') {
      }
    }
  }

  if (block.type === 'tabs') {
    const abilitiesTabs = isAbilitiesTabs(template, block);
    if (abilitiesTabs) {
      const abilityFields = abilityFieldsForTabs(template, block.id);
      panel.append(el('h4', 'statblock-forge__subheading', 'Abilities'));
      panel.append(context.renderEntryExtras(abilityFields));
      const addAbilityTabButton = button('Adicionar aba de Abilities', () => {
        try {
          const tab = addAbilityTab(template, layout, block.id);
          if (!tab) throw new Error('Não foi possível adicionar uma aba a esta Abilities.');
          context.selectBlock(block.id);
          context.setActiveTab(block.id, tab.id);
          context.setSidebarMode('options');
          context.render();
        } catch (error) { context.showNotice(error instanceof Error ? error.message : String(error)); }
      }, true);
      addAbilityTabButton.classList.add('statblock-forge__properties-secondary-action');
      panel.append(addAbilityTabButton);
    } else {
      const addTabButton = button('Add tab', () => {
        try {
          const tab = addTabToContainer(template, layout, block.id);
          context.selectBlock(tab.id);
          context.setActiveTab(block.id, tab.id);
          context.setSidebarMode('options');
          context.render();
        } catch (error) { context.showNotice(error instanceof Error ? error.message : String(error)); }
      }, true);
      addTabButton.classList.add('statblock-forge__properties-secondary-action');
      panel.append(addTabButton);
    }
  }

  if (block.type === 'section') {
    const headingField = selectInput(typeof block.headingField === 'string' ? block.headingField : '', [
      { value: '', label: '(usar título fixo)' },
      ...templateFields(template).map((field) => ({ value: field.key, label: field.label.trim() || field.key })),
    ]);
    headingField.addEventListener('change', () => {
      if (headingField.value) block.headingField = headingField.value;
      else delete block.headingField;
      context.renderPreviewOnly();
    });
    const collapsible = selectInput(typeof block.collapsible === 'string' ? block.collapsible : '', [
      { value: '', label: 'Sempre aberto' },
      { value: 'open', label: 'Recolhível — inicia aberto' },
      { value: 'closed', label: 'Recolhível — inicia fechado' },
    ]);
    collapsible.addEventListener('change', () => {
      if (collapsible.value === 'open' || collapsible.value === 'closed') block.collapsible = collapsible.value;
      else delete block.collapsible;
      context.renderPreviewOnly();
    });
    panel.append(
      labeledControl('Dynamic heading', headingField, 'Use a field as the section title.'),
      labeledControl('Behavior', collapsible),
    );
    if (isTabSection(template, block.id)) {
      const parentId = findLayoutParentId(template, block.id);
      const parentBlock = parentId ? findLayoutBlock(template, parentId) : null;
      const siblings = parentBlock?.blocks;
      const tabIndex = Array.isArray(siblings) ? siblings.findIndex((child) => child.id === block.id) : -1;
      const tabActions = el('div', 'statblock-forge__tab-actions');
      const abilityTabsId = parentBlock?.type === 'tabs' && isAbilitiesTabs(template, parentBlock)
        ? parentBlock.id
        : null;
      const previous = button('←', () => {
        const moved = abilityTabsId
          ? moveAbilityTab(template, abilityTabsId, block.id, -1)
          : moveTab(template, block.id, -1);
        if (moved) context.render();
      }, true);
      previous.setAttribute('aria-label', 'Move tab left');
      previous.disabled = tabIndex <= 0;
      const next = button('→', () => {
        const moved = abilityTabsId
          ? moveAbilityTab(template, abilityTabsId, block.id, 1)
          : moveTab(template, block.id, 1);
        if (moved) context.render();
      }, true);
      next.setAttribute('aria-label', 'Move tab right');
      next.disabled = !Array.isArray(siblings) || tabIndex < 0 || tabIndex >= siblings.length - 1;
      const remove = button('Delete tab', () => context.confirmDelete(`tab “${String(block.heading ?? block.text ?? `Tab ${tabIndex + 1}`)}”`, () => {
        const remainingCount = Array.isArray(siblings) ? siblings.length - 1 : 0;
        const removed = abilityTabsId
          ? removeAbilityTab(template, layout, abilityTabsId, block.id)
          : removeTab(template, layout, block.id);
        if (!removed) return;
        const parentStillTabs = parentId ? findLayoutBlock(template, parentId)?.type === 'tabs' : false;
        if (parentStillTabs && parentId) {
          const tabsAfterRemoval = findLayoutBlock(template, parentId);
          const nextTab = tabsAfterRemoval && Array.isArray(tabsAfterRemoval.blocks)
            ? tabsAfterRemoval.blocks.find((child) => child.type === 'section') : null;
          context.setActiveTab(parentId, nextTab?.id ?? null);
        } else if (parentId) {
          context.setActiveTab(parentId, null);
        }
        const collapsedAbility = abilityTabsId !== null && remainingCount === 1;
        context.selectBlock(collapsedAbility ? removed.id : parentId);
        context.setSidebarMode('options');
        context.render();
      }), true);
      remove.classList.add('is-danger', 'statblock-forge__destructive-icon-button');
      tabActions.append(previous, next, remove);
      panel.append(el('h4', 'statblock-forge__subheading', 'Tab'), tabActions);
    }
  }

  if (block.type === 'line') panel.append(context.renderLineBlockOptions());

  if (block.type === 'row') {
    const align = selectInput(String(block.align ?? 'start'), [
      { value: 'start', label: 'Start' },
      { value: 'center', label: 'Center' },
      { value: 'spread', label: 'Spread' },
    ]);
    align.addEventListener('change', () => { block.align = align.value; context.renderPreviewOnly(); });
    panel.append(labeledControl('Items alignment', align));
  }
}

