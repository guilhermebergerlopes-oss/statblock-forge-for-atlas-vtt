---
title: Statblock Forge — Row
tags:
  - statblock-forge
  - documentação/layout
parte: 2
---

# Row

Uma **Row** é um container horizontal flexível. Seus filhos seguem a ordem estrutural e compartilham a largura da Row de acordo com `Span`. Use-a para manter pequenos blocos alinhados, por exemplo AC, HP e Speed, ou para colocar dois blocos de tags na mesma faixa.

Diferentemente de Section, Row não cria uma Grid interna. Seus filhos não recebem coordenadas independentes de coluna/linha; a largura é distribuída e a sequência dos filhos define a ordem.

## Span e largura proporcional

Dentro de uma Row, `Span` funciona como peso relativo em uma escala lógica de 12 partes. Cada linha visual soma até 12 partes. A largura considera também o espaço reservado entre os filhos.

| Filho | Span | Participação aproximada na linha |
|---|---:|---:|
| AC | 6 | 50% |
| HP | 3 | 25% |
| Speed | 3 | 25% |

Outros exemplos:

| Spans na sequência | Resultado |
|---|---|
| `6 + 6` | Dois filhos com metade da largura cada. |
| `8 + 4` | Dois filhos: aproximadamente dois terços e um terço. |
| `4 + 4 + 4` | Três filhos com aproximadamente um terço cada. |
| `6 + 3 + 3` | Um filho com metade e dois com um quarto cada. |
| `8 + 8` | A soma ultrapassa 12; o segundo filho começa uma nova linha visual. |
| `12` | Um filho ocupa a largura inteira daquela linha. |

O Forge agrupa os filhos consecutivos em linhas: quando o próximo `Span` faria a soma passar de 12, ele começa outra linha. Esse agrupamento é baseado nos valores Span e na ordem dos filhos, não em uma quebra arbitrária causada apenas pela largura momentânea da janela.

`Span` menor que 12 deixa espaço livre na linha. A propriedade **Align** controla como esse espaço restante é tratado.

## Align

Selecione a Row para configurar **Items alignment**:

| Valor | Resultado |
|---|---|
| **Start** | Os filhos começam no início da linha; é a opção padrão. |
| **Center** | O conjunto de filhos é centralizado na linha. |
| **Spread** | O espaço livre é distribuído entre os filhos. |

Align não altera os valores Span nem a ordem dos blocos. Ele muda o alinhamento visual do conjunto dentro de cada linha.

## Altura das linhas

Cada linha visual recebe a altura necessária para o filho mais alto daquela linha. Os demais filhos acompanham a altura da linha. A altura total da Row é a soma das linhas visuais.

O `Rows` configurado no inspetor continua sendo uma alocação mínima. Containers estruturais como Row calculam linhas suficientes para acomodar seus filhos; conteúdo de Entries, Scores e Spells pode ter controles próprios de quantidade de linhas ou rolagem interna. O comportamento exato depende do tipo de bloco.

Uma Row vazia mantém uma altura mínima e apresenta um placeholder no Canvas.

## Dense Layout e espaçamento da Row

Dense Layout controla o posicionamento das Grids e também altera o espaçamento visual das Rows:

- Com **Dense On**, o intervalo entre os filhos fica mais compacto.
- Com **Dense Off**, o intervalo usa o espaçamento normal.

Isso não transforma os filhos da Row em itens de Grid. Mesmo com Dense desligado, o posicionamento deles continua sendo flexível e baseado em Span e ordem; o modo manual por célula aplica-se aos filhos diretos de uma Grid, não aos filhos diretos de Row.

Consulte [[14 - Dense Layout]] para o comportamento completo.

## Filhos permitidos

Uma Row pode conter blocos de conteúdo e Sections. Uma Section dentro de Row mantém sua própria Grid interna.

Uma Row **não pode conter diretamente**:

- outra Row;
- um container Tabs.

Tabs também não pode ser inserido dentro de Row. Se você precisar de grupos aninhados, crie uma Section como filha da Row e coloque o Tabs dentro dessa Section.

## Criar e configurar uma Row

1. Selecione o Canvas ou uma Section.
2. Use **Add container → Row**.
3. Selecione a Row para torná-la o destino da inserção.
4. Adicione blocos compatíveis ou arraste Fields para dentro dela.
5. Selecione cada filho e ajuste seu `Span` para distribuir a largura.
6. Selecione a Row e escolha **Items alignment**: Start, Center ou Spread.
7. Reordene os filhos com os controles **↑ / ↓** ou arrastando-os dentro da sequência da Row.

### Exemplo: faixa de atributos

```text
Row: Combat summary
├── Stat: AC       Span 3
├── Stat: HP       Span 6
└── Stat: Speed    Span 3
```

A linha usa `3 + 6 + 3 = 12`. HP recebe metade da largura; AC e Speed recebem aproximadamente um quarto cada.

### Exemplo: mais itens que cabem em uma linha

```text
Row: Defenses
├── Stat: AC           Span 4
├── Stat: Fortitude    Span 4
├── Stat: Reflex       Span 4
├── Stat: Will         Span 4  ← inicia a segunda linha
└── Stat: Immunity     Span 8
```

Os três primeiros itens somam 12. O quarto inicia uma nova linha. O quinto compartilha essa segunda linha com o quarto, conforme os Spans.

## Ungroup

Quando uma Row está selecionada, o Canvas oferece **Ungroup**. A ação remove o wrapper Row e coloca os filhos de volta no nível anterior, na ordem atual. Os blocos filhos e suas configurações próprias de Field, aparência, Span e Rows são preservados; somente os metadados do container Row deixam de existir.

Ungroup não exclui os Fields nem os Values dos statblocks. Ele altera apenas a estrutura de apresentação.

## Problemas comuns

| Sintoma | Causa provável | Correção |
|---|---|---|
| Um filho aparece em outra linha. | A soma dos Spans anteriores com o novo filho passa de 12. | Reduza Spans ou planeje linhas de até 12 partes. |
| Há espaço vazio depois dos filhos. | A soma dos Spans da linha é menor que 12. | Aumente Spans ou altere Align para Center/Spread. |
| Um filho não pode ser movido para uma célula específica. | Filhos diretos da Row não usam coordenadas de Grid. | Reordene-os ou ajuste Span. |
| Não é possível adicionar Tabs ou outra Row. | A regra de aninhamento de Row bloqueia esses filhos diretos. | Coloque-os dentro de uma Section filha. |

## Veja também

- [[10 - Containers: visão geral]] — compatibilidade de containers.
- [[11 - Section]] — Grid interna para composições mais complexas.
- [[13 - Tabs]] — painéis que podem ficar dentro de uma Section filha da Row.
- [[14 - Dense Layout]] — modo compacto e espaçamento.
- [[09 - Redimensionar blocos]] — ajustar Span e Rows.
