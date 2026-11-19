import { cloneJson, newBlockId, isRecord, type ForgeBlock, type ForgeField, type ForgeTemplate, type JsonRecord } from './forgeTemplate.ts';
import { forgeTrackedResourceDefinitionsFor } from '../statblocks/forgeResourceValues.ts';

export const MAX_RECOVERY_BUTTONS = 6;
export const MAX_RECOVERY_RULES = 16;
export const MAX_RECOVERY_CHOICES = 8;
export const MAX_RECOVERY_ACTIONS = 8;
/** A player may pick no more than six actions in one choice step (Atlas native limit). */
export const MAX_ACTION_PICKS = 6;
export const MAX_RECOVERY_TEXT = 100;
export const MAX_ACTION_TEXT = 400;
export const MAX_RECOVERY_NUMBER = 1_000_000;
export const MAX_RECOVERY_FORMULA_LENGTH = 100;

export type RecoveryResourceTarget = { kind: 'resource'; field: string };
export type RecoveryCountersTarget = { kind: 'counters'; field: string; rows: 'all' | string[] };
export type RecoveryMetricTarget = RecoveryResourceTarget | RecoveryCountersTarget;

export type RecoveryRule =
  | { target: RecoveryMetricTarget; does: 'full' }
  | { target: RecoveryMetricTarget; does: 'amount'; formula: string; min?: number }
  | { target: RecoveryMetricTarget; does: 'share'; share: 0.25 | 0.5; round: 'down' | 'up'; min?: number }
  | { target: RecoveryMetricTarget; does: 'set'; to: number | { field: string } }
  | { target: RecoveryMetricTarget; does: 'spend'; from: RecoveryMetricTarget; each: string; most?: number };

export interface RecoveryAction extends JsonRecord {
  id: string;
  name: string;
  text?: string;
  rules: RecoveryRule[];
  forOthers?: true;
}

export interface RecoveryChoice extends JsonRecord {
  id: string;
  prompt: string;
  min: number;
  max: number;
  repeat?: true;
  actions: RecoveryAction[];
}

/** Maximum picks a step can offer: one per action unless repeated picks are enabled. */
export function recoveryChoicePickCapacity(choice: Pick<RecoveryChoice, 'repeat' | 'actions'>): number {
  const available = choice.repeat === true ? MAX_ACTION_PICKS : choice.actions.length;
  return Math.max(1, Math.min(MAX_ACTION_PICKS, available));
}

function boundedPickCount(value: number, fallback: number, minimum: number, maximum: number): number {
  const integer = Number.isFinite(value) ? Math.trunc(value) : fallback;
  return Math.max(minimum, Math.min(maximum, integer));
}

/** Keeps an edited step valid after action removal or disabling repeated picks. */
export function normalizeRecoveryChoicePickLimits(choice: RecoveryChoice): RecoveryChoice {
  const capacity = recoveryChoicePickCapacity(choice);
  const max = boundedPickCount(choice.max, 1, 1, capacity);
  const min = boundedPickCount(choice.min, 0, 0, max);
  return min === choice.min && max === choice.max ? choice : { ...choice, min, max };
}

/**
 * Updates one pick limit without creating the invalid intermediate state min > max.
 * Raising the minimum raises the maximum when possible; lowering the maximum lowers
 * the minimum. Both remain within the action/repeat capacity Atlas supports.
 */
export function withRecoveryChoicePickLimit(
  choice: RecoveryChoice,
  limit: 'min' | 'max',
  value: number,
): RecoveryChoice {
  const current = normalizeRecoveryChoicePickLimits(choice);
  const capacity = recoveryChoicePickCapacity(current);
  if (limit === 'min') {
    const min = boundedPickCount(value, current.min, 0, capacity);
    const max = Math.max(current.max, min);
    return min === current.min && max === current.max ? current : { ...current, min, max };
  }
  const max = boundedPickCount(value, current.max, 1, capacity);
  const min = Math.min(current.min, max);
  return min === current.min && max === current.max ? current : { ...current, min, max };
}

export interface RecoveryButton extends JsonRecord {
  id: string;
  name: string;
  rules: RecoveryRule[];
  choices?: RecoveryChoice[];
}

export interface RecoveryValidationIssue {
  code: string;
  message: string;
  buttonId?: string;
}

function isShortName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_RECOVERY_TEXT;
}

function isOptionalWhole(value: unknown, minimum: number): boolean {
  return value === undefined || (typeof value === 'number' && Number.isInteger(value)
    && value >= minimum && value <= MAX_RECOVERY_NUMBER);
}

function isMetricTarget(value: unknown): boolean {
  if (!isRecord(value) || (value.kind !== 'resource' && value.kind !== 'counters') || !isShortName(value.field)) return false;
  if (value.kind !== 'counters') return true;
  if (value.rows === 'all') return true;
  if (!Array.isArray(value.rows) || !value.rows.every(isShortName)) return false;
  return new Set(value.rows).size <= MAX_RECOVERY_BUTTONS;
}

function isRecoveryRule(value: unknown): value is RecoveryRule {
  if (!isRecord(value) || !isRecord(value.target) || typeof value.does !== 'string') return false;
  if (!['full', 'amount', 'share', 'set', 'spend'].includes(value.does) || !isMetricTarget(value.target)) return false;
  if (value.does === 'amount') return typeof value.formula === 'string'
    && value.formula.trim().length > 0 && value.formula.length <= MAX_RECOVERY_FORMULA_LENGTH
    && isOptionalWhole(value.min, 0);
  if (value.does === 'share') return (value.share === 0.25 || value.share === 0.5)
    && (value.round === 'down' || value.round === 'up') && isOptionalWhole(value.min, 0);
  if (value.does === 'set') return (typeof value.to === 'number' && Number.isInteger(value.to)
    && value.to >= 0 && value.to <= MAX_RECOVERY_NUMBER)
    || (isRecord(value.to) && isShortName(value.to.field));
  if (value.does === 'spend') return isMetricTarget(value.from)
    && typeof value.each === 'string' && value.each.trim().length > 0
    && value.each.length <= MAX_RECOVERY_FORMULA_LENGTH && isOptionalWhole(value.most, 1);
  return true;
}

function parseRecoveryRule(value: unknown): RecoveryRule | undefined {
  if (!isRecoveryRule(value)) return undefined;
  const rule = cloneJson(value) as RecoveryRule;
  if (rule.target.kind === 'counters' && Array.isArray(rule.target.rows)) {
    rule.target.rows = [...new Set(rule.target.rows)];
  }
  if (rule.does === 'amount') rule.formula = rule.formula.trim();
  if (rule.does === 'spend') {
    rule.each = rule.each.trim();
    if (rule.from.kind === 'counters' && Array.isArray(rule.from.rows)) {
      rule.from.rows = [...new Set(rule.from.rows)];
    }
  }
  return rule;
}

function parseRecoveryRules(value: unknown): RecoveryRule[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((rule) => parseRecoveryRule(rule) ?? []).slice(0, MAX_RECOVERY_RULES);
}

function parseRecoveryAction(value: unknown): RecoveryAction | undefined {
  if (!isRecord(value) || !isShortName(value.id) || !isShortName(value.name)) return undefined;
  const rules = parseRecoveryRules(value.rules);
  if (!rules) return undefined;
  const action = { ...value, id: value.id, name: value.name, rules } as RecoveryAction;
  if (typeof value.text === 'string') {
    const text = value.text.trim().slice(0, MAX_ACTION_TEXT);
    if (text) action.text = text;
    else delete action.text;
  } else delete action.text;
  if (value.forOthers === true) action.forOthers = true;
  else delete action.forOthers;
  return action;
}

function parseRecoveryChoice(value: unknown, allowEmptyActions = false): RecoveryChoice | undefined {
  if (!isRecord(value) || !isShortName(value.id) || !isShortName(value.prompt)
    || !Number.isInteger(value.min) || Number(value.min) < 0 || Number(value.min) > MAX_ACTION_PICKS
    || !Number.isInteger(value.max) || Number(value.max) < 1 || Number(value.max) > MAX_ACTION_PICKS
    || !Array.isArray(value.actions)) return undefined;

  const seen = new Set<string>();
  const actions: RecoveryAction[] = [];
  for (const rawAction of value.actions) {
    const action = parseRecoveryAction(rawAction);
    if (!action || seen.has(action.id)) continue;
    seen.add(action.id);
    actions.push(action);
    if (actions.length >= MAX_RECOVERY_ACTIONS) break;
  }
  if (actions.length === 0 && !allowEmptyActions) return undefined;
  const repeat = value.repeat === true;
  const min = Number(value.min);
  const max = Number(value.max);
  if (min > max || (actions.length > 0 && !repeat && min > actions.length)) return undefined;
  const choice = {
    ...value,
    id: value.id,
    prompt: value.prompt.trim(),
    min,
    max: repeat || actions.length === 0 ? max : Math.min(max, actions.length),
    actions,
  } as RecoveryChoice;
  if (repeat) choice.repeat = true;
  else delete choice.repeat;
  return choice;
}

function parseRecoveryButton(value: unknown, allowIncompleteChoices = false): RecoveryButton | undefined {
  if (!isRecord(value) || !isShortName(value.id) || !isShortName(value.name)) return undefined;
  const rules = parseRecoveryRules(value.rules);
  if (!rules) return undefined;
  const button = { ...value, id: value.id, name: value.name.trim(), rules } as RecoveryButton;
  if (Array.isArray(value.choices)) {
    const seen = new Set<string>();
    const choices: RecoveryChoice[] = [];
    for (const rawChoice of value.choices) {
      const choice = parseRecoveryChoice(rawChoice, allowIncompleteChoices);
      if (!choice || seen.has(choice.id)) continue;
      seen.add(choice.id);
      choices.push(choice);
      if (choices.length >= MAX_RECOVERY_CHOICES) break;
    }
    if (choices.length > 0) button.choices = choices;
    else delete button.choices;
  } else delete button.choices;
  return button;
}

/**
 * Atlas-compatible tolerant reader: a button remains usable when an individual rule,
 * action or choice cannot be interpreted. Unsupported child records are omitted from
 * the editing/runtime model, while setRecoveryButtons keeps their original JSON intact.
 */
export function recoveryButtonsOf(template: ForgeTemplate): RecoveryButton[] {
  if (!Array.isArray(template.recovery)) return [];
  const seen = new Set<string>();
  const buttons: RecoveryButton[] = [];
  for (const raw of template.recovery) {
    const button = parseRecoveryButton(raw);
    if (!button || seen.has(button.id)) continue;
    seen.add(button.id);
    buttons.push(button);
    if (buttons.length >= MAX_RECOVERY_BUTTONS) break;
  }
  return buttons;
}

/** Editor reader: keeps empty/incomplete Choice Steps visible so they can be repaired in the UI. */
export function recoveryButtonsForEditing(template: ForgeTemplate): RecoveryButton[] {
  if (!Array.isArray(template.recovery)) return [];
  const seen = new Set<string>();
  const buttons: RecoveryButton[] = [];
  for (const raw of template.recovery) {
    const button = parseRecoveryButton(raw, true);
    if (!button || seen.has(button.id)) continue;
    seen.add(button.id);
    buttons.push(button);
    if (buttons.length >= MAX_RECOVERY_BUTTONS) break;
  }
  return buttons;
}

function mergeRuleRecords(raw: unknown, edited: readonly RecoveryRule[]): unknown[] {
  if (!Array.isArray(raw)) return edited.map((rule) => cloneJson(rule));
  const result: unknown[] = [];
  let editedIndex = 0;
  let recognized = 0;
  for (const item of raw) {
    if (parseRecoveryRule(item) && recognized < MAX_RECOVERY_RULES) {
      recognized += 1;
      if (editedIndex < edited.length) result.push(cloneJson(edited[editedIndex++]));
    } else result.push(cloneJson(item));
  }
  while (editedIndex < edited.length) result.push(cloneJson(edited[editedIndex++]));
  return result;
}

function mergeActionRecords(raw: unknown, edited: readonly RecoveryAction[]): unknown[] {
  if (!Array.isArray(raw)) return edited.map((action) => cloneJson(action));
  const byId = new Map(edited.map((action) => [action.id, action]));
  const used = new Set<string>();
  const result: unknown[] = [];
  let recognized = 0;
  for (const item of raw) {
    const parsed = parseRecoveryAction(item);
    if (parsed && !used.has(parsed.id) && recognized < MAX_RECOVERY_ACTIONS) {
      recognized += 1;
      used.add(parsed.id);
      const next = byId.get(parsed.id);
      if (next) {
        const merged = { ...cloneJson(item), ...cloneJson(next) } as RecoveryAction;
        merged.rules = mergeRuleRecords((item as JsonRecord).rules, next.rules) as RecoveryRule[];
        // Optional true-only flags must be explicitly removed when the editor turns
        // them off. Spreading the edited object over the raw record alone would keep
        // a previous `forOthers: true` because absence is not an overwrite.
        if (next.forOthers === true) merged.forOthers = true;
        else delete merged.forOthers;
        result.push(merged);
      }
    } else result.push(cloneJson(item));
  }
  for (const action of edited) if (!used.has(action.id)) result.push(cloneJson(action));
  return result;
}

function mergeChoiceRecords(raw: unknown, edited: readonly RecoveryChoice[]): unknown[] {
  if (!Array.isArray(raw)) return edited.map((choice) => cloneJson(choice));
  const byId = new Map(edited.map((choice) => [choice.id, choice]));
  const used = new Set<string>();
  const result: unknown[] = [];
  let recognized = 0;
  for (const item of raw) {
    const parsed = parseRecoveryChoice(item, true);
    if (parsed && !used.has(parsed.id) && recognized < MAX_RECOVERY_CHOICES) {
      recognized += 1;
      used.add(parsed.id);
      const next = byId.get(parsed.id);
      if (next) {
        const merged = { ...cloneJson(item), ...cloneJson(next) } as RecoveryChoice;
        merged.actions = mergeActionRecords((item as JsonRecord).actions, next.actions) as RecoveryAction[];
        // `repeat` is an optional true-only flag. When the checkbox is unchecked,
        // the parsed editor model omits the property; explicitly delete the raw value
        // so the next render does not turn the toggle back on.
        if (next.repeat === true) merged.repeat = true;
        else delete merged.repeat;
        result.push(merged);
      }
    } else result.push(cloneJson(item));
  }
  for (const choice of edited) if (!used.has(choice.id)) result.push(cloneJson(choice));
  return result;
}

function mergeRecoveryButton(raw: unknown, edited: RecoveryButton): RecoveryButton {
  if (!isRecord(raw)) return cloneJson(edited);
  const merged = { ...cloneJson(raw), ...cloneJson(edited) } as RecoveryButton;
  merged.rules = mergeRuleRecords(raw.rules, edited.rules) as RecoveryRule[];
  if (raw.choices !== undefined && !Array.isArray(raw.choices) && edited.choices === undefined) {
    merged.choices = cloneJson(raw.choices) as RecoveryChoice[];
  } else {
    const choices = mergeChoiceRecords(raw.choices, edited.choices ?? []);
    if (choices.length > 0 || edited.choices !== undefined) merged.choices = choices as RecoveryChoice[];
    else delete merged.choices;
  }
  return merged;
}

/**
 * Writes edited, understood records while retaining unknown/incomplete records from the
 * original JSON. Invalid child entries stay in their original slots relative to other
 * preserved entries and are never silently deleted by editing a valid sibling.
 */
export function setRecoveryButtons(template: ForgeTemplate, buttons: readonly RecoveryButton[]): void {
  const raw = Array.isArray(template.recovery) ? template.recovery : [];
  const originals = new Map<string, unknown>();
  const preserved: unknown[] = [];
  let recognized = 0;
  for (const item of raw) {
    const parsed = parseRecoveryButton(item);
    if (!parsed) { preserved.push(cloneJson(item)); continue; }
    if (originals.has(parsed.id)) { preserved.push(cloneJson(item)); continue; }
    if (recognized >= MAX_RECOVERY_BUTTONS) { preserved.push(cloneJson(item)); continue; }
    recognized += 1;
    originals.set(parsed.id, item);
  }
  const next: unknown[] = buttons.map((button) => {
    const original = originals.get(button.id);
    return original === undefined ? cloneJson(button) : mergeRecoveryButton(original, button);
  });
  // A known button explicitly removed in the editor is removed. Unreadable, duplicate,
  // or over-limit source records remain available in the JSON for manual/future repair.
  const output = [...next, ...preserved];
  if (output.length > 0) template.recovery = output;
  else delete template.recovery;
}

function recoveryRuleProblem(value: unknown): string {
  if (!isRecord(value)) return 'registro de regra não reconhecido';
  if (!isRecord(value.target)) return 'alvo ausente ou desconhecido';
  const target = value.target;
  if (target.kind === 'resource' && !isShortName(target.field)) return 'campo de destino do Resource vazio ou inválido';
  if (target.kind === 'counters' && !isShortName(target.field)) return 'campo de destino do Counter vazio ou inválido';
  if (target.kind === 'condition' || value.does === 'step' || value.does === 'clear') {
    return 'regra antiga de Condition do Forge não é mais executada; use as Conditions nativas do Atlas (registro preservado no JSON)';
  }
  if (!['resource', 'counters'].includes(String(target.kind))) return 'tipo de alvo desconhecido';
  if (typeof value.does !== 'string' || !['full', 'amount', 'share', 'set', 'spend'].includes(value.does)) {
    return `operação "${String(value.does ?? 'ausente')}" não reconhecida`;
  }
  return 'regra incompleta ou com parâmetros inválidos';
}

/** Human-readable paths for unsupported records, without modifying the source JSON. */
export function recoveryDiagnosticsOf(template: ForgeTemplate): string[] {
  if (!Array.isArray(template.recovery)) return [];
  const diagnostics: string[] = [];
  const rulesAt = (rules: unknown, path: string): void => {
    if (!Array.isArray(rules)) { diagnostics.push(`${path}: lista de regras ausente ou inválida.`); return; }
    rules.forEach((rule, index) => {
      if (!isRecoveryRule(rule)) diagnostics.push(`${path}, regra ${index + 1}: ${recoveryRuleProblem(rule)}.`);
    });
  };
  template.recovery.forEach((rawButton, buttonIndex) => {
    const parsed = parseRecoveryButton(rawButton, true);
    const label = isRecord(rawButton) && isShortName(rawButton.name) ? `Rest "${rawButton.name}"` : `Rest #${buttonIndex + 1}`;
    if (!parsed) {
      diagnostics.push(`${label}: botão desconhecido ou incompleto; registro preservado no JSON.`);
      return;
    }
    rulesAt((rawButton as JsonRecord).rules, label);
    const rawChoices = isRecord(rawButton) ? rawButton.choices : undefined;
    if (rawChoices !== undefined && !Array.isArray(rawChoices)) {
      diagnostics.push(`${label}: lista de etapas desconhecida ou inválida.`);
      return;
    }
    if (!Array.isArray(rawChoices)) return;
    rawChoices.forEach((rawChoice, choiceIndex) => {
      const choice = parseRecoveryChoice(rawChoice, true);
      const choiceLabel = isRecord(rawChoice) && isShortName(rawChoice.prompt)
        ? `${label} / "${rawChoice.prompt}"` : `${label} / etapa ${choiceIndex + 1}`;
      if (!choice) {
        diagnostics.push(`${choiceLabel}: etapa ou ações incompletas; registro preservado no JSON.`);
        return;
      }
      if (choice.actions.length === 0) {
        diagnostics.push(`${choiceLabel}: adicione pelo menos uma ação para que esta etapa possa ser usada.`);
        return;
      }
      if (!isRecord(rawChoice) || !Array.isArray(rawChoice.actions)) return;
      rawChoice.actions.forEach((rawAction, actionIndex) => {
        const action = parseRecoveryAction(rawAction);
        const actionLabel = isRecord(rawAction) && isShortName(rawAction.name)
          ? `${choiceLabel} / "${rawAction.name}"` : `${choiceLabel} / ação ${actionIndex + 1}`;
        if (!action) {
          diagnostics.push(`${actionLabel}: ação desconhecida ou incompleta; registro preservado no JSON.`);
          return;
        }
        rulesAt((rawAction as JsonRecord).rules, actionLabel);
      });
    });
  });
  return diagnostics;
}

export function createRecoveryButton(buttons: readonly RecoveryButton[], name = 'New Rest'): RecoveryButton {
  return { id: newBlockId(buttons.map((button) => button.id)), name, rules: [] };
}

export function createRecoveryChoice(choices: readonly RecoveryChoice[]): RecoveryChoice {
  return {
    id: newBlockId(choices.map((choice) => choice.id)),
    prompt: 'Choose an action', min: 1, max: 1, actions: [createRecoveryAction([])],
  };
}

export function createRecoveryAction(actions: readonly RecoveryAction[]): RecoveryAction {
  return { id: newBlockId(actions.map((action) => action.id)), name: 'New action', rules: [] };
}

export function defaultRecoveryRule(kind: RecoveryRule['does'], field = ''): RecoveryRule {
  const numericTarget = { kind: 'resource' as const, field };
  switch (kind) {
    case 'full': return { target: numericTarget, does: kind };
    case 'amount': return { target: numericTarget, does: kind, formula: '1d4' };
    case 'share': return { target: numericTarget, does: kind, share: 0.5, round: 'down' };
    case 'set': return { target: numericTarget, does: kind, to: 0 };
    case 'spend': return { target: numericTarget, does: kind, from: { kind: 'resource', field }, each: '1d8' };
  }
}

/** Creates a recovery rule whose default target matches the first supported field in the editor. */
export function defaultRecoveryRuleForFields(
  kind: RecoveryRule['does'],
  fields: readonly ForgeField[],
  blocks: readonly ForgeBlock[] = [],
  header?: JsonRecord,
  collectionResourceFields: readonly string[] = [],
): RecoveryRule {
  const supported = recoveryFields(fields, blocks, header, collectionResourceFields);
  const targetField = supported.find((field) => field.type === 'number') ?? supported[0];
  const key = targetField?.key ?? '';
  const rule = defaultRecoveryRule(kind, key);
  if (targetField?.type === 'counters') {
    rule.target = { kind: 'counters', field: key, rows: 'all' };
    if (rule.does === 'spend') rule.from = { kind: 'counters', field: key, rows: 'all' };
  }
  return rule;
}

export function recoveryFields(
  fields: readonly ForgeField[],
  blocks: readonly ForgeBlock[] = [],
  header?: JsonRecord,
  collectionResourceFields: readonly string[] = [],
): ForgeField[] {
  // Match Atlas trackedNumbers(): explicit field.tracks takes precedence; an unbound
  // Track block is the fallback. Invalid/missing tracks.max falls back to the field itself.
  const tracked = new Set(forgeTrackedResourceDefinitionsFor(fields, blocks, header).map((resource) => resource.field.key));
  const collection = new Set(collectionResourceFields);
  return fields.filter((field) => field.type === 'counters' || tracked.has(field.key) || collection.has(field.key));
}

/**
 * Atlas-style Counter recovery scope: selecting buttons by their visible Rest names
 * stores their stable IDs in template button order. An empty selection means all rows.
 */
export function toggleRecoveryRows(
  rows: 'all' | readonly string[],
  buttons: readonly RecoveryButton[],
  id: string,
): 'all' | string[] {
  const picked = rows === 'all' ? [] : rows;
  const next = picked.includes(id) ? picked.filter((row) => row !== id) : [...picked, id];
  return next.length === 0 ? 'all' : buttons.map((button) => button.id).filter((buttonId) => next.includes(buttonId));
}

export function validateRecoveryButtons(buttons: readonly RecoveryButton[]): RecoveryValidationIssue[] {
  const issues: RecoveryValidationIssue[] = [];
  if (buttons.length > MAX_RECOVERY_BUTTONS) {
    issues.push({ code: 'too-many-buttons', message: `Atlas supports at most ${MAX_RECOVERY_BUTTONS} Rest buttons.` });
  }
  const ids = new Set<string>();
  const validateRules = (rules: readonly RecoveryRule[], label: string, buttonId: string): void => {
    const issue = (code: string, message: string): void => { issues.push({ code, message, buttonId }); };
    if (rules.length > MAX_RECOVERY_RULES) issue('too-many-rules', `${label} exceeds ${MAX_RECOVERY_RULES} rules.`);
    for (const rule of rules) {
      if (!isShortName(rule.target.field)) issue('invalid-target-field', `${label} has an invalid target field.`);
      if (rule.target.kind === 'counters' && rule.target.rows !== 'all'
        && (rule.target.rows.length > MAX_RECOVERY_BUTTONS || !rule.target.rows.every(isShortName)
          || new Set(rule.target.rows).size !== rule.target.rows.length)) {
        issue('invalid-counter-rows', `${label} has invalid Counter row IDs.`);
      }
      if (rule.does === 'amount' && (!rule.formula.trim() || rule.formula.length > MAX_RECOVERY_FORMULA_LENGTH)) {
        issue('invalid-formula', `${label} has an empty or overlong recovery formula.`);
      }
      if (rule.does === 'amount' && !isOptionalWhole(rule.min, 0)) issue('invalid-minimum', `${label} has an invalid minimum.`);
      if (rule.does === 'share' && ![0.25, 0.5].includes(rule.share)) issue('invalid-share', `${label} has an unsupported share.`);
      if (rule.does === 'share' && !isOptionalWhole(rule.min, 0)) issue('invalid-minimum', `${label} has an invalid minimum.`);
      if (rule.does === 'set') {
        if (typeof rule.to === 'object' && !isShortName(rule.to.field)) issue('empty-value-field', `${label} has an invalid value field.`);
        else if (typeof rule.to !== 'object' && (!Number.isInteger(rule.to) || rule.to < 0 || rule.to > MAX_RECOVERY_NUMBER)) {
          issue('invalid-set-value', `${label} has an invalid Set value.`);
        }
      }
      if (rule.does === 'spend') {
        if (!isShortName(rule.from.field)) issue('invalid-spend-field', `${label} has a Spend rule without a valid source field.`);
        if (rule.from.kind === 'counters' && rule.from.rows !== 'all'
          && (rule.from.rows.length > MAX_RECOVERY_BUTTONS || !rule.from.rows.every(isShortName))) {
          issue('invalid-spend-rows', `${label} has invalid source Counter rows.`);
        }
        if (!rule.each.trim() || rule.each.length > MAX_RECOVERY_FORMULA_LENGTH) issue('invalid-spend-formula', `${label} has an empty or overlong Spend formula.`);
        if (!isOptionalWhole(rule.most, 1)) issue('invalid-spend-maximum', `${label} has an invalid maximum spent.`);
      }
    }
  };

  for (const button of buttons) {
    const issue = (code: string, message: string): void => { issues.push({ code, message, buttonId: button.id }); };
    if (!isShortName(button.id) || ids.has(button.id)) issue('invalid-button-id', `Rest "${button.name}" has an empty, overlong or duplicate ID.`);
    ids.add(button.id);
    if (!isShortName(button.name)) issue('empty-button-name', 'Every Rest button needs a name of at most 100 characters.');
    validateRules(button.rules, `Rest "${button.name}"`, button.id);
    const choiceIds = new Set<string>();
    for (const choice of button.choices ?? []) {
      if (!isShortName(choice.id) || choiceIds.has(choice.id) || !isShortName(choice.prompt)
        || !Number.isInteger(choice.min) || choice.min < 0 || choice.min > MAX_ACTION_PICKS
        || !Number.isInteger(choice.max) || choice.max < 1 || choice.max > MAX_ACTION_PICKS
        || choice.min > choice.max || (choice.repeat !== undefined && choice.repeat !== true)) {
        issue('invalid-choice', `Rest "${button.name}" contains an invalid choice step.`);
      }
      choiceIds.add(choice.id);
      if (choice.actions.length === 0) issue('choice-needs-action', `A choice in "${button.name}" needs at least one action.`);
      if (choice.actions.length > MAX_RECOVERY_ACTIONS) issue('too-many-actions', `A choice in "${button.name}" exceeds ${MAX_RECOVERY_ACTIONS} actions.`);
      if (choice.repeat !== true && choice.min > choice.actions.length) {
        issue('too-many-required-picks', `A choice in "${button.name}" requires more actions than it offers.`);
      }
      if (choice.repeat !== true && choice.max > choice.actions.length) {
        issue('maximum-exceeds-actions', `Reduce the maximum picks in "${button.name}" or allow repeated actions.`);
      }
      const actionIds = new Set<string>();
      for (const action of choice.actions) {
        if (!isShortName(action.id) || actionIds.has(action.id) || !isShortName(action.name)) {
          issue('invalid-action', `Rest "${button.name}" contains an action with an invalid ID or name.`);
        }
        actionIds.add(action.id);
        if (action.text !== undefined && action.text.length > MAX_ACTION_TEXT) {
          issue('action-text-too-long', `Action "${action.name}" exceeds ${MAX_ACTION_TEXT} characters.`);
        }
        validateRules(action.rules, `Action "${action.name}"`, button.id);
      }
    }
    if ((button.choices?.length ?? 0) > MAX_RECOVERY_CHOICES) issue('too-many-choices', `Rest "${button.name}" exceeds ${MAX_RECOVERY_CHOICES} choice steps.`);
  }
  return issues;
}

