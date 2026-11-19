import assert from 'node:assert/strict';
import test from 'node:test';
import {
  persistAtlasRestResourceChangesWithReceipt,
  rollbackAtlasRestResourceChanges,
} from '../src/atlas/atlasRestResources.ts';

function makeStore(tokens, partyValues = {}) {
  let state = {
    objects: { tokens: structuredClone(tokens) },
    partyValues: structuredClone(partyValues),
    updateTokens(entries) {
      const next = { ...state.objects.tokens };
      for (const entry of entries) next[entry.id] = { ...next[entry.id], ...structuredClone(entry.changes) };
      state = { ...state, objects: { tokens: next } };
    },
  };
  return {
    getState: () => state,
    setState(partial) { state = { ...state, ...partial }; },
  };
}

function tokenContext({ aMax = 20, bMax = 30, bManual = true } = {}) {
  const tokens = {
    a: { id: 'a', resources: { hp: { current: 4, max: aMax } } },
    b: {
      id: 'b',
      resources: { hp: { current: 10, max: bMax } },
      ...(bManual ? { overriddenMax: ['hp'] } : {}),
    },
  };
  const store = makeStore(tokens);
  const resource = {
    key: 'hp', name: 'HP', field: 'hp', direction: 'drains',
    current: 4, max: aMax, holder: 'token',
    tokenEntries: [
      { store, tokenId: 'a', value: { current: 4, max: aMax }, rawValue: { current: 4, max: aMax }, overriddenMax: undefined },
      { store, tokenId: 'b', value: { current: 10, max: bMax }, rawValue: { current: 10, max: bMax }, overriddenMax: bManual ? ['hp'] : undefined },
    ],
  };
  const context = {
    characterAssetId: 'pc-1', characterName: 'Ayla', collectionId: 'heroes',
    resources: [resource], stores: [{ store, tokenIds: ['a', 'b'] }],
  };
  return { store, context };
}

test('partial rest updates current values while retaining every form maximum', () => {
  const { store, context } = tokenContext();
  const commit = persistAtlasRestResourceChangesWithReceipt(context, [
    { resourceKey: 'hp', from: 4, to: 8, max: 20, direction: 'down' },
  ]);

  assert.equal(commit.updated, 2);
  assert.deepEqual(store.getState().objects.tokens.a.resources.hp, { current: 8, max: 20 });
  assert.deepEqual(store.getState().objects.tokens.b.resources.hp, { current: 8, max: 30 });
  assert.deepEqual(store.getState().objects.tokens.b.overriddenMax, ['hp']);
});

test('a non-manual form maximum is preserved without creating an override marker', () => {
  const { store, context } = tokenContext({ bManual: false });
  persistAtlasRestResourceChangesWithReceipt(context, [
    { resourceKey: 'hp', from: 4, to: 8, max: 20, direction: 'down' },
  ]);

  assert.deepEqual(store.getState().objects.tokens.b.resources.hp, { current: 8, max: 30 });
  assert.equal(store.getState().objects.tokens.b.overriddenMax, undefined);
});

test('full rest reaches each form maximum and leaves manual-maximum markers intact', () => {
  const { store, context } = tokenContext();
  const commit = persistAtlasRestResourceChangesWithReceipt(context, [
    { resourceKey: 'hp', from: 4, to: 20, max: 20, direction: 'down' },
  ]);

  assert.equal(commit.updated, 2);
  assert.deepEqual(store.getState().objects.tokens.a.resources.hp, { current: 20, max: 20 });
  assert.deepEqual(store.getState().objects.tokens.b.resources.hp, { current: 30, max: 30 });
  assert.deepEqual(store.getState().objects.tokens.b.overriddenMax, ['hp']);
});

test('rollback restores the exact per-form values after a rest commit', () => {
  const { store, context } = tokenContext();
  const before = structuredClone(store.getState().objects.tokens);
  const commit = persistAtlasRestResourceChangesWithReceipt(context, [
    { resourceKey: 'hp', from: 4, to: 20, max: 20, direction: 'down' },
  ]);

  rollbackAtlasRestResourceChanges(commit.receipt);
  assert.deepEqual(store.getState().objects.tokens, before);
});

test('a filling Resource fully recovers to zero without changing form-specific maxima', () => {
  const tokens = {
    a: { id: 'a', resources: { stress: { current: 5, max: 6 } } },
    b: { id: 'b', resources: { stress: { current: 4, max: 9 } }, overriddenMax: ['stress'] },
  };
  const store = makeStore(tokens);
  const context = {
    characterAssetId: 'pc-1', characterName: 'Ayla', collectionId: 'heroes',
    resources: [{
      key: 'stress', name: 'Stress', field: 'stress', direction: 'fills', current: 5, max: 6, holder: 'token',
      tokenEntries: [
        { store, tokenId: 'a', value: { current: 5, max: 6 }, rawValue: { current: 5, max: 6 }, overriddenMax: undefined },
        { store, tokenId: 'b', value: { current: 4, max: 9 }, rawValue: { current: 4, max: 9 }, overriddenMax: ['stress'] },
      ],
    }],
    stores: [{ store, tokenIds: ['a', 'b'] }],
  };

  persistAtlasRestResourceChangesWithReceipt(context, [
    { resourceKey: 'stress', from: 5, to: 0, max: 6, direction: 'up' },
  ]);

  assert.deepEqual(store.getState().objects.tokens.a.resources.stress, { current: 0, max: 6 });
  assert.deepEqual(store.getState().objects.tokens.b.resources.stress, { current: 0, max: 9 });
  assert.deepEqual(store.getState().objects.tokens.b.overriddenMax, ['stress']);
});

test('a stale token value aborts before any form is changed', () => {
  const { store, context } = tokenContext();
  store.getState().updateTokens([{ id: 'b', changes: { resources: { hp: { current: 11, max: 30 } } } }]);

  assert.throws(() => persistAtlasRestResourceChangesWithReceipt(context, [
    { resourceKey: 'hp', from: 4, to: 20, max: 20, direction: 'down' },
  ]), /mudou desde o cálculo/);
  assert.deepEqual(store.getState().objects.tokens.a.resources.hp, { current: 4, max: 20 });
  assert.deepEqual(store.getState().objects.tokens.b.resources.hp, { current: 11, max: 30 });
});
