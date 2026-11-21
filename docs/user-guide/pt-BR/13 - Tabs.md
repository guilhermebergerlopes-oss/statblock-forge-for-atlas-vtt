---
title: Statblock Forge — Tabs
aliases:
  - Abas do Statblock Forge
tags:
  - statblock-forge
  - documentação/layout
parte: 2
---

# Tabs

O container **Tabs** cria uma faixa de navegação entre painéis. Cada aba corresponde a uma **Section filha direta** do Tabs. Somente o painel ativo fica visível no statblock.

Use Tabs quando os grupos de conteúdo forem relacionados, mas não precisarem aparecer todos ao mesmo tempo, como ataques corpo a corpo, ataques à distância e magias.

## Estrutura

```text
Tabs: Combat options
├── Section: Melee
│   ├── Entries: Melee attacks
│   └── Stat: Reach
├── Section: Ranged
│   └── Entries: Ranged attacks
└── Section: Special abilities
    └── Groups: Special abilities
```

Tabs organiza as abas. Cada Section é um painel e possui sua própria Grid interna. O conteúdo continua vinculado aos Fields do Template; mudar de aba não duplica nem altera os Values.

## Heading do Tabs e títulos das abas

O próprio bloco Tabs pode ter um **Heading** fixo opcional, que aparece acima da faixa de abas. O título de cada aba vem da Section correspondente:

- **Heading** da Section define o rótulo fixo da aba.
- **Dynamic heading** da Section pode usar um Field como rótulo quando ele possui um Value legível.
- Se a Section não tiver título, o Forge usa um rótulo de fallback, como `Aba 1`, a menos que o label tenha sido ocultado.

O Heading do Tabs não substitui os títulos das Sections. Ele nomeia o conjunto; as Sections nomeiam cada painel.

## Criar um Tabs e adicionar abas

1. Selecione o Canvas ou uma Section (Tabs não pode ser colocado dentro de Row).
2. Use **Add container → Tabs container**.
3. Selecione o Tabs recém-criado.
4. Use **Add tab** no inspetor ou **Add container → Tab (Section)** na barra do Canvas.
5. O Forge cria uma Section filha; selecione-a para definir Heading/Dynamic heading.
6. Com a Section selecionada, adicione blocos ou arraste Fields para dentro do painel.
7. Repita para cada aba.

A primeira aba começa ativa em uma nova renderização do statblock. No editor, o Forge mantém a seleção da aba durante as atualizações da prévia daquela sessão de edição.

### Adicionar um Field diretamente ao Tabs

Tabs aceita somente Sections. Se você arrastar um Field diretamente para o container Tabs, o Forge cria uma Section nova, dá a ela o label do Field e coloca o bloco correspondente dentro dela. Isso cria uma nova aba.

Para adicionar o Field a uma aba que já existe, arraste-o sobre a Section daquela aba.

## Editar e reordenar abas

Selecione uma Section que seja filha direta do Tabs. O inspetor mostra os controles específicos de aba:

- **←** move a aba uma posição para a esquerda.
- **→** move a aba uma posição para a direita.
- **Heading** altera o rótulo fixo da aba.
- **Dynamic heading** define ou remove o Field usado como rótulo dinâmico.
- **Delete tab** remove a aba selecionada.

A ordem dos filhos Sections no Tabs é a ordem da faixa de abas. Mover uma aba não altera os Values dos Fields das outras abas.

## Remover uma aba: o que é removido?

**Delete tab** remove a Section selecionada e os blocos aninhados dela da árvore de layout, além dos metadados de aparência e posição desses blocos. As outras abas permanecem e o Forge ativa uma delas quando necessário.

A definição do Field e os Values já armazenados nas notas são dados separados da árvore de layout; remover a apresentação da aba não equivale a excluir automaticamente o Field ou apagar seus Values. Se o Field não for mais necessário, revise-o separadamente no editor de Fields.

## Regras e limitações

- Tabs aceita somente Sections como filhos diretos.
- Tabs aceita somente Sections como filhos diretos. Não coloque Metric, Table, Row ou blocos de conteúdo diretamente no Tabs; coloque esses elementos dentro da Section correspondente.
- Row não pode conter Tabs. Para usar Tabs dentro de uma composição horizontal, coloque uma Section dentro da Row e o Tabs dentro dessa Section.
- Cada painel Section usa a Grid configurada no Template.
- O Tabs reserva altura suficiente para a maior aba, além da faixa de navegação e de seu Heading fixo opcional.
- No statblock publicado, a área do painel é limitada pelo tamanho do bloco Tabs; dimensione o container para que o conteúdo caiba.

Se um Template antigo tiver filhos incompatíveis diretamente no Tabs, o Forge mostra um aviso no preview. Os itens incompatíveis são preservados no Template, mas o painel de Tabs só apresenta Sections como abas. Corrija a árvore movendo o conteúdo para uma Section.

## Abilities Tabs: estrutura especializada de Entries

O Forge reconhece um Tabs como **Abilities Tabs** quando cada Section filha direta contém exatamente um bloco Entries. Essa estrutura corresponde ao formato de Abilities usado pelo Atlas.

```text
Tabs: Abilities
├── Section: Actions
│   └── Entries: actions
├── Section: Reactions
│   └── Entries: reactions
└── Section: Legendary Actions
    └── Entries: legendary_actions
```

Cada aba possui seu próprio Field Entries e, portanto, sua própria lista de Values. As definições de Entry Parts são compartilhadas/clonadas a partir do formato do primeiro Field ao criar novas abas.

### Split into tabs

Um bloco Entries independente pode oferecer **Split into tabs** quando está no Canvas principal ou dentro de uma Section comum. O comando não é oferecido para Entries diretamente dentro de Row nem para Entries que já está dentro de uma aba.

Ao executar:

1. O bloco Entries original é preservado e passa a ser o conteúdo da primeira aba.
2. O Forge cria um Tabs e duas Sections.
3. Cria um novo Field Entries para a segunda aba, copiando a estrutura de Entry Parts do Field original.
4. O novo bloco Entries da segunda aba usa esse novo Field; a lista de Values é independente.

O Forge não transforma uma única lista em duas listas compartilhadas. A primeira aba mantém os dados existentes; a segunda começa como outra coleção.

### Adicionar e remover abas de Abilities

Quando o Tabs é reconhecido como Abilities Tabs, o inspetor oferece **Adicionar aba de Abilities**. A nova aba recebe uma Section, um Field Entries próprio e a estrutura de Parts clonada da primeira aba.

Ao remover uma aba, o Forge remove seu bloco da árvore de layout, mas mantém o Field e os dados armazenados. Se restar apenas uma aba, o wrapper Tabs e a Section restante são removidos e o Entries restante volta a ser um bloco direto, preservando o Field e sua lista.

Se você adicionar outros blocos dentro de uma Section de Abilities, aquela estrutura deixa de corresponder ao formato especializado (cada aba precisa conter exatamente um Entries). O Tabs pode continuar funcionando como Tabs comum, mas os comandos específicos de Abilities deixam de se aplicar.

## Exemplo de decisão

| Conteúdo | Estrutura sugerida |
|---|---|
| Vários ataques que devem aparecer juntos. | Uma Entries, possivelmente dentro de Section. |
| Ataques corpo a corpo e à distância em painéis separados, cada qual com uma lista própria. | Abilities Tabs com um Entries por Section. |
| Ataques, bônus de ataque e alcance no mesmo painel. | Tabs com Section; dentro da Section, Entries e Stat. Não é Abilities Tabs especializada. |
| Valores agrupados por categoria. | Tabs genérico com uma Section por grupo, ou um bloco Groups. |

## Veja também

- [[10 - Containers: visão geral]] — regras de aninhamento.
- [[11 - Section]] — Heading e Grid interna das abas.
- [[12 - Row]] — por que Tabs precisa ficar fora de uma Row direta.
- [[15 - Mover e reordenar blocos]] — drag-and-drop e ordem estrutural.
