import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addFieldCompendiumItem,
  compendiumCategories,
  ensureFieldId,
  filterCompendiumItems,
  fieldCompendiumItems,
  fieldCompendiumLinkedFieldKeys,
  fieldCompendiumSourceKey,
  setFieldCompendiumSource,
  removeFieldCompendium,
  removeFieldCompendiumItem,
  renameFieldCompendiumIdentity,
  updateFieldCompendiumItem,
} from '../src/templates/fieldCompendiumModel.ts';
import { createForgeLayout, parseForgeLayout } from '../src/templates/forgeTemplate.ts';
import { appendFieldCompendiumItemValue } from '../src/statblocks/fieldCompendiumInsertionModel.ts';
import { insertInlineEntryValue } from '../src/statblocks/inlineEntriesFieldEditorModel.ts';
import { abilityCompendiumPreviewData } from '../src/render/compendiumAbilityPreview.ts';

function makeFixture() {
  const fields = [
    { key: 'combat_abilities', label: 'Features', type: 'entries', entry: { nameKey: 'name', textKey: 'desc' } },
    { key: 'passive_traits', label: 'Features', type: 'entries', entry: { nameKey: 'name', textKey: 'desc' } },
  ];
  const template = {
    format: 'atlas-statblock-template',
    version: 1,
    id: 'two-entry-fields-template',
    fields,
    layout: { maxColumns: 12, blocks: [] },
  };
  return { fields, template, layout: createForgeLayout(template) };
}

test('two Entries Fields with the same label get separate Compendium libraries', () => {
  const { fields, layout } = makeFixture();
  const [combat, passive] = fields;
  const combatId = ensureFieldId(layout, combat);
  const passiveId = ensureFieldId(layout, passive);
  assert.notEqual(combatId, passiveId);

  addFieldCompendiumItem(layout, combat, 'Bite', { name: 'Bite', desc: '2d8+4 damage', parts: { damage: '2d8+4' } });
  addFieldCompendiumItem(layout, passive, 'Keen Smell', { name: 'Keen Smell', desc: 'Advantage on smell checks.' });

  assert.deepEqual(fieldCompendiumItems(layout, combat).map((item) => item.name), ['Bite']);
  assert.deepEqual(fieldCompendiumItems(layout, passive).map((item) => item.name), ['Keen Smell']);
  assert.equal(layout.compendiumByFieldId[combatId].length, 1);
  assert.equal(layout.compendiumByFieldId[passiveId].length, 1);
});

test('editing and deleting an item in one Entries Field never affects the other Field', () => {
  const { fields, layout } = makeFixture();
  const [combat, passive] = fields;
  const combatItem = addFieldCompendiumItem(layout, combat, 'Bite', { name: 'Bite', desc: 'Old description' });
  addFieldCompendiumItem(layout, passive, 'Keen Smell', { name: 'Keen Smell', desc: 'Passive trait' });

  assert.equal(updateFieldCompendiumItem(layout, combat, combatItem.id, 'Bite+', { name: 'Bite+', desc: 'Updated' }), true);
  assert.deepEqual(fieldCompendiumItems(layout, combat).map((item) => item.name), ['Bite+']);
  assert.deepEqual(fieldCompendiumItems(layout, passive).map((item) => item.name), ['Keen Smell']);

  assert.equal(removeFieldCompendiumItem(layout, combat, combatItem.id), true);
  assert.deepEqual(fieldCompendiumItems(layout, combat), []);
  assert.deepEqual(fieldCompendiumItems(layout, passive).map((item) => item.name), ['Keen Smell']);
});

test('Field identity and both libraries survive save, rename, and reopen', () => {
  const { fields, template, layout } = makeFixture();
  const [combat, passive] = fields;
  const combatId = ensureFieldId(layout, combat);
  const passiveId = ensureFieldId(layout, passive);
  addFieldCompendiumItem(layout, combat, 'Bite', { name: 'Bite', desc: '2d8 damage' });
  addFieldCompendiumItem(layout, passive, 'Keen Smell', { name: 'Keen Smell', desc: 'Advantage' });

  renameFieldCompendiumIdentity(layout, combat.key, 'attacks');
  combat.formerKeys = [combat.key];
  combat.key = 'attacks';
  const sidecarText = JSON.stringify(layout);
  template.fields[0] = combat;
  const reopened = parseForgeLayout(sidecarText, template);

  assert.equal(reopened.fieldIds.attacks, combatId);
  assert.equal(reopened.fieldIds.passive_traits, passiveId);
  assert.deepEqual(fieldCompendiumItems(reopened, combat).map((item) => item.name), ['Bite']);
  assert.deepEqual(fieldCompendiumItems(reopened, passive).map((item) => item.name), ['Keen Smell']);
});

test('adding a Compendium ability makes an independent copy; a custom ability stays statblock-only', () => {
  const { fields, layout } = makeFixture();
  const [combat] = fields;
  const libraryEntry = addFieldCompendiumItem(layout, combat, 'Bite', {
    name: 'Bite', desc: '2d8+4 damage', parts: { damage: '2d8+4', tags: ['piercing', 'magical'] },
  });

  const statblockValue = appendFieldCompendiumItemValue('entries', [], libraryEntry.value);
  statblockValue[0].parts.tags.push('silvered');
  statblockValue[0].desc = 'Customized for this creature';
  assert.deepEqual(libraryEntry.value.parts.tags, ['piercing', 'magical']);
  assert.equal(libraryEntry.value.desc, '2d8+4 damage');

  const withCustom = insertInlineEntryValue(statblockValue, combat, statblockValue.length - 1, {
    name: 'Tail Sweep', text: 'A custom attack.', parts: {}, counterMarks: {}, counterMaxes: {},
  });
  assert.deepEqual(withCustom.map((entry) => entry.name), ['Bite', 'Tail Sweep']);
  assert.deepEqual(fieldCompendiumItems(layout, combat).map((item) => item.name), ['Bite']);
});

test('changing a Field type hides incompatible items without mixing libraries', () => {
  const { fields, layout } = makeFixture();
  const [combat, passive] = fields;
  addFieldCompendiumItem(layout, combat, 'Bite', { name: 'Bite', desc: 'Attack' });
  addFieldCompendiumItem(layout, passive, 'Keen Smell', { name: 'Keen Smell', desc: 'Trait' });

  combat.type = 'spells';
  assert.deepEqual(fieldCompendiumItems(layout, combat), []);
  combat.type = 'entries';
  assert.deepEqual(fieldCompendiumItems(layout, combat).map((item) => item.name), ['Bite']);
  assert.deepEqual(fieldCompendiumItems(layout, passive).map((item) => item.name), ['Keen Smell']);
});

test('removing one Field deletes only that Field library', () => {
  const { fields, layout } = makeFixture();
  const [combat, passive] = fields;
  addFieldCompendiumItem(layout, combat, 'Bite', { name: 'Bite' });
  addFieldCompendiumItem(layout, passive, 'Keen Smell', { name: 'Keen Smell' });
  const passiveId = ensureFieldId(layout, passive);

  removeFieldCompendium(layout, combat.key);
  assert.equal(layout.fieldIds[combat.key], undefined);
  assert.ok(layout.compendiumByFieldId[passiveId]);
  assert.deepEqual(fieldCompendiumItems(layout, passive).map((item) => item.name), ['Keen Smell']);
});

test('Compendium insertion preserves the data shape of List, Pairs, and Spells', () => {
  assert.deepEqual(appendFieldCompendiumItemValue('list', ['Fire'], 'Cold'), ['Fire', 'Cold']);
  assert.deepEqual(appendFieldCompendiumItemValue('pairs', [{ STR: 3 }], { DEX: 2 }), [{ STR: 3 }, { DEX: 2 }]);
  assert.deepEqual(appendFieldCompendiumItemValue('spells', [{ 'At will': 'Light' }], [{ '1st level': 'Shield' }]), [
    { 'At will': 'Light' }, { '1st level': 'Shield' },
  ]);
});

test('duplicate saved Field IDs are normalized so libraries cannot leak into two Fields', () => {
  const { fields, template, layout } = makeFixture();
  const [combat, passive] = fields;
  const sharedId = ensureFieldId(layout, combat);
  layout.fieldIds[passive.key] = sharedId;
  layout.compendiumByFieldId[sharedId] = [{
    id: 'shared-entry', name: 'Bite', fieldType: 'entries', value: { name: 'Bite' },
  }];

  const reopened = parseForgeLayout(JSON.stringify(layout), template);
  assert.notEqual(reopened.fieldIds[combat.key], reopened.fieldIds[passive.key]);
  assert.deepEqual(fieldCompendiumItems(reopened, combat).map((item) => item.name), ['Bite']);
  assert.deepEqual(fieldCompendiumItems(reopened, passive), []);
});


test('categories are scoped to each Field library and can be filtered by name, category, or content', () => {
  const { fields, layout } = makeFixture();
  const [combat, passive] = fields;
  addFieldCompendiumItem(layout, combat, 'Bite', { name: 'Bite', desc: '2d8 piercing damage' }, 'Actions');
  addFieldCompendiumItem(layout, combat, 'Multiattack', { name: 'Multiattack', desc: 'Makes two attacks' }, 'Actions');
  addFieldCompendiumItem(layout, combat, 'Keen Smell', { name: 'Keen Smell', desc: 'Advantage on smell checks' }, 'Traits');
  addFieldCompendiumItem(layout, combat, 'Unsorted note', { name: 'Unsorted note', desc: 'Legacy content' });
  addFieldCompendiumItem(layout, passive, 'Quiet Step', { name: 'Quiet Step', desc: 'Move silently' }, 'Traits');

  const combatItems = fieldCompendiumItems(layout, combat);
  assert.deepEqual(compendiumCategories(combatItems), ['Actions', 'Traits']);
  assert.deepEqual(compendiumCategories(fieldCompendiumItems(layout, passive)), ['Traits']);
  assert.deepEqual(filterCompendiumItems(combat, combatItems, 'bite').map((item) => item.name), ['Bite']);
  assert.deepEqual(filterCompendiumItems(combat, combatItems, 'piercing').map((item) => item.name), ['Bite']);
  assert.deepEqual(filterCompendiumItems(combat, combatItems, '', 'Actions').map((item) => item.name), ['Bite', 'Multiattack']);
  assert.deepEqual(filterCompendiumItems(combat, combatItems, '', '__uncategorized__').map((item) => item.name), ['Unsorted note']);
  assert.deepEqual(filterCompendiumItems(passive, fieldCompendiumItems(layout, passive), '', 'Actions'), []);
});

test('categories survive editing, serialization, and legacy entries remain uncategorized', () => {
  const { fields, template, layout } = makeFixture();
  const [combat] = fields;
  const item = addFieldCompendiumItem(layout, combat, 'Bite', { name: 'Bite', desc: '2d8 damage' }, 'Actions');
  const legacyId = ensureFieldId(layout, combat);
  layout.compendiumByFieldId[legacyId].push({ id: 'legacy', name: 'Old entry', fieldType: 'entries', value: { name: 'Old entry', desc: 'Old data' } });

  assert.equal(updateFieldCompendiumItem(layout, combat, item.id, 'Bite+', { name: 'Bite+', desc: '3d8 damage' }, 'Attacks'), true);
  const serialized = JSON.stringify(layout);
  const reopened = parseForgeLayout(serialized, template);
  const reopenedItems = fieldCompendiumItems(reopened, combat);
  assert.equal(reopenedItems.find((entry) => entry.id === item.id)?.category, 'Attacks');
  assert.equal(reopenedItems.find((entry) => entry.id === 'legacy')?.category, undefined);
});


test('Ability Compendium previews expose every configured Part, including counters and unset values', () => {
  const field = {
    key: 'abilities', label: 'Abilities', type: 'entries',
    entry: {
      nameKey: 'name', textKey: 'desc',
      extras: [
        { key: 'range', label: 'Range', type: 'text' },
        { key: 'damage', label: 'Damage', type: 'dice' },
        { key: 'tags', label: 'Tags', type: 'list' },
        { key: 'uses', label: 'Uses', type: 'counter', max: 3, look: 'checkboxes' },
        { key: 'mode', label: 'Mode', type: 'choice', options: ['Melee', 'Ranged'] },
      ],
    },
  };
  const preview = abilityCompendiumPreviewData(field, {
    name: 'Bite', desc: 'A sharp bite.', range: '5 ft.', damage: '2d8+3',
    tags: ['Piercing', 'Magical'], uses: [true, false, true], mode: 'Melee',
  });
  assert.equal(preview.name, 'Bite');
  assert.equal(preview.description, 'A sharp bite.');
  assert.deepEqual(preview.parts.map((part) => part.key), ['range', 'damage', 'tags', 'uses', 'mode']);
  assert.deepEqual(preview.parts.map((part) => part.value), ['5 ft.', '2d8+3', 'Piercing, Magical', '', 'Melee']);
  assert.equal(preview.parts.find((part) => part.key === 'uses')?.counterFilled, 2);
  assert.equal(preview.parts.find((part) => part.key === 'uses')?.counterMax, 3);
  assert.equal(preview.parts.find((part) => part.key === 'uses')?.counterLook, 'checkboxes');

  const empty = abilityCompendiumPreviewData(field, { name: 'Empty ability', desc: '' });
  assert.equal(empty.parts.length, 5);
  assert.equal(empty.parts.find((part) => part.key === 'range')?.value, '');
  assert.equal(empty.parts.find((part) => part.key === 'uses')?.counterFilled, 0);
});


test('a Collection Field can share another compatible Field Compendium without copying its items', () => {
  const { fields, layout } = makeFixture();
  const [combat, passive] = fields;
  const combatId = ensureFieldId(layout, combat);
  const passiveId = ensureFieldId(layout, passive);
  const bite = addFieldCompendiumItem(layout, combat, 'Bite', { name: 'Bite', desc: '2d8 damage' });
  addFieldCompendiumItem(layout, passive, 'Local-only', { name: 'Local-only', desc: 'Private library' });

  assert.equal(setFieldCompendiumSource(layout, passive, combat), true);
  assert.equal(fieldCompendiumSourceKey(layout, passive), combat.key);
  assert.deepEqual(fieldCompendiumItems(layout, passive), [bite]);
  assert.deepEqual(fieldCompendiumLinkedFieldKeys(layout, combat).sort(), [combat.key, passive.key].sort());
  assert.deepEqual(layout.compendiumByFieldId[combatId].map((item) => item.name), ['Bite']);
  assert.deepEqual(layout.compendiumByFieldId[passiveId].map((item) => item.name), ['Local-only']);
});

test('add, edit, and delete through a linked Collection operate on the source library', () => {
  const { fields, layout } = makeFixture();
  const [combat, passive] = fields;
  const combatId = ensureFieldId(layout, combat);
  const passiveId = ensureFieldId(layout, passive);
  const bite = addFieldCompendiumItem(layout, combat, 'Bite', { name: 'Bite', desc: 'Old' });
  setFieldCompendiumSource(layout, passive, combat);

  const claw = addFieldCompendiumItem(layout, passive, 'Claw', { name: 'Claw', desc: 'New' });
  assert.deepEqual(fieldCompendiumItems(layout, combat).map((item) => item.name), ['Bite', 'Claw']);
  assert.equal(updateFieldCompendiumItem(layout, passive, bite.id, 'Bite+', { name: 'Bite+', desc: 'Edited' }), true);
  assert.equal(removeFieldCompendiumItem(layout, passive, claw.id), true);
  assert.deepEqual(fieldCompendiumItems(layout, combat).map((item) => item.name), ['Bite+']);
  assert.equal(layout.compendiumByFieldId[passiveId], undefined);
  assert.equal(layout.compendiumByFieldId[combatId].length, 1);
});

test('a shared Compendium link follows the source Field stable ID when its key is renamed', () => {
  const { fields, template, layout } = makeFixture();
  const [combat, passive] = fields;
  const sourceId = ensureFieldId(layout, combat);
  addFieldCompendiumItem(layout, combat, 'Bite', { name: 'Bite' });
  setFieldCompendiumSource(layout, passive, combat);

  renameFieldCompendiumIdentity(layout, combat.key, 'attacks');
  combat.formerKeys = [combat.key];
  combat.key = 'attacks';
  template.fields[0] = combat;

  const reopened = parseForgeLayout(JSON.stringify(layout), template);
  assert.equal(reopened.fieldIds.attacks, sourceId);
  assert.equal(fieldCompendiumSourceKey(reopened, passive), 'attacks');
  assert.deepEqual(fieldCompendiumItems(reopened, passive).map((item) => item.name), ['Bite']);
});

test('unlinking a Collection restores its own independent Compendium', () => {
  const { fields, layout } = makeFixture();
  const [combat, passive] = fields;
  addFieldCompendiumItem(layout, combat, 'Bite', { name: 'Bite' });
  addFieldCompendiumItem(layout, passive, 'Local', { name: 'Local' });
  setFieldCompendiumSource(layout, passive, combat);
  assert.deepEqual(fieldCompendiumItems(layout, passive).map((item) => item.name), ['Bite']);

  assert.equal(setFieldCompendiumSource(layout, passive, null), true);
  assert.equal(fieldCompendiumSourceKey(layout, passive), null);
  assert.deepEqual(fieldCompendiumItems(layout, passive).map((item) => item.name), ['Local']);
});

test('Collection Compendium links reject incompatible Fields, self-links, and cycles', () => {
  const { fields, layout } = makeFixture();
  const [combat, passive] = fields;
  const spells = { key: 'spells', label: 'Spells', type: 'spells' };
  ensureFieldId(layout, spells);
  assert.equal(setFieldCompendiumSource(layout, combat, combat), false);
  assert.equal(setFieldCompendiumSource(layout, passive, spells), false);
  assert.equal(setFieldCompendiumSource(layout, passive, combat), true);
  assert.equal(setFieldCompendiumSource(layout, combat, passive), false);
  assert.equal(fieldCompendiumSourceKey(layout, passive), combat.key);
  assert.equal(fieldCompendiumSourceKey(layout, combat), null);
});

test('linked library references survive serialization and are removed when the source Field is deleted', () => {
  const { fields, template, layout } = makeFixture();
  const [combat, passive] = fields;
  const combatId = ensureFieldId(layout, combat);
  const passiveId = ensureFieldId(layout, passive);
  addFieldCompendiumItem(layout, combat, 'Bite', { name: 'Bite' });
  setFieldCompendiumSource(layout, passive, combat);
  const reopened = parseForgeLayout(JSON.stringify(layout), template);
  assert.equal(fieldCompendiumSourceKey(reopened, passive), combat.key);
  assert.deepEqual(fieldCompendiumItems(reopened, passive).map((item) => item.name), ['Bite']);

  removeFieldCompendium(reopened, combat.key);
  assert.equal(reopened.compendiumSourceByFieldId?.[passiveId], undefined);
  assert.equal(reopened.compendiumByFieldId?.[combatId], undefined);
  assert.deepEqual(fieldCompendiumItems(reopened, passive), []);
});

test('normalization drops invalid and cyclic Collection Compendium references', () => {
  const { fields, layout, template } = makeFixture();
  const [combat, passive] = fields;
  const combatId = ensureFieldId(layout, combat);
  const passiveId = ensureFieldId(layout, passive);
  const invalidId = 'missing-field-id';
  const parsed = parseForgeLayout(JSON.stringify({
    ...layout,
    compendiumSourceByFieldId: {
      [combatId]: passiveId,
      [passiveId]: combatId,
      [invalidId]: combatId,
    },
  }), template);
  assert.deepEqual(parsed.compendiumSourceByFieldId, {});
});
