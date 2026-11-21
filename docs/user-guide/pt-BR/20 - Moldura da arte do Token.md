---
title: Statblock Forge — Moldura da arte do Token
aliases:
  - Token border
  - Borda do Token
tags:
  - statblock-forge
  - documentação/aparência
parte: 3
---

# Moldura da arte do Token

A opção **Token border** controla a moldura decorativa ao redor da arte de Token reservada no cabeçalho do statblock. Ela é independente da moldura externa da ficha e das molduras aplicadas a blocos comuns.

> [!important] Token art não é um Image Field comum
> O Field reservado `image` é integrado ao fluxo de Tokens do Atlas. Em uma ficha Forge v2, você pode escolher uma imagem local do Vault e criar um TokenAsset nativo do Atlas vinculado à nota. O Forge copia a imagem para `atlas-vtt/assets`; a imagem original e a nota do statblock não são modificadas. Também é possível vincular Characters já existentes no Atlas. Para retratos, ilustrações e mapas que não devam virar tokens, crie um Field separado do tipo **Image**. Consulte [[22 - Fields de imagem e enquadramento]].

## Onde configurar

1. Abra o Template no editor.
2. Entre na aba **Appearance**.
3. Expanda **Token border**.
4. Ative **Customize token border**.
5. Escolha **Border shape**, **Token border color** e **Thickness (px)**.
6. Confira a prévia do cabeçalho e salve o Template.

Quando **Customize token border** está desativado, o Forge não aplica a moldura decorativa personalizada. Os controles ficam desabilitados, mas a configuração armazenada não precisa ser apagada; reativar a opção recupera a configuração anterior.

## Formatos disponíveis

| Border shape | Aparência e uso |
|---|---|
| **Default** | Contorno circular simples, próximo ao aro padrão. |
| **Double** | Contorno circular duplo. É útil para destacar personagens importantes sem mudar a forma geral. |
| **Oval** | Moldura elíptica. |
| **Diamond** | Losango, adequado para relíquias, avatares especiais ou criaturas incomuns. |
| **Regular hexagon** | Hexágono regular. |
| **Triangle up / right / down / left** | Triângulo orientado para cima, direita, baixo ou esquerda. |
| **Pointed** | Moldura com extremidade inferior pontuda. |
| **Angular** | Moldura poligonal com cantos chanfrados. |
| **Hexagonal** | Silhueta hexagonal. No espaço quadrado do Token, ela usa a mesma proporção regular do aro hexagonal; o nome separado também é preservado como preset próprio. |
| **Shield** | Silhueta de escudo, com topo reto e ponta inferior. |

Os presets geométricos mudam o contorno do aro. Não são filtros aplicados à imagem: a arte continua sendo a arte do Token fornecida pelo Atlas.

## Cor e espessura

- **Token border color** aceita uma cor hexadecimal de seis dígitos (`#RRGGBB`).
- A cor inicial acompanha o acento do tema do statblock, a menos que uma cor própria tenha sido salva.
- **Thickness (px)** varia de **1 a 12 px**, em passos de **0,5 px**.
- Sem valor personalizado, o padrão é **2 px**; **Double** usa **3 px** como padrão inicial.

A espessura afeta o aro decorativo. Ela não altera o tamanho do arquivo de imagem, o Token no mapa do Atlas ou as dimensões do bloco Image.

## O que a moldura não modifica

A moldura de Token não:

- escolhe ou substitui o Token vinculado;
- cria um Token no mapa;
- converte um Image Field comum em Token;
- atualiza um TokenAsset existente quando o Value de Token art da nota Forge muda;
- altera o TokenAsset ou sua imagem ao mudar a espessura ou o formato do aro;
- altera o enquadramento de um Field `image` comum;
- muda a moldura externa do statblock;
- altera a aparência individual de outro bloco.

Para criar um TokenAsset a partir da arte local ou vincular um Token existente, use as ações de Atlas oferecidas pelo Field reservado. Alterar a moldura não modifica o TokenAsset nem sua imagem. A aparência do aro é apenas apresentação visual.

## Onde a configuração é salva

A configuração é armazenada no layout do Template, na propriedade Forge `tokenAppearance` (`enabled`, `borderPreset`, `borderColor` e `borderWidth`). Ela acompanha o Template, não o valor do Token da ficha. Assim, statblocks criados com o mesmo Template compartilham a mesma configuração de moldura, embora possam estar vinculados a Tokens diferentes.

A moldura de Token não faz parte de um pacote `.forgestyle`. Esses pacotes transportam temas e molduras externas reutilizáveis; não transportam Tokens, imagens nem a moldura do Token. Consulte [[24 - Biblioteca de estilos .forgestyle]].

## Exemplo de composição

Para uma criatura importante, você pode usar o tema **Bloodbound Gothic**, manter a moldura externa **Double** e configurar o Token com **Shield**, vermelho escuro e espessura de `3 px`. Um retrato adicional no corpo da ficha continua sendo um Field `image` comum, com enquadramento independente.

## Veja também

- [[16 - Aparência: visão geral]] — camadas de aparência.
- [[19 - Moldura externa]] — contorno da ficha inteira.
- [[21 - Aparência individual dos blocos]] — personalização por bloco.
- [[22 - Fields de imagem e enquadramento]] — imagens comuns do Vault.
