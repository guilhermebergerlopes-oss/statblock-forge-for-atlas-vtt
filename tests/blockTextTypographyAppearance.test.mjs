import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildBlockAppearanceCss,
  normalizeBlockAppearance,
  resolveBlockAppearanceForMode,
} from '../src/templates/blockAppearance.ts';
import { createBlankTemplate, createForgeLayout } from '../src/templates/forgeTemplate.ts';
import { parseTemplateFileText, serializeForgeTemplateFile } from '../src/templates/forgeFileFormat.ts';

const root = new URL('../', import.meta.url);

test('typography options normalize independently for general text, labels and values', () => {
  const appearance = normalizeBlockAppearance({
    fontSize: 16,
    fontWeight: '700',
    fontStyle: 'italic',
    textDecoration: 'underline',
    letterSpacing: 1.25,
    lineHeight: 1.6,
    labelFontSize: 11,
    labelFontWeight: '600',
    labelFontStyle: 'normal',
    labelTextDecoration: 'line-through',
    labelLetterSpacing: -0.5,
    labelLineHeight: 1.2,
    valueFontSize: 20,
    valueFontWeight: '500',
    valueFontStyle: 'italic',
    valueTextDecoration: 'none',
    valueLetterSpacing: 2,
    valueLineHeight: 1.8,
  });

  assert.equal(appearance.fontSize, 16);
  assert.equal(appearance.fontWeight, '700');
  assert.equal(appearance.fontStyle, 'italic');
  assert.equal(appearance.textDecoration, 'underline');
  assert.equal(appearance.letterSpacing, 1.25);
  assert.equal(appearance.lineHeight, 1.6);
  assert.equal(appearance.labelFontSize, 11);
  assert.equal(appearance.labelFontWeight, '600');
  assert.equal(appearance.labelTextDecoration, 'line-through');
  assert.equal(appearance.labelLineHeight, 1.2);
  assert.equal(appearance.valueFontSize, 20);
  assert.equal(appearance.valueFontWeight, '500');
  assert.equal(appearance.valueTextDecoration, 'none');
  assert.equal(appearance.valueLineHeight, 1.8);
});

test('typography values are clamped or discarded when malformed', () => {
  const appearance = normalizeBlockAppearance({
    fontSize: 100,
    labelFontSize: 2,
    valueFontSize: Number.NaN,
    letterSpacing: -4,
    labelLetterSpacing: 20,
    valueLetterSpacing: 'wide',
    lineHeight: 4.5,
    labelLineHeight: 0.4,
    valueLineHeight: Number.NaN,
    fontWeight: '900',
    labelFontStyle: 'oblique',
    valueTextDecoration: 'blink',
  });

  assert.equal(appearance.fontSize, 48);
  assert.equal(appearance.labelFontSize, 8);
  assert.equal(appearance.valueFontSize, undefined);
  assert.equal(appearance.letterSpacing, -1);
  assert.equal(appearance.labelLetterSpacing, 8);
  assert.equal(appearance.valueLetterSpacing, undefined);
  assert.equal(appearance.lineHeight, 3);
  assert.equal(appearance.labelLineHeight, 0.8);
  assert.equal(appearance.valueLineHeight, undefined);
  assert.equal(appearance.fontWeight, undefined);
  assert.equal(appearance.labelFontStyle, undefined);
  assert.equal(appearance.valueTextDecoration, undefined);
});

test('custom appearance preserves typography while theme mode ignores it', () => {
  const configured = { fontSize: 18, lineHeight: 1.7, labelFontWeight: '700', labelLineHeight: 1.1, valueFontStyle: 'italic', valueLineHeight: 2 };
  const custom = resolveBlockAppearanceForMode(configured, 'custom');
  assert.equal(custom.fontSize, 18);
  assert.equal(custom.lineHeight, 1.7);
  assert.equal(custom.labelFontWeight, '700');
  assert.equal(custom.labelLineHeight, 1.1);
  assert.equal(custom.valueFontStyle, 'italic');
  assert.equal(custom.valueLineHeight, 2);
  assert.deepEqual(resolveBlockAppearanceForMode(configured, 'theme'), {});
  assert.equal(resolveBlockAppearanceForMode({}, 'custom').fontSize, undefined);
});

test('appearance CSS exposes independent typography variables only when configured', () => {
  const css = buildBlockAppearanceCss({
    fontSize: 17,
    fontWeight: '700',
    fontStyle: 'italic',
    textDecoration: 'underline',
    letterSpacing: 0.5,
    lineHeight: 1.55,
    labelFontSize: 12,
    labelFontWeight: '600',
    labelLineHeight: 1.1,
    valueFontSize: 21,
    valueTextDecoration: 'line-through',
    valueLineHeight: 1.9,
  });

  assert.equal(css['--forge-block-font-size'], '17px');
  assert.equal(css['--forge-block-font-weight'], '700');
  assert.equal(css['--forge-block-font-style'], 'italic');
  assert.equal(css['--forge-block-text-decoration'], 'underline');
  assert.equal(css['--forge-block-letter-spacing'], '0.5px');
  assert.equal(css['--forge-block-line-height'], '1.55');
  assert.equal(css['--forge-block-label-font-size'], '12px');
  assert.equal(css['--forge-block-label-font-weight'], '600');
  assert.equal(css['--forge-block-label-line-height'], '1.1');
  assert.equal(css['--forge-block-value-font-size'], '21px');
  assert.equal(css['--forge-block-value-text-decoration'], 'line-through');
  assert.equal(css['--forge-block-value-line-height'], '1.9');
  assert.equal(buildBlockAppearanceCss({})['--forge-block-font-size'], undefined);
});

test('Block Appearance inspector exposes general, label and value typography controls', async () => {
  const inspector = await readFile(new URL('src/views/templateBlockAppearanceInspector.ts', root), 'utf8');
  for (const scope of ["translateForgeText('All text'", "translateForgeText('Labels'", "translateForgeText('Values'"]) {
    assert.ok(inspector.includes(scope), `missing typography scope ${scope}`);
  }
  for (const option of ['Font size (px)', 'Font weight', 'Font style', 'Text decoration', 'Letter spacing (px)', 'Line spacing (×)', 'Customize line spacing']) {
    assert.ok(inspector.includes(`'${option}'`), `missing control ${option}`);
  }
  assert.match(inspector, /delete record\[weightKey\]/);
  assert.match(inspector, /delete record\[styleKey\]/);
  assert.match(inspector, /delete record\[decorationKey\]/);
});

test('renderer maps typography metadata to scoped data flags and stylesheet rules', async () => {
  const [renderer, stylesheet] = await Promise.all([
    readFile(new URL('src/render/statblockPreviewRenderer.ts', root), 'utf8'),
    readFile(new URL('styles.css', root), 'utf8'),
  ]);
  for (const flag of [
    'customTextFontSize', 'customTextFontWeight', 'customTextFontStyle', 'customTextTextDecoration', 'customTextLetterSpacing', 'customTextLineHeight',
    'customLabelFontSize', 'customLabelFontWeight', 'customLabelFontStyle', 'customLabelTextDecoration', 'customLabelLetterSpacing', 'customLabelLineHeight',
    'customValueFontSize', 'customValueFontWeight', 'customValueFontStyle', 'customValueTextDecoration', 'customValueLetterSpacing', 'customValueLineHeight',
  ]) {
    assert.ok(renderer.includes(`'${flag}'`), `renderer missing ${flag}`);
    const cssFlag = flag.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    assert.ok(stylesheet.includes(`data-${cssFlag}="true"`), `stylesheet missing ${cssFlag}`);
  }
  assert.match(stylesheet, /font-size: var\(--forge-block-label-font-size\) !important/);
  assert.match(stylesheet, /font-weight: var\(--forge-block-value-font-weight\) !important/);
  assert.match(stylesheet, /font-style: var\(--forge-block-font-style\) !important/);
  assert.match(stylesheet, /text-decoration: var\(--forge-block-label-text-decoration\) !important/);
  assert.match(stylesheet, /letter-spacing: var\(--forge-block-value-letter-spacing\) !important/);
  assert.match(stylesheet, /line-height: var\(--forge-block-line-height\) !important/);
  assert.match(stylesheet, /line-height: var\(--forge-block-label-line-height\) !important/);
  assert.match(stylesheet, /line-height: var\(--forge-block-value-line-height\) !important/);
});


test('typography settings survive Forge sidecar serialization and reload', () => {
  const template = createBlankTemplate('Typography persistence test');
  template.layout.blocks = [{ id: 'hp-block', type: 'stat', field: 'hp' }];
  const layout = createForgeLayout(template);
  layout.blocks['hp-block'].appearanceMode = 'custom';
  layout.blocks['hp-block'].appearance = {
    fontSize: 18,
    fontWeight: '700',
    fontStyle: 'italic',
    textDecoration: 'underline',
    letterSpacing: 0.5,
    lineHeight: 1.55,
    labelFontSize: 12,
    labelFontWeight: '600',
    labelLineHeight: 1.2,
    valueFontSize: 22,
    valueFontStyle: 'normal',
    valueTextDecoration: 'line-through',
    valueLineHeight: 1.8,
  };

  const serialized = serializeForgeTemplateFile(template, layout);
  const parsed = parseTemplateFileText(serialized, 'forgetemplate');
  const appearance = parsed.layout?.blocks['hp-block']?.appearance;

  assert.equal(parsed.fileFormat, 'forge');
  assert.equal(parsed.canOverwrite, true);
  assert.equal(appearance?.fontSize, 18);
  assert.equal(appearance?.fontWeight, '700');
  assert.equal(appearance?.fontStyle, 'italic');
  assert.equal(appearance?.textDecoration, 'underline');
  assert.equal(appearance?.letterSpacing, 0.5);
  assert.equal(appearance?.lineHeight, 1.55);
  assert.equal(appearance?.labelFontSize, 12);
  assert.equal(appearance?.labelFontWeight, '600');
  assert.equal(appearance?.labelLineHeight, 1.2);
  assert.equal(appearance?.valueFontSize, 22);
  assert.equal(appearance?.valueFontStyle, 'normal');
  assert.equal(appearance?.valueTextDecoration, 'line-through');
  assert.equal(appearance?.valueLineHeight, 1.8);
});
