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
- **Fields:** organizar dados nos grupos Values (Number, Rating, Dice, Counter), Text (In-line, Markdown), Choice (Checkboxes, Selection), Image e Collections (List, Entries, Pairs, Groups).
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
> O Statblock Forge é um plugin independente. Ele integra-se aos runtimes internos do Atlas usando os códigos-fonte inspecionados das versões 0.17.0 e 0.18.0 como bases para pré-visualizações, tokens, Resources e rolagens em mapas. Versões posteriores não são bloqueadas por uma lista de versões exatas: o Forge tenta manter a compatibilidade e verifica os métodos e serviços necessários a cada recurso. Isso não garante compatibilidade com toda API futura; recursos cujas estruturas internas mudarem podem ficar indisponíveis até uma atualização do Forge. O Forge não substitui as interfaces nem assume a propriedade dos dados de cena, tokens ou Resources do Atlas.

## Formatos e arquivos

| Arquivo/dado | Uso |
|---|---|
| `.forgetemplate` | Template salvo pelo Forge. Usa os identificadores de Fields próprios do Forge e inclui metadados no namespace `statblockForge`, onde ficam dados exclusivos do layout. |
| `.atlastemplate` | Template nativo do Atlas. O Forge pode importá-lo como origem somente leitura e criar uma cópia editável `.forgetemplate`; o arquivo original não é alterado. |
| Nota `.md` | Statblock individual, com Values e vínculo com o Template de origem. |
| Sidecar de layout | Durante a importação, o Forge pode ler um sidecar antigo correspondente em `.statblock-forge/layouts/`. Sidecars são apenas entrada de leitura; o Forge não cria nem atualiza sidecars Atlas. |
| `.forgestyle` | Pacote portátil de temas e molduras personalizadas. |

Não edite manualmente os metadados de vínculo ou o sidecar sem saber a relação entre `templateId`, Field keys e IDs de blocos. A integração profunda com o Atlas usa os códigos-fonte inspecionados das versões 0.17.0 e 0.18.0 como bases de runtime e depende de estruturas internas do Atlas. Versões posteriores são permitidas por verificações de capacidades; cada recurso só funciona quando os métodos necessários estão presentes.

## Forge e Atlas: o que pertence a cada projeto

| Recurso | Responsabilidade principal |
|---|---|
| Editor visual Forge, Templates `.forgetemplate` e sidecars Forge | Forge |
| Nota Markdown de statblock e editor de Values do Forge | Forge |
| Campos e layout no formato `.atlastemplate` | Formato nativo Atlas usado como entrada; o Forge importa os dados compatíveis para uma cópia `.forgetemplate` |
| Dados de cena, tokens e Resources pertencentes ao Atlas | Atlas |
| Rolagens em mapa encaminhadas ao DiceTool do Atlas; motor de rolagens sem mapa e histórico próprio | Atlas e Forge, conforme a origem |
| Botões e regras locais de Rest do Forge | Forge; atualização dos Resources utiliza os serviços e stores internos do Atlas |

A integração profunda com o Atlas usa como bases os runtimes internos inspecionados nas versões 0.17.0 e 0.18.0. Versões 0.17.0 ou superiores são permitidas; nas versões posteriores, o Forge verifica os métodos e serviços necessários antes de executar cada recurso. Se o Atlas alterar uma API interna, o recurso afetado ficará indisponível, enquanto o editor do Forge e os fluxos baseados apenas em arquivos do Vault continuarão funcionando.

## Sincronização dos Resources do Atlas

Quando uma nota de statblock Forge v2 está vinculada a um Character do Atlas, o Forge acompanha os Resources definidos pelas regras da campanha em jogo ou, na ausência delas, pela coleção do mapa. Alterações nos Fields correspondentes atualizam os Resources dos Characters vinculados em mapas GM abertos usando o store nativo do Atlas. Os valores atuais são preservados e limitados ao novo máximo; máximos definidos manualmente são respeitados; Resources novos começam cheios (`drains`) ou vazios (`fills`). Um Field explicitamente vazio remove o Resource correspondente, enquanto Fields ausentes ou valores não numéricos não apagam dados existentes. Mapas fechados são sincronizados quando forem abertos, e visualizações de jogadores não são modificadas diretamente. O Atlas continua responsável pelos valores e pela sincronização de Resources; as ações de Rest do Forge são tratadas separadamente.

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
