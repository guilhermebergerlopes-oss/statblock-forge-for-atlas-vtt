import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTablePairsModel } from '../src/templates/tablePairsModel.ts';

const field = (key, label, type = 'pairs') => ({ key, label, type });

test('each Pairs Field is one table row and each named pair becomes a column', () => {
  const rows = [field('defenses', 'Defenses')];
  const sample = { defenses: [{ Armor: 15 }, { Speed: 30 }, { Resist: '+2' }] };
  const model = buildTablePairsModel(rows, [], sample);
  assert.deepEqual(model.columns.map((column) => column.label), ['Armor', 'Speed', 'Resist']);
  assert.equal(model.rows.length, 1);
  assert.equal(model.rows[0].label, 'Defenses');
  assert.deepEqual(model.rows[0].cells.map((cell) => cell.value), [15, 30, '+2']);
  assert.deepEqual(model.rows[0].cells.map((cell) => cell.pairIndex), [0, 1, 2]);
});

test('multiple Pairs Fields align their row values under the union of named columns', () => {
  const rows = [field('basic', 'Basic'), field('elite', 'Elite')];
  const sample = {
    basic: [{ Armor: 12 }, { Speed: 25 }],
    elite: [{ Armor: 17 }, { Flight: '30 ft.' }],
  };
  const model = buildTablePairsModel(rows, [], sample);
  assert.deepEqual(model.columns.map((column) => column.label), ['Armor', 'Speed', 'Flight']);
  assert.deepEqual(model.rows.map((row) => row.cells.map((cell) => cell.value)), [
    [12, 25, null],
    [17, null, '30 ft.'],
  ]);
});

test('non-Pairs Fields fill matching named slots or add a new column', () => {
  const rows = [field('defenses', 'Defenses')];
  const slots = [field('armor', 'Armor', 'number'), field('initiative', 'Initiative', 'number')];
  const sample = {
    defenses: [{ Armor: 12 }, { Speed: 30 }],
    armor: 14,
    initiative: 3,
  };
  const model = buildTablePairsModel(rows, slots, sample);
  assert.deepEqual(model.columns.map((column) => column.label), ['Armor', 'Speed', 'Initiative']);
  assert.equal(model.columns[0].fieldKey, 'armor');
  assert.deepEqual(model.rows[0].cells.map((cell) => cell.value), [12, 30, 3]);
  assert.equal(model.rows[0].cells[0].pairFieldKey, 'defenses');
  assert.equal(model.rows[0].cells[2].fieldKey, 'initiative');
});

test('slot-only Tables produce one row with one column per Field', () => {
  const slots = [field('armor', 'Armor', 'number'), field('speed', 'Speed', 'number')];
  const model = buildTablePairsModel([], slots, { armor: 14, speed: 30 });
  assert.deepEqual(model.columns.map((column) => column.label), ['Armor', 'Speed']);
  assert.deepEqual(model.rows[0].cells.map((cell) => cell.value), [14, 30]);
});
