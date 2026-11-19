import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const toolbar = readFileSync(new URL('../src/views/templateCanvasToolbar.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const localization = readFileSync(new URL('../src/i18n/localization.ts', import.meta.url), 'utf8');

test('Canvas secondary controls are grouped under More options', () => {
  assert.match(toolbar, /const moreTools = el\('details', 'statblock-forge__canvas-more-tools'\)/);
  assert.match(toolbar, /moreToolsContent\.append\(settingsGroup\)/);
  assert.match(toolbar, /moreToolsContent\.append\(selectionGroup\)/);
  assert.match(styles, /canvas-toolbar-group--settings\s*\{\s*display:\s*grid/s);
});

test('Forge toolbar does not expose Atlas native column selector', () => {
  assert.doesNotMatch(toolbar, /Atlas: [123] col/);
  assert.doesNotMatch(toolbar, /template\.layout\.maxColumns\s*=/);
  assert.doesNotMatch(localization, /'Atlas: [123] col/);
});
