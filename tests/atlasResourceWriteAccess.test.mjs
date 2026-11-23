import assert from 'node:assert/strict';
import test from 'node:test';
import {
  atlasCanWritePartyResources,
  atlasCanWriteTokenResources,
} from '../src/atlas/atlasResourceWriteAccess.ts';

const gmMapState = {
  mapPath: 'atlas-vtt/collections/heroes/scenes/one.atlasmap',
  mapLoaded: true,
  isMapLoading: false,
  isPlayerView: false,
};

test('token Resource writes require a loaded GM map and the same map path', () => {
  assert.equal(atlasCanWriteTokenResources(gmMapState, gmMapState.mapPath), true);
  assert.equal(atlasCanWriteTokenResources({ ...gmMapState, isPlayerView: true }, gmMapState.mapPath), false);
  assert.equal(atlasCanWriteTokenResources({ ...gmMapState, mapLoaded: false }, gmMapState.mapPath), false);
  assert.equal(atlasCanWriteTokenResources({ ...gmMapState, isMapLoading: true }, gmMapState.mapPath), false);
  assert.equal(atlasCanWriteTokenResources({ ...gmMapState, mapPath: 'atlas-vtt/collections/heroes/scenes/two.atlasmap' }, gmMapState.mapPath), false);
});

test('PartySync writes require a GM store and the same map identity, but not a loaded scene', () => {
  assert.equal(atlasCanWritePartyResources({ ...gmMapState, mapLoaded: false }, gmMapState.mapPath), true);
  assert.equal(atlasCanWritePartyResources({ ...gmMapState, isPlayerView: true }, gmMapState.mapPath), false);
  assert.equal(atlasCanWritePartyResources({ ...gmMapState, isMapLoading: true }, gmMapState.mapPath), false);
  assert.equal(atlasCanWritePartyResources({ ...gmMapState, mapPath: 'atlas-vtt/collections/heroes/scenes/two.atlasmap' }, gmMapState.mapPath), false);
});
