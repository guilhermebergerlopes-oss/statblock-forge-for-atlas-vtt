---
title: Statblock Forge — Containers: visão geral
aliases:
  - Containers do Forge
  - Estrutura de containers
tags:
  - statblock-forge
  - documentação/layout
parte: 2
---

# Containers: visão geral

Um **Container** é uma estrutura do Canvas que reúne Fields ou outros elementos de layout. No Forge, há duas famílias: **Containers estruturais** (Section, Row e Tabs) e **Containers de dados** (Metric e Table). Todos são Containers, mas cada tipo aceita conteúdos e organiza dados de uma maneira própria.

## Comparação rápida

| Container | Família | O que contém | Uso principal |
|---|---|---|---|
| **Section** | Estrutural | Blocos e Containers compatíveis em uma Grid interna. | Agrupar atributos, defesas, características ou equipamentos em uma área com título. |
| **Row** | Estrutural | Itens compatíveis distribuídos horizontalmente. | Alinhar conteúdo em uma faixa, como AC, HP e Speed. |
| **Tabs** | Estrutural | Sections, uma por aba. | Separar grandes grupos, como ataques, magias e equipamentos. |
| **Metric** | Dados | Fields escalares compatíveis, como In-line, Number, Rating, Dice e Selection. | Apresentar Fields como métricas/valores alinhados, sem criar Fields adicionais. |
| **Table** | Dados | Fields compatíveis, com armazenamento `scores` interno. | Apresentar valores dos Fields em formato de tabela. |

## Metric e Table são Containers de dados

### Metric

Um **Metric** não é um Field nem um bloco comum: é um Container de dados. Para criá-lo, use **Add Container → Metric**. Depois, arraste Fields compatíveis sobre o Metric no Canvas ou adicione-os pelo inspetor **Fields inside this Metric**.

Metric aceita Fields `inline` (In-line), `number`, `rating`, `dice` e `selection` (Selection). Os próprios Fields continuam sendo a fonte dos dados; o Metric apenas os agrupa e controla sua apresentação. Remover um Field do Metric remove somente o vínculo com o Container, não exclui o Field nem seu Value.

### Table

Uma **Table** também é um Container de dados. Crie-a por **Add Container → Table**. O Forge administra internamente um Field nativo Atlas `scores` para armazenar as linhas e os valores da tabela; esse Field técnico não aparece como um Field comum na paleta.

Para acrescentar dados à Table, arraste um Field compatível ou use **Fields inside this Table** no inspetor. Cada Field vira uma coluna. **Show Labels in columns** controla os cabeçalhos dos Fields; **Show Labels in rows** exibe um Label para cada linha de dados, de forma independente. As duas opções podem ficar ativadas ao mesmo tempo. Quando **Allow adding rows in statblocks** está ativado, statblocks editáveis mostram a ação **Add row**. As linhas adicionais guardam seus próprios valores sem alterar os Values originais dos Fields. Reorganize os Fields pelos botões de seta no inspetor.

> [!warning] Limite de apresentação das colunas vinculadas
> Fields Pairs não são vinculados à Table. Templates antigos são migrados removendo esses vínculos e as configurações antigas de colunas, sem apagar os Fields nem seus valores.

## Como os Containers se relacionam com o Canvas

O Canvas organiza os elementos em uma árvore. Section cria uma Grid interna; Row distribui seus filhos horizontalmente; Tabs apresenta Sections como painéis. Metric e Table são Containers de dados colocados no layout, e não Fields independentes nem blocos de apresentação comuns.

```text
Canvas
├── Section: Defesas
│   ├── Metric: Valores principais
│   │   ├── Field: Armor Class (number)
│   │   └── Field: Speed (number)
│   └── Table: Defesas
│       ├── Field: Armor Class (number)
│       └── Field: Weight (number)
└── Tabs: Conteúdo
    ├── Section: Ataques
    │   └── Entries: Ataques
    └── Section: Habilidades especiais
        └── Groups: Habilidades especiais
```

A posição de cada Container é definida pelo seu pai; seus Fields-filhos são associados ao Metric ou à Table. Para colocar um Container de dados em uma aba, coloque-o dentro da Section daquela aba. Tabs aceita Sections como filhos diretos.

## Regras de aninhamento

- **Tabs** aceita somente Sections como filhos diretos. Para usar Metric ou Table em uma aba, adicione-os dentro da Section da aba.
- **Metric** aceita Fields escalares `inline` (In-line), `number`, `rating`, `dice` e `selection` (Selection).
- **Table** aceita Fields compatíveis. Cada Field vira uma coluna por padrão; os Labels dos cabeçalhos e das linhas de dados são opções independentes; a Table também pode permitir adicionar linhas em statblocks editáveis. Pairs permanece uma Collection independente.
- **Section** e **Row** seguem suas regras próprias de composição e o direcionamento automático de inserção do Canvas.
- Um bloco ou Container não pode ser movido para dentro de si mesmo ou de um descendente, pois isso criaria um ciclo.

### Arrastar Fields para Containers de dados

Ao soltar um Field compatível dentro de Metric ou Table, o Forge o associa ao Container em vez de criar um bloco independente. Um Field incompatível é rejeitado sem perder sua colocação atual. Ao arrastar um Field de dentro de um Container para uma posição comum do Canvas, o Forge remove o vínculo com o Container e cria uma colocação normal; o Field e seus Values são preservados.

Ao soltar um Field diretamente sobre Tabs, o comportamento especial de Tabs cria uma Section para a nova aba. Para acrescentar conteúdo a uma aba existente, solte-o sobre a Section correspondente.

## Containers, Fields e Values

- **Field** define o dado e seu tipo, como `hp` (`number`) ou `resistances` (`pairs`).
- **Value** é o dado de uma ficha específica.
- **Container estrutural** organiza outros elementos do layout.
- **Container de dados** agrupa Fields-filhos e controla sua apresentação; não substitui nem duplica esses Fields.

Os dados de Table usam armazenamento `scores` nativo do Atlas, gerenciado pelo próprio Container e oculto da paleta de Fields. Templates antigos com blocos Metric ou Scores são reconhecidos como Containers durante a migração; os Fields e os dados existentes são preservados.

## Como escolher

| Necessidade | Escolha | Exemplo |
|---|---|---|
| Dar título a um grupo e organizar os itens livremente. | **Section** | `Defesas`, com AC, saving throws e resistências. |
| Distribuir conteúdo compatível horizontalmente. | **Row** | AC, HP e Speed na mesma faixa. |
| Alternar entre grupos. | **Tabs** | Abas `Melee`, `Ranged` e `Spells`. |
| Agrupar valores escalares alinhados. | **Metric** | HP, AC e Speed como Fields internos do Metric. |
| Organizar valores de Fields compatíveis em colunas ou linhas identificadas por Labels. | **Table** | Atributos, defesas ou outros valores. |

## Próximas notas

- [[11 - Section]] — títulos, comportamento recolhível e Grid interna.
- [[12 - Row]] — Span, distribuição horizontal, alinhamento e altura das linhas.
- [[13 - Tabs]] — criação, edição, abas de Abilities e remoção.
- [[14 - Dense Layout]] — posicionamento dos filhos nas Grids.
- [[15 - Mover e reordenar blocos]] — arrastar, inserir e alterar a ordem estrutural.