import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { forgeTrackValues } from '../src/statblocks/forgeTrackValueModel.ts';
import { FORGE_RESOURCE_VALUES_KEY, forgeResourceValuesAreValid, forgeTrackedResourceCurrent, setForgeTrackedResourceCurrent } from '../src/statblocks/forgeResourceValues.ts';

const renderer = await readFile(new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8');
const editor = await readFile(new URL('../src/views/TemplateEditorView.ts', import.meta.url), 'utf8');
const stylesheet = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

test('Boxes preserves an explicit zero maximum instead of forcing a phantom box', () => {
  assert.deepEqual(forgeTrackValues(0, 0, 'down'), { maximum: 0, current: 0 });
  assert.deepEqual(forgeTrackValues('0', '0', 'up'), { maximum: 0, current: 0 });
});

test('Boxes preserves a current value of zero when its maximum is positive', () => {
  assert.deepEqual(forgeTrackValues(5, 0, 'down'), { maximum: 5, current: 0 });
  assert.deepEqual(forgeTrackValues(5, 0, 'up'), { maximum: 5, current: 0 });
});


test('an explicit tracked current of zero survives JSON persistence', () => {
  const draft = {};
  assert.equal(setForgeTrackedResourceCurrent(draft, 'health', 0), true);
  assert.equal(forgeResourceValuesAreValid(draft), true);
  const restored = JSON.parse(JSON.stringify(draft));
  assert.equal(restored[FORGE_RESOURCE_VALUES_KEY].health, 0);
  assert.equal(forgeTrackedResourceCurrent(restored, 'health', 6, 'down'), 0);
});

test('tracked defaults still follow the counting direction when current is absent', () => {
  assert.deepEqual(forgeTrackValues(4, null, 'down'), { maximum: 4, current: 4 });
  assert.deepEqual(forgeTrackValues(4, null, 'up'), { maximum: 4, current: 0 });
});

test('track values remain clamped to zero and the configured maximum', () => {
  assert.deepEqual(forgeTrackValues(3, -8, 'down'), { maximum: 3, current: 0 });
  assert.deepEqual(forgeTrackValues(3, 9, 'up'), { maximum: 3, current: 3 });
});

test('the renderer uses the zero-preserving model for initial and reactive track draws', () => {
  assert.match(renderer, /const initialValues = forgeTrackValues\(readMaximum\(\), currentValue\(\), counts\)/);
  assert.match(renderer, /const next = forgeTrackValues\(readMaximum\(\), currentValue\(\), counts\)/);
  assert.match(renderer, /if \(safeMax === 0\)[\s\S]{0,260}statblock-forge__track-zero-value/);
  assert.match(renderer, /safeMax > 0 \? safeFilled \/ safeMax : 0/);
  assert.doesNotMatch(renderer, /Math\.max\(1, Math\.min\(1000, Math\.floor\(readMaximum/);
});

test('Statblock Mode supplies the image action so an empty token socket remains visible', () => {
  const modeStart = editor.indexOf('if (this.statblockMode) {');
  const modeEnd = editor.indexOf('\n    } else {\n      dropzone = renderTemplateCanvasSurface', modeStart);
  assert.ok(modeStart >= 0 && modeEnd > modeStart, 'Statblock Mode branch should be present');
  const modeBranch = editor.slice(modeStart, modeEnd);
  assert.match(modeBranch, /onImageFieldAction:\s*\(fieldKey, socket\)\s*=>\s*this\.openImageSampleActions\(template, fieldKey, socket\)/);
});

test('reserved token aliases use the token-shaped socket and Atlas-only artwork guidance', () => {
  assert.match(renderer, /\['image', 'token-image', 'token'\]\.includes\(field\.key\)/);
  assert.match(editor, /\['image', 'token-image', 'token'\]\.includes\(fieldKey\)/);
});

test('zero indicator has a compact visible style', () => {
  assert.match(stylesheet, /\.statblock-forge__track-zero-value\s*\{[\s\S]*?font-variant-numeric:\s*tabular-nums/);
});
