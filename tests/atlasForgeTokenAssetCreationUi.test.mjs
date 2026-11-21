import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const surface = readFileSync(new URL('../src/views/StatblockRenderSurface.ts', import.meta.url), 'utf8');
const creation = readFileSync(new URL('../src/atlas/atlasForgeTokenAssetCreation.ts', import.meta.url), 'utf8');

 test('Forge v2 Token art can be selected from the Vault and registered as an Atlas TokenAsset', () => {
  assert.match(surface, /id: isForgeV2Note \? 'choose-token-art' : 'choose-image'/);
  assert.match(surface, /id: 'create-forge-token-asset'/);
  assert.match(surface, /createForgeTokenAssetFromImage\(this\.app, statblockPath, tokenName, imageValue\)/);
  assert.match(creation, /assetService\.addTokenAsset\(/);
  assert.match(creation, /statblockPath,/);
  assert.match(creation, /collection: assetService\.getDefaultCollectionId\(\)/);
  assert.match(creation, /showRing: false/);
});

test('TokenAsset creation stores a managed copy and asks Atlas to refresh its asset library', () => {
  assert.match(creation, /ATLAS_TOKEN_ASSET_DIRECTORY = 'atlas-vtt\/assets'/);
  assert.match(creation, /app\.vault\.createBinary\(path, bytes\)/);
  assert.match(creation, /app\.workspace\.trigger\('atlas-vtt:refresh-assets'\)/);
  assert.match(creation, /if \(committed\)/);
  assert.match(creation, /status: 'uncertain'/);
});

test('Token art picker is available only for Forge v2 notes and filters to Atlas-supported image formats', () => {
  assert.match(surface, /fieldKey === 'image' && !isForgeNativeV2StatblockNote/);
  assert.match(surface, /ATLAS_TOKEN_IMAGE_EXTENSIONS\.has\(file\.extension\.toLowerCase\(\)\)/);
  assert.match(creation, /'png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'/);
});
