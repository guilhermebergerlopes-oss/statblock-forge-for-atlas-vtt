import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { translateForgeText } from '../src/i18n/localization.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Field removal actions use the explicit Remove Field label in every Field inspector', () => {
  const fieldEditor = read('../src/views/templateFieldEditor.ts');
  const mainEditor = read('../src/views/TemplateEditorView.ts');
  const tableInspector = read('../src/views/templateScoresBlockInspector.ts');

  assert.match(fieldEditor, /button\(translateForgeText\('Remove Field', context\.language\)/);
  assert.match(mainEditor, /translateForgeText\('Remove Field', language\)/);
  assert.match(mainEditor, /translateForgeText\('Remove Field', normalizeForgeLanguage\(this\.plugin\.settings\.language\)\)/);
  assert.match(tableInspector, /button\(translateForgeText\('Remove Field', language\)/);
  assert.doesNotMatch(tableInspector, /translateForgeText\('Remove Fields'/);
});

test('Block deletion uses the singular Delete Block label', () => {
  const mainEditor = read('../src/views/TemplateEditorView.ts');
  assert.match(mainEditor, /translateForgeText\('Delete Block', inspectorLanguage\)/);
  assert.doesNotMatch(mainEditor, /Delete Blocks/);
  assert.equal(translateForgeText('Delete Block', 'en'), 'Delete Block');
  assert.equal(translateForgeText('Delete Block', 'pt-BR'), 'Excluir bloco');
});

test('Metric slot placeholder documents every compatible Field type', () => {
  const metricInspector = read('../src/views/templateMetricBlockInspector.ts');
  assert.match(metricInspector, /translateForgeText\('Compatible Fields: In-line, Number, Rating, Dice and Selection', context\.language\)/);
  assert.equal(
    translateForgeText('Compatible Fields: In-line, Number, Rating, Dice and Selection', 'en'),
    'Compatible Fields: In-line, Number, Rating, Dice and Selection',
  );
  assert.equal(
    translateForgeText('Compatible Fields: In-line, Number, Rating, Dice and Selection', 'pt-BR'),
    'Fields compatíveis: In-line, Number, Rating, Dice e Selection',
  );
});
