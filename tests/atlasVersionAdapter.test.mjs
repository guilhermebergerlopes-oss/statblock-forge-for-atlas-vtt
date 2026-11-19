import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ATLAS_VERIFIED_SNAPSHOT,
  compareSemanticVersions,
  isVersionInRange,
  parseSemanticVersion,
  resolveAtlasVersionAdapter,
} from '../src/atlas/atlasVersionAdapter.ts';

test('parses strict semantic versions with optional v prefix, prerelease and build metadata', () => {
  assert.deepEqual(parseSemanticVersion('v0.13.2-beta.0+local.7'), {
    major: 0,
    minor: 13,
    patch: 2,
    prerelease: ['beta', '0'],
  });
  assert.deepEqual(parseSemanticVersion('1.2.3'), {
    major: 1,
    minor: 2,
    patch: 3,
    prerelease: [],
  });
});

test('rejects malformed semantic versions and unsafe numeric components', () => {
  for (const invalid of [
    '', '  ', '1', '1.2', '01.2.3', '1.02.3', '1.2.03',
    '1.2.3-', '1.2.3+build..2', '1.2.3-alpha..beta',
    '1.2.3-alpha.01', '9007199254740992.0.0',
  ]) {
    assert.equal(parseSemanticVersion(invalid), null, invalid);
  }
});

test('compares release and prerelease identifiers using semantic precedence', () => {
  assert.equal(compareSemanticVersions('1.0.0-alpha', '1.0.0'), -1);
  assert.equal(compareSemanticVersions('1.0.0-alpha.2', '1.0.0-alpha.10'), -1);
  assert.equal(compareSemanticVersions('1.0.0-alpha.10', '1.0.0-alpha.beta'), -1);
  assert.equal(compareSemanticVersions('1.0.0+build.1', '1.0.0+build.2'), 0);
  assert.equal(compareSemanticVersions('not-a-version', '1.0.0'), null);
});

test('range checks include both endpoints and reject invalid bounds', () => {
  const range = { minInclusive: '0.13.2-beta.0', maxInclusive: '0.13.2-beta.0' };
  assert.equal(isVersionInRange(ATLAS_VERIFIED_SNAPSHOT, range), true);
  assert.equal(isVersionInRange('0.13.2', range), false);
  assert.equal(isVersionInRange('invalid', range), false);
  assert.equal(isVersionInRange(ATLAS_VERIFIED_SNAPSHOT, { minInclusive: 'x', maxInclusive: 'y' }), false);
});

test('only the inspected snapshot receives verified file-format compatibility', () => {
  const verified = resolveAtlasVersionAdapter(`v${ATLAS_VERIFIED_SNAPSHOT}`);
  assert.equal(verified.kind, 'verified-version');
  assert.equal(verified.templateFiles, 'verified');
  assert.equal(verified.runtimeMode, 'standalone');
  assert.deepEqual(verified.runtimeHooks, []);

  const newer = resolveAtlasVersionAdapter('0.16.0');
  assert.equal(newer.kind, 'generic-file-only');
  assert.equal(newer.templateFiles, 'best-effort');
  assert.equal(newer.runtimeMode, 'standalone');
  assert.deepEqual(newer.runtimeHooks, []);
});

test('missing and invalid Atlas versions stay standalone without activating runtime hooks', () => {
  for (const version of [null, undefined, '', 'not-semver']) {
    const result = resolveAtlasVersionAdapter(version);
    assert.equal(result.kind, 'standalone');
    assert.equal(result.templateFiles, 'standalone');
    assert.equal(result.runtimeMode, 'standalone');
    assert.deepEqual(result.runtimeHooks, []);
  }
});
