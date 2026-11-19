import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasSelectionHandlePosition } from '../src/templates/canvasSelectionHandleModel.ts';

test('nested Section and Row handles use separate horizontal lanes when the block is wide enough', () => {
  const parent = canvasSelectionHandlePosition(0, 240);
  const child = canvasSelectionHandlePosition(1, 240);
  assert.notDeepEqual(parent, child);
  assert.equal(parent.topPx, child.topPx);
  assert.ok(child.rightPx > parent.rightPx);
});

test('deeper container handles move to a second row instead of overlapping', () => {
  const first = canvasSelectionHandlePosition(0, 240);
  const second = canvasSelectionHandlePosition(1, 240);
  const third = canvasSelectionHandlePosition(2, 240);
  const fourth = canvasSelectionHandlePosition(3, 240);
  assert.equal(third.topPx, first.topPx + 18);
  assert.equal(third.rightPx, first.rightPx);
  assert.equal(fourth.topPx, second.topPx + 18);
  assert.equal(fourth.rightPx, second.rightPx);
});

test('narrow containers stack handles vertically instead of pushing them outside the block', () => {
  const first = canvasSelectionHandlePosition(0, 30);
  const second = canvasSelectionHandlePosition(1, 30);
  assert.equal(first.rightPx, second.rightPx);
  assert.ok(second.topPx > first.topPx);
});

test('invalid depth and width values safely fall back to the first handle position', () => {
  assert.deepEqual(canvasSelectionHandlePosition(Number.NaN, Number.NaN), { topPx: 4, rightPx: 4 });
  assert.deepEqual(canvasSelectionHandlePosition(1, 0), { topPx: 4, rightPx: 22 });
  assert.deepEqual(canvasSelectionHandlePosition(-3, -10), { topPx: 4, rightPx: 4 });
});
