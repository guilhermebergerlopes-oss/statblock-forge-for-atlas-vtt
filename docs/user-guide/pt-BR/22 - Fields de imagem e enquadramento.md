---
title: Statblock Forge — Fields de imagem e enquadramento
aliases:
  - Image Fields
  - Recorte de imagens
tags:
  - statblock-forge
  - documentação/aparência
  - documentação/fields
parte: 3
---

# Fields de imagem e enquadramento

Um Field do tipo **Image** apresenta uma ilustração, retrato, mapa ou outra imagem associada ao statblock. Ele é diferente da arte de Token reservada no cabeçalho: Fields Image comuns usam arquivos/imagens como Values; Token art utiliza o vínculo de Token do Atlas.

## Criar e associar um Image Field

1. Na área **Fields** do Template, crie um Field do tipo `Image`.
2. Defina um `Label` e uma `Key`, por exemplo `portrait` ou `lair_map`.
3. Adicione um bloco **Image** ao Canvas ou arraste o Field para o Canvas.
4. No inspetor do bloco, confira se o bloco está associado à Key desejada.
5. Use **Choose from Vault** para escolher uma imagem de exemplo para a prévia do Template.

O botão procura arquivos do Vault com extensões reconhecidas: `png`, `jpg`, `jpeg`, `jfif`, `gif`, `webp`, `avif`, `apng`, `bmp`, `svg`, `ico`, `tif` e `tiff`. A extensão é comparada sem diferenciar maiúsculas/minúsculas. O seletor lista arquivos locais do Vault; ele não é um navegador geral de URLs.

## Como o Field armazena a imagem

O Field guarda uma referência de imagem como Value. Dependendo da fonte, o Forge consegue resolver:

- caminho de arquivo do Vault, por exemplo `Bestiary/ash-drake.webp`;
- wikilink do Obsidian, por exemplo `[[Bestiary/ash-drake.webp]]`;
- embed do Obsidian, por exemplo `![[Bestiary/ash-drake.webp]]`;
- link de imagem Markdown, por exemplo `![Ash drake](Bestiary/ash-drake.webp)`;
- referência remota reconhecida pelo renderer, como URL `http(s)` ou referência `data:image`.

Arrays são examinados até encontrar a primeira referência textual não vazia. Para arquivos do Vault, o resolvedor consulta o cache de links do Obsidian e tenta resolver o caminho diretamente; caminhos relativos ao arquivo de origem também podem ser considerados.

> [!note] Choose from Vault versus Value
> **Choose from Vault** define a imagem de exemplo do Template. O Value de cada statblock continua armazenado na própria nota/dados. Trocar a amostra não substitui automaticamente todos os Values das fichas.

## Sample de Template

O exemplo escolhido é salvo em `template.sample[fieldKey]`. Ele alimenta a prévia do Canvas e do Template. Ao criar um statblock, o usuário pode optar por copiar os valores de exemplo conforme o fluxo de criação. Se não copiar Samples, a ficha mantém seus próprios Values.

No statblock em uso, clique no bloco Image para abrir as ações de imagem quando a edição for permitida. Um Image Field comum oferece **Choose from Vault…** e **Remove image**. Remover a imagem limpa o Value daquela ficha; não apaga o arquivo original do Vault.

## Fixar a imagem pelo Template

O menu de ações da imagem de exemplo inclui **Pin image to statblocks** (em português, **Fixar imagem nos statblocks**).

1. Escolha primeiro uma imagem de exemplo.
2. Abra as ações do socket de imagem no Template.
3. Ative **Pin image to statblocks**.
4. Salve o Template.

Uma imagem fixada é controlada pelo Template:

- é aplicada aos statblocks criados com esse Template;
- o Forge reaplica o valor fixado ao carregar a ficha, reparando também dados vinculados mais antigos;
- no statblock, as ações de substituir e remover ficam bloqueadas;
- no Template, a ação de limpar a imagem de exemplo fica desabilitada enquanto a imagem estiver fixada.

Você ainda pode escolher outra imagem no Template: o novo Sample passa a ser a imagem fixada para as fichas associadas. Para voltar a permitir alteração independente em cada statblock, desative **Pin image to statblocks**. A Key reservada `image` (Token art) não pode ser fixada como imagem comum.

Renomear um Field preserva a associação de fixação; excluir o Field ou deixar de usar o tipo `Image` remove a referência obsoleta do layout.

## Enquadramento no Template

Selecione o bloco Image no Canvas. O inspetor **Properties** apresenta uma prévia interativa e os seguintes controles:

| Controle | Faixa | Significado |
|---|---:|---|
| **Zoom** | 100–300% (passos de 5) | Ampliação da imagem dentro do quadro. |
| **Horizontal focus** | 0–100% | Ponto focal no eixo horizontal: esquerda a direita. |
| **Vertical focus** | 0–100% | Ponto focal no eixo vertical: topo a baixo. |

Os valores iniciais são zoom `100%` e foco `50% / 50%` (centro). Arraste a prévia para ajustar os dois eixos. Com a prévia focada, use as setas para ajustes finos: o passo padrão é 2 pontos percentuais; `Shift` usa passo de 10. `Home` centraliza os dois eixos em 50%.

Use **Reset framing** para remover os overrides de zoom e foco e retornar ao enquadramento neutro. A ação pede confirmação.

## Por que a imagem é cortada?

O bloco Image usa `cover`: o quadro é completamente preenchido, preservando a proporção da imagem. Quando as proporções do arquivo e do bloco são diferentes, partes da imagem ficam fora do quadro. Aumentar Zoom amplia a imagem e pode intensificar o corte. Ajuste Horizontal/Vertical focus para manter a parte importante visível.

> [!warning] Não há alternância Cover/Contain
> O comportamento atual é sempre preencher o quadro (`cover`). O antigo seletor para mostrar a imagem inteira (`contain`) não está disponível na interface atual.

## Token art não é um Image Field comum

A Key reservada `image` representa a arte do Token no cabeçalho e é tratada pelo Atlas. No bloco de cabeçalho, o Forge oferece ações para criar um Token no Atlas ou vincular um Token existente, quando o contexto atende aos requisitos. Não use **Choose from Vault** para essa Key. Para um retrato independente, crie uma Key como `portrait` do tipo Image.

## Veja também

- [[20 - Moldura da arte do Token]] — aro decorativo da arte de Token.
- [[21 - Aparência individual dos blocos]] — aparência e moldura do bloco.
- [[23 - Enquadramento na ficha]] — ajuste local durante o uso do statblock.
