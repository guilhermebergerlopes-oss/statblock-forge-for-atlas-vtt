import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ATLAS_RESERVED_STATBLOCK_KEYS,
  applyAtlasStatblockMetadata,
  atlasPublishableFieldKeys,
  atlasStatblockFrontmatter,
  serializeAtlasStatblockNote,
  validateAtlasStatblockPublish,
} from '../src/atlas/atlasStatblockFormat.ts';

function template(fields) {
  return {
    format: 'atlas-statblock-template', version: 1, id: 'creature-abc123', fields,
    layout: { maxColumns: 12, blocks: [] },
  };
}

test('validates reserved and duplicate Field keys case-insensitively', () => {
  const source = template([
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'StatBlock', label: 'Conflict', type: 'text' },
    { key: 'custom', label: 'First', type: 'text' },
    { key: 'CUSTOM', label: 'Duplicate', type: 'text' },
  ]);
  const result = validateAtlasStatblockPublish(source, { name: 'Wolf' });
  assert.equal(result.errors.length, 2);
  assert.match(result.errors[0], /StatBlock/);
  assert.match(result.errors[1], /CUSTOM/);
  assert.ok(ATLAS_RESERVED_STATBLOCK_KEYS.has('statblock-forge'));
});

test('warns about missing names, remote artwork and non-path image values', () => {
  const source = template([
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'image', label: 'Image', type: 'image' },
  ]);
  assert.equal(validateAtlasStatblockPublish(source, { image: 'https://example.test/wolf.png' }).warnings.length, 2);
  assert.equal(validateAtlasStatblockPublish(source, { name: 'Wolf', image: { path: 'wolf.png' } }).warnings.length, 1);
});

test('builds frontmatter from declared Fields only and includes native Atlas markers', () => {
  const source = template([
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'image', label: 'Image', type: 'image' },
    { key: 'hp', label: 'HP', type: 'number', meaning: 'hit-points' },
  ]);
  const link = {
    format: 'statblock-forge-template-link', version: 2,
    templatePath: 'Bestiary/creature.forgetemplate', templateId: source.id,
  };
  const frontmatter = atlasStatblockFrontmatter(source, {
    name: '  Wolf  ', image: 'wolf.png', hp: 12, atlasInternal: 'must-not-leak',
  }, 'Fallback', link);

  assert.deepEqual(frontmatter, {
    statblock: true,
    'atlas-template': source.id,
    name: '  Wolf  ',
    image: 'wolf.png',
    hp: 12,
    'statblock-forge': link,
  });
});

test('uses fallback name and keeps linkage metadata updates isolated', () => {
  const source = template([{ key: 'name', label: 'Name', type: 'text' }]);
  const frontmatter = atlasStatblockFrontmatter(source, { name: '  ' }, ' Dire Wolf ');
  assert.equal(frontmatter.name, ' Dire Wolf ');

  const existing = { name: '', custom: { keep: true }, hp: 4, 'statblock-forge': { stale: true } };
  const link = {
    format: 'statblock-forge-template-link', version: 2,
    templatePath: 'Templates/wolf.forgetemplate', templateId: source.id,
  };
  applyAtlasStatblockMetadata(existing, 'atlas-id', link, 'name', 'Wolf');
  assert.deepEqual(existing, {
    name: 'Wolf', custom: { keep: true }, hp: 4,
    'statblock-forge': link, statblock: true, 'atlas-template': 'atlas-id',
  });
  applyAtlasStatblockMetadata(existing, 'atlas-id', null);
  assert.equal('statblock-forge' in existing, false);
});

test('serializes nested YAML-safe values without interpolating text and rejects non-finite numbers', () => {
  const source = template([
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'details', label: 'Details', type: 'text' },
  ]);
  const serialized = serializeAtlasStatblockNote(source, {
    name: 'Wolf: "Alpha"', details: { note: 'line\n---\nforged', tags: ['one', 'two'] },
  }, 'Fallback');
  assert.ok(serialized.startsWith('---\nstatblock: true\n'));
  assert.ok(serialized.includes('name: "Wolf: \\\"Alpha\\\""'));
  assert.ok(serialized.includes('details: {note: "line\\n---\\nforged", tags: ["one", "two"]}'));
  assert.ok(serialized.endsWith('---\n\n'));
  assert.throws(() => serializeAtlasStatblockNote(source, { name: 'Wolf', details: Number.NaN }, 'Fallback'), /número não finito/);
});

test('lists only non-reserved template fields for publishing', () => {
  const source = template([
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'statblock', label: 'Marker', type: 'text' },
    { key: 'abilities', label: 'Abilities', type: 'entries' },
  ]);
  assert.deepEqual(atlasPublishableFieldKeys(source), ['name', 'abilities']);
});
