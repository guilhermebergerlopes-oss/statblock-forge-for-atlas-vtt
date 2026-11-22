import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rendererUrl = new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url);
const stylesUrl = new URL('../styles.css', import.meta.url);
const inspectorUrl = new URL('../src/views/templateScoresBlockInspector.ts', import.meta.url);
const containerModelUrl = new URL('../src/templates/containerEditorModel.ts', import.meta.url);
const statblockSurfaceUrl = new URL('../src/views/StatblockRenderSurface.ts', import.meta.url);

test('Table preview renders only its ordered child Fields through one renderer', async () => {
  const renderer = await readFile(rendererUrl, 'utf8');
  assert.match(renderer, /function renderTableFields\(/);
  assert.match(renderer, /const showColumnLabels = block\.showColumnLabels !== false/);
  assert.match(renderer, /const showRowLabels = block\.showRowLabels === true/);
  assert.match(renderer, /if \(showColumnLabels \|\| showRowLabels \|\| editableRows\)/);
  assert.match(renderer, /if \(showRowLabels\) \{/);
  assert.match(renderer, /if \(showColumnLabels\) childFields\.forEach/);
  assert.match(renderer, /actionsHeading\.setAttribute\('aria-label', language === 'pt-BR' \? 'Ações da linha' : 'Row actions'\)/);
  assert.match(renderer, /labelCell\.textContent = label \|\|/);
  assert.match(renderer, /if \(onEdit\) \{/);
  assert.match(renderer, /statblock-forge__table-row-label-editor/);
  assert.match(renderer, /type: 'set-row-label', row: rowIndex, value/);
  assert.match(renderer, /th\.scope = 'col'/);
  assert.match(renderer, /const editableRows = editable && \(typeof onEdit === 'function' \|\| block\.allowRowAdd === true\)/);
  assert.match(renderer, /type: 'add-row'/);
  assert.match(renderer, /type: 'set-row-cell'/);
  assert.match(renderer, /function renderScores\(/);
  assert.match(renderer, /const linkedKeys = Array\.isArray\(block\.fields\)/);
  assert.match(renderer, /candidate\.type !== 'pairs' && candidate\.type !== 'scores'/);
  assert.doesNotMatch(renderer, /renderPairsTable|buildTablePairsModel|pairRows|set-pair-cell|set-pair-key/);
  assert.doesNotMatch(renderer, /block\.orientation|block\.perLine|block\.columns/);
});

test('editable statblocks provide the Table row editor with a persistent Field-value callback', async () => {
  const [renderer, surface] = await Promise.all([
    readFile(rendererUrl, 'utf8'),
    readFile(statblockSurfaceUrl, 'utf8'),
  ]);
  assert.match(renderer, /canEdit: typeof onValueChange === 'function'/);
  assert.match(renderer, /const editableRows = editable && \(typeof onEdit === 'function' \|\| block\.allowRowAdd === true\)/);
  assert.match(renderer, /Template Builder always exposes row controls/);
  assert.match(surface, /onFieldValueChange: \(fieldKey, value\) => this\.saveInlineFieldValue\(source, fieldKey, value\)/);
  assert.match(renderer, /runtime\.setBaseValue\(storageFieldKey, next\)/);
});

test('Table inspector exposes label orientation and ordered Field management, not Pair or Columns configuration', async () => {
  const inspector = await readFile(inspectorUrl, 'utf8');
  assert.match(inspector, /showColumnLabels/);
  assert.match(inspector, /Show Labels in columns/);
  assert.match(inspector, /showRowLabels/);
  assert.match(inspector, /Show Labels in rows/);
  assert.match(inspector, /Allow adding rows in statblocks/);
  assert.match(inspector, /Show Labels in columns/);
  assert.match(inspector, /Show Labels in rows/);
  assert.match(inspector, /moveFieldWithinContainer/);
  assert.match(inspector, /Move Field up/);
  assert.match(inspector, /Move Field down/);
  assert.match(inspector, /addFieldToContainer/);
  assert.match(inspector, /Remove Field/);
  assert.doesNotMatch(inspector, /Remove Fields/);
  assert.doesNotMatch(inspector, /Add Pair|registerTemplateField|Calculated columns|Grid columns|perLine|orientation|setScoresFieldColumns/);
});

test('Table container model rejects Pairs and removes old pair/column links during migration', async () => {
  const model = await readFile(containerModelUrl, 'utf8');
  assert.match(model, /const TABLE_FIELD_TYPES = new Set\(\[/);
  assert.match(model, /field\.type !== 'pairs'/);
  assert.match(model, /delete block\.pairRows/);
  assert.match(model, /delete block\.columns/);
  assert.match(model, /delete block\.orientation/);
  assert.match(model, /delete block\.perLine/);
  assert.doesNotMatch(model, /setScoresFieldColumns|setScoresFieldAlignment|setScoresFieldProperty|slotKeys/);
});

test('Table Field renderers retain native controls for Choice, Counter, and Collection Fields', async () => {
  const renderer = await readFile(rendererUrl, 'utf8');
  assert.match(renderer, /field\.type === 'choice' && Array\.isArray\(field\.options\)/);
  assert.match(renderer, /if \(field\.type === 'counters'\)/);
  assert.match(renderer, /renderCounters\(/);
  assert.match(renderer, /const nativeSlotBlockType: Record<string, string>/);
  for (const [fieldType, blockType] of [
    ['checkboxes', 'checkboxes'],
    ['list', 'tags'],
    ['entries', 'entries'],
    ['spells', 'spells'],
    ['image', 'image'],
  ]) {
    assert.match(renderer, new RegExp(`${fieldType}: '${blockType}'`));
  }
});

test('Table roll links use the normal visible Field value instead of a separate dice icon', async () => {
  const renderer = await readFile(rendererUrl, 'utf8');
  const model = await readFile(new URL('../src/statblocks/tableCellRollsModel.ts', import.meta.url), 'utf8');
  assert.match(renderer, /block\.rollable === true, onValueEdit/);
  assert.match(renderer, /function tableCellRollText\(/);
  assert.match(renderer, /tableCellRollFormulas\(tableCellRollText\(/);
  assert.match(renderer, /setForgeStatblockDiceLink\(valueNode, formula\)/);
  assert.match(renderer, /const onValueEdit = editable/);
  assert.doesNotMatch(renderer, /appendTableCellRollActions|statblock-forge__table-roll-link/);
  assert.doesNotMatch(renderer, /🎲/);
  assert.match(model, /Explicit dice notation is always rollable/);
  assert.match(model, /rollableBonusFormula\(value, rollable\)/);
});

test('Table delete-row controls use a compact intrinsic-width action column', async () => {
  const [renderer, styles] = await Promise.all([
    readFile(rendererUrl, 'utf8'),
    readFile(stylesUrl, 'utf8'),
  ]);
  assert.match(renderer, /actionsHeading\.setAttribute\('aria-label', language === 'pt-BR' \? 'Ações da linha' : 'Row actions'\)/);
  assert.doesNotMatch(renderer, /actionsHeading\.textContent = .*Actions/);
  assert.match(styles, /\.statblock-forge__preview-table-row-actions-heading,\s*\.statblock-forge__preview-table-row-actions-cell \{ width: 2\.1rem; min-width: 2\.1rem; max-width: 2\.1rem; white-space: nowrap; \}/);
  assert.match(styles, /\.statblock-forge__preview-table-row-actions-cell > \.statblock-forge__inline-scores-table-action \{ width: 1\.65rem; min-width: 1\.65rem; min-height: 1\.65rem; padding: 0; line-height: 1; \}/);
  assert.match(renderer, /statblock-forge__inline-scores-table-action statblock-forge__preview-table-row-remove/);
  assert.match(styles, /\.statblock-forge__statblock \.statblock-forge__preview-table-row-remove \{[\s\S]*?background: var\(--forge-theme-raised/);
  assert.match(styles, /\.statblock-forge__statblock \.statblock-forge__preview-table-row-remove:hover \{[\s\S]*?var\(--forge-theme-accent/);
});

test('Table uses dedicated styles and no longer carries Pair-cell UI styles', async () => {
  const styles = await readFile(stylesUrl, 'utf8');
  assert.match(styles, /\.statblock-forge__preview-table-grid \{ table-layout: fixed; \}/);
  assert.match(styles, /\.statblock-forge__preview-table-row-label/);
  assert.doesNotMatch(styles, /table-pair-cell|preview-pairs-grid/);
});



test('Table data columns receive identical measured widths and only delete actions stay compact', async () => {
  const [renderer, styles] = await Promise.all([
    readFile(rendererUrl, 'utf8'),
    readFile(stylesUrl, 'utf8'),
  ]);
  assert.match(renderer, /const equalColumnCount = childFields\.length \+ \(showRowLabels \? 1 : 0\)/);
  assert.match(renderer, /const minimumDataColumnWidthRem = 2\.25/);
  assert.match(renderer, /const availableWidth = Math\.max\(0, wrapper\.clientWidth - horizontalPadding\)/);
  assert.match(renderer, /const dataColumnWidthPx = Math\.max\([\s\S]*minimumDataColumnWidthPx,[\s\S]*\(availableWidth - actionsWidthPx\) \/ equalColumnCount/);
  assert.match(renderer, /table\.style\.width = `\$\{tableWidthPx\}px`/);
  assert.match(renderer, /column\.style\.width = `\$\{dataColumnWidthPx\}px`/);
  assert.match(renderer, /cell\.style\.width = `\$\{dataColumnWidthPx\}px`/);
  assert.match(renderer, /data-table-data-column/);
  assert.match(renderer, /new ResizeObserver/);
  assert.match(renderer, /resizeObserver\.observe\(wrapper\)/);
  assert.match(renderer, /statblock-forge__preview-table-cell--\$\{field\.type\}/);
  assert.match(styles, /\.statblock-forge__preview-table-row-label,\s*\.statblock-forge__preview-table-row-label-heading \{ min-width: 0; width: auto;/);
  assert.match(styles, /\.statblock-forge__preview-table-cell \{ min-width: 0; \}/);
  assert.ok(styles.includes('.statblock-forge__preview-table-cell--number .statblock-forge__preview-numeric-field-value'));
  assert.ok(styles.includes('overflow-wrap: anywhere;'));
  assert.match(styles, /\.statblock-forge__preview-table-row-actions-column \{ width: 2\.1rem; \}/);
});

test('Table row labels are read-only in statblocks and manually-added rows can be deleted', async () => {
  const fs = await import('node:fs/promises');
  const renderer = await fs.readFile(new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8');
  assert.match(renderer, /if \(onEdit\) \{/);
  assert.match(renderer, /statblock-forge__table-row-label-editor/);
  assert.match(renderer, /type: 'set-row-label', row: rowIndex, value/);
  assert.match(renderer, /type: 'remove-row', row: rowIndex/);
  assert.match(renderer, /isForgeTableRowDeletable\(rowIndex, counterRowCount, stored\.extraRows\.length\)/);
});


test('Template Editor can edit Table row labels while live statblocks keep them read-only', async () => {
  const renderer = await readFile(rendererUrl, 'utf8');
  assert.match(renderer, /if \(onEdit\) \{/);
  assert.match(renderer, /editor\.value = storedLabel/);
  assert.match(renderer, /editor\.addEventListener\('change'/);
  assert.match(renderer, /dispatchEdit\(\{ type: 'set-row-label', row: rowIndex, value \}\)/);
  assert.match(renderer, /labelCell\.textContent = label \|\|/);
});

test('Column-label visibility suppresses both the Table header and nested native Field headings', async () => {
  const [renderer, styles] = await Promise.all([
    readFile(rendererUrl, 'utf8'),
    readFile(stylesUrl, 'utf8'),
  ]);
  assert.match(renderer, /is-column-labels-hidden/);
  assert.match(renderer, /if \(showColumnLabels\) childFields\.forEach/);
  assert.match(renderer, /actionsHeading\.setAttribute\('aria-label', language === 'pt-BR' \? 'Ações da linha' : 'Row actions'\)/);
  assert.match(styles, /statblock-forge__preview-table-grid\.is-column-labels-hidden/);
  assert.match(styles, /statblock-forge__preview-block-heading/);
  assert.match(styles, /atlas-sb-label/);
  assert.match(styles, /statblock-forge__preview-table-grid\.is-column-labels-hidden > thead > tr > th/);
  assert.match(styles, /padding-block: 0 !important;/);
  assert.match(styles, /border: 0 !important;/);
  assert.match(styles, /line-height: 0 !important;/);
});

test('Ctrl-hover preview avoids arbitrary mid-word wrapping while retaining emergency wrapping for long tokens', async () => {
  const styles = await readFile(stylesUrl, 'utf8');
  assert.match(styles, /\.atlas-statblock-preview-window \.statblock-forge__atlas-preview-mount \.statblock-forge__final-card\.atlas-statblock/);
  assert.match(styles, /overflow-wrap: break-word;/);
  assert.match(styles, /word-break: normal;/);
});

test('Table row-label column has no visible heading or redundant Row prefix', async () => {
  const renderer = await readFile(rendererUrl, 'utf8');
  assert.match(renderer, /element\('th', 'statblock-forge__preview-table-row-label-heading'\)/);
  assert.match(renderer, /th\.setAttribute\('aria-label', rowLabelHeader\)/);
  assert.match(renderer, /editor\.placeholder = label \|\| String\(rowIndex \+ 1\)/);
  assert.match(renderer, /labelCell\.textContent = label \|\| String\(rowIndex \+ 1\)/);
  assert.doesNotMatch(renderer, /showColumnLabels \? rowLabelHeader : ''/);
  assert.doesNotMatch(renderer, /label \|\| `\$\{rowLabelHeader\} \ $\{rowIndex \+ 1\}`/);
});

test('all editable Table rows use the same rollable value and cell editor', async () => {
  const renderer = await readFile(rendererUrl, 'utf8');
  assert.match(renderer, /if \(onValueEdit && runtime\?\.canEdit && !isFormulaBackedDice && \(isPrimitiveValue \|\| field\.type === 'choice'\)\)/);
  assert.match(renderer, /statblock-forge__table-row-cell-value/);
  assert.match(renderer, /tableCellRollFormulas\(rollText, rollable\)/);
  assert.match(renderer, /appendForgeStatblockDiceText\(valueNode, displayText, rollable\)/);
  assert.match(renderer, /setForgeStatblockDiceLink\(valueNode, formulas\[0\]\)/);
  assert.match(renderer, /event\.key !== 'F2'/);
  assert.match(renderer, /valueNode\.addEventListener\('click'/);
  assert.match(renderer, /target\?\.closest\('\.statblock-forge__dice-link'\)/);
  assert.match(renderer, /valueNode\.dataset\.noBlockEdit = 'true'/);
  assert.match(renderer, /Click the empty cell area or press F2 to edit; click the value to roll\./);
  assert.match(renderer, /return dispatchEdit\(edit\)\.then\(draw\)/);
  assert.match(renderer, /const onValueEdit = editable/);
  assert.match(renderer, /isCounterField \|\| rowIndex === 0/);
  assert.match(renderer, /cell\.addEventListener\('click'/);
  assert.match(renderer, /statblock-forge__table-sample-cell-editor/);
});


test('Metric empty placeholder names its compatible Field types', async () => {
  const localization = await readFile(new URL('../src/i18n/localization.ts', import.meta.url), 'utf8');
  assert.match(localization, /Drop a compatible Field here\. Compatible Fields: In-line, Number, Rating, Dice and Selection\./);
  assert.match(localization, /Arraste um Field compatível para cá\. Tipos aceitos: In-line, Number, Rating, Dice e Selection\./);
});
