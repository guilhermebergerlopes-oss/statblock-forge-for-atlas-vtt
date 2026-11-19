import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../src/views/TemplateEditorView.ts', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');

function sectionBetween(start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test('typing in the JSON editor updates only the draft and never auto-applies or rerenders', () => {
  const inputHandler = sectionBetween(
    "editor.addEventListener('input', () => {",
    "const status = el('div', 'statblock-forge__json-status'",
  );

  assert.match(inputHandler, /this\.jsonDraftText = editor\.value/);
  assert.doesNotMatch(inputHandler, /applyJsonDraft|setTimeout|this\.render\(/);
});

test('the JSON editor offers explicit Apply JSON and has no automatic apply timer', () => {
  assert.match(source, /button\('Apply JSON',\s*\(\)\s*=>\s*\{\s*this\.applyJsonDraft\(\);\s*\}/);
  assert.doesNotMatch(source, /jsonApplyTimer|clearJsonApplyTimer/);
});

test('recovering an unfinished JSON draft does not schedule an automatic apply', () => {
  const restore = sectionBetween(
    'private restoreClosedDraft(',
    'private async reopenClosedDraft(',
  );
  assert.match(restore, /this\.jsonDraftText = draft\.jsonDraftText/);
  assert.doesNotMatch(restore, /applyJsonDraft|setTimeout/);
});

test('Done and Save still apply pending JSON before leaving or saving the editor', () => {
  const close = sectionBetween('private closeJsonSidebar(', 'private setJsonStatus(');
  const save = sectionBetween('private async save(', 'private async exportToAtlas(');
  assert.match(close, /this\.applyJsonDraft\(\)/);
  assert.match(save, /this\.applyJsonDraft\(\)/);
});
