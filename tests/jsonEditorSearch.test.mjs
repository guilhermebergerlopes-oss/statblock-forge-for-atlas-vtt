import test from 'node:test';
import assert from 'node:assert/strict';
import { findJsonTextMatches, revealJsonTextMatch } from '../src/views/jsonEditorSearch.ts';

function mockTextarea(value, overrides = {}) {
  const state = {
    value,
    clientHeight: 120,
    clientWidth: 180,
    scrollHeight: 1400,
    scrollWidth: 1800,
    scrollTop: 0,
    scrollLeft: 0,
    selection: [0, 0],
  };
  const computed = {
    fontSize: '10px',
    lineHeight: '20px',
    paddingTop: '4px',
    paddingLeft: '8px',
    borderTopWidth: '1px',
    fontFamily: 'monospace',
    fontWeight: '400',
    fontStyle: 'normal',
    font: '10px monospace',
    letterSpacing: '0px',
    tabSize: '2',
  };
  Object.assign(state, overrides);
  const editor = {
    ...state,
    setSelectionRange(start, end) { this.selection = [start, end]; },
    ownerDocument: {
      defaultView: { getComputedStyle: () => computed },
      createElement: () => ({ getContext: () => ({ font: '', measureText: text => ({ width: text.length * 8 }) }) }),
    },
  };
  return editor;
}

test('JSON search returns exact case-insensitive matches, including regex punctuation and Unicode', () => {
  const text = 'Café\nA.B\nother a.b\nCAFÉ';
  assert.deepEqual(findJsonTextMatches(text, 'café'), [
    { index: 0, length: 4 },
    { index: 19, length: 4 },
  ]);
  assert.deepEqual(findJsonTextMatches(text, 'a.b'), [
    { index: 5, length: 3 },
    { index: 15, length: 3 },
  ]);
  assert.deepEqual(findJsonTextMatches(text, '   '), []);
});

test('revealing a JSON match selects it and scrolls the textarea vertically and horizontally without requiring focus', () => {
  const value = `${Array.from({ length: 40 }, (_, i) => `line-${i}`).join('\n')}\n${'x'.repeat(45)}TARGET\nend`;
  const index = value.indexOf('TARGET');
  const editor = mockTextarea(value);

  revealJsonTextMatch(editor, { index, length: 'TARGET'.length });

  assert.deepEqual(editor.selection, [index, index + 6]);
  assert.ok(editor.scrollTop > 0, 'the matching line is scrolled into the visible area');
  assert.ok(editor.scrollLeft > 0, 'the matching column is scrolled into the visible area');
  assert.ok(editor.scrollTop <= editor.scrollHeight - editor.clientHeight);
  assert.ok(editor.scrollLeft <= editor.scrollWidth - editor.clientWidth);
  assert.equal(typeof editor.focus, 'undefined', 'the reveal helper has no focus dependency');
});
