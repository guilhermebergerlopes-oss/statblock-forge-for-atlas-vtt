import assert from 'node:assert/strict';
import test from 'node:test';
import { auditForgeRelease } from '../scripts/audit-release.mjs';

test('final release audit confirms Atlas-native runtime and Forge 0.5.1 identity', () => {
  const report = auditForgeRelease();
  assert.equal(report.ok, true, report.errors.join('\n'));
  assert.equal(report.pluginId, 'statblock-forge');
  assert.equal(report.version, '0.5.1');
  assert.equal(report.forkDependencies, 0);
  assert.equal(report.legacyRuntimeMatches, 0);
  assert.equal(report.missingImports, 0);
  assert.equal(report.lifecycleCleanupRegistered, true);
  assert.equal(report.buildEntryPoint, true);
});

test('final release audit resolves the entire relative source import graph', () => {
  const report = auditForgeRelease();
  assert.ok(report.productionFiles > 100);
  assert.ok(report.relativeImports > 500);
  assert.equal(report.missingImports, 0);
});
