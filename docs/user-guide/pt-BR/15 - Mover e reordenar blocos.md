---
title: Statblock Forge — Mover e reordenar blocos
aliases:
  - Arrastar blocos no Canvas
  - Ordem dos Fields e dos blocos
tags:
  - statblock-forge
  - documentação/layout
parte: 2
---

# Mover e reordenar blocos

O Canvas possui duas hierarquias que podem ser reorganizadas: a **ordem dos Fields no template** e a **árvore de blocos do layout**. Elas são relacionadas, mas não são a mesma coisa. Reordenar um Field na paleta não muda automaticamente a posição de seu bloco no Canvas; mover um bloco no Canvas também não altera a ordem dos Fields.

Este capítulo cobre seleção, arraste, destinos, reposicionamento no Grid e limites dos containers. Para entender como o modo Dense muda o resultado do arraste, consulte [[14 - Dense Layout]].

## 1. Selecionar blocos no Canvas

- **Clique** em um bloco para selecionar o bloco mais profundo naquele ponto. O inspetor lateral passa a mostrar suas propriedades.
- **Ctrl+clique** no Windows/Linux, **Cmd+clique** no macOS ou **Shift+clique** adiciona ou remove o bloco da seleção sem substituir os itens já selecionados.
- **Alt+clique** em um bloco filho seleciona a Section que o contém, em vez do filho. Repetir o gesto em níveis aninhados permite subir pela hierarquia de Sections.
- Sections e Rows têm alças próprias de seleção na borda do container. A alça evita confundir a seleção do container com a seleção de um filho.
- Em um bloco Text, o Forge inicia a seleção no começo do gesto de ponteiro, mas não bloqueia o clique posterior em links Markdown renderizados dentro do texto.

A seleção múltipla é útil para inspecionar e executar ações que aceitam vários IDs, como remoção. Os botões de ordem **↑ / ↓** aparecem somente quando há um único bloco selecionado. O gesto de arraste identifica um bloco por vez; não use a seleção múltipla como se fosse um agrupamento que será arrastado em conjunto.

## 2. Arrastar um bloco existente

1. Inicie o arraste pela área do bloco, não pela alça de redimensionamento.
2. Mova o ponteiro até o destino desejado.
3. Observe o destaque de destino e a indicação de inserção.
4. Solte para aplicar a operação.

A alça de redimensionamento não inicia um arraste de bloco. Enquanto o bloco está sendo redimensionado, o Forge bloqueia o gesto de drag-and-drop para evitar mover o elemento por acidente.

### Como o Forge interpreta o destino

O ponto em que o bloco é solto determina se ele entra em um container ou se é inserido antes/depois de outro bloco:

| Destino | Interpretação |
|---|---|
| Região central de uma **Section**, **Row** ou **Tabs** | Tenta inserir o bloco como filho do container, desde que a combinação de tipos seja permitida. |
| Região próxima a uma borda de um bloco | Insere antes ou depois daquele irmão. A borda mais próxima define o eixo e a posição. |
| Área vazia de uma Grid | Usa a Grid que recebeu o drop e, quando aplicável, a célula sob o ponteiro. |
| Área vazia geral do Canvas | Acrescenta o bloco ao final da lista principal. |

A região central usada para entrar em um container é uma área interna de destino; não é necessário acertar exatamente o centro visual do container. Se a região central não for usada, o Forge interpreta o gesto como inserção ao lado do bloco-alvo.

## 3. Reposicionamento em uma célula do Grid

O comportamento depende do **Dense Layout**:

- Com **Dense Layout desligado**, um drop sobre uma Grid pode registrar a coluna e a linha solicitadas. Isso permite posicionar um filho diretamente em uma célula, em vez de apenas alterar sua ordem.
- Com **Dense Layout ligado**, o arraste altera a ordem estrutural dos irmãos. O algoritmo compacto calcula novamente as posições resultantes; a célula sob o ponteiro não é mantida como uma âncora manual.

### O que acontece quando há colisão no modo Dense desligado

Quando a célula de destino já está ocupada, o Forge insere o bloco antes do primeiro bloco que colide com o retângulo solicitado. O algoritmo recalcula o Grid esparso e desloca os blocos afetados para baixo, preservando suas colunas sempre que possível. Os blocos sem colisão mantêm suas posições.

A reposição por coordenadas é aplicada a filhos diretos da Grid principal e a filhos diretos da Grid de uma **Section**. Os filhos de uma **Row** continuam sendo distribuídos pela ordem flexível da Row; as Sections que são filhas de **Tabs** continuam sendo ordenadas como abas.

### Exemplo: mover um bloco sem reorganizar a faixa inteira

Imagine uma Grid com `AC` na coluna inicial, `HP` à direita e `Speed` abaixo. Com Dense desligado, soltar `Speed` em uma célula vazia mais à direita define uma nova âncora para ele. Se outro bloco ocupar a mesma área, apenas os blocos afetados pela colisão são empurrados para baixo.

Com Dense ligado, mover `Speed` entre `AC` e `HP` altera a ordem dos irmãos; a compactação determina a nova disposição de todos os irmãos que precisarem ser recalculados.

## 4. Usar os botões ↑ e ↓

Quando um único bloco está selecionado, os botões **↑** e **↓** aparecem no grupo de seleção dentro de **More options** na barra do Canvas.

- Cada clique troca o bloco selecionado com o irmão imediatamente anterior ou posterior.
- O botão não move o bloco para dentro de outro container.
- A operação não atravessa os limites de Section, Row ou Tabs.
- O botão fica desabilitado quando não existe um irmão naquela direção.
- A ordem escolhida passa a conduzir o layout daquele grupo; o Forge limpa as âncoras manuais dos irmãos para evitar que posições antigas contrariem a nova ordem.

Use esses botões quando souber que deseja alterar somente a ordem entre irmãos, sem escolher uma célula visual específica.

## 5. Reordenar Fields na paleta

Na lista **Fields** da lateral, cada Field tem uma alça de ordenação separada do botão com o nome do Field.

- Arraste a alça `⠿` para mudar a ordem do Field na lista.
- Com a alça focada, pressione **↑** ou **↓** para trocar o Field com o anterior ou posterior. O foco permanece na alça do Field depois da atualização.
- Arraste o **nome do Field**, e não a alça, para adicionar ou mover sua representação no Canvas.
- Clique no nome para abrir as configurações do Field.

A ordem da paleta é a ordem das definições de Fields no template. Ela é independente da ordem dos blocos no Canvas e não muda os Values já armazenados nas notas de statblock.

## 6. Arrastar um Field para o Canvas

O nome do Field na paleta pode ser arrastado para uma Grid, um bloco ou um container:

- Se o Field ainda não estiver representado no layout, o Forge cria o bloco correspondente ao tipo/categoria do Field.
- Se o Field já estiver representado, o Forge move o bloco existente. Não cria uma segunda representação independente do mesmo Field.
- O Field e sua chave continuam os mesmos. O gesto altera onde ele é apresentado, não cria uma propriedade nova.
- **Metric** e **Table** são Containers de dados, criados por **Add Container**. Arraste Fields compatíveis para dentro deles para adicioná-los como filhos: Metric aceita Fields escalares; Table aceita Fields compatíveis; Pairs permanece uma Collection independente. O Field `scores` da Table é gerenciado internamente e não deve ser adicionado à paleta como Field comum.

### Soltar um Field diretamente em Tabs

Tabs aceita Sections como filhos diretos. Por isso, ao soltar um Field diretamente em Tabs, o Forge cria uma nova Section, usa o label do Field (ou sua chave quando não há label) como título da aba e coloca o bloco dentro dessa Section.

Se o Field já tinha um bloco em outra parte do layout, essa representação existente é movida para a nova Section. Para acrescentar um Field a uma aba já existente, solte-o na Section que representa aquela aba, não no wrapper Tabs.

## 7. Regras estruturais e movimentos recusados

| Regra | Consequência |
|---|---|
| **Tabs** recebe somente **Section** como filho direto. | Soltar um bloco comum no centro de Tabs não cria um filho inválido. Para criar uma aba, o Forge o envolve em uma Section. |
| **Row** não recebe outra **Row** nem **Tabs** diretamente. | O Forge procura um nível ancestral compatível para inserção lateral, ou recusa um movimento explícito para um destino inválido. |
| Um container não pode ser colocado dentro de si mesmo ou de um descendente. | O Forge bloqueia ciclos na árvore de layout. |
| Os botões ↑ / ↓ operam somente entre irmãos. | Para mudar de container, arraste o bloco para o destino compatível. |
| Um Field só possui uma representação de Canvas por vínculo de layout. | Arrastar um Field já colocado move o bloco existente. |

O movimento entre containers preserva o objeto do bloco e suas configurações, mas o tamanho e a posição podem ser recalculados no novo grupo. A Grid de destino pode ter largura e conteúdo diferentes da Grid de origem.

## 8. Row: remover o container sem apagar seus filhos

Quando uma **Row** está selecionada, a barra **More options** oferece **Ungroup**. Esse comando remove o wrapper Row e devolve seus filhos ao nível de irmãos da Row, preservando a ordem dos filhos. O Forge limpa as âncoras do grupo para que a nova disposição seja calculada pelo container pai.

Ungroup não é o mesmo que Delete: apagar uma Row remove o bloco/container selecionado e pode remover sua árvore descendente. Use **Ungroup** quando quiser manter os blocos e apenas desfazer a faixa horizontal.

## Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| O bloco ficou antes/depois, mas não entrou no container. | O drop ocorreu perto da borda, fora da região central de inserção. | Arraste novamente para a região central do container. |
| O bloco não se move pelo canto. | O ponteiro iniciou na alça de redimensionamento. | Comece o arraste em outra área do bloco. |
| O bloco mudou de posição depois do drop. | Dense Layout está ligado ou houve colisão no Grid esparso. | Verifique o modo Dense e observe as âncoras dos irmãos. |
| Não consigo soltar um bloco em Tabs. | Tabs só aceita Sections diretamente. | Solte o Field diretamente em Tabs para o Forge criar uma nova Section, ou selecione uma aba existente. |
| O bloco não passa para outra Section com ↑ / ↓. | Os botões só trocam irmãos no mesmo container. | Arraste o bloco para a Section de destino. |
| Arrastar um Field não criou outro bloco. | O Field já tinha uma representação. | O Forge move o bloco existente para evitar duplicação. |

## Veja também

- [[07 - Canvas e layout]] — barra, inserção e estrutura do Canvas.
- [[08 - Grid de 12 colunas]] — células e coordenadas.
- [[09 - Redimensionar blocos]] — largura e altura.
- [[10 - Containers: visão geral]] — regras dos containers.
- [[12 - Row]] — distribuição horizontal e Ungroup.
- [[14 - Dense Layout]] — posicionamento compacto e manual.
