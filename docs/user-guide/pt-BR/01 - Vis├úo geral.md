---
title: Statblock Forge — Visão geral
aliases:
  - Sobre o Statblock Forge
  - O que é o Forge
tags:
  - statblock-forge
  - documentação/introdução
parte: 1
---

# Visão geral

O **Statblock Forge** é um plugin independente do Obsidian para criar, editar e renderizar statblocks a partir de Templates reutilizáveis. O editor oferece um Canvas com Grid configurável de 4 a 24 colunas, blocos ligados a Fields, containers aninhados e controles de aparência. Uma nota Markdown pode ser vinculada a um Template e guardar os Values de uma criatura, personagem, NPC ou outro registro.

O objetivo central é separar **estrutura reutilizável** de **dados de cada instância**. O Template descreve quais dados existem e como são apresentados; cada statblock guarda seus próprios Values.

## O que o Forge oferece

- **Templates:** criar modelos do zero, abrir modelos existentes, editar Fields e salvar alterações ou cópias.
- **Fields:** definir tipos de dados como Text, Number, Rating, Dice, Choice, Markdown, List, Scores, Entries, Pairs, Image, Spells, Counters e Checkboxes.
- **Canvas:** compor blocos e containers, escolher a posição, ajustar largura/altura e organizar o layout.
- **Blocos de apresentação:** exibir valores individuais, métricas, linhas de Fields, listas, tabelas, habilidades, pares, imagens, magias, Counters e controles relacionados.
- **Aparência:** aplicar temas, molduras, cores, bordas, geometrias e estilos individuais.
- **Fórmulas:** calcular Values Number/Rating, criar Dice Formulas baseadas em outros Fields e vincular expressões de dados em texto.
- **Statblocks:** criar notas Markdown vinculadas a Templates e editar seus Values na visualização.
- **Recursos avançados:** Counters, Rest, Compendium, permissões e integração com recursos nativos do Atlas.

A disponibilidade de cada recurso depende do tipo de Field, do bloco usado e, no caso de funções específicas, da presença de uma integração Atlas compatível. As próximas notas distinguem esses níveis.

## Fluxo básico

```text
Criar Template
    ↓
Definir Fields (dados e tipos)
    ↓
Associar Fields a blocos no Canvas
    ↓
Organizar layout e aparência
    ↓
Salvar Template
    ↓
Criar nota Markdown de statblock
    ↓
Preencher Values da instância
    ↓
Renderizar, editar e usar a ficha
```

## Template e statblock não são a mesma coisa

| Elemento | Guarda | Exemplo |
|---|---|---|
| Template | Definição de Fields, layout, configurações e Samples | `Creature — Humanoid` |
| Field | Definição de uma propriedade | `might`, tipo `number` |
| Value | Valor de um Field em uma ficha | `might = 8` para uma criatura específica |
| Bloco | Como um dado ou conteúdo aparece | `Stat` para mostrar Might; `Metric` para alinhar vários Values |
| Statblock | Instância completa com seus próprios Values | `Ash Guard`, `Might = 8`, `HP = 24` |

Dois statblocks podem usar o mesmo Template sem compartilhar valores. Alterar o Value de `might` em uma nota não altera o Value de outra nota que usa o mesmo Template.

## Separação de responsabilidades

```text
Template (.forgetemplate / .atlastemplate)
  ├─ Fields: keys, labels, types e opções
  ├─ Layout: blocos, containers e ordem
  ├─ Configurações de apresentação
  └─ Samples opcionais

Nota Markdown de statblock
  ├─ vínculo com o Template
  ├─ Values específicos da instância
  └─ metadados próprios da nota

Atlas VTT (quando instalado e compatível)
  ├─ recursos e dados de cena que pertencem ao Atlas
  ├─ conjunto de dados e motor de rolagem Atlas
  └─ apresentação de rolagens encaminhadas ao Atlas
```

> [!important] O Forge não é um fork do editor nativo do Atlas
> O Statblock Forge é um plugin independente. Ele lê e produz formatos compatíveis em fluxos definidos, e pode utilizar APIs públicas do Atlas quando disponíveis. A existência dessa integração não significa que as interfaces ou os dados internos do Atlas tenham sido substituídos pelo Forge.

## Formatos e arquivos

| Arquivo/dado | Uso |
|---|---|
| `.forgetemplate` | Template salvo pelo Forge. Mantém a estrutura JSON compatível com Atlas e inclui metadados Forge no namespace `statblockForge`, onde ficam dados exclusivos do layout do Forge. |
| `.atlastemplate` | Template nativo do Atlas. O Forge pode abrir formatos compatíveis e exportar uma cópia sem os metadados exclusivos do Forge. |
| Nota `.md` | Statblock individual, com Values e vínculo com o Template de origem. |
| Sidecar de layout | Para fluxos de edição/salvamento de formato Atlas, o Forge pode manter metadados próprios em `.statblock-forge/layouts/` dentro da pasta de Templates configurada. |
| `.forgestyle` | Pacote portátil de temas e molduras personalizadas. |

Não edite manualmente os metadados de vínculo ou o sidecar sem saber a relação entre `templateId`, Field keys e IDs de blocos. Consulte a Parte 5 quando a nota de integração estiver disponível.

## Forge e Atlas: o que pertence a cada projeto

| Recurso | Responsabilidade principal |
|---|---|
| Editor visual Forge, Templates `.forgetemplate` e sidecars Forge | Forge |
| Nota Markdown de statblock e editor de Values do Forge | Forge |
| Campos e layout no formato `.atlastemplate` | Contrato de template compatível com Atlas; a exportação Forge remove metadados exclusivos |
| Dados de cena, tokens e Resources pertencentes ao Atlas | Atlas |
| Interpretação, execução e exibição de rolagens encaminhadas à API Atlas | Atlas |
| Botões e regras locais de Rest do Forge | Forge, com adaptadores para Resources/ro lagens Atlas quando aplicável |

O comportamento exato de compatibilidade depende da versão e da API pública disponível. O Forge mantém mecanismos de fallback para fluxos que não oferecem determinada capacidade; não presuma que toda função de Atlas esteja disponível em qualquer instalação.

## Requisitos e limites conhecidos

- Obsidian **1.8.7 ou superior**, conforme `minAppVersion` do manifesto.
- O manifesto marca o plugin como **desktop-only**.
- O Forge trabalha com arquivos do Vault; backups são recomendados antes de converter, sobrescrever ou reorganizar Templates.
- Uma fórmula ou um bloco pode depender de Fields que precisam existir e resolver para o tipo esperado. A documentação de fórmulas explica essas dependências.

## Quando usar cada parte

- Para construir uma ficha do zero: Partes 1 e 2.
- Para dar identidade visual: Parte 3.
- Para modelar atributos derivados, dados, Counters e Rest: Parte 4.
- Para entender formatos e integração entre projetos: Parte 5.

## Próximo passo

Leia [[02 - Instalação e configuração]] para preparar o plugin e as pastas do Vault. Depois, siga para [[03 - Conceitos fundamentais]] e [[04 - Criar e editar templates]].
