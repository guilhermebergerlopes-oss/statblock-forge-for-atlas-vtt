import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const notice = 'Statblock Forge for Atlas VTT is a community extension. It is not made, endorsed or supported by Atlas VTT or Atlas Online.';
const supportUrl = 'https://github.com/guilhermebergerlopes-oss/statblock-forge-for-atlas-vtt/issues';

test('README starts with the required community-extension notice and support link', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  const lines = readme.trimStart().split(/\r?\n/);
  assert.equal(lines[0], notice);
  assert.equal(lines[1], `Support: ${supportUrl}`);
});

test('plugin-directory description starts with the required notice and includes support', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.name, 'Statblock Forge for Atlas VTT');
  assert.equal(manifest.id, 'statblock-forge');
  assert.ok(manifest.description.startsWith(notice));
  assert.ok(manifest.description.includes(supportUrl));
  assert.ok(manifest.description.length <= 250, 'manifest description should stay within 250 characters');
});

test('host file-context-menu actions identify Statblock Forge', async () => {
  const main = await readFile(new URL('../main.ts', import.meta.url), 'utf8');
  const requiredLabels = [
    "Statblock Forge: Add statblock here",
    "Statblock Forge: Create Atlas token from this statblock",
    "Statblock Forge: Render statblock",
    "Statblock Forge: Edit linked template",
  ];
  for (const label of requiredLabels) assert.ok(main.includes(label), `missing branded host menu label: ${label}`);
});
