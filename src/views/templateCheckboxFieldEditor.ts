import type { ForgeField, JsonRecord } from '../templates/forgeTemplate.ts';
import {
  checkboxFieldAllowsMultiple,
  checkboxFieldOptions,
  normalizeCheckboxFieldValue,
  checkboxAliasBooleanValue,
  checkboxOptionKeyFromLabel,
  newCheckboxFieldOption,
  setCheckboxFieldOptions,
  repairCheckboxFieldOptionKeys,
  validateCheckboxFieldOptions,
  type CheckboxFieldOption,
} from '../templates/checkboxFieldModel.ts';
import { normalizeForgeLanguage, translateForgeText } from '../i18n/localization.ts';
import { button, el, inputText, labeledControl, toggleControl } from './templateEditorDom.ts';
import type { TemplateSpecializedFieldEditorContext } from './templateSpecializedFieldEditorContext.ts';

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

/** Editor for the options and sample values of a Checkbox field. */
export function renderCheckboxFieldOptions(
  context: TemplateSpecializedFieldEditorContext,
  field: ForgeField,
): HTMLElement {
  const panel = el('div', 'statblock-forge__checkbox-field-options-editor');
  const heading = el('strong', 'statblock-forge__subheading', 'Checkbox options');
  heading.dataset.forgeUiText = 'Checkbox options';
  panel.append(heading);
  const language = normalizeForgeLanguage(context.language);
  const multipleChoices = toggleControl(
    translateForgeText('Multiple choices', language),
    checkboxFieldAllowsMultiple(field),
    (enabled) => {
      field.allowMultiple = enabled;
      if (!enabled) {
        const sample = asRecord(context.template.sample);
        sample[field.key] = normalizeCheckboxFieldValue(field, sample[field.key]);
        context.template.sample = sample;
      }
      context.renderPreviewOnly();
    },
  );
  multipleChoices.classList.add('statblock-forge__checkbox-field-multiple-toggle');
  panel.append(multipleChoices);
  panel.append(el('p', 'statblock-forge__hint', translateForgeText(
    'When enabled, more than one option can be checked in this set. Other Checkbox Fields are independent.', language,
  )));
  const list = el('div', 'statblock-forge__checkbox-field-option-list');

  const persistOptions = (next: CheckboxFieldOption[]): boolean => {
    try {
      const previouslyManagedKeys = new Set(checkboxFieldOptions(field).flatMap((option) => [option.key, ...(option.aliases ?? [])]));
      // Validate and store the schema before touching sample values. A rejected
      // key/alias collision must never partially migrate or erase sample data.
      setCheckboxFieldOptions(field, next);
      const sample = asRecord(context.template.sample);
      const values = { ...asRecord(sample[field.key]) };
      const currentOptions = checkboxFieldOptions(field);
      const currentlyManagedKeys = new Set(currentOptions.flatMap((option) => [option.key, ...(option.aliases ?? [])]));
      const currentKeys = new Set(currentOptions.map((option) => option.key));
      for (const previousKey of previouslyManagedKeys) {
        if (!currentlyManagedKeys.has(previousKey) && !currentKeys.has(previousKey)) {
          for (const storedKey of Object.keys(values)) {
            if (storedKey.toLowerCase() === previousKey.toLowerCase()) delete values[storedKey];
          }
        }
      }
      for (const option of currentOptions) {
        if (typeof values[option.key] !== 'boolean') {
          const aliasValue = checkboxAliasBooleanValue(values, option.aliases ?? []);
          values[option.key] = typeof aliasValue === 'boolean' ? aliasValue : false;
        }
        const aliases = new Set((option.aliases ?? []).map((alias) => alias.toLowerCase()));
        for (const storedKey of Object.keys(values)) {
          if (aliases.has(storedKey.toLowerCase())) delete values[storedKey];
        }
      }
      sample[field.key] = values;
      context.template.sample = sample;
      context.renderPreviewOnly();
      return true;
    } catch (error) {
      context.showNotice(error instanceof Error ? error.message : String(error));
      return false;
    }
  };

  const renderRows = (): void => {
    list.replaceChildren();
    const options = checkboxFieldOptions(field);
    options.forEach((option, index) => {
      const row = el('div', 'statblock-forge__checkbox-field-option-row');
      const label = inputText(option.label, 'Nome da opção');
      label.addEventListener('change', () => {
        const nextLabel = label.value.trim();
        const current = checkboxFieldOptions(field);
        const next = current.map((entry, at) => {
          if (at !== index) return entry;
          const generatedKey = checkboxOptionKeyFromLabel(entry.label);
          if (entry.key !== generatedKey) return { ...entry, label: nextLabel };
          const newKey = checkboxOptionKeyFromLabel(nextLabel);
          return { ...entry, label: nextLabel, key: newKey, aliases: [...(entry.aliases ?? []), entry.key] };
        });
        if (persistOptions(next)) renderRows();
      });

      const key = inputText(option.key, 'option_key');
      key.addEventListener('change', () => {
        const requested = key.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^[^a-z]+/, 'option_').slice(0, 40);
        const current = checkboxFieldOptions(field);
        const previous = current[index];
        if (!previous) return;
        const next = current.map((entry, at) => at === index
          ? { ...entry, key: requested, aliases: [...(entry.aliases ?? []), entry.key] }
          : entry);
        if (previous.key !== requested) {
          const currentValues = asRecord(asRecord(context.template.sample)[field.key]);
          if (typeof currentValues[previous.key] === 'boolean') {
            next[index] = { ...next[index]!, aliases: [...(next[index]!.aliases ?? []), previous.key] };
          }
        }
        if (persistOptions(next)) renderRows();
      });
      key.setAttribute('aria-label', `Chave da opção ${option.label}`);

      const remove = button('×', () => context.confirmDelete(`Checkbox option “${option.label || option.key}”`, () => {
        const next = checkboxFieldOptions(field).filter((_entry, at) => at !== index);
        if (persistOptions(next)) renderRows();
      }), true);
      remove.classList.add('is-danger', 'statblock-forge__destructive-icon-button');
      remove.setAttribute('aria-label', `Remover opção ${option.label || option.key}`);
      row.append(labeledControl('Nome', label), labeledControl('Key', key), remove);
      list.append(row);
    });
    if (options.length === 0) list.append(el('p', 'statblock-forge__empty-inline', 'Adicione pelo menos uma opção.'));
  };

  renderRows();
  panel.append(list);
  const schemaIssues = validateCheckboxFieldOptions([field]);
  if (schemaIssues.length > 0) {
    panel.append(el('p', 'statblock-forge__warning', `${schemaIssues.map((issue) => issue.message).join(' ')} A normalização de valores foi pausada para evitar perda de dados.`));
    if (Array.isArray(field.options)) {
      panel.append(button('Reparar keys e aliases conflitantes', () => {
        const repairs = repairCheckboxFieldOptionKeys(field);
        const sample = asRecord(context.template.sample);
        const values = { ...asRecord(sample[field.key]) };
        for (const repair of repairs) {
          if (repair.from && typeof values[repair.from] === 'boolean' && typeof values[repair.to] !== 'boolean') {
            values[repair.to] = values[repair.from];
          }
        }
        sample[field.key] = values;
        context.template.sample = sample;
        context.renderPreviewOnly();
        context.render();
      }, true));
    } else {
      panel.append(el('p', 'statblock-forge__warning', 'A propriedade options não é uma lista. O Forge manteve os dados originais e não oferece reparo automático para essa estrutura. Corrija-a no JSON do template.'));
    }
  }
  const addOption = button('Adicionar opção', () => {
    const current = checkboxFieldOptions(field);
    if (persistOptions([...current, newCheckboxFieldOption(field, `Opção ${current.length + 1}`)])) renderRows();
  }, true);
  addOption.classList.add('statblock-forge__properties-add-compact');
  panel.append(addOption);
  return panel;
}
