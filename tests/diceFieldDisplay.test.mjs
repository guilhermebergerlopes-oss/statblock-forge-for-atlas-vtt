import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DICE_FIELD_DISPLAY_ICON_SIDES,
  clearDiceFieldDisplaySettings,
  getDiceFieldDisplaySettings,
  setDiceFieldDisplayIconSides,
  setDiceFieldDisplayMode,
  setDiceFieldDisplayText,
} from '../src/statblocks/diceFieldDisplayModel.ts';
import { ATLAS_DICE_ICON_DATA_URLS } from '../src/render/atlasDiceIconAssets.ts';

const baseField = () => ({ key: 'damage', label: 'Damage', type: 'dice', diceFormula: '2d6' });

test('legacy Dice Fields keep showing their formula by default', () => {
  assert.deepEqual(getDiceFieldDisplaySettings(baseField()), {
    mode: 'formula', iconSides: 6, text: '',
  });
});

test('Die icon display is configurable for every die image supplied by Atlas', () => {
  const field = baseField();
  setDiceFieldDisplayMode(field, 'icon');
  for (const sides of DICE_FIELD_DISPLAY_ICON_SIDES) {
    assert.equal(setDiceFieldDisplayIconSides(field, sides), true);
    assert.deepEqual(getDiceFieldDisplaySettings(field), { mode: 'icon', iconSides: sides, text: '' });
  }
  assert.equal(setDiceFieldDisplayIconSides(field, 100), false);
  assert.equal(getDiceFieldDisplaySettings(field).iconSides, 20);
});

test('custom display text is stored independently from the actual dice formula', () => {
  const field = baseField();
  setDiceFieldDisplayText(field, 'Heavy damage');
  assert.equal(field.diceFormula, '2d6');
  assert.deepEqual(getDiceFieldDisplaySettings(field), { mode: 'text', iconSides: 6, text: 'Heavy damage' });
  setDiceFieldDisplayText(field, 'x'.repeat(80));
  assert.equal(getDiceFieldDisplaySettings(field).text.length, 40);
});

test('returning to formula mode clears only visual override metadata', () => {
  const field = baseField();
  setDiceFieldDisplayIconSides(field, 8);
  setDiceFieldDisplayMode(field, 'formula');
  assert.equal(field.diceFormula, '2d6');
  assert.deepEqual(getDiceFieldDisplaySettings(field), { mode: 'formula', iconSides: 6, text: '' });
  assert.equal('diceDisplayMode' in field, false);
});

test('changing away from Dice Field clears its display settings', () => {
  const field = baseField();
  setDiceFieldDisplayText(field, 'Attack');
  clearDiceFieldDisplaySettings(field);
  assert.equal(field.diceFormula, '2d6');
  assert.deepEqual(getDiceFieldDisplaySettings(field), { mode: 'formula', iconSides: 6, text: '' });
});

test('embedded images are byte-identical to the six Atlas dice-tray WebP assets', async () => {
  for (const sides of DICE_FIELD_DISPLAY_ICON_SIDES) {
    const original = await readFile(new URL(`../assets/dice-icons/d${sides}.webp`, import.meta.url));
    const embedded = Buffer.from(ATLAS_DICE_ICON_DATA_URLS[sides].split(',')[1], 'base64');
    assert.deepEqual(embedded, original, `d${sides} image should be embedded without modification`);
  }
});

test('only formula-backed Dice Fields use the new display renderer at all current display surfaces', async () => {
  const renderer = await readFile(new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8');
  assert.ok(renderer.includes('appendForgeStatblockDiceFieldDisplay(display, field, formula)'));
  assert.ok(renderer.includes('appendForgeStatblockDiceFieldDisplay(metricValue, diceField, expression)'));
  assert.ok(renderer.includes('appendForgeStatblockDiceFieldDisplay(valueNode, field, displayText)'));
});

test('custom labels preserve the resolved formula as the clickable action', async () => {
  const renderer = await readFile(new URL('../src/render/statblockDiceLinkElement.ts', import.meta.url), 'utf8');
  assert.ok(renderer.includes('setForgeStatblockDiceLink(link, formula)'));
  assert.ok(renderer.includes('isDiceFieldValue(formula)'));
  assert.ok(renderer.includes('settings.text.trim()'));
});

test('template editor exposes formula, Atlas die icon and custom word display modes', async () => {
  const editor = await readFile(new URL('../src/views/templateFieldEditor.ts', import.meta.url), 'utf8');
  assert.ok(editor.includes("{ value: 'formula'"));
  assert.ok(editor.includes("{ value: 'icon'"));
  assert.ok(editor.includes("{ value: 'text'"));
  assert.ok(editor.includes('ATLAS_DICE_ICON_DATA_URLS[sides]'));
});
