import type { ForgeField } from '../templates/forgeTemplate.ts';
import { translateForgeText, type ForgeLanguage } from '../i18n/localization.ts';
import { el, inputText, labeledControl, toggleControl } from './templateEditorDom.ts';

function optionalBoolean(field: ForgeField, key: 'open' | 'several' | 'numbered', enabled: boolean): void {
  if (enabled) field[key] = true;
  else delete field[key];
}

/** The sample line Atlas shows below Choice's options. */
export function choiceFieldReadExample(field: ForgeField): string {
  const options = Array.isArray(field.options)
    ? field.options.filter((option): option is string => typeof option === 'string')
    : [];
  const [first = 'one', second = 'another'] = options;
  const unit = typeof field.unit === 'string' && field.unit.trim() ? ` ${field.unit.trim()}` : '';
  const pick = (option: string, number: number): string => field.numbered === true ? `${option} ${number}${unit}` : option;
  return field.several === true ? `${pick(first, 60)}, ${pick(second, 30)}` : pick(first, 60);
}

/**
 * Choice settings shared by the selected Value tile and the Fields sidebar.
 * This mirrors Atlas ChoiceSettings: list, several picks, per-pick number,
 * optional unit, custom values, and the same concise read example.
 */
export function renderChoiceFieldSettings(
  field: ForgeField,
  language: ForgeLanguage,
  render: () => void,
): HTMLElement {
  const panel = el('div', 'statblock-forge__choice-field-settings');
  const choices = inputText(
    Array.isArray(field.options) ? field.options.filter((option): option is string => typeof option === 'string').join(', ') : '',
    translateForgeText('Small, Medium, Large', language),
  );
  choices.addEventListener('change', () => {
    const next = choices.value.split(',').map((option) => option.trim()).filter(Boolean);
    if (next.length > 0) field.options = next;
    else delete field.options;
    render();
  });
  panel.append(labeledControl(
    translateForgeText('Choices', language),
    choices,
    translateForgeText('Separate options with commas.', language),
  ));

  panel.append(
    toggleControl(translateForgeText('Pick several', language), field.several === true, (enabled) => {
      optionalBoolean(field, 'several', enabled);
      render();
    }),
    toggleControl(translateForgeText('Each with a number', language), field.numbered === true, (enabled) => {
      optionalBoolean(field, 'numbered', enabled);
      render();
    }),
  );

  if (field.numbered === true) {
    const unit = inputText(typeof field.unit === 'string' ? field.unit : '', translateForgeText('e.g. ft.', language));
    unit.addEventListener('change', () => {
      if (unit.value.trim()) field.unit = unit.value;
      else delete field.unit;
      render();
    });
    panel.append(labeledControl(translateForgeText('Unit', language), unit));
  }

  panel.append(toggleControl(translateForgeText('Allow other values', language), field.open === true, (enabled) => {
    optionalBoolean(field, 'open', enabled);
    render();
  }));

  return panel;
}
