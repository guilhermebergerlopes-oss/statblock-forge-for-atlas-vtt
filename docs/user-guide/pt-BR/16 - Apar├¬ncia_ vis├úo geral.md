---
title: Statblock Forge — Aparência: visão geral
aliases:
  - Aparência do Forge
  - Camadas visuais do statblock
tags:
  - statblock-forge
  - documentação/aparência
parte: 3
---

# Aparência: visão geral

A aparência de um statblock no Forge é composta por camadas independentes. O template define o tema geral e a moldura externa; o cabeçalho pode ter uma moldura exclusiva para a arte de Token; cada bloco pode herdar o tema ou receber ajustes próprios; blocos Image têm controles de enquadramento.

Essas camadas não são uma única borda ou um único tema. Para obter um resultado previsível, escolha primeiro a aparência geral e depois ajuste somente os blocos ou imagens que realmente precisarem de tratamento diferente.

## 1. As camadas de aparência

| Camada | Onde configurar | Escopo |
|---|---|---|
| **Theme** | Template → **Appearance** | Paleta geral do statblock: fundo, superfícies, bordas, acentos e texto. |
| **Outer frame** | Template → **Appearance → Custom outer border** | Contorno em torno da superfície inteira do statblock. |
| **Token border** | Template → **Appearance → Token border** | Moldura decorativa ao redor da arte de Token reservada no cabeçalho. |
| **Block appearance** | Selecionar um bloco → inspetor → **Block appearance** | Superfície, bordas, sombras, cores de texto, alinhamento e indicadores do bloco selecionado. |
| **Image framing** | Selecionar um bloco Image ou ajustar a imagem na ficha | Zoom e ponto focal de uma imagem comum vinculada a um Field Image. |

### Exemplo de composição

Uma ficha de criatura pode usar **5e Official Parchment** como tema, uma moldura externa **Double frame**, uma moldura **Shield** para a arte de Token e aparência **Custom** somente para um bloco de alerta. O Field de retrato usado em um bloco Image continua tendo seu próprio enquadramento, independente da arte de Token.

## 2. Theme: aparência geral

O tema fornece uma paleta de oito papéis de cor e orienta a aparência dos elementos que herdam o tema. A seleção é feita no template, na aba **Appearance**.

- **Built-in theme:** um dos presets incluídos no Forge.
- **Custom theme:** uma paleta reutilizável criada pelo usuário ou importada.
- **Theme overrides:** alterações de cores feitas sobre um preset interno sem modificar sua definição original.

O tema é salvo nos metadados de layout do template. Cada template pode usar uma aparência diferente, mesmo quando seus Fields e sua estrutura de blocos são iguais. Consulte [[17 - Temas prontos]] e [[18 - Criar e personalizar temas]].

## 3. Outer frame e Token border são coisas diferentes

A **moldura externa** envolve o statblock inteiro. Ela pode ter uma ou duas linhas e configurações de espessura, raio e espaçamento.

A **Token border** envolve apenas a arte de Token reservada no cabeçalho. Ela usa formas geométricas próprias, como círculo, oval, losango, hexágono ou escudo. Não altera o contorno geral nem os Fields Image comuns.

Para ilustrações, retratos e mapas inseridos no corpo da ficha, use um Field **Image** e configure seu bloco Image. Consulte [[19 - Moldura externa]], [[20 - Moldura da arte do Token]] e [[22 - Fields de imagem e enquadramento]].

## 4. Block appearance: herança ou personalização

Cada bloco começa no modo **Theme**. Nesse modo, sua apresentação acompanha o tema geral do statblock. Se necessário, selecione **Custom** no inspetor para ajustar o bloco individualmente.

A aparência personalizada pode controlar, conforme o tipo de bloco:

- **Surface:** fundo, opacidade, borda, forma, espessura, raio e sombra.
- **Text:** cor geral, cor de Labels, cor de Values e alinhamento.
- **Indicators:** cores de partes preenchidas, vazias e contornos de indicadores compatíveis.

Mudar de **Custom** para **Theme** suspende a aplicação dos overrides, mas não os apaga. Voltar a **Custom** recupera os valores. **Reset** remove a aparência individual e retorna ao modo **Theme**. Consulte [[21 - Aparência individual dos blocos]].

## 5. O que é salvo onde

| Dado | Local de armazenamento | Efeito ao reutilizar o template |
|---|---|---|
| ID do tema e overrides de paleta | Metadados de layout Forge do template | O template mantém seu preset e suas cores personalizadas. |
| Snapshot de tema personalizado | Metadados de layout Forge do template | A ficha continua com a paleta mesmo que o item seja removido da biblioteca. |
| Snapshot da moldura externa | Metadados de layout Forge do template | A moldura aplicada continua no template independentemente da biblioteca. |
| Biblioteca de temas e molduras reutilizáveis | Configurações do plugin Forge | Pode ser reaproveitada em outros templates e exportada. |
| Aparência individual | Metadados de layout do bloco ou Ability Part | O override acompanha o bloco/parte específica. |
| Values e enquadramento de uma imagem na ficha | Dados da instância do statblock, quando aplicável | Cada ficha pode ter seus próprios dados de imagem. |

A biblioteca e o template são relacionados, mas não são o mesmo registro. Remover um tema ou uma moldura da biblioteca remove a opção reutilizável; não apaga os snapshots que já estão guardados em templates.

## 6. Compatibilidade com Atlas e com o tema do Obsidian

> [!important] A aparência do Forge não é um tema global do Obsidian
> Os presets estilizam os statblocks renderizados pelo Forge. Eles não alteram o tema do Vault, as notas Markdown, a janela do Obsidian ou outros plugins.

Os metadados de tema, moldura externa e aparência por bloco são específicos do Forge. O renderer nativo do Atlas não interpreta automaticamente esses metadados de aparência do Forge. A integração de dados e de rolagens é separada da apresentação visual.

O preset **Obsidian default** é especial: sem overrides, o statblock herda o esquema de cores do tema ativo do Obsidian. Os demais presets aplicam uma paleta Forge ao statblock, independentemente de o Vault estar em tema claro ou escuro.

## 7. Fluxo recomendado

1. Abra o template e vá à aba **Appearance**.
2. Escolha um tema que combine com a finalidade da ficha.
3. Ajuste a paleta apenas se o preset precisar de pequenas correções.
4. Configure a moldura externa, se quiser um contorno global.
5. Configure separadamente a moldura do Token, se a arte do cabeçalho exigir.
6. Volte ao Canvas e use **Block appearance** somente nos blocos que precisarem de exceções.
7. Revise a prévia em diferentes larguras e com Values reais de exemplo.
8. Salve o template.

## Veja também

- [[17 - Temas prontos]] — presets incluídos.
- [[18 - Criar e personalizar temas]] — paletas personalizadas e snapshots.
- [[19 - Moldura externa]] — contorno da ficha.
- [[20 - Moldura da arte do Token]] — moldura da arte de Token.
- [[21 - Aparência individual dos blocos]] — overrides por bloco.
- [[22 - Fields de imagem e enquadramento]] — Fields Image.
- [[23 - Enquadramento na ficha]] — edição de imagem durante o uso.
- [[24 - Biblioteca de estilos .forgestyle]] — importar e exportar temas e molduras.
