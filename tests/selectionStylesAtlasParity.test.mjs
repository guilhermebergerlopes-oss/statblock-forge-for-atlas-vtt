import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/styles/selection.scss', import.meta.url), 'utf8');
const stylesheet = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const beginMarker = '/* BEGIN GENERATED FORGE SELECTION STYLES */';
const endMarker = '/* END GENERATED FORGE SELECTION STYLES */';
const begin = stylesheet.indexOf(beginMarker);
const end = stylesheet.indexOf(endMarker, begin + beginMarker.length);
assert.notEqual(begin, -1, 'styles.css must contain the generated Selection styles');
assert.notEqual(end, -1, 'styles.css must close the generated Selection styles');
const generated = stylesheet.slice(begin + beginMarker.length, end);

test('Selection stylesheet source is plain SCSS/CSS that Obsidian can load after compilation', () => {
  assert.doesNotMatch(source, /@use\s|@import\s|@include\s|\$[a-zA-Z_-]+\s*:/);
  assert.doesNotMatch(source, /(^|\n)\s*&\s*[{,:]/);
  assert.match(stylesheet, /\.statblock-forge__statblock \.statblock-forge__selection-atlas/);
});

test('styles.css contains the compiled Selection rules from the SCSS source', () => {
  for (const selector of [
    '.statblock-forge__statblock .statblock-forge__selection-atlas {',
    '.statblock-forge__statblock .statblock-forge__selection-atlas.atlas-sb-pane-chips {',
    '.atlas-vtt-plugin.atlas-sb-pane-options {',
    '.atlas-vtt-plugin.atlas-sb-pane-options[hidden] {',
  ]) {
    assert.ok(source.includes(selector), `source is missing ${selector}`);
    assert.ok(generated.includes(selector), `compiled CSS is missing ${selector}`);
  }
});

test('single choice uses Atlas inline typography rather than a separate outlined form box', () => {
  const rootRule = source.match(/\.statblock-forge__statblock \.statblock-forge__selection-atlas \{([^}]+)\}/)?.[1] ?? '';
  assert.match(rootRule, /display:\s*inline-flex/);
  assert.match(rootRule, /align-items:\s*baseline/);
  assert.doesNotMatch(rootRule, /border\s*:|background\s*:/);
  assert.match(source, /field-sizing:\s*content/);
});

test('multi-selection follows Atlas chip, per-pick number and remove-button dimensions', () => {
  assert.match(source, /\.atlas-sb-pane-chip\s*\{[^}]*height|\.atlas-sb-pane-chip\s*\{[^}]*min-height:\s*20px/s);
  assert.match(source, /input\.atlas-sb-pane-input\.atlas-sb-pane-pick__number\s*\{[^}]*font-variant-numeric:\s*tabular-nums/s);
  assert.match(source, /\.atlas-sb-pane-chip__remove\s*\{[^}]*width:\s*20px/s);
  assert.match(source, /\.atlas-sb-pane-pick__unit\s*\{[^}]*white-space:\s*nowrap/s);
});

test('Selection menu mirrors Atlas menu surface and keeps Obsidian hidden-state behavior', () => {
  assert.match(source, /\.atlas-vtt-plugin\.atlas-sb-pane-options\s*\{/);
  assert.match(source, /min-width:\s*160px/);
  assert.match(source, /max-height:\s*300px/);
  assert.match(source, /background:\s*var\(--menu-background,\s*var\(--background-secondary\)\)/);
  assert.match(source, /\.atlas-vtt-plugin\.atlas-sb-pane-options\[hidden\]\s*\{\s*display:\s*none/s);
  assert.match(source, /\.atlas-sb-pane-option\.is-active/);
});
