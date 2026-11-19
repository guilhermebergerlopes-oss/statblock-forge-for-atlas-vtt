import { isRecord } from '../templates/forgeTemplate.ts';
import {
  setScoresBlockOption,
  setScoreDerivedColumns,
  type ScoreDerivedColumn,
} from '../templates/tableEditorModel.ts';
import { button, el, inputText, labeledControl, numberInput, selectInput, toggleControl } from './templateEditorDom.ts';
import { translateForgeText } from '../i18n/localization.ts';
import type { TemplateBlockInspectorContext } from './templateBlockInspectorContext.ts';

export function renderScoresBlockInspector(context: TemplateBlockInspectorContext, panel: HTMLElement): void {
  const { template, block } = context;
  if (block.type !== 'scores') return;

  // Field-level table options (columns, alignment, header and row/column
  // permissions) live in the adjacent Field disclosure in Properties. This
  // block inspector contains only the native block-level number behavior and
  // Forge-specific presentation options.
  // Keep Atlas' numeric display and Roll as a bonus controls at block level.
  const display = selectInput(String(block.display ?? 'plain'), [
    { value: 'plain', label: '3' },
    { value: 'signed', label: '+3' },
  ]);
  display.addEventListener('change', () => { setScoresBlockOption(template, block.id, 'display', display.value); context.renderPreviewOnly(); });
  const rollable = toggleControl('Roll as a bonus', block.rollable === true, (enabled) => {
    setScoresBlockOption(template, block.id, 'rollable', enabled);
    context.renderPreviewOnly();
  });
  panel.append(labeledControl('Number display', display), rollable);

  const orientation = selectInput(String(block.orientation ?? 'row'), [
    { value: 'row', label: translateForgeText('Grid table', context.language) },
    { value: 'table', label: translateForgeText('One value per line', context.language) },
  ]);
  orientation.addEventListener('change', () => {
    setScoresBlockOption(template, block.id, 'orientation', orientation.value);
    context.render();
  });
  panel.append(labeledControl(translateForgeText('Presentation', context.language), orientation));
  if (orientation.value === 'table') {
    const perLine = numberInput(Math.max(1, Number(block.perLine) || 1), 1, Number.MAX_SAFE_INTEGER, 1);
    perLine.addEventListener('change', () => {
      setScoresBlockOption(template, block.id, 'perLine', perLine.valueAsNumber);
      context.renderPreviewOnly();
    });
    panel.append(labeledControl(translateForgeText('Items per row', context.language), perLine));
  }

  const derivedPanel = el('div', 'statblock-forge__parts-editor');
  const derivedHeading = el('div', 'statblock-forge__parts-heading');
  derivedHeading.append(el('strong', '', 'Calculated columns'));
  const addDerived = button('Add calculated column', () => {
    const current = Array.isArray(block.columns) ? block.columns.filter(isRecord).map((item) => ({ ...item })) as ScoreDerivedColumn[] : [];
    current.push({ label: `Bonus ${current.length + 1}`, formula: 'floor((value - 10) / 2)', display: 'signed' });
    setScoreDerivedColumns(template, block.id, current);
    context.render();
  }, true);
  addDerived.classList.add('statblock-forge__properties-add-compact');
  derivedHeading.append(addDerived);
  derivedPanel.append(derivedHeading);
  const derivedColumns = Array.isArray(block.columns) ? block.columns.filter(isRecord) as ScoreDerivedColumn[] : [];
  const pairsFields = template.fields.filter((item) => item.type === 'pairs');
  derivedColumns.forEach((column, index) => {
    const label = inputText(String(column.label ?? ''), 'Column label');
    label.addEventListener('change', () => {
      const next = derivedColumns.map((item) => ({ ...item }));
      if (label.value.trim()) next[index] = { ...next[index], label: label.value.trim() };
      else delete next[index]?.label;
      setScoreDerivedColumns(template, block.id, next);
      context.renderPreviewOnly();
    });
    const formula = inputText(String(column.formula ?? ''), 'Formula');
    formula.addEventListener('change', () => {
      const next = derivedColumns.map((item) => ({ ...item }));
      if (formula.value.trim()) next[index] = { ...next[index], formula: formula.value.trim() };
      else delete next[index]?.formula;
      setScoreDerivedColumns(template, block.id, next);
      context.renderPreviewOnly();
    });
    const linkedField = selectInput(String(column.field ?? ''), [
      { value: '', label: 'No linked field' },
      ...pairsFields.map((item) => ({ value: item.key, label: item.label })),
    ]);
    linkedField.addEventListener('change', () => {
      const next = derivedColumns.map((item) => ({ ...item }));
      if (linkedField.value) next[index] = { ...next[index], field: linkedField.value };
      else delete next[index]?.field;
      setScoreDerivedColumns(template, block.id, next);
      context.renderPreviewOnly();
    });
    const derivedDisplay = selectInput(String(column.display ?? 'plain'), [
      { value: 'plain', label: '3' }, { value: 'signed', label: '+3' },
    ]);
    derivedDisplay.addEventListener('change', () => {
      const next = derivedColumns.map((item) => ({ ...item, display: item.display ?? 'plain' }));
      next[index] = { ...next[index], display: derivedDisplay.value as 'plain' | 'signed' };
      setScoreDerivedColumns(template, block.id, next);
      context.renderPreviewOnly();
    });
    const derivedRow = el('div', 'statblock-forge__score-derived-row');
    derivedRow.append(labeledControl('Label', label), labeledControl('Formula', formula), labeledControl('Linked field', linkedField), labeledControl('Display', derivedDisplay));
    const removeDerived = button('×', () => context.confirmDelete(`calculated table column “${String(column.label ?? `Column ${index + 1}`)}”`, () => {
      setScoreDerivedColumns(template, block.id, derivedColumns.filter((_item, at) => at !== index));
      context.render();
    }), true);
    removeDerived.classList.add('is-danger', 'statblock-forge__destructive-icon-button');
    derivedRow.append(removeDerived);
    derivedPanel.append(derivedRow);
  });
  panel.append(derivedPanel);
}
