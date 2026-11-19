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

test('the JSON editor provides word search with next and previous match navigation', () => {
  assert.match(source, /Search words in JSON/);
  assert.match(source, /Buscar palavras no JSON/);
  assert.match(source, /findNext\(event\.shiftKey\)/);
  assert.match(source, /findJsonTextMatches\(editor\.value, search\.value\)/);
  assert.match(source, /activeMatch = matchIndexes\.length > 0 \? 0 : -1/);
});

test('resetting the JSON draft requires explicit destructive-action confirmation', () => {
  const reset = sectionBetween("actions.append(button('Reset draft'", "actions.append(button('Apply JSON'");
  assert.match(reset, /new DestructiveActionConfirmationModal/);
  assert.match(reset, /Unapplied changes will be lost/);
  assert.match(reset, /As alterações não aplicadas serão perdidas/);
});


test('JSON word search shares the Edit JSON heading row', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/views/TemplateEditorView.ts', import.meta.url), 'utf8');
  assert.match(source, /const header = el\('div', 'statblock-forge__json-header'\)/);
  assert.match(source, /header\.append\(searchActions\)/);
  assert.doesNotMatch(source, /panel\.append\(searchActions, editor/);
});


test('typing a search term keeps focus in the search input instead of jumping to JSON', () => {
  const preview = sectionBetween(
    'const updateSearchPreview = (): void => {',
    'const findNext = (backwards = false): void => {',
  );
  assert.match(preview, /const searchHasFocus = search\.ownerDocument\.activeElement === search/);
  assert.match(preview, /activeMatch = matchIndexes\.length > 0 && searchHasFocus \? 0 : -1/);
  assert.match(preview, /revealActiveMatch\(\)/);
  assert.match(preview, /search\.ownerDocument\.activeElement === search/);
  assert.doesNotMatch(preview, /editor\.focus\(/);

  const navigation = sectionBetween(
    'const findNext = (backwards = false): void => {',
    "const previousMatchButton = button('↑'",
  );
  assert.match(navigation, /revealActiveMatch\(\)/);
  assert.match(navigation, /search\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(navigation, /editor\.focus\(/);
});

test('JSON word search remains in the compact Edit JSON header row', () => {
  assert.match(source, /const header = el\('div', 'statblock-forge__json-header'\)/);
  assert.match(source, /header\.append\(heading\)/);
  assert.match(source, /header\.append\(searchActions\)/);
  assert.match(source, /panel\.prepend\(header\)/);
});


test('JSON search uses Forge input styling and compact fixed-size navigation controls', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(source, /el\('input', 'statblock-forge__input statblock-forge__json-search'\)/);
  assert.match(source, /aria-label'.*Resultado anterior/s);
  assert.match(source, /aria-label'.*Próximo resultado/s);
  assert.match(css, /statblock-forge__json-search-nav[^}]*width: 1\.65rem/s);
  assert.match(css, /statblock-forge__json-search-nav[^}]*min-width: 1\.65rem/s);
  assert.match(css, /statblock-forge__json-search-status[^}]*text-overflow: ellipsis/s);
});

test('JSON search result status shows the active occurrence and total match count', () => {
  const status = sectionBetween('const updateSearchStatus = (): void => {', 'const collectMatches = (): void => {');
  assert.match(status, /activeMatch < 0/);
  assert.match(status, /matchCountLabel\(matchIndexes\.length\)/);
  assert.match(status, /activeMatch \+ 1/);
  assert.doesNotMatch(status, /text\.length/);
});


test('JSON search uses exact Unicode match lengths and scrolls vertically and horizontally without focusing the editor', async () => {
  const helper = await readFile(new URL('../src/views/jsonEditorSearch.ts', import.meta.url), 'utf8');
  assert.match(helper, /new RegExp\(escapedQuery, 'giu'\)/);
  assert.match(helper, /matches\.push\(\{ index: match\.index, length: match\[0\]\.length \}\)/);
  assert.doesNotMatch(helper, /toLocaleLowerCase\(\)/);
  assert.match(helper, /editor\.scrollTop =/);
  assert.match(helper, /editor\.scrollLeft =/);
  assert.doesNotMatch(helper, /\.focus\(/);
});
