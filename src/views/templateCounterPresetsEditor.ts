import type { ForgeField } from '../templates/forgeTemplate.ts';
import { isCounterRegainFormula } from '../statblocks/counterRegainModel.ts';
import { shouldEnableCounterNumericValues } from '../statblocks/counterDisplayModel.ts';
import { button, el, inputText, labeledControl, numberInput, toggleControl } from './templateEditorDom.ts';
import type { TemplateSpecializedFieldEditorContext } from './templateSpecializedFieldEditorContext.ts';

/** Move a counter preset without changing the row's fields or unknown extension properties. */
export function moveCounterPresetRows<T>(rows: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= rows.length || to < 0 || to >= rows.length || from === to) return [...rows];
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as T);
  return next;
}

/** Editor for the named counter rows declared by a Counters field. */
export function renderCounterPresets(
  context: Pick<TemplateSpecializedFieldEditorContext, 'render' | 'showNotice' | 'confirmDelete'>,
  field: ForgeField,
): HTMLElement {
  const panel = el('div', 'statblock-forge__parts-editor');
  const rows = Array.isArray(field.counterRows)
    ? field.counterRows.filter((row): row is Record<string, unknown> => row !== null && typeof row === 'object' && !Array.isArray(row))
    : [];
  if (shouldEnableCounterNumericValues(rows)) field.showCounterValue = true;
  const heading = el('div', 'statblock-forge__parts-heading');
  heading.append(el('strong', '', 'Counter rows'));
  const addCounter = button('Adicionar Counter', () => {
    field.counterRows = [...rows, { name: '', max: 1 }];
    context.render();
  }, true);
  addCounter.classList.add('statblock-forge__properties-add-compact');
  heading.append(addCounter);
  panel.append(heading);
  panel.append(toggleControl('Show numeric values (remaining / maximum)', field.showCounterValue === true, (enabled) => {
    if (enabled) field.showCounterValue = true;
    else delete field.showCounterValue;
    context.render();
  }));
  rows.forEach((row, index) => {
    const name = inputText(String(row.name ?? ''), 'Counter name (optional)');
    const max = numberInput(typeof row.max === 'number' ? row.max : 1, 0, 99);
    const regain = inputText(typeof row.regain === 'string' ? row.regain : '', 'Formula');
    let nameCommitted = false;
    const commitName = (): void => {
      if (nameCommitted) return;
      const nextName = name.value;
      if (row.name === nextName) return;
      nameCommitted = true;
      field.counterRows = rows.map((item, at) => at === index ? { ...item, name: nextName } : item);
      context.render();
    };
    name.addEventListener('change', commitName);
    name.addEventListener('blur', commitName);
    name.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        name.blur();
      }
    });
    max.addEventListener('change', () => {
      row.max = Math.max(0, Number(max.value) || 0);
      if (shouldEnableCounterNumericValues(rows)) field.showCounterValue = true;
      context.render();
    });
    regain.addEventListener('change', () => {
      const formula = regain.value.trim();
      if (!formula) delete row.regain;
      else if (isCounterRegainFormula(formula)) row.regain = formula;
      else {
        regain.value = typeof row.regain === 'string' ? row.regain : '';
        context.showNotice('Use uma fórmula de dados válida para a recuperação do Counter.');
      }
    });
    const line = el('div', 'statblock-forge__part-row');
    line.append(labeledControl('Nome', name), labeledControl('Máximo', max), labeledControl('Recuperação', regain));
    const actions = el('div', 'statblock-forge__part-actions');
    const up = button('↑', () => {
      field.counterRows = moveCounterPresetRows(rows, index, index - 1);
      context.render();
    }, true);
    up.disabled = index === 0;
    up.setAttribute('aria-label', `Mover ${String(row.name ?? 'Counter')} para cima`);
    const down = button('↓', () => {
      field.counterRows = moveCounterPresetRows(rows, index, index + 1);
      context.render();
    }, true);
    down.disabled = index === rows.length - 1;
    down.setAttribute('aria-label', `Mover ${String(row.name ?? 'Counter')} para baixo`);
    const remove = button('×', () => context.confirmDelete(`Counter row “${String(row.name || `Counter ${index + 1}`)}”`, () => {
      field.counterRows = rows.filter((_row, at) => at !== index);
      context.render();
    }), true);
    remove.classList.add('is-danger', 'statblock-forge__destructive-icon-button');
    actions.append(up, down, remove);
    line.append(actions);
    panel.append(line);
  });
  return panel;
}
