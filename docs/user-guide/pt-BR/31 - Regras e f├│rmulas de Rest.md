---
title: Statblock Forge — Regras e fórmulas de Rest
tags:
  - statblock-forge
  - documentação/recursos-avançados
  - documentação/rest
parte: 4
---

# Regras e fórmulas de Rest

Uma regra Rest define **o que será alterado**, **qual operação será executada** e, quando necessário, **qual quantidade será recuperada ou gasta**. O editor oferece cinco operações para Resources e Counters. Conditions são gerenciadas pelo Atlas e não são alvos válidos das regras Rest do Forge.

## Operações disponíveis

| Operação no editor | ID interno | Alvo | Efeito |
|---|---|---|---|
| **Restore to full** / Recuperar até o máximo | `full` | Resource ou Counters | Leva o Resource ao limite cheio/vazio correto conforme a direção de tracking; para Counters, recupera os usos gastos. |
| **Restore formula** / Recuperar uma quantidade | `amount` | Resource ou Counters | Calcula ou rola uma quantidade e a recupera. Pode ter um mínimo opcional. |
| **Restore a share** / Recuperar uma fração | `share` | Resource ou Counters | Recupera 25% ou 50% do máximo, com arredondamento para baixo ou para cima e mínimo opcional. |
| **Set value** / Definir valor | `set` | Resource ou Counters | Define o valor atual; em Counters, o número informado representa usos restantes. |
| **Spend another resource** / Gastar outro recurso | `spend` | Resource ou Counters | Gasta unidades de outra origem Resource/Counter e calcula a recuperação por unidade. |

Todas as cinco operações disponíveis usam alvos Resource ou Counters.

## Como o Forge reconhece um Resource

Um **Resource local** é baseado em um Field do tipo **Number** com tracking configurado. O tracking pode vir de:

1. `tracks` no próprio Field, com direção **Counts down** ou **Counts up**; ou
2. um bloco **Track** sem Resource Atlas vinculado, que aponta para um Number Field e define a direção.

Um Field Number também pode apontar para outro Number Field como máximo. Se o máximo não for configurado ou não resolver para um Field Number válido, o Forge usa o próprio Field como máximo.

### Counts down e Counts up

| Direção | Estado cheio | Gastar | Recuperar |
|---|---|---|---|
| **Counts down** | Atual = máximo | Diminui o atual. | Aumenta o atual até o máximo. |
| **Counts up** | Atual = 0 | Aumenta o atual até o máximo. | Diminui o atual em direção a zero. |

Exemplo: `hp` com máximo 20 e **Counts down** começa em 20; receber 6 de dano deixa 14, e recuperar 4 deixa 18. Um Resource **Counts up** com máximo 6 começa em 0; gastar 2 o leva a 2, e recuperar 1 o leva a 1.

### Onde o valor atual é armazenado

Quando o próprio Field é também o máximo, o valor máximo permanece associado ao Field Number e o atual é mantido no estado reservado `__forgeResourceValues` da ficha. Quando o máximo é outro Field, o valor atual fica no Field rastreado e o máximo é lido do Field configurado.

O estado de tracking é por statblock; dois personagens que usam o mesmo Template não compartilham o valor atual.

### Resources de uma coleção Atlas

Se o Template está associado a um contexto de coleção Atlas e um Resource da coleção lê um Field compatível, esse Resource pode aparecer como alvo/origem no editor. Seu valor atual continua pertencendo ao estado do personagem/token Atlas — não é convertido em Counter local nem salvo como Value comum do Forge.

Resources de coleção estáticos ou sem um valor atual disponível não podem ser alterados. Para gravar um Resource de coleção, o personagem correspondente precisa estar disponível em um contexto Atlas compatível; sem isso, a regra pode ser ignorada ou não ser oferecida.

## Counters como alvo e como origem

Um Field **Counters** tem linhas com nome, máximo e quantidade usada (`used`). A quantidade restante é `max - used`. Ao gastar um Counter, `used` aumenta; ao recuperar, `used` diminui.

As regras de Counter podem apontar para:

- **All rows:** todas as linhas válidas do Field;
- um conjunto de linhas associadas a botões Rest específicos.

A associação usa IDs estáveis dos botões Rest, embora o editor mostre os nomes. Reordenar ou renomear botões não deve ser tratado como a criação de novos IDs.

### Restore to full e `regain`

Ao recuperar Counters até o máximo, cada linha selecionada sem fórmula `regain` tem `used` zerado. Se uma linha tem `regain`, o Forge rola essa fórmula para a linha que ainda tem usos gastos e reduz `used` pelo resultado, sem passar abaixo de zero.

`regain` é uma fórmula de dados que precisa conter pelo menos um dado. Ela aceita referências `@field_key` e `{field_key}`, resolvidas com os Values do statblock durante o Rest. Fórmulas de `regain` são avaliadas por linha, ao contrário de **Restore formula** em um Counter Field.

Propriedades de Counter podem ser usadas em fórmulas de Rest e expressões `regain`. Por exemplo, `{spell_slots.0.remaining}d4` usa os usos restantes da primeira linha como quantidade de dados, enquanto `{spell_slots.remaining}` consulta os usos restantes agregados e `@spell_slots.total.used` consulta todos os usos gastos. Os caminhos de linha incluem `max`, `used`/`spent`, `remaining`/`current`/`available`, `remainingPercent`/`percent`/`availablePercent`/`currentPercent`, `usedPercent`/`spentPercent` e `isFull`/`isEmpty`. Valores agregados ficam disponíveis por `.total` ou por atalhos na raiz, como `{spell_slots.remaining}`; os caminhos agregados incluem `.total.remaining`/`.total.current`/`.total.available` e `.total.used`/`.total.spent`; percentuais agregados são ponderados pelos máximos das linhas. `count` retorna a quantidade de linhas visíveis. Estados booleanos resultam em `1` ou `0`. Referências percentuais podem ser fracionárias, mas fórmulas de dados do Rest exigem inteiros; use uma fórmula Number/Rating para arredondar ou aplicar `floor` ao percentual antes de usá-lo como quantidade de dados. Consulte [[28 - Counters]] para ordem das linhas, linhas ocultas, aliases e exemplos. As fórmulas de Rest mantêm a gramática própria do parser de dados do Rest.

### Restore formula em Counters

Para uma regra `amount` cujo alvo é Counters, a fórmula é calculada/rolada **uma vez para o Field Counter**. A mesma quantidade recuperada é então aplicada às linhas selecionadas. Isso não significa uma rolagem independente por linha.

Já **Restore a share** calcula a fração usando o máximo de cada linha selecionada; por isso linhas com máximos diferentes podem recuperar quantidades diferentes.

## As cinco operações em detalhe

### 1. Restore to full (`full`)

- **Resource:** Counts down vai para o máximo; Counts up vai para zero.
- **Counters:** reduz `used` a zero nas linhas selecionadas, exceto quando a linha tem `regain`; nesse caso, rola `regain` e recupera apenas a quantidade obtida.

### 2. Restore formula (`amount`)

Informe uma fórmula e, opcionalmente, um valor **Minimum**. O ganho aplicado é o maior entre zero, o mínimo informado e o resultado calculado/rolado.

Exemplos de fórmulas:

```text
1d8
2d6+2
@level d4
(@proficiency+1)*2
```

`@level d4` usa `level` como quantidade de dados. Se `level = 3`, a fórmula preenchida será `3d4`. `(@proficiency+1)*2` é um exemplo determinístico: com `proficiency = 2`, calcula 6 sem rolar dados.

Em um Resource Counts down o ganho aumenta o atual; em Counts up, reduz o atual. Para Counters, o ganho reduz `used` nas linhas selecionadas.

### 3. Restore a share (`share`)

Selecione **25%** ou **50%**, a direção de arredondamento (**Round down** ou **Round up**) e, opcionalmente, um mínimo.

Exemplo com máximo 17:

- 25% arredondado para baixo = 4;
- 25% arredondado para cima = 5;
- 50% arredondado para baixo = 8;
- 50% arredondado para cima = 9.

O mínimo, quando configurado, substitui uma fração menor: o ganho é `max(mínimo, fração arredondada)`. Em Counters, o cálculo é feito com o máximo individual de cada linha.

### 4. Set value (`set`)

Defina o valor atual por um inteiro fixo ou ative **Use another field as the value** e escolha um Field Number/Rating. A referência é lida como valor numérico calculado do Field selecionado.

Para Counters, o número representa **usos restantes**, não `used`. Exemplo: uma linha com máximo 5 e `Set value = 2` termina com 2 usos restantes (`used = 3`).

O valor final é limitado ao intervalo válido do alvo. Um Field de origem ausente ou não numérico faz a regra ser ignorada.

### 5. Spend another resource (`spend`)

Esta operação tem um **alvo de recuperação** e uma **origem do gasto**:

- **Target field:** Resource ou Counters que receberá a recuperação;
- **Spend from:** outro Resource ou Counters de onde as unidades serão consumidas;
- **Per unit:** fórmula de recuperação para cada unidade gasta;
- **Maximum spent (optional):** limite adicional de unidades que podem ser escolhidas.

A quantidade disponível é limitada pelo saldo atual da origem. Para Resource Counts down, o disponível é o atual; para Counts up, é `máximo - atual`; para Counters, é a soma dos usos restantes das linhas selecionadas.

A fórmula **Per unit** é combinada de acordo com a quantidade escolhida antes da avaliação/rolagem. Por exemplo, duas unidades de `1d8+2` representam duas parcelas somadas (`2d8+4` na forma linear). Fórmulas com modificadores que não podem ser escalados linearmente são mantidas como parcelas separadas.

O Forge valida a origem, o alvo, a quantidade e a fórmula com os Values atuais. Só aplica o gasto e a recuperação quando a operação pode ser calculada. Uma regra Spend pode aparecer no seletor mesmo sem escolhas de ação; nesse caso ela própria é suficiente para abrir o seletor.

## Sintaxe das fórmulas de Rest

As fórmulas de **Restore formula**, **Per unit** e `regain` usam o parser de dados do Forge/Atlas, não a linguagem Number/Rating.

### Referências `@field` e `{field}`

Use `@` ou chaves em torno da key do Field para inserir seu valor numérico. As duas formas podem ser misturadas na mesma fórmula:

```text
@level d4
1d8+@proficiency
(@might+2)*2
```

Para Fields Number/Rating, o Forge lê o valor numérico calculado desse Field. Uma referência que não resolve para um inteiro seguro é recusada; o motor não arredonda silenciosamente frações para utilizá-las como quantidade de dados ou constante.

Se a referência for seguida por `d` (com ou sem espaço), ela é interpretada como quantidade de dados e precisa ficar entre 0 e 999. Em outros contextos, ela entra como constante inteira com módulo máximo 9.999. Referências podem usar caminhos com ponto quando os dados estão aninhados, por exemplo `@attributes.might` ou `{attributes.might}`. Para keys com hífen, prefira `{field-key}`.

### Operadores e dados

A gramática de dados aceita `+`, `-`, `*`, `/`, parênteses e os termos de dados documentados em [[27 - Dice Fields e Set Dice]], incluindo dados percentuais/Fate e modificadores reconhecidos pelo parser. A divisão preserva a fração durante a expressão e o total é truncado para inteiro no resultado.

O limite do campo de fórmula de Rest é **100 caracteres**. Além disso, o parser aplica os próprios limites de termos, dados, faces e profundidade.

> [!warning] Não misture as famílias de fórmulas
> Fórmulas de Rest aceitam referências `@field_key` e `{field_key}`. Elas não aceitam `floor()`, `ceil()`, `round()`, `min()`, `max()`, comparações, operadores booleanos ou ternários. Use [[25 - Fórmulas em Number e Rating]] para cálculos determinísticos do Field e [[27 - Dice Fields e Set Dice]] para rolagens dinâmicas em Fields `dice`.

> [!important] Exceção de `regain`
> A fórmula `regain` de uma linha Counter precisa conter pelo menos um dado. Ela também aceita referências `@field_key` e `{field_key}`, resolvidas com os Values do statblock durante o Rest; cada linha é avaliada separadamente.

## Ordem, falhas e segurança dos dados

As regras diretas do botão são avaliadas primeiro; em seguida, são avaliadas as regras de cada ação escolhida, na ordem das escolhas. Cada regra trabalha com os resultados das alterações anteriores daquela mesma execução quando aplicável.

Se o alvo, a fórmula, a referência, a origem de gasto ou os dados armazenados não puderem ser resolvidos, o resultado marca a regra como **Not applied**/**Ignorada**. As demais regras válidas ainda podem ser aplicadas.

Antes de gravar, o Forge relê o arquivo da ficha e valida novamente as escolhas e os gastos contra os saldos atuais. Isso evita gastar um valor que foi alterado por outra edição enquanto o seletor estava aberto.

## Veja também

- [[30 - Rest: configuração e fluxo]] — botões, execução e limites.
- [[32 - Escolhas e ações de Rest]] — etapas, ações e gastos solicitados ao jogador.
- [[25 - Fórmulas em Number e Rating]] — cálculos numéricos.
- [[27 - Dice Fields e Set Dice]] — gramática de dados e conjuntos.
- [[28 - Counters]] — `max`, `used`, `reset` e `regain`.
- [[29 - Conditions]] — Conditions dos Tokens são gerenciadas pelo Atlas, fora das regras Rest do Forge.
