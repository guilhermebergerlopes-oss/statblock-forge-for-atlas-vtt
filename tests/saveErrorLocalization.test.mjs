import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { translateForgeText } from '../src/i18n/localization.ts';

const saveModal = await readFile(new URL('../src/views/TemplateSaveModal.ts', import.meta.url), 'utf8');
const editor = await readFile(new URL('../src/views/TemplateEditorView.ts', import.meta.url), 'utf8');

test('Save modal localizes returned and rejected errors in the selected language', () => {
  assert.match(saveModal, /failed = translateForgeText\(error, language\)/);
  assert.match(saveModal, /failed = translateForgeText\(error instanceof Error \? error\.message : String\(error\), language\)/);
});

test('save validation translates each issue before composing the final error', () => {
  assert.match(editor, /const localizedMessages = messages\.slice\(0, 4\)\.map\(\(message\) => translateForgeText\(message, language\)\)/);
  assert.match(editor, /translateForgeText\('Could not save:', language\)/);
});

test('composed save errors translate the detail instead of leaving Portuguese after the prefix', () => {
  assert.equal(
    translateForgeText('Não foi possível salvar: A chave "bad key" não é válida.', 'en'),
    'Could not save: Key "bad key" is invalid.',
  );
});

test('save failures from template storage are translated, including source deletion and folder collisions', () => {
  assert.equal(
    translateForgeText('O arquivo do template foi excluído ou movido. Reabra-o para evitar salvar sobre uma origem inexistente.', 'en'),
    'The template file was deleted or moved. Reopen it to avoid saving over a missing source.',
  );
  assert.equal(
    translateForgeText('O caminho templates/creatures é um arquivo, não uma pasta.', 'en'),
    'The path templates/creatures is a file, not a folder.',
  );
  assert.equal(
    translateForgeText('Já existe um template chamado Goblin. Escolha outro nome.', 'en'),
    'A template named Goblin already exists. Choose another name.',
  );
});

test('save conflict and duplicate-template errors are localized in English', () => {
  assert.equal(
    translateForgeText('O arquivo foi alterado fora do Forge desde que foi aberto. Reabra-o para evitar sobrescrever mudanças recentes.', 'en'),
    'The file was changed outside Forge after it was opened. Reopen it to avoid overwriting recent changes.',
  );
  assert.equal(
    translateForgeText('Já existe um template com este nome. Confirme se deseja substituí-lo.', 'en'),
    'A template with this name already exists. Confirm whether you want to replace it.',
  );
});

test('nested recovery-copy save errors translate both wrapper and underlying detail', () => {
  assert.equal(
    translateForgeText('Não foi possível salvar uma cópia de recuperação: O caminho templates/creatures é um arquivo, não uma pasta.', 'en'),
    'Could not save a recovery copy: The path templates/creatures is a file, not a folder.',
  );
});

test('Portuguese interface keeps native Portuguese save errors', () => {
  const message = 'O caminho templates/creatures é um arquivo, não uma pasta.';
  assert.equal(translateForgeText(message, 'pt-BR'), message);
});
