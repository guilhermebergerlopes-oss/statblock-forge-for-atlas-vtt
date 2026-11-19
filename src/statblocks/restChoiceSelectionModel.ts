import type { RecoveryChoice } from '../templates/recoveryEditorModel.ts';

/** Number of times each action was selected in each player-choice step. */
export type RestChoiceDraft = Readonly<Record<string, Readonly<Record<string, number>>>>;

export interface RestChoicePick {
  choice: string;
  action: string;
  /** The action is being taken for another character; Forge intentionally leaves this statblock unchanged. */
  forOther?: boolean;
}

export interface RestChoiceOrderEntry {
  choice: string;
  action: string;
}

export function restChoiceActionCount(draft: RestChoiceDraft, choiceId: string, actionId: string): number {
  const count = draft[choiceId]?.[actionId] ?? 0;
  return Number.isInteger(count) && count > 0 ? count : 0;
}

/**
 * Changes one action's selected count without crossing the step's maximum. Non-repeating steps
 * treat an action as a checkbox; repeating steps allow the same action to be picked more than once.
 */
export function setRestChoiceActionCount(
  draft: RestChoiceDraft,
  choice: RecoveryChoice,
  actionId: string,
  count: number,
): RestChoiceDraft {
  if (!choice.actions.some((action) => action.id === actionId)) return draft;
  const current = draft[choice.id] ?? {};
  const normalized = choice.repeat === true
    ? Math.max(0, Math.min(choice.max, Math.trunc(Number.isFinite(count) ? count : 0)))
    : count > 0 ? 1 : 0;
  const totalWithoutAction = Object.entries(current)
    .filter(([id]) => id !== actionId)
    .reduce((sum, [, value]) => sum + (Number.isInteger(value) && value > 0 ? value : 0), 0);
  const nextCount = Math.min(normalized, Math.max(0, choice.max - totalWithoutAction));
  const nextChoice = { ...current };
  if (nextCount > 0) nextChoice[actionId] = nextCount;
  else delete nextChoice[actionId];
  return { ...draft, [choice.id]: nextChoice };
}

/** Whether the selected actions meet every step's min/max and repetition rules. */
export function isRestChoiceDraftValid(choices: readonly RecoveryChoice[], draft: RestChoiceDraft): boolean {
  const knownChoices = new Set(choices.map((choice) => choice.id));
  if (Object.keys(draft).some((choiceId) => !knownChoices.has(choiceId))) return false;

  return choices.every((choice) => {
    const selected = draft[choice.id] ?? {};
    const knownActions = new Set(choice.actions.map((action) => action.id));
    if (Object.keys(selected).some((actionId) => !knownActions.has(actionId))) return false;
    const counts = Object.values(selected);
    if (counts.some((count) => !Number.isInteger(count) || count < 1)) return false;
    if (choice.repeat !== true && counts.some((count) => count > 1)) return false;
    const total = counts.reduce((sum, count) => sum + count, 0);
    return total >= choice.min && total <= choice.max;
  });
}

/** Validates the expanded request independently of the UI draft. */
export function isRestChoicePicksValid(choices: readonly RecoveryChoice[], picks: readonly RestChoicePick[]): boolean {
  const byId = new Map(choices.map((choice) => [choice.id, choice]));
  const selectedByChoice = new Map<string, string[]>();

  for (const pick of picks) {
    const choice = byId.get(pick.choice);
    const action = choice?.actions.find((candidate) => candidate.id === pick.action);
    if (!choice || !action || (pick.forOther === true && action.forOthers !== true)) return false;
    const selected = selectedByChoice.get(choice.id) ?? [];
    selected.push(action.id);
    selectedByChoice.set(choice.id, selected);
  }

  return choices.every((choice) => {
    const selected = selectedByChoice.get(choice.id) ?? [];
    if (selected.length < choice.min || selected.length > choice.max) return false;
    return choice.repeat === true || new Set(selected).size === selected.length;
  });
}

/** Converts the UI draft to Atlas' ordered list of choice/action pairs. */
export function restChoicePicks(
  choices: readonly RecoveryChoice[],
  draft: RestChoiceDraft,
  order?: readonly RestChoiceOrderEntry[],
): RestChoicePick[] {
  const remaining = new Map<string, number>();
  for (const choice of choices) {
    for (const action of choice.actions) {
      remaining.set(`${choice.id}\u0000${action.id}`, restChoiceActionCount(draft, choice.id, action.id));
    }
  }

  const picks: RestChoicePick[] = [];
  for (const entry of order ?? []) {
    const key = `${entry.choice}\u0000${entry.action}`;
    const count = remaining.get(key) ?? 0;
    if (count <= 0) continue;
    picks.push({ choice: entry.choice, action: entry.action });
    remaining.set(key, count - 1);
  }

  // Keep backward-compatible deterministic ordering for callers without a UI selection log,
  // and recover any missing order entries if a caller supplies a stale/partial log.
  for (const choice of choices) {
    for (const action of choice.actions) {
      const key = `${choice.id}\u0000${action.id}`;
      const count = remaining.get(key) ?? 0;
      for (let index = 0; index < count; index += 1) picks.push({ choice: choice.id, action: action.id });
    }
  }
  return picks;
}
