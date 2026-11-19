---
title: Statblock Forge — Biblioteca de estilos .forgestyle
aliases:
  - Importar e exportar estilos
  - Style library
tags:
  - statblock-forge
  - documentação/aparência
  - documentação/arquivos
parte: 3
---

# Biblioteca de estilos .forgestyle

A biblioteca **Style library** permite compartilhar temas personalizados e molduras externas entre instalações do Statblock Forge. Um arquivo `.forgestyle` é um pacote JSON de dados validados; ele não é um arquivo CSS, snippet ou tema do Obsidian.

## Onde importar e exportar

### Settings → Style library

Nas configurações do plugin:

- **Import .forgestyle** abre um seletor de arquivo para importar um pacote.
- **Export style library** exporta em um único pacote todos os temas e molduras reutilizáveis registrados nas configurações do Forge. O botão fica indisponível quando a biblioteca está vazia.

### Template → Appearance

Na aba **Appearance** do editor de Template:

- **Import .forgestyle** importa um pacote para a biblioteca.
- **Export style library** aparece quando a biblioteca contém estilos.
- **Export this theme** exporta somente o tema selecionado/atual.
- **Export this border** exporta somente a moldura externa selecionada.

Os pacotes exportados usam a extensão `.forgestyle`. O importador também aceita JSON válido que respeite o esquema do pacote.

## O que pode ser compartilhado

Um pacote pode conter:

1. **Theme:** um tema personalizado com nome, ID e uma paleta de oito cores.
2. **Border:** uma moldura externa com estilo, cor, espessura, raio e parâmetros opcionais de linha interna.
3. **Collection:** uma coleção com pelo menos um tema e uma moldura.

A exportação da biblioteca reúne os temas e as molduras salvos nas configurações do plugin. A exportação individual inclui somente o item selecionado.

A biblioteca não exporta:

- Templates completos, Fields, Samples ou layout do Canvas;
- Values de statblocks;
- imagens ou arquivos do Vault;
- aparência individual de cada bloco;
- arte de Token e sua moldura;
- configurações de enquadramento de imagem;
- CSS, snippets ou código executável.

## Estrutura do pacote

O formato atual usa `format: "statblock-forge-style"` e `version: 1`. Exemplo de coleção:

```json
{
  "format": "statblock-forge-style",
  "version": 1,
  "kind": "collection",
  "name": "Ashen Copper Styles",
  "themes": [
    {
      "id": "ashen-copper-01",
      "name": "Ashen Copper",
      "palette": {
        "background": "#171412",
        "surface": "#24201c",
        "raised": "#332a22",
        "border": "#76583e",
        "accent": "#bd7b42",
        "accentStrong": "#edaa63",
        "text": "#f0e6d8",
        "muted": "#b8a28a"
      }
    }
  ],
  "borders": [
    {
      "id": "etched-double-01",
      "name": "Etched Double",
      "style": "double",
      "color": "#bd7b42",
      "width": 4,
      "radius": 8,
      "inner": true,
      "innerColor": "#f0e6d8",
      "innerWidth": 1,
      "innerGap": 3
    }
  ]
}
```

O exemplo demonstra a forma do JSON; os valores são apenas uma paleta e uma moldura ilustrativas.

### Campos do tema

- `id`: identificador estável, de 2 a 64 caracteres, formado por letras minúsculas, números, `_` ou `-`, começando por letra ou número.
- `name`: texto simples de até 64 caracteres.
- `palette`: deve conter as oito cores `background`, `surface`, `raised`, `border`, `accent`, `accentStrong`, `text` e `muted`.
- Cada cor deve usar hexadecimal de seis dígitos, como `#bd7b42`.

### Campos da moldura

- `id` e `name`: identificador e nome do estilo.
- `style`: `none`, `solid`, `double`, `dashed`, `dotted`, `groove` ou `ridge`.
- `color` e `innerColor`: cores hexadecimais `#RRGGBB`.
- `width`: 0–16 px.
- `radius`: 0–48 px.
- `inner`: `true` ou `false`, ativa ou desativa a linha interna.
- `innerWidth`: 0–8 px.
- `innerGap`: 0–24 px.

## Limites e validação

- Tamanho máximo do arquivo: **512 KB**.
- Total máximo: **100 estilos** somando temas e molduras.
- `kind: "theme"` exige ao menos um tema e não aceita molduras.
- `kind: "border"` exige ao menos uma moldura e não aceita temas.
- `kind: "collection"` exige ao menos um tema e uma moldura.
- IDs duplicados dentro da mesma lista são rejeitados.
- Propriedades extras ou desconhecidas são rejeitadas; o formato aceita somente as chaves previstas.

> [!warning] O pacote é data-only
> O Forge não executa conteúdo importado. O importador rejeita CSS, HTML, SVG, scripts, URLs, manipuladores de eventos, expressões e propriedades arbitrárias. Um `.forgestyle` não é um meio de instalar snippets ou executar código no Vault.

## Resolver conflitos durante a importação

Após escolher o arquivo, o Forge valida o pacote e abre a janela **Import style package**. Cada tema e moldura recebe uma linha com prévia, nome e ação de importação.

| Ação | Quando aparece | Resultado |
|---|---|---|
| **Add to library** | Não existe conflito | Adiciona o estilo à biblioteca. |
| **Keep both (import as copy)** | Existe conflito | Mantém o estilo atual e importa uma cópia com nome/ID únicos. É a escolha inicial. |
| **Replace matching style** | Existe conflito | Substitui a entrada correspondente, preservando o ID local da entrada substituída. |
| **Skip this style** | Sempre | Não importa aquela entrada. |

Um conflito ocorre quando o ID é igual ou o nome coincide sem diferenciar maiúsculas/minúsculas. Em cópias, o Forge sugere ` (Imported)` e gera IDs únicos quando necessário. O nome pode ser editado antes de confirmar; o limite é 64 caracteres.

A importação pode misturar decisões: por exemplo, copiar um tema, substituir uma moldura e ignorar outro tema. Se nenhum estilo for selecionado para importação, a biblioteca não é alterada.

## Biblioteca, Template e snapshots

A biblioteca de configurações guarda estilos reutilizáveis. Quando um tema ou uma moldura é aplicado a um Template, o Template também guarda um snapshot dos dados necessários para manter sua aparência.

Isso tem consequências importantes:

- remover um tema da biblioteca não apaga a cópia já armazenada em um Template;
- remover uma moldura da biblioteca não desativa a moldura já salva em um Template;
- importar um estilo adiciona a entrada à biblioteca, mas não aplica automaticamente o estilo a todos os Templates;
- é necessário selecionar o estilo no Template para usá-lo ali.

A moldura do Token e a aparência individual dos blocos são configurações diferentes e não fazem parte do `.forgestyle`.

## Fluxo recomendado para compartilhar

1. Na instalação de origem, abra **Settings → Style library**.
2. Clique em **Export style library**, ou exporte um tema/moldura individual em **Appearance**.
3. Envie o arquivo `.forgestyle` junto com uma breve descrição do estilo.
4. Na instalação de destino, abra **Import .forgestyle**.
5. Revise cada prévia e conflito; use **Keep both** para experimentar sem substituir a biblioteca atual.
6. Abra o Template desejado e selecione o tema ou moldura recém-importado.
7. Salve o Template.

## Veja também

- [[17 - Temas prontos]] — presets incluídos.
- [[18 - Criar e personalizar temas]] — temas personalizados e snapshots.
- [[19 - Moldura externa]] — criação e uso de molduras.
- [[20 - Moldura da arte do Token]] — aro que não é exportado em `.forgestyle`.
