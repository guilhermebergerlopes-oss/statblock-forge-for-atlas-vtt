import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('plugin starts the Atlas Role template mirror service during load and stops it on unload', async () => {
  const source = await readFile(new URL('main.ts', root), 'utf8');
  assert.match(source, /import\s*\{\s*AtlasNativeRoleTemplateSync\s*\}\s*from\s*['"]\.\/src\/atlas\/atlasNativeTemplateBridge\.ts['"]/);
  assert.match(source, /new\s+AtlasNativeRoleTemplateSync\(this\.app,\s*\(\)\s*=>\s*this\.statblockNotePanels\?\.refresh\(\)\)/);
  assert.match(source, /atlasRoleTemplateSync\.start\(\)/);
  assert.match(source, /this\.register\(\(\)\s*=>\s*atlasRoleTemplateSync\.stop\(\)\)/);
});

test('successful Template Editor saves publish or refresh the matching Atlas Role template', async () => {
  const source = await readFile(new URL('src/views/TemplateEditorView.ts', root), 'utf8');
  assert.match(source, /import\s*\{\s*ensureAtlasNativeTemplateMirror\s*\}\s*from\s*['"]\.\.\/atlas\/atlasNativeTemplateBridge\.ts['"]/);
  assert.match(source, /await\s+ensureAtlasNativeTemplateMirror\(this\.app,\s*savedAbstract\)/);
});
