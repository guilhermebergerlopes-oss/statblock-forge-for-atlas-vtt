import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ATLAS_0170_RUNTIME_HOOKS,
  ATLAS_0180_RUNTIME_HOOKS,
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
  const range = { minInclusive: '0.18.0', maxInclusive: '0.18.0' };
  assert.equal(isVersionInRange(ATLAS_VERIFIED_SNAPSHOT, range), true);
  assert.equal(isVersionInRange('0.18.1', range), false);
  assert.equal(isVersionInRange('invalid', range), false);
  assert.equal(isVersionInRange(ATLAS_VERIFIED_SNAPSHOT, { minInclusive: 'x', maxInclusive: 'y' }), false);
});

test('uses exact profiles for inspected snapshots and enables later versions through forward-compatible baselines', () => {
  const legacy = resolveAtlasVersionAdapter('0.17.0');
  assert.equal(legacy.kind, 'verified-version');
  assert.equal(legacy.adapterId, 'atlas-0.17.0-internal-runtime');
  assert.deepEqual(legacy.runtimeHooks, ATLAS_0170_RUNTIME_HOOKS);

  const latest = resolveAtlasVersionAdapter(`v${ATLAS_VERIFIED_SNAPSHOT}`);
  assert.equal(ATLAS_VERIFIED_SNAPSHOT, '0.18.0');
  assert.equal(latest.kind, 'verified-version');
  assert.equal(latest.adapterId, 'atlas-0.18.0-internal-runtime');
  assert.equal(latest.label, 'Atlas 0.18.0 — runtime interno verificado');
  assert.equal(latest.templateFiles, 'verified');
  assert.equal(latest.runtimeMode, 'internal-runtime');
  assert.deepEqual(latest.runtimeHooks, ATLAS_0180_RUNTIME_HOOKS);
  assert.ok(latest.runtimeHooks.includes("Workspace.getLeavesOfType('atlas-vtt')"));
  assert.ok(latest.runtimeHooks.includes('NotePreviewUIManager.showOrCreatePreview()'));
  assert.ok(latest.runtimeHooks.includes('TypedEventEmitter.on()/off()'));
  assert.ok(latest.runtimeHooks.includes('DiceTool written adv/dis formula handling'));

  for (const version of ['0.17.1', '0.18.1', '0.19.0', '1.0.0', '2.4.3', 'v0.19.0-beta.1']) {
    const newer = resolveAtlasVersionAdapter(version);
    assert.equal(newer.kind, 'forward-compatible-version', version);
    assert.equal(newer.templateFiles, 'best-effort');
    assert.equal(newer.runtimeMode, 'internal-runtime');
    assert.equal(newer.verifiedRange, null);
    assert.ok(newer.adapterId.startsWith('atlas-forward-compatible-'));
    assert.ok(newer.explanation.includes('métodos e serviços necessários'));
    assert.deepEqual(newer.runtimeHooks, version.includes('0.17.')
      ? ATLAS_0170_RUNTIME_HOOKS : ATLAS_0180_RUNTIME_HOOKS);
  }

  const older = resolveAtlasVersionAdapter('0.16.9');
  assert.equal(older.kind, 'generic-file-only');
  assert.equal(older.runtimeMode, 'standalone');
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
