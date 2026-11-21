---
title: Statblock Forge — Conceitos fundamentais
aliases:
  - Termos fundamentais do Forge
  - Template, Field e bloco
tags:
  - statblock-forge
  - documentação/conceitos
parte: 1
---

# Conceitos fundamentais

O Forge separa a definição dos dados, a sua apresentação e os valores de cada ficha. Os termos abaixo são usados em todo o editor e na documentação.

## Template

Um **Template** é o modelo reutilizável de um statblock. Ele define:

- os Fields que podem existir;
- o tipo de cada Field e suas opções;
- a estrutura de blocos e containers no Canvas;
- configurações de aparência e layout;
- valores de exemplo opcionais (`sample`);
- configurações avançadas associadas a Fields ou blocos.

Um Template não é uma criatura específica. É a definição que várias criaturas podem compartilhar.

## Field

Um **Field** define um dado. Todo Field possui, no mínimo:

| Propriedade | Função | Exemplo |
|---|---|---|
| `key` | Identificador interno usado por dados, blocos e referências | `might` |
| `label` | Texto apresentado na interface e, normalmente, como rótulo | `Might` |
| `type` | Tipo de conteúdo e editor/renderizador esperado | `number` |

A `key` não é apenas um nome decorativo: fórmulas, blocos, configurações e valores da nota podem depender dela. Prefira keys curtas, estáveis e sem espaços, começando por uma letra. O validador do Template aceita o padrão de identificador alfanumérico com `_` e `-`, limitado a 40 caracteres, e verifica colisões sem diferenciar maiúsculas/minúsculas.

A `label` pode ser alterada para melhorar a apresentação sem, por si só, mudar o identificador usado pelos dados. O Forge também admite rótulos vazios em alguns contextos para exibir somente o valor; isso não significa que a key possa ficar vazia.

O `type` determina quais valores e opções fazem sentido. Por exemplo, `number` guarda um número, `checkboxes` guarda estados booleanos por opção e `entries` guarda uma coleção de registros de habilidade.

Veja [[05 - Fields]] para o catálogo completo de tipos.

Os arquivos Forge usam `inline`, `selection`, `counter` e `groups`; IDs anteriores (`text`, `choice`, `counters` e `spells`) continuam sendo aceitos na leitura. Na importação de `.atlastemplate`, os IDs nativos do Atlas são convertidos para os identificadores atuais do Forge.

## Value

Um **Value** é o conteúdo de um Field em uma ficha específica. Se o Template declara `might` como Number, cada statblock que utiliza o Template pode ter seu próprio Value de `might`.

Exemplo:

| Template/Field | Statblock A | Statblock B |
|---|---:|---:|
| `might` (`number`) | 8 | 13 |
| `level` (`rating`) | 2 | 5 |
| `hp` (`number`) | 18 | 42 |

O Field continua sendo o mesmo nos dois statblocks. Apenas os Values pertencem às instâncias.

### Values calculados e Values usados em fórmulas

Alguns Fields numéricos podem ter uma fórmula Number/Rating que calcula seu Value a partir de outros Fields. Um Field `dice` também pode possuir uma **Dice Formula** que usa outros Values para construir uma fórmula de rolagem.

Exemplo conceitual de Dice Formula salva no Template:

```text
{proficiency}d{might}+{level}
```

Com `proficiency = 2`, `might = 8` e `level = 3` na instância, a expressão resolvida é:

```text
2d8+3
```

O texto de fórmula pertence à definição do Template; os números substituídos vêm do statblock atual. Consulte [[25 - Fórmulas em Number e Rating]] e [[27 - Dice Fields e Set Dice]]: Number/Rating formula, Dice Formula e Rest formula são linguagens/contextos diferentes.

## Bloco

Um **bloco** é um elemento visual do layout. Ele pode:

- apresentar um Field;
- combinar vários Fields;
- mostrar conteúdo estático;
- atuar como estrutura visual ou container.

Um Field não determina sozinho onde aparece. É necessário associá-lo a um bloco no Canvas. O bloco, por sua vez, não substitui a definição do Field: ele consome e apresenta o dado.

### Mapeamento inicial entre tipos de Field e blocos

Ao adicionar/arrastar um Field para o Canvas, o Forge utiliza um tipo de bloco padrão apropriado. O mapeamento inicial do código é:

| Tipo de Field | Bloco padrão | Uso típico |
|---|---|---|
| `inline`, `number`, `rating`, `dice`, `selection` | `Stat` | Um valor individual, como tipo, atributo, nível, HP ou fórmula de dados. |
| `markdown` | `Text` | Descrição com conteúdo Markdown. |
| `list` | `Tags` | Lista compacta de tags ou palavras-chave. |
| `scores` | Armazenamento interno de `Table` | Dados de linhas/colunas mantidos no formato nativo do Atlas; não é criado como Field comum. |
| `entries` | `Entries` | Coleção de habilidades/entradas nomeadas. |
| `pairs` | `Pairs` | Pares de chave e valor. |
| `image` | `Image` | Imagem vinculada ao Vault. |
| `groups` | `Groups` | Coleção de grupos/entradas de magia (antigo rótulo Spells). |
| `counter` | `Counter` | Linhas com usos, máximo e recuperação. |
| `checkboxes` | `Checkboxes` | Opções marcáveis. |

Esse é o mapeamento de criação inicial, não uma promessa de que todo Field só possa aparecer em um lugar ou de que todo bloco seja compatível com qualquer tipo. O inspetor filtra as opções quando um bloco exige um tipo específico. Consulte [[05 - Fields]] e as notas de blocos para as regras detalhadas.

### Outros blocos e Containers de dados

O Canvas também oferece blocos e Containers que não correspondem a um único Field:

| Bloco | Quando usar | Exemplo |
|---|---|---|
| `Title` | Dar hierarquia de título a um Field elegível | Nome da criatura como título. |
| `Line` | Apresentar vários Fields como uma linha de informações | `Size · Type · Alignment`. |
| `Track` | Mostrar um Number com estado atual/máximo | HP, mana ou energia acompanhados por caixas/barra. |
| `Heading` | Inserir um título estático de seção | `Defenses`. |
| `Text` sem Field | Escrever texto estático | Uma nota de regra ou legenda. |
| `Divider` / `Vertical divider` | Separar visualmente conteúdo | Separador entre grupos. |

`Line` pode referenciar mais de um Field. `Track` usa um Field Number e configurações de tracking. `Metric` é um Container de dados que reúne Fields escalares (`inline`, `number`, `rating`, `dice` e `selection`); `Table` é um Container de dados que reúne Fields compatíveis; Pairs continua sendo uma Collection independente. O armazenamento `scores` é interno. Consulte [[10 - Containers: visão geral]].

## Container

Um **Container** organiza Fields ou elementos do layout. O Forge possui Containers estruturais e de dados.

- **Section, Row e Tabs:** Containers estruturais que organizam elementos do layout.
- **Metric:** Container de dados para Fields escalares compatíveis.
- **Table:** Container de dados para Fields compatíveis, exceto Pairs, com armazenamento `scores` gerenciado internamente. Pairs continua sendo uma Collection independente.

Metric e Table não são tipos de Field nem blocos comuns. Eles organizam Fields-filhos e sua apresentação; os dados dos Fields continuam sendo a fonte dos Values. Consulte [[10 - Containers: visão geral]] e as notas de layout.

## Statblock

Um **statblock** é uma instância criada a partir de um Template. O Forge cria uma nota Markdown, grava o vínculo com o Template e inicializa os Values conforme as escolhas do usuário.

Exemplo:

- Template: `Ash Creature` — define `name`, `might`, `hp`, `proficiency` e `attack`.
- Statblock `Ash Guard` — Might 8, HP 18, Proficiency 2.
- Statblock `Ash Brute` — Might 13, HP 42, Proficiency 3.

As duas notas usam a mesma estrutura, mas os Values são independentes.

## Sample values

O Template pode armazenar um objeto de exemplos (`sample`) para testar o layout e demonstrar o formato esperado. Ao criar um statblock, a caixa **Copy example values** começa desmarcada.

- Desmarcada: não copia os Samples comuns; a nota começa com o nome informado e com imagens de Template marcadas como fixas/pinned, quando houver.
- Marcada: copia os Samples definidos para os Fields, com cópia dos dados estruturados para que a instância não compartilhe objetos editáveis com o Template.

O nome digitado na criação prevalece no Field reservado para nome, quando esse Field existe. Consulte [[06 - Criar e preencher statblocks]].

## Arquivos e identidade

| Elemento | Conteúdo/identidade |
|---|---|
| `.forgetemplate` | Template compatível com a estrutura Atlas mais o namespace `statblockForge` que guarda o layout e metadados exclusivos do Forge. |
| `.atlastemplate` | Arquivo nativo Atlas sem o namespace de metadados do Forge. |
| Nota `.md` | Values da instância e metadados de vínculo com o Template. |
| ID do Template | Identidade estável usada para localizar o Template e preservar vínculos. |
| ID do bloco | Identidade de um elemento visual no layout. |
| Field key | Identidade de uma propriedade de dados. |

Não confunda o nome visível do arquivo, a key do Field, o ID do Template e o ID do bloco. Alterar cada um tem consequências diferentes.

## Próximo passo

Veja [[04 - Criar e editar templates]] para criar o primeiro modelo. Em seguida, use [[05 - Fields]] para escolher os tipos de dados antes de montar o Canvas.
