import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  captureDisclosureOpenState,
  restoreDisclosureOpenState,
} from '../src/views/disclosureOpenState.ts';

function disclosure(key, open) {
  const listeners = new Map();
  return {
    dataset: { forgeDisclosureKey: key },
    open,
    addEventListener(type, listener) { listeners.set(type, listener); },
    dispatch(type) { listeners.get(type)?.(); },
  };
}

function rootWith(...items) {
  return { querySelectorAll: () => items };
}

test('expanded text customization panels stay open after the sidebar is rebuilt', () => {
  const state = new Map();
  const originalPanel = disclosure('field-typography:panel', true);
  const originalAllText = disclosure('field-typography:scope:text', true);
  const originalLabels = disclosure('field-typography:scope:label', false);

  captureDisclosureOpenState(rootWith(originalPanel, originalAllText, originalLabels), state);

  const rebuiltPanel = disclosure('field-typography:panel', false);
  const rebuiltAllText = disclosure('field-typography:scope:text', false);
  const rebuiltLabels = disclosure('field-typography:scope:label', true);
  restoreDisclosureOpenState(rootWith(rebuiltPanel, rebuiltAllText, rebuiltLabels), state);

  assert.equal(rebuiltPanel.open, true);
  assert.equal(rebuiltAllText.open, true);
  assert.equal(rebuiltLabels.open, false);
});

test('disclosure toggles are remembered immediately, before a rerender is requested', () => {
  const state = new Map();
  const original = disclosure('field-typography:panel', false);
  restoreDisclosureOpenState(rootWith(original), state);

  original.open = true;
  original.dispatch('toggle');

  const rebuilt = disclosure('field-typography:panel', false);
  restoreDisclosureOpenState(rootWith(rebuilt), state);
  assert.equal(rebuilt.open, true);

  rebuilt.open = false;
  rebuilt.dispatch('toggle');
  const rebuiltAgain = disclosure('field-typography:panel', true);
  restoreDisclosureOpenState(rootWith(rebuiltAgain), state);
  assert.equal(rebuiltAgain.open, false);
});

test('unseen disclosure keys retain their authored default state', () => {
  const state = new Map([['field-typography:panel', true]]);
  const existing = disclosure('field-typography:panel', false);
  const newlyAdded = disclosure('field-typography:new-scope', true);

  restoreDisclosureOpenState(rootWith(existing, newlyAdded), state);

  assert.equal(existing.open, true);
  assert.equal(newlyAdded.open, true);
});

test('Template Editor captures disclosure state before rerender and restores it on the rebuilt sidebar', async () => {
  const editor = await readFile(new URL('../src/views/TemplateEditorView.ts', import.meta.url), 'utf8');
  const inspector = await readFile(new URL('../src/views/templateFieldTypographyInspector.ts', import.meta.url), 'utf8');
  const typography = await readFile(new URL('../src/views/templateBlockAppearanceInspector.ts', import.meta.url), 'utf8');

  assert.match(editor, /captureDisclosureOpenState\(this\.contentEl, this\.persistentDisclosureOpen\)/);
  const fullRender = editor.slice(editor.indexOf('  private render(): void {'), editor.indexOf('  private showNotice('));
  assert.ok(fullRender.indexOf('captureDisclosureOpenState(this.contentEl, this.persistentDisclosureOpen)')
    < fullRender.indexOf('const sidebar = this.renderSidebar()'),
  'full render must capture disclosure state before rebuilding the sidebar');
  assert.match(editor, /restoreDisclosureOpenState\(nextSidebar, this\.persistentDisclosureOpen\)/);
  assert.match(inspector, /panel\.dataset\.forgeDisclosureKey = 'field-typography:panel'/);
  assert.match(inspector, /field-typography:scope:text/);
  assert.match(typography, /group\.dataset\.forgeDisclosureKey = disclosureKey/);
  assert.match(typography, /block-typography:\$\{block\.id\}:text/);
});
