/**
 * Rendering for template field definitions and their common settings.
 * Specialized field editors (Entries, Counters and Checkboxes) remain injected
 * by the FileView so they can be extracted independently without coupling this
 * module to Obsidian's view lifecycle.
 */
import { registerTemplateField, type ForgeField, type ForgeLayoutDocument, type ForgeTemplate } from '../templates/forgeTemplate.ts';
import {
  changeTemplateFieldType,
  renameTemplateFieldKey,
  setTemplateFieldMeaning,
  templateFields,
  type FieldMeaning,
} from '../templates/fieldEditorModel.ts';
import { renameAbilityPartAppearanceField } from '../templates/abilityPartsModel.ts';
import { removePinnedTemplateImageField, renamePinnedTemplateImageField } from '../templates/imageFieldModel.ts';
import { renameFieldCompendiumIdentity } from '../templates/fieldCompendiumModel.ts';
import { setNumericFieldFormula } from '../templates/numericFieldModel.ts';
import { isDiceFieldFormulaSyntaxValid, setDiceFieldFormula } from '../statblocks/diceFieldFormulaModel.ts';
import { fieldTypesForCategory, resolveFieldCategory, type ForgeFieldCategory } from '../templates/fieldCategoryModel.ts';
import { scorePreviewGrid } from '../render/previewValueModel.ts';
import { setScoresFieldAlignment, setScoresFieldColumns, setScoresFieldProperty, setScoresFieldSlotKey, validateScoresFieldSlotKeys } from '../templates/tableEditorModel.ts';
import { renderChoiceFieldSettings } from './templateChoiceFieldSettings.ts';
import { normalizeForgeLanguage, translateForgeText, type ForgeLanguage } from '../i18n/localization.ts';
import {
  FIELD_MEANING_OPTIONS,
  FIELD_TYPE_OPTIONS,
  button,
  el,
  fieldTypeLabel,
  inputText,
  textareaInput,
  labeledControl,
  selectInput,
  toggleControl,
} from './templateEditorDom.ts';
import type { ComponentHelpGroup } from './componentHelp.ts';

export interface TemplateFieldEditorContext {
  template: ForgeTemplate;
  getLayout(): ForgeLayoutDocument | null;
  getSelectedTemplateFieldKey(): string | null;
  setSelectedTemplateFieldKey(key: string | null): void;
  language: ForgeLanguage;
  render(): void;
  renderPreviewOnly(): void;
  showNotice(message: string): void;
  removeField(key: string): void;
  confirmDelete(itemName: string, onConfirm: () => void): void;
  getAddFieldSelection(): { category: ForgeFieldCategory; type: string };
  setAddFieldSelection(category: ForgeFieldCategory, type: string): void;
  renderComponentHelpPicker(
    group: ComponentHelpGroup,
    options: Array<{ value: string; label: string; disabled?: boolean }>,
    selectedValue: string,
    onSelect: (value: string) => void,
    sections?: Array<{ label: string; values: readonly string[] }>,
  ): HTMLElement;
  renderEntryExtras(inputFields: ForgeField[] | ForgeField): HTMLElement;
  renderCounterPresets(field: ForgeField): HTMLElement;
  renderCheckboxFieldOptions(field: ForgeField): HTMLElement;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function renderNumericFieldFormulaEditor(context: Pick<TemplateFieldEditorContext, 'renderPreviewOnly' | 'language'>, field: ForgeField): HTMLElement {
  const panel = el('div', 'statblock-forge__numeric-field-formula-editor');
  if (field.type === 'number' || field.type === 'rating') {
    const formula = inputText(typeof field.formula === 'string' ? field.formula : '', 'Formula');
    formula.addEventListener('change', () => {
      setNumericFieldFormula(field, formula.value);
      context.renderPreviewOnly();
    });
    panel.append(labeledControl('Formula', formula));
  } else if (field.type === 'dice') {
    const formula = inputText(typeof field.diceFormula === 'string' ? field.diceFormula : '', '{proficiency}d{might}+{level}');
    const hint = el('small', 'statblock-forge__detail', translateForgeText(
      'Use {fieldKey} to insert a whole-number value from a Number or Rating Field. The formula updates when those values change.',
      contextLanguage(context),
    ));
    const warning = el('small', 'statblock-forge__hint is-warning', translateForgeText(
      'Enter a valid dice formula with at least one die.', contextLanguage(context),
    ));
    warning.hidden = !formula.value.trim() || isDiceFieldFormulaSyntaxValid(formula.value);
    formula.addEventListener('input', () => {
      warning.hidden = formula.value.trim() === '' || isDiceFieldFormulaSyntaxValid(formula.value);
    });
    formula.addEventListener('change', () => {
      setDiceFieldFormula(field, formula.value);
      warning.hidden = formula.value.trim() === '' || isDiceFieldFormulaSyntaxValid(formula.value);
      context.renderPreviewOnly();
    });
    panel.append(labeledControl(translateForgeText('Dice Formula', contextLanguage(context)), formula), hint, warning);
  }
  return panel;
}

function contextLanguage(context: Pick<TemplateFieldEditorContext, 'language'>): ForgeLanguage {
  return normalizeForgeLanguage(context.language);
}

export function renderAddTemplateField(context: TemplateFieldEditorContext): HTMLElement {
  const panel = el('div', 'statblock-forge__custom-field-form');
  const form = el('div', 'statblock-forge__add-field-form');
  const name = inputText('', 'Field name');
  name.autocomplete = 'off';
  name.classList.add('statblock-forge__add-field-name-input');

  const categories: Array<{ value: ForgeFieldCategory; label: string }> = [
    { value: 'value', label: 'Value' },
    { value: 'metric', label: 'Metric' },
    { value: 'collections', label: 'Collections' },
    { value: 'table', label: 'Table' },
    { value: 'resources', label: 'Resources' },
    { value: 'text', label: 'Text' },
    { value: 'image', label: 'Image' },
  ];
  const defaultTypeByCategory: Record<ForgeFieldCategory, string> = {
    value: 'number', metric: 'number', collections: 'entries', table: 'scores',
    resources: 'counters', text: 'markdown', image: 'image',
  };
  const storedSelection = context.getAddFieldSelection();
  let selectedCategory = storedSelection.category;
  let selectedType = fieldTypesForCategory(selectedCategory).includes(storedSelection.type)
    ? storedSelection.type
    : defaultTypeByCategory[selectedCategory];
  context.setAddFieldSelection(selectedCategory, selectedType);

  const categoryPicker = context.renderComponentHelpPicker('fields', categories, selectedCategory, (value) => {
    selectedCategory = value as ForgeFieldCategory;
    if (!fieldTypesForCategory(selectedCategory).includes(selectedType)) {
      selectedType = defaultTypeByCategory[selectedCategory];
    }
    context.setAddFieldSelection(selectedCategory, selectedType);
    renderTypeControl();
    renderTypeSpecificControls();
  });
  const categoryControl = labeledControl(translateForgeText('Category', context.language), categoryPicker);
  categoryControl.classList.add('statblock-forge__add-field-category');

  const typeHost = el('div', 'statblock-forge__add-field-type-host');
  const typeControl = el('div', 'statblock-forge__add-field-type');
  typeHost.append(typeControl);

  const prompt = inputText('', 'e.g. Add speed');
  const promptControl = labeledControl(translateForgeText('Texto quando vazio', context.language), prompt,
    translateForgeText('Sugestão exibida quando o campo ainda não possui valor.', context.language));
  promptControl.classList.add('statblock-forge__add-field-prompt');

  const meaning = selectInput('', FIELD_MEANING_OPTIONS.map((option) => ({
    value: option.value,
    label: translateForgeText(option.label, context.language),
  })));
  const meaningControl = labeledControl(translateForgeText('Significado', context.language), meaning,
    translateForgeText('Opcional. O Atlas usa significados especiais para reconhecer campos do cabeçalho e outros valores.', context.language));
  meaningControl.classList.add('statblock-forge__add-field-meaning');

  const typeSpecificHost = el('div', 'statblock-forge__add-field-type-specific');
  let unit: HTMLInputElement | null = null;
  let formula: HTMLInputElement | null = null;
  let choices: HTMLInputElement | null = null;
  let unitValue = '';
  let formulaValue = '';
  let diceFormulaValue = '';
  let formulaInputKind: 'numeric' | 'dice' | null = null;
  let choicesValue = 'Option 1, Option 2';

  function renderTypeControl(): void {
    typeControl.replaceChildren();
    const compatibleTypes = new Set(fieldTypesForCategory(selectedCategory));
    const typeOptions = FIELD_TYPE_OPTIONS.filter((option) => compatibleTypes.has(option.value));
    if (typeOptions.length > 1) {
      const picker = context.renderComponentHelpPicker('fieldTypes', typeOptions, selectedType, (value) => {
        selectedType = value;
        context.setAddFieldSelection(selectedCategory, selectedType);
        renderTypeControl();
        renderTypeSpecificControls();
      });
      typeControl.append(labeledControl(translateForgeText('Type', context.language), picker));
    } else {
      const label = typeOptions[0]?.label ?? selectedType;
      typeControl.append(labeledControl(translateForgeText('Type', context.language), el(
        'span', 'statblock-forge__field-type-static', translateForgeText(label, context.language),
      )));
    }
  }

  function renderTypeSpecificControls(): void {
    if (unit) unitValue = unit.value;
    if (formula) {
      if (formulaInputKind === 'dice') diceFormulaValue = formula.value;
      else if (formulaInputKind === 'numeric') formulaValue = formula.value;
    }
    if (choices) choicesValue = choices.value;
    typeSpecificHost.replaceChildren();
    unit = null;
    formula = null;
    formulaInputKind = null;
    choices = null;

    if (selectedType === 'number') {
      unit = inputText(unitValue, translateForgeText('e.g. ft.', context.language));
      unit.addEventListener('input', () => { unitValue = unit?.value ?? ''; });
      typeSpecificHost.append(labeledControl(translateForgeText('Unidade', context.language), unit));
    }
    if (selectedType === 'number' || selectedType === 'rating') {
      formulaInputKind = 'numeric';
      formula = inputText(formulaValue, 'e.g. level * 2');
      formula.addEventListener('input', () => { formulaValue = formula?.value ?? ''; });
      typeSpecificHost.append(labeledControl(translateForgeText('Formula', context.language), formula));
    }
    if (selectedType === 'dice') {
      formulaInputKind = 'dice';
      formula = inputText(diceFormulaValue, '{proficiency}d{might}+{level}');
      formula.addEventListener('input', () => { diceFormulaValue = formula?.value ?? ''; });
      typeSpecificHost.append(labeledControl(translateForgeText('Dice Formula', context.language), formula, translateForgeText(
        'Use {fieldKey} to insert a whole-number value from a Number or Rating Field. The formula updates when those values change.', context.language,
      )));
    }
    if (selectedType === 'choice') {
      choices = inputText(choicesValue, translateForgeText('Small, Medium, Large', context.language));
      choices.addEventListener('input', () => { choicesValue = choices?.value ?? ''; });
      typeSpecificHost.append(labeledControl(
        translateForgeText('Choices', context.language),
        choices,
        translateForgeText('Separate options with commas.', context.language),
      ));
    }
  }

  const properties = el('div', 'statblock-forge__add-field-properties');
  properties.append(categoryControl, typeHost, promptControl, meaningControl, typeSpecificHost);

  const add = button(translateForgeText('Create Field', context.language), () => {
    try {
      const label = name.value.trim();
      if (!label) {
        context.showNotice(translateForgeText('Enter a field name.', context.language));
        name.focus();
        return;
      }
      if (meaning.value && context.template.fields.some((field) => field.meaning === meaning.value)) {
        context.showNotice(`The meaning "${meaning.value}" is already assigned to another field.`);
        meaning.focus();
        return;
      }
      const currentLayout = context.getLayout();
      if (!currentLayout) throw new Error('The template layout is not available.');
      const field = registerTemplateField(context.template, label, selectedType);
      currentLayout.fieldKinds ??= {};
      currentLayout.fieldKinds[field.key] = selectedCategory;
      if (prompt.value.trim()) field.prompt = prompt.value.trim();
      if (meaning.value) setTemplateFieldMeaning(context.template, field.key, meaning.value as FieldMeaning);
      if (selectedType === 'number' && unitValue.trim()) field.unit = unitValue.trim();
      if ((selectedType === 'number' || selectedType === 'rating') && formulaValue.trim()) {
        setNumericFieldFormula(field, formulaValue);
      }
      if (selectedType === 'dice' && diceFormulaValue.trim()) {
        setDiceFieldFormula(field, diceFormulaValue);
      }
      if (selectedType === 'choice') {
        const options = choicesValue.split(',').map((option) => option.trim()).filter(Boolean);
        if (options.length > 0) field.options = options;
      }

      // Remember the category and exact variant so repeated field creation
      // starts from the same selection. Only the new Field's name/defaults reset.
      context.setAddFieldSelection(selectedCategory, selectedType);
      context.setSelectedTemplateFieldKey(field.key);
      context.showNotice(`Field created: ${field.label} (key: ${field.key}). Select it in the list to configure it, or drag it to the canvas.`);
      context.render();
    } catch (error) {
      context.showNotice(error instanceof Error ? error.message : String(error));
    }
  });
  add.classList.add('statblock-forge__properties-primary-action', 'statblock-forge__add-field-submit');

  const nameControl = labeledControl(translateForgeText('Name', context.language), name);
  nameControl.classList.add('statblock-forge__add-field-name');
  const propertyHeading = el('strong', 'statblock-forge__add-field-properties-heading', translateForgeText('Main properties', context.language));
  form.append(nameControl, propertyHeading, properties, add);
  panel.append(form);
  renderTypeControl();
  renderTypeSpecificControls();
  return panel;
}

export function renderTemplateFieldCard(context: TemplateFieldEditorContext, field: ForgeField, showRemoveButton = true): HTMLElement {
  const { template } = context;
  const card = el('div', 'statblock-forge__field-card');
  const row = el('div', 'statblock-forge__field-main');
  const label = inputText(field.label, translateForgeText('Field label (optional)', context.language));
  label.setAttribute('aria-label', translateForgeText('Field label (optional)', context.language));
  label.setAttribute('title', translateForgeText('Leave empty to show only the value.', context.language));
  label.addEventListener('change', () => {
    // Empty labels are supported: the Field key remains its stable internal
    // identity while the rendered block can display only its value.
    field.label = label.value.trim();
    template.sample = asRecord(template.sample);
    context.render();
  });

  const key = inputText(field.key, 'field_key');
  key.addEventListener('change', () => {
    const previousKey = field.key;
    try {
      renameTemplateFieldKey(template, previousKey, key.value);
      if (context.getSelectedTemplateFieldKey() === previousKey) context.setSelectedTemplateFieldKey(field.key);
      const layout = context.getLayout();
      if (field.key !== previousKey && layout) {
        renameAbilityPartAppearanceField(layout, previousKey, field.key);
        renamePinnedTemplateImageField(layout, previousKey, field.key);
        renameFieldCompendiumIdentity(layout, previousKey, field.key);
        const kind = layout.fieldKinds?.[previousKey];
        if (kind && layout.fieldKinds) {
          delete layout.fieldKinds[previousKey];
          layout.fieldKinds[field.key] = kind;
        }
      }
    } catch (error) {
      context.showNotice(error instanceof Error ? error.message : String(error));
    }
    context.render();
  });

  const layout = context.getLayout();
  const category = resolveFieldCategory(layout, field);
  const compatibleTypes = new Set(fieldTypesForCategory(category));
  const typeOptions = FIELD_TYPE_OPTIONS.filter((option) => compatibleTypes.has(option.value));
  const typeControl = el('div', 'statblock-forge__field-type-control');
  if (typeOptions.length > 1) {
    const typeDetails = el('details', 'statblock-forge__field-type-picker');
    typeDetails.append(el('summary', '', `${translateForgeText('Type', context.language)}: ${translateForgeText(fieldTypeLabel(field.type), context.language)}`));
    const typePicker = context.renderComponentHelpPicker('fieldTypes', typeOptions, field.type, (nextType) => {
      try {
        changeTemplateFieldType(template, field.key, nextType);
        const currentLayout = context.getLayout();
        if (nextType !== 'image') removePinnedTemplateImageField(currentLayout, field.key);
        // Type changes remain inside the selected Category; do not discard
        // that Category and silently fall back to an unrelated block family.
        if (currentLayout) {
          currentLayout.fieldKinds ??= {};
          currentLayout.fieldKinds[field.key] = category;
        }
      } catch (error) {
        context.showNotice(error instanceof Error ? error.message : String(error));
      }
      context.render();
    });
    typeDetails.append(typePicker);
    typeDetails.setAttribute('aria-label', translateForgeText('Field data type', context.language));
    typeControl.append(typeDetails);
  } else {
    typeControl.append(el('span', 'statblock-forge__field-type-static',
      `${translateForgeText('Type', context.language)}: ${translateForgeText(fieldTypeLabel(field.type), context.language)}`));
  }
  row.append(label, labeledControl('Key', key), typeControl);
  if (showRemoveButton) {
    const removeField = button('Remover', () => context.removeField(field.key), true);
    removeField.classList.add('statblock-forge__property-delete-button', 'is-danger');
    row.append(removeField);
  }
  card.append(row);

  if (field.type === 'number') {
    const unit = inputText(typeof field.unit === 'string' ? field.unit : '', 'e.g. ft.');
    unit.addEventListener('change', () => { field.unit = unit.value; });
    card.append(labeledControl('Unidade', unit));
  }

  if (field.type === 'number' || field.type === 'rating' || field.type === 'dice') card.append(renderNumericFieldFormulaEditor(context, field));

  // Markdown is the only scalar Field whose useful template value is a
  // multiline document. Expose that sample directly in Properties instead of
  // leaving the user with only the empty-state prompt and no place to write.
  // The value is stored in template.sample, so it is preview content only;
  // each published statblock receives its own editable copy of the Field.
  if (field.type === 'markdown') {
    const sample = asRecord(template.sample);
    const sampleValue = sample[field.key];
    const content = textareaInput(
      typeof sampleValue === 'string' ? sampleValue : '',
      translateForgeText('Write Markdown content…', context.language),
      6,
    );
    content.classList.add('statblock-forge__markdown-sample-editor');
    content.setAttribute('aria-label', translateForgeText('Example content', context.language));
    const updateSample = (): void => {
      const nextSample = asRecord(template.sample);
      nextSample[field.key] = content.value;
      template.sample = nextSample;
    };
    content.addEventListener('input', updateSample);
    content.addEventListener('change', () => {
      updateSample();
      context.renderPreviewOnly();
    });
    card.append(labeledControl(translateForgeText('Example content', context.language), content));
    card.append(el('small', 'statblock-forge__detail', translateForgeText(
      'This sample is shown in the template preview. Each statblock has its own editable value.',
      context.language,
    )));
  }


  if (field.type === 'scores') {
    // Keep table properties directly alongside the other Field settings. Do
    // not hide essential row/column permissions or the column editor in a
    // disclosure: users should be able to discover them immediately.
    const tableOptions = el('div', 'statblock-forge__scores-field-options');
    tableOptions.append(el('strong', 'statblock-forge__scores-field-heading', translateForgeText('Table options', context.language)));

    const scoreOptions = el('div', 'statblock-forge__field-toggles statblock-forge__scores-field-toggles');
    scoreOptions.append(
      toggleControl(translateForgeText('Show header row', context.language), field.header !== false, (checked) => {
        setScoresFieldProperty(template, field.key, 'header', checked);
        context.renderPreviewOnly();
      }),
      toggleControl(translateForgeText('Allow adding/removing rows', context.language), field.addRows !== false, (checked) => {
        setScoresFieldProperty(template, field.key, 'addRows', checked);
        context.renderPreviewOnly();
      }),
      toggleControl(translateForgeText('Allow adding/removing columns', context.language), field.addColumns !== false, (checked) => {
        setScoresFieldProperty(template, field.key, 'addColumns', checked);
        context.renderPreviewOnly();
      }),
    );
    tableOptions.append(scoreOptions);

    const currentColumns = (): string[] => [...scorePreviewGrid(asRecord(template.sample)[field.key], field).columns];
    const columnEditor = el('div', 'statblock-forge__scores-field-columns');
    const columnHeading = el('div', 'statblock-forge__scores-field-columns-heading');
    columnHeading.append(el('strong', '', translateForgeText('Columns', context.language)));
    const addColumn = button(translateForgeText('Add column', context.language), () => {
      const current = currentColumns();
      if (current.length >= 12) return;
      const next = [...current, `${translateForgeText('Column', context.language)} ${current.length + 1}`];
      setScoresFieldColumns(template, field.key, next, [...current.map((_item, at) => at), null]);
      context.render();
    }, true);
    addColumn.classList.add('statblock-forge__scores-field-add-column', 'statblock-forge__properties-add-compact');
    addColumn.disabled = currentColumns().length >= 12;
    columnHeading.append(addColumn);
    columnEditor.append(columnHeading);

    const columns = currentColumns();
    const slotKeyIssues = validateScoresFieldSlotKeys([field]);
    const showSlotKeyRepair = slotKeyIssues.length > 0;
    if (showSlotKeyRepair) {
      columnEditor.append(el('p', 'statblock-forge__warning', `${slotKeyIssues.map((issue) => issue.message).join(' ')} Edite as chaves abaixo para resolver os conflitos; nenhum valor será removido automaticamente.`));
    }
    const slotKeys = Array.isArray(field.slotKeys) ? field.slotKeys : [];
    const moveColumn = (from: number, to: number): void => {
      const current = currentColumns();
      if (from < 0 || to < 0 || from >= current.length || to >= current.length || from === to) return;
      const indexes = current.map((_item, at) => at);
      const [moved] = indexes.splice(from, 1);
      indexes.splice(to, 0, moved);
      setScoresFieldColumns(template, field.key, indexes.map((sourceIndex) => current[sourceIndex]), indexes);
      context.render();
    };

    columns.forEach((column, index) => {
      const row = el('div', 'statblock-forge__scores-field-column');
      const actions = el('div', 'statblock-forge__scores-field-column-actions');
      actions.append(el('strong', 'statblock-forge__scores-field-column-index', `${translateForgeText('Column', context.language)} ${index + 1}`));
      const up = button('↑', () => moveColumn(index, index - 1), true);
      up.disabled = index === 0;
      up.title = translateForgeText('Move column left', context.language);
      up.setAttribute('aria-label', `${translateForgeText('Move column left', context.language)} ${index + 1}`);
      const down = button('↓', () => moveColumn(index, index + 1), true);
      down.disabled = index === columns.length - 1;
      down.title = translateForgeText('Move column right', context.language);
      down.setAttribute('aria-label', `${translateForgeText('Move column right', context.language)} ${index + 1}`);
      const remove = button('×', () => {
        const current = currentColumns();
        if (current.length <= 1 || index >= current.length) return;
        context.confirmDelete(`${translateForgeText('column', context.language)} “${current[index]}”`, () => {
          const latest = currentColumns();
          if (latest.length <= 1 || index >= latest.length) return;
          const next = latest.filter((_item, at) => at !== index);
          const indexes = latest.flatMap((_item, at) => at === index ? [] : [at]);
          setScoresFieldColumns(template, field.key, next, indexes);
          context.render();
        });
      }, true);
      remove.disabled = columns.length <= 1;
      remove.title = translateForgeText('Remove column', context.language);
      remove.setAttribute('aria-label', `${translateForgeText('Remove column', context.language)} ${index + 1}`);
      remove.classList.add('is-danger', 'statblock-forge__destructive-icon-button');
      actions.append(up, down, remove);

      const name = inputText(column, `${translateForgeText('Column', context.language)} ${index + 1}`);
      name.setAttribute('aria-label', `${translateForgeText('Column', context.language)} ${index + 1} ${translateForgeText('Name', context.language)}`);
      name.addEventListener('change', () => {
        const current = currentColumns();
        if (index >= current.length) return;
        const next = [...current];
        next[index] = name.value.trim();
        setScoresFieldColumns(template, field.key, next, current.map((_item, at) => at));
        context.renderPreviewOnly();
      });
      const alignmentValues = Array.isArray(field.align) ? field.align : [];
      const alignment = selectInput(String(alignmentValues[index] ?? 'start'), [
        { value: 'start', label: translateForgeText('Left', context.language) },
        { value: 'center', label: translateForgeText('Center', context.language) },
        { value: 'end', label: translateForgeText('Right', context.language) },
      ]);
      alignment.setAttribute('aria-label', `${translateForgeText('Alignment', context.language)}: ${column || index + 1}`);
      alignment.addEventListener('change', () => {
        setScoresFieldAlignment(template, field.key, index, alignment.value as 'start' | 'center' | 'end');
        context.renderPreviewOnly();
      });
      const inputs = el('div', 'statblock-forge__scores-field-column-inputs');
      inputs.append(
        labeledControl(translateForgeText('Name', context.language), name),
        labeledControl(translateForgeText('Alignment', context.language), alignment),
      );
      if (showSlotKeyRepair) {
        const slotKey = inputText(typeof slotKeys[index] === 'string' ? String(slotKeys[index]) : '', `slot_${index + 1}`);
        slotKey.setAttribute('aria-label', `Identificador interno da coluna ${index + 1}`);
        slotKey.addEventListener('change', () => {
          try {
            if (setScoresFieldSlotKey(template, field.key, index, slotKey.value)) context.render();
          } catch (error) {
            context.showNotice(error instanceof Error ? error.message : String(error));
            slotKey.value = typeof slotKeys[index] === 'string' ? String(slotKeys[index]) : '';
          }
        });
        inputs.append(labeledControl('Internal key', slotKey));
      }
      row.append(actions, inputs);
      columnEditor.append(row);
    });

    tableOptions.append(columnEditor);
    tableOptions.append(el('small', 'statblock-forge__detail', translateForgeText(
      'Edit the starting cell values directly in the table on the Canvas. New statblocks begin with this sample.',
      context.language,
    )));
    card.append(tableOptions);
  }

  const prompt = inputText(typeof field.prompt === 'string' ? field.prompt : '', 'e.g. Add speed');
  prompt.addEventListener('change', () => {
    if (prompt.value.trim()) field.prompt = prompt.value.trim();
    else delete field.prompt;
  });
  card.append(labeledControl('Texto quando vazio', prompt, 'Sugestão exibida quando o campo ainda não possui valor.'));

  const meaning = selectInput(typeof field.meaning === 'string' ? field.meaning : '', FIELD_MEANING_OPTIONS);
  meaning.addEventListener('change', () => {
    try {
      setTemplateFieldMeaning(template, field.key, meaning.value ? meaning.value as FieldMeaning : null);
    } catch (error) {
      context.showNotice(error instanceof Error ? error.message : String(error));
    }
    context.render();
  });
  card.append(labeledControl('Significado', meaning, 'Opcional. O Atlas usa significados especiais para reconhecer campos do cabeçalho e outros valores.'));

  if (field.type === 'choice') card.append(renderChoiceFieldSettings(field, context.language, context.render));


  if (field.type === 'entries') card.append(context.renderEntryExtras(field));
  if (field.type === 'counters') card.append(context.renderCounterPresets(field));
  if (field.type === 'checkboxes') card.append(context.renderCheckboxFieldOptions(field));
  return card;
}
