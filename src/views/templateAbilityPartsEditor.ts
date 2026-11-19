import {
  ABILITY_PART_TYPES,
  abilityPartKeyProblem,
  abilityEntryKeyProblem,
  abilityPartsForField,
  addAbilityPart,
  moveAbilityPart,
  removeAbilityPart,
  removeAbilityPartAppearance,
  renameAbilityPartAppearanceKey,
  renameAbilityPartKey,
  retypeAbilityPart,
  setAbilityPartIndicatorColor,
  syncAbilityEntryShape,
  updateAbilityPart,
  type AbilityPartType,
} from '../templates/abilityPartsModel.ts';
import { slugify, type ForgeField, type ForgeLayoutDocument, type JsonRecord } from '../templates/forgeTemplate.ts';
import { translateForgeText } from '../i18n/localization.ts';
import {
  abilityPartOptionsText,
  abilityPartTypeLabel,
  button,
  el,
  inputText,
  labeledControl,
  numberInput,
  parseAbilityPartOptions,
  selectInput,
  textareaInput,
  toggleControl,
  appearanceGroup,
} from './templateEditorDom.ts';
import type { TemplateSpecializedFieldEditorContext, AbilityPartIndicatorColor } from './templateSpecializedFieldEditorContext.ts';

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function updatePartColor(
  context: TemplateSpecializedFieldEditorContext,
  fieldKey: string,
  partKey: string,
  property: AbilityPartIndicatorColor,
  value: string | undefined,
): void {
  const layout = context.getLayout();
  if (!layout) return;
  setAbilityPartIndicatorColor(layout, fieldKey, partKey, property, value);
}

/** Editor for Entries/Abilities schema and its shared Ability Parts. */
export function renderEntryExtras(
  context: TemplateSpecializedFieldEditorContext,
  inputFields: ForgeField[] | ForgeField,
): HTMLElement {
  const fields = Array.isArray(inputFields) ? inputFields : [inputFields];
  const field = fields[0];
  const panel = el('div', 'statblock-forge__parts-editor');
  if (!field) {
    return panel;
  }
  const entry = asRecord(field.entry);
  const extras = abilityPartsForField(field);
  const syncEntryShape = (): void => {
    // Keep the Entry schema shared across the Abilities tile, as in Atlas.
    syncAbilityEntryShape(field, fields.slice(1));
  };
  const syncPartEdit = (edit: () => void): void => {
    edit();
    syncEntryShape();
  };
  const syncPartAppearance = (partKey: string, property: AbilityPartIndicatorColor, value: string | undefined): void => {
    for (const target of fields) updatePartColor(context, target.key, partKey, property, value);
  };
  const nameKey = inputText(typeof entry.nameKey === 'string' ? entry.nameKey : 'name', 'name');
  nameKey.addEventListener('change', () => {
    const raw = nameKey.value.trim();
    const value = raw ? slugify(raw).replace(/-/g, '_') : '';
    const effectiveValue = value || 'name';
    const currentText = typeof asRecord(field.entry).textKey === 'string' && String(asRecord(field.entry).textKey).trim()
      ? String(asRecord(field.entry).textKey).trim() : 'desc';
    const problem = abilityEntryKeyProblem(field, effectiveValue, currentText);
    if (problem) {
      context.showNotice(problem);
      nameKey.value = typeof entry.nameKey === 'string' ? entry.nameKey : 'name';
      return;
    }
    const next = { ...asRecord(field.entry) };
    if (!value || value === 'name') delete next.nameKey;
    else next.nameKey = value;
    field.entry = next;
    context.renderPreviewOnly();
  });
  const textKey = inputText(typeof entry.textKey === 'string' ? entry.textKey : 'desc', 'desc');
  textKey.addEventListener('change', () => {
    const raw = textKey.value.trim();
    const value = raw ? slugify(raw).replace(/-/g, '_') : '';
    const effectiveValue = value || 'desc';
    const currentName = typeof asRecord(field.entry).nameKey === 'string' && String(asRecord(field.entry).nameKey).trim()
      ? String(asRecord(field.entry).nameKey).trim() : 'name';
    const problem = abilityEntryKeyProblem(field, currentName, effectiveValue);
    if (problem) {
      context.showNotice(problem);
      textKey.value = typeof entry.textKey === 'string' ? entry.textKey : 'desc';
      return;
    }
    const next = { ...asRecord(field.entry) };
    if (!value || value === 'desc') delete next.textKey;
    else next.textKey = value;
    field.entry = next;
    context.renderPreviewOnly();
  });
  panel.append(labeledControl('Chave do nome', nameKey), labeledControl('Chave da descrição', textKey));

  if (fields.length > 1) {
    const schemas = fields.map((item) => JSON.stringify(asRecord(item.entry).extras ?? []));
    const isSynced = schemas.every((schema) => schema === schemas[0]);
    if (!isSynced) panel.append(el('p', 'statblock-forge__warning', 'As Ability Parts destas abas estão diferentes.'));
    if (!isSynced) {
      panel.append(button('Sincronizar Ability Parts entre abas', () => {
        syncEntryShape();
        context.render();
      }, true));
    }
  }

  const heading = el('div', 'statblock-forge__parts-heading statblock-forge__parts-heading--ability');
  heading.append(el('strong', '', 'Ability Parts'));
  const addType = selectInput('text', ABILITY_PART_TYPES.map((type) => ({ value: type, label: abilityPartTypeLabel(type) })));
  const addActions = el('div', 'statblock-forge__part-add-actions');
  addActions.append(labeledControl('Novo tipo', addType));
  const addPartButton = button('Adicionar Part', () => {
    try {
      addAbilityPart(field, addType.value as AbilityPartType);
      syncEntryShape();
      const layout = context.ensureLayout();
      layout.abilityParts ??= {};
      for (const target of fields) layout.abilityParts[target.key] ??= {};
      context.render();
    } catch (error) {
      context.showNotice(error instanceof Error ? error.message : String(error));
    }
  }, true);
  addPartButton.classList.add('statblock-forge__properties-add-compact');
  addActions.append(addPartButton);
  heading.append(addActions);
  panel.append(heading);

  extras.forEach((part, index) => {
    const card = el('div', 'statblock-forge__part-card');
    const row = el('div', 'statblock-forge__part-row statblock-forge__ability-part-row');
    const label = inputText(part.label, 'Label');
    const key = inputText(part.key, 'part_key');
    const options: Array<{ value: string; label: string }> = ABILITY_PART_TYPES.map((value) => ({ value, label: abilityPartTypeLabel(value) }));
    if (!(ABILITY_PART_TYPES as readonly string[]).includes(part.type)) options.unshift({ value: part.type, label: abilityPartTypeLabel(part.type) });
    const type = selectInput(part.type, options);
    label.addEventListener('change', () => {
      syncPartEdit(() => updateAbilityPart(field, part.key, (current) => ({ ...current, label: label.value.trim() || current.key })));
    });
    key.addEventListener('change', () => {
      const rawKey = key.value.trim();
      const nextKey = rawKey ? slugify(rawKey).replace(/-/g, '_').slice(0, 40) : '';
      const problem = fields.map((target) => abilityPartKeyProblem(target, nextKey, part.key)).find((issue) => issue !== null) ?? null;
      if (problem) { context.showNotice(problem); key.value = part.key; return; }
      try {
        const previousKey = part.key;
        renameAbilityPartKey(field, previousKey, nextKey);
        syncEntryShape();
        const layout = context.getLayout();
        if (layout) {
          for (const target of fields) renameAbilityPartAppearanceKey(layout, target.key, previousKey, nextKey);
        }
        context.render();
      } catch (error) {
        context.showNotice(error instanceof Error ? error.message : String(error));
        key.value = part.key;
      }
    });
    type.addEventListener('change', () => {
      if (!ABILITY_PART_TYPES.includes(type.value as AbilityPartType)) return;
      syncPartEdit(() => updateAbilityPart(field, part.key, (current) => retypeAbilityPart(current, type.value as AbilityPartType)));
      context.render();
    });
    row.append(labeledControl('Nome', label), labeledControl('Key', key), labeledControl('Tipo', type));
    const order = el('div', 'statblock-forge__part-order');
    const up = button('↑', () => {
      syncPartEdit(() => { moveAbilityPart(field, part.key, -1); });
      context.render();
    }, true);
    const down = button('↓', () => {
      syncPartEdit(() => { moveAbilityPart(field, part.key, 1); });
      context.render();
    }, true);
    up.disabled = index === 0;
    down.disabled = index === extras.length - 1;
    order.append(up, down);
    const actions = el('div', 'statblock-forge__part-actions');
    const removePart = button('×', () => context.confirmDelete(`Ability Part “${part.label || part.key}”`, () => {
      syncPartEdit(() => { removeAbilityPart(field, part.key); });
      const layout = context.getLayout();
      if (layout) for (const target of fields) removeAbilityPartAppearance(layout, target.key, part.key);
      context.render();
    }), true);
    removePart.classList.add('is-danger', 'statblock-forge__destructive-icon-button');
    actions.append(order, removePart);
    row.append(actions);
    card.append(row);

    if (part.type === 'choice') {
      const choice = el('div', 'statblock-forge__part-settings');
      const optionsInput = textareaInput(abilityPartOptionsText(part.options), 'One option per line', 3);
      optionsInput.addEventListener('change', () => {
        const parsed = parseAbilityPartOptions(optionsInput.value);
        syncPartEdit(() => updateAbilityPart(field, part.key, (current) => ({ ...current, options: parsed })));
      });
      choice.append(labeledControl('Opções', optionsInput, 'Uma opção por linha. O valor é salvo como texto, inclusive quando várias opções são permitidas.'));
      choice.append(toggleControl('Permitir várias opções', part.several === true, (checked) => {
        syncPartEdit(() => updateAbilityPart(field, part.key, (current) => {
          const next = { ...current };
          if (checked) next.several = true;
          else delete next.several;
          return next;
        }));
        context.renderPreviewOnly();
      }));
      card.append(choice);
    }

    if (part.type === 'counter') {
      const counterSettings = el('div', 'statblock-forge__part-settings');
      const max = numberInput(typeof part.max === 'number' ? part.max : 3, 1, 12);
      max.addEventListener('change', () => {
        const value = Math.max(1, Math.min(12, Math.floor(Number(max.value) || 3)));
        max.value = String(value);
        syncPartEdit(() => updateAbilityPart(field, part.key, (current) => ({ ...current, max: value })));
        context.renderPreviewOnly();
      });
      const look = selectInput(part.look === 'checkboxes' ? 'checkboxes' : 'pips', [
        { value: 'pips', label: 'Pips' }, { value: 'checkboxes', label: 'Boxes' },
      ]);
      look.addEventListener('change', () => {
        syncPartEdit(() => updateAbilityPart(field, part.key, (current) => ({ ...current, look: look.value as 'pips' | 'checkboxes' })));
        context.renderPreviewOnly();
      });
      counterSettings.append(
        labeledControl('Máximo padrão por habilidade', max, 'Cada linha pode ter um máximo próprio no statblock; este valor é o padrão.'),
        labeledControl('Visual', look),
      );
      const currentPartAppearance = context.getLayout()?.abilityParts?.[field.key]?.[part.key] ?? {};
      const hasPartColors = Boolean(currentPartAppearance.trackFillColor || currentPartAppearance.trackEmptyColor || currentPartAppearance.trackBorderColor);
      const partAppearanceMode = currentPartAppearance.appearanceMode ?? (hasPartColors ? 'custom' : 'theme');
      const partAdvanced = el('details', 'statblock-forge__appearance-advanced statblock-forge__part-appearance-advanced');
      partAdvanced.open = context.getAbilityAppearanceAdvancedOpen();
      partAdvanced.addEventListener('toggle', () => context.setAbilityAppearanceAdvancedOpen(partAdvanced.open));
      partAdvanced.append(el('summary', '', 'Appearance'));
      const partMode = toggleControl(translateForgeText('Custom appearance', context.language), partAppearanceMode === 'custom', (enabled) => {
        const layout = context.getLayout();
        if (!layout) return;
        layout.abilityParts ??= {};
        for (const target of fields) {
          layout.abilityParts[target.key] ??= {};
          layout.abilityParts[target.key]![part.key] ??= {};
          layout.abilityParts[target.key]![part.key]!.appearanceMode = enabled ? 'custom' : 'theme';
        }
        if (enabled) context.setAbilityAppearanceAdvancedOpen(true);
        context.render();
      });
      partMode.className += ' statblock-forge__custom-appearance-toggle';
      partAdvanced.append(partMode);
      if (partAppearanceMode === 'custom') {
        const colors = appearanceGroup('Indicator colors');
        colors.append(
          context.renderColorControl('Filled marks', currentPartAppearance.trackFillColor, (value) => syncPartAppearance(part.key, 'trackFillColor', value)),
          context.renderColorControl('Empty marks', currentPartAppearance.trackEmptyColor, (value) => syncPartAppearance(part.key, 'trackEmptyColor', value)),
          context.renderColorControl('Mark outline', currentPartAppearance.trackBorderColor, (value) => syncPartAppearance(part.key, 'trackBorderColor', value)),
        );
        partAdvanced.append(colors);
      }
      counterSettings.append(partAdvanced);
      card.append(counterSettings);
    }
    panel.append(card);
  });
  return panel;
}
