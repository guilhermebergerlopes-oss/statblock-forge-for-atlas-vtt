import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { numericFieldTracks, setNumericFieldMaximum, setNumericFieldTracking } from '../src/templates/numericTrackingModel.ts';
import { setValueDisplayMode } from '../src/templates/valueEditorModel.ts';
import { parseTemplateFileText } from '../src/templates/forgeFileFormat.ts';
import { trackedNumberDisplayForField } from '../src/statblocks/trackedNumberDisplayModel.ts';
import { FORGE_RESOURCE_VALUES_KEY } from '../src/statblocks/forgeResourceValues.ts';

const renderer = await readFile(new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8');
const valueInspector = await readFile(new URL('../src/views/templateValueBlockInspector.ts', import.meta.url), 'utf8');
const trackingControls = await readFile(new URL('../src/views/templateNumericTrackingControls.ts', import.meta.url), 'utf8');

function makeTemplate() {
  return {
    format: 'atlas-statblock-template',
    version: 1,
    id: 'tracked-number-123456',
    fields: [
      { key: 'hp', label: 'HP', type: 'number', default: 12 },
      { key: 'hpMax', label: 'HP Maximum', type: 'number', default: 18 },
    ],
    layout: { maxColumns: 12, blocks: [{ id: 'hp-stat-123456', type: 'stat', field: 'hp' }] },
  };
}

test('a Number Value can be marked tracked without changing its Number Field or Stat block type', () => {
  const template = makeTemplate();
  const field = template.fields[0];
  assert.equal(setNumericFieldTracking(template, 'hp', 'down'), true);
  assert.equal(field.type, 'number');
  assert.deepEqual(field.tracks, { counts: 'down' });
  assert.equal(template.layout.blocks[0].type, 'stat');
  assert.deepEqual(numericFieldTracks(field), { counts: 'down' });
});

test('a tracked Number can use another Number Field as its maximum without becoming a Track block', () => {
  const template = makeTemplate();
  assert.equal(setNumericFieldTracking(template, 'hp', 'up'), true);
  assert.equal(setNumericFieldMaximum(template, 'hp', 'hpMax'), true);
  assert.deepEqual(template.fields[0].tracks, { counts: 'up', max: 'hpMax' });
  assert.equal(template.fields[0].type, 'number');
  assert.equal(template.layout.blocks[0].type, 'stat');
});

test('When Empty is a block presentation setting and survives Number/Track conversion', () => {
  const template = makeTemplate();
  const block = template.layout.blocks[0];
  block.whenEmpty = 'fallback';
  block.fallback = 'Not entered';
  assert.equal(setValueDisplayMode(template, block.id, 'boxes'), true);
  assert.equal(template.layout.blocks[0].type, 'track');
  assert.equal(template.layout.blocks[0].whenEmpty, 'fallback');
  assert.equal(template.layout.blocks[0].fallback, 'Not entered');
  assert.equal(setValueDisplayMode(template, block.id, 'number'), true);
  assert.equal(template.layout.blocks[0].whenEmpty, 'fallback');
  assert.equal(template.layout.blocks[0].fallback, 'Not entered');
  assert.equal(Object.hasOwn(template.fields[0], 'whenEmpty'), false);
  assert.equal(Object.hasOwn(template.fields[0], 'fallback'), false);
});

test('changing a Track presentation back to Number keeps the Field tracked', () => {
  const template = makeTemplate();
  template.layout.blocks[0] = { id: 'hp-stat-123456', type: 'track', field: 'hp', look: 'gauge', counts: 'down' };
  assert.equal(setValueDisplayMode(template, 'hp-stat-123456', 'number'), true);
  assert.equal(template.layout.blocks[0].type, 'stat');
  assert.equal(template.fields[0].type, 'number');
  assert.deepEqual(template.fields[0].tracks, { counts: 'down' });
  assert.deepEqual(numericFieldTracks(template.fields[0]), { counts: 'down' });
});

test('tracked Number configuration survives Atlas template import', () => {
  const template = makeTemplate();
  setNumericFieldTracking(template, 'hp', 'down');
  setNumericFieldMaximum(template, 'hp', 'hpMax');
  const serializedAtlasSource = JSON.stringify(template);
  const reopened = parseTemplateFileText(serializedAtlasSource, 'atlastemplate');
  assert.equal(reopened.canOverwrite, false);
  assert.equal(reopened.template.fields[0].type, 'number');
  assert.deepEqual(reopened.template.fields[0].tracks, { counts: 'down', max: 'hpMax' });
  assert.equal(reopened.template.layout.blocks[0].type, 'stat');
});

test('tracked Number display resolves current over the configured maximum without rewriting either Field', () => {
  const template = makeTemplate();
  const [hp, hpMax] = template.fields;
  hp.tracks = { counts: 'down', max: 'hpMax' };
  const sample = { hp: 12, hpMax: 18, [FORGE_RESOURCE_VALUES_KEY]: { hp: 7 } };
  const before = structuredClone(sample);
  const shown = trackedNumberDisplayForField(hp, template.fields, sample, (field) => Number(sample[field.key]));
  assert.equal(shown.current, 7);
  assert.equal(shown.maximum, 18);
  assert.equal(shown.maxField.key, 'hpMax');
  assert.deepEqual(sample, before);
  assert.equal(hp.type, 'number');
  assert.equal(hpMax.type, 'number');
});

test('tracked Number defaults follow counts down/up and ignores a maximum below one', () => {
  const template = makeTemplate();
  const [hp, hpMax] = template.fields;
  hp.tracks = { counts: 'down' };
  let shown = trackedNumberDisplayForField(hp, template.fields, { hp: 4 }, (field) => Number(field.key === 'hp' ? 4 : 0));
  assert.equal(shown.current, 4);
  assert.equal(shown.maximum, 4);
  hp.tracks = { counts: 'up' };
  shown = trackedNumberDisplayForField(hp, template.fields, { hp: 4 }, (field) => Number(field.key === 'hp' ? 4 : 0));
  assert.equal(shown.current, 0);
  assert.equal(shown.maximum, 4);
  hp.tracks = { counts: 'down', max: 'hpMax' };
  assert.equal(trackedNumberDisplayForField(hp, template.fields, { hp: 4, hpMax: 0 }, (field) => Number(field.key === 'hp' ? 4 : 0)), null);
});

test('the Number Value inspector exposes Tracking independently of Number/Boxes/Gauge display', () => {
  assert.match(valueInspector, /if \(isNumberValueField\) \{[\s\S]*?renderNumericTrackingControls\(context, valueFieldForMode, panel\)/);
  assert.match(trackingControls, /if \(field\.type !== 'number'\) return/);
  assert.match(trackingControls, /setNumericFieldTracking\(context\.template, field\.key, mode\.value/);
  assert.match(renderer, /trackedNumberDisplayForField\(field, fields, sample, readNumber, sourceBlocks, header\)/);
  assert.match(renderer, /atlas-sb-tracked statblock-forge__tracked-number/);
});


test('a Number Value is shown as tracked when an unbound Track block declares its tracking', () => {
  const template = makeTemplate();
  template.layout.blocks.push({ id: 'hp-track-123456', type: 'track', field: 'hp', counts: 'up' });
  const sample = { hp: 12, hpMax: 18, [FORGE_RESOURCE_VALUES_KEY]: { hp: 5 } };
  const shown = trackedNumberDisplayForField(
    template.fields[0],
    template.fields,
    sample,
    (field) => Number(sample[field.key]),
    template.layout.blocks,
  );
  assert.deepEqual(shown, {
    current: 5,
    maximum: 12,
    maxField: template.fields[0],
    counts: 'up',
  });
});

test('an unbound Track controls the Number Value direction only when field.tracks is absent', () => {
  const template = makeTemplate();
  template.fields[0].tracks = { counts: 'down', max: 'hpMax' };
  template.layout.blocks.push({ id: 'hp-track-123456', type: 'track', field: 'hp', counts: 'up' });
  const sample = { hp: 12, hpMax: 18, [FORGE_RESOURCE_VALUES_KEY]: { hp: 7 } };
  const shown = trackedNumberDisplayForField(
    template.fields[0], template.fields, sample,
    (field) => Number(sample[field.key]), template.layout.blocks,
  );
  assert.equal(shown.current, 7);
  assert.equal(shown.maximum, 18);
  assert.equal(shown.counts, 'down');
});


test('a Number Value follows Atlas header hit-points tracking when the Field has no explicit tracks', () => {
  const template = makeTemplate();
  template.fields[0].meaning = 'hit-points';
  const sample = { hp: 16, [FORGE_RESOURCE_VALUES_KEY]: { hp: 11 } };
  const shown = trackedNumberDisplayForField(
    template.fields[0], template.fields, sample,
    (field) => Number(sample[field.key]), [],
    { hitPoints: { counts: 'down' } },
  );
  assert.equal(shown.current, 11);
  assert.equal(shown.maximum, 16);
  assert.equal(shown.counts, 'down');
});
