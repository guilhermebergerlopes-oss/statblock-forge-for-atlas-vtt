import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
const linkAdapter = readFileSync(new URL('../src/atlas/atlasTokenLinkAdapter.ts', import.meta.url), 'utf8');

test('legacy Forge token-link data remains preserved during the staged Atlas migration', () => {
  assert.match(main, /readPersistedForgeTokenLinks/);
  assert.match(main, /FORGE_TOKEN_LINKS_DATA_KEY/);
  assert.match(main, /getForgeTokenLinkStore/);
  assert.match(main, /snapshot\[FORGE_TOKEN_LINKS_DATA_KEY\]/);
  assert.doesNotMatch(main, /delete storedSettings\.forgeTokenLinks/);
});

test('token-link reads use Atlas placed-token state before shared TokenAsset state', () => {
  assert.match(linkAdapter, /if \(token\.statblockPath\) return \{ statblockPath: token\.statblockPath, source: 'instance'/);
  assert.match(linkAdapter, /asset\?\.statblockPath/);
});

test('token-link writes go through Atlas native TokenStatblockLinkService', () => {
  assert.match(linkAdapter, /linkAtlasTokenWithoutRewritingStatblockArtwork/);
  assert.match(linkAdapter, /service\.unlinkToken\(imagePath, \{ updateStatblockAvatar: false/);
  assert.match(linkAdapter, /service\.linkTokenToStatblock\(imagePath, targetStatblockPath/);
  assert.match(linkAdapter, /updateAtlasPlacedCharacterLinksForImage/);
});
