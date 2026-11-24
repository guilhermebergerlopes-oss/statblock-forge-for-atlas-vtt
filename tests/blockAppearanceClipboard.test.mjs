import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  clearCopiedBlockAppearance,
  copyBlockAppearance,
  hasCopiedBlockAppearance,
  pasteBlockAppearance,
} from '../src/templates/blockAppearanceClipboard.ts';

const root = new URL('../', import.meta.url);

test('copy and paste transfers the complete custom appearance without changing block content or layout', () => {
  clearCopiedBlockAppearance();
  const source = {
    span: 8,
    rows: 2,
    appearanceMode: 'custom',
    appearance: {
      background: '#123456',
      borderColor: '#abcdef',
      borderWidth: 3,
      padding: 16,
      fontSize: 19,
      labelFontWeight: '700',
      valueFontStyle: 'italic',
      trackFillColor: '#ff0000',
      imageZoom: 140,
    },
  };
  const target = {
    span: 4,
    rows: 5,
    visibility: 'total-hidden',
    appearanceMode: 'theme',
    appearance: { background: '#ffffff' },
  };

  copyBlockAppearance(source);
  assert.equal(hasCopiedBlockAppearance(), true);
  assert.equal(pasteBlockAppearance(target), true);
  assert.equal(target.appearanceMode, 'custom');
  assert.deepEqual(target.appearance, source.appearance);
  assert.equal(target.span, 4);
  assert.equal(target.rows, 5);
  assert.equal(target.visibility, 'total-hidden');
});

test('clipboard is a detached snapshot and later source edits do not alter what is pasted', () => {
  clearCopiedBlockAppearance();
  const source = {
    appearanceMode: 'custom',
    appearance: { background: '#112233', padding: 12 },
  };
  copyBlockAppearance(source);
  source.appearance.background = '#ffffff';
  source.appearance.padding = 40;

  const target = { appearanceMode: 'theme', appearance: {} };
  assert.equal(pasteBlockAppearance(target), true);
  assert.deepEqual(target.appearance, { background: '#112233', padding: 12 });
});

test('copying a Theme block copies Theme mode and its appearance payload', () => {
  clearCopiedBlockAppearance();
  copyBlockAppearance({ appearanceMode: 'theme', appearance: { background: '#222222' } });
  const target = { appearanceMode: 'custom', appearance: { textColor: '#ffffff' } };
  assert.equal(pasteBlockAppearance(target), true);
  assert.equal(target.appearanceMode, 'theme');
  assert.deepEqual(target.appearance, { background: '#222222' });
});

test('paste without a copied appearance is a no-op', () => {
  clearCopiedBlockAppearance();
  const target = { appearanceMode: 'custom', appearance: { background: '#abcdef' } };
  assert.equal(hasCopiedBlockAppearance(), false);
  assert.equal(pasteBlockAppearance(target), false);
  assert.equal(target.appearanceMode, 'custom');
  assert.deepEqual(target.appearance, { background: '#abcdef' });
});

test('Block Appearance inspector exposes copy and paste actions with feedback', async () => {
  const inspector = await readFile(new URL('src/views/templateBlockAppearanceInspector.ts', root), 'utf8');
  assert.match(inspector, /translateForgeText\('Copy appearance'/);
  assert.match(inspector, /translateForgeText\('Paste appearance'/);
  assert.match(inspector, /pasteAppearance\.disabled = !hasCopiedBlockAppearance\(\)/);
  assert.match(inspector, /copyBlockAppearance\(metadata\)/);
  assert.match(inspector, /pasteBlockAppearance\(metadata\)/);
  assert.match(inspector, /Content and layout were not changed/);
});
