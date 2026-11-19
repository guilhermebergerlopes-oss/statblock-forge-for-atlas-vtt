/** Shared read-only preview for Ability entries in the template library and statblock picker. */
import { abilityPartsForField } from '../templates/abilityPartsModel.ts';
import { inlineEntryDraftValue } from '../statblocks/inlineEntriesFieldEditorModel.ts';
import type { ForgeField } from '../templates/forgeTemplate.ts';
import type { ForgeLanguage } from '../i18n/localization.ts';

export interface AbilityCompendiumPartPreview {
  key: string;
  label: string;
  type: string;
  value: string;
  counterMarks?: boolean[];
  counterMax?: number;
  counterFilled?: number;
  counterLook?: 'pips' | 'checkboxes';
}

export interface AbilityCompendiumPreviewData {
  name: string;
  description: string;
  parts: AbilityCompendiumPartPreview[];
}

function readablePartValue(value: string): string {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).join(', ');
}

/** Returns the configured name, description, and every Part, including unset Parts. */
export function abilityCompendiumPreviewData(field: ForgeField, rawEntry: unknown): AbilityCompendiumPreviewData {
  const draft = inlineEntryDraftValue(field, rawEntry);
  const parts = abilityPartsForField(field).map((part): AbilityCompendiumPartPreview => {
    if (part.type === 'counter') {
      const marks = [...(draft.counterMarks[part.key] ?? [])];
      const max = Math.max(1, draft.counterMaxes[part.key] ?? (marks.length || Number(part.max) || 3));
      return {
        key: part.key,
        label: part.label,
        type: part.type,
        value: '',
        counterMarks: marks,
        counterMax: max,
        counterFilled: marks.filter(Boolean).length,
        counterLook: part.look === 'checkboxes' ? 'checkboxes' : 'pips',
      };
    }
    return {
      key: part.key,
      label: part.label,
      type: part.type,
      value: readablePartValue(draft.parts[part.key] ?? ''),
    };
  });
  return { name: draft.name, description: draft.text, parts };
}

function appendText(parent: HTMLElement, tag: string, className: string, text: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  parent.append(node);
  return node;
}

/** Renders a compact but complete read-only preview of an Ability library item. */
export function renderCompendiumAbilityPreview(
  field: ForgeField,
  rawEntry: unknown,
  language: ForgeLanguage,
  nameOverride?: string,
): HTMLElement {
  const pt = language === 'pt-BR';
  const data = abilityCompendiumPreviewData(field, rawEntry);
  const root = document.createElement('div');
  root.className = 'statblock-forge__ability-compendium-preview';

  const name = (nameOverride ?? data.name).trim();
  if (name) appendText(root, 'strong', 'statblock-forge__ability-compendium-preview-name', name);
  if (data.description.trim()) {
    appendText(root, 'span', 'statblock-forge__ability-compendium-preview-description', data.description.trim());
  }

  if (data.parts.length > 0) {
    const partsRoot = document.createElement('div');
    partsRoot.className = 'statblock-forge__ability-compendium-preview-parts';
    for (const part of data.parts) {
      const row = document.createElement('div');
      row.className = 'statblock-forge__ability-compendium-preview-part';
      appendText(row, 'span', 'statblock-forge__ability-compendium-preview-part-label', `${part.label}:`);

      if (part.type === 'counter') {
        const marks = part.counterMarks ?? [];
        const max = part.counterMax ?? (marks.length || 3);
        const filled = part.counterFilled ?? marks.filter(Boolean).length;
        const counter = document.createElement('span');
        counter.className = 'statblock-forge__ability-compendium-preview-counter';
        counter.setAttribute('aria-label', `${filled} / ${max}`);
        if (max <= 8) {
          const pips = document.createElement('span');
          pips.className = `statblock-forge__ability-compendium-preview-counter-pips is-${part.counterLook ?? 'pips'}`;
          for (let index = 0; index < max; index += 1) {
            const pip = document.createElement('span');
            pip.className = `statblock-forge__ability-compendium-preview-counter-pip${marks[index] ? ' is-filled' : ''}`;
            pip.setAttribute('aria-hidden', 'true');
            pips.append(pip);
          }
          counter.append(pips);
        }
        appendText(counter, 'span', 'statblock-forge__ability-compendium-preview-counter-count', `${filled}/${max}`);
        row.append(counter);
      } else {
        appendText(row, 'span', `statblock-forge__ability-compendium-preview-part-value${part.value ? '' : ' is-empty'}`,
          part.value || (pt ? 'Não definido' : 'Not set'));
      }
      partsRoot.append(row);
    }
    root.append(partsRoot);
  }
  if (!root.childElementCount) appendText(root, 'span', 'statblock-forge__ability-compendium-preview-empty', pt ? 'Habilidade sem conteúdo.' : 'Ability has no content.');
  return root;
}
