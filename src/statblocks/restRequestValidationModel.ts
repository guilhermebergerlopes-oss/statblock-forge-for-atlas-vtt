import type { ForgeTemplate, JsonRecord } from '../templates/forgeTemplate.ts';
import type { RecoveryButton } from '../templates/recoveryEditorModel.ts';
import { isRestChoicePicksValid, type RestChoicePick } from './restChoiceSelectionModel.ts';
import { restCounterSpendOptions } from './restRecoveryModel.ts';
import type { AtlasRestResourceSnapshot } from '../atlas/atlasRestResources.ts';

export type RestRequestValidationIssue =
  | { kind: 'invalid-choices' }
  | { kind: 'unknown-spend'; ref: string }
  | { kind: 'invalid-spend'; ref: string }
  | { kind: 'spend-exceeds-available'; ref: string; requested: number; available: number }
  | { kind: 'spend-offer-changed'; expected: readonly string[]; received: readonly string[] };

/**
 * Rebuilds the Rest offer from the latest statblock values and checks the submitted request
 * against it, following Atlas restOffers()/checkRest(). Missing spends are not silently treated
 * as zero: the chooser materializes a zero value for each offered Spend rule.
 */
export function validateRestRequest(input: {
  template: ForgeTemplate;
  data: JsonRecord;
  button: RecoveryButton;
  picks: readonly RestChoicePick[];
  spends: ReadonlyMap<string, number>;
  collectionResources?: readonly AtlasRestResourceSnapshot[];
}): RestRequestValidationIssue | null {
  const choices = input.button.choices ?? [];
  if (!isRestChoicePicksValid(choices, input.picks)) return { kind: 'invalid-choices' };

  const offers = restCounterSpendOptions({
    template: input.template,
    data: input.data,
    button: input.button,
    picks: input.picks,
    collectionResources: input.collectionResources,
  });
  const byRef = new Map(offers.map((offer) => [offer.ref, offer]));
  const expected = offers.map((offer) => offer.ref).sort();
  const received = [...input.spends.keys()].sort();
  if (expected.length !== received.length || expected.some((ref, index) => ref !== received[index])) {
    const unknown = received.find((ref) => !byRef.has(ref));
    if (unknown) return { kind: 'unknown-spend', ref: unknown };
    return { kind: 'spend-offer-changed', expected, received };
  }

  for (const [ref, requested] of input.spends) {
    const offer = byRef.get(ref);
    if (!offer) return { kind: 'unknown-spend', ref };
    if (!Number.isSafeInteger(requested) || requested < 0) return { kind: 'invalid-spend', ref };
    if (requested > offer.max) {
      return { kind: 'spend-exceeds-available', ref, requested, available: offer.max };
    }
  }
  return null;
}

export function restRequestValidationMessage(
  issue: RestRequestValidationIssue,
  language: 'en' | 'pt-BR',
): string {
  const pt = language === 'pt-BR';
  switch (issue.kind) {
    case 'invalid-choices':
      return pt
        ? 'As escolhas do descanso não são mais válidas. Confira os limites e as ações selecionadas.'
        : 'The Rest choices are no longer valid. Check the pick limits and selected actions.';
    case 'unknown-spend':
      return pt
        ? `O gasto "${issue.ref}" não pertence mais a esta oferta de descanso. Reabra o painel e confira as escolhas.`
        : `Spend "${issue.ref}" is no longer part of this Rest offer. Reopen the panel and review the choices.`;
    case 'invalid-spend':
      return pt
        ? `A quantidade do gasto "${issue.ref}" precisa ser um número inteiro não negativo.`
        : `Spend "${issue.ref}" must be a non-negative whole number.`;
    case 'spend-exceeds-available':
      return pt
        ? `O gasto "${issue.ref}" solicita ${issue.requested}, mas agora só há ${issue.available} disponível. Ajuste o gasto e tente novamente.`
        : `Spend "${issue.ref}" requests ${issue.requested}, but only ${issue.available} is currently available. Adjust the spend and try again.`;
    case 'spend-offer-changed':
      return pt
        ? 'Os gastos disponíveis mudaram desde que o painel foi aberto. Reabra o descanso e faça as escolhas novamente.'
        : 'The available spends changed after the panel was opened. Reopen the Rest chooser and make the choices again.';
  }
}
