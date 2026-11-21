import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('Direct Forge preview preserves the effective Template width in Ctrl-hover', async () => {
  const renderer = await readFile(new URL('src/atlas/atlasForgePreviewRenderer.ts', root), 'utf8');
  const widthModel = await readFile(new URL('src/templates/sheetWidth.ts', root), 'utf8');
  const styles = await readFile(new URL('styles.css', root), 'utf8');
  const previewWindow = await readFile(new URL('src/atlas/forgeStatblockPreviewWindow.ts', root), 'utf8');

  assert.match(renderer, /resolveForgeSheetWidth\(source\.raw\[FORGE_STATBLOCK_SHEET_WIDTH_KEY\], layout\.sheetWidth\)/);
  assert.match(renderer, /dataset\.forgeSheetWidth = String\(resolved\.sheetWidth\)/);
  assert.match(renderer, /--statblock-forge-sheet-width.*resolved\.sheetWidth/);
  assert.match(widthModel, /export const FORGE_STATBLOCK_SHEET_WIDTH_KEY = '__forgeSheetWidth'/);
  assert.match(previewWindow, /outerWidth = Math\.min\(sheetWidth \+ horizontalPadding, maxWidth\)/);
  assert.match(previewWindow, /renderHost\.style\.flex = `0 0 \$\{availableContentWidth\}px`/);
  assert.match(previewWindow, /Measure after applying the configured width/);
  assert.match(styles, /atlas-statblock-preview-window\.statblock-forge__atlas-width-preview[\s\S]*?max-width: min\(calc\(var\(--statblock-forge-sheet-width/);
  assert.match(styles, /statblock-forge__atlas-preview-mount > \.statblock-forge__final-card\.atlas-statblock[\s\S]*?width: var\(--statblock-forge-sheet-width/);
});
