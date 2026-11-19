---
title: Statblock Forge — Section
tags:
  - statblock-forge
  - documentação/layout
parte: 2
---

# Section

Uma **Section** é um container com título opcional e uma Grid interna. Use-a para agrupar blocos que pertencem ao mesmo assunto e precisam de uma área de layout própria, como atributos, defesas, características, equipamentos ou informações de uma aba.

Uma Section pode conter blocos de conteúdo, outras Sections, Rows e Tabs. Seus filhos são organizados dentro da Grid da Section, não na Grid principal do Canvas.

## Heading fixo e Dynamic heading

Selecione a Section no Canvas para editar suas propriedades no inspetor.

| Propriedade | O que faz | Exemplo |
|---|---|---|
| **Heading** | Define um título fixo para a Section. | `Defenses` |
| **Dynamic heading** | Escolhe um Field como fonte do título. | Field `phase_name` |

O título dinâmico tem prioridade quando o Field possui um valor legível. Se o Field estiver vazio, o Forge usa o Heading fixo como fallback. Se ambos estiverem vazios, a Section pode aparecer sem título.

Exemplo: defina `Heading = Phase` e `Dynamic heading = phase_name`. Uma ficha com `phase_name = Awakened` mostra `Awakened`; outra ficha sem esse valor mantém o título `Phase`.

A fonte dinâmica pode ser qualquer Field disponível no Template. O Forge usa o conteúdo legível do Value; para títulos previsíveis, Text ou Choice costuma ser mais claro que uma coleção ou valor numérico.

## Behavior: sempre aberta ou recolhível

A propriedade **Behavior** define como o conteúdo da Section aparece no statblock:

| Opção no inspetor | Estado inicial | Ação do usuário |
|---|---|---|
| **Sempre aberto** | O conteúdo aparece no layout normalmente. | Não há controle de recolhimento para a Section. |
| **Recolhível — inicia aberto** | O conteúdo aparece inicialmente. | O usuário pode recolher e reabrir a Section pelo controle no rodapé do statblock. |
| **Recolhível — inicia fechado** | O conteúdo fica fora do layout inicial. | O usuário abre a Section pelo controle no rodapé do statblock. |

No statblock publicado e na prévia interativa do Canvas, as Sections recolhíveis são representadas por botões no rodapé do statblock. O texto do botão usa o título da Section; quando não há título, o Forge gera um rótulo numerado, como `Seção (1)`. Uma Section configurada para iniciar aberta também recebe um botão para recolhê-la.

### O que acontece com o espaço quando recolhe?

O conteúdo recolhido deixa de ocupar sua área vertical. O Forge recalcula o espaço liberado para os blocos que estão abaixo **e compartilham colunas com a área liberada**. Blocos que estão ao lado, em colunas não sobrepostas, mantêm sua posição horizontal. O espaço não é convertido automaticamente em uma mudança de coluna.

Ao reabrir, a Section recupera seu conteúdo e o layout abaixo é recalculado para evitar sobreposição. Sections aninhadas continuam subordinadas ao container pai; se uma Section filha estiver dentro de uma Section recolhida, o usuário precisa revelar o container ancestral para acessá-la.

> [!important] Recolhível não é o mesmo que Hidden
> Uma Section recolhível continua fazendo parte do statblock e pode ser aberta pelo usuário. Um bloco marcado **Hidden** para jogadores é removido da visualização do jogador e não recebe botão no rodapé. Consulte [[21 - Aparência individual dos blocos]] para visibilidade.

## Grid interna da Section

Cada Section cria uma Grid independente para seus filhos. A Grid interna usa a mesma quantidade física de colunas configurada no Template, mas ocupa apenas a área reservada à Section.

- Os filhos da Section têm posições independentes dos blocos que estão fora dela.
- `Span` continua usando a escala lógica de 1 a 12 descrita em [[08 - Grid de 12 colunas]].
- A Grid pode conter Stat, Metric, Line, Text, Entries, Image, Table, outra Section, Row ou Tabs.
- Sections aninhadas criam uma nova Grid para os próprios filhos.
- O tamanho vertical da Section precisa acomodar o conteúdo dos descendentes; o Forge calcula as linhas necessárias além da altura mínima configurada quando o conteúdo exige.

Uma Section vazia mantém uma área mínima e mostra um placeholder no Canvas. Isso facilita selecionar o container e soltar Fields nele.

## Criar e preencher uma Section

1. Selecione o Canvas ou um container que aceite Sections.
2. Abra **Add container → Section**.
3. Selecione a Section para abrir suas propriedades.
4. Defina **Heading**, **Dynamic heading** e **Behavior**, se necessário.
5. Com a Section selecionada, use **Add block** ou arraste Fields da paleta para a área interna.
6. Ajuste `Span` e `Rows` dos filhos para organizar a Grid.
7. Use **Dense Layout** para escolher entre encaixe compacto e posicionamento manual; veja [[14 - Dense Layout]].

### Exemplo: seção de defesas

```text
Section: Defenses
├── Stat: Armor Class       Span 3
├── Stat: Saving Throw      Span 3
├── Stat: Damage Threshold  Span 3
└── Row: Resistances        Span 12
    ├── Tags: Resistance    Span 6
    └── Tags: Immunity      Span 6
```

A Section agrupa os dados e cria a Grid interna. A Row final cria uma faixa flexível dentro dessa Grid. Os Fields continuam independentes e podem ser usados em outros blocos compatíveis.

## Section como aba de Tabs

Quando uma Section é filha direta de um Tabs, ela representa uma aba:

- O Heading (ou Dynamic heading, se houver um valor legível) vira o rótulo da aba.
- O título não é repetido como cabeçalho dentro do painel.
- O conteúdo da Section permanece em sua própria Grid.
- Os controles de aba **← / →** e **Delete tab** aparecem no inspetor.
- O comportamento recolhível da Section não funciona como em uma Section comum; a troca de painel é controlada pelo Tabs.

Consulte [[13 - Tabs]] para as regras de abas e para a estrutura especial de Abilities.

## Problemas comuns

| Sintoma | Causa provável | Correção |
|---|---|---|
| A Section aparece sem título. | Heading vazio, Dynamic heading sem Value legível ou rótulo oculto. | Defina Heading ou preencha o Field dinâmico. |
| Um filho não entra na Section. | O destino do arraste ficou sobre a borda de outro bloco, ou a operação escolheu inserir antes/depois. | Solte na região central da Section ou selecione-a antes de usar Add block. |
| A Section ocupa mais altura que o valor Rows. | O layout interno ou o conteúdo dos filhos precisa de mais linhas. | Ajuste Span/Rows dos filhos ou reorganize o conteúdo. |
| A Section de uma aba não recolhe. | Sections diretamente dentro de Tabs são painéis, não Sections recolhíveis comuns. | Use outra Section dentro do painel se precisar de um grupo recolhível. |

## Veja também

- [[10 - Containers: visão geral]] — regras de aninhamento.
- [[12 - Row]] — faixa horizontal dentro de uma Section.
- [[13 - Tabs]] — Sections como painéis de abas.
- [[14 - Dense Layout]] — posicionamento da Grid interna.
