---
title: Statblock Forge — Fórmulas em Number e Rating
aliases:
  - Fórmula numérica
  - Number Formula
  - Rating Formula
tags:
  - statblock-forge
  - documentação/recursos-avançados
  - documentação/fórmulas
parte: 4
---

# Fórmulas em Number e Rating

Fields dos tipos **Number** e **Rating** podem exibir um resultado calculado em vez de mostrar diretamente o Value salvo. A fórmula pertence à definição do Field no **Template**; os dados de entrada continuam pertencendo a cada statblock. Isso permite reutilizar a mesma regra matemática em muitas fichas, cada uma com seus próprios números.

Esta fórmula é determinística: calcula um número a partir dos dados disponíveis. Ela não rola dados e não é a mesma linguagem usada por **Dice Formula** ou pelas regras de **Rest**.

## Onde configurar

1. Abra o Template no editor do Forge.
2. Selecione um Field do tipo **Number** ou **Rating** na lista de Fields.
3. No inspetor do Field, localize **Formula**.
4. Digite a expressão e confira o Sample/preview.
5. Salve o Template.

A propriedade é opcional. Quando está vazia, o Forge exibe o valor-base do Field. A fórmula é limitada a **500 caracteres**. Os Fields reservados `hp` e `level` também podem aparecer nas configurações de **Statblock Header**; a fórmula continua pertencendo ao Field correspondente.

## O significado de `value`

Dentro da fórmula de um Field, `value` representa o valor-base armazenado naquele próprio Field. Ele permite transformar o número digitado sem substituir a entrada original.

Exemplo: o Field `armor` armazena `12` e tem a fórmula:

```text
value + proficiency
```

Com `proficiency = 2`, a ficha exibe `14`. O valor-base `12` continua sendo o dado salvo; o resultado `14` é calculado para apresentação e para os contextos que consultam o valor numérico do Field.

`value` não significa “o último resultado da ficha” nem o valor de outro Field. Para outra propriedade, use a chave dela.

## Referenciar outros Fields

As fórmulas continuam aceitando a referência direta pela `key`. Agora também aceitam `@key` e `{key}`; as três formas podem ser misturadas na mesma expressão:

```text
strength + proficiency
@strength + {proficiency}
attributes.dexterity + 2
{might-score} - @proficiency
```

O avaliador procura a chave no registro de Values do statblock. Caminhos separados por ponto permitem acessar propriedades de objetos aninhados; segmentos numéricos também podem selecionar posições de arrays quando o caminho de dados contém uma lista.

### Regras para identificadores

O analisador reconhece identificadores diretos iniciados por letra ou `_`, seguidos por letras, números, `_` ou pontos. As formas explícitas `@key` e `{key}` também aceitam caminhos com ponto. Para keys que contêm hífen, use `{key}`: as chaves delimitam o nome completo e evitam confusão com o operador de subtração. Exemplo: `{might-score} - @proficiency`.

Uma referência precisa existir e resolver para um número ou booleano utilizável. Um Field ausente, vazio ou com texto não numérico torna o resultado indisponível; o Forge não transforma automaticamente texto inválido em zero.

### Rating fracionário

Um Rating pode armazenar a representação `1/4`. No contexto numérico, o Forge converte esse formato para decimal (`0.25`) sem substituir a representação original salva na ficha.

Exemplo:

```text
challenge_rating * 4
```

Se `challenge_rating` for um Rating com Value `1/4`, a expressão retorna `1`.

Esse tratamento de frações é específico para Rating. Um Number com o texto `1/4` não é uma entrada numérica válida; armazene um número ou use uma expressão apropriada.

## Operadores e precedência

O avaliador usa precedência matemática convencional. Parênteses podem tornar a intenção explícita.

| Grupo | Sintaxe | Uso |
|---|---|---|
| Agrupamento | `( ... )` | Define a ordem de cálculo. |
| Unário | `+x`, `-x`, `!x` | Mantém/inverte sinal; `!` nega uma condição lógica. |
| Multiplicativo | `*`, `/`, `%` | Multiplicação, divisão e resto da divisão. |
| Aditivo | `+`, `-` | Soma e subtração. |
| Comparação | `>`, `>=`, `<`, `<=`, `==`, `!=` | Compara dois valores. |
| Lógico | `&&`, `||` | E lógico e OU lógico, com avaliação curta. |
| Condicional | `condição ? A : B` | Escolhe um resultado conforme a condição. |

Os literais `true` e `false` também são reconhecidos. Em uma expressão numérica, booleanos podem ser usados como `1` e `0`; em `&&`, `||`, `!` e no teste de um ternário, mantêm o comportamento lógico.

## Funções matemáticas

| Função | Parâmetros | Resultado |
|---|---|---|
| `floor(x)` | Um | Arredonda para baixo. |
| `ceil(x)` | Um | Arredonda para cima. |
| `round(x)` | Um | Arredonda para o inteiro mais próximo. |
| `abs(x)` | Um | Valor absoluto. |
| `min(a, b, ...)` | Um ou mais | Menor argumento. |
| `max(a, b, ...)` | Um ou mais | Maior argumento. |

Exemplos:

```text
floor(value / 2)
max(strength, dexterity) + 2
abs(modifier)
```

Somente essas funções estão disponíveis. O avaliador não permite chamadas arbitrárias, acesso a APIs, atribuições ou execução de JavaScript.

## Exemplos completos

Considere uma ficha com:

| Field | Value salvo |
|---|---:|
| `strength` | 3 |
| `dexterity` | 5 |
| `proficiency` | 2 |
| `armor` | 12 |
| `hp_base` | 18 |

**Bônus de ataque baseado em Strength:**

```text
strength + proficiency
```

Resultado: `5`.

**Defesa baseada no maior atributo:**

```text
max(strength, dexterity) + 2
```

Resultado: `7`.

**Pontos de vida com metade do nível:**

```text
hp_base + floor(level / 2)
```

Com `level = 5`, resultado: `20`.

**Bônus condicional:**

```text
strength >= 4 ? proficiency + 1 : proficiency
```

Com Strength `3`, resultado: `2`; quando Strength chegar a `4`, resultado `3`.

## Relação com blocos e outras fórmulas

A fórmula pertence ao Field Number/Rating, não ao bloco. O mesmo Field pode ser apresentado por um bloco compatível sem duplicar a expressão.

| Contexto | Como a fórmula participa |
|---|---|
| **Header** | Fields numéricos reservados, como HP e Level, podem exibir o resultado calculado. |
| **Stat** | Mostra o Field numérico calculado como valor individual. |
| **Line** | Mostra o mesmo resultado em uma linha com outros Fields. |
| **Metric** | Um slot que aponta para Number/Rating pode mostrar o valor numérico calculado do Field. O slot também pode ter uma fórmula própria, independente da fórmula do Field. |
| **Track** | Um Field numérico usado como valor ou máximo de tracking pode fornecer seu resultado calculado ao controle de rastreamento. |
| **Scores** | Colunas derivadas podem ter fórmulas próprias usando o valor da célula como `value`; isso é configuração da coluna, não a fórmula do Field Number/Rating. |

### Fórmula do Field versus fórmula do slot Metric

Uma fórmula em Number/Rating acompanha o Field onde quer que ele seja apresentado. Já uma fórmula configurada em um slot de **Metric** pertence ao bloco e calcula aquele slot. Se o slot tiver fórmula própria, ela define o valor exibido naquele slot em vez de simplesmente ler o Value do Field associado.

Exemplo de fórmula de slot Metric:

```text
strength + proficiency
```

Ela pode criar um número derivado para aquela Metric sem alterar o Value nem a fórmula do Field `strength`.

## Dependências e limites práticos

- Renomear uma key por meio do editor atualiza as referências de fórmula reconhecidas pelo Forge.
- A exclusão de um Field ainda referenciado por fórmulas, configurações ou regras dependentes é bloqueada até que a dependência seja removida ou redirecionada.
- A avaliação usa os Values disponíveis na instância. Não trate fórmulas Number/Rating como uma cadeia recursiva de cálculos: uma referência lê o Value correspondente no registro da ficha, não executa automaticamente a fórmula configurada no Field referenciado.
- Se o resultado não for finito, uma referência não puder ser lida ou a expressão for inválida, o Forge apresenta o resultado como indisponível (`—`) nos contextos visuais compatíveis.
- Divisão e módulo por zero não produzem um número válido.

## Diagnóstico

| Sintoma | Verificação |
|---|---|
| A fórmula aparece como `—` | Verifique se todas as keys existem e se seus Values são numéricos. |
| `value` não retorna o número esperado | Confirme o Value-base salvo no próprio Field. |
| Uma referência com ponto falha | Confira a estrutura real do objeto no Sample/JSON. |
| Uma fração falha | Confirme que o Field de origem é Rating, não Number. |
| A expressão funciona em Dice, mas não em Number | Confira se a referência usa uma key válida: Number/Rating aceita key direta, `@key` e `{key}`; Dice Formula aceita as duas formas explícitas. |

## Veja também

- [[26 - Checkboxes e referências booleanas]] — usar opções booleanas como entradas.
- [[27 - Dice Fields e Set Dice]] — expressões aleatórias e fórmulas dinâmicas de dados.
- [[31 - Regras e fórmulas de Rest]] — referências `@field` e fórmulas de recuperação.
- [[05 - Fields]] — tipos e propriedades dos Fields.
