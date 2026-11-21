import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const surface = readFileSync(new URL('../src/views/StatblockRenderSurface.ts', import.meta.url), 'utf8');
const linkAdapter = readFileSync(new URL('../src/atlas/atlasTokenLinkAdapter.ts', import.meta.url), 'utf8');

test('Token art actions expose direct link and unlink actions for selected Atlas Characters', () => {
  assert.match(surface, /inspectSelectedAtlasTokenLinks\(this\.app, sourceFile\.path\)/);
  assert.match(surface, /id: 'link-selected-atlas-tokens'/);
  assert.match(surface, /id: 'unlink-selected-atlas-tokens'/);
  assert.match(surface, /applySelectedAtlasTokenLinks\(sourceFile instanceof TFile \? sourceFile\.path : source\.path, language, false\)/);
  assert.match(surface, /applySelectedAtlasTokenLinks\(sourceFile instanceof TFile \? sourceFile\.path : source\.path, language, true\)/);
});

test('Forge token links do not ask Atlas to rewrite the Forge statblock image field', () => {
  assert.match(surface, /unlinkSelectedAtlasTokensFromStatblock\(this\.app, statblockPath, \{ updateStatblockAvatar: false/);
  assert.match(surface, /linkSelectedAtlasTokensToStatblock\(this\.app, statblockPath, \{ updateStatblockAvatar: false/);
  assert.match(linkAdapter, /updateStatblockAvatar: false/);
});

test('old manual right-click linking instructions are removed from the Forge Token art menu', () => {
  assert.doesNotMatch(surface, /right-click the token on the map or in the Tokens tab/);
  assert.doesNotMatch(surface, /clique com o botão direito no token do mapa/);
});

test('Forge v2 notes create TokenAssets directly instead of using the Atlas-native statblock importer', () => {
  assert.match(surface, /if \(isForgeV2Note && sourceFile instanceof TFile\)/);
  assert.match(surface, /id: 'create-forge-token-asset'/);
  assert.match(surface, /createAtlasTokenAssetFromForgeImage\(sourceFile\.path, tokenName, current, language\)/);
  assert.doesNotMatch(surface, /createForgeTokenAssetFromStatblock/);
  assert.match(surface, /if \(fieldKey === 'image' && !isForgeNativeV2StatblockNote/);
});
