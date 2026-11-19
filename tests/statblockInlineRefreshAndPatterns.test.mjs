import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceMetadataRefreshGate } from '../src/views/sourceMetadataRefreshGate.ts';
import { expandStatblockPattern } from '../src/templates/patternValueModel.ts';

const renderer = await readFile(new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8');
const surface = await readFile(new URL('../src/views/StatblockRenderSurface.ts', import.meta.url), 'utf8');
const panels = await readFile(new URL('../src/views/StatblockNotePanels.ts', import.meta.url), 'utf8');

function functionSource(source, name, nextMarker) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} should exist`);
  const end = source.indexOf(nextMarker, start);
  assert.ok(end > start, `${name} should have a following boundary`);
  return source.slice(start, end);
}

test('source metadata refresh gate consumes only expected Forge writes', () => {
  const gate = new SourceMetadataRefreshGate(2_000);
  gate.expect('Actors/Goblin.md', 100);
  assert.equal(gate.consume('Actors/Goblin.md', 101), true);
  assert.equal(gate.consume('Actors/Goblin.md', 102), false);
  assert.equal(gate.consume('Actors/Orc.md', 102), false);
});

test('source metadata refresh gate counts multiple queued inline field saves', () => {
  const gate = new SourceMetadataRefreshGate(2_000);
  gate.expect('Actors/Goblin.md', 100);
  gate.expect('Actors/Goblin.md', 110);
  assert.equal(gate.consume('Actors/Goblin.md', 111), true);
  assert.equal(gate.consume('Actors/Goblin.md', 112), true);
  assert.equal(gate.consume('Actors/Goblin.md', 113), false);
});

test('expired source metadata markers cannot suppress later external edits', () => {
  const gate = new SourceMetadataRefreshGate(2_000);
  gate.expect('Actors/Goblin.md', 100);
  assert.equal(gate.consume('Actors/Goblin.md', 2_101), false);
  assert.equal(gate.consume('Actors/Goblin.md', 2_102), false);
});

test('failed source writes can cancel their expected metadata notification', () => {
  const gate = new SourceMetadataRefreshGate(2_000);
  gate.expect('Actors/Goblin.md', 100);
  gate.cancel('Actors/Goblin.md');
  assert.equal(gate.consume('Actors/Goblin.md', 101), false);
});

test('inline frontmatter writes mark their own metadata event before persistence', () => {
  const start = surface.indexOf('private async saveInlineFieldValue(');
  const end = surface.indexOf('\n  private async saveFieldEditDraft', start);
  assert.ok(start >= 0 && end > start);
  const save = surface.slice(start, end);
  assert.match(save, /sourceMetadataRefreshGate\.expect\(source\.path\)/);
  assert.match(save, /sourceMetadataRefreshGate\.cancel\(source\.path\)/);
  assert.match(save, /processFrontMatter/);
});

test('the note-panel manager consumes self-generated metadata events instead of rebuilding the card', () => {
  assert.match(panels, /consumeOwnSourceMetadataRefresh\(path: string\)/);
  assert.match(panels, /if \(changedPath === file\.path && current\?\.belongsTo\(file\.path\)[\s\S]{0,180}current\.consumeOwnSourceMetadataRefresh\(file\.path\)\) return/);
  assert.match(surface, /consumeExpectedSourceMetadataRefresh\(path: string\)/);
});

test('Patterns expand updated Field values, including false, zero, arrays and nested records', () => {
  const data = { name: 'Goblin', hp: 0, active: false, tags: ['ambusher', 'scout'], traits: { armor: 2, speed: 6 } };
  const format = (value) => {
    if (value === undefined || value === null || value === '') return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.map(format).filter(Boolean).join(', ');
    return Object.entries(value).map(([key, item]) => `${key}: ${format(item)}`).filter((part) => !part.endsWith(': ')).join(' · ');
  };
  assert.equal(
    expandStatblockPattern('{name} · HP {hp} · Active {active} · {tags} · {traits}', data, format),
    'Goblin · HP 0 · Active false · ambusher, scout · armor: 2 · speed: 6',
  );
});

test('Title Patterns subscribe to live Field changes', () => {
  const title = functionSource(renderer, 'renderTitle', '\nfunction renderStat(');
  assert.match(title, /if \(pattern !== null\)[\s\S]*?numericRuntime\?\.subscribeAll\(/);
  assert.match(title, /expandedPattern\(block\.pattern, sample\)/);
});

test('Stat Patterns recalculate their text before refreshing roll links', () => {
  const stat = functionSource(renderer, 'renderStat', '\nfunction renderMetric(');
  assert.match(stat, /if \(pattern !== null\)[\s\S]*?expandedPattern\(block\.pattern, nextSample\)/);
  assert.match(stat, /numericRuntime\?\.subscribeAll\(syncRollableValue\)/);
});

test('Line Patterns subscribe to live Field changes', () => {
  const lineStart = renderer.indexOf("case 'line': {");
  const lineEnd = renderer.indexOf("case 'stat': return", lineStart);
  assert.ok(lineStart >= 0 && lineEnd > lineStart);
  const line = renderer.slice(lineStart, lineEnd);
  assert.match(line, /if \(pattern !== null\)[\s\S]*?numericRuntime\?\.subscribeAll\(/);
});

test('external note metadata changes still reach the normal panel refresh path', () => {
  const start = panels.indexOf('private async evaluate(');
  const end = panels.indexOf('\n  }\n}', start);
  assert.ok(start >= 0 && end > start);
  const evaluate = panels.slice(start, end);
  const ownWriteGate = evaluate.indexOf('current.consumeOwnSourceMetadataRefresh(file.path)');
  const externalRefresh = evaluate.indexOf('if (changedPath === file.path) await current.refresh()');
  assert.ok(ownWriteGate >= 0, 'Forge-originated metadata changes should be consumed');
  assert.ok(externalRefresh > ownWriteGate, 'unmarked source edits should still refresh the panel');
});
