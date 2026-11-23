import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cachedAtlasSystemPresetRules,
  invalidateAtlasSystemPresetRules,
  loadAtlasSystemPresetRules,
} from '../src/atlas/atlasSystemPresetRules.ts';

function createApp(entries) {
  let reads = 0;
  const files = entries.map(([path, content]) => ({ path, content }));
  const app = {
    vault: {
      getFiles: () => files,
      cachedRead: async (file) => {
        reads += 1;
        if (file.content instanceof Error) throw file.content;
        return file.content;
      },
    },
  };
  return {
    app,
    set(path, content) {
      const file = files.find((candidate) => candidate.path === path);
      if (file) file.content = content;
      else files.push({ path, content });
    },
    get reads() { return reads; },
  };
}

test('loads custom Atlas system preset rules by the id stored inside the JSON file', async () => {
  const fixture = createApp([
    ['atlas-vtt/system-presets/incorrect-name.json', JSON.stringify({ id: 'custom-system', rules: { resources: [{ key: 'focus' }] } })],
    ['atlas-vtt/system-presets/broken.json', '{invalid json'],
    ['other-folder/custom-system.json', JSON.stringify({ id: 'custom-system', rules: { resources: [{ key: 'wrong' }] } })],
  ]);
  const rules = await loadAtlasSystemPresetRules(fixture.app, 'custom-system');
  assert.deepEqual(rules, { resources: [{ key: 'focus' }] });
  assert.deepEqual(cachedAtlasSystemPresetRules(fixture.app, 'custom-system'), rules);
});

test('caches preset reads and invalidates them after Atlas preset-file changes', async () => {
  const path = 'atlas-vtt/system-presets/rules.json';
  const fixture = createApp([[path, JSON.stringify({ id: 'custom-system', rules: { version: 1 } })]]);
  assert.deepEqual(await loadAtlasSystemPresetRules(fixture.app, 'custom-system'), { version: 1 });
  const initialReads = fixture.reads;
  assert.deepEqual(await loadAtlasSystemPresetRules(fixture.app, 'custom-system'), { version: 1 });
  assert.equal(fixture.reads, initialReads);
  fixture.set(path, JSON.stringify({ id: 'custom-system', rules: { version: 2 } }));
  invalidateAtlasSystemPresetRules(fixture.app);
  assert.deepEqual(await loadAtlasSystemPresetRules(fixture.app, 'custom-system'), { version: 2 });
});

test('does not scan user files for built-in preset ids', async () => {
  const fixture = createApp([['atlas-vtt/system-presets/user.json', JSON.stringify({ id: 'builtin:dnd5e', rules: {} })]]);
  assert.equal(await loadAtlasSystemPresetRules(fixture.app, 'builtin:dnd5e'), null);
  assert.equal(fixture.reads, 0);
});
