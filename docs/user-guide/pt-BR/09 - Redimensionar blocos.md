---
title: Statblock Forge — Redimensionar blocos
tags:
  - statblock-forge
  - documentação/layout
parte: 2
---

# Redimensionar blocos

O tamanho de um bloco pode ser ajustado diretamente no Canvas ou numericamente pelo inspetor da barra lateral.

## Redimensionar pelo Canvas

1. Passe o cursor sobre o bloco para localizar a alça de redimensionamento, no canto inferior direito.
2. Arraste a alça para ajustar a largura e a altura.
3. Observe o indicador junto ao cursor: ele mostra a quantidade de colunas e linhas (`Span × Rows`) prevista.
4. Solte o ponteiro para aplicar a alteração.

Durante o gesto, o Forge apresenta uma prévia do novo encaixe. Em uma Grid, os blocos vizinhos são reposicionados provisoriamente para que a expansão não gere sobreposição. O Canvas também pode rolar automaticamente quando o ponteiro chega perto das bordas da área rolável.

## Redimensionar pelo inspetor

Com o bloco selecionado, abra suas opções na barra lateral e ajuste:

- **Largura (escala Span de 12 partes)**: valor proporcional, de 1 a 12.
- **Altura (linhas)**: equivalente ao Rows, de 1 a 10.000.

A alteração numérica é aplicada quando o valor é confirmado. Esses campos também são úteis para ajustes precisos ou para restaurar uma dimensão conhecida.

## O que muda em cada tipo de container

### Blocos em uma Grid

A largura usa as colunas físicas configuradas na Grid. Se um bloco crescer além do espaço restante à direita, ele pode ser reposicionado para uma linha posterior pelo mecanismo de encaixe. Os irmãos são reavaliados para evitar colisões.

### Sections usadas em Tabs

Cada aba possui uma Section própria. A Section que representa a aba também pode ser redimensionada pela alça no canto inferior direito; ela usa uma Grid interna com a mesma quantidade de colunas configurada no template, assim como uma Section normal. Os blocos dentro da aba continuam redimensionáveis individualmente.

### Blocos dentro de uma Row

Os filhos de uma Row dividem proporcionalmente a largura disponível. O Span de cada filho funciona como um peso relativo, não como uma posição fixa de coluna da Grid principal. Selecione um filho para exibir a mesma alça de redimensionamento usada nos blocos de Grid; ela ajusta a participação de largura desse filho em relação aos outros itens da mesma linha visual.

A altura continua sendo controlada por Rows. A Row não transforma seus filhos em uma Grid independente.

## Altura manual e conteúdo

O valor de Rows é uma alocação mínima definida no template. Caso o conteúdo precise de mais espaço, a renderização pode expandir a área ocupada sem substituir a configuração manual salva.

Isso significa que um bloco com Rows igual a 1 pode aparecer mais alto quando seu conteúdo não cabe em uma única linha-base. Para controlar o espaço estrutural, altere Rows; para resolver conteúdo excessivo, verifique também o próprio conteúdo e a largura do bloco.

## Limites e recomendações

- Span nunca pode ser menor que 1 nem maior que 12; ele continua usando a escala proporcional de 12 partes, mesmo quando a Grid física está configurada com outra quantidade de colunas.
- Rows aceita de 1 até 10.000.
- Redimensionar não altera o Field associado nem o valor armazenado no statblock.
- Uma largura menor pode aumentar a altura visual de textos e listas por causa da quebra de linha.
- Redimensionar um bloco dentro de uma Row altera a proporção de largura dos irmãos; não o move para outra coluna da Grid.

## Veja também

- [[08 - Grid de 12 colunas]] — regras de posicionamento da Grid configurável.
- [[12 - Row]] — distribuição horizontal dos filhos.
