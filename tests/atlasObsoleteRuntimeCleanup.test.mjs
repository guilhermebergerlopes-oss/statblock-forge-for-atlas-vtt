import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = new URL('../', import.meta.url).pathname;
const retiredModules = [
  'src/atlas/atlasStatus.ts',
  'src/atlas/atlasTokenIntegrationDiagnostics.ts',
  'src/atlas/atlasTokenViewportAccess.ts',
];

test('retired Atlas-only diagnostics modules remain removed', () => {
  for (const relative of retiredModules) {
    assert.equal(existsSync(join(root, relative)), false, `${relative} should remain removed`);
  }
});

test('active source has no imports or references to retired diagnostics modules', () => {
  const sourceRoot = join(root, 'src');
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && /\.tsx?$/.test(entry.name)) files.push(path);
    }
  };
  visit(sourceRoot);
  const source = files.map((file) => readFileSync(file, 'utf8')).join('\n');
  assert.doesNotMatch(source, /atlasStatus|atlasTokenIntegrationDiagnostics|atlasTokenViewportAccess|getAtlasTokenAdapterDiagnostics/);
});

test('Atlas integration overview describes inspected baselines and forward-compatible runtime checks', () => {
  const english = readFileSync(join(root, 'docs/user-guide/en/01 - Overview.md'), 'utf8');
  const portugueseDocs = readdirSync(join(root, 'docs/user-guide/pt-BR'))
    .filter((name) => name.startsWith('01 - ') && name.endsWith('.md'))
    .map((name) => readFileSync(join(root, 'docs/user-guide/pt-BR', name), 'utf8'));
  const embeddedEnglish = readFileSync(join(root, 'src/documentation/documentationPackage.en.ts'), 'utf8');
  const embeddedPortuguese = readFileSync(join(root, 'src/documentation/documentationPackage.ts'), 'utf8');
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  assert.match(english, /inspected 0\.17\.0 and 0\.18\.0 source snapshots as baselines/);
  assert.match(english, /Newer Atlas versions are not blocked by an exact-version allowlist/);
  assert.match(english, /rather than a general public plugin API/);
  assert.doesNotMatch(english, /Exact compatibility depends on the installed version and available public API/);
  assert.match(embeddedEnglish, /inspected 0\.17\.0 and 0\.18\.0 source snapshots as baselines/);
  assert.match(embeddedPortuguese, /códigos-fonte inspecionados das versões 0\.17\.0 e 0\.18\.0 como bases/);
  assert.ok(portugueseDocs.length > 0);
  for (const portuguese of portugueseDocs) {
    assert.match(portuguese, /códigos-fonte inspecionados das versões 0\.17\.0 e 0\.18\.0 como bases/);
    assert.match(portuguese, /Versões posteriores não são bloqueadas por uma lista de versões exatas/);
    assert.doesNotMatch(portuguese, /API pública disponível/);
  }
  assert.match(readme, /newer Atlas versions are not blocked by an exact-version allowlist/);
  assert.match(readme, /runtime methods and service capabilities required by each feature/);
});
