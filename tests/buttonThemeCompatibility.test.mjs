import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const themeBlockStart = css.indexOf('0.5.4 — keep Forge-owned controls readable');
const themeBlock = themeBlockStart >= 0 ? css.slice(themeBlockStart) : '';

test('Forge action buttons inherit the active host color scheme', () => {
  assert.ok(themeBlock.includes('.statblock-forge :where(button)'));
  assert.ok(themeBlock.includes('color-scheme: inherit;'));
  assert.match(css, /--text-on-accent,\s*var\(--text-normal\)/);
  assert.doesNotMatch(css, /color:\s*var\(--text-on-accent,\s*white\)/);
});

test('buttons inside a Forge-themed statblock use its palette', () => {
  assert.ok(themeBlock.includes('--forge-action-button-surface: var(--forge-theme-raised'));
  assert.ok(themeBlock.includes('--forge-action-button-text: var(--forge-theme-text'));
  assert.ok(themeBlock.includes('--forge-action-button-primary-bg: var(--forge-theme-accent'));
  for (const selector of [
    '.statblock-forge__inline-scores-table-action',
    '.statblock-forge__entry-action-button',
    '.statblock-forge__compendium-picker-add',
    '.statblock-forge__compendium-picker-close',
    '.statblock-forge__pairs-editor-add',
    '.statblock-forge__spell-editor-add',
    '.statblock-forge__spell-editor-remove',
    '.statblock-forge__rest-action-button',
    '.atlas-sb-counter__step',
    '.statblock-forge__ability-counter-max-button',
    '.statblock-forge__entry-drag-handle.atlas-sb-handle',
  ]) assert.ok(themeBlock.includes(selector), `Missing theme rule for ${selector}`);
});

test('destructive and primary action states retain readable themed colors', () => {
  assert.ok(themeBlock.includes('.statblock-forge__inline-list-remove'));
  assert.ok(themeBlock.includes('.statblock-forge__pairs-editor-remove'));
  assert.ok(themeBlock.includes('.atlas-sb-pane-chip__remove'));
  assert.ok(themeBlock.includes('.statblock-forge__spell-editor-save'));
  assert.ok(themeBlock.includes('.statblock-forge__entry-drag-handle.atlas-sb-handle:hover'));
  assert.ok(themeBlock.includes('.statblock-forge__rest-panel-confirm'));
  assert.ok(themeBlock.includes(':focus-visible'));
  assert.ok(themeBlock.includes(':disabled'));
});
