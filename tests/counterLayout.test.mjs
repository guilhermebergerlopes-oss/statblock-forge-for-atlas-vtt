import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeCountersPerRow, setCountersPerRow, DEFAULT_COUNTERS_PER_ROW } from '../src/templates/counterLayoutModel.ts';
import { createBlankTemplate, createForgeLayout, parseForgeLayout } from '../src/templates/forgeTemplate.ts';

const readSource = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Counters per row defaults to two columns for older Blocks', () => {
  assert.equal(normalizeCountersPerRow(undefined), DEFAULT_COUNTERS_PER_ROW);
  assert.equal(DEFAULT_COUNTERS_PER_ROW, 2);
});

test('Counters per row accepts any positive whole number without an artificial upper limit', () => {
  assert.equal(normalizeCountersPerRow(0), 1);
  assert.equal(normalizeCountersPerRow(3.9), 3);
  assert.equal(normalizeCountersPerRow(6), 6);
  assert.equal(normalizeCountersPerRow(99), 99);
  assert.equal(normalizeCountersPerRow(1200), 1200);
  assert.equal(normalizeCountersPerRow('300'), 300);
  assert.equal(normalizeCountersPerRow(''), DEFAULT_COUNTERS_PER_ROW);
  assert.equal(normalizeCountersPerRow(Number.NaN), DEFAULT_COUNTERS_PER_ROW);
});

test('Counter definitions stay in Fields and are not duplicated in Block properties', async () => {
  const editor = await readSource('../src/views/templateCounterPresetsEditor.ts');
  const fieldEditor = await readSource('../src/views/templateFieldEditor.ts');
  const blockEditor = await readSource('../src/views/TemplateEditorView.ts');
  const countersInspector = await readSource('../src/views/templateCountersBlockInspector.ts');
  assert.doesNotMatch(editor, /countersPerRow/);
  assert.match(fieldEditor, /renderCounterPresets\(field,?\)/);
  assert.doesNotMatch(blockEditor, /panel\.append\(renderCounterPresets\(specialized,\s*counterField\)\)/);
  assert.match(blockEditor, /renderCountersBlockInspector\(blockInspectorContext, panel\)/);
  assert.match(countersInspector, /numberInput\(current, 1, undefined, 1\)/);
  assert.doesNotMatch(countersInspector, /selectInput|MAX_COUNTERS_PER_ROW/);
  assert.match(countersInspector, /setCountersPerRow\(layout, block\.id/);
});

test('live Counter tracks lay out names side by side with each indicator group beneath its own name', async () => {
  const renderer = await readSource('../src/render/statblockPreviewRenderer.ts');
  const help = await readSource('../src/views/componentHelp.ts');
  const css = await readSource('../styles.css');
  assert.match(renderer, /const countersPerRow = normalizeCountersPerRow\(layout\.blocks\[block\.id\]\?\.countersPerRow/);
  assert.match(renderer, /gridTemplateColumns: `repeat\(\$\{countersPerRow\}, minmax\(0, 1fr\)\)`/);
  assert.match(renderer, /display: 'grid'/);
  assert.match(renderer, /row\.append\(name\)/);
  assert.match(renderer, /row\.append\(main\)/);
  assert.doesNotMatch(renderer, /main\.append\(name\)/);
  assert.match(renderer, /main\.setCssStyles\(\{ flexDirection: 'column' \}\)/);
  assert.match(renderer, /main\.setCssStyles\(\{ justifyContent: 'center' \}\)/);
  assert.match(renderer, /name\.setCssStyles\(\{ width: '100%' \}\)/);
  assert.match(renderer, /pips\.setCssStyles\(\{ justifyContent: 'center' \}\)/);
  assert.match(renderer, /pips\.setCssStyles\(\{ width: 'max-content' \}\)/);
  assert.match(help, /row\.append\(make\('span', 'statblock-forge__preview-counter-name', name\)\)/);
  assert.match(help, /row\.append\(main\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /statblock-forge__preview-counter-main \{ display: flex; flex-direction: column;[^}]*align-items: center;[^}]*justify-content: center/);
  assert.match(css, /statblock-forge__preview-counter-pips \{[^}]*justify-content: center;[^}]*width: max-content;[^}]*max-width: 100%/);
  assert.match(css, /statblock-forge__preview-counter-name \{[^}]*width: 100%/);
  assert.match(css, /\.statblock-forge__statblock \.atlas-sb-counter__pips \{[^}]*justify-content: center;[^}]*flex-wrap: wrap;[^}]*width: max-content/);
});

test('Counter column count is stored per Block and survives older sidecar normalization', () => {
  const template = createBlankTemplate('Counter layout');
  template.fields.push({ key: 'resources', label: 'Resources', type: 'counters', counterRows: [] });
  template.layout.blocks.push({ id: 'counter-block', type: 'counters', field: 'resources' });
  const defaults = createForgeLayout(template);
  assert.equal(defaults.blocks['counter-block'].countersPerRow, DEFAULT_COUNTERS_PER_ROW);

  const oldSidecar = {
    ...defaults,
    blocks: { 'counter-block': { span: 12, rows: 1, appearance: {} } },
  };
  const parsed = parseForgeLayout(JSON.stringify(oldSidecar), template);
  assert.equal(parsed.blocks['counter-block'].countersPerRow, DEFAULT_COUNTERS_PER_ROW);

  const customizedSidecar = {
    ...oldSidecar,
    blocks: { 'counter-block': { ...oldSidecar.blocks['counter-block'], countersPerRow: 5 } },
  };
  const customized = parseForgeLayout(JSON.stringify(customizedSidecar), template);
  assert.equal(customized.blocks['counter-block'].countersPerRow, 5);

  const unboundedSidecar = {
    ...oldSidecar,
    blocks: { 'counter-block': { ...oldSidecar.blocks['counter-block'], countersPerRow: 24 } },
  };
  assert.equal(parseForgeLayout(JSON.stringify(unboundedSidecar), template).blocks['counter-block'].countersPerRow, 24);
});

test('changing the number of Counters per row updates only the selected Block layout', () => {
  const layout = { blocks: { one: { countersPerRow: 2 }, two: { countersPerRow: 3 } } };
  assert.equal(setCountersPerRow(layout, 'one', 14), true);
  assert.equal(layout.blocks.one.countersPerRow, 14);
  assert.equal(layout.blocks.two.countersPerRow, 3);
  assert.equal(setCountersPerRow(layout, 'one', 14), false);
  assert.equal(setCountersPerRow(layout, 'missing', 4), false);
});


test('Counter indicator groups size to their marker count and center each wrapped line', async () => {
  const renderer = await readSource('../src/render/statblockPreviewRenderer.ts');
  const css = await readSource('../styles.css');
  assert.match(renderer, /pips\.setCssStyles\(\{ flexWrap: 'wrap' \}\)/);
  assert.match(renderer, /pips\.setCssStyles\(\{ justifyContent: 'center' \}\)/);
  assert.match(renderer, /pips\.setCssStyles\(\{ width: 'max-content' \}\)/);
  assert.match(renderer, /pips\.setCssStyles\(\{ maxWidth: '100%' \}\)/);
  assert.match(css, /statblock-forge__preview-counter-pips \{[^}]*justify-content: center;[^}]*width: max-content;[^}]*max-width: 100%/);
  assert.match(css, /\.statblock-forge__statblock \.atlas-sb-counter__pips \{[^}]*justify-content: center;[^}]*flex-wrap: wrap;[^}]*width: max-content;[^}]*max-width: 100%/);
});


test('Counter marker geometry is identical in Template Editor previews and open statblocks', async () => {
  const renderer = await readSource('../src/render/statblockPreviewRenderer.ts');
  const css = await readSource('../styles.css');
  // Passive pips get a same-size cell as interactive buttons; both renderers
  // now use 0.74rem cells containing a 0.66rem marker, with no extra group gap.
  assert.match(renderer, /pips\.setCssStyles\(\{ gap: '0' \}\)/);
  assert.match(renderer, /const hitbox = element\('span', 'atlas-sb-counter__pip-hitbox'\)/);
  assert.match(css, /\.statblock-forge__statblock :is\(\.atlas-sb-counter__pip-button, \.atlas-sb-counter__pip-hitbox\)[^}]*width: 0\.74rem;[^}]*height: 0\.74rem/);
  assert.match(css, /\.statblock-forge__statblock \.atlas-sb-counter__pip \{[^}]*width: 0\.66rem;[^}]*height: 0\.66rem/);
  assert.doesNotMatch(css, /\.statblock-forge \.atlas-sb-counter__pip-button \{/);
});

test('Template Editor renames the visible Structure tab to Data without changing its saved internal key', async () => {
  const editor = await readSource('../src/views/TemplateEditorView.ts');
  const draftStorage = await readSource('../src/templates/templateEditorDraftStorage.ts');
  const localization = await readSource('../src/i18n/localization.ts');
  assert.match(editor, /createTab\('structure', 'Data'\)/);
  assert.match(editor, /private sidebarTab: 'structure'/);
  assert.match(draftStorage, /'structure', 'properties', 'appearance'/);
  assert.match(localization, /'Data': \{ en: 'Data', 'pt-BR': 'Dados' \}/);
  assert.doesNotMatch(editor, /createTab\('structure', 'Structure'\)/);
});
