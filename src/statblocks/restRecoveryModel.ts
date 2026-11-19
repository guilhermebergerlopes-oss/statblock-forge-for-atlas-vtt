import { evaluatePreviewFormula } from '../render/previewValueModel.ts';
import {
  combineRestSpendFormula, evaluateFilledRestFormula, evaluateRestFormula, fillRestFormula,
} from './restFormulaModel.ts';
import { isRecord, type ForgeField, type ForgeTemplate, type JsonRecord } from '../templates/forgeTemplate.ts';
import type { RecoveryButton, RecoveryMetricTarget, RecoveryRule } from '../templates/recoveryEditorModel.ts';
import { calculateNumericFieldValue } from '../templates/numericFieldModel.ts';
import { normalizeLegacyCounterPresetName, updateInlineCounterUsedValue } from './inlineCountersFieldEditorModel.ts';
import { isCounterRegainFormula, presetCounterRegain } from './counterRegainModel.ts';
import {
  forgeTrackedResourceForField, forgeTrackedResourceCurrent, setForgeTrackedResourceCurrent,
  FORGE_RESOURCE_VALUES_KEY,
} from './forgeResourceValues.ts';
import type { RestChoicePick } from './restChoiceSelectionModel.ts';
import { atlasResourceReadsForgeField, atlasResourceSharesForgeFieldKey, type AtlasRestResourceSnapshot } from '../atlas/atlasRestResources.ts';

/** Rolls a Rest formula with the selected Dice Set; null means the formula or dice engine refused it. */
export type RestFormulaRoller = (formula: string, label: string) => number | null;

export interface RestCounterChange {
  field: string;
  label: string;
  row: number;
  from: number;
  to: number;
}

export type RestCalculationSkipReason =
  | 'unsupported-target'
  | 'unsupported-spend-source'
  | 'unknown-field'
  | 'invalid-counters'
  | 'invalid-resource'
  | 'invalid-resource-track'
  | 'static-resource'
  | 'no-resource-value'
  | 'invalid-value'
  | 'invalid-formula'
  | 'missing-reference'
  | 'dice-roll-unavailable'
  | 'roll-failed'
  | 'for-other-character'
  | 'unknown-action';

export interface RestCalculationSkip {
  ref: string;
  field: string;
  label: string;
  reason: RestCalculationSkipReason;
}

export interface RestResourceChange {
  field: string;
  label: string;
  from: number;
  to: number;
  max: number;
  direction: 'down' | 'up';
  /** Collection resources are written to the linked Atlas character's token state, not the statblock file. */
  resourceKey?: string;
  storage?: 'forge' | 'atlas';
}


export { FORGE_RESOURCE_VALUES_KEY };

export interface RestCalculationResult {
  /** Updated copy; the caller decides when and how to persist it. */
  data: JsonRecord;
  changes: RestCounterChange[];
  resourceChanges: RestResourceChange[];
  skipped: RestCalculationSkip[];
}

interface EffectiveCounterRow {
  source: Record<string, unknown>;
  name: string;
  max: number;
  used: number;
  reset: string | null;
  regain: string | null;
  displayedIndex: number;
}

interface ParsedCounterRow {
  source: Record<string, unknown>;
  name: string;
  max: number;
  used: number;
  reset: string | null;
  regain: string | null;
}

function parseCounterRow(value: unknown, preset = false): ParsedCounterRow | null {
  if (!isRecord(value) || typeof value.name !== 'string' || !Number.isInteger(value.max) || Number(value.max) < 0) return null;
  const max = Number(value.max);
  const used = preset || value.used === undefined ? 0 : value.used;
  if (!Number.isInteger(used) || Number(used) < 0 || Number(used) > max) return null;
  if (value.reset !== undefined && value.reset !== null && typeof value.reset !== 'string') return null;
  if (value.regain !== undefined && value.regain !== null && typeof value.regain !== 'string') return null;
  const regain = preset
    ? presetCounterRegain(value.regain)
    : value.regain === undefined || value.regain === null
      ? null
      : isCounterRegainFormula(value.regain) ? value.regain : undefined;
  if (regain === undefined) return null;
  const source: Record<string, unknown> = { ...value, used };
  if (preset) {
    source.reset = null;
    if (regain === null) delete source.regain;
    else source.regain = regain;
  }
  return {
    source,
    name: value.name,
    max,
    used: Number(used),
    reset: preset ? null : typeof value.reset === 'string' ? value.reset : null,
    regain,
  };
}

/** Reads precisely the same effective row order as the Forge Counter renderer. */
export function effectiveRestCounterRows(raw: unknown, field: ForgeField): EffectiveCounterRow[] | null {
  if (field.type !== 'counters') return null;
  const isEmpty = raw === undefined || raw === null || (Array.isArray(raw) && raw.length === 0);
  if (!isEmpty && !Array.isArray(raw)) return null;

  const presetValues = Array.isArray(field.counterRows) ? field.counterRows.filter(isRecord) : [];
  const presets = presetValues.map((value) => parseCounterRow(value, true));
  if (presets.some((row) => row === null)) return null;
  const ownValues = isEmpty ? [] : raw as unknown[];
  const own = ownValues.map((value) => parseCounterRow(value));
  if (own.some((row) => row === null)) return null;
  const rows = (own as ParsedCounterRow[]).map((row) => ({ ...row, source: { ...row.source } }));
  const validPresets = presets as ParsedCounterRow[];
  rows.forEach((row, index) => {
    const preset = validPresets[index];
    if (preset) {
      row.name = normalizeLegacyCounterPresetName(row.name, index, preset.name);
      row.source.name = row.name;
    }
  });
  const namesPreset = (row: ParsedCounterRow): boolean => validPresets.some((preset) =>
    preset.name.trim().toLowerCase() === row.name.trim().toLowerCase());
  const holds = (preset: ParsedCounterRow, index: number): boolean =>
    rows.some((row) => row.name.trim().toLowerCase() === preset.name.trim().toLowerCase())
    || (rows[index] !== undefined && !namesPreset(rows[index]!));
  validPresets.forEach((preset, index) => {
    if (preset.max > 0 && !holds(preset, index)) rows.push({ ...preset, source: { ...preset.source } });
  });

  return rows.filter((row) => row.max > 0).map((row, displayedIndex) => ({ ...row, displayedIndex }));
}

function whole(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (typeof value === 'string' && /^\s*[+-]?\d{1,15}\s*$/.test(value)) {
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function numericFieldValue(data: JsonRecord, template: ForgeTemplate, key: string): number | null {
  const field = template.fields.find((candidate) => candidate.key === key
    && (candidate.type === 'number' || candidate.type === 'rating'));
  return field ? calculateNumericFieldValue(field, data, evaluatePreviewFormula) : finiteNumber(data[key]);
}

interface RestResourceExecutionContext {
  collectionResources: readonly AtlasRestResourceSnapshot[];
  atlasCurrentOverrides: Map<string, number>;
}

interface EffectiveRestResource {
  field: ForgeField;
  maxField: ForgeField;
  current: number;
  max: number;
  direction: 'down' | 'up';
  storage: 'field' | 'forge-values' | 'atlas';
  resourceKey?: string;
  resourceLabel?: string;
}

/**
 * Follows Atlas trackedNumbers(): a Number field is recoverable when it has `tracks`,
 * or when an unbound Track block draws it. A missing/invalid max reference falls back
 * to the tracked field itself. In that case the field keeps the maximum and the current
 * value lives in Forge's per-statblock resource-value map, matching Atlas' split between
 * the template note (maximum) and the character resource state (current).
 */
function collectionResourceUnavailableReason(
  template: ForgeTemplate,
  key: string,
  context?: RestResourceExecutionContext,
): 'static-resource' | 'no-resource-value' | null {
  const field = template.fields.find((candidate) => candidate.key === key);
  const resource = field ? context?.collectionResources.find((candidate) => atlasResourceReadsForgeField(candidate, field)) : undefined;
  if (!resource) return null;
  if (resource.direction === 'static') return 'static-resource';
  if (resource.holder === 'none') return 'no-resource-value';
  return null;
}

function effectiveRestResource(
  data: JsonRecord,
  template: ForgeTemplate,
  key: string,
  maxData: JsonRecord = data,
  context?: RestResourceExecutionContext,
): EffectiveRestResource | null {
  const collectionField = template.fields.find((candidate) => candidate.key === key);
  const collectionResource = collectionField ? context?.collectionResources.find((resource) => atlasResourceReadsForgeField(resource, collectionField)) : undefined;
  if (collectionField && collectionResource) {
    if (collectionResource.direction === 'static' || collectionResource.holder === 'none') return null;
    const current = context?.atlasCurrentOverrides.get(collectionResource.key) ?? collectionResource.current;
    const max = collectionResource.max;
    if (!Number.isFinite(current) || !Number.isFinite(max) || max < 0) return null;
    return {
      field: collectionField, maxField: collectionField, current: Math.max(0, Math.min(max, current)), max,
      direction: collectionResource.direction === 'drains' ? 'down' : 'up',
      storage: 'atlas', resourceKey: collectionResource.key, resourceLabel: collectionResource.name || collectionResource.key,
    };
  }
  // Atlas also excludes a tracked number when a collection Resource shares its stable key, even
  // if that definition reads a different path. It then has no metric unless its field path matches.
  if (collectionField && context?.collectionResources.some((resource) => atlasResourceSharesForgeFieldKey(resource, collectionField))) return null;
  const tracked = forgeTrackedResourceForField(template, key);
  if (!tracked) return null;
  const field = tracked.field;
  const maxField = tracked.maxField;
  // Atlas plans a Rest against the ResourceValue (including its maximum) read before any rule
  // runs. Keep that maximum fixed for the whole operation even when another tracked field is
  // itself the maximum field or a formula dependency.
  const calculatedMax = calculateNumericFieldValue(maxField, maxData, evaluatePreviewFormula);
  if (calculatedMax === null || !Number.isFinite(calculatedMax)) return null;
  const max = Math.max(0, Math.floor(calculatedMax));
  if (max < 1) return null;
  const selfTracked = maxField.key === field.key;
  const rawCurrent = data[field.key];
  const defaultCurrent = tracked.counts === 'down' ? max : 0;
  const readCurrent = selfTracked
    ? forgeTrackedResourceCurrent(data, field.key, max, tracked.counts)
    : rawCurrent === undefined || rawCurrent === null
      ? defaultCurrent
      : finiteNumber(rawCurrent);
  // Atlas trackedValue() clamps the stored current value into the ResourceValue's [0, max]
  // range. A stale/out-of-range current is not an invalid Resource; it is read at the nearest
  // legal boundary. Truly non-numeric data remains an invalid track.
  if (readCurrent === null) return null;
  const current = Math.max(0, Math.min(max, readCurrent));
  return {
    field, maxField, current, max, direction: tracked.counts,
    storage: selfTracked ? 'forge-values' : 'field',
  };
}

function restResourceSpendable(resource: EffectiveRestResource): number {
  return resource.direction === 'down'
    ? Math.max(0, resource.current)
    : Math.max(0, resource.max - resource.current);
}

function storeResourceCurrent(data: JsonRecord, resource: EffectiveRestResource, current: number, context?: RestResourceExecutionContext): void {
  const next = Math.max(0, Math.min(resource.max, current));
  if (resource.storage === 'atlas' && resource.resourceKey) {
    context?.atlasCurrentOverrides.set(resource.resourceKey, next);
    return;
  }
  if (resource.storage === 'forge-values') {
    setForgeTrackedResourceCurrent(data, resource.field.key, next);
    return;
  }
  data[resource.field.key] = typeof data[resource.field.key] === 'string' ? String(next) : next;
}

function addResourceChange(
  changes: Map<string, RestResourceChange>,
  resource: EffectiveRestResource,
  from: number,
  to: number,
): void {
  if (from === to) return;
  const existing = changes.get(resource.field.key);
  if (existing) existing.to = to;
  else changes.set(resource.field.key, {
    field: resource.field.key,
    label: resource.resourceLabel || resource.field.label || resource.field.key,
    from,
    to,
    max: resource.max,
    direction: resource.direction,
    ...(resource.storage === 'atlas' && resource.resourceKey ? { resourceKey: resource.resourceKey, storage: 'atlas' as const } : {}),
  });
}

function rowMatches(row: EffectiveCounterRow, rows: 'all' | readonly string[]): boolean {
  return rows === 'all' || (row.reset !== null && rows.includes(row.reset));
}

function counterField(template: ForgeTemplate, key: string): ForgeField | null {
  return template.fields.find((field) => field.key === key && field.type === 'counters') ?? null;
}

function ruleField(rule: RecoveryRule): string {
  return rule.target.field;
}

function updateCounterRows(
  data: JsonRecord,
  field: ForgeField,
  rowUpdates: ReadonlyMap<number, number>,
): boolean {
  let next: unknown = data[field.key];
  for (const [displayedIndex, used] of [...rowUpdates].sort((a, b) => a[0] - b[0])) {
    next = updateInlineCounterUsedValue(next, field, displayedIndex, used);
  }
  if (next === data[field.key]) return false;
  data[field.key] = next;
  return true;
}

function selectedRows(
  rows: readonly EffectiveCounterRow[],
  filter: 'all' | readonly string[],
): EffectiveCounterRow[] {
  return rows.filter((row) => rowMatches(row, filter));
}

export interface RestCounterSpendOption {
  /** Same stable reference the calculation engine uses for this rule. */
  ref: string;
  /** Name of the Counter field from which units will be spent. */
  label: string;
  /** Formula gained for each spent unit. */
  each: string;
  /** Spend cap after applying remaining units and the rule's `most` limit. */
  max: number;
}

/**
 * Lists supported Spend rules that apply to this rest, in the same order as the
 * calculation engine: button rules first, then rules from each selected action.
 * Both Counter rows and explicitly tracked Number Resources can be spent.
 */
export function restCounterSpendOptions(input: {
  template: ForgeTemplate;
  data: JsonRecord;
  button: RecoveryButton;
  picks?: readonly RestChoicePick[];
  collectionResources?: readonly AtlasRestResourceSnapshot[];
}): RestCounterSpendOption[] {
  const options: RestCounterSpendOption[] = [];
  const resourceContext: RestResourceExecutionContext = { collectionResources: input.collectionResources ?? [], atlasCurrentOverrides: new Map() };
  const addRules = (rules: readonly RecoveryRule[], ref: (index: number) => string): void => {
    rules.forEach((rule, index) => {
      if (rule.does !== 'spend') return;
      // Atlas only exposes a Spend choice after restPlan has resolved its target, source and
      // per-unit formula. Do not ask the player to spend against a rule the engine will skip.
      if (!fillRestFormula(rule.each, input.template, input.data).ok) return;
      // Do not ask the player for a spend that will be skipped when its target is invalid.
      const targetValid = rule.target.kind === 'counters'
        ? Boolean(counterField(input.template, rule.target.field)
          && effectiveRestCounterRows(input.data[rule.target.field], counterField(input.template, rule.target.field)!))
        : Boolean(effectiveRestResource(input.data, input.template, rule.target.field, input.data, resourceContext));
      if (!targetValid) return;

      let label = '';
      let available = 0;
      if (rule.from.kind === 'counters') {
        const field = counterField(input.template, rule.from.field);
        if (!field) return;
        const rows = effectiveRestCounterRows(input.data[field.key], field);
        if (!rows) return;
        label = field.label || field.key;
        available = getCounterSpendable(rows, rule.from.rows);
      } else {
        const resource = effectiveRestResource(input.data, input.template, rule.from.field, input.data, resourceContext);
        if (!resource) return;
        label = resource.resourceLabel || resource.field.label || resource.field.key;
        available = restResourceSpendable(resource);
      }
      options.push({
        ref: ref(index), label, each: rule.each,
        max: Math.max(0, Math.min(available, rule.most ?? Number.POSITIVE_INFINITY)),
      });
    });
  };

  addRules(input.button.rules, (index) => `always:${index}`);
  (input.picks ?? []).forEach((pick, pickIndex) => {
    const choice = input.button.choices?.find((item) => item.id === pick.choice);
    const action = choice?.actions.find((item) => item.id === pick.action);
    // An action picked for another character must not spend this character's resources.
    // The action may still be picked for oneself, matching Atlas' default `for: null`.
    if (!action || (pick.forOther === true && action.forOthers === true)) return;
    addRules(action.rules, (index) => `pick:${pickIndex}:${index}`);
  });
  return options;
}

function getCounterSpendable(rows: readonly EffectiveCounterRow[], filter: 'all' | readonly string[]): number {
  return selectedRows(rows, filter).reduce((sum, row) => sum + Math.max(0, row.max - row.used), 0);
}

function spendCounterUnits(
  data: JsonRecord,
  field: ForgeField,
  filter: 'all' | readonly string[],
  units: number,
): Array<{ row: EffectiveCounterRow; from: number; to: number }> {
  const rows = effectiveRestCounterRows(data[field.key], field);
  if (!rows) return [];
  let remaining = units;
  const updates = new Map<number, number>();
  const changes: Array<{ row: EffectiveCounterRow; from: number; to: number }> = [];
  for (const row of selectedRows(rows, filter)) {
    if (remaining <= 0) break;
    const spent = Math.min(remaining, row.max - row.used);
    if (spent <= 0) continue;
    remaining -= spent;
    updates.set(row.displayedIndex, row.used + spent);
    changes.push({ row, from: row.used, to: row.used + spent });
  }
  if (updates.size > 0) updateCounterRows(data, field, updates);
  return changes;
}

function spendResourceUnits(
  data: JsonRecord,
  template: ForgeTemplate,
  fieldKey: string,
  units: number,
  changes: Map<string, RestResourceChange>,
  maxData: JsonRecord = data,
  resourceContext?: RestResourceExecutionContext,
): number {
  const resource = effectiveRestResource(data, template, fieldKey, maxData, resourceContext);
  if (!resource || units <= 0) return 0;
  const spent = Math.min(Math.max(0, Math.trunc(units)), restResourceSpendable(resource));
  if (spent <= 0) return 0;
  const next = resource.direction === 'down' ? resource.current - spent : resource.current + spent;
  storeResourceCurrent(data, resource, next, resourceContext);
  addResourceChange(changes, resource, resource.current, Math.max(0, Math.min(resource.max, next)));
  return spent;
}

function spendRecoverySource(
  data: JsonRecord,
  template: ForgeTemplate,
  source: RecoveryMetricTarget,
  units: number,
  counterChanges: Map<string, RestCounterChange>,
  resourceChanges: Map<string, RestResourceChange>,
  maxData: JsonRecord = data,
  resourceContext?: RestResourceExecutionContext,
): number {
  if (source.kind === 'resource') {
    return spendResourceUnits(data, template, source.field, units, resourceChanges, maxData, resourceContext);
  }
  const field = counterField(template, source.field);
  if (!field) return 0;
  const rows = effectiveRestCounterRows(data[field.key], field);
  if (!rows) return 0;
  const actual = Math.min(Math.max(0, Math.trunc(units)), getCounterSpendable(rows, source.rows));
  if (actual <= 0) return 0;
  const spent = spendCounterUnits(data, field, source.rows, actual);
  const updates = new Map<number, number>();
  for (const item of spent) updates.set(item.row.displayedIndex, item.to);
  addCounterChanges(counterChanges, field, rows, updates);
  return spent.reduce((sum, item) => sum + (item.to - item.from), 0);
}

function addCounterChanges(
  changes: Map<string, RestCounterChange>,
  field: ForgeField,
  rows: readonly EffectiveCounterRow[],
  updates: ReadonlyMap<number, number>,
): void {
  const visibleCount = rows.length;
  for (const [index, used] of updates) {
    const row = rows.find((item) => item.displayedIndex === index);
    if (!row || row.used === used) continue;
    const key = `${field.key}:${index}`;
    const existing = changes.get(key);
    const from = row.max - row.used;
    const to = row.max - used;
    if (existing) existing.to = to;
    else changes.set(key, {
      field: field.key,
      label: visibleCount > 1 ? `${field.label || field.key} ${row.name}` : row.name || field.label || field.key,
      row: index,
      from,
      to,
    });
  }
}

function applyCounterRule(
  data: JsonRecord,
  formulaData: JsonRecord,
  template: ForgeTemplate,
  button: RecoveryButton,
  rule: RecoveryRule,
  ref: string,
  spends: ReadonlyMap<string, number>,
  changes: Map<string, RestCounterChange>,
  resourceChanges: Map<string, RestResourceChange>,
  roll?: RestFormulaRoller,
  resourceContext?: RestResourceExecutionContext,
): RestCalculationSkip | null {
  const label = ruleField(rule);
  if (rule.target.kind !== 'counters') {
    return { ref, field: label, label, reason: 'unsupported-target' };
  }
  const field = counterField(template, rule.target.field);
  if (!field) return { ref, field: rule.target.field, label: rule.target.field, reason: 'unknown-field' };
  let rows = effectiveRestCounterRows(data[field.key], field);
  if (!rows) return { ref, field: field.key, label: field.label, reason: 'invalid-counters' };
  const targets = selectedRows(rows, rule.target.rows);
  // Atlas plans a Counters metric even when the row scope currently matches no rows. Keep
  // evaluating the rule: Amount still rolls, and Spend still consumes its selected source,
  // while the target update naturally has no rows to change.

  let gain = 0;
  let targetUsed = new Map<number, number>();

  if (rule.does === 'full') {
    for (const row of targets) {
      if (row.used <= 0) continue;
      if (row.regain === null) {
        targetUsed.set(row.displayedIndex, 0);
        continue;
      }
      const rolled = evaluateRestFormula(row.regain, template, formulaData, `${row.name} (${button.name})`, roll);
      if (!('value' in rolled)) {
        return { ref, field: field.key, label: row.name || field.label, reason: rolled.reason };
      }
      targetUsed.set(row.displayedIndex, Math.max(0, row.used - Math.max(0, rolled.value)));
    }
  } else if (rule.does === 'share') {
    for (const row of targets) {
      const regained = Math.max(rule.min ?? 0, rule.round === 'down'
        ? Math.floor(rule.share * row.max)
        : Math.ceil(rule.share * row.max));
      targetUsed.set(row.displayedIndex, Math.max(0, Math.min(row.max, row.used - regained)));
    }
  } else if (rule.does === 'set') {
    const to = typeof rule.to === 'number' ? rule.to : whole(numericFieldValue(formulaData, template, rule.to.field));
    if (to === null) return { ref, field: field.key, label: field.label, reason: 'invalid-value' };
    for (const row of targets) targetUsed.set(row.displayedIndex, Math.max(0, row.max - Math.max(0, Math.min(row.max, to))));
  } else if (rule.does === 'amount') {
    const result = evaluateRestFormula(rule.formula, template, formulaData, `${field.label} (${button.name})`, roll);
    if (!('value' in result)) return { ref, field: field.key, label: field.label, reason: result.reason };
    gain = Math.max(0, rule.min ?? 0, result.value);
    for (const row of targets) targetUsed.set(row.displayedIndex, Math.max(0, row.used - gain));
  } else if (rule.does === 'spend') {
    const spendSource = rule.from.kind === 'counters'
      ? counterField(template, rule.from.field) ? effectiveRestCounterRows(data[rule.from.field], counterField(template, rule.from.field)!) : null
      : effectiveRestResource(data, template, rule.from.field, formulaData, resourceContext);
    if (!spendSource) return { ref, field: rule.from.field, label: rule.from.field, reason: rule.from.kind === 'counters' ? 'invalid-counters' : collectionResourceUnavailableReason(template, rule.from.field, resourceContext) ?? 'invalid-resource-track' };
    const available = rule.from.kind === 'counters'
      ? getCounterSpendable(spendSource as EffectiveCounterRow[], rule.from.rows)
      : restResourceSpendable(spendSource as EffectiveRestResource);
    const units = Math.min(available, rule.most ?? Number.POSITIVE_INFINITY, Math.max(0, Math.trunc(spends.get(ref) ?? 0)));
    if (units === 0) return null;
    const filledEach = fillRestFormula(rule.each, template, formulaData);
    if (!filledEach.ok) return {
      ref, field: field.key, label: field.label,
      reason: filledEach.problem.kind === 'missing-reference' ? 'missing-reference'
        : filledEach.problem.kind === 'not-whole' ? 'invalid-value' : 'invalid-formula',
    };
    const combined = combineRestSpendFormula(filledEach, units);
    if (!combined.ok) return { ref, field: field.key, label: field.label, reason: 'invalid-formula' };
    const rolledOrCalculated = evaluateFilledRestFormula(combined, `${rule.from.field} (${button.name})`, roll);
    if (!('value' in rolledOrCalculated)) return { ref, field: field.key, label: field.label, reason: rolledOrCalculated.reason };
    // Atlas spends from the source before applying the combined formula's result to the target.
    const spent = spendRecoverySource(data, template, rule.from, units, changes, resourceChanges, formulaData, resourceContext);
    if (spent <= 0) return null;
    gain = Math.max(0, rolledOrCalculated.value);
    rows = effectiveRestCounterRows(data[field.key], field) ?? rows;
    for (const row of selectedRows(rows, rule.target.rows)) targetUsed.set(row.displayedIndex, Math.max(0, row.used - gain));
  }

  if (targetUsed.size > 0) {
    const currentRows = effectiveRestCounterRows(data[field.key], field);
    if (!currentRows) return { ref, field: field.key, label: field.label, reason: 'invalid-counters' };
    const before = new Map(currentRows.map((row) => [row.displayedIndex, row]));
    const updates = new Map<number, number>();
    for (const [index, used] of targetUsed) {
      const current = before.get(index);
      if (current) updates.set(index, used);
    }
    if (updates.size > 0) {
      updateCounterRows(data, field, updates);
      addCounterChanges(changes, field, currentRows, updates);
    }
  }
  return null;
}

function applyResourceRule(
  data: JsonRecord,
  formulaData: JsonRecord,
  template: ForgeTemplate,
  button: RecoveryButton,
  rule: RecoveryRule,
  ref: string,
  spends: ReadonlyMap<string, number>,
  counterChanges: Map<string, RestCounterChange>,
  resourceChanges: Map<string, RestResourceChange>,
  roll?: RestFormulaRoller,
  resourceContext?: RestResourceExecutionContext,
): RestCalculationSkip | null {
  const target = rule.target;
  if (target.kind !== 'resource') return { ref, field: ruleField(rule), label: ruleField(rule), reason: 'unsupported-target' };
  let resource = effectiveRestResource(data, template, target.field, formulaData, resourceContext);
  if (!resource) {
    const collectionField = template.fields.find((field) => field.key === target.field);
    const collectionDefinition = collectionField
      ? resourceContext?.collectionResources.find((candidate) => atlasResourceReadsForgeField(candidate, collectionField))
      : undefined;
    if (collectionDefinition?.direction === 'static') {
      return { ref, field: target.field, label: collectionDefinition.name || target.field, reason: 'static-resource' };
    }
    if (collectionDefinition?.holder === 'none') {
      return { ref, field: target.field, label: collectionDefinition.name || target.field, reason: 'no-resource-value' };
    }
    const exists = template.fields.some((field) => field.key === target.field);
    return { ref, field: target.field, label: target.field, reason: exists ? 'invalid-resource-track' : 'unknown-field' };
  }

  let next = resource.current;
  if (rule.does === 'full') {
    next = resource.direction === 'down' ? resource.max : 0;
  } else if (rule.does === 'set') {
    const rawTo = typeof rule.to === 'number' ? rule.to : numericFieldValue(formulaData, template, rule.to.field);
    const to = whole(rawTo);
    if (to === null) return { ref, field: resource.field.key, label: resource.field.label, reason: 'invalid-value' };
    next = to;
  } else if (rule.does === 'share') {
    const share = rule.round === 'down' ? Math.floor(rule.share * resource.max) : Math.ceil(rule.share * resource.max);
    const gain = Math.max(rule.min ?? 0, share);
    next = resource.direction === 'down' ? resource.current + gain : resource.current - gain;
  } else if (rule.does === 'amount' || rule.does === 'spend') {
    let gain = 0;
    if (rule.does === 'amount') {
      const result = evaluateRestFormula(rule.formula, template, formulaData, `${resource.field.label} (${button.name})`, roll);
      if (!('value' in result)) return { ref, field: resource.field.key, label: resource.field.label, reason: result.reason };
      gain = Math.max(0, rule.min ?? 0, result.value);
    } else {
      const sourceFieldLabel = rule.from.kind === 'counters'
        ? counterField(template, rule.from.field)?.label ?? rule.from.field
        : effectiveRestResource(data, template, rule.from.field, formulaData, resourceContext)?.resourceLabel ?? effectiveRestResource(data, template, rule.from.field, formulaData, resourceContext)?.field.label ?? rule.from.field;
      const source = rule.from.kind === 'counters'
        ? (() => { const field = counterField(template, rule.from.field); return field ? effectiveRestCounterRows(data[field.key], field) : null; })()
        : effectiveRestResource(data, template, rule.from.field, formulaData, resourceContext);
      if (!source) return { ref, field: rule.from.field, label: sourceFieldLabel, reason: rule.from.kind === 'counters' ? 'invalid-counters' : collectionResourceUnavailableReason(template, rule.from.field, resourceContext) ?? 'invalid-resource-track' };
      const available = rule.from.kind === 'counters'
        ? getCounterSpendable(source as EffectiveCounterRow[], rule.from.rows)
        : restResourceSpendable(source as EffectiveRestResource);
      const units = Math.min(available, rule.most ?? Number.POSITIVE_INFINITY, Math.max(0, Math.trunc(spends.get(ref) ?? 0)));
      if (units <= 0) return null;
      const filledEach = fillRestFormula(rule.each, template, formulaData);
      if (!filledEach.ok) return {
        ref, field: resource.field.key, label: resource.field.label,
        reason: filledEach.problem.kind === 'missing-reference' ? 'missing-reference'
          : filledEach.problem.kind === 'not-whole' ? 'invalid-value' : 'invalid-formula',
      };
      const combined = combineRestSpendFormula(filledEach, units);
      if (!combined.ok) return { ref, field: resource.field.key, label: resource.field.label, reason: 'invalid-formula' };
      const outcome = evaluateFilledRestFormula(combined, `${sourceFieldLabel} (${button.name})`, roll);
      if (!('value' in outcome)) return { ref, field: resource.field.key, label: resource.field.label, reason: outcome.reason };
      const actualSpent = spendRecoverySource(data, template, rule.from, units, counterChanges, resourceChanges, formulaData, resourceContext);
      if (actualSpent <= 0) return null;
      gain = Math.max(0, outcome.value);
      // Spending may change this same resource when source and target are identical.
      resource = effectiveRestResource(data, template, target.field, formulaData, resourceContext) ?? resource;
    }
    next = resource.direction === 'down' ? resource.current + gain : resource.current - gain;
  }

  const clamped = Math.max(0, Math.min(resource.max, next));
  storeResourceCurrent(data, resource, clamped, resourceContext);
  addResourceChange(resourceChanges, resource, resource.current, clamped);
  return null;
}

/** Calculates Counter and tracked Resource recovery without mutating the input. */
export function calculateRestCounters(input: {
  template: ForgeTemplate;
  data: JsonRecord;
  button: RecoveryButton;
  picks?: readonly RestChoicePick[];
  spends?: ReadonlyMap<string, number>;
  collectionResources?: readonly AtlasRestResourceSnapshot[];
  roll?: RestFormulaRoller;
}): RestCalculationResult {
  const data: JsonRecord = { ...input.data };
  const formulaData: JsonRecord = { ...input.data };
  const changes = new Map<string, RestCounterChange>();
  const resourceChanges = new Map<string, RestResourceChange>();
  const skipped: RestCalculationSkip[] = [];
  const spends = input.spends ?? new Map<string, number>();
  const resourceContext: RestResourceExecutionContext = { collectionResources: input.collectionResources ?? [], atlasCurrentOverrides: new Map() };

  const apply = (rule: RecoveryRule, ref: string): void => {
    const issue = rule.target.kind === 'resource'
      ? applyResourceRule(data, formulaData, input.template, input.button, rule, ref, spends, changes, resourceChanges, input.roll, resourceContext)
      : applyCounterRule(data, formulaData, input.template, input.button, rule, ref, spends, changes, resourceChanges, input.roll, resourceContext);
    if (issue) skipped.push(issue);
  };

  input.button.rules.forEach((rule, index) => apply(rule, `always:${index}`));
  (input.picks ?? []).forEach((pick, pickIndex) => {
    const choice = input.button.choices?.find((item) => item.id === pick.choice);
    const action = choice?.actions.find((item) => item.id === pick.action);
    if (!action) {
      skipped.push({ ref: `pick:${pickIndex}`, field: '', label: '', reason: 'unknown-action' });
      return;
    }
    if (pick.forOther === true && action.forOthers === true) {
      // The selected action is for an ally. Forge does not write to that character's
      // statblock, and must not apply the action's effects to the resting character.
      skipped.push({ ref: `pick:${pickIndex}`, field: '', label: action.name, reason: 'for-other-character' });
      return;
    }
    action.rules.forEach((rule, ruleIndex) => apply(rule, `pick:${pickIndex}:${ruleIndex}`));
  });

  return {
    data,
    changes: [...changes.values()].filter((change) => change.from !== change.to),
    resourceChanges: [...resourceChanges.values()].filter((change) => change.from !== change.to),
    skipped,
  };
}
