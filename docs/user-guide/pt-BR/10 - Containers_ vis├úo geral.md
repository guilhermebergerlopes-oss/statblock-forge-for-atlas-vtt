---
title: "Statblock Forge — Containers: visão geral"
aliases:
  - Containers do Forge
  - Estrutura de containers
tags:
  - statblock-forge
  - documentação/layout
parte: 2
---

# Containers: visão geral

Um **container** é um bloco estrutural que organiza outros blocos. Ele define como os filhos são agrupados, posicionados e dimensionados. Containers não representam propriedades da ficha: não precisam de Field, não armazenam Value e não criam dados novos por si só.

O Forge possui três containers: **Section**, **Row** e **Tabs**. Eles não são intercambiáveis: cada um tem regras diferentes de composição e de aninhamento.

## Comparação rápida

| Container | Modelo de composição | Como os filhos são posicionados | Melhor aplicação |
|---|---|---|---|
| **Section** | Grupo com uma Grid própria. | Cada filho ocupa uma posição independente na Grid interna. | Separar atributos, defesas, características ou equipamento em uma área nomeada. |
| **Row** | Faixa horizontal flexível. | Os filhos compartilham a largura proporcionalmente por `Span` e seguem a ordem da lista. | Alinhar valores curtos, como AC, HP e Speed, ou criar uma faixa de indicadores. |
| **Tabs** | Navegação entre painéis. | Cada aba é uma Section filha direta; somente o painel ativo é mostrado. | Separar grupos extensos — ataques, magias e equipamento — sem exibi-los simultaneamente. |

## Como os containers se relacionam com a Grid

A Grid principal organiza os filhos diretos do Canvas. Uma **Section** cria outra Grid para seus próprios filhos. As Sections que funcionam como abas também têm uma Grid interna. Essas Grids usam a mesma quantidade física de colunas configurada no template; uma Grid aninhada não reduz a contagem porque sua Section ocupa apenas uma parte da área externa.

Uma **Row não cria uma Grid interna**. Ela distribui os filhos em linhas flexíveis, usando `Span` como peso relativo. Um **Tabs** organiza Sections em painéis; não é uma Grid para inserir blocos diretamente.

```text
Canvas / Grid principal
├── Section: Defesas          ← possui sua própria Grid
│   ├── Stat: Armor Class
│   ├── Stat: Saving Throws
│   └── Row: Resistências     ← faixa horizontal dentro da Section
│       ├── Tags: Resistances
│       └── Tags: Immunities
└── Tabs: Conteúdo            ← ocupa uma posição na Grid principal
    ├── Section: Ataques      ← painel / aba com Grid própria
    │   └── Entries: Attacks
    └── Section: Magias
        └── Spells: Spell list
```

O diagrama é um exemplo de árvore. A posição de cada container é definida pelo seu pai; a posição dos filhos é definida pelo container imediato.

## Regras de aninhamento

O Forge preserva a árvore de containers. As regras para filhos diretos são:

| Pai | Pode receber | Não pode receber diretamente |
|---|---|---|
| **Canvas / Grid principal** | Blocos de conteúdo, Section, Row e Tabs. | — |
| **Section** | Blocos de conteúdo, outras Sections, Rows e Tabs. | — |
| **Row** | Blocos de conteúdo e Sections. | Outra Row ou Tabs. |
| **Tabs** | Somente Sections. | Stat, Metric, Entries, Row, Tabs ou qualquer bloco de conteúdo diretamente. |

Além disso, um bloco não pode ser movido para dentro de si mesmo ou de um descendente. Isso criaria um ciclo na árvore e é recusado.

### O que acontece quando a inserção não é compatível?

A barra **Add block** / **Add container** considera a última seleção:

1. Se o último bloco selecionado for um container que aceita o tipo escolhido, o novo item entra dentro dele.
2. Se não aceitar, o Forge procura o nível ancestral mais próximo que aceite aquele tipo e insere o item ao lado do bloco ou container selecionado.
3. Se houver vários blocos selecionados, o último selecionado é a referência de inserção.

Por isso, uma opção pode continuar disponível mesmo quando não pode ser filha direta do container atual: o Forge pode redirecionar a inserção para um nível compatível. Para inserir conteúdo em uma aba existente, selecione a **Section daquela aba**, não o Tabs.

### Arrastar um Field para Tabs

Se um Field da paleta for solto diretamente em um Tabs, o Forge cria uma Section nova, usa o label do Field como título da nova aba e coloca o bloco vinculado dentro dela. Se o Field já tiver um bloco no layout, o Forge move essa representação existente para a nova Section em vez de criar uma segunda apresentação independente.

Para acrescentar o Field a uma aba existente, solte-o sobre a Section que representa essa aba.

## Containers não são Fields nem blocos de conteúdo

- **Field** define uma propriedade e seu tipo de dado, como `might`, `hp` ou `attacks`.
- **Value** é o dado de uma ficha específica, como `might = 8`.
- **Bloco de conteúdo** apresenta um Field ou texto, por exemplo `Stat`, `Metric`, `Entries` ou `Image`.
- **Container** organiza blocos de conteúdo e outros containers.

Criar uma Section, Row ou Tabs não cria uma nova propriedade na ficha. Consulte [[05 - Fields]] para os dados e [[07 - Canvas e layout]] para os blocos.

## Containers vazios

Um container recém-criado pode mostrar um placeholder no Canvas até receber filhos. Isso não significa que o Template esteja inválido. Se o preview mostrar uma mensagem como “Adicione uma Section para criar uma aba”, adicione o tipo de filho exigido pelo container.

## Como escolher

| Necessidade | Escolha | Exemplo |
|---|---|---|
| Dar um título a um conjunto e organizar seus itens livremente. | **Section** | `Defesas`, com AC, saving throws e resistências. |
| Colocar pequenos blocos lado a lado. | **Row** | AC, HP e Speed na mesma faixa. |
| Alternar entre grupos que não precisam aparecer juntos. | **Tabs** | Abas `Melee`, `Ranged` e `Spells`. |

Não crie uma Row apenas para obter uma área com título: use Section. Não crie várias Sections lado a lado para simular uma faixa de largura proporcional: use Row. Não use Tabs quando todos os grupos precisarem ficar visíveis simultaneamente.

## Próximas notas

- [[11 - Section]] — título fixo/dinâmico, comportamento recolhível e Grid interna.
- [[12 - Row]] — Span, distribuição horizontal, alinhamento e altura das linhas.
- [[13 - Tabs]] — criação, edição, abas de Abilities e remoção.
- [[14 - Dense Layout]] — posicionamento dos filhos nas Grids.
- [[15 - Mover e reordenar blocos]] — arrastar, inserir e alterar a ordem estrutural.
