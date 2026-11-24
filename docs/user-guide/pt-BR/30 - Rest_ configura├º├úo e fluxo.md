---
title: "Statblock Forge — Rest: configuração e fluxo"
aliases:
  - Descanso e recuperação
  - Rest actions
tags:
  - statblock-forge
  - documentação/recursos-avançados
  - documentação/rest
parte: 4
---

# Rest: configuração e fluxo

**Rest** permite que um Template ofereça ações de descanso para recuperar Resources, recuperar usos de Counters e definir valores. A configuração pertence ao Template; os efeitos são calculados com os Values e estados da ficha que está executando o descanso.

Rest não é um cronômetro nem um descanso automático baseado em tempo. É um conjunto configurável de ações, regras e escolhas que o usuário aciona na ficha.

## Onde configurar

1. Abra o Template no editor do Forge.
2. Na barra de ações do Canvas, selecione **Rest**.
3. No painel lateral, configure os botões de descanso.
4. Dentro de cada botão, configure as regras sempre aplicadas e, quando necessário, as etapas de **Player choices**.
5. Salve o Template.

O editor mantém os registros reconhecidos e preserva propriedades ou entradas desconhecidas do JSON de recuperação. Se aparecer um aviso de entradas incompletas ou não reconhecidas, confira o diagnóstico e use **Edit JSON** para reparar o conteúdo original; não presuma que o Forge interpretou uma regra que ele sinalizou como desconhecida.

## Botões Rest

Um Template pode ter até **6 botões Rest**. Cada botão tem um nome, uma lista de regras diretas e, opcionalmente, etapas de escolha. Use nomes que descrevam a ação disponível, por exemplo:

- **Short Rest** — recuperação limitada entre encontros.
- **Long Rest** — recuperação ampla ao final de uma jornada.
- **Downtime** — escolhas de estudo, reparo ou recuperação durante um intervalo.

Os botões podem ser reordenados pelas setas para cima e para baixo. A ordem aparece nos seletores de Counter que associam linhas a botões Rest. As associações são armazenadas por IDs estáveis, não pelo texto visível do nome.

## Regras diretas e regras de ações

As regras colocadas diretamente em **Rules** são sempre executadas quando o botão é confirmado. Uma regra dentro de uma ação de **Player choices** só é executada quando aquela ação é selecionada.

Isso permite combinar efeitos fixos e opcionais. Por exemplo, um descanso pode sempre recuperar 1 ponto de Focus e, além disso, permitir escolher entre **Study**, **Repair** ou **Recover**.

Cada botão aceita até **16 regras diretas**. Cada ação aceita até **16 regras próprias**. As operações e seus alvos são explicados em [[31 - Regras e fórmulas de Rest]].

## Quando aparece o seletor

O botão executa diretamente quando não tem etapas de escolha e nenhuma regra Spend que exija quantidade a selecionar.

O seletor de Rest é aberto quando o botão tem pelo menos uma etapa de **Player choices** ou uma regra **Spend another resource**. No seletor, o usuário escolhe as ações e informa quanto deseja gastar de cada origem disponível. O botão **Confirm** só fica disponível quando todas as etapas respeitam os limites mínimos e máximos.

O seletor é um painel temporário ancorado ao botão. Ele pode ser fechado por **Cancel**, pelo botão de fechar, clicando fora ou pressionando `Esc`. Fechar sem confirmar não aplica o descanso.

## Onde o Rest aparece na ficha

Os botões configurados aparecem abaixo do conteúdo do statblock. O Forge não exibe um painel de Conditions: as Conditions dos Tokens são configuradas e aplicadas diretamente no Atlas. Consulte [[29 - Conditions]] para abrir o catálogo da coleção e o submenu do Token.

As regras Rest do Forge só modificam Resources e Counters compatíveis. Elas não alteram Conditions nativas do Atlas.

## Limites de configuração

| Elemento | Limite |
|---|---:|
| Botões Rest por Template | 6 |
| Regras diretas por botão | 16 |
| Etapas de Player choices por botão | 8 |
| Ações por etapa | 8 |
| Regras por ação | 16 |
| Seleções por etapa | 0 a 6 |
| Nome do botão e prompt da etapa | 100 caracteres |
| Descrição de uma ação | 400 caracteres |
| Fórmula de Rest | 100 caracteres |

Sem repetição, uma ação só pode ser selecionada uma vez e o máximo não pode exceder o número de ações disponíveis. Com **Allow the same action more than once**, a mesma ação pode ocupar várias seleções, até o máximo de seis.

## Fluxo de execução

1. O usuário aciona um botão Rest na ficha.
2. Se houver etapas de escolha ou gastos, o seletor solicita as escolhas e quantidades.
3. O Forge lê novamente os dados atuais da nota e valida o pedido. Isso evita aplicar escolhas feitas com valores que ficaram desatualizados enquanto o seletor estava aberto.
4. O cálculo aplica primeiro as regras diretas do botão e depois as regras das ações selecionadas, respeitando a ordem das escolhas.
5. Resources locais e Counters são gravados na ficha. Um Resource de coleção Atlas é gravado no estado do personagem/Token Atlas correspondente. Antes da primeira gravação no Atlas, o Forge valida os stores envolvidos e confirma que os valores ainda correspondem ao snapshot usado no cálculo.
6. O modal de resultado mostra as rolagens, gastos, alterações de Counters e Resources e as regras que foram ignoradas.

As gravações de Resources do Atlas usam uma transação compensatória, não uma transação de banco de dados compartilhada entre sistemas. Se uma gravação posterior falhar, o Forge tenta restaurar somente as entradas alteradas por aquele descanso. Valores que permaneceram intactos são ignorados, e edições feitas por outra operação não são sobrescritas. Conflitos no rollback são informados junto ao erro original.

Uma regra inválida não impede necessariamente as demais regras válidas de serem calculadas. O resumo identifica os alvos ou fórmulas que não puderam ser aplicados.

## Persistência e compatibilidade

A configuração dos botões fica na propriedade `recovery` do Template, usando o formato de recuperação compatível com Atlas. Conditions não fazem parte do layout nem do modelo de Rest do Forge; são configuradas nas regras da coleção Atlas.

Na ficha, Values de Counters e Resources locais são salvos nos Fields/estado de tracking correspondentes. Conditions pertencem ao estado dos Tokens no Atlas. Resources pertencentes a uma coleção Atlas continuam sob responsabilidade do Atlas e exigem contexto Atlas compatível para serem gravados.

O editor preserva propriedades e registros de recuperação que não reconhece. Regras antigas de Condition (`step`/`clear`) não são executadas pelo Forge e permanecem no JSON para inspeção; use as Conditions nativas do Atlas.

## Exemplo de desenho: Short Rest e Long Rest

Considere um personagem com `hp` rastreado, um Field `mana` configurado como Resource e um Field `counter` chamado `abilities`:

- **Short Rest:** uma regra direta recupera `1d8` de `hp`; outra regra recupera metade do máximo de `mana`, arredondando para baixo. Uma regra de Counter pode recuperar apenas linhas marcadas para Short Rest.
- **Long Rest:** recupera `hp` até o máximo e recupera linhas de Counter marcadas para Long Rest. Como as linhas podem ser associadas a mais de um botão, configure a associação para refletir quais descansos podem recuperá-las.
- **Downtime:** sempre recupera um Resource pequeno e abre uma etapa com `min = 1`, `max = 1`; o usuário escolhe **Study**, **Repair** ou **Recover** e cada ação aplica suas próprias regras.

Os nomes e efeitos são exemplos de configuração; os resultados dependem dos Fields, tracking, Counters e fórmulas definidos no Template.

## Diagnóstico rápido

| Sintoma | O que conferir |
|---|---|
| O botão não aparece | Confirme que o Template tem um botão Rest reconhecido e que o statblock está usando esse Template. |
| O botão executa sem abrir o seletor | Verifique se há uma etapa de escolha ou regra Spend reconhecida. |
| Uma etapa não permite confirmar | Confira `Minimum picks`, `Maximum picks`, quantidade de ações e a opção de repetição. |
| Uma Condition não aparece no Token | Confira o catálogo **Conditions** nas configurações da coleção Atlas e aplique a Condition pelo menu de contexto do Token. |
| Uma regra aparece como ignorada | Consulte o motivo no resultado; confira alvo, tracking, fórmula, referência e contexto Atlas. |
| Um Resource da coleção não muda | Confirme vínculo com o personagem Atlas e se existe um mapa Atlas aberto com o estado atual do Resource. |

## Veja também

- [[31 - Regras e fórmulas de Rest]] — operações, alvos, fórmulas e exemplos.
- [[32 - Escolhas e ações de Rest]] — etapas, limites, seleção e ações para aliados.
- [[28 - Counters]] — linhas, usos, `reset` e `regain`.
- [[29 - Conditions]] — catálogo e estado dos Tokens gerenciados pelo Atlas.
- [[27 - Dice Fields e Set Dice]] — notação de dados e conjuntos de rolagem.
