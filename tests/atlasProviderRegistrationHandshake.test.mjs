import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');

test('Forge can register its Atlas sheet renderer on an explicit preview request', () => {
  assert.match(main, /workspace\.on\(\s*'statblock-forge-atlas-provider-registration-requested',\s*tryRegisterAtlasProvider/s);
  assert.match(main, /registerForgeAtlasSheetProvider\(this\.app, this, currentAtlasAPI\)/);
});
