import test from 'node:test';
import assert from 'node:assert/strict';
import { packPhysicalGrid, requiredRowsForBlock } from '../src/templates/gridLayout.ts';

function block(id, type = 'stat', extra = {}) {
  return { id, type, ...extra };
}

function makeLayout(blocks, overrides = {}) {
  const metadata = {};
  const visit = (items) => {
    for (const item of items) {
      metadata[item.id] = { span: 12, rows: 1, appearance: {}, ...(overrides[item.id] ?? {}) };
      if (Array.isArray(item.blocks)) visit(item.blocks);
    }
  };
  visit(blocks);
  return { columns: 12, dense: true, blocks: metadata };
}

test('a Section with an empty dynamic heading does not reserve a phantom row', () => {
  const section = block('section', 'section', {
    headingField: 'subtitle',
    blocks: [block('child')],
  });
  const layout = makeLayout([section]);
  assert.equal(requiredRowsForBlock(section, layout, false, new Set(), { subtitle: '' }), 1);
  assert.equal(requiredRowsForBlock(section, layout, false, new Set(), { subtitle: 'Visible title' }), 2);
});

test('a Section with a hidden label does not reserve a heading row', () => {
  const section = block('section', 'section', {
    heading: 'Hidden title',
    labelPlacement: 'none',
    blocks: [block('child')],
  });
  assert.equal(requiredRowsForBlock(section, makeLayout([section]), false, new Set(), {}), 1);
});

test('a Tabs headingField does not reserve a row because Tabs renders only its fixed heading', () => {
  const panel = block('panel', 'section', {
    headingField: 'subtitle',
    blocks: [block('child')],
  });
  const tabs = block('tabs', 'tabs', {
    headingField: 'subtitle',
    blocks: [panel],
  });
  assert.equal(requiredRowsForBlock(tabs, makeLayout([tabs]), false, new Set(), { subtitle: 'Not rendered as a Tabs title' }), 2);
});

test('a Row accounts for every wrapped flex line when nested inside a Section', () => {
  const row = block('row', 'row', {
    blocks: [block('a'), block('b'), block('c')],
  });
  const section = block('section', 'section', { blocks: [row] });
  const layout = makeLayout([section], { a: { span: 6 }, b: { span: 6 }, c: { span: 6 } });
  assert.equal(requiredRowsForBlock(row, layout), 2);
  assert.equal(requiredRowsForBlock(section, layout), 2);
});

test('a following sibling starts immediately after a Section with no rendered heading', () => {
  const section = block('section', 'section', {
    headingField: 'subtitle',
    blocks: [block('child')],
  });
  const next = block('next');
  const layout = makeLayout([section, next]);
  const placements = packPhysicalGrid([section, next], layout, false, { subtitle: '' });
  assert.equal(placements.find((item) => item.id === 'section')?.rows, 1);
  assert.equal(placements.find((item) => item.id === 'next')?.y, 1);
});

test('without sample data, a configured dynamic Section heading remains conservatively reserved', () => {
  const section = block('section', 'section', {
    headingField: 'subtitle',
    blocks: [block('child')],
  });
  assert.equal(requiredRowsForBlock(section, makeLayout([section])), 2);
});

test('a Row reports a separate required height for its first and subsequent visual lines', async () => {
  const { groupRowChildrenBySpan, requiredRowsForRowLines } = await import('../src/templates/gridLayout.ts');
  const tallSection = block('tall-section', 'section', {
    blocks: [block('nested-a'), block('nested-b')],
  });
  const row = block('row', 'row', {
    blocks: [tallSection, block('second-line-a'), block('second-line-b')],
  });
  const layout = makeLayout([row], {
    'tall-section': { span: 6 },
    'second-line-a': { span: 6 },
    'second-line-b': { span: 6 },
  });
  const lines = groupRowChildrenBySpan(row.blocks, layout);
  assert.deepEqual(requiredRowsForRowLines(lines, layout), [2, 1]);
  assert.equal(requiredRowsForBlock(row, layout), 3);
});

test('a Row line with only omitted blocks has zero required height', async () => {
  const { groupRowChildrenBySpan, requiredRowsForRowLines } = await import('../src/templates/gridLayout.ts');
  const row = block('row', 'row', { blocks: [block('a'), block('b'), block('c')] });
  const layout = makeLayout([row], { a: { span: 6 }, b: { span: 6 }, c: { span: 6 } });
  const lines = groupRowChildrenBySpan(row.blocks, layout);
  assert.deepEqual(requiredRowsForRowLines(lines, layout, new Set(['a', 'b'])), [0, 1]);
});
