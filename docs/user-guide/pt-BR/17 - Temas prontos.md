---
title: Statblock Forge — Temas prontos
aliases:
  - Presets de tema
  - Temas incluídos
tags:
  - statblock-forge
  - documentação/aparência
parte: 3
---

# Temas prontos

A lista **Theme**, na aba **Appearance** do editor de template, oferece onze presets visuais incluídos no Forge. Cada preset combina oito papéis de cor e também pode aplicar detalhes visuais próprios, como raio de canto, transparência, desfoque, destaques de cabeçalho ou sombras.

## Catálogo de temas

| Tema | Direção visual | Quando pode ser útil |
|---|---|---|
| **Obsidian default** | Usa o esquema de cores atual do Obsidian sem impor uma paleta Forge quando não há overrides. | Quando a ficha deve acompanhar o tema claro/escuro do Vault. |
| **5e Official Parchment** | Pergaminho quente, tinta escura, títulos carmesim e detalhes em cobre. | Fichas de fantasia clássica, bestiários e material com aparência de livro. |
| **Astral Voyager** | Tons cósmicos escuros, bordas prateadas e acentos dourados. | Criaturas planares, espaço, magia astral e conteúdo místico. |
| **Astral Crystal** | Tons de geodo ametista, ciano prismático e violeta luminoso. | Cristais, magia arcana, criaturas elementais ou tecnomágicas. |
| **Gilded Obsidian Vault** | Obsidiana muito escura, detalhes dourados e aparência de metal precioso. | Chefes, artefatos lendários e fichas de alto contraste. |
| **Bloodbound Gothic** | Veludo escuro, ferro de catedral e acentos vermelho-sangue. | Horror gótico, vampiros, maldições e cultos. |
| **Glacial Rime** | Azul ártico profundo, bordas cristalinas e ciano frio. | Criaturas de gelo, regiões polares e magia fria. |
| **Infernal Obsidian** | Basalto vulcânico, superfícies quentes e destaques em laranja-incandescente. | Demônios, fogo, forjas e ambientes vulcânicos. |
| **Modern Blue Glass** | Superfícies azul-naval translúcidas, acentos ciano e efeito de vidro/HUD. | Ficção científica, interfaces tecnológicas e campanhas modernas. |
| **Eberron Artificer** | Latão mecânico, ferro escuro e âmbar. | Artífices, construtos, alquimia e maquinaria arcana. |
| **Sylvan Woodcraft** | Verde-floresta, marrom de casca, madeira e detalhes de folhas. | Fadas, druidas, florestas e criaturas naturais. |

Os usos sugeridos são referências de composição, não restrições. Qualquer preset pode ser aplicado a qualquer template e ajustado na paleta.

## Escolher um tema

1. Abra um template no editor do Forge.
2. Entre na aba **Appearance**.
3. Abra a lista **Theme**.
4. Escolha um dos presets internos.
5. Confira a prévia do statblock e salve o template.

A escolha fica no layout Forge daquele template. Ela não muda o tema do Vault e não altera outros templates. Ao criar várias fichas a partir do mesmo template, todas usam o mesmo tema definido pelo template, enquanto os Values continuam independentes.

## Obsidian default: comportamento especial

**Obsidian default** não aplica uma paleta fixa quando não existem overrides. O statblock usa as cores e variáveis do tema ativo do Obsidian. Portanto, trocar o Vault de tema claro para escuro (ou vice-versa) também pode mudar a aparência desse statblock.

É possível abrir **Advanced customization** e definir cores próprias mesmo mantendo **Obsidian default**. Nesse caso, os papéis personalizados substituem as variáveis correspondentes enquanto esse preset estiver selecionado. O botão **Reset** remove os overrides desse preset e restaura a herança do Obsidian.

## Tema interno, overrides e tema Custom

- Um **preset interno** usa uma definição que vem com o plugin.
- Um **override** altera cores daquele preset somente no template atual. O preset original não é modificado.
- Um tema **Custom** é uma paleta reutilizável guardada na biblioteca do Forge e copiada para o template quando selecionada.

Os overrides de presets diferentes são mantidos separadamente. Personalizar `5e Official Parchment`, trocar para `Astral Voyager` e depois voltar não exige refazer as cores de pergaminho. Para criar, salvar e compartilhar paletas, consulte [[18 - Criar e personalizar temas]].

## Prévia e limitações

As amostras de cor exibidas abaixo de **Advanced customization** ajudam a comparar a paleta rapidamente. Elas não representam todos os detalhes do preset: alguns temas também alteram raio de borda, textura, transparência, desfoque ou tratamento do cabeçalho.

Os presets estilizam statblocks renderizados pelo Forge. Eles não são temas CSS do Obsidian e não mudam a interface geral do Vault.

## Veja também

- [[16 - Aparência: visão geral]] — camadas de aparência.
- [[18 - Criar e personalizar temas]] — substituir cores e salvar paletas.
- [[21 - Aparência individual dos blocos]] — exceções por bloco.
- [[24 - Biblioteca de estilos .forgestyle]] — importar e exportar estilos.
