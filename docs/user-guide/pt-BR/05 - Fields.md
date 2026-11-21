---
title: Statblock Forge — Fields
tags:
  - statblock-forge
  - documentação/fields
---

# Fields

Fields são as propriedades de dados de um statblock. Cada Field tem uma chave interna (`key`), um rótulo (`label`) e um tipo (`type`). O tipo determina o formato do dado e quais opções de edição ficam disponíveis. Metric e Table são Containers, não tipos de Field.

## Grupos de Fields

O seletor organiza os Fields em cinco grupos de apresentação. Os arquivos Forge gravam os IDs reorganizados descritos abaixo; o editor normaliza os valores para o modelo interno e preserva a compatibilidade com arquivos antigos.

| Grupo | Tipos apresentados | Uso |
|---|---|---|
| **Values** | Number, Rating, Dice, Counter | Valores numéricos, classificações, expressões de dados e contadores. |
| **Text** | In-line, Markdown | Texto simples em linha e conteúdo com formatação. |
| **Choice** | Checkboxes, Selection | Opções booleanas e seleção entre opções definidas no template. |
| **Image** | Image | Imagem associada à ficha. |
| **Collections** | List, Entries, Pairs, Groups | Listas, entradas estruturadas, pares de chave/valor e grupos de conteúdo. |

Os arquivos `.forgetemplate` e sidecars JSON do Forge gravam os identificadores reorganizados: **In-line** usa `inline`, **Selection** usa `selection`, **Counter** usa `counter` e **Groups** usa `groups`. Ao abrir templates antigos, o Forge reconhece os IDs anteriores (`text`, `choice`, `counters` e `spells`) e os normaliza automaticamente. Na importação de `.atlastemplate`, os IDs nativos são normalizados para os IDs atuais do Forge. **Checkboxes** continua como `checkboxes`. O armazenamento `scores` usado pelo Container Table é interno e não aparece como Field comum.

## Dados tabulares e Container Table

**Table** não é um Field: é um Container de dados criado por **Add Container → Table**. O Forge administra um Field nativo Atlas do tipo `scores` para armazenar linhas e valores da tabela. Esse Field técnico fica oculto da paleta de Fields e suas configurações são acessadas pelo inspetor da Table.

Para acrescentar dados, arraste qualquer Field compatível, para dentro da Table ou use **Fields inside this Table** no inspetor. Cada Field adicionado vira uma coluna, com seu Label como cabeçalho. **Show Labels in columns** controla os cabeçalhos dos Fields; **Show Labels in rows** exibe um Label para cada linha de dados, de forma independente. As duas opções podem ficar ativadas ao mesmo tempo. Quando **Allow adding rows in statblocks** está ativado, statblocks editáveis mostram a ação **Add row**. As linhas adicionais guardam seus próprios valores sem alterar os Values originais dos Fields. Use os botões de seta no inspetor para reorganizar os Fields. Remover um Field apenas desfaz o vínculo; o Field original e seus Values permanecem no Template e nas fichas.

Pairs permanece uma Collection independente e não pode ser vinculada a uma Table. Se um Template antigo usava Pairs dentro de uma Table, o Forge remove esse vínculo durante a migração sem apagar o Field nem seus Values.

## Campos de cabeçalho

O template inicial contém Fields reservados para informações principais:

| Key | Label padrão | Tipo | Significado |
|---|---|---|---|
| `name` | Name | In-line (JSON ID `inline`) | Nome da criatura/personagem. |
| `image` | Token art | Image | Arte do token no cabeçalho. |
| `level` | Level | Rating | Nível ou classificação. |
| `type` | Type | In-line (JSON ID `inline`) | Categoria ou tipo de criatura. |
| `hp` | HP | Number | Pontos de vida. |
| `description` | Description | Markdown | Descrição principal. |

Esses campos são tratados como elementos do cabeçalho e não precisam ser adicionados ao Grid como blocos comuns. O Field `image` fornece o espaço reservado para a arte do token.

## Keys

A `key` é o identificador usado internamente para armazenar e localizar o valor. O `label` é o nome legível mostrado na interface.

Regras de key documentadas pelo editor:

- Entre 1 e 40 caracteres.
- Deve começar com uma letra.
- Pode conter letras, números, `_` e `-`.
- Não pode repetir outra key, considerando duplicatas sem diferença entre maiúsculas e minúsculas.
- Keys reservadas não podem ser usadas por Fields personalizados.

Ao renomear uma key, o Forge registra a chave anterior em `formerKeys` e atualiza referências reconhecidas no layout, nas amostras, em condições e em outras configurações compatíveis.

## Field Groups (JSON ID `groups`) — Atlas import ID `spells`

O tipo **Groups** (ID JSON Forge `groups`, o tipo nativo Atlas `spells` é convertido durante a importação) tem um editor próprio na ficha. Clique no bloco para configurar um ou mais grupos de valores. Cada grupo pode ter um cabeçalho e várias linhas; cada linha possui um rótulo de categoria ou uso e um ou mais valores separados por vírgula.

No inspetor do bloco, escolha **Lista em linhas** ou **Abas**. O modo Abas cria uma aba para cada rótulo de categoria ou uso dentro do grupo. O Forge salva os dados na estrutura nativa do Atlas, sem adicionar um formato proprietário. Quando o Field está vazio, a prévia mostra uma orientação para adicionar o primeiro grupo; novos statblocks começam com os valores de Groups vazios.

## Configurações específicas

Alguns tipos oferecem configurações adicionais:

- **Number:** unidade, tracking e fórmulas quando aplicável.
- **Rating:** configuração numérica e fórmula quando aplicável.
- **Selection:** opções e modo de seleção simples ou múltipla; cada opção pode ser referenciada em fórmulas como `1` (selecionada) ou `0` (não selecionada).
- **Table:** Fields filhos em ordem configurável e opção para exibir seus Labels como cabeçalhos de linha; o Field `scores` interno é gerenciado pelo Container.
- **Entries / Abilities:** chaves de nome e descrição, além de partes adicionais (Parts).
- **Counter:** presets de linhas e valores máximos.
- **Checkboxes:** opções booleanas com keys próprias, que podem ser referenciadas em fórmulas como `1` (marcada) ou `0` (desmarcada).
- **Image:** enquadramento e referência visual da imagem.

A disponibilidade exata dos controles depende do tipo e do contexto em que o Field é usado.

## Recursos avançados

A Parte 4 explica fórmulas para Number/Rating, referências booleanas de Checkboxes e Selection, dados, Counters, Conditions nativas do Atlas, Rest e permissões de jogadores. Consulte [[25 - Fórmulas em Number e Rating]] para começar.

## Excluir Fields

Antes de excluir um Field, verifique se ele é usado por blocos, fórmulas, regras de Rest, condições ou outras referências. O Forge desvincula referências estruturais reconhecidas nos blocos, mas preserva proteções para dependências que poderiam deixar cálculos ou regras inválidos.

## Edição dos valores na ficha

Os Fields são preenchidos na visualização do statblock. A edição é contextual e varia conforme o tipo: texto, números, listas, entradas, scores, counters e outros dados estruturados possuem controles apropriados.

Ao criar uma nova ficha, o Forge pode abrir automaticamente o primeiro Field editável vazio. Fields com valores `0` ou `false` são considerados preenchidos; texto em branco e estruturas vazias são considerados vazios.

## Exemplos de escolha

| Necessidade | Tipo sugerido |
|---|---|
| HP atual ou quantidade de usos | Number ou Counter, conforme o comportamento desejado. |
| Texto de ambientação | Markdown |
| Dano `3d8+2` | Dice |
| Uma categoria escolhida de uma lista | Selection |
| Tags ou sentidos | List |
| Atributos organizados em linhas e colunas | Container Table |
| Ataques com alcance, dano e custo | Entries / Abilities |
| Resistências nomeadas com valores | Pairs |
| Retrato ou token art | Image |
| Valores agrupados por categoria ou uso | Groups |
| Opções booleanas reutilizáveis | Checkboxes |

## Próximo passo

Depois de definir os Fields e associá-los ao layout, crie uma instância seguindo [[06 - Criar e preencher statblocks]].
