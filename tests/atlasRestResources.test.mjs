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

test('partial multi-map commit failure rolls back maps already written and the failing map if it mutated first', () => {
  function failingStore(token, failAfterWrite = false) {
    let state = { objects: { tokens: structuredClone(token) } };
    let shouldFail = failAfterWrite;
    state.updateTokens = (entries) => {
      const next = { ...state.objects.tokens };
      for (const entry of entries) next[entry.id] = { ...next[entry.id], ...structuredClone(entry.changes) };
      state = { ...state, objects: { tokens: next }, updateTokens: state.updateTokens };
      if (shouldFail) {
        shouldFail = false;
        throw new Error('simulated map write failure after mutation');
      }
    };
    return { getState: () => state };
  }

  const first = failingStore({ a: { id: 'a', resources: { hp: { current: 4, max: 20 } } } });
  const second = failingStore({ b: { id: 'b', resources: { hp: { current: 10, max: 30 } }, overriddenMax: ['hp'] } }, true);
  const context = {
    characterAssetId: 'pc-1', characterName: 'Ayla', collectionId: 'heroes',
    resources: [{
      key: 'hp', name: 'HP', field: 'hp', direction: 'drains', current: 4, max: 20, holder: 'token',
      tokenEntries: [
        { store: first, tokenId: 'a', value: { current: 4, max: 20 }, rawValue: { current: 4, max: 20 }, overriddenMax: undefined },
        { store: second, tokenId: 'b', value: { current: 10, max: 30 }, rawValue: { current: 10, max: 30 }, overriddenMax: ['hp'] },
      ],
    }],
    stores: [{ store: first, tokenIds: ['a'] }, { store: second, tokenIds: ['b'] }],
  };
  const beforeFirst = structuredClone(first.getState().objects.tokens);
  const beforeSecond = structuredClone(second.getState().objects.tokens);

  assert.throws(() => persistAtlasRestResourceChangesWithReceipt(context, [
    { resourceKey: 'hp', from: 4, to: 20, max: 20, direction: 'down' },
  ]), /simulated map write failure/);
  assert.deepEqual(first.getState().objects.tokens, beforeFirst);
  assert.deepEqual(second.getState().objects.tokens, beforeSecond);
});

test('preflight rejects a map without updateTokens before mutating any other map', () => {
  const { store: first } = tokenContext();
  const second = {
    getState: () => ({ objects: { tokens: { c: { id: 'c', resources: { hp: { current: 6, max: 20 } } } } } }),
  };
  const originalFirst = structuredClone(first.getState().objects.tokens);
  const context = {
    characterAssetId: 'pc-1', characterName: 'Ayla', collectionId: 'heroes',
    resources: [{
      key: 'hp', name: 'HP', field: 'hp', direction: 'drains', current: 4, max: 20, holder: 'token',
      tokenEntries: [
        { store: first, tokenId: 'a', value: { current: 4, max: 20 }, rawValue: { current: 4, max: 20 }, overriddenMax: undefined },
        { store: second, tokenId: 'c', value: { current: 6, max: 20 }, rawValue: { current: 6, max: 20 }, overriddenMax: undefined },
      ],
    }],
    stores: [{ store: first, tokenIds: ['a', 'b'] }, { store: second, tokenIds: ['c'] }],
  };

  assert.throws(() => persistAtlasRestResourceChangesWithReceipt(context, [
    { resourceKey: 'hp', from: 4, to: 8, max: 20, direction: 'down' },
  ]), /não oferece updateTokens/);
  assert.deepEqual(first.getState().objects.tokens, originalFirst);
});

test('partial PartySync write failure restores every party store already changed', () => {
  const partyKey = JSON.stringify(['campaign', 'pc-1', 'hp']);
  function partyStore(failAfterWrite = false) {
    let state = { partyValues: { [partyKey]: { current: 4, max: 20, maxByHand: true } } };
    let shouldFail = failAfterWrite;
    return {
      getState: () => state,
      setState(partial) {
        state = { ...state, ...structuredClone(partial) };
        if (shouldFail) {
          shouldFail = false;
          throw new Error('simulated PartySync failure after mutation');
        }
      },
    };
  }
  const first = partyStore();
  const second = partyStore(true);
  const before = [structuredClone(first.getState().partyValues), structuredClone(second.getState().partyValues)];
  const context = {
    characterAssetId: 'pc-1', characterName: 'Ayla', collectionId: 'heroes', stores: [],
    resources: [{
      key: 'hp', name: 'HP', field: 'hp', direction: 'drains', current: 4, max: 20, holder: 'party',
      partyKey,
      partyEntries: [
        { store: first, key: partyKey, current: 4, max: 20, maxByHand: true, rawValue: { current: 4, max: 20, maxByHand: true } },
        { store: second, key: partyKey, current: 4, max: 20, maxByHand: true, rawValue: { current: 4, max: 20, maxByHand: true } },
      ],
    }],
  };

  assert.throws(() => persistAtlasRestResourceChangesWithReceipt(context, [
    { resourceKey: 'hp', from: 4, to: 20, max: 20, direction: 'down' },
  ]), /simulated PartySync failure/);
  assert.deepEqual(first.getState().partyValues, before[0]);
  assert.deepEqual(second.getState().partyValues, before[1]);
});

test('rollback refuses to overwrite a Resource edited after the rest commit', () => {
  const { store, context } = tokenContext();
  const commit = persistAtlasRestResourceChangesWithReceipt(context, [
    { resourceKey: 'hp', from: 4, to: 8, max: 20, direction: 'down' },
  ]);
  store.getState().updateTokens([{ id: 'a', changes: { resources: { hp: { current: 12, max: 20 } } } }]);

  assert.throws(() => rollbackAtlasRestResourceChanges(commit.receipt), /mudou após a gravação/);
  assert.deepEqual(store.getState().objects.tokens.a.resources.hp, { current: 12, max: 20 });
});

test('multiple token Resources are written once per map and rollback preserves unrelated values', () => {
  const first = makeStore({ hero: { id: 'hero', resources: {
    hp: { current: 4, max: 20 }, stress: { current: 6, max: 8 }, focus: { current: 2, max: 5 },
  } } });
  const second = makeStore({ alternate: { id: 'alternate', resources: {
    hp: { current: 10, max: 30 }, stress: { current: 3, max: 9 }, focus: { current: 1, max: 4 },
  }, overriddenMax: ['hp', 'stress'] } });
  const updateCalls = new Map([[first, 0], [second, 0]]);
  for (const store of [first, second]) {
    const original = store.getState().updateTokens;
    store.getState().updateTokens = (entries) => {
      updateCalls.set(store, updateCalls.get(store) + 1);
      original(entries);
    };
  }
  const context = {
    characterAssetId: 'pc-1', characterName: 'Ayla', collectionId: 'heroes',
    resources: [
      {
        key: 'hp', name: 'HP', field: 'hp', direction: 'drains', current: 4, max: 20, holder: 'token',
        tokenEntries: [
          { store: first, tokenId: 'hero', value: { current: 4, max: 20 }, rawValue: { current: 4, max: 20 }, overriddenMax: undefined },
          { store: second, tokenId: 'alternate', value: { current: 10, max: 30 }, rawValue: { current: 10, max: 30 }, overriddenMax: ['hp', 'stress'] },
        ],
      },
      {
        key: 'stress', name: 'Stress', field: 'stress', direction: 'fills', current: 6, max: 8, holder: 'token',
        tokenEntries: [
          { store: first, tokenId: 'hero', value: { current: 6, max: 8 }, rawValue: { current: 6, max: 8 }, overriddenMax: undefined },
          { store: second, tokenId: 'alternate', value: { current: 3, max: 9 }, rawValue: { current: 3, max: 9 }, overriddenMax: ['hp', 'stress'] },
        ],
      },
    ],
    stores: [{ store: first, tokenIds: ['hero'] }, { store: second, tokenIds: ['alternate'] }],
  };
  const before = [structuredClone(first.getState().objects.tokens), structuredClone(second.getState().objects.tokens)];

  const commit = persistAtlasRestResourceChangesWithReceipt(context, [
    { resourceKey: 'hp', from: 4, to: 8, max: 20, direction: 'down' },
    { resourceKey: 'stress', from: 6, to: 4, max: 8, direction: 'up' },
  ]);

  assert.equal(commit.updated, 2);
  assert.equal(updateCalls.get(first), 1);
  assert.equal(updateCalls.get(second), 1);
  assert.deepEqual(first.getState().objects.tokens.hero.resources, {
    hp: { current: 8, max: 20 }, stress: { current: 4, max: 8 }, focus: { current: 2, max: 5 },
  });
  assert.deepEqual(second.getState().objects.tokens.alternate.resources, {
    hp: { current: 8, max: 30 }, stress: { current: 4, max: 9 }, focus: { current: 1, max: 4 },
  });
  assert.deepEqual(second.getState().objects.tokens.alternate.overriddenMax, ['hp', 'stress']);

  rollbackAtlasRestResourceChanges(commit.receipt);
  assert.deepEqual(first.getState().objects.tokens, before[0]);
  assert.deepEqual(second.getState().objects.tokens, before[1]);
  assert.equal(updateCalls.get(first), 2);
  assert.equal(updateCalls.get(second), 2);
});

test('one Rest commit can update token-held and PartySync-held Resources together', () => {
  const tokenStore = makeStore({ hero: { id: 'hero', resources: {
    hp: { current: 4, max: 20 }, focus: { current: 2, max: 5 },
  } } });
  const partyKey = JSON.stringify(['campaign', 'pc-1', 'stress']);
  const manaKey = JSON.stringify(['campaign', 'pc-1', 'mana']);
  const partyBefore = { current: 6, max: 8, maxByHand: true };
  const manaBefore = { current: 2, max: 10 };
  const partyA = makeStore({}, { [partyKey]: partyBefore, [manaKey]: manaBefore, unrelated: { current: 2, max: 3 } });
  const partyB = makeStore({}, { [partyKey]: partyBefore, [manaKey]: manaBefore, unrelated: { current: 2, max: 3 } });
  const partyWriteCalls = new Map([[partyA, 0], [partyB, 0]]);
  for (const store of [partyA, partyB]) {
    const original = store.setState.bind(store);
    store.setState = (partial) => {
      partyWriteCalls.set(store, partyWriteCalls.get(store) + 1);
      original(partial);
    };
  }
  const context = {
    characterAssetId: 'pc-1', characterName: 'Ayla', collectionId: 'heroes',
    resources: [
      {
        key: 'hp', name: 'HP', field: 'hp', direction: 'drains', current: 4, max: 20, holder: 'token',
        tokenEntries: [{ store: tokenStore, tokenId: 'hero', value: { current: 4, max: 20 }, rawValue: { current: 4, max: 20 }, overriddenMax: undefined }],
      },
      {
        key: 'stress', name: 'Stress', field: 'stress', direction: 'fills', current: 6, max: 8, holder: 'party',
        partyKey, partyEntries: [
          { store: partyA, key: partyKey, current: 6, max: 8, maxByHand: true, rawValue: partyBefore },
          { store: partyB, key: partyKey, current: 6, max: 8, maxByHand: true, rawValue: partyBefore },
        ],
      },
      {
        key: 'mana', name: 'Mana', field: 'mana', direction: 'drains', current: 2, max: 10, holder: 'party',
        partyKey: manaKey, partyEntries: [
          { store: partyA, key: manaKey, current: 2, max: 10, rawValue: manaBefore },
          { store: partyB, key: manaKey, current: 2, max: 10, rawValue: manaBefore },
        ],
      },
    ],
    stores: [{ store: tokenStore, tokenIds: ['hero'] }],
  };
  const beforeToken = structuredClone(tokenStore.getState().objects.tokens);
  const beforePartyA = structuredClone(partyA.getState().partyValues);
  const beforePartyB = structuredClone(partyB.getState().partyValues);

  const commit = persistAtlasRestResourceChangesWithReceipt(context, [
    { resourceKey: 'hp', from: 4, to: 12, max: 20, direction: 'down' },
    { resourceKey: 'stress', from: 6, to: 3, max: 8, direction: 'up' },
    { resourceKey: 'mana', from: 2, to: 5, max: 10, direction: 'down' },
  ]);

  assert.equal(commit.updated, 3);
  assert.deepEqual(tokenStore.getState().objects.tokens.hero.resources, {
    hp: { current: 12, max: 20 }, focus: { current: 2, max: 5 },
  });
  assert.deepEqual(partyA.getState().partyValues[partyKey], { current: 3, max: 8, maxByHand: true });
  assert.deepEqual(partyB.getState().partyValues[partyKey], { current: 3, max: 8, maxByHand: true });
  assert.deepEqual(partyA.getState().partyValues[manaKey], { current: 5, max: 10 });
  assert.deepEqual(partyB.getState().partyValues[manaKey], { current: 5, max: 10 });
  assert.deepEqual(partyA.getState().partyValues.unrelated, { current: 2, max: 3 });
  assert.equal(partyWriteCalls.get(partyA), 1);
  assert.equal(partyWriteCalls.get(partyB), 1);

  rollbackAtlasRestResourceChanges(commit.receipt);
  assert.deepEqual(tokenStore.getState().objects.tokens, beforeToken);
  assert.deepEqual(partyA.getState().partyValues, beforePartyA);
  assert.deepEqual(partyB.getState().partyValues, beforePartyB);
  assert.equal(partyWriteCalls.get(partyA), 2);
  assert.equal(partyWriteCalls.get(partyB), 2);
});

test('a stale later Resource aborts a multi-Resource commit before the first Resource changes', () => {
  const { store, context } = tokenContext();
  const stressBefore = { current: 6, max: 8 };
  store.getState().objects.tokens.a.resources.stress = stressBefore;
  context.resources.push({
    key: 'stress', name: 'Stress', field: 'stress', direction: 'fills', current: 6, max: 8, holder: 'token',
    tokenEntries: [
      { store, tokenId: 'a', value: stressBefore, rawValue: stressBefore, overriddenMax: undefined },
      { store, tokenId: 'b', value: { current: 3, max: 9 }, rawValue: { current: 3, max: 9 }, overriddenMax: ['hp'] },
    ],
  });
  store.getState().objects.tokens.b.resources.stress = { current: 5, max: 9 };
  const before = structuredClone(store.getState().objects.tokens);

  assert.throws(() => persistAtlasRestResourceChangesWithReceipt(context, [
    { resourceKey: 'hp', from: 4, to: 8, max: 20, direction: 'down' },
    { resourceKey: 'stress', from: 6, to: 2, max: 8, direction: 'up' },
  ]), /mudou desde o cálculo/);
  assert.deepEqual(store.getState().objects.tokens, before);
});

test('rollback continues across independent maps and PartySync stores after one restore write fails', () => {
  const tokenA = makeStore({ a: { id: 'a', resources: { hp: { current: 4, max: 20 } } } });
  const tokenB = makeStore({ b: { id: 'b', resources: { hp: { current: 10, max: 30 } } } });
  const partyKey = JSON.stringify(['campaign', 'pc-1', 'stress']);
  const partyBefore = { current: 6, max: 8, maxByHand: true };
  const party = makeStore({}, { [partyKey]: partyBefore });
  const context = {
    characterAssetId: 'pc-1', characterName: 'Ayla', collectionId: 'heroes',
    resources: [
      {
        key: 'hp', name: 'HP', field: 'hp', direction: 'drains', current: 4, max: 20, holder: 'token',
        tokenEntries: [
          { store: tokenA, tokenId: 'a', value: { current: 4, max: 20 }, rawValue: { current: 4, max: 20 }, overriddenMax: undefined },
          { store: tokenB, tokenId: 'b', value: { current: 10, max: 30 }, rawValue: { current: 10, max: 30 }, overriddenMax: undefined },
        ],
      },
      {
        key: 'stress', name: 'Stress', field: 'stress', direction: 'fills', current: 6, max: 8, holder: 'party',
        partyKey, partyEntries: [{ store: party, key: partyKey, current: 6, max: 8, maxByHand: true, rawValue: partyBefore }],
      },
    ],
    stores: [{ store: tokenA, tokenIds: ['a'] }, { store: tokenB, tokenIds: ['b'] }],
  };
  const commit = persistAtlasRestResourceChangesWithReceipt(context, [
    { resourceKey: 'hp', from: 4, to: 8, max: 20, direction: 'down' },
    { resourceKey: 'stress', from: 6, to: 3, max: 8, direction: 'up' },
  ]);

  const originalUpdateA = tokenA.getState().updateTokens;
  let failRestoreOnce = true;
  tokenA.getState().updateTokens = (entries) => {
    if (failRestoreOnce) {
      failRestoreOnce = false;
      throw new Error('simulated restore failure before mutation');
    }
    originalUpdateA(entries);
  };

  assert.throws(() => rollbackAtlasRestResourceChanges(commit.receipt), /rollback dos Resources do Atlas foi parcial/);
  assert.deepEqual(tokenA.getState().objects.tokens.a.resources.hp, { current: 8, max: 20 });
  assert.deepEqual(tokenB.getState().objects.tokens.b.resources.hp, { current: 10, max: 30 });
  assert.deepEqual(party.getState().partyValues[partyKey], partyBefore);

  tokenA.getState().updateTokens = originalUpdateA;
  rollbackAtlasRestResourceChanges(commit.receipt);
  assert.deepEqual(tokenA.getState().objects.tokens.a.resources.hp, { current: 4, max: 20 });
  assert.deepEqual(tokenB.getState().objects.tokens.b.resources.hp, { current: 10, max: 30 });
  assert.deepEqual(party.getState().partyValues[partyKey], partyBefore);
});

test('rollback accepts a store method that throws after the previous snapshot has been restored', () => {
  const { store, context } = tokenContext();
  const before = structuredClone(store.getState().objects.tokens);
  const commit = persistAtlasRestResourceChangesWithReceipt(context, [
    { resourceKey: 'hp', from: 4, to: 8, max: 20, direction: 'down' },
  ]);
  const originalUpdate = store.getState().updateTokens;
  store.getState().updateTokens = (entries) => {
    originalUpdate(entries);
    throw new Error('simulated post-write notification failure');
  };

  assert.doesNotThrow(() => rollbackAtlasRestResourceChanges(commit.receipt));
  assert.deepEqual(store.getState().objects.tokens, before);
});
