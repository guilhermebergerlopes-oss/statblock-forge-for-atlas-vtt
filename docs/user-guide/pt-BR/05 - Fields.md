---
title: Statblock Forge — Fields
tags:
  - statblock-forge
  - documentação/fields
---

# Fields

Fields são as propriedades de dados de um statblock. Cada Field tem uma chave interna (`key`), um rótulo (`label`) e um tipo (`type`). O tipo determina o formato do dado e quais opções de edição ficam disponíveis.

## Tipos disponíveis

| Tipo | Uso | Formato geral |
|---|---|---|
| Text | Nome curto, categoria ou texto simples. | Texto. |
| Markdown | Descrições e conteúdo textual com formatação. | Texto Markdown. |
| Number | Quantidades, HP, alcance ou outros valores numéricos. | Número. |
| Rating | Nível, classificação ou escala numérica/representativa. | Valor de rating. |
| Dice | Expressões de dados. | Notação de dados, por exemplo `2d6+2`. |
| Choice | Seleção entre opções definidas no template. | Uma ou mais opções, conforme configuração. |
| List | Conjunto simples de itens. | Lista de textos. |
| Dados tabulares | Valores armazenados em linhas e colunas. | Estrutura de dados tabulares. |
| Entries / Abilities | Entradas como habilidades, ataques ou poderes. | Lista de entradas com partes configuráveis. |
| Pairs | Dados organizados em pares de chave e valor. | Objeto de pares. |
| Image | Imagem associada à ficha. | Referência de imagem. |
| Spells | Grupos de conjuração com níveis/usos e listas de magias. | Cabeçalhos e registros `{ nível: 'magias' }` no formato nativo do Atlas. |
| Counters | Contadores com valores e limites. | Coleção de contadores. |
| Checkboxes | Opções booleanas marcáveis. | Mapa de valores booleanos. |

## Dados tabulares e bloco Table

**Dados tabulares** é um tipo de Field: ele armazena as linhas, colunas e valores da ficha. O bloco **Table**, por outro lado, é um elemento de layout que referencia esse Field e define como os dados serão apresentados no Canvas e no statblock. O bloco não cria uma segunda cópia dos dados.

Em **Properties**, crie ou configure um Field **Tabular Data**. Em **Structure**, adicione um bloco **Table** e vincule-o ao Field para exibir os dados.

## Campos de cabeçalho

O template inicial contém Fields reservados para informações principais:

| Key | Label padrão | Tipo | Significado |
|---|---|---|---|
| `name` | Name | Text | Nome da criatura/personagem. |
| `image` | Token art | Image | Arte do token no cabeçalho. |
| `level` | Level | Rating | Nível ou classificação. |
| `type` | Type | Text | Categoria ou tipo de criatura. |
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

## Fields do tipo Spells

O tipo **Spells** tem um editor próprio na ficha. Clique no bloco para configurar um ou mais grupos de conjuração. Cada grupo pode ter um cabeçalho (por exemplo, *Conjuração inata*) e várias linhas com um rótulo de uso/nível (como *À vontade*, *1º círculo* ou *1/dia*) e os nomes das magias separados por vírgula.

No inspetor do bloco, escolha **Lista em linhas** ou **Abas**. O modo Abas cria uma aba para cada rótulo de uso/nível dentro do grupo. O Forge salva os dados na estrutura nativa do Atlas, sem adicionar um formato proprietário. Quando o Field está vazio, a prévia mostra uma orientação para adicionar o primeiro grupo; novos statblocks começam sem magias.

## Configurações específicas

Alguns tipos oferecem configurações adicionais:

- **Number:** unidade, tracking e fórmulas quando aplicável.
- **Rating:** configuração numérica e fórmula quando aplicável.
- **Choice:** opções e modo de seleção simples ou múltipla.
- **Dados tabulares:** colunas e permissões de linhas/colunas.
- **Entries / Abilities:** chaves de nome e descrição, além de partes adicionais (Parts).
- **Counters:** presets de linhas e valores máximos.
- **Checkboxes:** opções booleanas com keys próprias, que podem ser referenciadas em fórmulas como `1` (marcada) ou `0` (desmarcada).
- **Image:** enquadramento e referência visual da imagem.

A disponibilidade exata dos controles depende do tipo e do contexto em que o Field é usado.

## Recursos avançados

A Parte 4 explica fórmulas para Number/Rating, referências booleanas de Checkboxes, dados, Counters, Conditions nativas do Atlas, Rest e permissões de jogadores. Consulte [[25 - Fórmulas em Number e Rating]] para começar.

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
| Uma categoria escolhida de uma lista | Choice |
| Tags ou sentidos | List |
| Atributos organizados em linhas e colunas | Dados tabulares |
| Ataques com alcance, dano e custo | Entries / Abilities |
| Resistências nomeadas com valores | Pairs |
| Retrato ou token art | Image |
| Grupos de conjuração e magias por nível/uso | Spells |
| Opções booleanas reutilizáveis | Checkboxes |

## Próximo passo

Depois de definir os Fields e associá-los ao layout, crie uma instância seguindo [[06 - Criar e preencher statblocks]].
