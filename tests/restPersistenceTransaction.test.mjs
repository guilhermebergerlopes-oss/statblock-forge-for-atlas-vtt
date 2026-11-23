import assert from 'node:assert/strict';
import test from 'node:test';
import { runRestNotePersistenceWithAtlasRollback } from '../src/statblocks/restPersistenceTransaction.ts';
import {
  persistAtlasRestResourceChangesWithReceipt,
  rollbackAtlasRestResourceChanges,
} from '../src/atlas/atlasRestResources.ts';

function makeStore() {
  let state = {
    mapLoaded: true,
    isMapLoading: false,
    isPlayerView: false,
    mapPath: 'atlas-vtt/collections/heroes/scenes/test.atlasmap',
    objects: { tokens: { hero: { id: 'hero', resources: { hp: { current: 4, max: 20 } } } } },
    updateTokens(entries) {
      const tokens = { ...state.objects.tokens };
      for (const entry of entries) tokens[entry.id] = { ...tokens[entry.id], ...structuredClone(entry.changes) };
      state = { ...state, objects: { tokens } };
    },
  };
  return { getState: () => state };
}

function makeContext(store) {
  return {
    characterAssetId: 'pc-1', characterName: 'Ayla', collectionId: 'heroes',
    resources: [{
      key: 'hp', name: 'Health', field: 'hp', direction: 'drains', current: 4, max: 20, holder: 'token',
      tokenEntries: [{
        store, mapPath: 'atlas-vtt/collections/heroes/scenes/test.atlasmap', tokenId: 'hero', value: { current: 4, max: 20 },
        rawValue: { current: 4, max: 20 }, overriddenMax: undefined,
      }],
    }],
    stores: [{ store, tokenIds: ['hero'], mapPath: 'atlas-vtt/collections/heroes/scenes/test.atlasmap' }],
  };
}

function commitAtlas(store, registerReceipt) {
  const commit = persistAtlasRestResourceChangesWithReceipt(makeContext(store), [
    { resourceKey: 'hp', from: 4, to: 12, max: 20, direction: 'down' },
  ]);
  registerReceipt(commit.receipt);
  return commit;
}

test('successful note persistence keeps the Atlas commit and does not roll it back', async () => {
  const store = makeStore();
  let note = { hp: 4 };
  let rollbackCalls = 0;
  await runRestNotePersistenceWithAtlasRollback(async (registerReceipt) => {
    commitAtlas(store, registerReceipt);
    note = { hp: 12 };
  }, (receipt) => {
    rollbackCalls += 1;
    rollbackAtlasRestResourceChanges(receipt);
  });

  assert.deepEqual(note, { hp: 12 });
  assert.deepEqual(store.getState().objects.tokens.hero.resources.hp, { current: 12, max: 20 });
  assert.equal(rollbackCalls, 0);
});

test('Markdown/frontmatter persistence failure compensates the Atlas Resource commit', async () => {
  const store = makeStore();
  const before = structuredClone(store.getState().objects.tokens);
  const note = { hp: 4 };
  await assert.rejects(runRestNotePersistenceWithAtlasRollback(async (registerReceipt) => {
    // Models processFrontMatter: its callback ran and the Atlas commit succeeded, but the
    // outer file write rejected after the callback returned.
    commitAtlas(store, registerReceipt);
    throw new Error('simulated frontmatter write failure');
  }, rollbackAtlasRestResourceChanges), /simulated frontmatter write failure/);

  assert.deepEqual(note, { hp: 4 });
  assert.deepEqual(store.getState().objects.tokens, before);
});

test('JSON vault.process failure compensates the Atlas Resource commit', async () => {
  const store = makeStore();
  const before = structuredClone(store.getState().objects.tokens);
  const originalJson = '{"hp":4}\n';
  let persistedJson = originalJson;
  await assert.rejects(runRestNotePersistenceWithAtlasRollback(async (registerReceipt) => {
    const parsed = JSON.parse(originalJson);
    commitAtlas(store, registerReceipt);
    parsed.hp = 12;
    const nextJson = `${JSON.stringify(parsed, null, 2)}\n`;
    assert.match(nextJson, /"hp": 12/);
    throw new Error('simulated JSON vault write failure');
  }, rollbackAtlasRestResourceChanges), /simulated JSON vault write failure/);

  assert.equal(persistedJson, originalJson);
  assert.deepEqual(store.getState().objects.tokens, before);
});

test('a validation or calculation error before an Atlas receipt does not invoke rollback', async () => {
  let rollbackCalls = 0;
  await assert.rejects(runRestNotePersistenceWithAtlasRollback(async () => {
    throw new Error('invalid Rest choice');
  }, () => { rollbackCalls += 1; }), /invalid Rest choice/);
  assert.equal(rollbackCalls, 0);
});

test('an Atlas commit failure before receipt registration is propagated without a second rollback', async () => {
  let rollbackCalls = 0;
  await assert.rejects(runRestNotePersistenceWithAtlasRollback(async () => {
    // The Atlas commit owns compensation for failures occurring during its own multi-store write.
    throw new Error('Atlas commit already compensated its partial write');
  }, () => { rollbackCalls += 1; }), /already compensated/);
  assert.equal(rollbackCalls, 0);
});

test('rollback failure reports both the original note error and the compensation error', async () => {
  await assert.rejects(runRestNotePersistenceWithAtlasRollback(async (registerReceipt) => {
    registerReceipt({ id: 'receipt-1' });
    throw new Error('note write failed');
  }, () => { throw new Error('Atlas state changed after commit'); }), (error) => {
    assert.match(error.message, /note write failed/);
    assert.match(error.message, /Atlas state changed after commit/);
    return true;
  });
});

test('a Rest persistence attempt cannot register multiple Atlas commit receipts', async () => {
  let rolledBack = null;
  await assert.rejects(runRestNotePersistenceWithAtlasRollback(async (registerReceipt) => {
    registerReceipt({ id: 'first' });
    registerReceipt({ id: 'second' });
  }, (receipt) => { rolledBack = receipt; }), /mais de um recibo/);
  assert.deepEqual(rolledBack, { id: 'first' });
});
