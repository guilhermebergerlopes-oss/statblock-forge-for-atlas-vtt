---
title: Conditions nativas do Atlas
aliases:
  - Conditions do Atlas VTT
  - Estados e condições dos Tokens Atlas
tags:
  - statblock-forge
  - documentação/integração-atlas
  - atlas/conditions
parte: 4
---

# Conditions nativas do Atlas

**Conditions não são mais um recurso gerenciado pelo Statblock Forge.** O Atlas VTT já possui seu próprio catálogo de Conditions por coleção e armazena o estado ativo diretamente nos Tokens. O Forge não mantém um catálogo paralelo, não exibe um painel próprio de Conditions e não altera esses estados durante ações de Rest.

Essa separação evita dois sistemas concorrentes para o mesmo conceito. Use o Forge para definir Fields, Values, fórmulas, Counters e ações de Rest compatíveis; use o Atlas para definir, aplicar, aumentar, reduzir e remover Conditions dos Tokens.

## Onde configurar as Conditions

1. Abra uma visualização de mapa do Atlas VTT.
2. Abra as configurações da coleção usada pelo mapa.
3. Entre na seção **Conditions** das configurações de regras da coleção.
4. Crie ou edite as definições: nome, cor, ícone e, quando aplicável, se a Condition é valorada.
5. Salve as configurações da coleção.

As definições pertencem às regras da coleção. Cada Token mantém seu próprio estado, permitindo que Tokens diferentes tenham Conditions diferentes mesmo quando usam o mesmo catálogo.

## Aplicar Conditions aos Tokens

1. No mapa Atlas, clique com o botão direito em um Token (ou selecione vários Tokens e abra o menu de contexto).
2. Abra o submenu **Conditions**.
3. Selecione uma Condition para alternar sua presença nos Tokens selecionados.
4. Para Conditions valoradas, use os controles `−` e `+` no submenu para reduzir ou aumentar o valor.

Quando vários Tokens estão selecionados, o Atlas indica se uma Condition está presente em todos ou apenas em parte deles. A operação aplica a alteração ao conjunto selecionado.

O **Initiative Tracker** também apresenta as Conditions ativas dos combatentes, com o nome e, para Conditions valoradas, a intensidade.

## Condições valoradas e não valoradas

A definição da Condition é feita nas configurações da coleção do Atlas:

- **Não valorada:** funciona como um estado ativo/inativo. O submenu de Conditions alterna sua presença.
- **Valorada:** mantém uma intensidade numérica. O submenu oferece controles para diminuir ou aumentar o valor; quando a intensidade chega a zero, a Condition deixa de estar ativa.

O ícone e a cor pertencem à definição da coleção. O estado ativo e o valor pertencem ao Token.

## O que o Forge faz — e o que não faz

O Forge não:

- cria ou edita o catálogo de Conditions da coleção;
- armazena estado de Condition no frontmatter do statblock;
- apresenta painel próprio para aplicar ou remover Conditions;
- executa regras de Rest para aumentar, reduzir ou limpar Conditions;
- sincroniza IDs de Conditions do Forge com IDs de Conditions do Atlas.

O Forge continua compatível com o fluxo de statblocks e Tokens do Atlas. Depois que uma nota compatível é vinculada a um Token, as Conditions desse Token são gerenciadas pelo Atlas, independentemente dos Fields e Values do statblock.

## Dados antigos de Conditions do Forge

Versões anteriores do Forge armazenavam definições no layout do Template (`forgeConditionDefinitions`) e estado por ficha nas propriedades reservadas `__forgeConditions` e `__forgeConditionValues`. Esses dados não são mais interpretados nem exibidos pelo Forge.

Por segurança, o Forge preserva essas propriedades antigas quando abre e salva Templates ou notas. Preservar não significa migrar: o Forge não converte automaticamente IDs ou valores antigos para o modelo de Conditions do Atlas, pois o catálogo e o estado pertencem a objetos diferentes (Template/nota versus coleção/Token).

Regras antigas de Rest com operações `step` ou `clear` para Conditions também deixam de ser executadas. Se ainda existirem no JSON, serão mantidas como registros não suportados e indicadas nos diagnósticos de Rest. Elas não alteram Conditions do Atlas.

> [!important] Antes de limpar dados antigos
> Faça backup do Template e das notas. Confira o catálogo da coleção Atlas e aplique manualmente as Conditions necessárias aos Tokens correspondentes. Só depois disso remova, se desejar, as propriedades legadas por meio do editor JSON. Não apague `__forgeConditions`, `__forgeConditionValues` ou `forgeConditionDefinitions` sem verificar se ainda precisa consultar os valores antigos.

## Conditions, Checkboxes e Counters

| Recurso | Responsabilidade | Uso recomendado |
|---|---|---|
| **Atlas Conditions** | Atlas: catálogo por coleção e estado por Token. | Estados como Poisoned, Stunned, Frightened ou Exhausted que acompanham o Token no mapa. |
| **Checkboxes do Forge** | Forge: opções booleanas de Fields da ficha. | Características e escolhas que participam de fórmulas Number/Rating. |
| **Counters do Forge** | Forge: linhas com `max`, `used` e `regain`, compatíveis com fluxos de statblock/Atlas. | Usos, cargas e recursos finitos consumidos e recuperados. |

Não use Checkboxes ou Counters como substitutos do catálogo de Conditions do Atlas quando o estado precisa aparecer no Token ou no Initiative Tracker. Da mesma forma, não espere que uma Condition do Atlas se comporte como um Field numérico do Forge.

## Exemplo de uso combinado

Uma ficha de personagem pode ter:

- `hp` como Number/Resource;
- `spell_slots` como Counters;
- `concentration` como Checkbox para uma opção booleana usada em fórmulas;
- **Poisoned** e **Stunned** como Atlas Conditions da coleção.

O Forge calcula e apresenta os Values, rolagens e Counters do statblock. O Atlas aplica Poisoned ou Stunned ao Token pelo submenu **Conditions** e mostra os estados no Initiative Tracker. Uma ação de Rest do Forge pode recuperar `hp` ou usos de `spell_slots`, mas não altera as Conditions do Token.

## Veja também

- [[26 - Checkboxes e referências booleanas]] — opções booleanas de Fields.
- [[28 - Counters]] — usos e cargas gerenciados pelo Forge.
- [[30 - Rest: configuração e fluxo]] — ações de descanso disponíveis no Forge.
- [[31 - Regras e fórmulas de Rest]] — Resources e Counters; Conditions ficam no Atlas.
