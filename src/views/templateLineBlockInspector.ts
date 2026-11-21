/** Line block field assignment controls for the Forge template Inspector. */
import { registerTemplateField, type ForgeBlock, type ForgeTemplate } from '../templates/forgeTemplate.ts';
import { lineFieldsForTemplate, MAX_LINE_FIELDS, removeLineField, setLineField } from '../templates/lineEditorModel.ts';
import { el, button, inputText, selectInput, labeledControl, section } from './templateEditorDom.ts';

export interface TemplateLineBlockInspectorContext {
  template: ForgeTemplate;
  block: ForgeBlock;
  lineAddingValueForBlockId: string | null;
  setLineAddingValueForBlockId(value: string | null): void;
  render(): void;
  showNotice(message: string): void;
  confirmDelete(itemName: string, onConfirm: () => void): void;
}

export function renderLineBlockOptions(context: TemplateLineBlockInspectorContext): HTMLElement {
  const { template, block } = context;
  const panel = section('Line values', 'Displays one to four scalar fields in order. Supported types: In-line, Number, Rating, Dice and Selection.');
  const fields = Array.isArray(block.fields)
    ? block.fields.filter((key): key is string => typeof key === 'string' && key.length > 0)
    : [];
  const choices = lineFieldsForTemplate(template);
  const isAdding = context.lineAddingValueForBlockId === block.id;
  const showEmptyRow = fields.length === 0 || isAdding;
  const rows: Array<{ key: string | null; index: number }> = fields.map((key, index) => ({ key, index }));
  if (showEmptyRow) rows.push({ key: null, index: fields.length });

  const list = el('div', 'statblock-forge__parts-editor');
  if (choices.length === 0 && fields.length === 0) {
    list.append(el('p', 'statblock-forge__empty-inline', 'No compatible fields.'));
  }
  rows.forEach(({ key, index }) => {
    const row = el('div', 'statblock-forge__part-row');
    const options = [{ value: '', label: 'Choose a field' }, ...choices.map((field) => ({ value: field.key, label: field.label.trim() || field.key }))];
    if (key && !choices.some((field) => field.key === key)) {
      const unavailable = template.fields.find((field) => field.key === key);
      options.push({ value: key, label: `${unavailable?.label.trim() || key} (unsupported type)` });
    }
    const picker = selectInput(key ?? '', options);
    picker.setAttribute('aria-label', `Line value ${index + 1}`);
    picker.addEventListener('change', () => {
      if (!picker.value) return;
      try {
        setLineField(template, block.id, index, picker.value);
        context.setLineAddingValueForBlockId(null);
        context.render();
      } catch (error) { context.showNotice(error instanceof Error ? error.message : String(error)); }
    });
    row.append(labeledControl(`Value ${index + 1}`, picker));
    if (key) {
      const remove = button('×', () => context.confirmDelete(`Line value ${index + 1}`, () => {
        try {
          removeLineField(template, block.id, index);
          context.setLineAddingValueForBlockId(null);
          context.render();
        } catch (error) { context.showNotice(error instanceof Error ? error.message : String(error)); }
      }), true);
      remove.classList.add('is-danger', 'statblock-forge__destructive-icon-button');
      remove.setAttribute('aria-label', `Remove value ${index + 1}`);
      row.append(remove);
    }
    list.append(row);
  });

  const actions = el('div', 'statblock-forge__parts-heading');
  if (fields.length > 0 && fields.length < MAX_LINE_FIELDS && !isAdding) {
    const addValue = button('Add value', () => {
      context.setLineAddingValueForBlockId(block.id);
      context.render();
    }, true);
    addValue.classList.add('statblock-forge__properties-add-compact');
    actions.append(addValue);
  }
  actions.append(el('span', 'statblock-forge__hint', `${fields.length}/${MAX_LINE_FIELDS} values`));
  list.append(actions);

  if (fields.length < MAX_LINE_FIELDS) {
    const createRow = el('div', 'statblock-forge__part-row');
    const name = inputText('', 'New In-line field name');
    name.setAttribute('aria-label', 'New In-line field name');
    const create = button('Create In-line field', () => {
      if (!name.value.trim()) {
        context.showNotice('Enter a name for the new In-line field.');
        return;
      }
      try {
        const field = registerTemplateField(template, name.value.trim(), 'text');
        setLineField(template, block.id, fields.length, field.key);
        context.setLineAddingValueForBlockId(null);
        context.render();
      } catch (error) { context.showNotice(error instanceof Error ? error.message : String(error)); }
    }, true);
    create.disabled = fields.length >= MAX_LINE_FIELDS;
    create.classList.add('statblock-forge__properties-add-compact');
    createRow.append(labeledControl('Create a new In-line field', name), create);
    list.append(createRow);
  }

  panel.append(list);
  return panel;
}
