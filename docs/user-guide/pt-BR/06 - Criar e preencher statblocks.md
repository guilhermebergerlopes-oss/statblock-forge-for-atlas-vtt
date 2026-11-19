---
title: Statblock Forge — Criar e preencher statblocks
tags:
  - statblock-forge
  - documentação/statblocks
---

# Criar e preencher statblocks

Um statblock é uma ficha individual criada a partir de um template. O template define a estrutura; a nota criada guarda os valores daquela instância.

## Criar a partir de um template

1. Abra o menu da ribbon **Statblock Forge** ou a Command Palette.
2. Escolha **Create statblock** / **Criar statblock**.
3. Selecione o template desejado.
4. Informe o nome do statblock.
5. Opcionalmente, marque **Copy example values** para copiar os valores de exemplo do template.
6. Confirme a criação.

A nota é criada na pasta definida em **Pasta para notas de statblock**. Quando a criação é iniciada pelo menu de contexto de uma pasta no File Explorer, aquela pasta pode ser usada como destino.

## Valores de exemplo

Por padrão, **Copy example values** fica desmarcado. Nesse caso, a nova ficha recebe o nome informado e os demais Fields começam sem valores iniciais, salvo comportamentos específicos do template.

Quando a opção é marcada, os valores presentes na seção `sample` do template são copiados para os Fields correspondentes. Isso não altera os valores de outras fichas nem o template original.

## Primeira edição

Após a criação, o Forge abre a ficha e direciona o foco para o primeiro Field editável vazio na ordem do template. Se não houver Fields vazios, direciona para o primeiro Field editável. Reabrir ou atualizar uma ficha existente não deve provocar esse foco automático novamente.

## Editar valores

A edição acontece diretamente na visualização do statblock. O controle varia de acordo com o tipo de Field:

- Texto e Markdown usam editores de texto.
- Number e Rating usam controles numéricos apropriados.
- List permite inserir itens simples; Spells usa um editor estruturado de grupos de conjuração e níveis/usos.
- Dados tabulares, Entries, Pairs, Counters e outros valores estruturados usam editores específicos.
- Choice apresenta as opções configuradas no template.

Em Fields do tipo Spells, adicione grupos de conjuração, linhas de nível/uso e nomes de magias separados por vírgula. `Ctrl/Cmd + Enter` salva; `Tab` navega para o próximo Field; `Escape` cancela a edição atual.

## O que é salvo

A edição de uma ficha modifica os dados daquela nota e preserva os demais metadados não relacionados. Ela não modifica automaticamente o template compartilhado.

O vínculo com o template permite que o Forge encontre a estrutura correta ao renderizar a ficha novamente. Mantenha o arquivo do template acessível no vault.

## Atualizar o template vinculado

Para alterar a estrutura ou a aparência compartilhada, abra o template vinculado pelo menu da ribbon, pela Command Palette ou pelo menu de contexto da nota. Salve as mudanças no template. As visualizações abertas de statblocks vinculados podem ser atualizadas quando o template é modificado.

> [!important] Template e ficha são coisas diferentes
> Use a edição da ficha para alterar os valores de uma criatura específica. Use a edição do template para mudar os Fields, a estrutura ou a aparência que serão compartilhados pelas fichas vinculadas.

## Visualizar outra nota com um template

O comando **Render current note with a Forge template** / **Visualizar nota atual com um template Forge** permite escolher um template para visualizar uma nota Markdown ou JSON compatível. Esse fluxo não deve ser confundido com criar uma nova ficha a partir de um template.

## Criar token Atlas

Quando a nota atual atende aos requisitos de compatibilidade e o Atlas está disponível, o Forge pode oferecer **Create Atlas token from this statblock** / **Criar token Atlas a partir deste statblock**. Esse é um fluxo separado da criação e edição da nota Forge.

## Próximo passo

A Parte 2 da documentação detalhará a organização visual do template em [[07 - Canvas e layout]].
