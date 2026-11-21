import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Boxes and Gauge Values use compact label spacing matching Counter rows', async () => {
  const renderer = await readSource('../src/render/statblockPreviewRenderer.ts');
  const css = await readSource('../styles.css');

  assert.match(renderer, /statblock-forge__preview-track\$\{block\.look === 'gauge' \? ' is-gauge' : ' is-boxes'\}/);
  assert.match(css, /\.statblock-forge__preview-track\.is-boxes,\s*\.statblock-forge__preview-track\.is-gauge\s*\{ gap: 0\.2rem; \}/);
  assert.match(css, /\.statblock-forge__preview-track\.is-boxes > \.statblock-forge__preview-block-heading,\s*\.statblock-forge__preview-track\.is-gauge > \.statblock-forge__preview-block-heading \{ line-height: 1; \}/);
  assert.match(css, /\.statblock-forge__preview-counter-row \{ display: grid; gap: 0\.2rem; \}/);
  assert.match(css, /\.statblock-forge__preview-counter-name \{ display: block; width: 100%; \}/);
  assert.match(css, /\.statblock-forge__preview-track \{ display: grid; gap: 0\.3rem; \}/);
});
