---
title: Statblock Forge — Checkboxes e referências booleanas
aliases:
  - Boolean Fields
  - Opções booleanas
tags:
  - statblock-forge
  - documentação/recursos-avançados
  - documentação/fórmulas
parte: 4
---

# Checkboxes e referências booleanas

Um Field do tipo **Checkboxes** armazena opções com estado booleano: marcada (`true`) ou desmarcada (`false`). Cada conjunto possui a opção **Escolhas múltiplas**. Em Fields novos, ela começa desativada e somente uma opção pode ficar marcada por vez. Ative-a para permitir várias opções marcadas no mesmo conjunto. A configuração é independente por Field: outros conjuntos Checkboxes podem ter sua própria seleção, sem interferência.

Use Checkboxes para características que ligam/desligam: voar, nadar, estar protegido por escudo, possuir visão no escuro, ativar uma postura ou receber uma condição de equipamento. Não use um Checkbox quando o dado precisa contar mais de dois estados; nesse caso, Selection, Number ou outro Field pode ser mais adequado.

## Escolhas únicas e múltiplas

No inspetor do Field, ative **Escolhas múltiplas** para permitir mais de uma opção marcada naquele conjunto. Quando desativada, marcar uma opção desmarca as demais opções do mesmo Field. Desmarcar a opção selecionada deixa o conjunto sem seleção. Outros Fields Checkboxes nunca são afetados.

Templates antigos que não possuem essa configuração são abertos em modo múltiplo para preservar o comportamento anterior. Fields Checkboxes criados agora começam em modo de escolha única. Ao desativar escolhas múltiplas em um conjunto que já tinha várias opções marcadas no exemplo, somente a primeira opção configurada permanece marcada.

## Criar e configurar as opções

1. No editor do Template, crie um Field da categoria **Checkboxes**.
2. Defina o **Label** e uma `key` para o Field, por exemplo `traits`.
3. No inspetor, encontre **Checkbox options**.
4. Adicione uma opção para cada característica independente.
5. Defina o rótulo visível e a `Key` de cada opção.
6. Salve o Template e teste as opções no preview.

Exemplo:

| Field | Option key | Label exibido |
|---|---|---|
| `traits` | `flying` | Flying |
| `traits` | `swimming` | Swimming |
| `traits` | `magical` | Magical |
| `defenses` | `armored` | Armored |

A referência completa é formada pela key do Field, um ponto e a option key. Como o avaliador numérico compartilhado aceita key direta, `@` e chaves, você pode escrever a mesma referência das três formas:

```text
traits.flying
@traits.flying
{traits.flying}
defenses.armored
```

## Regras para option keys

A option key é um identificador de dados, não um rótulo para o usuário. Ela:

- começa com uma letra minúscula (`a`–`z`);
- pode conter letras minúsculas, números e `_`;
- possui de 1 a 40 caracteres;
- não pode repetir outra key nem conflitar com aliases do mesmo Field.

Exemplos válidos: `flying`, `darkvision`, `resistant_fire`, `trait_2`.

O editor pode gerar uma key a partir do Label, mas confira o identificador final antes de usá-lo em fórmulas. Evite alterar keys depois que templates e fichas já estiverem em uso.

## Como o valor entra na fórmula

O estado salvo continua sendo booleano. Durante a avaliação numérica, um booleano é interpretado como:

| Estado | Valor numérico |
|---|---:|
| Marcado (`true`) | `1` |
| Desmarcado (`false`) | `0` |

Isso permite somar um bônus condicional sem criar um Field Number separado.

### Exemplo 1 — bônus por característica

```text
strength + traits.flying * 2
```

Se `strength = 3`:

- `traits.flying = false` → `3 + 0 * 2` = `3`;
- `traits.flying = true` → `3 + 1 * 2` = `5`.

### Exemplo 2 — duas condições obrigatórias

```text
traits.flying && traits.magical ? 5 : 0
```

O resultado é `5` somente quando as duas opções estão marcadas. Caso contrário, é `0`.

### Exemplo 3 — opção usada como multiplicador

```text
base_damage * (1 + traits.empowered)
```

Se `base_damage = 6`, o resultado é `6` sem Empowered e `12` com Empowered.

### Exemplo 4 — vários bônus

```text
strength + traits.flying * 2 + defenses.armored
```

Cada opção contribui `0` ou `1` independentemente.

## Onde referências booleanas funcionam

As opções booleanas podem ser consultadas nos contextos que usam `evaluatePreviewFormula()`:

| Contexto | Aplicação |
|---|---|
| **Number/Rating Formula** | A fórmula de um Field numérico pode usar `traits.flying`. Consulte [[25 - Fórmulas em Number e Rating]]. |
| **Metric slot Formula** | Uma fórmula escrita diretamente no slot Metric pode usar opções Checkboxes e atualiza quando a opção muda. |
| **Scores: coluna derivada** | Uma coluna derivada que usa a expressão compartilhada pode consultar opções booleanas e o `value` da célula correspondente. |

O bloco **Checkboxes** é onde o usuário marca/desmarca as opções; ele não é, por si só, um bloco de cálculo. O cálculo ocorre em outro contexto que referencia a opção.

## Dados da ficha e Samples

As definições (keys e labels) pertencem ao Template. O estado marcado/desmarcado pertence a cada statblock.

Em dados normalizados, as opções configuradas que ainda não têm valor são inicializadas como desmarcadas. Assim, uma opção existente e desmarcada participa da fórmula como `0`. Uma referência a um Field/option key inexistente ou incompatível não equivale a uma opção desmarcada: ela pode deixar o resultado sem resolução.

Exemplo ilustrativo de Value de um Field `traits`:

```json
{
  "traits": {
    "flying": true,
    "swimming": false,
    "magical": true
  }
}
```

Cada ficha possui seu próprio objeto. Alterar `traits.flying` em uma ficha não altera o estado de outra.

## Renomear opções e aliases

Ao renomear uma option key pelo editor, o Forge pode manter a key anterior como alias para migrar/recuperar o booleano já salvo. Isso protege o estado de Values existentes. Ainda assim, revise as fórmulas: uma expressão que usa a key antiga deve ser conferida e atualizada para o identificador atual quando necessário.

Antes de remover uma opção, procure referências em Number/Rating, Metric ou Scores. Uma fórmula que continua apontando para uma opção removida não deve ser tratada como se ela estivesse desmarcada.

## O que Checkboxes não faz

- Não calcula valores numéricos próprios.
- Não guarda níveis ou contagens maiores que zero/um.
- Não cria nem altera Conditions do Atlas; use o catálogo da coleção Atlas para estados dos Tokens.
- Não cria automaticamente um modificador de Number ou Metric.
- Não executa expressões dentro de cada opção.

> [!info] Não confunda com os antigos Checkbox Modifiers
> O modelo atual usa um Field Checkboxes comum como fonte booleana. Os antigos controles **Add checkbox modifier** não fazem parte do fluxo atual.

## Diagnóstico

| Sintoma | Causa provável / verificação |
|---|---|
| Fórmula retorna `—` | Verifique a key do Field, a option key e se a definição ainda existe. |
| Checkbox visual está desmarcado, mas o bônus aparece | Confira se há alias/migração ou outro caminho de dados com a mesma referência. |
| Renomear a opção perdeu o estado | Confira o alias antigo e o objeto salvo no statblock. |
| A key não é aceita | Use letras minúsculas, números e `_`, começando por letra. |

## Veja também

- [[25 - Fórmulas em Number e Rating]] — gramática numérica e funções.
- [[05 - Fields]] — tipos de Field.
- [[29 - Conditions]] — Conditions nativas do Atlas, gerenciadas por coleção e Token.
