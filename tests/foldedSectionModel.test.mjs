import test from 'node:test';
import assert from 'node:assert/strict';
import {
  foldedSectionFooterLabel,
  isFoldedSectionExpanded,
  setFoldedSectionExpanded,
} from '../src/templates/foldedSectionModel.ts';

function state() {
  return { expanded: new Set(), collapsed: new Set() };
}

test('a Section configured open can be collapsed and its explicit choice survives state reuse', () => {
  const current = state();
  assert.equal(isFoldedSectionExpanded('section-a', true, current), true);
  setFoldedSectionExpanded('section-a', false, true, current);
  assert.equal(isFoldedSectionExpanded('section-a', true, current), false);
  setFoldedSectionExpanded('section-a', true, true, current);
  assert.equal(isFoldedSectionExpanded('section-a', true, current), true);
  assert.equal(current.collapsed.has('section-a'), false);
});

test('a Section configured closed stays expanded after rerender when the view reuses its state', () => {
  const current = state();
  setFoldedSectionExpanded('section-b', true, false, current);
  const nextRender = current;
  assert.equal(isFoldedSectionExpanded('section-b', false, nextRender), true);
});

test('a Section explicitly collapsed stays collapsed after rerender when configured open', () => {
  const current = state();
  setFoldedSectionExpanded('section-c', false, true, current);
  assert.equal(isFoldedSectionExpanded('section-c', true, current), false);
});

test('footer actions retain a configured heading even when No Label hides it on the block', () => {
  assert.equal(foldedSectionFooterLabel('Abilities', 'pt-BR', 1), 'Abilities');
  assert.equal(foldedSectionFooterLabel('  Defenses  ', 'en', 1), 'Defenses');
});

test('footer actions provide a unique label when a Section has no configured heading', () => {
  assert.equal(foldedSectionFooterLabel('', 'pt-BR', 1), 'Seção (1)');
  assert.equal(foldedSectionFooterLabel('', 'en', 2), 'Section (2)');
});
