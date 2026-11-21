import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const renderer = await readFile(new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8');
const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const selectionStyles = await readFile(new URL('../src/styles/selection.scss', import.meta.url), 'utf8');

function between(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing start marker: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `missing end marker: ${end}`);
  return source.slice(from, to);
}

test('Selection editor uses the Atlas combobox and option-list interaction', () => {
  assert.match(renderer, /input\.setAttribute\('role', 'combobox'\)/);
  assert.match(renderer, /popup\.setAttribute\('role', 'listbox'\)/);
  assert.match(renderer, /element\('div', 'atlas-sb-pane-option', option\.label\)/);
  assert.match(renderer, /atlas-sb-pane-field atlas-sb-pane-choice statblock-forge__selection-atlas/);
  assert.match(renderer, /usesChips \? ' atlas-sb-pane-chips' : ''/);
  assert.match(renderer, /atlas-sb-pane-selection-chips/);
  assert.match(renderer, /atlas-sb-pane-pick__add/);
  assert.doesNotMatch(renderer, /choice\.type\s*=\s*'checkbox'/);
});

test('numbered Selection uses Atlas pick chips with an optional number and unit', () => {
  assert.match(renderer, /amount\.type\s*=\s*'text'/);
  assert.match(renderer, /amount\.inputMode\s*=\s*'decimal'/);
  assert.match(renderer, /atlas-sb-pane-pick__number/);
  assert.match(renderer, /atlas-sb-pane-pick__unit/);
  assert.match(renderer, /picks\[index\] = \{[\s\S]*?number: parsed/);
  assert.doesNotMatch(renderer, /amount\.min\s*=\s*'1'/);
  assert.doesNotMatch(renderer, /amount <= 0/);
});

test('all configured Selection Fields use the Atlas combobox/chip editor', () => {
  assert.match(renderer, /function usesAtlasSelectionEditor\(field: ForgeField\): boolean \{/);
  assert.match(renderer, /field\.type === 'choice'[\s\S]*?Array\.isArray\(field\.options\).*?field\.open === true/);
  assert.equal((renderer.match(/if \(usesAtlasSelectionEditor\(field\)\)/g) ?? []).length, 3,
    'live statblock, Table cells, and template sample editors share Atlas Selection UI');
  assert.match(renderer, /selectionEditor = createSelectionEditorDom\(field, sample\[field\.key\], runtime\.language\)/);
});

test('Selection Fields in Metrics use the same registered inline editor as every other block', () => {
  const metric = between(renderer, 'function renderMetric(', 'function normalizeTableCellValue(');
  assert.match(metric, /const isSelectionMetric = !formula && field\?\.type === 'choice'/);
  assert.match(metric, /isSelectionMetric && numericRuntime\?\.canEdit && field/);
  assert.match(metric, /createInlineTextFieldValue\(/);
  assert.match(metric, /selectionFieldValueText\(field, valueOf\(sample, key\)\)/);
  assert.match(renderer, /case 'metric': return renderMetric\(app, markdownComponent, sourcePath, block, fields, sample, layout, numericRuntime/);
  assert.match(renderer, /const targets = region\.type === 'metric'[\s\S]*?region\.slots\.filter\(\(\{ definition \}\) => definition\.fieldKey === fieldKey\)/);
  assert.match(renderer, /selectionRegionsBySlot\.set\(slot\.node, region\)/);
});

test('Selection ownership resolves through the nearest Forge block, not a nested Atlas frame', () => {
  assert.match(renderer, /'\.statblock-forge__preview-block\[data-block-id\], \.atlas-sb-header \[data-block-id\]'/);
  assert.match(renderer, /slot\.closest\('\.statblock-forge__preview-block\[data-block-id\]'\) === root/);
  assert.doesNotMatch(renderer, /if \(!isMetricRegion\) return slot\.closest\('\[data-block-id\]'\) === root/);
});

test('all Selection slots use one card-level capture route regardless of block type', () => {
  assert.match(renderer, /const selectionRegionsBySlot = new Map<HTMLElement, InlineEditRegion>\(\)/);
  assert.match(renderer, /fieldsByKey\.get\(slot\.definition\.fieldKey\)\?\.type === 'choice'/);
  assert.match(renderer, /card\.addEventListener\('click',[\s\S]*?selectionRegionsBySlot\.get\(slot\)[\s\S]*?openRegion\(region, fieldKey\)/);
  assert.match(renderer, /event\.stopImmediatePropagation\(\)/);
  assert.doesNotMatch(renderer, /data-forge-metric-selection/);
});

test('Selection choices and values are displayed in the Atlas-compatible serialized format', () => {
  assert.match(renderer, /function selectionFieldValueText\(field: ForgeField, rawValue: unknown\): string \{/);
  assert.match(renderer, /serializeSelectionFieldPicks\(field, read\.picks\)/);
  assert.match(renderer, /else display\.textContent = text \|\| '—'/);
});

test('Allow other values remains available with the Atlas option list', () => {
  assert.match(renderer, /const allowOther = field\.open === true/);
  assert.match(renderer, /if \(allowOther && trimmed && !exact\)/);
  assert.match(renderer, /label: pt \? `Usar “\$\{trimmed\}”` : `Use “\$\{trimmed\}”`/);
  assert.match(renderer, /const customPick: SelectionFieldPick = \{[\s\S]*?custom: true/);
  assert.match(renderer, /picks = \[customPick\]/);
});

test('custom Selection picks use the same per-option number editor as configured picks', () => {
  assert.match(renderer, /pick\.custom \? ' atlas-sb-pane-pick--custom' : ''/);
  assert.match(renderer, /if \(numbered\) \{[\s\S]*?atlas-sb-pane-pick__number/);
  assert.match(renderer, /\.\.\.\(pick\.custom \? \{ custom: true \} : \{\}\)/);
});

test('single-pick Selection replaces the previous choice while multi-pick Selection preserves chips', () => {
  assert.match(renderer, /} else if \(multiple\) \{/);
  assert.match(renderer, /picks = \[\{\s*option: option\.value/);
  assert.match(renderer, /const customPick: SelectionFieldPick = \{[\s\S]*?custom: true/);
  assert.match(renderer, /picks = \[\.\.\.picks, customPick\]/);
});

test('live Table and template sample editors support structured Selection values', () => {
  assert.match(renderer, /onValueEdit && runtime\?\.canEdit && !isFormulaBackedDice && \(isPrimitiveValue \|\| field\.type === 'choice'\)/);
  assert.match(renderer, /onValueEdit && !runtime\?\.canEdit && \(isPrimitiveValue \|\| field\.type === 'choice'\)/);
  assert.match(renderer, /const editor = createSelectionEditorDom\(field, current, language\)/);
  assert.match(renderer, /selectionEditor\.root\.addEventListener\('focusout'/);
  assert.match(renderer, /selectionEditor\?\.destroy\(\)/);
});

test('Atlas Selection controls use the Atlas inline-field, chip, dropdown, and number styling', () => {
  for (const selector of [
    '.statblock-forge__statblock .statblock-forge__selection-atlas {',
    '.statblock-forge__statblock .statblock-forge__selection-atlas .atlas-sb-pane-selection-chips',
    '.statblock-forge__statblock .statblock-forge__selection-atlas .atlas-sb-pane-pick__add',
    '.statblock-forge__statblock .statblock-forge__selection-atlas .atlas-sb-pane-choice__chevron',
    '.statblock-forge__statblock .statblock-forge__selection-atlas input.atlas-sb-pane-input.atlas-sb-pane-pick__number',
    '.atlas-vtt-plugin.atlas-sb-pane-options {',
    '.atlas-vtt-plugin.atlas-sb-pane-options .atlas-sb-pane-option',
    '.statblock-forge__statblock .statblock-forge__selection-atlas .atlas-sb-pane-chip',
  ]) {
    assert.ok(selectionStyles.includes(selector), `missing SCSS selector ${selector}`);
    assert.ok(styles.includes(selector), `missing compiled CSS selector ${selector}`);
  }
  assert.doesNotMatch(selectionStyles, /\.statblock-forge__selection-atlas:focus-within/,
    'Atlas leaves the inline field unboxed rather than drawing a separate focus border');
});

test('Selection popovers are treated as editor-owned interactions inside Atlas blocks', () => {
  assert.match(renderer, /const ownInteractions = '[^']*\.statblock-forge__selection-atlas/);
  assert.match(renderer, /popup\.addEventListener\('mousedown', \(event\) => event\.preventDefault\(\)\)/);
  assert.match(renderer, /node\.addEventListener\('mousedown', \(event\) => event\.preventDefault\(\)\)/);
});


test('Selection options portal through the Atlas host and carry their surface owner', () => {
  assert.match(renderer, /const portalHost = \(\): HTMLElement => \{/);
  assert.match(renderer, /:scope > \.atlas-portal-host/);
  assert.match(renderer, /element\('div', 'atlas-vtt-plugin atlas-sb-pane-options'\)/);
  assert.match(renderer, /root\.closest<HTMLElement>\('\[data-atlas-surface\]'\)/);
  assert.match(renderer, /popup\.setAttribute\('data-atlas-owner', surface\)/);
  assert.match(renderer, /portalHost\(\)\.append\(popup\)/);
});

test('Selection popup listeners are removed when the inline editor closes', () => {
  assert.match(renderer, /selectionEditor\?\.destroy\(\);\s*slot\.close\(layer, display\)/);
  assert.match(renderer, /view\?\.removeEventListener\('scroll', positionPopup, true\)/);
  assert.match(renderer, /view\?\.removeEventListener\('resize', positionPopup\)/);
});
