import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const [renderer, zoom, styles] = await Promise.all([
  readFile(resolve(root, 'src/render/statblockPreviewRenderer.ts'), 'utf8'),
  readFile(resolve(root, 'src/views/templateCanvasZoom.ts'), 'utf8'),
  readFile(resolve(root, 'styles.css'), 'utf8'),
]);

test('inline editor static styles are defined in CSS, not assigned at runtime', () => {
  const start = renderer.indexOf('function preserveInlineFieldFormatting(');
  const end = renderer.indexOf('\nfunction registerInlineSlotEditor(', start);
  assert.ok(start >= 0 && end > start, 'inline editor formatting helper exists');
  const helper = renderer.slice(start, end);

  assert.doesNotMatch(helper, /setCssProps\(\{\s*\[[^\]]+\]\s*:\s*['"]/);
  assert.match(helper, /control\.setCssStyles\(\{\s*width:\s*`\$\{bounds\.width\}px`\s*\}\)/);
  assert.match(helper, /control\.setCssStyles\(\{\s*height:\s*`\$\{bounds\.height\}px`\s*\}\)/);
  assert.match(styles, /\.atlas-sb-pane-editor input\.is-inline-measured\s*\{[^}]*box-sizing:\s*border-box;[^}]*border-color:\s*transparent;/s);
  assert.match(styles, /textarea\.statblock-forge__inline-field-editor\.is-markdown\s*\{[^}]*white-space:\s*pre-wrap;[^}]*pointer-events:\s*auto;[^}]*user-select:\s*text;/s);
});

test('Canvas zoom remains runtime-dynamic and uses the Obsidian CSS styles helper', () => {
  assert.match(zoom, /sheet\.setCssStyles\(\{\s*zoom:\s*String\(zoom\)\s*\}\)/);
  assert.doesNotMatch(zoom, /\.style\s*\.|setCssProps\(/);
});
