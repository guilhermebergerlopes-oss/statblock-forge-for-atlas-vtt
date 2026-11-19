import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/render/inlineScoresTableContextMenu.ts', import.meta.url), 'utf8');

test('inline Scores menu builds its fixed SVG icon fragments without innerHTML', () => {
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
  assert.match(source, /createElementNS\('http:\/\/www\.w3\.org\/2000\/svg', tagName\)/);
  assert.match(source, /shape\.setAttribute\(attributeName, attributeValue\)/);
});
