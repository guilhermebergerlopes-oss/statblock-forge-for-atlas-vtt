import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rendererUrl = new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url);
const stylesUrl = new URL('../styles.css', import.meta.url);

function sectionActionHandler(source) {
  const start = source.indexOf("action.addEventListener('click', (event) => {");
  const end = source.indexOf('\n      });', start);
  assert.notEqual(start, -1, 'folded Section button click handler should exist');
  assert.notEqual(end, -1, 'folded Section button click handler should be closed');
  return source.slice(start, end);
}

test('folded Section expansion releases the moving footer button before layout reflow', async () => {
  const source = await readFile(rendererUrl, 'utf8');
  const handler = sectionActionHandler(source);
  const capture = handler.indexOf('readPreviewAncestorScrollPositions(card)');
  const blur = handler.indexOf('action.blur()');
  const stateChange = handler.indexOf('setFoldedSectionExpanded(section.id');

  assert.ok(capture >= 0, 'capture viewport positions before changing visibility');
  assert.ok(blur > capture, 'blur the focused footer button before reflow');
  assert.ok(stateChange > blur, 'change the Section expansion state only after focus is released');
});

test('folded Section expansion restores button focus without asking the browser to scroll', async () => {
  const source = await readFile(rendererUrl, 'utf8');
  const handler = sectionActionHandler(source);

  assert.match(handler, /const restoreActionFocus = card\.ownerDocument\.activeElement === action/);
  assert.match(handler, /action\.focus\(\{\s*preventScroll:\s*true\s*\}\)/);
  assert.match(handler, /restoreAncestorScroll\(\)/);
});

test('folded Section expansion keeps ancestor scroll positions stable through four layout frames', async () => {
  const source = await readFile(rendererUrl, 'utf8');
  const handler = sectionActionHandler(source);

  assert.match(handler, /let remainingFrames = 4/);
  assert.match(handler, /view\.requestAnimationFrame\(restoreAcrossFrames\)/);
  assert.match(handler, /position\.element\.scrollTop = position\.top/);
  assert.match(handler, /position\.element\.scrollLeft = position\.left/);
});

test('published and stacked statblock scrollports opt out of browser scroll anchoring', async () => {
  const styles = await readFile(stylesUrl, 'utf8');

  assert.match(styles, /\.statblock-forge__render-view\s*\{[^}]*overflow-anchor:\s*none/s);
  const stackedRules = [...styles.matchAll(/\.workspace-leaf-content\.statblock-forge__note-layout--stacked > \.view-content\s*\{([^}]*)\}/g)];
  assert.ok(stackedRules.length > 0, 'stacked note scrollport should have a layout rule');
  assert.ok(stackedRules.some((match) => /overflow-anchor:\s*none/.test(match[1])));
});
