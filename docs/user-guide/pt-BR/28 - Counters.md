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
