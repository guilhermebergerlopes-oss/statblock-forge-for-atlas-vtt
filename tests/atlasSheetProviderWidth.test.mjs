import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('Atlas provider exports the effective statblock width to Ctrl-hover previews', async () => {
  const provider = await readFile(new URL('src/atlas/atlasSheetProvider.ts', root), 'utf8');
  const widthModel = await readFile(new URL('src/templates/sheetWidth.ts', root), 'utf8');
  const styles = await readFile(new URL('styles.css', root), 'utf8');

  assert.match(provider, /resolveForgeSheetWidth\(source\.raw\[FORGE_STATBLOCK_SHEET_WIDTH_KEY\], layout\.sheetWidth\)/);
  assert.match(provider, /dataset\.forgeSheetWidth = String\(resolved\.sheetWidth\)/);
  assert.match(provider, /--statblock-forge-sheet-width.*resolved\.sheetWidth/);
  assert.match(widthModel, /export const FORGE_STATBLOCK_SHEET_WIDTH_KEY = '__forgeSheetWidth'/);
  assert.match(styles, /statblock-forge__atlas-preview-mount > \.statblock-forge__final-card\.atlas-statblock[\s\S]*?width: var\(--statblock-forge-sheet-width/);
});
