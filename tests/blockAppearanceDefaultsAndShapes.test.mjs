import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildBlockAppearanceCss,
  normalizeBlockAppearance,
  resolveBlockAppearanceForMode,
  nestedLayoutInlineBleed,
} from '../src/templates/blockAppearance.ts';
import { normalizeTokenFrameAppearance } from '../src/templates/forgeTemplate.ts';

const root = new URL('../', import.meta.url);
const SHAPES = [
  'oval', 'diamond', 'regular-hexagon',
  'triangle-up', 'triangle-right', 'triangle-down', 'triangle-left',
];

 test('Custom appearance starts with the same defaults displayed by the Inspector', () => {
  const appearance = resolveBlockAppearanceForMode({}, 'custom');
  assert.equal(appearance.shape, 'rounded');
  assert.equal(appearance.cornerRadius, 14);
  assert.equal(appearance.borderPreset, undefined);
  assert.equal(appearance.borderStyle, 'solid');
  assert.equal(appearance.borderWidth, 1);
  assert.equal(appearance.backgroundOpacity, 100);
  assert.equal(appearance.textAlign, 'start');
  assert.equal(appearance.verticalAlign, 'center');
  assert.equal(appearance.padding, 0);

  const css = buildBlockAppearanceCss(appearance);
  assert.equal(css.borderRadius, '14px');
  assert.equal(css.borderStyle, 'solid');
  assert.equal(css.borderWidth, '1px');
  assert.equal(css.borderColor, 'var(--forge-theme-border, var(--background-modifier-border))');
  assert.equal(css.textAlign, 'left');
  assert.equal(css.alignItems, 'center');
  assert.equal(css.padding, '0px');
  assert.equal(nestedLayoutInlineBleed(appearance), 1);
});

test('Theme mode does not apply individual appearance values', () => {
  assert.deepEqual(resolveBlockAppearanceForMode({ shape: 'oval', borderWidth: 8 }, 'theme'), {});
});

test('Custom defaults preserve explicit appearance settings', () => {
  const configured = {
    shape: 'square',
    borderPreset: 'diamond',
    borderColor: '#123456',
    borderWidth: 4,
    borderStyle: 'dashed',
    padding: 12,
    textAlign: 'center',
    verticalAlign: 'end',
    shadowBlur: 7,
  };
  const resolved = resolveBlockAppearanceForMode(configured, 'custom');
  assert.equal(resolved.shape, 'square');
  assert.equal(resolved.borderPreset, 'diamond');
  assert.equal(resolved.borderColor, '#123456');
  assert.equal(resolved.borderWidth, 4);
  assert.equal(resolved.borderStyle, 'dashed');
  assert.equal(resolved.padding, 12);
  assert.equal(resolved.textAlign, 'center');
  assert.equal(resolved.verticalAlign, 'end');
  assert.equal(resolved.shadowBlur, 7);
});

test('all new border geometries survive block and Token frame normalization', () => {
  for (const borderPreset of SHAPES) {
    assert.equal(normalizeBlockAppearance({ borderPreset }).borderPreset, borderPreset, `block ${borderPreset}`);
    assert.equal(normalizeTokenFrameAppearance({ enabled: true, borderPreset }).borderPreset, borderPreset, `token ${borderPreset}`);
  }
  assert.equal(normalizeBlockAppearance({ borderPreset: 'not-a-shape' }).borderPreset, undefined);
  assert.equal(normalizeTokenFrameAppearance({ enabled: true, borderPreset: 'not-a-shape' }).borderPreset, 'default');
});

test('the preview renderer consumes resolved Custom appearance values', async () => {
  const renderer = await readFile(new URL('src/render/statblockPreviewRenderer.ts', root), 'utf8');
  assert.match(renderer, /mode === 'custom' \? resolveBlockAppearanceForMode\(savedAppearance, 'custom'\) : \{\}/);
});

test('Inspector exposes every new preset for blocks and Token frames', async () => {
  const [blockInspector, tokenInspector] = await Promise.all([
    readFile(new URL('src/views/templateBlockAppearanceInspector.ts', root), 'utf8'),
    readFile(new URL('src/views/templateAppearanceEditor.ts', root), 'utf8'),
  ]);
  for (const shape of SHAPES) {
    assert.ok(blockInspector.includes(`value: '${shape}'`), `block Inspector missing ${shape}`);
    assert.ok(tokenInspector.includes(`value: '${shape}'`), `Token Inspector missing ${shape}`);
  }
  assert.match(blockInspector, /resolveBlockAppearanceForMode\(metadata\.appearance, 'custom'\)/);
  assert.doesNotMatch(blockInspector, /stripGeneratedThemeAppearanceDefaults/);
});

test('SCSS and Obsidian stylesheet contain matching block and Token geometry selectors', async () => {
  const [scss, css] = await Promise.all([
    readFile(new URL('src/styles/border-presets.scss', root), 'utf8'),
    readFile(new URL('styles.css', root), 'utf8'),
  ]);
  for (const shape of SHAPES) {
    assert.ok(scss.includes(`'${shape}'`), `SCSS missing ${shape}`);
    assert.ok(css.includes(`data-border-preset='${shape}'`) || css.includes(`data-border-preset=${shape}`), `compiled block CSS missing ${shape}`);
    assert.ok(css.includes(`data-token-border-preset='${shape}'`) || css.includes(`data-token-border-preset=${shape}`), `compiled Token CSS missing ${shape}`);
  }
  assert.match(scss, /'regular-hexagon':\s*polygon\(25% 6\.69872981%, 75% 6\.69872981%, 100% 50%/);
});
