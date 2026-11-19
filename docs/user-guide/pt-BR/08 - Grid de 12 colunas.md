---
title: Statblock Forge — Grid configurável (12 por padrão)
tags:
  - statblock-forge
  - documentação/layout
parte: 2
---

# Grid configurável

O Canvas do Forge usa uma Grid configurável de **4 a 24 colunas físicas**, com **12 colunas por padrão**. Para alterar essa quantidade, abra **More options → Grid columns** na barra do Canvas. A configuração é salva no próprio template e vale para a Grid principal, Sections aninhadas e painéis de Tabs. O sistema calcula as posições para evitar sobreposição.

## Colunas e células

- A largura disponível é dividida igualmente pela quantidade de colunas físicas configurada no template.
- O espaço entre as colunas é descontado antes do cálculo da largura de cada célula.
- As células-base são quadradas: a altura de uma linha acompanha a largura de uma coluna.
- As linhas e colunas usam medidas uniformes dentro de cada Grid.

Cada bloco possui dois valores principais de dimensionamento:

| Propriedade | Significado | Faixa |
|---|---|---:|
| **Width / Span** | Largura proporcional em uma escala lógica de 12 partes. | 1–12 |
| **Height / Rows** | Quantas linhas-base o bloco ocupa. | 1–10.000 |

Um bloco com `Span = 6` ocupa aproximadamente metade da largura da Grid; `Span = 12` ocupa toda a largura disponível, independentemente da quantidade física configurada. A mudança do número de colunas altera a granularidade de posicionamento, mas preserva a proporção de largura dos blocos existentes. O valor de Rows determina sua alocação mínima vertical; conteúdo longo pode exigir linhas adicionais durante a renderização.

## Posição e ordem

A ordem dos blocos na estrutura do template é usada pelo mecanismo de encaixe. O resultado depende do estado de **Dense Layout**:

- Com Dense ligado, os blocos seguem a ordem estrutural e podem se deslocar para posições anteriores que estejam livres e sejam alcançáveis.
- Com Dense desligado, os blocos mantêm âncoras de coluna e linha. Quando há colisão, o bloco afetado só é empurrado para baixo, sem migrar para uma coluna lateral.

A nota [[14 - Dense Layout]] descreve os dois modos em detalhe.

## Altura automática pelo conteúdo

Rows define a altura salva do bloco, mas não corta conteúdo que precise de mais espaço. O Forge mede o excesso de conteúdo e pode ampliar temporariamente a área ocupada pelo bloco. Em seguida, recalcula o encaixe dos irmãos para evitar que o conteúdo ampliado cubra os blocos seguintes.

Esse ajuste é relevante, por exemplo, para textos longos, listas, Entries, Spells e imagens que terminam de carregar depois da primeira renderização. O tamanho automático não deve ser confundido com o valor manual de Rows configurado no inspetor.

## Grid principal e Grids de Sections

O controle **Background grid** mostra guias na Grid principal e em cada Grid interna de Section, inclusive em Sections aninhadas e no conteúdo das abas. As guias usam as dimensões reais das colunas, linhas e espaços calculados para cada Grid.

Cada Section possui sua própria Grid interna, com a mesma quantidade de colunas definida no template. As posições dos filhos dessa Section são independentes das posições de outros blocos fora dela. Rows, por outro lado, distribuem os filhos em faixas flexíveis e não usam coordenadas de Grid individuais.

## Não confunda com a opção de colunas do Atlas

A lista **Atlas: 1 col / 2 cols / 3 cols** não transforma a grade do Forge em uma grade de uma, duas ou três colunas. Ela controla `layout.maxColumns`, a informação de colunas do layout nativo do Atlas. O posicionamento do Canvas Forge usa a quantidade configurada no template, de 4 a 24 colunas físicas (12 por padrão).

## Exemplo de composição

| Bloco | Span | Resultado aproximado |
|---|---:|---|
| Nome | 12 | Uma linha de largura completa |
| HP | 3 | Um quarto da largura |
| Defesa | 3 | Um quarto da largura |
| Movimento | 3 | Um quarto da largura |
| Alcance | 3 | Um quarto da largura |

Os quatro últimos blocos podem ocupar uma mesma faixa quando a ordem e o espaço disponível permitirem. O encaixe exato também considera a altura de cada bloco.

## Veja também

- [[09 - Redimensionar blocos]] — alterar Span e Rows.
- [[10 - Containers: visão geral]] — entender onde cada Grid existe.
- [[14 - Dense Layout]] — controlar o comportamento de encaixe.
