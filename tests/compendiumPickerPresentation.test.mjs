import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8');

test('Entries actions use the concise Custom and Compendium labels', () => {
  assert.match(source, /const trigger = element\('button', 'statblock-forge__entry-action-button', 'Compendium'\)/);
  assert.match(source, /const add = element\('button', 'statblock-forge__entry-action-button statblock-forge__entry-add-trigger', language === 'pt-BR' \? 'Personalizado' : 'Custom'\)/);
  assert.doesNotMatch(source, /\+ Custom ability|\+ Habilidade customizada|\+ Add from\.\.\.|\+ Adicionar de\.\.\./);
});

test('Compendium picker is viewport-aware and remains anchored to its trigger', () => {
  assert.match(source, /const rect = trigger\.getBoundingClientRect\(\)/);
  assert.match(source, /popover\.setCssStyles\(\{ position: 'fixed' \}\)/);
  assert.match(source, /const left = Math\.max\(12, Math\.min\(rect\.left, viewportWidth - width - 12\)\)/);
  assert.match(source, /const openAbove = availableBelow < 280 && availableAbove > availableBelow/);
  assert.match(source, /window\.addEventListener\('resize', positionPopover\)/);
  assert.match(source, /window\.addEventListener\('scroll', positionPopover, true\)/);
});

test('Compendium picker hides used Entries and refreshes availability after statblock edits', () => {
  assert.match(source, /fieldCompendiumLinkedFieldKeys\(layout, field\)/);
  assert.match(source, /usedFieldCompendiumItemIdsAcrossValues\(items, linkedValues\)/);
  assert.match(source, /runtime\.subscribeCompendiumAvailability\(applyFilters\)/);
  assert.match(source, /appendFieldCompendiumItemValue\(field\.type, currentData\[field\.key\], item\.value, item\.id\)/);
  assert.match(source, /const currentData = runtime\.getCurrentData\(\)/);
  assert.match(source, /const openPopover = \(\): void => \{/);
  assert.match(source, /applyFilters\(\);\s*isOpen = true;/);
  assert.match(source, /await onValueChange\(fieldKey, value\);\s*\/\/ Notify again after persistence:[\s\S]*?notifyAll\(\)/);
  assert.match(source, /Edit or delete one to make it available again/);
});

test('the full-field Entries JSON editor does not expose internal Compendium source IDs', async () => {
  const source = await readFile(new URL('../src/statblocks/statblockFieldEditorModel.ts', import.meta.url), 'utf8');
  assert.match(source, /stripFieldCompendiumEntrySourceMetadata\(value\)/);
});


test('Compendium Field selector shows each Field key beside its label', async () => {
  const source = await readFile(new URL('../src/views/TemplateEditorView.ts', import.meta.url), 'utf8');
  assert.match(source, /const fieldLabel = field\.label\.trim\(\)/);
  assert.match(source, /label: fieldLabel && fieldLabel !== field\.key \? `\$\{fieldLabel\} \(\$\{field\.key\}\)` : field\.key/);
});

test('Template Editor exposes a Compendium source selector only for compatible Collections', async () => {
  const source = await readFile(new URL('../src/views/TemplateEditorView.ts', import.meta.url), 'utf8');
  assert.match(source, /const compatibleFields = fields\.filter\(\(candidate\) => candidate\.key !== field\.key && candidate\.type === field\.type\)/);
  assert.match(source, /if \(compatibleFields\.length > 0\)/);
  assert.match(source, /pt \? 'Origem do Compendium' : 'Compendium source'/);
  assert.match(source, /setFieldCompendiumSource\(layout, field, nextSource\)/);
});


test('Compendium availability reads the latest persisted source binding while the statblock stays open', async () => {
  assert.match(source, /getLiveFieldData\?: \(\) => JsonRecord/);
  assert.match(source, /return getLiveFieldData\?\.\(\) \?\? data/);
  assert.match(source, /createNumericFieldRuntime\([\s\S]*?options\.getLiveFieldData/);
  assert.match(source, /card\.addEventListener\(FORGE_STATBLOCK_SOURCE_DATA_CHANGED_EVENT,[\s\S]*?numericRuntime\.refreshCompendiumAvailability\(\)/);
  const surface = await readFile(new URL('../src/views/StatblockRenderSurface.ts', import.meta.url), 'utf8');
  assert.match(surface, /getLiveFieldData: \(\) => forgeRestDataWithResources\(source\.binding\.data, source\.raw\)/);
  assert.match(surface, /source\.binding\.data\[fieldKey\] = value/);
  assert.match(surface, /dispatchEvent\(new Event\(FORGE_STATBLOCK_SOURCE_DATA_CHANGED_EVENT\)\)/);
  const bindingUpdate = surface.indexOf('source.binding.data[fieldKey] = value');
  const availabilitySignal = surface.indexOf('dispatchEvent(new Event(FORGE_STATBLOCK_SOURCE_DATA_CHANGED_EVENT))', bindingUpdate);
  assert.ok(bindingUpdate >= 0 && availabilitySignal > bindingUpdate,
    'the availability event must be dispatched after the saved binding has been updated');
});


test('Compendium create and edit form is rendered above the existing item list', async () => {
  const templateEditor = await readFile(new URL('../src/views/TemplateEditorView.ts', import.meta.url), 'utf8');
  const headerAppend = templateEditor.indexOf('panel.append(header);', templateEditor.indexOf('private renderCompendiumPanel'));
  const formRender = templateEditor.indexOf('this.renderCompendiumItemForm(field, current)', headerAppend);
  const itemListRender = templateEditor.indexOf('panel.append(list);', headerAppend);
  assert.ok(headerAppend >= 0, 'Compendium heading should be rendered');
  assert.ok(formRender > headerAppend, 'create/edit form should follow the Compendium heading');
  assert.ok(itemListRender > formRender, 'create/edit form should appear before the existing item list');
});


test('every editable Collection exposes a statblock-only Custom action', async () => {
  assert.match(source, /function appendCustomCollectionValueAction\([\s\S]*?isCollectionFieldType\(field\.type\) \|\| field\.type === 'entries'/);
  assert.match(source, /case 'tags': return renderTags\([\s\S]*?case 'pairs': return renderPairs\([\s\S]*?case 'spells': return renderGroups\(/);
  assert.match(source, /function createInlineListFieldValue\([\s\S]*?appendCustomCollectionValueAction\(actions, field, runtime, language\);[\s\S]*?appendFieldCompendiumPicker\(actions, field, layout, sample, runtime, language\)/);
  assert.match(source, /function createInlinePairsFieldValue\([\s\S]*?appendCustomCollectionValueAction\(actions, field, runtime, language\);[\s\S]*?appendFieldCompendiumPicker\(actions, field, layout, sample, runtime, language\)/);
  assert.match(source, /card\.addEventListener\('forge:edit-field',[\s\S]*?\}, true\)/);
  assert.match(source, /void schedule\(\(\) => openRegion\(region, fieldKey\)\)/);
  assert.match(source, /if \(field\?\.type === 'entries' && numericRuntime\?\.canEdit\)/);
});

test('Groups replaces the old Spells label in Field and block selectors', async () => {
  const toolbar = await readFile(new URL('../src/views/templateCanvasToolbar.ts', import.meta.url), 'utf8');
  const layout = await readFile(new URL('../src/templates/layoutEditorModel.ts', import.meta.url), 'utf8');
  assert.match(toolbar, /spells: 'Groups'/);
  assert.match(layout, /value: 'spells', label: 'Groups'/);
  assert.doesNotMatch(toolbar, /spells: 'Spells'/);
  assert.doesNotMatch(layout, /label: 'Spells'/);
});

test('Groups editors use neutral value/category placeholders rather than spell terminology', async () => {
  const templateEditor = await readFile(new URL('../src/views/TemplateEditorView.ts', import.meta.url), 'utf8');
  const help = await readFile(new URL('../src/views/componentHelp.ts', import.meta.url), 'utf8');
  assert.match(templateEditor, /e\.g\. 3 uses\/day, Phase 1, Recharge 5–6/);
  assert.match(templateEditor, /Comma-separated values/);
  assert.doesNotMatch(templateEditor, /1st level \(3 slots\)|1º círculo \(3 espaços\)|Comma-separated spells|Magias separadas por vírgula/);
  assert.doesNotMatch(help, /5th-level spellcaster|Magic missile|Cantrips|Mísseis mágicos/);
});
