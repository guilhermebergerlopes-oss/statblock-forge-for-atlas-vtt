---
title: Statblock Forge — Canvas e layout
aliases:
  - Canvas do Forge
  - Layout do statblock
tags:
  - statblock-forge
  - documentação/layout
parte: 2
---

# Canvas e layout

O **Canvas** é a área visual do editor de templates. Nele, os blocos são posicionados, organizados em containers e redimensionados. A prévia usa o mesmo mecanismo de renderização do statblock, então alterações de estrutura podem ser avaliadas enquanto o template é editado.

Esta parte explica como a organização visual funciona. Para entender a diferença entre template, Field, bloco e statblock, consulte [[03 - Conceitos fundamentais]].

## Elementos da barra do Canvas

| Controle | Função |
|---|---|
| **Dense Layout** | Alterna entre o encaixe compacto e o posicionamento estável/manual dos blocos. Consulte [[14 - Dense Layout]]. |
| **Background grid** | Exibe ou oculta as guias visuais das Grids configuráveis do Canvas principal e das Sections. É apenas uma referência visual; não muda o posicionamento salvo. |
| **More options** | Expande ou recolhe as configurações secundárias, como quantidade de colunas, Dense Layout, largura da ficha e opções de seleção. |
| **Add block** | Reúne opções de conteúdo e apresentação. Heading pode ser fixo ou vinculado a um Text Field; Divider escolhe orientação; Collections e Resources selecionam o bloco correspondente ao tipo do Field. Opções que não possuem um Field compatível ficam ocultas. |
| **Add container** | Cria uma Section, Row ou Tabs, conforme as restrições do container selecionado. |
| **↑ / ↓** | Move o bloco selecionado uma posição na ordem dos irmãos dentro do mesmo container. |
| **Ungroup** | Remove o invólucro de uma Row selecionada e mantém seus filhos. |

Por padrão, a barra mantém visíveis **Statblock Mode**, **Add block** e **Add container**. As outras opções ficam recolhidas em **More options**.

O comando **Alternar Modo statblock** usa `Mod + Shift + S` por padrão. Para alterar a combinação, abra as configurações do **Statblock Forge**, clique no campo **Atalho do Modo statblock** e pressione a nova combinação. `Mod` representa Ctrl no Windows/Linux e Cmd no macOS.

Os menus de inserção aparecem na barra do Canvas. A seleção de um bloco também permite abrir suas configurações na barra lateral, onde ficam os valores de largura, altura, aparência e outras opções específicas.

## Como o layout é organizado

A estrutura visual é hierárquica:

- O Canvas principal contém uma **Grid** configurável, com 12 colunas por padrão e ajuste entre 4 e 24 em **More options → Grid columns**.
- Uma **Section** cria outra Grid para seus próprios filhos.
- Uma **Row** organiza seus filhos em uma linha flexível, lado a lado.
- Um container **Tabs** apresenta Sections como abas; cada Section contém o conteúdo de sua aba.

Uma Grid não é um bloco que você adiciona: ela é o sistema de posicionamento usado no Canvas principal e dentro das Sections.

## Inserir um bloco ou container

1. Selecione o Canvas, um bloco ou o container no qual deseja trabalhar.
2. Abra **Add block** para inserir conteúdo, ou **Add container** para criar uma estrutura.
3. Escolha o tipo. Quando necessário, selecione também o Field que será exibido.
4. Ajuste a largura, a altura e a aparência pelo inspetor do bloco.

Quando o último bloco selecionado for um container compatível, o novo item será inserido dentro dele. Se o container não aceitar o tipo escolhido, o Forge procura o nível ancestral mais próximo que aceite o novo tipo e o insere imediatamente depois do bloco selecionado (ou do container ancestral usado como referência). Em uma seleção múltipla, o último bloco selecionado é usado como referência.

Tabs aceita somente Sections como filhas diretas, e Row não aceita Row ou Tabs. Ao escolher um desses tipos incompatíveis, o novo item é colocado ao lado do container, no nível compatível mais próximo. Para adicionar conteúdo a uma aba existente, selecione a Section daquela aba.

## Canvas vazio

Quando ainda não existem blocos, o editor mostra uma área vazia com a indicação **No blocks placed**. Isso não significa que o template esteja inválido: basta adicionar o primeiro bloco ou container.

## Próximas notas

- [[08 - Grid de 12 colunas]] explica colunas, células, encaixe e altura automática.
- [[09 - Redimensionar blocos]] explica os controles de tamanho.
- [[10 - Containers: visão geral]] compara Section, Row e Tabs.
