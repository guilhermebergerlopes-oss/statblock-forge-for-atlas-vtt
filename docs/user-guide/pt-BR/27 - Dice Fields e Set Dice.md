---
title: Statblock Forge — Dice Fields e Set Dice
aliases:
  - Conjuntos de dados
  - Dice Sets
  - Dados do Rest
tags:
  - statblock-forge
  - documentação/recursos-avançados
  - documentação/dados
parte: 4
---

# Dice Fields e Set Dice

Um Field do tipo **Dice** representa uma expressão que será rolada, como `2d6+3`, `1d20+5` ou `(1d8+2)*2`. O Forge valida a expressão com o parser do motor de dados usado na integração com Atlas e apresenta expressões válidas como links de rolagem.

Há dois modos distintos de configurar um Dice Field:

1. **Fórmula literal:** o texto da rolagem é o próprio Value do Field em cada statblock.
2. **Dice Formula:** a expressão é definida no Template e usa as mesmas referências numéricas compatíveis das fórmulas Number/Rating para construir a rolagem resolvida.

A ação **Set Dice** escolhe qual conjunto de dados/regras acompanhará rolagens compatíveis do Template. Ela não substitui a expressão do Field.

## 1. Dice Field literal

Sem **Dice Formula**, o Field guarda uma expressão de dados diretamente no Value da ficha. Isso é útil quando duas criaturas do mesmo Template possuem expressões diferentes ou quando o usuário deve poder editar a expressão no próprio statblock.

Exemplos:

```text
2d6+3
1d20+5
4d6kh3
2d6[fire]
```

O conteúdo precisa ser uma expressão reconhecida pelo parser e conter pelo menos um dado. Texto explicativo não faz parte do Dice Field. Para colocar rolagens dentro de uma descrição, use o reconhecimento de fórmulas em texto; consulte a documentação de texto/rotação de rolagens quando disponível.

### Referências `@field` em texto de dados

A validação do editor reconhece referências explícitas em expressões de dados como placeholders numéricos ao verificar a sintaxe. Para uma rolagem controlada pelo Template, use **Dice Formula**, que aceita `@fieldKey`, `{fieldKey}` e keys simples, usando o mesmo resolvedor de referências compatíveis com números das fórmulas Number/Rating.

## 2. Dice Formula dinâmica com `@field` ou `{fieldKey}`

**Dice Formula** é configurada nas propriedades do Field Dice no Template. Ela transforma os Values da ficha em uma expressão de dados resolvida. As referências usam o mesmo resolvedor das fórmulas Number/Rating: use a key simples, `@key` ou `{key}`. Caminhos com pontos podem acessar opções de Checkboxes e Selection, propriedades numéricas de Values estruturados e células de Tables. As chaves são a forma mais segura para keys com hífen:

```text
@proficiency d{might}+{level}
{proficiency}d@might+@level
```

Com estes Values:

| Field | Tipo | Value na ficha |
|---|---|---:|
| `proficiency` | Number | 2 |
| `might` | Number | 8 |
| `level` | Rating | 3 |

O Forge substitui os placeholders e produz:

```text
2d8+3
```

A fórmula configurada permanece no Template. Os números `2`, `8` e `3` pertencem à ficha. Portanto, o mesmo Template pode gerar `2d8+3` para uma criatura e `4d10+5` para outra sem duplicar o Template.

### Configurar uma Dice Formula

1. Crie ou selecione um Field do tipo **Dice**.
2. Abra as propriedades desse Field.
3. Preencha **Dice Formula** com a expressão usando `@fieldKey` ou `{fieldKey}`.
4. Confira se cada referência aponta para outro Field do mesmo Template e retorna um valor compatível com números.
5. Preencha os Samples com inteiros válidos para conferir a fórmula resolvida.
6. Salve o Template e teste em uma ficha real.

O campo aceita até **500 caracteres** para a fórmula configurada. O texto final ainda precisa respeitar os limites do parser de dados.

### Quais Values podem ser referenciados

A Dice Formula usa o mesmo resolvedor de referências das fórmulas Number/Rating. Ela pode acessar:

- Values Number e Rating, incluindo o resultado exibido da fórmula própria do Field;
- opções de Checkboxes e Selection como booleanos (`true` vira `1`, `false` vira `0`);
- opções Selection configuradas com **Each with a number**, usando `.number`;
- propriedades de objetos e posições de arrays quando contêm um valor numérico/booleano;
- células exibidas de Tables, incluindo Row Formulas e fórmulas Number/Rating dos Fields filhos;
- qualquer outro Value de Field que o resolvedor Number Formula consiga interpretar como número ou booleano.

Exemplos:

```text
{traits.flying} * {strength}
{stance.aggressive} * {proficiency}
{slots.0.max}d6kh{slots.0.used}
{scores.row2.power}d{strength}kh{strength}
```

Para keys simples, também são aceitas referências sem delimitador e com `@key`. Use chaves em keys com hífen e em caminhos com pontos quando quiser evitar ambiguidades.

### Pools de dados ponderados por Checkboxes

Um Field Checkboxes pode ser referenciado como um Field inteiro: ele retorna `1` quando pelo menos uma opção configurada está marcada e `0` quando nenhuma está marcada. Multiplique esse booleano por um Field numérico para incluir ou excluir sua contribuição de um pool:

```text
({cb_strength}*{strength} + {cb_skill1}*{skill1} + {cb_skill2}*{skill2})d{strength}kh{strength}
```

Por exemplo, com Strength `3`, Skill 1 `2`, Skill 2 `4`, e somente `cb_strength` e `cb_skill1` marcados, a fórmula resulta em `5d3kh3`: role cinco d3 e mantenha os três maiores. Também é possível referenciar uma opção individual, como `{traits.flying}`.

Fields Counter possuem referências por linha e agregadas. Por exemplo, `{spell_slots.0.max}`, `{spell_slots.0.used}` e `{spell_slots.0.remaining}` leem o máximo, os usos gastos e os usos restantes da primeira linha. `.spent` é alias de `.used`; `.current` e `.available` são aliases de `.remaining`. Os índices começam em zero e seguem a ordem combinada dos presets do Template e das linhas da ficha. Uma linha de preset pode ser consultada antes de ser materializada no Value da ficha; seu `used` inicial é zero.

Os totais podem ser consultados por caminhos `.total`, como `{spell_slots.total.remaining}`, ou por atalhos na raiz, como `{spell_slots.remaining}`, `{spell_slots.used}` e `{spell_slots.max}`. `{spell_slots.count}` retorna a quantidade de linhas visíveis. Linhas com `max = 0` mantêm seu índice, mas ficam ocultas e são excluídas dos agregados.

Counters também oferecem valores derivados: `.remainingPercent` (aliases `.percent`, `.availablePercent` e `.currentPercent`), `.usedPercent` (alias `.spentPercent`), `.isFull` e `.isEmpty`. Percentuais são valores não arredondados de `0` a `100`; estados cheio/vazio são booleanos numéricos (`1` ou `0`). Percentuais agregados são ponderados pelos máximos das linhas. Os nomes das propriedades não diferenciam maiúsculas de minúsculas, e formas com sublinhado/hífen como `.remaining_percent` são aceitas. Uma linha oculta com `max = 0` não possui percentual nem estado cheio/vazio.

Os mesmos caminhos de Counter funcionam em fórmulas Number/Rating, Dice Formula, Table/Metric e Rest. Somente propriedades numéricas são valores de fórmula; propriedades textuais como `name`, `reset` e `regain` não são. Dice Formula exige que todo valor resolvido usado na rolagem seja um inteiro seguro, então percentuais fracionários não podem ser inseridos diretamente como quantidade de dados/faces. Use uma fórmula Number/Rating como `floor({spell_slots.0.remainingPercent})` quando precisar de um inteiro.

Se um Field Number/Rating referenciado possui uma fórmula própria, a Number Formula completa é calculada primeiro — incluindo operações aritméticas, comparações, lógica, condições ternárias e funções suportadas como `floor`, `ceil`, `round`, `abs`, `min` e `max`. Em seguida, Dice Formula substitui o valor calculado.

O valor substituído ainda precisa ser um **inteiro seguro**. Quantidade de dados, faces, valores de keep/drop e constantes são inteiros no parser de dados. Um Rating fracionário como `1/4`, um decimal como `8.5`, dados ausentes ou texto não numérico não geram um link de rolagem. Essa é uma restrição da notação de dados; ela não altera como as fórmulas Number/Rating exibem resultados fracionários.

A própria Dice Formula continua sendo uma expressão de rolagem, não uma Number Formula geral. Quando precisar calcular um valor com funções ou condições da Number Formula, use um Field Number/Rating referenciado; o resultado ainda precisa ser um inteiro seguro para o parser de dados.

Um Dice Field não pode referenciar a si próprio. Referências ausentes, caminhos inválidos ou cálculos circulares deixam a fórmula indisponível (`—`); o Forge não substitui silenciosamente esses valores por zero.

### O que acontece quando um Field é alterado

- Alterar qualquer Value referenciado — incluindo uma opção de Checkboxes, uma opção de Selection, uma propriedade estruturada ou uma célula de Table — atualiza a Dice Formula exibida na ficha.
- Se um Field Number/Rating referenciado possui sua própria fórmula, o resultado calculado exibido por esse Field é usado na substituição.
- Renomear a key pelo editor atualiza referências `@oldKey` e `{oldKey}` reconhecidas.
- Um Field referenciado por Dice Formula não pode ser excluído até que a dependência seja corrigida. Alterar o tipo é permitido, mas o Value resultante ainda precisa ser interpretado como número ou booleano.
- O usuário da ficha edita os Values de origem, não a expressão definida no Template.

### Exemplo: dano por atributo e proficiência

Template:

| Field key | Tipo | Dice Formula / configuração |
|---|---|---|
| `weapon_dice` | Dice | `@proficiency d{might}+{level}` ou `{proficiency}d{might}+@level` |
| `proficiency` | Number | Value individual |
| `might` | Number | Value individual |
| `level` | Rating | Value individual |

Ficha A: `proficiency = 2`, `might = 8`, `level = 3` → `2d8+3`.

Ficha B: `proficiency = 3`, `might = 10`, `level = 4` → `3d10+4`.

Ambas usam a mesma definição do Template.

## Onde Dice Fields podem aparecer

Um Dice Field segue a associação normal entre Field e bloco. Os contextos confirmados incluem:

- **Stat:** apresenta a fórmula como link individual.
- **Line:** apresenta a fórmula em uma linha com outros Fields.
- **Metric Container:** um Field Dice dentro do Container pode apresentar a expressão resolvida como link; uma fórmula própria do slot Metric tem prioridade sobre o Dice Formula do Field.
- **Texto de Entries, Lists, Pairs e Groups:** expressões de dados reconhecidas no texto podem se tornar links por meio do scanner de rolagens em texto. Isso não transforma o texto em um Dice Field nem cria dependências `{fieldKey}` por si só.

Um bloco controla apresentação. O tipo Dice controla o dado. Uma fórmula dinâmica só é aplicada quando o bloco/renderer está exibindo o Field Dice associado.

## Notação de dados suportada

A gramática é compartilhada com o parser de dados do Atlas. Exemplos:

| Recurso | Exemplo | Efeito |
|---|---|---|
| Dado padrão | `1d20`, `2d6` | Rola um ou mais dados de faces numeradas. |
| Percentual | `d%` | Rola um d100. |
| Fate | `3dF` | Rola três dados com −1, 0 ou +1. |
| Soma/subtração | `2d6+3`, `2d6-1d4` | Combina dados e constantes. |
| Parênteses | `(1d8+2)*2` | Agrupa uma expressão. |
| Rerrolagem | `4d6r1` | Rerrola resultados indicados pelo modificador. |
| Explosão | `2d6!` | Adiciona rolagens quando a regra de explosão se aplica. |
| Manter | `4d6kh3`, `2d20kl1` | Mantém dados maiores/menores conforme o modificador. |
| Descartar | `4d6dh1`, `4d6dl1` | Descarta dados maiores/menores conforme o modificador. |
| Contar sucessos/falhas | `8d10cs>=8`, `8d10cf<2` | Conta dados que atendem à comparação. |
| Etiqueta | `2d6[fire]` | Nomeia o grupo de dados no resultado. |
| Vantagem/desvantagem escrita | `1d20+5 adv`, `1d20+5 dis` | Solicita vantagem (`adv`) ou desvantagem (`dis`) na rolagem. |

> [!note] Sufixo de rolagem de statblock
> `adv` e `dis` são interpretados pelo sistema de links de rolagem do statblock, não pela gramática aritmética geral. O sufixo deve ser a palavra final e não se aplica a Number/Rating ou Rest Formula.

Modificadores podem ter regras de comparação e limites específicos. Nem toda combinação de modificadores é válida. Use exemplos simples primeiro e confira a mensagem do editor.

### Limites do parser

O motor limita expressões para impedir fórmulas excessivas:

| Limite | Máximo |
|---|---:|
| Comprimento da expressão enviada ao parser | 100 caracteres |
| Termos de dados/constantes | 20 |
| Dados-base antes de rerrolagens/explosões | 100 |
| Faces por dado | 1.000 |
| Profundidade de parênteses | 8 |
| Total absoluto calculado | 1.000.000.000 |

A Dice Formula configurada no Template admite 500 caracteres porque contém placeholders; depois da substituição, a expressão final precisa respeitar os limites do parser de rolagens. Uma fórmula que passa pela validação dos placeholders pode ficar indisponível se os Values resultarem em uma expressão acima dos limites.

## Dica `avg`

Para expressões simples, lineares e aditivas, o Forge pode exibir uma dica `avg` com uma média estimada. A média só aparece quando o cálculo é confiável para o subconjunto implementado.

- `2d6+3` → `avg 10`.
- `2d6-1d4` → `avg 4.5`.
- `3dF` → `avg 0`.
- `d%` → `avg 50.5`.

A interface suprime a dica para referências dinâmicas (`@...` ou `{...}`), rerrolagens, explosões, keep/drop, contagem de sucessos/falhas, produtos e quocientes. A ausência de `avg` não significa que a fórmula seja inválida; significa que o Forge não apresenta uma estimativa simplificada.

## Set Dice

No editor do Template, use **Set Dice** para selecionar o conjunto de dados associado ao Template.

| Opção | Dados/regras indicados |
|---|---|
| **Collection default** | Deixa o Atlas usar o conjunto configurado na coleção ativa. Remove `diceSetId` explícito do Template. |
| **d20** | `1d20`, críticos naturais. |
| **d20 roll-under** | `1d20`, regra de crítico roll-under. |
| **d100 roll-under** | `1d100`, regra roll-under. |
| **d10 exploding** | `1d10`, regra de dado explosivo. |
| **Power roll** | `2d10`, edge e bane. |
| **Custom sets** | Conjuntos JSON válidos encontrados na pasta esperada do Vault. |

Uma escolha explícita é armazenada como `diceSetId` no Template. **Collection default** remove essa escolha explícita e delega ao Atlas.

### Conjuntos personalizados

O Forge lê conjuntos personalizados em:

```text
atlas-vtt/dice-sets/
```

Ele não cria, edita nem exporta esses arquivos. O seletor lê registros JSON válidos, com um `id`, um `name`, um ou mais grupos de dados e uma regra de crítico compatível. Um registro pode incluir opções de explosão, vantagem e desvantagem.

Regras gerais do validador do seletor:

- nome com até 40 caracteres;
- de 1 a 6 grupos de dados;
- cada grupo usa quantidade de 1 a 20 e faces de 2 a 999;
- soma das quantidades dos grupos de até 20 dados;
- `crit` precisa ser `natural`, `roll-under`, `doubles`, `high-total` ou `none`;
- opções adicionais de explosão/vantagem precisam obedecer ao formato esperado pelo Atlas.

Se o JSON estiver inválido, ele não aparece no seletor. Se o Template apontar para um `diceSetId` que não pode ser encontrado, escolha um conjunto disponível ou restaure o arquivo customizado correspondente. O Forge não modifica a biblioteca do Atlas.

## Vantagem, desvantagem e fila da próxima rolagem

Os links de rolagem usam o Dice Tool original do Atlas quando a ficha pertence a um mapa aberto. Sem mapa aberto, o Forge executa a rolagem localmente, usando o Dice Set do Template ou o mesmo Dice Set da coleção que o runtime verificado do Atlas selecionaria.

- Clique no link para rolar normalmente.
- `Shift` + clique solicita vantagem quando o conjunto/regras permitem.
- `Alt` + clique solicita desvantagem quando permitido.
- Clique com o botão direito em uma fórmula para usar **Salvar rolagem na coleção Atlas**. Dê um nome à rolagem; o Forge grava a fórmula resolvida em `dicePresets` da coleção associada ao statblock. O Atlas permite até 40 rolagens salvas, com nomes de até 40 caracteres. A fórmula precisa ser compatível com o parser do Atlas e ter no máximo 100 caracteres. Quando a fórmula for uma rolagem aditiva simples, o diálogo também poderá salvá-la como uma aparência individual do Dice Lab: um Dice Set ativo correspondente será copiado com suas regras e aparência, ou os próprios dados da fórmula gerarão uma aparência com crítico natural. Você poderá editar a rolagem salva depois no editor nativo do Atlas. Fórmulas terminadas em `adv`/`dis` ou com modificadores não suportados continuam como fórmulas comuns para preservar seu significado.
- Também é possível escrever `adv` ou `dis` como palavra final da fórmula: `1d20+5 adv`, `1d20+5 dis` ou `Stealth +5 adv`. O sufixo funciona em links de texto e em Dice Fields.
- Quando o sufixo e o atalho do clique pedem lados opostos, eles se cancelam. Por exemplo, `1d20+5 adv` clicado com `Alt` rola sem vantagem nem desvantagem.
- O Dice Set ativo precisa definir uma regra para o lado escrito; caso contrário, o Forge não executa a rolagem local como se fosse normal.
- Clique com o botão direito abre o menu contextual de rolagem.
- **Add to next roll** coloca a fórmula na fila sem rolar imediatamente.
- Como atalho, mantenha `N` pressionado e clique no link para adicionar/remover a fórmula da fila.

As fórmulas enfileiradas são somadas à próxima rolagem bem-sucedida da mesma ficha. A fila é por sessão e não é salva no Template nem na nota. Uma rolagem indisponível/falha não consome os modificadores pendentes.

O menu contextual inclui **Histórico de rolagens** sem depender do fork. O Forge combina os registros `diceLog` persistidos e `rollHistory` transitórios dos mapas Atlas abertos com seu próprio histórico salvo em `data.json`. O histórico do Forge mantém até 20 rolagens por ficha e 500 no total.

As rolagens feitas por links do Forge guardam a fórmula, a origem, o Dice Set e a vantagem/desvantagem usados. Se o mapa original ainda estiver aberto e visível, repetir a rolagem usa o DiceTool daquele mapa. Se o mapa tiver sido fechado, o Forge repete localmente com o Dice Set salvo. Entradas antigas lidas diretamente de um mapa continuam repetíveis enquanto o mapa de origem estiver disponível; elas não são copiadas para o histórico persistente do Forge apenas por serem exibidas.

## Dice Formula, Number Formula e Rest Formula não são intercambiáveis

| Família | Sintaxe de referência | Resultado |
|---|---|---|
| Number/Rating | `strength + proficiency`, `value * 2` | Um número determinístico; sem rolagem. |
| Dice Formula | `@proficiency d{might}+{level}` ou `{proficiency}d{might}+@level` | Substitui Values inteiros e gera uma rolagem. |
| Rest Formula | `(@level)d4`, `1d8+2` | Regra de recuperação/gasto, com referências `@field` e validação própria. |
| Counter `regain` | `1d4`, `2d6+1` | Fórmula literal de dados por linha, usada no fluxo **Restore to full**. |

> [!warning] Não copie a sintaxe sem adaptar
> Number/Rating, Dice Formula e Rest aceitam referências `@field` e `{field}`; Number/Rating também preserva a forma direta `field`. As famílias mantêm gramáticas e operadores próprios.

## Diagnóstico

| Sintoma | Verificação |
|---|---|
| Dice Formula mostra `—` | Verifique se todas as referências existem, se o caminho/opção é válido e se cada valor resolvido é um inteiro seguro. |
| Fórmula não resolve apesar dos Fields existirem | Confira se todos os Values substituídos são inteiros seguros. |
| Parser rejeita a expressão | Confira operadores, parênteses, modificadores e limites do parser. |
| `avg` não aparece | A expressão pode conter modificadores, referências ou operações sem média simples confiável. |
| Custom Set não aparece | Verifique o JSON em `atlas-vtt/dice-sets/`, especialmente `id`, `name`, `dice` e `crit`. |
| Uma rolagem não usa o Set esperado | Confira o `diceSetId` do Template e o conjunto da coleção quando estiver em **Collection default**. |

## Cálculos aritméticos nos modificadores de dados

Os argumentos numéricos dos modificadores podem ser calculados dinamicamente. Coloque a expressão entre parênteses; referências a Fields usam a mesma sintaxe `{fieldKey}` / `@fieldKey` do conjunto de dados:

```text
8d6kh({strength} + {skill})
8d6kl({minimum} + 1)
8d6dh({strength} - 1)
8d6r>=({difficulty} + 1)
```

Isso se aplica aos modificadores de manter/descartar (`kh`, `kl`, `dh`, `dl`, `k`, `h`, `l`), rerrolagem (`r`, `ro`, `rr`) explosão (`x`, `xo`) e contagem de sucessos/falhas (`cs`, `cf`). O resultado precisa ser um número inteiro não negativo dentro do limite do motor de dados. Expressões inválidas ou sem referência resolvida não geram uma rolagem.

## Veja também

- [[25 - Fórmulas em Number e Rating]] — cálculos determinísticos.
- [[26 - Checkboxes e referências booleanas]] — Values booleanos usados em cálculos.
- [[28 - Counters]] — fórmulas `regain`.
- [[30 - Rest: configuração e fluxo]] — botões de descanso.
- [[31 - Regras e fórmulas de Rest]] — referências e fórmulas de recuperação.
