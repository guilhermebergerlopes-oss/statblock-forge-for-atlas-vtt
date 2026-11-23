import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Checkboxes row and inline layouts have explicit shared preview/final styles', async () => {
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(styles, /\.statblock-forge__preview-checkboxes-list\.is-rows\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);[^}]*width:\s*100%;/s);
  assert.match(styles, /\.statblock-forge__preview-checkboxes-list\.is-rows\s*>\s*\.statblock-forge__preview-checkbox-option\s*\{[^}]*display:\s*flex;[^}]*width:\s*100%;[^}]*padding:\s*0\.2rem 0;[^}]*border-bottom:/s);
  assert.match(styles, /\.statblock-forge__preview-checkboxes-list\.is-inline\s*\{[^}]*display:\s*flex;[^}]*flex-flow:\s*row wrap;[^}]*gap:\s*0\.4rem 0\.85rem;/s);
  assert.match(styles, /\.statblock-forge__preview-checkboxes-list\.is-inline\s*>\s*\.statblock-forge__preview-checkbox-option\s*\{[^}]*width:\s*auto;[^}]*border:\s*0;/s);
});

test('preview and final statblocks share the Field-selected Checkboxes layout', async () => {
  const renderer = await readFile(new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8');
  assert.match(renderer, /case 'checkboxes': return renderCheckboxes\(block, field, sample, onFieldValueChange, numericRuntime\)/);
  assert.match(renderer, /statblock-forge__preview-checkboxes-list is-\$\{checkboxFieldOptionLayout\(field\)\}/);
  assert.match(renderer, /export function renderStatblockPreview\(options: StatblockPreviewOptions\): HTMLElement \{\s*return renderStatblock\(/);
});

test('Checkboxes Field editor exposes a per-Field layout and refreshes the preview', async () => {
  const editor = await readFile(new URL('../src/views/templateCheckboxFieldEditor.ts', import.meta.url), 'utf8');
  const localization = await readFile(new URL('../src/i18n/localization.ts', import.meta.url), 'utf8');
  assert.match(editor, /selectInput\(checkboxFieldOptionLayout\(field\)/);
  assert.match(editor, /field\.optionLayout = optionLayout\.value === 'inline' \? 'inline' : 'rows'/);
  assert.match(editor, /context\.renderPreviewOnly\(\)/);
  assert.match(localization, /'Option layout':\s*\{\s*en:/);
  assert.match(localization, /'Inline, wrap as needed':\s*\{\s*en:/);
});

test('final Checkbox edits refresh dependent formulas only after asynchronous persistence', async () => {
  const renderer = await readFile(new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8');
  const checkboxRenderer = renderer.slice(
    renderer.indexOf('function renderCheckboxes('),
    renderer.indexOf('function renderLeafBlock(', renderer.indexOf('function renderCheckboxes(')),
  );
  assert.match(checkboxRenderer, /const result = onFieldValueChange\?\.\(field\.key, next\);[\s\S]*?Promise\.resolve\(result\)\.then\([\s\S]*?refreshDependentFields,[\s\S]*?rollbackCheckboxValue/);
  assert.doesNotMatch(checkboxRenderer, /syncCheckboxInputs\(\);\s*numericRuntime\?\.refreshAll\(\);\s*try/);
  assert.match(checkboxRenderer, /else \{\s*refreshDependentFields\(\);\s*\}/);
});
