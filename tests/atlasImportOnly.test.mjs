import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseTemplateFileText } from '../src/templates/forgeFileFormat.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function source(path) {
  return readFile(resolve(root, path), 'utf8');
}

test('Atlas template files remain importable as read-only sources', async () => {
  const atlasTemplate = {
    format: 'atlas-statblock-template',
    version: 1,
    id: 'import-check-abc123',
    name: 'Imported Atlas Template',
    fields: [
      { key: 'summary', label: 'Summary', type: 'text' },
      { key: 'stance', label: 'Stance', type: 'choice', options: ['Aggressive', 'Defensive'] },
      { key: 'resources', label: 'Resources', type: 'counters' },
      { key: 'spells', label: 'Groups', type: 'spells' },
    ],
    layout: { maxColumns: 12, blocks: [] },
  };
  const parsed = parseTemplateFileText(JSON.stringify(atlasTemplate), 'atlastemplate');
  assert.equal(parsed.fileFormat, 'atlas');
  assert.equal(parsed.canOverwrite, false);
  assert.deepEqual(parsed.template.fields.map((field) => field.type), ['text', 'choice', 'counters', 'spells']);

  const main = await source('main.ts');
  assert.match(main, /createForgeCopyFromAtlas/);
  assert.match(main, /target\.extension\.toLowerCase\(\) === 'atlastemplate'/);
  assert.match(main, /saveAsCopy: true/);
  assert.match(main, /resolveAtlasTemplateLayoutForForgeCopy/);
});

test('Atlas template and statblock export entry points are absent', async () => {
  const editor = await source('src/views/TemplateEditorView.ts');
  const render = await source('src/views/StatblockRenderSurface.ts');
  const repository = await source('src/templates/templateRepository.ts');
  const capabilities = await source('src/atlas/atlasCapabilities.ts');

  assert.doesNotMatch(editor, /Export to Atlas|exportAtlasTemplate|serializeAtlasTemplate|writeAtlasTemplateExport/i);
  assert.doesNotMatch(render, /Publish to Atlas|publishToAtlas|publishAtlasStatblock/i);
  assert.doesNotMatch(repository, /\.atlastemplate|serializeAtlasTemplate|exportAtlasTemplate|writeAtlasTemplateExport/i);
  assert.match(capabilities, /origem somente leitura/);
  assert.match(capabilities, /não grava nem exporta templates/i);

  for (const removedPath of [
    'src/atlas/atlasStatblockPublisher.ts',
    'src/atlas/atlasStatblockFormat.ts',
    'src/atlas/atlasTemplateLifecycle.ts',
  ]) {
    await assert.rejects(access(resolve(root, removedPath)));
  }
});
