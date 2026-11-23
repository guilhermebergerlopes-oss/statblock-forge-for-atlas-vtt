/** Per-Field typography controls in the Template Appearance tab. */
import type { ForgeField, ForgeLayoutDocument, ForgeTemplate, FieldTypographyAppearance } from '../templates/forgeTemplate.ts';
import { fieldTypographyForField, resetFieldTypographyForField, setFieldTypographyForField } from '../templates/fieldTypographyModel.ts';
import { ensureFieldId } from '../templates/fieldCompendiumModel.ts';
import { translateForgeText, type ForgeLanguage } from '../i18n/localization.ts';
import { button, collapsibleAppearanceGroup, el, labeledControl, selectInput } from './templateEditorDom.ts';
import { appendTypographyControls } from './templateBlockAppearanceInspector.ts';

export interface TemplateFieldTypographyInspectorOptions {
  template: ForgeTemplate;
  layout: ForgeLayoutDocument;
  language: ForgeLanguage;
  selectedFieldKey: string | null;
  setSelectedFieldKey(key: string | null): void;
  render(): void;
  renderPreviewOnly(): void;
}

function isUserField(field: ForgeField): boolean {
  return field.type !== 'scores' && field.forgeInternal !== 'table-storage';
}

export function renderTemplateFieldTypographyInspector(options: TemplateFieldTypographyInspectorOptions): HTMLElement {
  const { template, layout, language } = options;
  const panel = el('details', 'statblock-forge__field-typography-inspector');
  panel.dataset.forgeDisclosureKey = 'field-typography:panel';
  panel.append(el('summary', '', translateForgeText('Field typography', language)));
  panel.append(el('p', 'statblock-forge__detail', translateForgeText(
    'Customize the text of one Field everywhere it appears in this statblock. These settings override block typography for that Field.',
    language,
  )));

  const fields = template.fields.filter(isUserField);
  if (fields.length === 0) {
    panel.append(el('p', 'statblock-forge__empty-note', translateForgeText('No Fields available for typography customization.', language)));
    return panel;
  }

  const selected = fields.find((field) => field.key === options.selectedFieldKey) ?? fields[0]!;
  if (selected.key !== options.selectedFieldKey) options.setSelectedFieldKey(selected.key);
  const fieldPicker = selectInput(selected.key, fields.map((field) => ({
    value: field.key,
    label: `${field.label.trim() || field.key} (${field.key})`,
  })));
  fieldPicker.addEventListener('change', () => {
    options.setSelectedFieldKey(fieldPicker.value || null);
    options.render();
  });
  panel.append(labeledControl(translateForgeText('Field to customize', language), fieldPicker));

  // Ensure identity exists before editing. The stable ID is independent of
  // the editable Field key and therefore survives key renames.
  ensureFieldId(layout, selected);
  const current = fieldTypographyForField(layout, selected);
  const appearance = { ...current } as FieldTypographyAppearance;
  const mutableAppearance = appearance as FieldTypographyAppearance & Record<string, unknown>;
  let resetButton: HTMLButtonElement | null = null;
  const onChange = (): void => {
    setFieldTypographyForField(layout, selected, mutableAppearance);
    if (resetButton) resetButton.disabled = Object.keys(mutableAppearance).length === 0;
    options.renderPreviewOnly();
  };
  const controlsContext = { language, renderPreviewOnly: onChange };
  appendTypographyControls(panel, translateForgeText('All text', language), 'text', mutableAppearance, controlsContext, 'field-typography:scope:text');
  appendTypographyControls(panel, translateForgeText('Labels', language), 'label', mutableAppearance, controlsContext, 'field-typography:scope:label');
  appendTypographyControls(panel, translateForgeText('Values', language), 'value', mutableAppearance, controlsContext, 'field-typography:scope:value');

  const reset = button(translateForgeText('Reset field typography', language), () => {
    resetFieldTypographyForField(layout, selected);
    options.render();
  }, true);
  reset.classList.add('statblock-forge__properties-utility-button');
  reset.disabled = Object.keys(current).length === 0;
  resetButton = reset;
  panel.append(reset);
  return panel;
}
