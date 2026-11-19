---
title: Statblock Forge — Moldura externa
aliases:
  - Borda externa do statblock
  - Custom outer border
tags:
  - statblock-forge
  - documentação/aparência
parte: 3
---

# Moldura externa

A seção **Custom outer border** da aba **Appearance** configura o contorno ao redor da superfície inteira do statblock. Ela é independente da paleta do tema, da moldura decorativa do Token e das bordas individuais dos blocos.

Use a moldura externa quando quiser delimitar a ficha como um painel único. Para destacar apenas um bloco, use **Block appearance**; para envolver somente a arte de Token no cabeçalho, use **Token border**.

## 1. Selecionar o preset da moldura

Em **Outer border preset**, escolha uma das opções:

| Opção | Comportamento |
|---|---|
| **Theme default** | Remove a moldura personalizada e deixa o tema/renderer controlar o contorno. |
| **No outer border** | Mantém uma configuração explícita de moldura sem linha visível (`none`). |
| **Solid frame** | Uma linha contínua. |
| **Double frame** | Linha dupla. |
| **Dashed frame** | Linha tracejada. |
| **Dotted frame** | Linha pontilhada. |
| **Grooved frame** | Linha com efeito de sulco. |
| **Ridge frame** | Linha com efeito em relevo. |
| **Custom: nome** | Uma moldura personalizada salva na biblioteca do Forge. |

**Theme default** e **No outer border** não são a mesma opção. Theme default remove a moldura personalizada do layout. No outer border cria uma moldura personalizada cujo estilo é `none`, útil quando você quer registrar explicitamente a ausência de linha como uma moldura selecionada.

Quando um preset interno é escolhido, sua cor inicial vem do papel **Border** da paleta ativa: primeiro do tema Custom, depois do override do preset selecionado e, por fim, da paleta original do preset.

## 2. Ajustar a moldura

Depois de selecionar um preset diferente de **Theme default**, o editor mostra os controles da moldura:

| Controle | Efeito | Intervalo | Incremento do controle |
|---|---|---:|---:|
| **Border color** | Cor da linha externa. | Cor hexadecimal `#RRGGBB` | Seletor de cor |
| **Inner line color** | Cor da linha interna, quando ativada. | Cor hexadecimal `#RRGGBB` | Seletor de cor |
| **Border thickness (px)** | Espessura da linha externa. | 0–16 px | 0,5 px |
| **Corner radius (px)** | Arredondamento dos cantos. | 0–48 px | 1 px |
| **Add inner border** | Liga ou desliga a segunda linha. | Ligado/desligado | — |
| **Inner border thickness (px)** | Espessura da linha interna. | 0–8 px | 0,5 px |
| **Space between borders (px)** | Distância entre a borda externa e a interna. | 0–24 px | 1 px |

Os controles de cor, espessura e raio atualizam a prévia do template imediatamente. Quando **Add inner border** está desligado, os controles de cor, espessura e espaçamento da linha interna ficam desabilitados; os valores existentes são preservados para quando a opção voltar a ser ligada.

A linha interna é desenhada como um segundo contorno sólido por dentro do statblock. Seu estilo não é configurado separadamente como dashed ou double; ela usa cor, espessura e distância próprias.

## 3. Exemplo: moldura dupla com linha interna

Uma moldura para uma ficha de chefe poderia usar:

| Propriedade | Valor de exemplo |
|---|---|
| Preset | `Double frame` |
| Border color | `#8B151B` |
| Border thickness | `3 px` |
| Corner radius | `12 px` |
| Add inner border | Ligado |
| Inner line color | `#D4AF37` |
| Inner border thickness | `1,5 px` |
| Space between borders | `4 px` |

O resultado é um contorno duplo: a linha externa usa o estilo selecionado e a linha interna aparece como um contorno sólido recuado. A prévia mostra a combinação antes de salvar o template.

## 4. Salvar uma moldura reutilizável

Depois de ajustar os controles, o campo **Custom border name** permite dar um nome à moldura.

- **Save as custom border** cria uma entrada nova na biblioteca e incorpora uma cópia ao layout do template atual. É necessário informar um nome.
- **Save changes to border** atualiza a entrada existente na biblioteca com os valores e o nome atuais.
- **Remove from border library** remove a entrada reutilizável após confirmação. O snapshot que já está no template continua funcionando.
- **Export this border** exporta somente a moldura selecionada como um pacote `.forgestyle`.
- **Export style library**, na parte superior da aba Appearance, exporta a biblioteca inteira de temas e molduras quando ela contém itens.

Se uma moldura for removida da biblioteca mas continuar aplicada em um template, ela aparece como uma cópia/snapshot do template. Ela não depende mais de uma entrada reutilizável para ser renderizada.

## 5. Importar molduras

Use **Import .forgestyle** na aba **Appearance** ou em **Settings → Style library**. O Forge valida o pacote e abre uma janela de revisão. Para cada moldura, você pode adicionar à biblioteca, manter uma cópia quando houver conflito, substituir um item correspondente ou ignorá-lo.

Importar uma moldura apenas a acrescenta à biblioteca reutilizável. Ela não altera automaticamente a moldura de todos os templates. Selecione a moldura na lista **Outer border preset** de cada template em que quiser usá-la.

Veja [[24 - Biblioteca de estilos .forgestyle]] para limites e regras completas do pacote.

## 6. Moldura externa não é aparência individual

A moldura externa envolve o elemento completo do statblock. Ela não substitui as bordas de superfície dos blocos internos nem a moldura de Token do cabeçalho.

- Para mudar fundo, formato, borda ou sombra de um bloco, selecione-o e use **Block appearance**: [[21 - Aparência individual dos blocos]].
- Para estilizar a arte de Token reservada no cabeçalho, use **Token border**: [[20 - Moldura da arte do Token]].
- Para imagens comuns, configure o Field e o bloco Image: [[22 - Fields de imagem e enquadramento]].

## Veja também

- [[16 - Aparência: visão geral]] — camadas de aparência.
- [[17 - Temas prontos]] — paletas incluídas.
- [[18 - Criar e personalizar temas]] — cores e temas Custom.
- [[20 - Moldura da arte do Token]] — moldura do Token.
- [[21 - Aparência individual dos blocos]] — bordas internas.
- [[24 - Biblioteca de estilos .forgestyle]] — importar e exportar molduras.
