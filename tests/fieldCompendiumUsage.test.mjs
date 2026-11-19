import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFieldCompendiumItemValue } from '../src/statblocks/fieldCompendiumInsertionModel.ts';
import { moveInlineEntryBetweenFields } from '../src/statblocks/inlineEntryDragModel.ts';
import {
  FORGE_COMPENDIUM_ITEM_SOURCE_KEY,
  FORGE_COMPENDIUM_ITEM_SNAPSHOT_KEY,
  FORGE_COMPENDIUM_ITEM_DETACHED_KEY,
  releaseFieldCompendiumEntrySource,
  usedFieldCompendiumItemIds,
  usedFieldCompendiumItemIdsAcrossValues,
} from '../src/statblocks/fieldCompendiumUsageModel.ts';
import {
  inlineEntryDraftValue,
  moveInlineEntryValue,
  removeInlineEntryValue,
  insertInlineEntryValue,
  updateInlineEntriesValue,
} from '../src/statblocks/inlineEntriesFieldEditorModel.ts';

const field = {
  key: 'abilities',
  label: 'Abilities',
  type: 'entries',
  entry: { nameKey: 'name', textKey: 'desc' },
};
const libraryItem = {
  id: 'compendium-bite',
  value: { name: 'Bite', desc: '2d8 damage' },
};

test('inserting an Entries Compendium item marks only the statblock copy as used', () => {
  const statblockRows = appendFieldCompendiumItemValue('entries', [], libraryItem.value, libraryItem.id);
  assert.equal(statblockRows[0][FORGE_COMPENDIUM_ITEM_SOURCE_KEY], libraryItem.id);
  assert.equal(typeof statblockRows[0][FORGE_COMPENDIUM_ITEM_SNAPSHOT_KEY], 'string');
  assert.deepEqual(libraryItem.value, { name: 'Bite', desc: '2d8 damage' });
  assert.deepEqual([...usedFieldCompendiumItemIds([libraryItem], statblockRows)], [libraryItem.id]);
});

test('availability is based on the inserted content snapshot, not only on the source marker', () => {
  const inserted = appendFieldCompendiumItemValue('entries', [], libraryItem.value, libraryItem.id);
  const alteredOutsideTheInlineEditor = { ...inserted[0], desc: 'Changed by another editor path' };

  // Even if an editing path forgets to explicitly remove the marker, the
  // picker recognizes that the statblock copy no longer matches its snapshot.
  assert.equal(alteredOutsideTheInlineEditor[FORGE_COMPENDIUM_ITEM_SOURCE_KEY], libraryItem.id);
  assert.deepEqual([...usedFieldCompendiumItemIds([libraryItem], [alteredOutsideTheInlineEditor])], []);
  assert.deepEqual([...usedFieldCompendiumItemIds([libraryItem], inserted)], [libraryItem.id]);
});

test('older source markers without snapshots are released when their content changes', () => {
  const legacyMarkedCopy = {
    ...libraryItem.value,
    [FORGE_COMPENDIUM_ITEM_SOURCE_KEY]: libraryItem.id,
  };
  const editedLegacyCopy = { ...legacyMarkedCopy, desc: 'Changed old ability' };
  assert.deepEqual([...usedFieldCompendiumItemIds([libraryItem], [legacyMarkedCopy])], [libraryItem.id]);
  assert.deepEqual([...usedFieldCompendiumItemIds([libraryItem], [editedLegacyCopy])], []);
});


test('Compendium source snapshots survive Atlas Counter projection and restoration', async () => {
  const { projectForgeStatblockDataForAtlas, restoreForgeStatblockDataFromAtlas } = await import('../src/atlas/atlasTemplateAdapter.ts');
  const counterField = {
    key: 'abilities',
    label: 'Abilities',
    type: 'entries',
    entry: {
      nameKey: 'name',
      textKey: 'desc',
      extras: [{ key: 'uses', label: 'Uses', type: 'counter', max: 3 }],
    },
  };
  const template = { id: 'counter-template', fields: [counterField] };
  const item = { id: 'uses-item', value: { name: 'Bite', desc: 'Damage', uses: [true, false, false] } };
  const inserted = appendFieldCompendiumItemValue('entries', [], item.value, item.id);
  const atlasProjection = projectForgeStatblockDataForAtlas(template, { abilities: inserted });
  const restored = restoreForgeStatblockDataFromAtlas(template, atlasProjection.data);

  assert.equal(restored.abilities[0][FORGE_COMPENDIUM_ITEM_SOURCE_KEY], item.id);
  assert.equal(restored.abilities[0][FORGE_COMPENDIUM_ITEM_SNAPSHOT_KEY], inserted[0][FORGE_COMPENDIUM_ITEM_SNAPSHOT_KEY]);
  assert.deepEqual([...usedFieldCompendiumItemIds([item], restored.abilities)], [item.id]);
});

test('editing a Compendium-inserted ability releases its library item', () => {
  const statblockRows = appendFieldCompendiumItemValue('entries', [], libraryItem.value, libraryItem.id);
  const draft = { ...inlineEntryDraftValue(field, statblockRows[0]), text: '3d8 damage' };
  const editedRows = updateInlineEntriesValue(statblockRows, field, 0, draft);

  assert.equal(Object.hasOwn(editedRows[0], FORGE_COMPENDIUM_ITEM_SOURCE_KEY), false);
  assert.equal(editedRows[0][FORGE_COMPENDIUM_ITEM_DETACHED_KEY], true);
  assert.deepEqual([...usedFieldCompendiumItemIds([libraryItem], editedRows)], []);
});


test('changing an ability name or an Ability Part releases the Compendium source', () => {
  const item = { id: 'bite-with-part', value: { name: 'Bite', desc: 'Damage', reach: 'Melee' } };
  const fieldWithPart = { ...field, entry: { ...field.entry, extras: [{ key: 'reach', label: 'Reach', type: 'text' }] } };
  const inserted = appendFieldCompendiumItemValue('entries', [], item.value, item.id);
  const nameDraft = { ...inlineEntryDraftValue(fieldWithPart, inserted[0]), name: 'Improved Bite' };
  const renamed = updateInlineEntriesValue(inserted, fieldWithPart, 0, nameDraft);
  assert.deepEqual([...usedFieldCompendiumItemIds([item], renamed)], []);

  const withPartDraft = { ...inlineEntryDraftValue(fieldWithPart, inserted[0]), parts: { reach: '20 ft.' } };
  const changedPart = updateInlineEntriesValue(inserted, fieldWithPart, 0, withPartDraft);
  assert.deepEqual([...usedFieldCompendiumItemIds([item], changedPart)], []);
});

test('changing an interactive Counter on a Compendium ability releases the item', () => {
  const item = { id: 'bite-counter', value: { name: 'Bite', desc: 'Damage', uses: [false, false, false] } };
  const inserted = appendFieldCompendiumItemValue('entries', [], item.value, item.id);
  const editedRow = inserted[0];
  releaseFieldCompendiumEntrySource(editedRow);
  editedRow.uses = [true, false, false];
  assert.deepEqual([...usedFieldCompendiumItemIds([item], inserted)], []);
});

test('an edited ability stays detached even when its content is later restored to the library value', () => {
  const statblockRows = appendFieldCompendiumItemValue('entries', [], libraryItem.value, libraryItem.id);
  const changedDraft = { ...inlineEntryDraftValue(field, statblockRows[0]), text: '3d8 damage' };
  const changedRows = updateInlineEntriesValue(statblockRows, field, 0, changedDraft);
  const restoredDraft = { ...inlineEntryDraftValue(field, changedRows[0]), text: libraryItem.value.desc };
  const restoredRows = updateInlineEntriesValue(changedRows, field, 0, restoredDraft);

  assert.equal(restoredRows[0][FORGE_COMPENDIUM_ITEM_DETACHED_KEY], true);
  assert.deepEqual([...usedFieldCompendiumItemIds([libraryItem], restoredRows)], []);
});

test('a new Custom ability identical to a Compendium item does not consume that library item', () => {
  const customRows = insertInlineEntryValue([], field, null, {
    name: libraryItem.value.name,
    text: libraryItem.value.desc,
    parts: {},
    counterMarks: {},
    counterMaxes: {},
  });

  assert.equal(customRows[0][FORGE_COMPENDIUM_ITEM_DETACHED_KEY], true);
  assert.deepEqual([...usedFieldCompendiumItemIds([libraryItem], customRows)], []);
});

test('deleting a Compendium-inserted ability releases its library item', () => {
  const statblockRows = appendFieldCompendiumItemValue('entries', [], libraryItem.value, libraryItem.id);
  const deletedRows = removeInlineEntryValue(statblockRows, 0);
  assert.deepEqual([...usedFieldCompendiumItemIds([libraryItem], deletedRows)], []);
});

test('moving a Compendium-inserted ability keeps it associated with its source item', () => {
  const statblockRows = appendFieldCompendiumItemValue('entries', [{ name: 'Other', desc: 'Custom' }], libraryItem.value, libraryItem.id);
  const movedRows = moveInlineEntryValue(statblockRows, 1, 0);
  assert.equal(movedRows[0][FORGE_COMPENDIUM_ITEM_SOURCE_KEY], libraryItem.id);
  assert.deepEqual([...usedFieldCompendiumItemIds([libraryItem], movedRows)], [libraryItem.id]);
});

test('unchanged legacy copies without source metadata are recognized and edited copies become available', () => {
  const legacyCopy = { name: 'Bite', desc: '2d8 damage' };
  assert.deepEqual([...usedFieldCompendiumItemIds([libraryItem], [legacyCopy])], [libraryItem.id]);

  const draft = { ...inlineEntryDraftValue(field, legacyCopy), text: 'A customized attack' };
  const editedRows = updateInlineEntriesValue([legacyCopy], field, 0, draft);
  assert.deepEqual([...usedFieldCompendiumItemIds([libraryItem], editedRows)], []);
});

test('full-field JSON editing hides source metadata and restores links only for unchanged rows', async () => {
  const { stripFieldCompendiumEntrySourceMetadata, preserveUnchangedFieldCompendiumEntrySources } = await import('../src/statblocks/fieldCompendiumUsageModel.ts');
  const first = appendFieldCompendiumItemValue('entries', [], libraryItem.value, libraryItem.id)[0];
  const second = { name: 'Claw', desc: '1d6 damage' };
  const previousRows = [first, second];
  const editorRows = stripFieldCompendiumEntrySourceMetadata(previousRows);
  assert.equal(JSON.stringify(editorRows).includes(FORGE_COMPENDIUM_ITEM_SOURCE_KEY), false);
  assert.equal(JSON.stringify(editorRows).includes(FORGE_COMPENDIUM_ITEM_SNAPSHOT_KEY), false);

  const editedRows = [
    { ...editorRows[1] },
    { ...editorRows[0], desc: '3d8 damage' },
  ];
  const reconciled = preserveUnchangedFieldCompendiumEntrySources(previousRows, editedRows);
  assert.equal(reconciled[0][FORGE_COMPENDIUM_ITEM_SOURCE_KEY], undefined);
  assert.equal(reconciled[1][FORGE_COMPENDIUM_ITEM_SOURCE_KEY], undefined);
  assert.deepEqual([...usedFieldCompendiumItemIds([libraryItem], reconciled)], []);

  const reorderedWithoutEdits = preserveUnchangedFieldCompendiumEntrySources(previousRows, [editorRows[1], editorRows[0]]);
  assert.equal(reorderedWithoutEdits[1][FORGE_COMPENDIUM_ITEM_SOURCE_KEY], libraryItem.id);
  assert.deepEqual([...usedFieldCompendiumItemIds([libraryItem], reorderedWithoutEdits)], [libraryItem.id]);
});


test('the full-field JSON editor keeps legacy single-entry storage unchanged when no row changes', async () => {
  const { preserveUnchangedFieldCompendiumEntrySources } = await import('../src/statblocks/fieldCompendiumUsageModel.ts');
  const legacySingle = { name: 'Bite', desc: '2d8 damage' };
  const restored = preserveUnchangedFieldCompendiumEntrySources(legacySingle, [legacySingle]);
  assert.deepEqual(restored, legacySingle);
});

test('the rendered JSON editor hides the internal source marker', async () => {
  const { statblockFieldEditorInitialValue } = await import('../src/statblocks/statblockFieldEditorModel.ts');
  const marked = appendFieldCompendiumItemValue('entries', [], libraryItem.value, libraryItem.id);
  const custom = insertInlineEntryValue([], field, null, {
    name: 'Custom', text: 'Private', parts: {}, counterMarks: {}, counterMaxes: {},
  });
  const json = statblockFieldEditorInitialValue('json', [...marked, ...custom], 'entries');
  assert.equal(json.includes(FORGE_COMPENDIUM_ITEM_SOURCE_KEY), false);
  assert.equal(json.includes(FORGE_COMPENDIUM_ITEM_SNAPSHOT_KEY), false);
  assert.equal(json.includes(FORGE_COMPENDIUM_ITEM_DETACHED_KEY), false);
  assert.equal(json.includes('Bite'), true);
});


test('full-field JSON editing keeps detached rows custom after saving or restoring their original content', async () => {
  const { preserveUnchangedFieldCompendiumEntrySources } = await import('../src/statblocks/fieldCompendiumUsageModel.ts');
  const original = appendFieldCompendiumItemValue('entries', [], libraryItem.value, libraryItem.id)[0];
  const edited = { name: 'Bite', desc: '3d8 damage' };
  const detached = preserveUnchangedFieldCompendiumEntrySources([original], [edited]);
  assert.equal(detached[0][FORGE_COMPENDIUM_ITEM_DETACHED_KEY], true);
  assert.deepEqual([...usedFieldCompendiumItemIds([libraryItem], detached)], []);

  const restoredContent = { name: 'Bite', desc: libraryItem.value.desc };
  const restored = preserveUnchangedFieldCompendiumEntrySources(detached, [restoredContent]);
  assert.equal(restored[0][FORGE_COMPENDIUM_ITEM_DETACHED_KEY], true);
  assert.deepEqual([...usedFieldCompendiumItemIds([libraryItem], restored)], []);
});


test('a shared Compendium item remains used when it is present in any linked Collection Field', () => {
  const inOtherTab = appendFieldCompendiumItemValue('entries', [], libraryItem.value, libraryItem.id);
  assert.deepEqual(
    [...usedFieldCompendiumItemIdsAcrossValues([libraryItem], [[], inOtherTab])],
    [libraryItem.id],
  );
  assert.deepEqual(
    [...usedFieldCompendiumItemIdsAcrossValues([libraryItem], [[], []])],
    [],
  );
});

test('moving a Compendium ability between two tab Fields preserves its source marker and insertion order', () => {
  const marked = appendFieldCompendiumItemValue('entries', [], libraryItem.value, libraryItem.id)[0];
  const transfer = moveInlineEntryBetweenFields(
    [{ name: 'Other', desc: 'Other ability' }, marked],
    [{ name: 'Existing', desc: 'Existing ability' }],
    1,
    1,
  );
  assert.ok(transfer);
  assert.deepEqual(transfer.sourceAfter, [{ name: 'Other', desc: 'Other ability' }]);
  assert.equal(transfer.destinationAfter[1][FORGE_COMPENDIUM_ITEM_SOURCE_KEY], libraryItem.id);
  assert.deepEqual(
    [...usedFieldCompendiumItemIdsAcrossValues([libraryItem], [transfer.sourceAfter, transfer.destinationAfter])],
    [libraryItem.id],
  );
});
