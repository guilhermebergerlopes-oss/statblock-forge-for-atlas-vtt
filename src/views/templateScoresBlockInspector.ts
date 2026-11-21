import { addFieldToContainer, containerAcceptsField, moveFieldWithinContainer, removeFieldFromContainer } from '../templates/containerEditorModel.ts';
import { setScoresBlockOption } from '../templates/tableEditorModel.ts';
import { button, el, labeledControl, selectInput, toggleControl } from './templateEditorDom.ts';
import { translateForgeText } from '../i18n/localization.ts';
import type { TemplateBlockInspectorContext } from './templateBlockInspectorContext.ts';

/** Inspector for the Field-backed Table block. Pair Fields are deliberately not supported here. */
export function renderScoresBlockInspector(context: TemplateBlockInspectorContext, panel: HTMLElement): void {
  const { template, block, layout, language } = context;
  if (block.type !== 'scores') return;

  const display = selectInput(String(block.display ?? 'plain'), [
    { value: 'plain', label: '3' },
    { value: 'signed', label: '+3' },
  ]);
  display.addEventListener('change', () => {
    setScoresBlockOption(template, block.id, 'display', display.value);
    context.renderPreviewOnly();
  });
  const rollable = toggleControl(
    translateForgeText('Roll as a bonus', language),
    block.rollable === true,
    (enabled) => {
      setScoresBlockOption(template, block.id, 'rollable', enabled);
      context.renderPreviewOnly();
    },
  );
  const columnLabels = toggleControl(
    translateForgeText('Show Labels in columns', language),
    block.showColumnLabels !== false,
    (enabled) => {
      setScoresBlockOption(template, block.id, 'showColumnLabels', enabled);
      context.renderPreviewOnly();
    },
  );
  const rowLabels = toggleControl(
    translateForgeText('Show Labels in rows', language),
    block.showRowLabels === true,
    (enabled) => {
      setScoresBlockOption(template, block.id, 'showRowLabels', enabled);
      context.renderPreviewOnly();
    },
  );
  const allowRowAdd = toggleControl(
    translateForgeText('Allow adding rows in statblocks', language),
    block.allowRowAdd === true,
    (enabled) => {
      setScoresBlockOption(template, block.id, 'allowRowAdd', enabled);
      context.renderPreviewOnly();
    },
  );
  panel.append(
    labeledControl(translateForgeText('Number display', language), display),
    rollable,
    columnLabels,
    rowLabels,
    allowRowAdd,
  );

  // The Table has one ordered list of child Fields. There is no separate
  // Pair-specific row model or manual table layout settings.
  const childKeys = Array.isArray(block.fields)
    ? block.fields.filter((key): key is string => typeof key === 'string')
    : [];
  const childFields = childKeys
    .map((key) => template.fields.find((field) => field.key === key))
    .filter((field): field is NonNullable<typeof field> => Boolean(field));
  const availableFields = template.fields.filter((field) =>
    containerAcceptsField('table', field) && !childKeys.includes(field.key),
  );

  const childrenPanel = el('div', 'statblock-forge__parts-editor');
  const childrenHeading = el('div', 'statblock-forge__parts-heading');
  childrenHeading.append(el('strong', '', translateForgeText('Fields inside this Table', language)));
  const addFieldPicker = selectInput('', [
    { value: '', label: translateForgeText('Choose a Field', language) },
    ...availableFields.map((field) => ({
      value: field.key,
      label: `${field.label.trim() || field.key} · ${field.type}`,
    })),
  ]);
  const addField = button(translateForgeText('Add Field', language), () => {
    if (!addFieldPicker.value) return;
    if (addFieldToContainer(template, layout, block.id, addFieldPicker.value)) context.render();
  }, true);
  addField.disabled = availableFields.length === 0;
  childrenHeading.append(addFieldPicker, addField);
  childrenPanel.append(childrenHeading);

  if (childFields.length === 0) {
    childrenPanel.append(el('small', 'statblock-forge__detail', translateForgeText(
      'Add compatible Fields to define this Table. Fields appear in the order shown here.', language,
    )));
  } else {
    childFields.forEach((field, index) => {
      const row = el('div', 'statblock-forge__score-derived-row statblock-forge__table-field-row');
      const title = el('span', '', `${index + 1}. ${field.label.trim() || field.key} · ${field.type}`);
      const actions = el('div', 'statblock-forge__table-field-actions');
      const moveUp = button('↑', () => {
        if (moveFieldWithinContainer(template, layout, block.id, field.key, -1)) context.render();
      }, true);
      moveUp.disabled = index === 0;
      moveUp.title = translateForgeText('Move Field up', language);
      moveUp.setAttribute('aria-label', moveUp.title);
      const moveDown = button('↓', () => {
        if (moveFieldWithinContainer(template, layout, block.id, field.key, 1)) context.render();
      }, true);
      moveDown.disabled = index === childFields.length - 1;
      moveDown.title = translateForgeText('Move Field down', language);
      moveDown.setAttribute('aria-label', moveDown.title);
      const remove = button(translateForgeText('Remove Field', language), () => context.confirmDelete(
        `${translateForgeText('Field', language)} “${field.label.trim() || field.key}” from this Table`,
        () => {
          removeFieldFromContainer(template, layout, block.id, field.key);
          context.render();
        },
      ), true);
      remove.title = `${translateForgeText('Remove Field from this Table', language)}: ${field.label.trim() || field.key}`;
      remove.setAttribute('aria-label', remove.title);
      remove.classList.add('is-danger', 'statblock-forge__destructive-icon-button');
      actions.append(moveUp, moveDown, remove);
      row.append(title, actions);
      childrenPanel.append(row);
    });
  }
  panel.append(childrenPanel);
}
