import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { translateForgeText } from '../src/i18n/localization.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('Forge shortcut setting labels are localized according to the selected interface language', async () => {
  const source = await readFile(resolve(root, 'src/settings/ForgeSettingTab.ts'), 'utf8');
  assert.match(source, /\.setName\('Statblock Mode shortcut'\)/);
  assert.match(source, /\.setName\('Template folder'\)/);
  assert.match(source, /\.setName\('Statblock notes folder'\)/);
  assert.doesNotMatch(source, /setName\('Pasta de templates'\)|setName\('Pasta para notas de statblock'\)/);
  assert.match(source, /\.setDesc\('Click the field and press a key combination/);
  assert.match(source, /\.setButtonText\('Reset to default'\)/);
  assert.match(source, /\.setButtonText\('Download documentation'\)/);
  assert.match(source, /\.setButtonText\('Import \.forgestyle'\)/);
  assert.match(source, /\.setButtonText\('Export style library'\)/);
  assert.match(source, /localizeForgeElement\(containerEl, normalizeForgeLanguage/);
  assert.equal(translateForgeText('Statblock Mode shortcut', 'en'), 'Statblock Mode shortcut');
  assert.equal(translateForgeText('Statblock Mode shortcut', 'pt-BR'), 'Atalho do Modo statblock');
  assert.equal(translateForgeText('Template folder', 'en'), 'Template folder');
  assert.equal(translateForgeText('Template folder', 'pt-BR'), 'Pasta de templates');
  assert.equal(translateForgeText('Statblock notes folder', 'pt-BR'), 'Pasta para notas de statblock');
  assert.match(translateForgeText('Click the field and press a key combination. Use at least one modifier: Mod (Ctrl on Windows/Linux or Cmd on macOS), Ctrl, Alt, or Shift. The shortcut works while the Forge editor is active and focus is outside text inputs.', 'pt-BR'), /^Clique no campo/);
  assert.equal(translateForgeText('Reset to default', 'pt-BR'), 'Restaurar padrão');
  assert.equal(translateForgeText('Documentation folder', 'pt-BR'), 'Pasta da documentação');
  assert.equal(translateForgeText('Download documentation', 'pt-BR'), 'Baixar documentação');
  assert.equal(translateForgeText('Style library', 'pt-BR'), 'Biblioteca de estilos');
  assert.equal(translateForgeText('Import .forgestyle', 'pt-BR'), 'Importar .forgestyle');
  assert.equal(translateForgeText('Export style library', 'pt-BR'), 'Exportar biblioteca de estilos');
  assert.equal(translateForgeText('Statblock Forge for Atlas VTT', 'pt-BR'), 'Statblock Forge para Atlas VTT');
  assert.equal(translateForgeText('Language', 'pt-BR'), 'Idioma');
});

test('Atlas export success messages and compatibility warnings follow the Forge interface language', () => {
  const message = 'Exportação concluída: atlas-vtt/templates/creature.atlastemplate. Grid, Dense e aparência exclusivos do Forge não são transferidos para o Atlas. Avisos de compatibilidade: A Ability Part Counter "Mana" será exportada como texto no Atlas (ex.: 2/3). O Forge restaura as marcas e o máximo ao abrir esta mesma nota. O campo "Legacy" usa o tipo "custom-value", que não está no formato verificado do Atlas. O valor será preservado no arquivo, mas o Atlas pode ignorá-lo ou tratá-lo como texto.';
  const english = translateForgeText(message, 'en');
  assert.match(english, /^Export completed:/);
  assert.match(english, /Forge-only Grid, Dense/);
  assert.match(english, /Compatibility warnings:/);
  assert.match(english, /Ability Part Counter "Mana" will be exported as text/);
  assert.match(english, /The field "Legacy" uses type "custom-value"/);
  assert.doesNotMatch(english, /Exportação|Avisos de compatibilidade|será exportada|não está no formato/);
  assert.equal(translateForgeText(message, 'pt-BR'), message);

  const noWarnings = 'Exportação concluída: atlas-vtt/templates/creature.atlastemplate. Grid, Dense e aparência exclusivos do Forge não são transferidos para o Atlas. Os tipos de campos e Ability Parts foram reconhecidos pelo formato Atlas verificado.';
  const noWarningsEnglish = translateForgeText(noWarnings, 'en');
  assert.match(noWarningsEnglish, /^Export completed:/);
  assert.match(noWarningsEnglish, /Field and Ability Part types match the verified Atlas format/);

  const failure = 'Statblock Forge: falha ao exportar para Atlas: A pasta de exportação do Atlas não pode ficar vazia.';
  assert.equal(translateForgeText(failure, 'en'), 'Statblock Forge: failed to export to Atlas: The Atlas export folder cannot be empty.');
  assert.equal(translateForgeText('Statblock Forge: falha ao publicar para Atlas: A pasta de exportação do Atlas não pode ficar vazia.', 'en'), 'Statblock Forge: could not publish to Atlas: The Atlas export folder cannot be empty.');
});

test('Atlas compatibility warning variants are translated when embedded in the export notice', () => {
  const warning = 'Avisos de compatibilidade: A Ability Part "Charge" usa o tipo desconhecido "mystery". Ele será mantido sem conversão; o Atlas pode interpretá-lo como texto. O bloco "CustomGrid" não pertence ao catálogo verificado do Atlas. Sua estrutura será preservada, mas a renderização nativa pode ignorá-lo.';
  const english = translateForgeText(warning, 'en');
  assert.match(english, /^Compatibility warnings:/);
  assert.match(english, /Ability Part "Charge" uses the unknown type "mystery"/);
  assert.match(english, /block "CustomGrid" is not part of the verified Atlas catalog/);
  assert.equal(translateForgeText(warning, 'pt-BR'), warning);
});


test('package metadata and bundled documentation remain on release 0.4.4', async () => {
  const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
  const ptDocs = await readFile(resolve(root, 'src/documentation/documentationPackage.ts'), 'utf8');
  const enDocs = await readFile(resolve(root, 'src/documentation/documentationPackage.en.ts'), 'utf8');
  assert.equal(packageJson.version, '0.4.4');
  assert.equal(manifest.version, '0.4.4');
  assert.match(ptDocs, /v0\.4\.4/);
  assert.match(enDocs, /v0\.4\.4/);
  assert.ok(manifest.description.length < 250);
  assert.ok(packageJson.description.length < 250);
  assert.ok(!manifest.description.startsWith(manifest.name));
  assert.doesNotMatch(manifest.description, /obsidian|vault|atlas|plugin|extension|workspace|note/i);
  assert.equal(packageJson.description, manifest.description);
  assert.equal(manifest.authorUrl, 'https://github.com/guilhermebergerlopes-oss');
  assert.doesNotMatch(ptDocs, /Configurações do Obsidian → Atalhos/);
  assert.doesNotMatch(enDocs, /Obsidian Settings → Hotkeys/);
});
