---
title: Statblock Forge — Criar e personalizar temas
aliases:
  - Paletas personalizadas
  - Custom themes
tags:
  - statblock-forge
  - documentação/aparência
parte: 3
---

# Criar e personalizar temas

A área **Advanced customization** da aba **Appearance** permite alterar a paleta do preset selecionado, criar um tema personalizado reutilizável ou atualizar um tema Custom já salvo na biblioteca do plugin.

Há uma diferença importante entre **alterar a aparência deste template** e **atualizar a biblioteca reutilizável**. As cores alteradas no editor afetam o snapshot do template imediatamente; a biblioteca só é atualizada quando você usa o botão de salvamento do tema.

## 1. Os oito papéis de cor

O Forge usa oito papéis de cor. Os nomes exibidos na interface são estes:

| Controle | Chave da paleta | Papel visual |
|---|---|---|
| **Background** | `background` | Fundo principal do statblock. |
| **Surface** | `surface` | Superfícies comuns de painéis e blocos. |
| **Raised surface** | `raised` | Superfícies elevadas em relação às superfícies comuns, como controles e áreas internas destacadas. |
| **Border** | `border` | Contornos, divisórias e bordas vinculadas ao tema. |
| **Accent** | `accent` | Cor de destaque principal, incluindo ênfases e indicadores vinculados ao tema. |
| **Strong accent** | `accentStrong` | Variação mais intensa do destaque, usada em elementos que precisam de maior contraste. |
| **Text** | `text` | Cor principal do texto. |
| **Secondary text** | `muted` | Texto secundário, metadados e informações menos enfatizadas. |

A prévia de amostras mostra parte da paleta. Ela não é uma miniatura completa do statblock e não exibe necessariamente todos os detalhes especiais de cada tema.

## 2. Alterar um preset interno sem modificar sua definição

1. Abra o template e selecione um preset em **Theme**.
2. Expanda **Advanced customization**.
3. Altere os seletores de cor desejados.
4. Observe a prévia do statblock.
5. Salve o template.

Quando o tema selecionado é interno, o Forge registra os valores alterados em `themeOverrides` para o ID daquele preset dentro do layout do template. A definição original que acompanha o plugin permanece intacta.

Os overrides são separados por preset. Por exemplo, você pode escurecer **5e Official Parchment**, depois ajustar **Astral Voyager** e alternar entre os dois sem perder as personalizações de cada um.

### Reset de um preset

O botão **Reset** solicita confirmação e remove os overrides do preset que está selecionado naquele momento. Ele não apaga os overrides dos outros temas e não modifica a paleta original do plugin.

No caso de **Obsidian default**, Reset remove as cores personalizadas e devolve ao statblock a herança das variáveis do tema atual do Obsidian.

## 3. Criar um Custom theme reutilizável

Use esse fluxo quando quiser guardar uma paleta para aplicá-la em vários templates:

1. Selecione um preset próximo do resultado desejado.
2. Ajuste as oito cores em **Advanced customization**.
3. Preencha **Custom theme name**.
4. Clique em **Save as custom theme**.
5. O Forge cria um ID próprio, registra a paleta na biblioteca de configurações do plugin e incorpora uma cópia do tema ao layout do template atual.

O tema passa a aparecer na lista **Theme** com o rótulo **Custom**. Ao selecioná-lo em outro template, o Forge copia os dados do tema da biblioteca para o layout desse template.

### Alterar um Custom theme salvo

Quando um tema Custom da biblioteca está selecionado:

- Alterar as cores modifica a cópia incorporada no template atual.
- **Save changes to theme** atualiza a entrada reutilizável na biblioteca com as cores e o nome atuais.
- **Remove from theme library** remove a entrada reutilizável, após confirmação.
- **Export this theme** exporta somente o tema atual em um pacote `.forgestyle`.

Se você alterar as cores e fechar o editor sem usar **Save changes to theme**, a cópia do template pode ficar diferente da versão reutilizável que continua na biblioteca. Isso permite experimentar uma variação em um template sem mudar todos os outros que usam o tema.

## 4. Biblioteca e snapshot do template

O Forge mantém dois registros:

- **Biblioteca:** lista reutilizável de temas Custom e molduras, guardada nas configurações do plugin.
- **Snapshot:** cópia do tema Custom incorporada ao layout de cada template que o utiliza.

Essa separação evita que a remoção de um item reutilizável quebre templates existentes. Se um tema for removido da biblioteca enquanto um template ainda usa sua cópia, ele continua aplicado nesse template e pode aparecer na lista como uma cópia do template.

Remover o tema da biblioteca não remove o tema de cada template. Para deixar de usá-lo em um template, selecione outro tema na lista **Theme** e salve o template.

## 5. Exportar e importar temas

- **Export this theme** exporta somente o tema atualmente selecionado (com as cores e o nome usados na exportação).
- **Export style library** exporta todos os temas e molduras reutilizáveis da biblioteca do plugin, quando houver itens salvos.
- **Import .forgestyle** abre um seletor de arquivo e depois uma janela para revisar os estilos encontrados.

Quando um pacote importado contém um ID ou nome já existente, a janela permite manter ambos como cópias, substituir o estilo correspondente ou ignorar aquele item. Importar uma paleta não a aplica automaticamente a todos os templates: primeiro ela entra na biblioteca; depois pode ser selecionada em cada template.

Para detalhes do formato, validação e tratamento de conflitos, consulte [[24 - Biblioteca de estilos .forgestyle]].

## 6. Formato e limites das cores

As cores são selecionadas pelos controles de cor do editor e armazenadas como hexadecimal de seis dígitos no formato `#RRGGBB`, por exemplo `#1E293B` ou `#E6D3B3`. O Forge não exige CSS, snippets ou edição manual de arquivos para personalizar a paleta.

Os temas Custom usam nome, ID e os oito papéis de cor. Os nomes dos estilos são texto simples; o pacote de estilos valida os dados antes de importar.

## Exemplo: uma paleta para uma ficha de gelo

Você pode começar de **Glacial Rime** e alterar apenas alguns papéis:

| Papel | Valor de exemplo | Intenção |
|---|---|---|
| Background | `#07131E` | Fundo mais profundo. |
| Surface | `#102535` | Painéis azul-escuros. |
| Raised surface | `#18384A` | Áreas internas mais elevadas. |
| Border | `#276078` | Contornos azulados. |
| Accent | `#45C7F2` | Destaque ciano. |
| Strong accent | `#B7F0FF` | Títulos e ênfases claras. |
| Text | `#EAF8FC` | Texto principal. |
| Secondary text | `#9FC5D1` | Metadados e rótulos secundários. |

Depois de conferir a legibilidade, use **Save as custom theme** com um nome como `Frostbound`. O preset Glacial Rime original continua disponível, e a nova variação aparece como Custom.

## Veja também

- [[17 - Temas prontos]] — presets incluídos.
- [[16 - Aparência: visão geral]] — camadas visuais.
- [[19 - Moldura externa]] — personalizar a moldura da ficha.
- [[24 - Biblioteca de estilos .forgestyle]] — compartilhar e importar temas.
