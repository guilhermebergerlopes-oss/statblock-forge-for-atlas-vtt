import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { translateForgeText } from '../src/i18n/localization.ts';

const rendererUrl = new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url);

const sourceText = 'Nenhuma tag de exemplo.';

test('the empty List placeholder has English and Portuguese translations', () => {
  assert.equal(translateForgeText(sourceText, 'en'), 'No sample tags.');
  assert.equal(translateForgeText(sourceText, 'pt-BR'), sourceText);
});

test('List redraws pass the active language and translate the empty placeholder immediately', async () => {
  const source = await readFile(rendererUrl, 'utf8');
  const start = source.indexOf('function drawTagDisplay(');
  const end = source.indexOf('\nfunction createInlineListFieldValue(', start + 1);
  assert.notEqual(start, -1, 'drawTagDisplay must exist');
  assert.notEqual(end, -1, 'drawTagDisplay must end before createInlineListFieldValue');
  const implementation = source.slice(start, end);

  assert.match(implementation, /language:\s*ForgeLanguage\s*=\s*'en'/);
  assert.match(implementation, /translateForgeText\(emptyText,\s*language\)/);
  assert.match(source, /drawTagDisplay\(display,\s*look,\s*inlineListItems\(sample\[field\.key\]\),\s*language\)/);
  assert.match(source, /drawTagDisplay\(display,\s*block\.look,\s*tagItems\(valueOf\(sample,\s*block\.field\)\),\s*language\)/);
});
