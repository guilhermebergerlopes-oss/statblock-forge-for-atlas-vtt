import assert from 'node:assert/strict';
import test from 'node:test';
import {
  forgePickerDetail,
  forgePickerScalar,
  forgePickerEntryForAtlasOption,
  matchForgeStatblockPickerEntry,
} from '../src/atlas/forgeStatblockPickerModel.ts';

const entries = [
  { path: 'Forge/Goblin.md', name: 'Goblin', detail: 'Small Humanoid · Tier 1' },
  { path: 'Atlas/Goblin.md', name: 'Goblin', detail: 'Small Humanoid · Tier 2' },
  { path: 'Forge/Orc.md', name: 'Orc', detail: 'Medium Humanoid · CR 1/2' },
];

test('matches a unique Forge picker row only when its detail also matches', () => {
  assert.equal(matchForgeStatblockPickerEntry('Orc', 'Medium Humanoid · CR 1/2', entries)?.path, 'Forge/Orc.md');
  assert.equal(matchForgeStatblockPickerEntry('Orc', 'Medium Humanoid · CR 3', entries), null);
});

test('disambiguates identical names using the Atlas detail line', () => {
  assert.equal(matchForgeStatblockPickerEntry('Goblin', 'Small Humanoid · Tier 1', entries)?.path, 'Forge/Goblin.md');
  assert.equal(matchForgeStatblockPickerEntry('Goblin', 'Small Humanoid · Tier 2', entries)?.path, 'Atlas/Goblin.md');
});

test('does not badge another plugin row with the same name but different details', () => {
  assert.equal(matchForgeStatblockPickerEntry('Goblin', 'Small Humanoid · Tier 2', [entries[0]]), null);
});

test('does not guess when duplicate names cannot be distinguished', () => {
  assert.equal(matchForgeStatblockPickerEntry('Goblin', 'unknown', entries), null);
});

test('picker comparisons ignore case, accents and repeated whitespace', () => {
  const accented = [{ path: 'Forge/Dragao.md', name: 'Dragão Antigo', detail: 'Huge Dragon · CR 10' }];
  assert.equal(matchForgeStatblockPickerEntry('DRAGAO  ANTIGO', 'huge dragon · cr 10', accented)?.path, 'Forge/Dragao.md');
});

test('rating detail matching survives Atlas locale changes', () => {
  const localized = [{ path: 'Forge/Goblin.md', name: 'Goblin', detail: 'Small Humanoid · Tier 1' }];
  assert.equal(matchForgeStatblockPickerEntry('Goblin', 'Small Humanoid · Patamar 1', localized)?.path, 'Forge/Goblin.md');
});

test('detail formatting follows Atlas size/type/rating and folder fallback conventions', () => {
  assert.equal(forgePickerDetail({ path: 'Bestiary/Goblin.md', fields: { size: 'Small', type: 'Humanoid', tier: 1 } }), 'Small Humanoid · Tier 1');
  assert.equal(forgePickerDetail({ path: 'Bestiary/Orc.md', fields: { cr: '1/2' } }), 'CR 1/2');
  assert.equal(forgePickerDetail({ path: 'Bestiary/Unknown.md', fields: {} }), 'Bestiary');
  assert.equal(forgePickerDetail({ path: 'Unknown.md', fields: {} }), '/');
});

test('scalar normalization accepts text and finite numbers only', () => {
  assert.equal(forgePickerScalar('  Goblin  '), 'Goblin');
  assert.equal(forgePickerScalar(2), '2');
  assert.equal(forgePickerScalar(Number.NaN), null);
  assert.equal(forgePickerScalar({ name: 'Goblin' }), null);
});


test('identifies the exact Atlas React list row by its statblock path key', () => {
  const option = {};
  Object.defineProperty(option, '__reactFiber$atlas', {
    value: { key: 'Forge/Goblin.md', return: null },
  });
  assert.equal(forgePickerEntryForAtlasOption(option, entries, 'Goblin', 'localized or custom detail')?.path, 'Forge/Goblin.md');
});

test('uses the visible Atlas row details when no direct React key is available', () => {
  const option = { dataset: {} };
  assert.equal(forgePickerEntryForAtlasOption(option, entries, 'Goblin', 'Small Humanoid · Tier 2')?.path, 'Atlas/Goblin.md');
});

test('does not infer an Atlas row path from an unrelated or unknown React key', () => {
  const option = {};
  Object.defineProperty(option, '__reactFiber$atlas', {
    value: { key: 'Atlas/Other.md', return: null },
  });
  assert.equal(forgePickerEntryForAtlasOption(option, [entries[0]], 'Goblin', 'unknown'), null);
});


test('recognizes Atlas React child keys when the runtime escapes their path prefix', () => {
  const option = {};
  Object.defineProperty(option, '__reactFiber$atlas', {
    value: { key: '$Forge/Goblin.md', return: null },
  });
  assert.equal(forgePickerEntryForAtlasOption(option, entries, 'Goblin', 'custom details')?.path, 'Forge/Goblin.md');
});
