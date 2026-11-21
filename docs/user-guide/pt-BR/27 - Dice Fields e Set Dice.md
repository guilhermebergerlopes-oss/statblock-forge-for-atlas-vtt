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
2. **Dice Formula:** a expressão é definida no Template e usa Values Number/Rating da ficha para construir a fórmula resolvida.

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

A validação do editor reconhece referências explícitas em expressões de dados como placeholders numéricos ao verificar a sintaxe. Para uma rolagem controlada pelo Template, use **Dice Formula**, que valida dependências de Fields Number/Rating e aceita tanto `@fieldKey` quanto `{fieldKey}`.

## 2. Dice Formula dinâmica com `@field` ou `{fieldKey}`

**Dice Formula** é configurada nas propriedades do Field Dice no Template. Ela transforma os Values da ficha em uma expressão de dados resolvida. Use `@key` ou `{key}` em torno da key exata do Field de origem. As duas formas podem aparecer na mesma expressão; use chaves para keys que contenham hífen:

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
4. Confira se cada placeholder corresponde a outro Field **Number** ou **Rating** do mesmo Template.
5. Preencha os Samples com inteiros válidos para conferir a fórmula resolvida.
6. Salve o Template e teste em uma ficha real.

O campo aceita até **500 caracteres** para a fórmula configurada. O texto final ainda precisa respeitar os limites do parser de dados.

### Quais Fields podem ser usados

Somente Fields do tipo **Number** e **Rating** podem ser referenciados por `@fieldKey` ou `{fieldKey}`. O próprio Dice Field não pode referenciar a si mesmo.

Cada valor substituído precisa ser um **inteiro seguro**. Isso é importante porque o número antes de `d` representa a quantidade de dados e o número depois de `d` representa suas faces.

| Valor de origem | Exemplo | Resolução |
|---|---|---|
| Inteiro | `proficiency = 2` | Válido. |
| Inteiro negativo como modificador | `modifier = -1` | Pode participar de uma constante/soma quando a expressão resultante for válida. |
| Fração de Rating | `challenge = 1/4` | Não é substituída: frações não são inteiros. |
| Decimal | `might = 8.5` | Não é substituído. |
| Texto | `might = "high"` | Não é substituído. |
| Field ausente | `{missing}` | Não resolvido. |
| Tipo incompatível | `{weaponName}` em Text | Não resolvido. |

Se alguma referência estiver ausente, vazia, fracionária ou for de tipo incompatível, a fórmula não gera link de rolagem. O Forge mostra o estado indisponível (`—`) e não substitui o valor por zero silenciosamente.

### O que acontece quando um Field é alterado

- Alterar o Value de um Number/Rating de origem atualiza a Dice Formula exibida na ficha.
- Alterar o Value de um Field de origem que possui sua própria fórmula usa o resultado numérico calculado desse Field como substituição.
- Renomear a key pelo editor atualiza referências `@oldKey` e `{oldKey}` reconhecidas.
- Um Field Number/Rating usado por Dice Formula não pode ser excluído ou convertido para um tipo incompatível até que a dependência seja corrigida.
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
| Dice Formula mostra `—` | Verifique se todos os placeholders existem e apontam para Number/Rating. |
| Fórmula não resolve apesar dos Fields existirem | Confira se todos os Values substituídos são inteiros seguros. |
| Parser rejeita a expressão | Confira operadores, parênteses, modificadores e limites do parser. |
| `avg` não aparece | A expressão pode conter modificadores, referências ou operações sem média simples confiável. |
| Custom Set não aparece | Verifique o JSON em `atlas-vtt/dice-sets/`, especialmente `id`, `name`, `dice` e `crit`. |
| Uma rolagem não usa o Set esperado | Confira o `diceSetId` do Template e o conjunto da coleção quando estiver em **Collection default**. |

## Veja também

- [[25 - Fórmulas em Number e Rating]] — cálculos determinísticos.
- [[26 - Checkboxes e referências booleanas]] — Values booleanos usados em cálculos.
- [[28 - Counters]] — fórmulas `regain`.
- [[30 - Rest: configuração e fluxo]] — botões de descanso.
- [[31 - Regras e fórmulas de Rest]] — referências e fórmulas de recuperação.
