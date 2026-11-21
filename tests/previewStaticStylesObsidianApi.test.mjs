import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = [
  '../src/atlas/forgeAtlasPreviewBridge.ts',
  '../src/atlas/forgeStatblockPreviewWindow.ts',
  '../src/render/statblockPreviewRenderer.ts',
];

const sources = await Promise.all(files.map((file) => readFile(new URL(file, import.meta.url), 'utf8')));

test('preview UI static styles use Obsidian CSS style helpers', () => {
  for (const source of sources) {
    assert.doesNotMatch(
      source,
      /\.style\.[A-Za-z_$][\w$]*\s*=\s*(?:'[^']*'|"[^"]*")/,
      'static CSS values must not be assigned directly through element.style',
    );
  }

  assert.match(sources[0], /preview\.element\.setCssStyles\(\{\s*zIndex:\s*'40'/);
  assert.match(sources[1], /element\.setCssStyles\(\{[\s\S]*?position:\s*'fixed'[\s\S]*?zIndex:\s*'100'/);
  assert.match(sources[1], /renderHost\.setCssStyles\(\{[\s\S]*?display:\s*'flex'[\s\S]*?overflowX:\s*'auto'/);
  assert.match(sources[2], /table\.setCssStyles\(\{\s*maxWidth:\s*'none',\s*tableLayout:\s*'fixed'/);
  assert.match(sources[2], /cell\.setCssStyles\(\{\s*minWidth:\s*'0',\s*maxWidth:\s*'none',\s*boxSizing:\s*'border-box'/);
  assert.match(sources[2], /actionTrack\.setCssStyles\(\{\s*boxSizing:\s*'border-box'/);
});
