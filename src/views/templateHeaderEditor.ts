/**
 * Rendering for the reserved statblock header fields.
 * The FileView remains responsible for lifecycle and state; this module only
 * builds the header editor controls and delegates mutations to field models.
 */
import { headerFieldForPart, type ForgeField, type ForgeTemplate } from '../templates/forgeTemplate.ts';
import {
  HEADER_PARTS,
  addMissingHeaderField,
} from '../templates/fieldEditorModel.ts';
import { button, el, inputText, section } from './templateEditorDom.ts';

export interface TemplateHeaderEditorContext {
  template: ForgeTemplate;
  render(): void;
  showNotice(message: string): void;
  renderNumberFieldFormulaEditor(field: ForgeField): HTMLElement;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function setHeaderHidden(template: ForgeTemplate, part: string, hidden: boolean): void {
  const header = asRecord(template.header);
  const current = Array.isArray(header.hidden)
    ? header.hidden.filter((item): item is string => typeof item === 'string')
    : [];
  const next = hidden ? [...new Set([...current, part])] : current.filter((item) => item !== part);
  template.header = { ...header, ...(next.length > 0 ? { hidden: next } : { hidden: [] }) };
}

export function renderTemplateHeaderFields(context: TemplateHeaderEditorContext): HTMLElement {
  const { template } = context;
  const panel = section('Statblock Header', 'Campos reservados ao cabeçalho do statblock. Eles não aparecem na lista de Template Fields.');
  const hidden = asRecord(template.header).hidden;
  const hiddenSet = new Set(Array.isArray(hidden) ? hidden.filter((item): item is string => typeof item === 'string') : []);

  for (const part of HEADER_PARTS) {
    const field = headerFieldForPart(template.fields, part.id);
    const group = el('div', 'statblock-forge__header-field-group');
    const row = el('div', 'statblock-forge__header-field');
    const description = el('div');
    description.append(el('strong', '', part.label));
    if (field) {
      const fieldLabel = inputText(field.label, part.label);
      fieldLabel.addEventListener('change', () => {
        field.label = fieldLabel.value.trim();
        context.render();
      });
      description.append(fieldLabel);
    } else {
      description.append(el('small', 'statblock-forge__hint', 'Campo ausente no template'));
      const addHeaderField = button('Adicionar campo', () => {
        try {
          addMissingHeaderField(template, part.id);
          context.render();
        } catch (error) {
          context.showNotice(error instanceof Error ? error.message : String(error));
        }
      }, true);
      addHeaderField.classList.add('statblock-forge__properties-add-compact');
      description.append(addHeaderField);
    }
    row.append(description);

    if (!part.always) {
      const toggleLabel = el('label', 'statblock-forge__inline-toggle');
      const checkbox = el('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !hiddenSet.has(part.id);
      checkbox.addEventListener('change', () => {
        setHeaderHidden(template, part.id, !checkbox.checked);
        context.render();
      });
      toggleLabel.append(checkbox, document.createTextNode('Exibir'));
      row.append(toggleLabel);
    } else {
      row.append(el('span', 'statblock-forge__required', part.id === 'name' ? 'Sempre exibido' : 'Token fixo'));
    }

    group.append(row);
    if ((part.id === 'hp' && field?.type === 'number') || (part.id === 'level' && field?.type === 'rating')) {
      group.append(context.renderNumberFieldFormulaEditor(field));
    }
    panel.append(group);
  }

  return panel;
}
