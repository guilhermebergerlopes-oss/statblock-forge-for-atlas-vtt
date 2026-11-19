import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const inspectorUrl = new URL('../src/views/templateValueBlockInspector.ts', import.meta.url);
const localizationUrl = new URL('../src/i18n/localization.ts', import.meta.url);

test('When Empty inspector exposes only Forge default and Fallback', async () => {
  const source = await readFile(inspectorUrl, 'utf8');
  assert.match(source, /whenEmptyFallbackSourceFieldKeys\(block, template\.fields\)\.length > 0/);
  assert.match(source, /selectInput\(block\.whenEmpty === 'fallback' \? 'fallback' : 'default', \[/);
  assert.match(source, /\{ value: 'default', label: translateForgeText\('Use Forge default'/);
  assert.match(source, /\{ value: 'fallback', label: translateForgeText\('Fallback'/);
  assert.doesNotMatch(source, /\{\s*value:\s*'(?:hide|fold)'/);
  assert.match(source, /textareaInput\(/);
  assert.match(source, /block\.whenEmpty = 'fallback'/);
  assert.match(source, /delete block\.whenEmpty/);
});

test('When Empty inspector explains that Forge Hide and Fold stay independent', async () => {
  const source = await readFile(localizationUrl, 'utf8');
  assert.match(source, /'Fallback is the only When Empty mode here\. Forge Hide and Fold controls remain separate\.'/);
  assert.match(source, /Fallback é o único modo de Quando vazio\. Os controles Hide e Fold do Forge continuam independentes\./);
});


test('Forge player Hide and Section Fold controls remain separate from When Empty', async () => {
  const { readFile } = await import('node:fs/promises');
  const playerAccess = await readFile(new URL('../src/views/templatePlayerAccessInspector.ts', import.meta.url), 'utf8');
  const structure = await readFile(new URL('../src/views/templateBlockStructureInspector.ts', import.meta.url), 'utf8');
  assert.match(playerAccess, /hidden: 'Hidden from players'/);
  assert.match(playerAccess, /'total-hidden': 'Total Hidden'/);
  assert.match(structure, /collapsible\.value === 'open' \|\| collapsible\.value === 'closed'/);
  assert.match(structure, /value: 'open'/);
  assert.match(structure, /value: 'closed'/);
});
