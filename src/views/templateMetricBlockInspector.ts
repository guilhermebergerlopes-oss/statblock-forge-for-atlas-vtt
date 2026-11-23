import type { ForgeLayoutDocument } from '../templates/forgeTemplate.ts';
import { addFieldToContainer, containerAcceptsField } from '../templates/containerEditorModel.ts';
import {
  addMetricSlot,
  metricAvailableFields,
  metricSlotFormula,
  metricSlotFormulaLabel,
  nameMetricSlot,
  removeMetricSlot,
  setMetricFlag,
  setMetricHeading,
  setMetricNumberLook,
  setMetricSlotsPerRow,
  setMetricSlotField,
  setMetricSlotFormula,
  setMetricSlotFormulaLabel,
} from '../templates/metricEditorModel.ts';
import { translateForgeText } from '../i18n/localization.ts';
import { MAX_MATH_FORMULA_LENGTH } from '../templates/formulaLimits.ts';
import { button, el, fieldTypeLabel, inputText, labeledControl, numberInput, selectInput, textareaInput, toggleControl } from './templateEditorDom.ts';
import { renderNumericTrackingControls } from './templateNumericTrackingControls.ts';
import type { TemplateBlockInspectorContext } from './templateBlockInspectorContext.ts';

export function renderMetricBlockInspector(context: TemplateBlockInspectorContext, panel: HTMLElement): void {
  const { template, block, layout } = context;
  if (block.type !== 'metric') return;

  const heading = inputText(typeof block.heading === 'string' ? block.heading : '', 'Metric group');
  heading.addEventListener('change', () => {
    setMetricHeading(template, block.id, heading.value);
    context.renderPreviewOnly();
  });
  panel.append(labeledControl('Group heading', heading));

  const slotsPerRow = numberInput(layout.blocks[block.id]?.metricSlotsPerRow ?? 6, 1, 12);
  slotsPerRow.addEventListener('change', () => {
    const value = Math.max(1, Math.min(12, Math.trunc(Number(slotsPerRow.value) || 6)));
    slotsPerRow.value = String(value);
    if (setMetricSlotsPerRow(layout, block.id, value)) context.render();
  });
  panel.append(labeledControl('Maximum items per row', slotsPerRow, 'Controls how many Metric values are placed on each line.'));

  const slots = Array.isArray(block.fields)
    ? block.fields.filter((key): key is string => typeof key === 'string')
    : [];
  const slotList = el('div', 'statblock-forge__metric-slots');
  slots.forEach((key, index) => {
    const slotGroup = el('div', 'statblock-forge__metric-slot-group');
    const row = el('div', 'statblock-forge__metric-slot');
    const title = el('span', 'statblock-forge__metric-slot-index', String(index + 1).padStart(2, '0'));
    const currentFormula = metricSlotFormula(block, index);
    const compatible = metricAvailableFields(template, block.id, index);
    const boundField = template.fields.find((field) => field.key === key);
    const source = inputText(
      currentFormula ? '' : (boundField ? `${boundField.label.trim() || boundField.key} · ${fieldTypeLabel(boundField.type)}` : key),
      translateForgeText('Compatible Fields: In-line, Number, Rating, Dice and Selection', context.language),
    );
    source.classList.add('statblock-forge__metric-slot-source');
    const suggestionsId = `metric-field-suggestions-${block.id}-${index}`;
    source.setAttribute('list', suggestionsId);
    const suggestions = el('datalist');
    suggestions.id = suggestionsId;
    compatible.forEach((field) => {
      const option = el('option');
      option.value = `${field.label.trim() || field.key} · ${fieldTypeLabel(field.type)}`;
      option.label = field.key;
      suggestions.append(option);
    });
    if (boundField && !compatible.some((field) => field.key === boundField.key)) {
      const option = el('option');
      option.value = `${boundField.label.trim() || boundField.key} · ${fieldTypeLabel(boundField.type)}`;
      option.label = boundField.key;
      suggestions.append(option);
    }
    const formulaEditor = textareaInput(currentFormula, '{fieldKey} + {anotherField}', 4);
    formulaEditor.classList.add('statblock-forge__formula-textarea', 'statblock-forge__metric-slot-formula');
    formulaEditor.maxLength = MAX_MATH_FORMULA_LENGTH;
    formulaEditor.wrap = 'soft';
    const displayLabel = inputText(
      currentFormula ? metricSlotFormulaLabel(block, index) : (boundField?.label ?? ''),
      'Display name',
    );
    displayLabel.classList.add('statblock-forge__metric-slot-name');
    source.addEventListener('change', () => {
      const entered = source.value.trim();
      const selected = [...compatible, ...(boundField && !compatible.some((field) => field.key === boundField.key) ? [boundField] : [])]
        .find((field) => entered === field.key || entered === `${field.label.trim() || field.key} · ${fieldTypeLabel(field.type)}`);
      if (selected) {
        if (!setMetricSlotField(template, block.id, index, selected.key)) return;
        context.render();
        return;
      }
      if (!entered) {
        setMetricSlotField(template, block.id, index, null);
        setMetricSlotFormula(template, block.id, index, '');
        setMetricSlotFormulaLabel(template, block.id, index, '');
        formulaEditor.value = '';
        context.renderPreviewOnly();
        return;
      }
      if (!setMetricSlotFormula(template, block.id, index, entered)) {
        if (metricSlotFormula(block, index) !== entered) {
          context.showNotice('Formula is too long or this Metric slot is unavailable.');
          return;
        }
      }
      formulaEditor.value = entered;
      source.value = '';
      const fallbackLabel = displayLabel.value.trim() || boundField?.label || `Formula ${index + 1}`;
      setMetricSlotFormulaLabel(template, block.id, index, fallbackLabel);
      context.renderPreviewOnly();
    });
    formulaEditor.addEventListener('change', () => {
      const entered = formulaEditor.value.trim();
      if (!entered) {
        if (!metricSlotFormula(block, index)) return;
        setMetricSlotFormula(template, block.id, index, '');
        setMetricSlotFormulaLabel(template, block.id, index, '');
        context.renderPreviewOnly();
        return;
      }
      if (!setMetricSlotFormula(template, block.id, index, entered)) {
        if (metricSlotFormula(block, index) !== entered) {
          context.showNotice('Formula is too long or this Metric slot is unavailable.');
          return;
        }
      }
      source.value = '';
      const fallbackLabel = displayLabel.value.trim() || boundField?.label || `Formula ${index + 1}`;
      setMetricSlotFormulaLabel(template, block.id, index, fallbackLabel);
      context.renderPreviewOnly();
    });
    row.append(title, source);
    panel.append(suggestions);
    displayLabel.addEventListener('change', () => {
      if (!displayLabel.value.trim()) return;
      if (metricSlotFormula(block, index)) {
        if (setMetricSlotFormulaLabel(template, block.id, index, displayLabel.value)) context.renderPreviewOnly();
        return;
      }
      try {
        const newKey = nameMetricSlot(template, block.id, index, displayLabel.value);
        if (newKey === null) return;
        context.render();
      } catch (error) {
        context.showNotice(error instanceof Error ? error.message : String(error));
      }
    });
    row.append(displayLabel);

    const remove = button('×', () => context.confirmDelete(`Metric slot ${index + 1}`, () => {
      if (removeMetricSlot(template, block.id, index)) context.render();
    }), true);
    remove.classList.add('is-danger', 'statblock-forge__destructive-icon-button');
    remove.classList.add('statblock-forge__metric-slot-remove');
    remove.setAttribute('aria-label', 'Remove slot (keeps its field and data)');
    remove.disabled = false;
    row.append(remove);
    slotGroup.append(row, labeledControl('Formula', formulaEditor));
    slotList.append(slotGroup);
  });
  panel.append(slotList);

  const usedFieldKeys = new Set(slots.filter(Boolean));
  const availableFields = template.fields.filter((field) =>
    containerAcceptsField('metric', field) && !usedFieldKeys.has(field.key),
  );
  const addFieldRow = el('div', 'statblock-forge__metric-add-field');
  const addFieldPicker = selectInput('', [
    { value: '', label: 'Choose a Field' },
    ...availableFields.map((field) => ({ value: field.key, label: `${field.label.trim() || field.key} · ${fieldTypeLabel(field.type)}` })),
  ]);
  const addField = button('Add Field', () => {
    if (!addFieldPicker.value) return;
    if (addFieldToContainer(template, layout, block.id, addFieldPicker.value)) context.render();
  }, true);
  addField.disabled = availableFields.length === 0;
  addFieldRow.append(addFieldPicker, addField);
  panel.append(labeledControl('Fields inside this Metric', addFieldRow,
    'Drop compatible Fields onto the Metric on the Canvas, or add them here.'));

  const addNumber = button('Add empty slot', () => {
    if (addMetricSlot(template, block.id)) context.render();
  }, true);
  addNumber.classList.add('statblock-forge__properties-add-compact');
  panel.append(addNumber);

  // Atlas offers number display and tracking independently for each Number
  // held by a Metric. Selecting Boxes or Gauge moves only that number into a
  // Track tile, preserving the other numbers in the Metric.
  const numericFields = slots
    .map((key) => template.fields.find((field) => field.key === key && field.type === 'number'))
    .filter((field): field is NonNullable<typeof field> => Boolean(field));
  const named = numericFields.length > 1;
  for (const field of numericFields) {
    const display = selectInput('number', [
      { value: 'number', label: 'Number' },
      { value: 'boxes', label: 'Boxes' },
      { value: 'gauge', label: 'Gauge' },
    ]);
    const displayLabel = named
      ? `${translateForgeText('Show as', context.language)} · ${field.label.trim() || field.key}`
      : translateForgeText('Show as', context.language);
    display.addEventListener('change', () => {
      if (display.value === 'number') return;
      if (setMetricNumberLook(template, layout, block.id, field.key, display.value as 'boxes' | 'gauge')) context.render();
    });
    panel.append(labeledControl(displayLabel, display));
    renderNumericTrackingControls(context, field, panel, { named });
  }

  const metricFlags = el('div', 'statblock-forge__metric-flags');
  metricFlags.append(toggleControl(translateForgeText('Roll as a bonus', context.language), Boolean(block.rollable), (enabled) => {
    setMetricFlag(template, block.id, 'rollable', enabled);
    context.renderPreviewOnly();
  }));
  panel.append(metricFlags);
}
