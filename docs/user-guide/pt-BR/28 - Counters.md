---
title: Statblock Forge — Counters
aliases:
  - Contadores
  - Counter Field
tags:
  - statblock-forge
  - documentação/recursos-avançados
  - documentação/counters
parte: 4
---

# Counters

Um Field do tipo **Counter** define várias linhas de contadores nomeados. Cada linha tem um máximo, acompanha quantos usos foram gastos e pode definir uma fórmula opcional de recuperação (`regain`). É indicado para cargas, usos por descanso, munição especial, ativações limitadas e habilidades com quantidade finita.

O Template define os presets das linhas. Cada statblock mantém seu próprio estado de uso e as próprias associações com os botões Rest.

## Criar um Counter Field

1. No Template, adicione um Field na categoria **Values** e selecione o tipo **Counter**.
2. Selecione o Field na lista de Fields.
3. No inspetor, abra **Counter rows**.
4. Clique em **Adicionar Counter**.
5. Preencha o nome opcional, o máximo e a fórmula opcional **Recuperação**.
6. Use as setas para reordenar as linhas e `×` para remover uma linha.
7. Salve o Template e confira o bloco **Counters** no Canvas.

Cada linha de preset tem:

| Propriedade | Significado | Regra |
|---|---|---|
| `name` | Nome exibido | Texto; pode ficar vazio. |
| `max` | Total máximo de usos | Inteiro de `0` a `99`. |
| `regain` | Dados recuperados por **Restore to full** | Fórmula literal válida e contendo pelo menos um dado; opcional. |

Uma linha com `max = 0` não aparece no statblock. Ao adicionar uma linha, o nome começa vazio e o máximo inicial é `1`.

## Como o contador é armazenado

O estado de cada linha usa principalmente:

- `max`: limite da linha;
- `used`: quantidade já gasta;
- `remaining`: valor exibido, calculado como `max - used`;
- `reset`: ID do botão Rest associado à linha, quando escolhido;
- `regain`: fórmula da linha, quando configurada.

`remaining` é derivado; o campo persistido é `used`. Gastar um uso aumenta `used`; recuperar diminui `used`. O valor fica limitado entre `0` e `max`.

Exemplo conceitual de uma linha:

```json
{
  "name": "Breath Weapon",
  "max": 3,
  "used": 1,
  "regain": "1d4"
}
```

Essa linha tem `2 / 3` usos restantes. O `reset` pode ser acrescentado na ficha quando a linha é atribuída a um botão Rest; não é herdado do preset do Template.

## Referenciar Counters em fórmulas

Fields Counter podem ser consultados por fórmulas Number/Rating, Dice Formula, fórmulas de Table/Metric que usam o resolvedor numérico compartilhado e fórmulas de Rest (incluindo `regain` de uma linha). Use a key do Counter seguida pelo índice da linha, começando em zero, e uma propriedade numérica:

| Referência | Valor |
|---|---|
| `{spell_slots.0.max}` | Máximo de usos da primeira linha configurada. |
| `{spell_slots.0.used}` ou `{spell_slots.0.spent}` | Usos já gastos nessa linha. |
| `{spell_slots.0.remaining}` | Usos ainda disponíveis: `max - used`. |
| `{spell_slots.0.current}` ou `{spell_slots.0.available}` | Aliases de `remaining`. |
| `{spell_slots.total.max}` | Soma dos máximos de todas as linhas visíveis. |
| `{spell_slots.total.used}` ou `{spell_slots.total.spent}` | Soma dos usos gastos em todas as linhas visíveis. |
| `{spell_slots.total.remaining}`, `{spell_slots.total.current}` ou `{spell_slots.total.available}` | Soma dos usos restantes em todas as linhas visíveis. |
| `{spell_slots.count}` ou `{spell_slots.total.count}` | Quantidade de linhas visíveis (`max > 0`). |
| `{spell_slots.0.percent}` / `{spell_slots.0.remainingPercent}` | Percentual de usos restantes na primeira linha (`remaining / max * 100`). |
| `{spell_slots.0.availablePercent}` / `{spell_slots.0.currentPercent}` | Aliases de `remainingPercent`. |
| `{spell_slots.0.usedPercent}` / `{spell_slots.0.spentPercent}` | Percentual de usos gastos na primeira linha (`used / max * 100`). |
| `{spell_slots.0.isFull}` / `{spell_slots.0.isEmpty}` | Estado booleano da linha, retornado como `1` ou `0`. |
| `{spell_slots.total.remainingPercent}` / `{spell_slots.total.percent}` | Percentual restante do conjunto de linhas visíveis, calculado sobre as somas (ponderado pelo máximo de cada linha). |
| `{spell_slots.total.usedPercent}` / `{spell_slots.total.spentPercent}` | Percentual gasto do conjunto de linhas visíveis. |
| `{spell_slots.total.isFull}` / `{spell_slots.total.isEmpty}` | Indica se o conjunto visível está cheio ou vazio, retornando `1` ou `0`. |
| `{spell_slots.max}`, `{spell_slots.used}`, `{spell_slots.remaining}`, `{spell_slots.count}` | Atalhos para os caminhos agregados correspondentes sob `.total`. |

O índice começa em `0` e segue a ordem combinada dos presets do Template e das linhas da ficha. Uma linha com `max = 0` fica oculta, mas mantém sua posição nas referências por índice; linhas ocultas não entram em `total` nem em `count`. O resolvedor usa as linhas efetivas exibidas no statblock: se uma linha de preset ainda não foi gravada no Value da ficha, seu máximo configurado continua disponível para fórmulas e seu `used` começa em `0`.

Exemplos:

```text
{spell_slots.0.remaining} + {spell_slots.1.remaining}
floor({spell_slots.total.remaining} / 2)
{spell_slots.count} >= 2 ? {spell_slots.0.max} : 0
{spell_slots.0.isEmpty} ? 0 : 1d{spell_slots.0.max}
{spell_slots.total.remainingPercent} >= 50 ? 2 : 1
{spell_slots.remaining} + {spell_slots.used}
```

Referências percentuais retornam um decimal de `0` a `100` e não são arredondadas. `percent` é alias de `remainingPercent`. `isFull` é verdadeiro (`1`) quando a linha/conjunto visível tem máximo positivo e nenhum uso gasto; `isEmpty` é verdadeiro (`1`) quando tem máximo positivo e nenhum uso restante. Uma linha oculta com `max = 0` não possui percentual nem estado cheio/vazio. Os nomes das propriedades não diferenciam maiúsculas de minúsculas; `remaining_percent` e `remaining-percent` também são aceitos.

Todas as propriedades agregadas podem omitir `.total`: `{spell_slots.remaining}` equivale a `{spell_slots.total.remaining}`, e `{spell_slots.remainingPercent}` ou `{spell_slots.isFull}` consultam os valores derivados agregados correspondentes. Use a forma `.0`, `.1` etc. para consultar uma linha específica. Percentuais agregados são calculados pela soma de usos restantes/máximos ou gastos/máximos, não pela média dos percentuais das linhas.

Somente propriedades numéricas do Counter podem ser usadas como entradas de fórmula. Os textos `name`, `reset` e `regain` da linha não são referências numéricas. Se uma linha/caminho não existir ou o estado salvo for inválido, a referência fica indisponível em vez de ser silenciosamente convertida em zero. Em Dice Formula e expressões de dados do Rest, os valores resolvidos também precisam respeitar os limites de inteiros do parser de dados; percentuais fracionários, portanto, não podem ser usados como quantidade de dados ou faces sem antes serem convertidos para inteiro por uma fórmula Number/Rating.

## Como os Counters são apresentados

O bloco **Counters** organiza cada contador em uma célula. A quantidade de contadores por linha é uma propriedade do bloco, **Counters per row**:

- padrão: `2`;
- digite qualquer número inteiro positivo; não há máximo configurado.

O modo do indicador depende do `max` de cada linha:

| Máximo | Apresentação |
|---|---|
| `1` a `10` | Pips/marcadores individuais. Clicar em um marcador define quantos usos restam. |
| `11` a `99` | Stepper numérico `−` e `+`. |
| `0` | Linha oculta. |

### Mostrar valores numéricos

A opção **Show numeric values (remaining / maximum)** controla a exibição adicional de `remaining / max`.

- Por padrão, fica desligada para contadores pequenos.
- Pode ser ativada para mostrar, por exemplo, `3 / 5` junto aos pips.
- Se qualquer linha tiver `max > 10`, o Forge ativa essa opção automaticamente, pois o stepper grande precisa apresentar o valor numérico.

O indicador visual e os valores não alteram a lógica do contador.

## Fórmula `regain`

`regain` é uma fórmula literal de dados associada à linha do Counter. Ela é verificada ao editar o Template e precisa:

- ser aceita pelo parser de dados;
- conter pelo menos um termo de dado;
- respeitar os limites do motor de dados.

Exemplos válidos:

```text
1d4
2d6+1
(1d8+2)
```

Não use `floor()`, `max()` ou ternários em `regain`. A fórmula precisa conter pelo menos um dado, mas pode usar referências `@field` e `{field}` resolvidas com os Values do statblock durante o Rest. O limite do parser de dados continua valendo (100 caracteres, 20 termos e os demais limites descritos em [[27 - Dice Fields e Set Dice]]).

### Quando `regain` é usada

A fórmula da linha é consultada quando uma regra Rest de **Restore to full** alcança aquele Counter:

- Sem `regain`: a linha é totalmente recuperada; `used` é zerado.
- Com `regain`: o Forge rola a fórmula daquela linha e reduz `used` pelo resultado, sem permitir que fique abaixo de zero.

Portanto, uma linha com `used = 3` e `regain = 1d4` pode recuperar de 1 a 4 usos, limitado ao que foi gasto. Uma linha com `used = 0` já está cheia e não precisa recuperar.

**Restore formula** é uma operação diferente: calcula/rola uma quantidade uma vez e aplica essa quantidade às linhas selecionadas. Não é a mesma coisa que rolar o `regain` individual de cada linha.

## Atribuir uma linha a um botão Rest

Na ficha, cada linha pode ser associada a um botão de descanso por meio do seletor de recuperação. A associação grava o ID estável do botão no `reset` da linha.

No editor das regras Rest, o alvo Counters pode incluir:

- **All rows** — todas as linhas elegíveis do Field;
- linhas associadas a um ou mais botões Rest escolhidos.

A associação é por statblock. O Template define os presets `name`, `max` e `regain`, mas não decide qual botão cada personagem usa para recuperar aquela linha.

## Counters em regras Rest

| Operação | Comportamento sobre Counters |
|---|---|
| **Restore to full** | Para cada linha selecionada, zera `used` quando não há `regain`; quando há, rola o `regain` daquela linha. |
| **Restore formula** | Calcula/rola uma quantidade e reduz `used` das linhas selecionadas pelo valor recuperado. |
| **Restore a share** | Calcula a fração permitida do máximo e recupera usos nas linhas selecionadas. |
| **Set value** | Define o número de usos restantes das linhas selecionadas. |
| **Spend** | Consome usos de um Counter como fonte para recuperar outro alvo, de acordo com a regra configurada. |

As linhas são selecionadas pelo escopo da regra e pelas associações `reset`. Consulte [[31 - Regras e fórmulas de Rest]].

## Counter Field não é Resource

Esses conceitos podem parecer semelhantes, mas têm modelos diferentes:

| Counter Field | Resource |
|---|---|
| Pode agrupar várias linhas nomeadas em um único Field. | Representa um valor rastreado, frequentemente um Number ou Resource da coleção Atlas. |
| Cada linha tem `max`, `used` e opcional `regain`. | Usa direção de tracking (counts up/down), valor atual e máximo. |
| `reset` identifica o botão Rest associado. | A disponibilidade/armazenamento pode depender do Resource Forge ou Atlas. |
| É exibido pelo bloco Counters. | Pode ser exibido por Track ou usado nas regras Rest. |

Um Rest pode gastar um Counter e recuperar um Resource, ou gastar um Resource e recuperar Counters.

## Ability Part Counter é outra coisa

Um **Counter dentro de uma Ability Part** é um controle local de usos associado a uma parte de Entry/Ability. Ele pode aparecer como pips ou checkboxes e possui máximo próprio (o modelo de parte suporta valores de 1 a 12).

Esse contador pertence àquela parte da habilidade. Ele não é um Counter Field, não possui a mesma lista de linhas e não usa a mesma atribuição `reset`/`regain` das regras Rest do Counter Field.

## Mudanças no Template e fichas existentes

Os presets do Template descrevem as linhas iniciais. Os dados de uso de cada ficha são próprios daquela instância. Ao editar a estrutura de Counters, confira fichas já criadas e seus Values antes de remover ou renomear linhas; a associação pode depender da ordem/identidade dos presets e dos nomes existentes.

Antes de uma alteração em lote, faça backup das notas de statblock.

## Diagnóstico

| Sintoma | Verificação |
|---|---|
| Uma linha não aparece | Confira se `max` é maior que zero. |
| Aparece stepper em vez de pips | O máximo está acima de 10. |
| O valor `remaining / maximum` não aparece | Ative **Show numeric values**; para max acima de 10, ele é forçado. |
| `regain` não é aceito | Use uma fórmula de dados literal válida contendo ao menos um dado. |
| Uma regra Rest não atinge a linha | Confira o escopo da regra e a associação do botão em `reset`. |
| O contador não recupera tudo | Confira se há `regain`; com a fórmula presente, a quantidade recuperada é o resultado da rolagem, não automaticamente o máximo. |

## Veja também

- [[27 - Dice Fields e Set Dice]] — notação de dados e limites do parser.
- [[29 - Conditions]] — Conditions dos Tokens, gerenciadas pelo Atlas.
- [[30 - Rest: configuração e fluxo]] — botões de descanso.
- [[31 - Regras e fórmulas de Rest]] — operações que gastam/recuperam Counters.
- [[32 - Escolhas e ações de Rest]] — custos e escolhas de ações.
