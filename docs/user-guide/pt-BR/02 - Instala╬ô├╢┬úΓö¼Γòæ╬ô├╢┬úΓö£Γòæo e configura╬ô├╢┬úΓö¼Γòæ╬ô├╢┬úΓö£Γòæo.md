---
title: Statblock Forge — Instalação e configuração
aliases:
  - Configurar o Statblock Forge
tags:
  - statblock-forge
  - documentação/instalação
parte: 1
---

# Instalação e configuração

Esta nota cobre os requisitos, a instalação manual, as preferências do plugin e o primeiro checklist de configuração.

## Requisitos

- Obsidian **1.8.7 ou superior** (`minAppVersion` do manifesto).
- Obsidian Desktop: o manifesto do Forge declara `isDesktopOnly: true`.
- Para compilar um pacote-fonte: Node.js **22 ou superior** e npm.

A instalação a partir de um ZIP de código-fonte exige compilação. Um ZIP de release pronto para instalação deve conter os arquivos compilados necessários, especialmente `main.js`, além de `manifest.json` e `styles.css`.

## Instalação manual

1. Feche o Obsidian ou desative o plugin antes de substituir uma instalação existente.
2. Crie a pasta `<vault>/.obsidian/plugins/statblock-forge/`.
3. Coloque `main.js`, `manifest.json` e `styles.css` diretamente nessa pasta (não dentro de uma subpasta adicional).
4. Abra o Obsidian e habilite **Statblock Forge for Atlas VTT** em **Settings → Community plugins**.
5. Se a instalação foi atualizada manualmente, recarregue o Obsidian ou desative e reative o plugin se a nova versão não for carregada.

> [!warning] ZIP-fonte não é necessariamente instalável
> Pacotes identificados como `source` contêm TypeScript e arquivos de desenvolvimento. Eles precisam de `npm install` e `npm run build` antes de serem instalados. Não renomeie o arquivo TypeScript para `main.js`.

## Instalação a partir de uma release do Community Plugins

Quando uma release estiver distribuída pelo diretório de plugins comunitários do Obsidian, utilize o fluxo de instalação do próprio Obsidian. A disponibilidade desse método depende de a versão estar efetivamente publicada; não presuma que um pacote-fonte ou uma release de teste já esteja no diretório comunitário.

## Abrir as configurações

Acesse **Settings → Community plugins → Statblock Forge**. A tela contém as preferências abaixo.

| Configuração | O que controla | Valor padrão/comportamento |
|---|---|---|
| **Language** | Idioma da interface e da documentação baixada | `English`; também oferece `Português (Brasil)`. |
| **Statblock Mode shortcut** | Combinação para alternar o modo de prévia no editor de Template | `Mod+Shift+S`. Exige pelo menos um modificador. |
| **Template folder** | Pasta padrão para salvar Templates e cópias | `atlas-vtt/statblock-templates`. |
| **Statblock notes folder** | Pasta padrão para criar notas de statblock | `atlas-vtt/statblocks`. |
| **Documentation folder** | Pasta onde a ação de baixar documentação grava as notas | `Statblock Forge/Documentation` em inglês ou `Statblock Forge/Documentação` em português, quando o destino padrão é usado. |
| **Style library** | Importação/exportação de temas e molduras personalizados | Biblioteca vazia até que estilos sejam importados/criados. |

As pastas são caminhos relativos à raiz do Vault. O Forge normaliza barras e remove barras externas. Não use `..` para tentar gravar fora do Vault.

## Idioma

A opção **Language** oferece:

- `English`
- `Português (Brasil)`

A preferência é salva nas configurações do plugin. Ao mudar o idioma, as views abertas são atualizadas. A ação **Download documentation** escolhe a edição correspondente: notas em inglês ou notas em português.

A seleção de idioma não traduz nomes internos de Fields, keys ou identificadores que já estejam armazenados nos Templates. Esses identificadores precisam permanecer estáveis para que blocos, fórmulas e vínculos continuem funcionando.

## Atalho de Statblock Mode

O padrão é `Mod+Shift+S`:

- `Mod` equivale a **Ctrl** no Windows/Linux.
- `Mod` equivale a **Cmd** no macOS.
- Também é possível usar `Ctrl`, `Alt` ou `Shift` como modificadores explícitos.

Para alterar:

1. Clique no campo **Statblock Mode shortcut**.
2. Pressione a combinação desejada.
3. Use **Reset to default** para voltar ao padrão.

O atalho funciona quando o editor Forge de Template está ativo e o foco não está em `input`, `textarea`, `select`, editor CodeMirror ou conteúdo editável. Um atalho sem modificador não é aceito, para não capturar letras usadas durante a edição.

**Statblock Mode** alterna a área do editor entre o Canvas de construção e a prévia do statblock. Ele não cria uma nota de statblock e não substitui o comando de renderização de uma nota existente.

## Ribbon e Command Palette

O ícone de ribbon **Statblock Forge** abre um menu contextual. Conforme o arquivo ativo, ele pode oferecer:

- **Create new template** — abre um Template novo no editor.
- **Open template** — seleciona um Template existente.
- **Create statblock** — escolhe um Template e inicia a criação de uma nota.
- **Render current note** — solicita um Template para visualizar uma nota Markdown ou JSON compatível.
- **Edit linked template** — abre o Template relacionado à nota ativa, quando o vínculo Forge é reconhecido.
- **Create Atlas token** — aparece quando a nota ativa atende aos requisitos do fluxo Atlas e a integração está disponível.

A Command Palette inclui estes comandos principais:

| Comando | Quando utilizar |
|---|---|
| **Create new Forge template** | Iniciar um Template. |
| **Toggle Statblock mode** | Alternar Canvas/prévia enquanto um Template Forge está aberto. |
| **Recover unsaved Forge template drafts** | Abrir o fluxo de recuperação de rascunhos. |
| **Open template in Forge…** | Localizar e abrir um Template. |
| **Create statblock from Forge template…** | Criar uma nota a partir de um Template. |
| **Delete template…** | Mover um Template para a lixeira do Obsidian, após confirmação. |
| **Render current note with a Forge template** | Renderizar a nota ativa com um Template escolhido. |
| **Edit Forge template linked to current statblock note** | Editar o Template vinculado à nota ativa. |
| **Create Atlas token from current Forge statblock note** | Criar um Token Atlas quando o contexto é compatível. |

Alguns comandos usam `checkCallback` e só ficam disponíveis quando a view ou o arquivo ativo satisfaz as condições do comando.

## Biblioteca de estilos

A seção **Style library** possui:

- **Import .forgestyle:** seleciona um pacote de estilos JSON com extensão `.forgestyle`.
- **Export style library:** exporta os temas e molduras personalizados atualmente armazenados nas configurações.

O botão de exportação fica desativado quando não há temas nem molduras personalizados. O pacote é destinado à transferência de estilos; não é um Template nem uma ficha.

Consulte [[24 - Biblioteca de estilos .forgestyle]] para o formato e os cuidados de importação/exportação.

## Baixar a documentação

1. Selecione o idioma desejado.
2. Defina **Documentation folder**, se quiser alterar o destino.
3. Clique em **Download documentation**.
4. Abra `00 - Índice.md` dentro da pasta criada.

> [!important] Notas existentes são preservadas
> A rotina de download cria apenas arquivos ausentes. Ela não sobrescreve notas que já existam no destino. Para obter uma revisão mais recente, escolha uma pasta vazia ou faça backup e mova/renomeie as notas antigas antes de baixar novamente.

## Checklist inicial recomendado

- [ ] Confirmar que o plugin está habilitado e que não há erro de carregamento.
- [ ] Escolher o idioma.
- [ ] Definir as pastas de Templates e statblocks.
- [ ] Confirmar um atalho de Statblock Mode que não conflite com outros plugins.
- [ ] Baixar a documentação em uma pasta dedicada.
- [ ] Criar um Template de teste e uma nota de exemplo antes de migrar conteúdo importante.
- [ ] Fazer backup de Templates e notas existentes antes de conversões ou sobrescritas.

## Solução rápida de problemas

| Sintoma | Verificação inicial |
|---|---|
| Forge não aparece na lista | Confirme o caminho `.obsidian/plugins/statblock-forge/` e a presença de `main.js` na raiz da pasta do plugin. |
| O plugin não carrega | Confira a versão mínima do Obsidian e o Console do desenvolvedor; um ZIP-fonte precisa ser compilado. |
| Template não aparece no destino esperado | Verifique **Template folder** e lembre-se de que Templates compatíveis também podem ser localizados fora da pasta padrão por seletores do Vault. |
| Atalho não funciona | Confirme que o editor de Template está ativo, que há um modificador e que o foco não está em um campo de texto. |
| Documentação não atualiza | O download não sobrescreve arquivos existentes; use uma pasta nova ou mova as notas antigas com backup. |

## Próximo passo

Leia [[03 - Conceitos fundamentais]] antes de criar Fields e blocos. Depois siga para [[04 - Criar e editar templates]].
