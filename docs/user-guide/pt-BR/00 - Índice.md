---
title: Statblock Forge — Documentação
aliases:
  - Documentação do Statblock Forge
  - Manual do Statblock Forge
tags:
  - statblock-forge
  - documentação
  - índice
status: revisão ampliada
versao-forge: 0.4.0
---

# Statblock Forge — documentação

Este manual explica como criar Templates reutilizáveis, organizar statblocks no Canvas, configurar Fields, montar fórmulas e usar os recursos avançados do **Statblock Forge for Atlas VTT**. As notas são destinadas a um Vault do Obsidian e utilizam Markdown, frontmatter YAML, wikilinks e callouts.

> [!info] Escopo desta edição
> A edição acompanha o código do Forge **0.5.8**. Inclui validação de Dice Fields com o parser de rolagens, reconhecimento de expressões completas em textos, histórico de rolagens integrado ao Atlas e fórmulas dinâmicas em Fields `dice`, incluindo cálculos aritméticos dentro de modificadores como `kh`, `kl`, `dh`, `dl`, rerrolagens e explosões. O manual distribuído pelo comando **Download documentation** contém 35 notas no idioma escolhido: este índice e 34 notas de assunto, organizadas em quatro partes.

## Roteiro recomendado

Se esta é sua primeira utilização, leia as notas na ordem. Se já conhece o editor, use o índice por assunto.

### Parte 1 — Fundamentos

1. [[01 - Visão geral]] — propósito, arquitetura e limites do Forge.
2. [[02 - Instalação e configuração]] — requisitos, instalação, pastas, idioma e preferências.
3. [[03 - Conceitos fundamentais]] — distinção entre Template, Field, bloco, container, statblock e nota.
4. [[04 - Criar e editar templates]] — criação, associação entre Fields e blocos, salvamento e recuperação.
5. [[05 - Fields]] — catálogo de tipos de Field, formatos de valor e usos.
6. [[06 - Criar e preencher statblocks]] — instâncias, Samples e edição de Values.

### Parte 2 — Canvas e layout

7. [[07 - Canvas e layout]] — visão geral do editor visual.
8. [[08 - Grid de 12 colunas]] — Grid configurável, células, encaixe e altura.
9. [[09 - Redimensionar blocos]] — largura, altura e alocação de espaço.
10. [[10 - Containers: visão geral]] — estrutura e regras de aninhamento.
11. [[11 - Section]] — agrupamento de blocos em uma Grid interna.
12. [[12 - Row]] — distribuição horizontal.
13. [[13 - Tabs]] — organização em abas.
14. [[14 - Dense Layout]] — encaixe compacto e posições manuais.
15. [[15 - Mover e reordenar blocos]] — arraste, inserção e ordem estrutural.

### Parte 3 — Aparência

16. [[16 - Aparência: visão geral]] — níveis de personalização visual.
17. [[17 - Temas prontos]] — presets incluídos.
18. [[18 - Criar e personalizar temas]] — paletas e temas reutilizáveis.
19. [[19 - Moldura externa]] — contorno do statblock.
20. [[20 - Moldura da arte do Token]] — moldura decorativa da arte no cabeçalho.
21. [[21 - Aparência individual dos blocos]] — superfície, texto, bordas e indicadores.
22. [[22 - Fields de imagem e enquadramento]] — imagens do Vault e recorte no Template.
23. [[23 - Enquadramento na ficha]] — zoom e reposicionamento durante o uso.
24. [[24 - Biblioteca de estilos .forgestyle]] — importar e exportar temas e molduras.

### Parte 4 — Fórmulas e recursos avançados

25. [[25 - Fórmulas em Number e Rating]] — expressões numéricas, dependências e referências.
26. [[26 - Checkboxes e referências booleanas]] — opções booleanas como entradas de fórmula.
27. [[27 - Dice Fields e Set Dice]] — fórmulas de dados, interpolação de Values e conjuntos de rolagem.
28. [[28 - Counters]] — linhas, usos, recuperação e atribuição de Rest.
29. [[29 - Conditions]] — Conditions nativas do Atlas, catálogo por coleção e estado por Token.
30. [[30 - Rest: configuração e fluxo]] — botões, escolhas e execução de descanso.
31. [[31 - Regras e fórmulas de Rest]] — alvos, operações, fórmulas e gastos.
32. [[32 - Escolhas e ações de Rest]] — etapas, ações e escolhas para aliados.
33. [[33 - Permissões dos jogadores]] — acesso `edit`, `read`, `hidden` e `Total Hidden`.

## Referência rápida de fórmulas

O Forge possui famílias de fórmulas diferentes. Elas não são intercambiáveis:

| Família | Onde é usada | Sintaxe e exemplo |
|---|---|---|
| **Number/Rating Formula** | Calcula o Value numérico de um Field Number/Rating. | [[25 - Fórmulas em Number e Rating]]; aceita keys diretas, `@key` e `{key}`. Ex.: `floor(@strength / 2)`. |
| **Dice Formula** | Configurada em um Field `dice`; constrói uma rolagem a partir dos Values da ficha. | [[27 - Dice Fields e Set Dice]]; usa o resolvedor de referências Number/Rating para Checkboxes, Selection, Counters (linhas, agregados, percentuais e estados cheio/vazio), Fields calculados, valores estruturados e células de Tables, mantendo a sintaxe de rolagem e o requisito de inteiros. Ex.: `({cb_strength}*{strength})d{strength}kh{strength}`. |
| **Rest formula** | Recuperação, gasto por unidade e regras `regain`. | [[31 - Regras e fórmulas de Rest]]; aceita `@field_key` e `{field_key}`. Ex.: `@level d4` ou `{level}d4`. |
| **Scores column formula** | Calcula uma célula derivada em uma tabela Scores. | [[05 - Fields]]; usa `value` para a célula da linha atual e a sintaxe documentada para a coluna. |
| **Table formulas** | Calcula cada célula por linha e o resumo da coluna em uma Table. | [[34 - Fórmulas em Tables]]; inclui **Row Formula** e **Column Formula**, com valores exibidos e referências numéricas compartilhadas. |
| **Metric formula** | Calcula o valor de um slot Metric. | [[05 - Fields]] e [[25 - Fórmulas em Number e Rating]]; é configuração do slot e não substitui a fórmula do Field. |

> [!warning] Não misture sintaxes
> `@key` e `{key}` são formas alternativas de referenciar Fields em fórmulas Number/Rating, Dice Formula e Rest. Fórmulas Number/Rating também mantêm a referência direta por key. `value` é a entrada do contexto de fórmulas Number/Rating, Scores ou Metric. Consulte a nota específica antes de copiar uma expressão.
> Em **Table formulas**, `value` sem delimitadores representa a célula/entrada do contexto atual; `{value}` e `@value` fazem referência explícita a um Field cuja key é `value`. Essa distinção evita confundir o valor da linha com um Field chamado `value`.

## Como ler os exemplos

- `@proficiency` e `{proficiency}` representam a mesma referência a um Field e podem ser misturados em fórmulas Dice e Rest.
- Number/Rating também aceita a key direta, como `strength`, além de `@strength` e `{strength}`.
- `value` em uma fórmula representa o valor do contexto em que aquela fórmula está sendo avaliada; verifique a nota correspondente.
- Uma expressão mostrada como `2d8+3` pode ser o resultado resolvido de uma configuração armazenada como `{proficiency}d{might}+{level}`.
- Um bloco controla a apresentação. Um Field define o dado. A relação entre ambos precisa ser configurada no layout.

## Glossário rápido

| Termo | Significado |
|---|---|
| **Template** | Modelo reutilizável que define Fields e layout. |
| **Field** | Definição de um dado, com `key`, `label`, `type` e opções específicas. |
| **Value** | Conteúdo de um Field em uma ficha específica. |
| **Bloco** | Elemento do layout que apresenta um Field ou conteúdo estático. |
| **Container** | Bloco estrutural que organiza outros blocos, como Section, Row e Tabs. |
| **Statblock** | Instância preenchida de um Template. |
| **Sample** | Values de exemplo armazenados no Template, usados na prévia e opcionalmente ao criar uma ficha. |
| **Resource** | Valor rastreado que pode ser gasto e recuperado por regras de Rest ou pelo Atlas. |
| **Counter** | Conjunto de linhas com máximo, usos gastos e regras de recuperação. |
| **Atlas Condition** | Estado definido na coleção e armazenado no Token; gerenciado pelo Atlas, não pelo Forge. |

## Escopo, versão e idioma

- Base: Statblock Forge **v0.5.8**.
- Requisito mínimo declarado no manifesto: Obsidian **1.8.7**.
- O plugin é marcado como desktop-only.
- Os nomes dos controles aparecem em inglês quando esse é o texto da interface; Português (Brasil) está disponível nas configurações.
- O Forge é um plugin independente. A integração com Atlas usa contratos e fluxos de compatibilidade; não transforma o Forge no editor nativo do Atlas.

## Baixar a documentação para o Vault

1. Abra **Settings → Community plugins → Statblock Forge**.
2. Confira **Language**.
3. Defina **Documentation folder** se quiser outro destino.
4. Clique em **Download documentation**.
5. Abra `00 - Índice.md` na pasta criada.

> [!important] Como a atualização das notas funciona
> O comando cria somente arquivos que ainda não existem. Ele preserva notas existentes no Vault e **não as sobrescreve**. Para receber uma edição revisada, escolha uma pasta de destino nova ou faça backup e mova/renomeie as notas antigas antes de baixar novamente. Isso evita substituir anotações pessoais sem confirmação.

## Referências técnicas complementares

O repositório do projeto também contém notas técnicas em `docs/atlas-integration/` sobre contratos de integração, rolagens sem cena, resolução de Resources, serialização e testes. Elas são documentação de engenharia do código-fonte e não fazem parte das 34 notas entregues pelo comando **Download documentation**.

## Convenções e recomendações

- Mantenha o conjunto de notas em uma pasta dedicada para que os wikilinks funcionem sem ajustes.
- Ao adaptar exemplos, preserve as `key` dos Fields referenciados por fórmulas, blocos, regras Rest e Resources.
- Antes de renomear ou remover Fields usados por fórmulas ou regras, verifique as dependências.
- Guarde cópias dos Templates e das notas de statblock antes de migrações ou alterações em lote.
