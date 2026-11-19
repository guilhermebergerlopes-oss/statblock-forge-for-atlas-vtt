import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ATLAS_CREATE_TOKEN_FROM_STATBLOCK_COMMAND,
  assessAtlasTokenCreation,
  dispatchAtlasCreateTokenCommand,
  normalizeAtlasImageReference,
} from '../src/atlas/atlasTokenWorkflow.ts';

function note(path = 'Bestiary/Wolf.md', extension = 'md') { return { path, extension }; }
function app({ frontmatter = {}, image = { path: 'Bestiary/wolf.webp', extension: 'webp' }, commands } = {}) {
  return {
    metadataCache: {
      getFileCache: () => ({ frontmatter }),
      getFirstLinkpathDest: (path) => path === image?.path ? image : null,
    },
    vault: { getAbstractFileByPath: (path) => path === image?.path ? image : null },
    ...(commands ? { commands } : {}),
  };
}

test('normalizes plain paths, wikilinks, Markdown links and Atlas encoded links', () => {
  assert.deepEqual(normalizeAtlasImageReference('Bestiary/Wolf.webp'), { kind: 'vault', path: 'Bestiary/Wolf.webp' });
  assert.deepEqual(normalizeAtlasImageReference('![[Bestiary/Wolf.webp|Wolf]]'), { kind: 'vault', path: 'Bestiary/Wolf.webp' });
  assert.deepEqual(normalizeAtlasImageReference('[Wolf](Bestiary/Wolf%20Portrait.webp)'), { kind: 'vault', path: 'Bestiary/Wolf Portrait.webp' });
  assert.deepEqual(normalizeAtlasImageReference('<STATBLOCK-WIKI-LINK>Bestiary/Wolf.webp|Wolf<STATBLOCK-WIKI-LINK>'), { kind: 'vault', path: 'Bestiary/Wolf.webp' });
  assert.deepEqual(normalizeAtlasImageReference('<STATBLOCK-MARKDOWN-LINK>Bestiary/Wolf%20Portrait.webp<STATBLOCK-MARKDOWN-LINK>'), { kind: 'vault', path: 'Bestiary/Wolf Portrait.webp' });
});

test('distinguishes empty and remote images from Vault paths', () => {
  assert.deepEqual(normalizeAtlasImageReference(null), { kind: 'empty' });
  assert.deepEqual(normalizeAtlasImageReference(['', '  ']), { kind: 'empty' });
  assert.deepEqual(normalizeAtlasImageReference('https://example.test/wolf.webp'), { kind: 'remote', reference: 'https://example.test/wolf.webp' });
  assert.deepEqual(normalizeAtlasImageReference('data:image/png;base64,AAAA'), { kind: 'remote', reference: 'data:image/png;base64,AAAA' });
});

test('requires a Markdown Atlas statblock and a local supported image', () => {
  assert.equal(assessAtlasTokenCreation(app({ frontmatter: { image: 'Bestiary/wolf.webp' } }), note()).status, 'not-statblock');
  assert.equal(assessAtlasTokenCreation(app({ frontmatter: { statblock: true } }), note()).status, 'missing-image');
  assert.equal(assessAtlasTokenCreation(app({ frontmatter: { statblock: true, image: 'https://example.test/wolf.webp' } }), note()).status, 'remote-image');
  assert.equal(assessAtlasTokenCreation(app({ frontmatter: { statblock: true, image: 'Bestiary/missing.webp' }, image: null }), note()).status, 'image-not-found');
  assert.equal(assessAtlasTokenCreation(app({ frontmatter: { statblock: true, image: 'Bestiary/readme.md' }, image: { path: 'Bestiary/readme.md', extension: 'md' } }), note()).status, 'unsupported-image');
  assert.equal(assessAtlasTokenCreation(app({ frontmatter: { statblock: true, image: 'Bestiary/wolf.webp' } }), note('Bestiary/Wolf.forgetemplate', 'forgetemplate')).status, 'not-statblock');
});

test('reports direct Atlas command access only when the documented command is registered', () => {
  const commands = {
    listCommands: () => [{ id: ATLAS_CREATE_TOKEN_FROM_STATBLOCK_COMMAND }],
    executeCommandById: () => true,
  };
  const result = assessAtlasTokenCreation(app({ frontmatter: { statblock: true, image: 'Bestiary/wolf.webp' }, commands }), note());
  assert.deepEqual(result, {
    status: 'ready', imagePath: 'Bestiary/wolf.webp', commandAccess: 'direct',
    commandName: 'Atlas VTT: Create token from statblock image',
  });
});

test('falls back to manual command execution when Obsidian does not expose command dispatch', () => {
  const result = assessAtlasTokenCreation(app({ frontmatter: { statblock: 'inline', image: 'Bestiary/wolf.webp' } }), note());
  assert.equal(result.status, 'ready');
  if (result.status === 'ready') assert.equal(result.commandAccess, 'manual');
});

test('uses fallback publication data before metadata cache catches up', () => {
  const result = assessAtlasTokenCreation(app({ frontmatter: {} }), note(), {
    statblock: true, image: 'Bestiary/wolf.webp', name: 'Wolf',
  }, true);
  assert.equal(result.status, 'ready');
});

test('dispatches only Atlas public command and reports unavailable, rejected and throwing bridges', () => {
  const calls = [];
  const ready = {
    commands: {
      listCommands: () => [{ id: ATLAS_CREATE_TOKEN_FROM_STATBLOCK_COMMAND }],
      executeCommandById(id) { calls.push(id); return true; },
    },
  };
  assert.deepEqual(dispatchAtlasCreateTokenCommand(ready), { status: 'dispatched' });
  assert.deepEqual(calls, [ATLAS_CREATE_TOKEN_FROM_STATBLOCK_COMMAND]);
  assert.deepEqual(dispatchAtlasCreateTokenCommand({}), { status: 'dispatch-unavailable' });
  assert.deepEqual(dispatchAtlasCreateTokenCommand({ commands: { listCommands: () => [] } }), { status: 'command-unavailable' });
  assert.deepEqual(dispatchAtlasCreateTokenCommand({ commands: {
    listCommands: () => [{ id: ATLAS_CREATE_TOKEN_FROM_STATBLOCK_COMMAND }],
    executeCommandById: () => false,
  } }), { status: 'rejected' });
  assert.deepEqual(dispatchAtlasCreateTokenCommand({ commands: {
    listCommands: () => [{ id: ATLAS_CREATE_TOKEN_FROM_STATBLOCK_COMMAND }],
    executeCommandById: () => { throw new Error('bridge failed'); },
  } }), { status: 'failed', message: 'bridge failed' });
});
