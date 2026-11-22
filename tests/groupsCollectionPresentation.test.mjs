import test from 'node:test';
import assert from 'node:assert/strict';
import { groupPreviewGroups } from '../src/render/previewValueModel.ts';
import {
  inlineSpellGroupsDraftValue,
  serializeInlineSpellGroups,
} from '../src/statblocks/inlineSpellsFieldEditorModel.ts';

test('Groups preview parses headings and categorized values using generic terminology', () => {
  assert.deepEqual(groupPreviewGroups([
    'Special abilities:',
    { Passive: 'Keen sight' },
    { '1/day': 'Rapid retreat' },
  ]), [{
    header: 'Special abilities:',
    values: [
      { level: 'Passive', text: 'Keen sight' },
      { level: '1/day', text: 'Rapid retreat' },
    ],
  }]);
});

test('an unheaded Groups value receives a generic preview heading', () => {
  assert.deepEqual(groupPreviewGroups([{ General: 'Climbing' }]), [{
    header: 'Creature has the following values:',
    values: [{ level: 'General', text: 'Climbing' }],
  }]);
});

test('Groups editing keeps the Atlas legacy value shape and uses a generic default category', () => {
  const draft = inlineSpellGroupsDraftValue([
    'Special abilities:',
    { Passive: 'Keen sight' },
  ]);
  assert.deepEqual(serializeInlineSpellGroups(draft), [
    'Special abilities:',
    { Passive: 'Keen sight' },
  ]);
  assert.deepEqual(serializeInlineSpellGroups([{ heading: '', lines: [{ level: '', spells: 'Climbing' }] }]), [
    { General: 'Climbing' },
  ]);
});

test('Groups exposes a reliable Custom editor trigger and explicit completion action', async () => {
  const source = await (await import('node:fs/promises')).readFile(
    new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8',
  );
  // Dispatch from the trigger so nested Atlas block frames cannot intercept the
  // custom edit request before it reaches the region that owns the Field slot.
  assert.match(source, /add\.dataset\.forgeCustomField = field\.key/);
  assert.match(source, /add\.dispatchEvent\(new CustomEvent\('forge:edit-field',\s*\{\s*bubbles: true/);
  assert.doesNotMatch(source, /const frame = add\.closest<HTMLElement>\('\[data-block-id\]'\)/);
  assert.match(source, /card\.addEventListener\('forge:edit-field',[\s\S]*?\}, true\)/);
  assert.match(source, /trigger\.closest<HTMLElement>\(\s*'\.statblock-forge__inline-edit-slot\[data-forge-inline-field\]'\s*,?\s*\)/);
  assert.match(source, /regions\.find\(\(candidate\) =>[\s\S]*?slot\.node === sourceSlot && slot\.definition\.fieldKey === fieldKey/);
  assert.doesNotMatch(source, /region\.root\.addEventListener\('forge:edit-field'/);
  assert.match(source, /region\.root\.addEventListener\('forge:finish-field'/);
  assert.match(source, /saveGroups\.dispatchEvent\(new CustomEvent\('forge:finish-field'/);
  assert.match(source, /'Concluir' : 'Done'/);
});

test('Groups mounts its composite editor layer into the inline slot', async () => {
  const source = await (await import('node:fs/promises')).readFile(
    new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8',
  );
  const groupsStart = source.indexOf('function renderGroups(');
  const groupsEnd = source.indexOf('function renderCheckboxes(', groupsStart);
  assert.ok(groupsStart >= 0 && groupsEnd > groupsStart, 'Groups renderer should exist');
  const groupsSource = source.slice(groupsStart, groupsEnd);
  assert.match(groupsSource, /slot\.open\(layer, display\)/,
    'the Groups editor must be mounted before the edit session is returned');
  assert.match(groupsSource, /slot\.close\(layer, display\)/,
    'closing the Groups editor must restore its display slot');
});

test('Groups requires at least one custom value only when the user explicitly finishes editing', async () => {
  const source = await (await import('node:fs/promises')).readFile(
    new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8',
  );
  assert.match(source, /let requireGroupValue = false/);
  assert.match(source, /if \(!requireGroupValue\) return Promise\.resolve\(true\)/);
  assert.match(source, /requireGroupValue = true/);
  assert.match(source, /Add at least one value before finishing/);
});
