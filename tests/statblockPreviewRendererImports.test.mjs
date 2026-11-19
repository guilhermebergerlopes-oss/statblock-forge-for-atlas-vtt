import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rendererUrl = new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url);

test('statblock preview renderer imports the Compendium Ability preview it invokes', async () => {
  const source = await readFile(rendererUrl, 'utf8');
  assert.match(
    source,
    /import\s*\{\s*renderCompendiumAbilityPreview\s*\}\s*from\s*['"]\.\/compendiumAbilityPreview\.ts['"];?/,
  );
  assert.match(source, /renderCompendiumAbilityPreview\(field,\s*item\.value,\s*language,\s*item\.name\)/);
});
