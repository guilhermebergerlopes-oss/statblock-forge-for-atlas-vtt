import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  FORGE_FILE_METADATA_FORMAT,
  FORGE_FILE_METADATA_KEY,
  FORGE_FILE_METADATA_VERSION,
  parseTemplateFileText,
  serializeForgeTemplateFile,
} from '../src/templates/forgeFileFormat.ts';
import {
  createBlankTemplate,
  createForgeLayout,
  parseForgeLayout,
  serializeForgeEditorTemplate,
  serializeForgeLayout,
} from '../src/templates/forgeTemplate.ts';
import {
  inspectForgeLayoutSidecarText,
  resolveAtlasTemplateLayoutForForgeCopy,
} from '../src/templates/forgeLayoutSidecar.ts';
import { inspectTemplateText } from '../src/templates/templateFormat.ts';

function templateFixture() {
  const template = createBlankTemplate('Wolf creature');
  template.id = 'wolf-creature-abc123';
  template.version = 1;
  template.futureRootProperty = { source: 'atlas-next', retained: true };
  template.fields.find((field) => field.key === 'name').futureFieldProperty = { kept: 'yes' };
  template.fields.push({
    key: 'abilities', label: 'Abilities', type: 'entries',
    entry: { extras: [
      { key: 'uses', label: 'Uses', type: 'counter', max: 5, look: 'boxes', futurePart: 'keep' },
      { key: 'reach', label: 'Reach', type: 'text' },
    ] },
  });
  template.fields.push({ key: 'checks', label: 'Checks', type: 'checkboxes' });
  template.layout.blocks = [
    {
      id: 'main-section', type: 'section', heading: 'Main',
      blocks: [
        { id: 'hp-stat', type: 'stat', field: 'hp', labelPlacement: 'above', addsToRolls: true },
        { id: 'abilities-entries', type: 'entries', field: 'abilities', labelPlacement: 'none' },
      ],
    },
    { id: 'vertical-split', type: 'vertical-divider' },
  ];
  template.layout.blocks[0].futureBlockProperty = { retained: true };
  return template;
}

test('Forge-owned file keeps the Atlas template at the JSON root and namespaces Forge layout metadata', () => {
  const template = templateFixture();
  const layout = createForgeLayout(template);
  layout.columns = 20;
  layout.dense = false;
  layout.sheetWidth = 760;
  layout.themeId = 'default';
  layout.blocks['main-section'].span = 10;

  const text = serializeForgeTemplateFile(template, layout);
  const json = JSON.parse(text);
  assert.equal(json.format, 'atlas-statblock-template');
  assert.equal(json.version, 1);
  assert.equal(json.id, template.id);
  assert.ok(Array.isArray(json.fields));
  assert.ok(Array.isArray(json.layout.blocks));
  assert.equal(json[FORGE_FILE_METADATA_KEY].format, FORGE_FILE_METADATA_FORMAT);
  assert.equal(json[FORGE_FILE_METADATA_KEY].version, FORGE_FILE_METADATA_VERSION);
  assert.equal(json[FORGE_FILE_METADATA_KEY].layout.templateId, template.id);
  assert.equal(json[FORGE_FILE_METADATA_KEY].layout.columns, 20);

  const parsed = parseTemplateFileText(text, 'forgetemplate');
  assert.equal(parsed.fileFormat, 'forge');
  assert.equal(parsed.canOverwrite, true);
  assert.equal(parsed.layout.columns, 20);
  assert.equal(parsed.layout.dense, false);
  assert.equal(parsed.layout.sheetWidth, 760);
  assert.equal(parsed.layout.blocks['main-section'].span, 10);
  assert.deepEqual(parsed.template.futureRootProperty, { source: 'atlas-next', retained: true });
  assert.deepEqual(parsed.template.fields[0].futureFieldProperty, { kept: 'yes' });
  assert.deepEqual(parsed.template.layout.blocks[0].futureBlockProperty, { retained: true });
});


test('Forge-owned JSON writes reorganized Field type IDs and reads both new and legacy IDs', () => {
  const template = templateFixture();
  template.fields.push(
    { key: 'inline', label: 'Inline', type: 'text' },
    { key: 'selection', label: 'Selection', type: 'choice', options: ['A', 'B'] },
    { key: 'counter', label: 'Counter', type: 'counters' },
    { key: 'groups', label: 'Groups', type: 'spells' },
  );
  const layout = createForgeLayout(template);
  const groupsId = layout.fieldIds.groups;
  layout.compendiumByFieldId[groupsId] = [{
    id: 'group-item-1', name: 'Spell group', fieldType: 'spells', value: [{ name: 'At will', spells: ['Light'] }],
  }];

  const savedText = serializeForgeTemplateFile(template, layout);
  const saved = JSON.parse(savedText);
  const savedType = (key) => saved.fields.find((field) => field.key === key).type;
  assert.equal(savedType('inline'), 'inline');
  assert.equal(savedType('selection'), 'selection');
  assert.equal(savedType('counter'), 'counter');
  assert.equal(savedType('groups'), 'groups');
  assert.equal(saved[FORGE_FILE_METADATA_KEY].layout.compendiumByFieldId[groupsId][0].fieldType, 'groups');

  const parsed = parseTemplateFileText(savedText, 'forgetemplate');
  const runtimeType = (key) => parsed.template.fields.find((field) => field.key === key).type;
  assert.equal(runtimeType('inline'), 'text');
  assert.equal(runtimeType('selection'), 'choice');
  assert.equal(runtimeType('counter'), 'counters');
  assert.equal(runtimeType('groups'), 'spells');
  assert.equal(parsed.layout.compendiumByFieldId[groupsId][0].fieldType, 'spells');

  const oldJson = structuredClone(saved);
  oldJson.fields.find((field) => field.key === 'inline').type = 'text';
  oldJson.fields.find((field) => field.key === 'selection').type = 'choice';
  oldJson.fields.find((field) => field.key === 'counter').type = 'counters';
  oldJson.fields.find((field) => field.key === 'groups').type = 'spells';
  oldJson[FORGE_FILE_METADATA_KEY].layout.compendiumByFieldId[groupsId][0].fieldType = 'spells';
  const oldParsed = parseTemplateFileText(JSON.stringify(oldJson), 'forgetemplate');
  assert.equal(oldParsed.template.fields.find((field) => field.key === 'inline').type, 'text');
  assert.equal(oldParsed.template.fields.find((field) => field.key === 'selection').type, 'choice');
  assert.equal(oldParsed.template.fields.find((field) => field.key === 'counter').type, 'counters');
  assert.equal(oldParsed.template.fields.find((field) => field.key === 'groups').type, 'spells');


});


test('Forge JSON editor displays reorganized IDs while parsing them back into the runtime model', async () => {
  const { readTemplateJson } = await import('../src/templates/jsonEditorModel.ts');
  const template = templateFixture();
  template.fields.push(
    { key: 'inline', label: 'Inline', type: 'text' },
    { key: 'selection', label: 'Selection', type: 'choice', options: ['A', 'B'] },
    { key: 'counter', label: 'Counter', type: 'counters' },
    { key: 'groups', label: 'Groups', type: 'spells' },
  );
  const editorJson = JSON.parse(serializeForgeEditorTemplate(template));
  const editorType = (key) => editorJson.fields.find((field) => field.key === key).type;
  assert.equal(editorType('inline'), 'inline');
  assert.equal(editorType('selection'), 'selection');
  assert.equal(editorType('counter'), 'counter');
  assert.equal(editorType('groups'), 'groups');

  const reading = readTemplateJson(serializeForgeEditorTemplate(template), template.id);
  assert.equal(reading.template.fields.find((field) => field.key === 'inline').type, 'text');
  assert.equal(reading.template.fields.find((field) => field.key === 'selection').type, 'choice');
  assert.equal(reading.template.fields.find((field) => field.key === 'counter').type, 'counters');
  assert.equal(reading.template.fields.find((field) => field.key === 'groups').type, 'spells');
});

test('Forge layout sidecars write Groups as groups and accept legacy spells on read', async () => {
  const template = templateFixture();
  template.fields.push({ key: 'groups', label: 'Groups', type: 'spells' });
  const layout = createForgeLayout(template);
  const groupsId = layout.fieldIds.groups;
  layout.compendiumByFieldId[groupsId] = [{ id: 'group-item-1', name: 'Group', fieldType: 'spells', value: [] }];

  const sidecarText = serializeForgeLayout(layout);
  const sidecar = JSON.parse(sidecarText);
  assert.equal(sidecar.compendiumByFieldId[groupsId][0].fieldType, 'groups');
  const roundTrip = parseForgeLayout(sidecarText, template);
  assert.equal(roundTrip.compendiumByFieldId[groupsId][0].fieldType, 'spells');

  sidecar.compendiumByFieldId[groupsId][0].fieldType = 'spells';
  const legacyRoundTrip = parseForgeLayout(JSON.stringify(sidecar), template);
  assert.equal(legacyRoundTrip.compendiumByFieldId[groupsId][0].fieldType, 'spells');
});

test('missing or unsupported Forge metadata protects the original .forgetemplate from in-place overwrite', () => {
  const template = templateFixture();
  const base = JSON.parse(serializeForgeTemplateFile(template, createForgeLayout(template)));
  const missing = { ...base };
  delete missing[FORGE_FILE_METADATA_KEY];
  const missingResult = parseTemplateFileText(JSON.stringify(missing), 'forgetemplate');
  assert.equal(missingResult.fileFormat, 'forge');
  assert.equal(missingResult.canOverwrite, false);
  assert.equal(missingResult.layout, null);
  assert.ok(missingResult.warnings.some((warning) => warning.includes('Salvar cópia Forge')));

  const unsupported = structuredClone(base);
  unsupported[FORGE_FILE_METADATA_KEY].version = 2;
  const unsupportedResult = parseTemplateFileText(JSON.stringify(unsupported), 'forgetemplate');
  assert.equal(unsupportedResult.canOverwrite, false);
  assert.equal(unsupportedResult.layout, null);

  const mismatched = structuredClone(base);
  mismatched[FORGE_FILE_METADATA_KEY].layout.templateId = 'another-template-abc123';
  const mismatchedResult = parseTemplateFileText(JSON.stringify(mismatched), 'forgetemplate');
  assert.equal(mismatchedResult.canOverwrite, false);
  assert.equal(mismatchedResult.layout, null);
});

test('native Atlas templates remain import-only and cannot be overwritten from Forge', () => {
  const atlasTemplate = templateFixture();
  const text = JSON.stringify(atlasTemplate, null, 2);
  const parsed = parseTemplateFileText(text, 'atlastemplate');
  assert.equal(parsed.fileFormat, 'atlas');
  assert.equal(parsed.canOverwrite, false);
  assert.equal(parsed.layout, null, 'native Atlas files keep Forge layout in an external sidecar');
  assert.equal(parsed.template.id, atlasTemplate.id);
  const inspected = inspectTemplateText(text);
  assert.equal(inspected.status, 'valid');
  assert.equal(inspected.fileFormat, 'atlas');
});

test('Atlas native files use the external Forge sidecar when imported as a Forge copy', () => {
  const template = templateFixture();
  const layout = createForgeLayout(template);
  layout.columns = 18;
  layout.dense = false;
  layout.sheetWidth = 810;
  layout.blocks['hp-stat'].span = 8;
  const text = serializeForgeLayout(layout);

  const inspected = inspectForgeLayoutSidecarText(text, template);
  assert.equal(inspected.status, 'valid');
  assert.equal(inspected.layout.columns, 18);

  const resolved = resolveAtlasTemplateLayoutForForgeCopy(template, null, text);
  assert.equal(resolved.source, 'sidecar');
  assert.equal(resolved.layout.columns, 18);
  assert.equal(resolved.layout.dense, false);
  assert.equal(resolved.layout.sheetWidth, 810);
  assert.equal(resolved.layout.blocks['hp-stat'].span, 8);

  const embedded = resolveAtlasTemplateLayoutForForgeCopy(template, layout, '{not needed');
  assert.equal(embedded.source, 'embedded');
  assert.equal(embedded.layout, layout);
});

test('unsupported or mismatched Forge sidecars are not silently treated as compatible layouts', () => {
  const template = templateFixture();
  const layout = createForgeLayout(template);
  const newer = JSON.parse(serializeForgeLayout(layout));
  newer.version = 2;
  const newerText = JSON.stringify(newer);
  const newerInspection = inspectForgeLayoutSidecarText(newerText, template);
  assert.equal(newerInspection.status, 'unsupported-version');
  const newerResolution = resolveAtlasTemplateLayoutForForgeCopy(template, null, newerText);
  assert.equal(newerResolution.source, 'default');
  assert.match(newerResolution.warning, /versão 2/);
  assert.equal(newer.version, 2, 'inspection/import must not rewrite the source sidecar');

  const mismatch = JSON.parse(serializeForgeLayout(layout));
  mismatch.templateId = 'different-template-abc123';
  assert.equal(inspectForgeLayoutSidecarText(JSON.stringify(mismatch), template).status, 'template-mismatch');
  assert.equal(inspectForgeLayoutSidecarText('{bad json', template).status, 'invalid-json');
});

test('future root and per-block sidecar properties survive a Forge layout read/write cycle', () => {
  const template = templateFixture();
  const layout = createForgeLayout(template);
  const raw = JSON.parse(serializeForgeLayout(layout));
  raw.futureLayoutProperty = { keep: true };
  raw.blocks['main-section'].futureBlockProperty = { keep: 'block value' };
  raw.blocks['main-section'].appearance.futureAppearanceProperty = { keep: 'appearance value' };

  const parsed = parseForgeLayout(JSON.stringify(raw), template);
  assert.deepEqual(parsed.futureLayoutProperty, { keep: true });
  assert.deepEqual(parsed.blocks['main-section'].futureBlockProperty, { keep: 'block value' });
  assert.deepEqual(parsed.blocks['main-section'].appearance.futureAppearanceProperty, { keep: 'appearance value' });
  const written = JSON.parse(serializeForgeLayout(parsed));
  assert.deepEqual(written.futureLayoutProperty, { keep: true });
  assert.deepEqual(written.blocks['main-section'].futureBlockProperty, { keep: 'block value' });
  assert.deepEqual(written.blocks['main-section'].appearance.futureAppearanceProperty, { keep: 'appearance value' });
});


test('Atlas-to-Forge import path reads existing sidecars and always creates a Forge-owned copy', async () => {
  const mainSource = await readFile(new URL('../main.ts', import.meta.url), 'utf8');
  assert.match(mainSource, /resolveAtlasTemplateLayoutForForgeCopy\(parsed\.template, parsed\.layout, sidecarText\)/);
  assert.match(mainSource, /\.statblock-forge\/layouts\/\$\{parsed\.template\.id\}\.json/);
  assert.match(mainSource, /layout: layoutResolution\.layout/);
  assert.match(mainSource, /layoutResolution\.warning/);
  assert.match(mainSource, /sourcePath: currentSource\.path/);
  assert.match(mainSource, /originalText/);
});
