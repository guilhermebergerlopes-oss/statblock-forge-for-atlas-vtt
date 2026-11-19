---
title: Statblock Forge — Enquadramento na ficha
aliases:
  - Zoom e pan da imagem em uso
  - Live image framing
tags:
  - statblock-forge
  - documentação/aparência
parte: 3
---

# Enquadramento na ficha

Além do enquadramento padrão definido no Template, o Forge permite ampliar e reposicionar uma imagem diretamente no statblock em uso. Esse ajuste é local àquela ficha e àquele bloco Image; ele não altera o Template nem o arquivo de imagem.

## Zoom com a roda do mouse

Posicione o cursor sobre uma imagem carregada e use:

| Entrada | Ação |
|---|---|
| Roda sem modificadores | Rola o statblock verticalmente. |
| `Alt` + roda | Rola o statblock horizontalmente. |
| `Ctrl` + roda para cima | Aumenta o zoom da imagem em 10 pontos percentuais. |
| `Ctrl` + roda para baixo | Reduz o zoom da imagem em 10 pontos percentuais. |

O zoom varia de **100% a 300%**. Em 100%, a imagem está no tamanho mínimo; em 300%, está no limite máximo. Quando o limite é atingido, a roda deixa de alterar a imagem e pode continuar sendo usada para rolar o statblock. O atalho de imagem é `Ctrl` + roda sem `Alt` ou `Meta`.

## Reposicionar a imagem

Quando o zoom está acima de 100%, pressione o botão principal do mouse e arraste a imagem para mover o conteúdo visível dentro do quadro.

- Em 100%, o arraste é desativado porque não existe área ampliada adicional para deslocar.
- O Forge limita o movimento à área excedente criada pelo zoom.
- A janela do bloco permanece preenchida; o arraste não deve revelar espaços vazios fora da imagem.
- Ao cancelar a interação (por exemplo, quando o pointer é cancelado), o movimento incompleto é revertido.

O foco horizontal/vertical definido no Template continua sendo a referência-base. O arraste durante o uso adiciona um ajuste local da ficha.

## Salvamento automático

O enquadramento local é salvo automaticamente após alterar zoom ou concluir um arraste. O Forge agrupa gravações muito próximas para evitar escrever o arquivo a cada movimento do ponteiro. Não é necessário alterar o Value do Field nem salvar o Template.

Cada registro é associado ao **ID do bloco Image**, não somente à Key do Field. Portanto, se a mesma imagem ou Field for apresentado em dois blocos diferentes, cada bloco pode ter um enquadramento local próprio.

### Notas Markdown

O Forge armazena os ajustes no frontmatter da nota, sob a chave `statblock-forge-image-frames`:

```yaml
---
statblock-forge-image-frames:
  image-block-uuid:
    zoom: 140
    x: 44
    y: 62
---
```

`image-block-uuid` representa o ID real do bloco no Template. O exemplo é ilustrativo; não copie esse identificador literalmente para outra ficha.

### Fontes JSON

Para um JSON simples, a propriedade fica na raiz. Se o arquivo usa o envelope `statblock-forge-data`, ela fica dentro de `data`:

```json
{
  "statblock-forge-image-frames": {
    "image-block-uuid": {
      "zoom": 140,
      "x": 44,
      "y": 62
    }
  }
}
```

Cada frame contém `zoom`, `x` e `y`. O Forge normaliza os valores para zoom entre 100 e 300 e coordenadas entre 0 e 100. `50/50` é o centro neutro para o ajuste local.

## Template versus ficha

| Ajuste | Onde fica salvo | Quem recebe |
|---|---|---|
| Zoom/foco no inspetor do Image Field | Layout Forge do Template | Prévia e fichas que usam o Template como referência. |
| Zoom/arraste durante o uso | Metadados `statblock-forge-image-frames` da ficha | Apenas aquela instância e aquele bloco. |
| Caminho/Value da imagem | Value do Image Field | A ficha que contém esse Value, salvo quando o Template fixa a imagem. |

O ajuste local não altera a imagem de exemplo do Template, não move pixels no arquivo original e não substitui o Value de imagem. Uma ficha diferente mantém seu próprio enquadramento.

> [!tip] Fluxo recomendado
> Acerte o enquadramento geral no Template primeiro. Depois use `Ctrl` + roda e arraste no statblock somente para correções específicas de uma criatura ou personagem.

## Restrições

- O enquadramento em uso exige uma imagem que tenha sido carregada com sucesso.
- Sem zoom acima de 100%, não há arraste local.
- O ajuste é limitado para preservar o preenchimento do quadro.
- Se a imagem/Field for fixado pelo Template, o Value não pode ser substituído ou removido no statblock; o enquadramento continua sendo um dado separado.

## Veja também

- [[22 - Fields de imagem e enquadramento]] — enquadramento padrão e Samples.
- [[20 - Moldura da arte do Token]] — Token art e seu aro separado.
