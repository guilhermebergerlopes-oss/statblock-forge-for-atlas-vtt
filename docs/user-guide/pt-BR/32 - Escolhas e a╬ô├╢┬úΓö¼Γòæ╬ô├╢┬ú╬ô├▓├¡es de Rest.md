---
title: Statblock Forge — Escolhas e ações de Rest
aliases:
  - Player choices de Rest
  - Ações condicionais de descanso
tags:
  - statblock-forge
  - documentação/recursos-avançados
  - documentação/rest
parte: 4
---

# Escolhas e ações de Rest

**Player choices** permite que um botão Rest apresente alternativas antes da execução. Cada etapa tem uma pergunta, limites de seleção e uma lista de ações. Cada ação pode conter regras próprias; essas regras só participam do descanso quando a ação é escolhida.

Use etapas quando um descanso oferecer opções como estudar, fabricar, tratar um aliado ou escolher uma atividade. Não crie uma etapa apenas para uma regra que sempre deve acontecer: coloque esse efeito diretamente em **Rules** no botão Rest.

## Estrutura: botão, etapa, ação e regra

A hierarquia é:

```text
Rest button
├── Direct rules (always applied)
└── Player choices
    ├── Step 1 (prompt and pick limits)
    │   ├── Action A
    │   │   └── Action rules
    │   └── Action B
    │       └── Action rules
    └── Step 2
        └── Actions...
```

- **Rest button:** define a ação principal e as regras diretas.
- **Choice step:** apresenta uma pergunta e limita quantas ações podem ser selecionadas.
- **Action:** opção apresentada dentro de uma etapa, com nome, descrição e regras próprias.
- **Action rule:** altera Resource ou Counter quando aquela ação é aplicada ao personagem que está descansando.

## Criar etapas

No editor do Template, abra **Rest**, escolha o botão e use **Add choice step**. Configure:

- **Prompt:** pergunta mostrada no seletor. Deve ser clara e contextual.
- **Minimum picks:** quantidade mínima de escolhas exigidas; pode ser 0.
- **Maximum picks:** quantidade máxima de escolhas; de 1 a 6.
- **Allow the same action more than once:** permite escolher repetidamente a mesma ação dentro da etapa.

Um botão aceita até **8 etapas**. Cada etapa aceita até **8 ações**. Se a repetição estiver desativada, o máximo de seleções não pode ultrapassar o número de ações disponíveis; uma mesma ação funciona como uma opção única. Se a repetição estiver ativada, o usuário pode selecionar a mesma ação mais de uma vez, mas o máximo continua sendo 6.

### Exemplos de limites

| Ações disponíveis | Repetição | Minimum | Maximum | Resultado |
|---:|---|---:|---:|---|
| 3 | Não | 1 | 1 | Escolher exatamente uma das três ações. |
| 3 | Não | 0 | 2 | Escolher nenhuma, uma ou duas ações diferentes. |
| 2 | Sim | 0 | 6 | Repetir uma ação ou combinar as duas, até seis seleções. |
| 4 | Sim | 2 | 3 | Fazer duas ou três seleções, incluindo repetições. |

Ao remover uma ação ou desativar repetição, o Forge normaliza os limites para que a etapa continue válida. Confira `Minimum picks` e `Maximum picks` depois de alterar a lista.

## Configurar ações

Use **Add action** dentro de uma etapa. Cada ação tem:

- **Name:** nome apresentado ao jogador;
- **Description:** texto opcional de até 400 caracteres;
- **May be taken for another character:** permite marcar a escolha como destinada a outra personagem;
- **Action rules:** até 16 regras aplicadas quando a ação é escolhida para o personagem atual.

Uma etapa precisa ter pelo menos uma ação para ser executável. Cada ação pode não ter regras — por exemplo, uma escolha narrativa ou de organização — ou pode ter regras de recuperação/gasto conforme [[31 - Regras e fórmulas de Rest]].

## Como as escolhas são apresentadas

O seletor aparece ancorado ao botão Rest. Para cada etapa, mostra o prompt, o progresso de seleção e as ações:

- Sem repetição: cada ação tem uma caixa de seleção.
- Com repetição: cada ação tem um controle `−`, contador e `+`.
- A quantidade selecionada em uma etapa não pode ultrapassar `Maximum picks`.
- O botão de confirmação permanece desabilitado enquanto alguma etapa não cumprir `Minimum picks`/`Maximum picks`.
- `Esc`, **Cancel**, o botão de fechar ou um clique fora do seletor fecha sem executar o descanso.

Se as regras diretas do botão ou as ações selecionadas incluírem **Spend another resource**, o seletor também apresenta os controles de gasto. O gasto disponível é calculado a partir do saldo atual da origem e de **Maximum spent**, quando configurado.

## Ordem das escolhas

O Forge mantém a ordem em que as ações foram selecionadas para montar a solicitação de Rest. Isso é relevante quando várias ações têm regras que usam Resources/Counters ou quando mais de uma ação consome o mesmo recurso.

Se uma seleção for removida, as seleções restantes mantêm sua ordem relativa. Os valores de gasto associados às demais ações são remapeados para as novas posições; o Forge não deve transferir o gasto de uma ação para outra só porque o índice mudou.

## Ações para outro personagem

Quando **May be taken for another character** está habilitado, o seletor mostra **For** com duas opções:

- **This character:** as regras da ação podem ser aplicadas à ficha que está descansando.
- **Another character:** registra a escolha como destinada a um aliado.

> [!important] Não altera outra ficha automaticamente
> Marcar **Another character** não localiza outra nota, não procura outro statblock e não grava valores em outra personagem. A seleção é registrada no resumo como ação para outra pessoa, e as regras daquela ação não são aplicadas à ficha atual. Para recuperar outra ficha, abra o statblock correspondente e execute o Rest nele.

Se a mesma ação puder ser repetida, a seleção **For** determina o destino da ação selecionada; a ação marcada para outro personagem não gasta Resources/Counters da ficha atual nem aplica suas regras nela.

## Regras diretas versus regras de ação

Considere um botão **Downtime**:

- Regra direta: recupera sempre 1 ponto de `focus`.
- Etapa: prompt **How did you spend your downtime?**
- Ação **Study:** aplica uma regra que recupera `1d4` de `mana`.
- Ação **Repair:** aplica uma regra que recupera 2 pontos de um Resource apropriado.
- Ação **Recover:** aplica uma regra que recupera um Resource ou usos de Counter.

Se o jogador escolhe **Study**, a regra direta e as regras de Study são aplicadas. As regras de Repair e Recover não são executadas.

Para exigir exatamente uma ação, configure `Minimum picks = 1` e `Maximum picks = 1`. Para permitir pular a etapa, use `Minimum picks = 0`.

## Gastos por escolha

Uma ação pode incluir uma regra Spend. Quando a ação é selecionada para o personagem atual, o seletor pergunta quantas unidades gastar. A quantidade não pode exceder:

1. o saldo disponível na origem;
2. o limite **Maximum spent**, se definido;
3. os limites atuais da etapa e da solicitação.

A ação selecionada para **Another character** não oferece gasto contra a ficha atual, pois suas regras não são aplicadas a essa ficha. Consulte [[31 - Regras e fórmulas de Rest]] para entender como o valor **Per unit** é combinado e aplicado.

## Exemplo completo: descanso de acampamento

**Botão:** `Camp Rest`

**Regra direta:** `Restore formula` no Resource `hp`, fórmula `1d6`.

**Etapa 1 — Prompt:** `What do you do during the watch?`

- `Minimum picks = 1`
- `Maximum picks = 1`
- Repetição desativada.

**Ações:**

- **Study the map:** regra `Set value` ou `Restore formula` sobre um Resource de preparação.
- **Treat wounds:** regra `Restore formula` para recuperar `1d4` de um Resource de cura.
- **Watch over an ally:** marque **May be taken for another character**. Quando o usuário escolhe **Another character**, o Forge registra a intenção, mas não altera automaticamente a ficha do aliado.

Resultado: a regra direta de HP sempre roda; apenas as regras da ação selecionada para o personagem atual são aplicadas.

## Veja também

- [[30 - Rest: configuração e fluxo]] — limites gerais e fluxo de execução.
- [[31 - Regras e fórmulas de Rest]] — operações, fórmulas e regras de gasto.
- [[28 - Counters]] — uso de Counters em regras de descanso.
