import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/views/StatblockRenderSurface.ts', import.meta.url), 'utf8');

test('Markdown and JSON Rest writes run inside the Atlas compensation coordinator', () => {
  assert.match(source, /runRestNotePersistenceWithAtlasRollback\(async \(registerAtlasReceipt\) =>/);
  assert.match(source, /processFrontMatter\(sourceFile, \(frontmatter\) =>[\s\S]*?calculate\(frontmatter, registerAtlasReceipt\)/);
  assert.match(source, /vault\.process\(sourceFile, \(contents\) =>[\s\S]*?calculate\(target, registerAtlasReceipt\)/);
  assert.match(source, /\}, rollbackAtlasRestResourceChanges\);/);
});

test('a post-commit view refresh failure is reported as a warning, not a failed save', () => {
  const refreshStart = source.indexOf('let refreshWarning:');
  const refreshEnd = source.indexOf('if (refreshWarning) warningLabels.push(refreshWarning);', refreshStart);
  const refreshBlock = source.slice(refreshStart, refreshEnd);
  assert.match(refreshBlock, /try \{\s*await this\.refresh\(\);\s*\} catch \(error\)/);
  assert.match(refreshBlock, /Values were saved, but the statblock view could not be refreshed/);
  assert.ok(source.includes('if (refreshWarning) warningLabels.push(refreshWarning);'));
});

test('the result modal resolves spend labels from the data calculated from the latest note snapshot', () => {
  assert.match(source, /const spendLabels = new Map\(restCounterSpendOptions\(\{[\s\S]*?data: result\.data,[\s\S]*?collectionResources: atlasResourceContextState\.value\?\.resources \?\? \[\],[\s\S]*?\}\)\.map/);
});
