import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { alignTargetAtViewportY } from '../src/render/foldedSectionPointerAnchor.ts';

const rendererUrl = new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url);
const stylesUrl = new URL('../styles.css', import.meta.url);

function sectionActionHandler(source) {
  const start = source.indexOf("action.addEventListener('click', (event) => {");
  const end = source.indexOf('\n      });', start);
  assert.notEqual(start, -1, 'folded Section button click handler should exist');
  assert.notEqual(end, -1, 'folded Section button click handler should be closed');
  return source.slice(start, end);
}

function createViewportSimulation(initialTop, scrollports) {
  const totalScroll = () => scrollports.reduce((sum, port) => sum + port.scrollTop, 0);
  const initialTotal = totalScroll();
  return {
    targetTop: initialTop,
    getBoundingClientRect() {
      return { top: this.targetTop - (totalScroll() - initialTotal) };
    },
  };
}

test('folded Section toggling releases the moving footer button before layout reflow', async () => {
  const source = await readFile(rendererUrl, 'utf8');
  const handler = sectionActionHandler(source);
  const capture = handler.indexOf('readPreviewAncestorScrollPositions(card)');
  const blur = handler.indexOf('action.blur()');
  const stateChange = handler.indexOf('setFoldedSectionExpanded(section.id');

  assert.ok(capture >= 0, 'capture viewport positions before changing visibility');
  assert.ok(blur > capture, 'blur the focused footer button before reflow');
  assert.ok(stateChange > blur, 'change the Section state only after focus is released');
  assert.ok(handler.includes('setFoldedSectionExpanded(section.id, !wasExpanded || mustRevealContainer'));
});

test('keyboard Section toggling restores button focus without asking the browser to scroll', async () => {
  const source = await readFile(rendererUrl, 'utf8');
  const handler = sectionActionHandler(source);
  assert.ok(handler.includes('const restoreActionFocus = card.ownerDocument.activeElement === action'));
  assert.ok(handler.includes('action.focus({ preventScroll: true })'));
  assert.ok(handler.includes('restoreAncestorScroll()'));
});

test('pointer anchors are kept per button until click consumes them, without a pointerup/RAF race', async () => {
  const source = await readFile(rendererUrl, 'utf8');
  const handler = sectionActionHandler(source);
  assert.ok(source.includes('const pointerAnchors = new WeakMap<HTMLButtonElement'));
  assert.ok(source.includes("action.addEventListener('pointerdown', (event) => capturePointerAnchor(event, action), true)"));
  assert.ok(source.includes("action.addEventListener('mousedown', (event) => capturePointerAnchor(event, action), true)"));
  assert.ok(handler.includes('const capturedPointerAnchor = pointerAnchors.get(action)'));
  assert.ok(handler.includes('const isPointerClick = event.detail > 0'));
  assert.ok(!source.includes('clearUnconsumedPointerSnapshot'));
  assert.ok(!source.includes('pendingPointerScrollSnapshot'));
});

test('pointer anchoring rediscovers live scrollports and keeps the clicked point at its viewport height', async () => {
  const source = await readFile(rendererUrl, 'utf8');
  const handler = sectionActionHandler(source);
  assert.ok(source.includes('function readPreviewButtonScrollports(action: HTMLElement)'));
  assert.ok(source.includes('alignTargetAtViewportY'));
  assert.ok(handler.includes('pointerAnchor.clientY - pointerAnchor.buttonOffsetY'));
  assert.ok(handler.includes('readPreviewButtonScrollports(action)'));
  assert.ok(handler.includes('let remainingFrames = 18'));
  assert.ok(handler.includes('stableFrames < 2'));
});

test('scroll anchoring handles expansion when the nearest scrollport clamps and an outer scrollport finishes the movement', () => {
  const inner = { scrollTop: 95, scrollHeight: 200, clientHeight: 100 };
  const outer = { scrollTop: 200, scrollHeight: 1000, clientHeight: 300 };
  const target = createViewportSimulation(180, [inner, outer]);
  const residual = alignTargetAtViewportY(target, [inner, outer], 100);
  assert.ok(Math.abs(residual) < 0.01);
  assert.equal(inner.scrollTop, 100, 'nearest scrollport is clamped at its maximum');
  assert.equal(outer.scrollTop, 275, 'outer scrollport consumes the remaining 75 px');
});

test('scroll anchoring handles collapse by scrolling upward to keep the button at the pointer', () => {
  const inner = { scrollTop: 160, scrollHeight: 600, clientHeight: 200 };
  const outer = { scrollTop: 40, scrollHeight: 800, clientHeight: 400 };
  const target = createViewportSimulation(70, [inner, outer]);
  const residual = alignTargetAtViewportY(target, [inner, outer], 130);
  assert.ok(Math.abs(residual) < 0.01);
  assert.equal(inner.scrollTop, 100);
});

test('published, stacked, and Canvas statblock scrollports opt out of browser scroll anchoring', async () => {
  const styles = await readFile(stylesUrl, 'utf8');
  assert.match(styles, /\.statblock-forge__render-view\s*\{[^}]*overflow-anchor:\s*none/s);
  const stackedRules = [...styles.matchAll(/\.workspace-leaf-content\.statblock-forge__note-layout--stacked > \.view-content\s*\{([^}]*)\}/g)];
  assert.ok(stackedRules.some((match) => /overflow-anchor:\s*none/.test(match[1])));
  const canvasRules = [...styles.matchAll(/\.statblock-forge__editor-preview-column \.statblock-forge__canvas-dropzone\s*\{([^}]*)\}/g)];
  assert.ok(canvasRules.some((match) => /overflow-anchor:\s*none/.test(match[1])));
});
