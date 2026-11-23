---
title: Statblock Forge — Aparência individual dos blocos
aliases:
  - Block appearance
  - Personalização visual por bloco
tags:
  - statblock-forge
  - documentação/aparência
parte: 3
---

# Aparência individual dos blocos

A aparência individual permite que um bloco específico use a paleta global do Template ou receba overrides próprios. Ela altera a apresentação, não o Field nem o Value armazenado.

## Abrir o inspetor

1. Abra o Template no editor.
2. Selecione um bloco no Canvas ou na árvore **Structure**.
3. No inspetor lateral, expanda **Block appearance**.
4. Ative **Custom appearance** para editar os controles individuais.

Cada bloco possui seu próprio estado de aparência. Alterar um `Stat` não altera automaticamente outro `Stat`, mesmo quando ambos apresentam Fields do mesmo tipo.

### Copiar aparência entre blocos

No painel **Block appearance**, use **Copiar aparência** no bloco de origem. Selecione outro bloco e clique em **Colar aparência**. O botão de colar fica habilitado depois que uma aparência é copiada. O recurso funciona entre blocos e Templates enquanto a sessão do plugin estiver ativa.

Somente o modo de aparência (**Theme** ou **Custom**) e as configurações visuais do bloco são copiadas. O conteúdo, os Fields vinculados, fórmulas, dimensões, posição, visibilidade e demais propriedades estruturais do bloco de destino permanecem inalterados. As ações explícitas no inspetor foram escolhidas em vez de `Ctrl+C`/`Ctrl+V` para não interferir na cópia de texto, edição de inputs nem nos atalhos nativos do Obsidian.

## Modos Theme e Custom

| Modo | Comportamento |
|---|---|
| **Theme** | O bloco herda as cores e superfícies do tema geral do statblock. É o modo padrão de blocos novos. |
| **Custom** | Ativa controles próprios de **Surface**, **Text** e, quando compatível, **Indicators**. |

Trocar de **Custom** para **Theme** suspende os overrides, mas não os apaga. Ao voltar para **Custom**, os valores anteriores reaparecem. **Reset** remove a aparência individual daquele bloco e retorna para **Theme**.

A aparência é salva no layout Forge do Template, associada ao ID do bloco. Ela não é salva no Value do Field. Duplicar ou criar um bloco novo cria outra configuração de aparência.

## Surface

Os controles de **Surface** personalizam a caixa do bloco.

| Controle | O que altera | Faixa / opções |
|---|---|---|
| **Corner shape** | Formato básico dos cantos | `Square`, `Rounded`, `Oval` |
| **Background** | Cor de fundo | Hexadecimal `#RRGGBB` |
| **Opacity (%)** | Opacidade do fundo | 0–100% |
| **Border** | Cor do contorno | Hexadecimal `#RRGGBB` |
| **Border shape** | Geometria do contorno | `Default`, `Double`, `Oval`, `Diamond`, `Regular hexagon`, quatro `Triangle`, `Pointed`, `Angular`, `Hexagonal`, `Shield` |
| **Border style** | Estilo de linha | `Solid`, `Dashed`, `Dotted`, `Double`, `None` |
| **Thickness (px)** | Espessura do contorno | 0–16 px |
| **Corner radius (px)** | Raio dos cantos arredondados | 0–100 px |
| **Shadow color** | Cor da sombra | Hexadecimal `#RRGGBB` |
| **Blur (px)** | Difusão da sombra | 0–64 px |
| **Horizontal offset (px)** | Deslocamento horizontal | −32 a +32 px |
| **Vertical offset (px)** | Deslocamento vertical | −32 a +32 px |
| **Spread (px)** | Expansão/contração da sombra | −16 a +32 px |
| **Opacity (%)** | Opacidade da sombra | 0–100% |

### Geometria da borda

- **Default** usa a forma normal do bloco e permite escolher estilo de linha.
- **Double** desenha uma borda dupla.
- **Oval**, **Diamond**, **Regular hexagon**, os quatro **Triangle**, **Pointed**, **Angular**, **Hexagonal** e **Shield** usam um contorno geométrico recortado.
- Nos presets geométricos, os controles **Corner shape** e **Corner radius** não se aplicam e podem ficar indisponíveis.
- **Border style** é selecionável para o preset **Default**; a geometria dos demais presets define o próprio contorno.

A borda geométrica é composta por uma camada exterior e uma superfície interior. Em blocos Image, a arte também é recortada para permanecer dentro da borda.

## Text

O grupo **Text** separa três funções de cor:

| Controle | Elementos afetados |
|---|---|
| **Text** | Cor de fallback para o texto do bloco. |
| **Labels** | Nomes de Fields, títulos, descritores, cabeçalhos e rótulos. |
| **Values** | Valores numéricos ou textuais apresentados. |

Quando **Labels** ou **Values** possuem cores próprias, elas prevalecem para seus elementos. **Text** continua sendo o fallback para o restante do conteúdo.

Também estão disponíveis:

- **Horizontal alignment:** `Left`, `Center` ou `Right`.
- **Vertical alignment:** `Top`, `Middle` ou `Bottom`.
- **Padding (px):** espaçamento interno de 0 a 96 px.

O resultado do alinhamento depende do bloco e do container. Por exemplo, alinhar o conteúdo de um filho de `Row` não substitui a distribuição horizontal definida pela própria Row.

## Indicators

O grupo **Indicators** aparece quando o bloco pode apresentar rastreamento numérico:

- bloco `Track`;
- bloco `Counters`;
- bloco associado a Field `Number` ou `Rating` que tenha configuração `tracks` compatível.

Ele oferece:

| Controle | Efeito |
|---|---|
| **Filled marks** | Cor dos segmentos preenchidos. |
| **Empty marks** | Cor dos segmentos vazios. |
| **Outline** | Cor do contorno dos segmentos. |

Essas cores não substituem **Labels** ou **Values**; elas afetam apenas os indicadores visuais.

## Ability Part Counters

Counters dentro de **Ability Parts** possuem configuração de aparência por parte. Cada parte pode herdar o tema ou usar suas próprias cores de indicadores. Isso permite que uma habilidade tenha um contador com cor diferente sem impor a mesma aparência às outras partes.

## Image framing também é específico do bloco

Quando o bloco selecionado é do tipo `Image` e representa um Field comum do tipo `image`, o inspetor exibe **Image framing**. Esses controles são descritos em [[22 - Fields de imagem e enquadramento]]. Eles não se aplicam à arte de Token reservada no cabeçalho.

## Exemplo prático

Para destacar o bloco de HP:

1. Selecione o bloco `Track` de HP.
2. Ative **Custom appearance**.
3. Em **Surface**, escolha `Rounded`, fundo escuro, borda vermelha e sombra discreta.
4. Em **Indicators**, escolha vermelho para **Filled marks**, cinza para **Empty marks** e uma cor clara para **Outline**.
5. Em **Text**, mantenha os Labels claros e use uma cor mais forte para Values.

O Value atual de HP, seu máximo e as regras de recuperação continuam sendo dados do Field/Rest. A aparência não modifica esses dados.

## Recomendações e limites

- Configure primeiro o tema geral; use Custom somente nos blocos que precisam de exceção.
- Evite aplicar simultaneamente fundo muito opaco, borda espessa e sombra forte em todos os blocos, pois isso pode reduzir a hierarquia visual.
- Os valores numéricos são limitados e normalizados pelo Forge ao carregar o layout.
- Aparência Forge é metadado específico do Forge. Não é uma classe CSS portátil para o Atlas nativo nem uma alteração no tema do Vault.

## Veja também

- [[16 - Aparência: visão geral]] — hierarquia de aparência.
- [[18 - Criar e personalizar temas]] — paleta global.
- [[20 - Moldura da arte do Token]] — aro do Token.
- [[22 - Fields de imagem e enquadramento]] — controles de imagem.
