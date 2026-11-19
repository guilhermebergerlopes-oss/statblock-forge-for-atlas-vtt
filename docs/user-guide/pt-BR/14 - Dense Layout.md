---
title: Statblock Forge — Dense Layout
aliases:
  - Posicionamento denso
  - Layout compacto
tags:
  - statblock-forge
  - documentação/layout
parte: 2
---

# Dense Layout

**Dense Layout** controla como os blocos diretos de uma Grid são posicionados. É uma configuração global do layout do Template: vale para a Grid principal e para as Grids internas das Sections, incluindo painéis de Tabs.

Dense não é o mesmo que **Background grid**:

- **Dense Layout** altera o algoritmo de posicionamento e, em Rows, o espaçamento visual.
- **Background grid** apenas mostra ou oculta as linhas-guia do Canvas. Não muda posições nem o tamanho dos blocos.

Templates novos começam com Dense ligado.

## Dense On: encaixe compacto

Com **Dense Layout On**:

1. O Forge percorre os irmãos na ordem estrutural do Template.
2. Calcula o tamanho de cada bloco e encontra uma posição livre para o retângulo inteiro.
3. Quando existe um caminho de posições livres, o algoritmo procura uma posição mais acima e/ou à esquerda que continue alcançável sem atravessar blocos ocupados.
4. Blocos não são girados, reduzidos nem sobrepostos para preencher espaços.

O objetivo é compactar os espaços vazios que podem ser alcançados mantendo o tamanho de cada bloco. Isso não significa que todo buraco visual será preenchido: se um bloco não puder deslizar até uma área livre sem cruzar uma colisão, ele permanece em uma posição posterior.

A ordem dos irmãos é importante. Mover um bloco para cima ou para baixo na estrutura pode alterar o resultado de encaixe de vários blocos seguintes.

## Dense Off: âncoras de posição

Com **Dense Layout Off**, o Forge preserva posições manuais para os filhos diretos de cada Grid:

- Ao desligar Dense, as posições atualmente visíveis são capturadas como âncoras de coluna e linha.
- Cada bloco mantém sua coluna e linha de referência.
- Se outro bloco ocupar parte da posição ancorada, o bloco em colisão é empurrado para baixo, mantendo a coluna sempre que possível.
- A colisão não faz o bloco migrar lateralmente para preencher uma lacuna.
- Quando um bloco acima diminui, os blocos abaixo não sobem automaticamente apenas porque o espaço ficou livre.

Esse comportamento preserva a composição manual. O Forge prefere manter a âncora vertical/horizontal conhecida a reorganizar o bloco para ocupar qualquer espaço vazio.

### Exemplo simplificado

```text
Dense Off
Colunas:   1–4       5–8       9–12
Linha 1:  [Bloco A] [Bloco B] [Bloco C]
Linha 2:  [Bloco D]           [Bloco E]
```

Se Bloco A crescer e colidir com Bloco D, D é empurrado para baixo na mesma faixa de colunas. Ele não migra para o espaço vazio sob Bloco B ou C.

## Posicionamento manual em uma célula

Com Dense desligado, você pode arrastar um bloco diretamente para uma célula da Grid:

1. Desligue **Dense Layout**.
2. Arraste o bloco pela área do bloco, não pela alça de redimensionamento.
3. Solte sobre uma posição da Grid, inclusive uma área vazia, ou sobre outro bloco na célula desejada.
4. O Forge calcula a coluna e a linha sob o ponteiro e aplica a nova âncora.
5. Se o destino estiver ocupado, os blocos em colisão são reorganizados para baixo conforme a regra de Dense Off.

O procedimento vale para filhos diretos da Grid principal e para filhos diretos das Grids internas das Sections. Filhos diretos de Row não têm coordenadas de Grid próprias; Sections que são filhas diretas de Tabs seguem a ordem das abas. Para esses casos, use drag-and-drop estrutural ou os controles de ordem.

## Alternar entre Dense On e Off

- **On → Off:** o Forge captura as posições visíveis como novas âncoras. A composição que você estava vendo torna-se o ponto de partida do modo manual.
- **Off → On:** as âncoras deixam de determinar a posição. O Forge volta ao encaixe compacto baseado na ordem dos irmãos.
- **On → Off novamente:** as posições compactadas atuais são capturadas como novas âncoras.

Alternar o modo não altera `Span`, `Rows`, Fields ou Values; altera a forma como a posição é calculada.

## Reordenar não é o mesmo que reposicionar

Existem duas operações diferentes:

| Operação | O que muda | Quando usar |
|---|---|---|
| **Mover ↑ / ↓ ou arrastar antes/depois** | Ordem estrutural dos irmãos. | Quando a sequência de leitura ou a ordem de layout deve mudar. |
| **Soltar em uma célula com Dense Off** | Âncora espacial do bloco na Grid. | Quando quer preservar uma composição manual específica. |

Depois de uma reordenação estrutural explícita, o Forge limpa as âncoras do grupo de irmãos afetado para que a nova ordem seja respeitada. Consulte [[15 - Mover e reordenar blocos]].

## Containers e escopo das âncoras

- A Grid principal tem seu próprio conjunto de irmãos e âncoras.
- Cada Section possui uma Grid interna, com âncoras independentes dos irmãos de fora.
- Cada painel Section de Tabs possui sua Grid interna.
- Filhos diretos de Row são distribuídos por Span e ordem, não por âncoras de Grid.
- O próprio container Section, Row ou Tabs ocupa uma posição na Grid do seu pai; seus descendentes pertencem à estrutura interna do container.

A quantidade física de colunas da Grid pode ser alterada nas opções do Canvas. As âncoras guardam a quantidade de colunas em que foram criadas para que o Forge possa ajustar proporcionalmente sua coluna quando a configuração muda. `Span` continua na escala lógica de 1 a 12; veja [[08 - Grid de 12 colunas]].

## Dense e espaço liberado por conteúdo oculto ou recolhido

Há uma regra separada para conteúdo que deixa de ser exibido no statblock final:

- Uma Section recolhida deixa de ocupar altura.
- Blocos marcados **Hidden** para jogadores são removidos da visualização do jogador.
- O Forge pode recuperar parte das linhas liberadas para blocos abaixo, desde que haja sobreposição de colunas.
- As coordenadas horizontais dos blocos restantes são preservadas; o espaço não faz um bloco saltar para outra coluna.

Esse ajuste de espaço visível não deve ser confundido com o algoritmo Dense de posicionamento do Template. Consulte [[11 - Section]] e [[21 - Aparência individual dos blocos]].

## Dense também afeta o espaçamento de Rows

Embora os filhos de uma Row não usem âncoras de Grid, a opção Dense altera o espaço entre eles: com Dense ligado, as lacunas horizontais e verticais da Row ficam mais compactas; com Dense desligado, usam o espaçamento normal. A sequência e os pesos Span continuam sendo os mesmos.

## Qual modo escolher?

| Objetivo | Modo recomendado |
|---|---|
| Deixar o Forge compactar o layout seguindo a ordem do Template. | **Dense On** |
| Criar lacunas intencionais ou uma composição espacial fixa. | **Dense Off** |
| Arrastar um bloco para uma célula específica. | **Dense Off** |
| Fazer a ordem dos blocos determinar a composição. | **Dense On**, ou use ↑ / ↓ para definir a sequência antes de compactar. |
| Ajustar apenas a distância entre filhos de Row. | Use Dense sabendo que ele também muda esse espaçamento. |

## Problemas comuns

| Sintoma | Explicação | Solução |
|---|---|---|
| Um bloco se moveu depois de ligar Dense. | O encaixe voltou a seguir a ordem estrutural e procurou uma posição compacta alcançável. | Reordene os irmãos ou desligue Dense para capturar a composição atual. |
| Um bloco foi empurrado para baixo. | A âncora estava ocupada por outro bloco. | Reduza o bloco que causa a colisão, mova-o ou ajuste a âncora do bloco afetado. |
| Um bloco não sobe depois que outro encolhe. | Dense Off preserva a âncora de linha. | Reposicione manualmente ou ligue Dense para compactar. |
| Não consigo arrastar um filho de Row para uma célula. | Row não usa coordenadas de Grid nos filhos diretos. | Ajuste Span, Align ou ordem do filho. |
| A grade de fundo sumiu, mas o layout não mudou. | Background grid só controla as guias visuais. | Ative Background grid; use Dense para mudar o encaixe. |

## Veja também

- [[08 - Grid de 12 colunas]] — colunas físicas, Span lógico e dimensões.
- [[09 - Redimensionar blocos]] — como tamanho e conteúdo alteram as linhas necessárias.
- [[10 - Containers: visão geral]] — onde cada Grid existe.
- [[11 - Section]] — Grids internas e conteúdo recolhível.
- [[12 - Row]] — distribuição flexível e o espaçamento Dense.
- [[15 - Mover e reordenar blocos]] — movimentos estruturais e manuais.
