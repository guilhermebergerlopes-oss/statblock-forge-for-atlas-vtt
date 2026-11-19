---
title: Statblock Forge — Criar e editar templates
aliases:
  - Criar templates Forge
  - Fluxo do editor de templates
tags:
  - statblock-forge
  - documentação/templates
parte: 1
---

# Criar e editar templates

Esta nota acompanha o fluxo de criação, edição, salvamento e manutenção de um Template. O princípio mais importante é: **defina primeiro os Fields; depois associe-os aos blocos do Canvas**. Criar um Field não adiciona automaticamente um bloco ao layout.

## Criar um Template novo

1. Clique no ícone de ribbon **Statblock Forge** e escolha **Create new template**, ou use **Create new Forge template** na Command Palette.
2. O Forge abre um editor com um Template inicial ainda não salvo.
3. Revise os Fields de cabeçalho reservados.
4. Adicione os Fields específicos do seu sistema.
5. Associe Fields a blocos e organize-os no Canvas.
6. Ajuste containers, tamanho e aparência.
7. Use Save para dar um nome ao Template e gravar o arquivo.

O Template inicial contém os Fields de cabeçalho convencionais:

| Key padrão | Label inicial | Type | Função comum |
|---|---|---|---|
| `name` | Name | `text` | Nome exibido no cabeçalho. |
| `image` | Token art | `image` | Arte do Token no cabeçalho. |
| `level` | Level | `rating` | Nível/classificação do statblock. |
| `type` | Type | `text` | Tipo da criatura/personagem. |
| `hp` | HP | `number` | Hit Points. |
| `description` | Description | `markdown` | Descrição. |

O Template também contém Samples iniciais para prévia. Os Fields de cabeçalho são propriedades especiais quando reconhecidos pela key ou por `meaning`; não crie um segundo Field para o mesmo conceito sem necessidade. Consulte [[05 - Fields]] para entender os tipos e os Fields reservados.

## Abrir um Template existente

Use **Open template** na ribbon ou **Open template in Forge…** na Command Palette. O seletor procura Templates compatíveis no Vault e abre o arquivo selecionado no editor.

O Forge reconhece:

- `.forgetemplate`: formato salvo pelo Forge, com seus metadados de layout;
- `.atlastemplate`: formato nativo do Atlas, desde que a estrutura seja compatível;
- determinadas estruturas legadas reconhecidas pelo migrador do Forge.

Arquivos com JSON inválido, estrutura incompleta, metadados ausentes ou versão de metadados não suportada podem abrir com avisos ou modo protegido. O objetivo é evitar que um salvamento reconstrua silenciosamente e destrua informações que o Forge não consegue interpretar.

## Áreas do editor

O editor reúne três áreas de trabalho principais:

### Canvas

O **Canvas** é a representação visual do layout. Nele você pode adicionar, arrastar, selecionar e redimensionar blocos, além de organizar containers. O Canvas não é o lugar onde os Values de cada criatura são armazenados; ele configura como os dados serão apresentados.

### Structure

A aba **Structure** apresenta a árvore dos blocos e containers. Use-a para selecionar elementos que estejam aninhados, localizar blocos pelo nome e entender a hierarquia. Selecionar um container permite acessar seus filhos e reorganizar a estrutura.

### Properties

A aba **Properties** mostra as configurações do elemento selecionado. Os controles dependem do tipo:

- bloco ligado a Field: Field, apresentação e propriedades específicas;
- `Metric` e `Line`: conjunto/ordem de Fields e opções de apresentação;
- `Section`, `Row` e `Tabs`: propriedades estruturais;
- aparência: modo de herança, cor, borda, alinhamento, padding e outros estilos;
- permissões: controles de acesso quando aplicáveis.

A aba/área de edição de Fields permite criar, renomear, reordenar, configurar e remover Fields. Ela é distinta do Canvas.

## Criar Fields antes de montar o layout

Na área **Fields**, adicione um Field e configure:

1. **Label:** texto legível apresentado na interface.
2. **Key:** identificador usado no JSON e pelas referências internas.
3. **Type:** tipo de dado; determina os controles e opções disponíveis.
4. **Opções específicas:** por exemplo, unidade e fórmula para Number/Rating, opções de Choice/Checkboxes, colunas de Scores, estrutura de Entries ou configuração de Dice Formula.

O Forge valida keys duplicadas e identificadores inválidos. Uma key deve começar com letra e pode conter letras, números, `_` e `-`, com até 40 caracteres. Keys são comparadas sem diferenciar maiúsculas/minúsculas. `formerKeys` preserva aliases antigos reconhecidos em migrações; não use keys antigas como novas keys de outro Field.

> [!important] Adicionar Field não altera o Canvas
> Depois de criar um Field, arraste-o para o Canvas ou crie um bloco compatível e selecione o Field no inspetor. Até que exista um bloco associado, o Field pode estar definido no Template sem aparecer na composição visual.

## Associar Fields a blocos

O Forge escolhe um bloco padrão compatível quando um Field é arrastado ao Canvas. Exemplos:

- `number`, `rating`, `text`, `choice` e `dice` normalmente começam em `Stat`;
- `markdown` começa em `Text`;
- `list` começa em `Tags`;
- `scores` começa em `Scores`;
- `entries` começa em `Entries`;
- `pairs` começa em `Pairs`;
- `image` começa em `Image`;
- `spells` começa em `Spells`;
- `counters` começa em `Counters`;
- `checkboxes` começa em `Checkboxes`.

Outros blocos — como `Title`, `Metric`, `Line` e `Track` — atendem a apresentações específicas e não equivalem a um Field novo. Um mesmo Field pode ser apresentado em diferentes lugares quando a estrutura e as opções do bloco permitem. Para combinações suportadas e exemplos, consulte [[05 - Fields]] e as notas de cada bloco na Parte 2.

## Configurar Values de exemplo (Samples)

Samples pertencem ao Template e servem para testar a prévia e demonstrar valores esperados. Eles não são os Values permanentes de cada criatura.

1. Abra a configuração de Samples/JSON do Template.
2. Informe valores compatíveis com o tipo de cada Field.
3. Volte ao Canvas ou à prévia para conferir a apresentação.
4. Ao criar uma nota, escolha se deseja copiar os exemplos usando **Copy example values**.

Exemplos de formatos:

```json
{
  "name": "Ash Guard",
  "might": 8,
  "level": "2",
  "attack": "2d8+3",
  "traits": ["Armored", "Ash-touched"]
}
```

Este é um exemplo ilustrativo. As keys `might`, `level`, `attack` e `traits` só serão aceitas na ficha se estiverem declaradas no Template, com tipos compatíveis. `level` é texto no exemplo porque o Field de Rating pode armazenar sua representação como string; consulte a nota do tipo antes de definir seu JSON.

## Salvar: Update ou Save as New

Ao salvar, o nome informado determina a ação:

| Situação | Ação | Efeito |
|---|---|---|
| Template salvo e mesmo nome | **Update** | Atualiza o arquivo existente e mantém o ID do Template, preservando os vínculos das notas que já o utilizam. |
| Template novo, ainda sem arquivo | **Save** | Cria o primeiro arquivo do Template. |
| Template salvo e nome diferente | **Save as New** | Cria uma nova cópia com novo ID; o Template de origem permanece inalterado e as notas antigas continuam vinculadas a ele. |

O Forge compara a versão original do arquivo com o conteúdo atual antes de atualizar. Se o arquivo foi alterado, movido ou removido por outra operação enquanto o editor estava aberto, o salvamento pode ser recusado como conflito. Reabra o arquivo e reconcilie as alterações em vez de sobrescrever silenciosamente uma versão mais recente.

Para uma cópia de um Template existente, o novo ID evita colisões e identifica a nova linhagem por `derivedFrom` quando aplicável. Não copie manualmente IDs entre Templates.

### `.forgetemplate` e `.atlastemplate` ao salvar

- Um Template criado no Forge é salvo como `.forgetemplate`.
- Um `.forgetemplate` atualizado mantém o formato Forge e seus metadados `statblockForge`.
- Um `.atlastemplate` aberto e atualizado permanece no formato nativo Atlas.
- A exportação para `.atlastemplate` produz um arquivo Atlas limpo, sem o namespace de layout exclusivo do Forge. Recursos exclusivamente Forge podem ser transformados, omitidos ou reportados como incompatíveis conforme a regra de projeção.

Use `.forgetemplate` como fonte de trabalho quando precisar preservar layout e opções próprias do Forge. Use `.atlastemplate` quando o objetivo for compartilhar uma versão compatível com o Atlas. Consulte a documentação de compatibilidade na Parte 5.

## Conflitos, cópias e backups

- Se já existir um Template com o nome pretendido, escolha outro nome ou siga o fluxo explícito de confirmação disponibilizado pelo Forge.
- A substituição confirmada de um `.forgetemplate` existente cria um backup antes da gravação, em `.statblock-forge/backups/` dentro da pasta de Templates configurada.
- Atualizar o mesmo arquivo é diferente de criar uma cópia e substituir outro arquivo.
- Antes de mudanças amplas, faça também um backup externo do Vault.

## Rascunhos não salvos

O Forge mantém dados de recuperação de edições não salvas do Template. Ao iniciar, pode oferecer a recuperação de um rascunho fechado. Também é possível usar **Recover unsaved Forge template drafts** na Command Palette.

A recuperação é uma oportunidade de continuar uma edição interrompida; ela não substitui o salvamento normal. Depois de recuperar, confira o Template e salve usando Update ou Save as New conforme a intenção.

## Excluir um Template

Use **Delete template…** na Command Palette e confirme a operação. O arquivo é enviado para a lixeira do Obsidian; o Forge não apaga automaticamente as notas Markdown que foram criadas com base nele.

Atenção:

- notas vinculadas a um `.forgetemplate` removido podem deixar de localizar a fonte original para edição/renderização vinculada;
- notas e cópias `.atlastemplate` existentes não são apagadas pela exclusão do `.forgetemplate`;
- remover um `.atlastemplate` pode fazer com que referências que usam seu ID deixem de localizar esse Template no Atlas.

Antes de excluir, localize as notas que usam o Template e confirme se a fonte ainda é necessária.

## Fluxo de trabalho recomendado

1. Crie o Template e defina suas Fields.
2. Verifique keys e tipos antes de adicionar fórmulas.
3. Adicione os blocos que apresentam cada Field.
4. Agrupe o conteúdo com Section, Row ou Tabs.
5. Configure Samples e use a prévia para revisar o resultado.
6. Salve o Template.
7. Crie uma nota de statblock de teste.
8. Teste Values editáveis, fórmulas e rolagens.
9. Só então reutilize o Template em conteúdo de produção.

## Próximo passo

Leia [[05 - Fields]] para entender cada tipo antes de criar um esquema maior. Para o fluxo de instâncias, consulte [[06 - Criar e preencher statblocks]].
