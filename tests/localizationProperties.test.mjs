import test from 'node:test';
import assert from 'node:assert/strict';
import { translateForgeText } from '../src/i18n/localization.ts';

test('the Properties width control is translated in English and Portuguese', () => {
  assert.equal(translateForgeText('Width (12 parts)', 'en'), 'Width (12 parts)');
  assert.equal(translateForgeText('Width (12 parts)', 'pt-BR'), 'Largura (partes de 12)');
});

test('the dynamic row-height control is translated in English', () => {
  assert.equal(translateForgeText('Altura (linhas — até 24)', 'en'), 'Height (rows — up to 24)');
  assert.equal(translateForgeText('Altura (linhas — até 24)', 'pt-BR'), 'Altura (linhas — até 24)');
});

test('the Counters per row control is translated in English and Portuguese', () => {
  assert.equal(translateForgeText('Counters per row', 'en'), 'Counters per row');
  assert.equal(translateForgeText('Counters per row', 'pt-BR'), 'Counters por linha');
});

test('the Template Editor Data tab is translated in English and Portuguese', () => {
  assert.equal(translateForgeText('Data', 'en'), 'Data');
  assert.equal(translateForgeText('Data', 'pt-BR'), 'Dados');
  assert.equal(translateForgeText('Select a Field in Data or a block on the Canvas to edit its settings.', 'pt-BR'), 'Selecione um Field em Dados ou um bloco no Canvas para editar suas configurações.');
});
