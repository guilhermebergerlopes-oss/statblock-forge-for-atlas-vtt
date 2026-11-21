import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const renderer = await readFile(new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8');
const stylesheet = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const trackStart = renderer.indexOf('function renderTrack(');
const trackEnd = renderer.indexOf('\nfunction counterRows(', trackStart);
const trackRenderer = renderer.slice(trackStart, trackEnd);
const gaugeStart = trackRenderer.indexOf('if (useGauge) {');
const gaugeEnd = trackRenderer.indexOf('const drawTrack', gaugeStart);
const gaugeRenderer = trackRenderer.slice(gaugeStart, gaugeEnd);
const drawGaugeStart = trackRenderer.indexOf('if (useGauge) {', gaugeEnd);
const drawGaugeEnd = trackRenderer.indexOf('trackContent.replaceChildren()', drawGaugeStart);
const drawGaugeRenderer = trackRenderer.slice(drawGaugeStart, drawGaugeEnd);

test('Gauge removes the Current/Maximum readout and keeps only the two step controls', () => {
  assert.doesNotMatch(trackRenderer, /Atual:|Current:|Máximo:|Maximum:/);
  assert.doesNotMatch(gaugeRenderer, /gaugeValue|safeFilled\} \/ \$\{safeMax/);
  assert.match(gaugeRenderer, /gauge\.append\(gaugeMinus\)/);
  assert.match(gaugeRenderer, /gauge\.append\(gaugePlus\)/);
  assert.match(gaugeRenderer, /gauge\.append\(maximumEditor\)/);
  assert.match(gaugeRenderer, /gauge\.append\(gaugeTrack\)/);
});

test('Gauge step controls adjust the current value for self-tracked and separately capped Numbers', () => {
  assert.match(gaugeRenderer, /if \(selfTracked\) \{[\s\S]*?setForgeTrackedResourceCurrent\(nextData, fieldKey, next\)/);
  assert.match(gaugeRenderer, /numericRuntime\.setBaseValue\(FORGE_RESOURCE_VALUES_KEY/);
  assert.match(gaugeRenderer, /numericRuntime\.setBaseValue\(fieldKey, next\)/);
  assert.match(drawGaugeRenderer, /gaugeMinus\.disabled = safeFilled <= 0/);
  assert.match(drawGaugeRenderer, /gaugePlus\.disabled = safeFilled >= safeMax/);
});

test('Clicking a self-tracked Gauge opens its Number value editor to change the maximum', () => {
  assert.match(gaugeRenderer, /if \(selfTracked && numericRuntime\?\.canEdit && field && isFormulaCapableNumericField\(field\)\)/);
  assert.match(gaugeRenderer, /createInlineNumericFieldValue\(field, sample, numericRuntime, \(\) => '', ''/);
  assert.match(gaugeRenderer, /displayElement: gaugeTrack/);
  assert.match(gaugeRenderer, /slotClass: 'statblock-forge__track-gauge-edit-slot'/);
  assert.match(gaugeRenderer, /Clique no gauge para editar o máximo/);
  assert.match(renderer, /function createInlineNumericFieldValue\(/);
});

test('Gauge redraws update the mounted meter without replacing its inline maximum editor', () => {
  assert.match(drawGaugeRenderer, /gaugeFill\.setCssProps\(\{ \['--atlas-sb-gauge-share'\]: String\(safeMax > 0 \? safeFilled \/ safeMax : 0\) \}\)/);
  assert.doesNotMatch(drawGaugeRenderer, /trackContent\.replaceChildren\(\)/);
  assert.match(stylesheet, /\.statblock-forge \.atlas-sb-gauge\.statblock-forge__track-gauge\s*\{[\s\S]*?gap: 0\.2rem;/);
  assert.match(stylesheet, /\.statblock-forge \.statblock-forge__track-gauge-edit-slot\s*\{\s*display: contents;/);
});


test('Gauge step controls are re-enabled after each asynchronous save', () => {
  const runtimeStart = renderer.indexOf('async setBaseValue(fieldKey, value)');
  const runtimeEnd = renderer.indexOf('    subscribe(fieldKey, update)', runtimeStart);
  const setter = renderer.slice(runtimeStart, runtimeEnd);
  assert.match(setter, /finally \{\s*savingValue = false;[\s\S]*?notifyAll\(\);/);
  assert.match(drawGaugeRenderer, /gaugeMinus\.disabled = safeFilled <= 0 \|\| Boolean\(numericRuntime\?\.isSaving\)/);
  assert.match(drawGaugeRenderer, /gaugePlus\.disabled = safeFilled >= safeMax \|\| Boolean\(numericRuntime\?\.isSaving\)/);
});

test('Gauge uses small round controls and stretches across the available block width', () => {
  assert.match(stylesheet, /\.statblock-forge \.statblock-forge__track-gauge-step\s*\{[\s\S]*?width: 0\.9rem;[\s\S]*?height: 0\.9rem;[\s\S]*?border-radius: 50%;/);
  assert.match(stylesheet, /\.statblock-forge \.statblock-forge__preview-track\.is-gauge\s*\{[\s\S]*?width: 100%;/);
  assert.match(stylesheet, /\.statblock-forge \.statblock-forge__preview-track\.is-gauge \.statblock-forge__track-content\s*\{[\s\S]*?flex: 1 1 auto;[\s\S]*?width: 100%;/);
  assert.match(stylesheet, /\.statblock-forge \.atlas-sb-gauge\.statblock-forge__track-gauge\s*\{[\s\S]*?width: 100%;/);
  assert.match(stylesheet, /\.statblock-forge \.atlas-sb-gauge-track\.statblock-forge__track-gauge-track\s*\{[\s\S]*?flex: 1 1 auto;[\s\S]*?width: auto;/);
});
