---
title: Statblock Forge — Permissões dos jogadores
aliases:
  - Player access
  - Permissões de Fields
tags:
  - statblock-forge
  - documentação/recursos-avançados
  - documentação/permissões
parte: 4
---

# Permissões dos jogadores

O inspetor de um bloco pode apresentar a configuração **Players** para definir como jogadores podem interagir com os Fields representados por aquele bloco em contextos Atlas que respeitam as permissões. O Forge grava essas opções na propriedade nativa `players` do Template.

Isso **não** é um sistema de contas do Obsidian, permissões de pasta do Vault nem criptografia. É metadado de acesso consumido por visualizações e fluxos compatíveis com Atlas.

## Opções de acesso

| Opção na interface | Valor salvo | Comportamento |
|---|---|---|
| **Players can edit** | `edit` | Jogadores podem visualizar e editar o Value do Field. |
| **Players can only read** | `read` | Jogadores podem visualizar o Value, mas não editá-lo. |
| **Hidden from players** | `hidden` | O Field não é apresentado aos jogadores, mas permanece no statblock final para o mestre. |
| **Total Hidden** | Metadado de layout Forge + `hidden` | Remove o bloco do statblock final do Forge e marca seus Fields como `hidden` para a exportação Atlas. |

`Total Hidden` não é um quarto valor da propriedade `players`. É uma configuração local de visibilidade do layout do Forge que também aplica a permissão `hidden` aos Fields representados.

## Valores padrão

- Fields comuns usam `edit` por padrão.
- Fields `spells` usam `read` por padrão; o inspetor não oferece `edit` para um bloco que representa somente Fields `spells`.
- Fields fixos do cabeçalho, como `name`, a key `image`, Fields com significado `display-name` e Fields do tipo Image são tratados como somente leitura por Atlas.

O Forge grava apenas exceções ao padrão. Quando o acesso de um Field volta ao padrão, sua entrada é removida de `players`. Se não restarem exceções, a propriedade inteira pode ser removida. Keys antigas registradas em `formerKeys` também são limpas ao alterar o acesso pela key atual.

## Em quais blocos o controle aparece

O inspetor só mostra **Players** quando o bloco selecionado representa Fields cujo acesso pode ser alterado.

| Tipo de bloco | Fields considerados pelo inspetor |
|---|---|
| **Metric** | Todos os Fields listados em `fields`, mais o Field de `headingField`, se houver. |
| **Entries** | O Field associado em `field`, mais `headingField`, se houver. |
| **Tabs de Abilities** | Os Fields de Entries quando cada aba tem exatamente uma Section e essa Section tem exatamente um bloco Entries. |
| **Bloco ligado a um Field** | O Field associado em `field`, mais o Field de título/cabeçalho quando aplicável. |
| **Line** | Não apresenta controle de Players. |
| **Bloco sem Field editável, Field fixo ou Image** | Não apresenta um controle que não teria efeito. |

Uma estrutura Tabs genérica não é automaticamente interpretada como Ability Tabs. Para a regra especial, cada aba precisa ter a estrutura Section → Entries descrita acima.

## Blocos que representam vários Fields

Quando um bloco representa mais de um Field, o inspetor calcula o acesso comum mais restritivo para exibir no seletor:

`hidden` é mais restritivo que `read`, que é mais restritivo que `edit`.

Por exemplo, se um Metric reúne `hp` (`edit`) e `armor` (`read`), o controle mostra `read`. Se você escolher `edit`, a alteração será aplicada a todos os Fields representados pelo Metric. Verifique os Fields reunidos no bloco antes de alterar uma permissão em lote.

## Diferença entre Hidden from players e Total Hidden

### Hidden from players

O bloco continua no layout e no statblock final do Forge. Os jogadores não recebem os Fields marcados como `hidden` em contextos Atlas compatíveis; o mestre continua tendo o conteúdo no statblock.

### Total Hidden

O Forge grava `visibility: total-hidden` nos metadados de layout do bloco e marca os Fields representados como `hidden` na propriedade `players`.

- No statblock final renderizado pelo Forge, o bloco é omitido.
- Na cópia/template publicada para Atlas, o bloco permanece no layout, mas os Fields são exportados com permissão `hidden`, para que os jogadores não os vejam e o mestre ainda possa consultá-los.
- O `.forgetemplate` original mantém o bloco no Canvas do editor para que continue disponível para edição.

Se você escolher novamente `edit`, `read` ou `hidden`, a marca `Total Hidden` é removida do metadado do bloco e a visibilidade normal do bloco é restaurada.

## Compatibilidade e preservação

O Forge grava os valores nativos `edit`, `read` e `hidden`, preservando entradas não relacionadas e valores desconhecidos do objeto `players`. Um valor desconhecido é apresentado de forma conservadora como `hidden` no inspetor.

As permissões só têm efeito em visualizações e fluxos que respeitam os metadados de acesso Atlas. Elas não impedem que alguém com acesso direto ao Vault leia ou modifique o Markdown, frontmatter ou JSON da ficha. Não use `hidden` como proteção para segredos armazenados em arquivos aos quais os jogadores têm acesso direto.

## Exemplo de configuração

Considere um bloco Metric com `hp`, `armor` e `secret_dc`:

- `hp`: `edit`, para permitir atualização pelos jogadores;
- `armor`: `read`, para permitir consulta sem alteração;
- `secret_dc`: `hidden`, para manter o dado no statblock do mestre, sem apresentá-lo aos jogadores.

Se todos estiverem no mesmo Metric, uma única configuração Players aplica a mesma permissão a todos eles. Para permissões distintas, coloque Fields em blocos separados ou use estruturas de layout separadas.

## Veja também

- [[03 - Conceitos fundamentais]] — Templates, Fields, blocos e instâncias.
- [[06 - Criar e preencher statblocks]] — Values de cada ficha.
- [[21 - Aparência individual dos blocos]] — visibilidade visual e estilo; não confundir com acesso de jogador.
- [[30 - Rest: configuração e fluxo]] — ações e estado da ficha.
