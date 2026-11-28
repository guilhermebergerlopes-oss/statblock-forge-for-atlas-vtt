import { sha256Hex } from '../utils/sha256.ts';
import type { App, TFile } from 'obsidian';
import { headerFieldForPart, isRecord, type ForgeField, type ForgeTemplate, type JsonRecord } from '../templates/forgeTemplate.ts';
import { parseTemplateFileText } from '../templates/forgeFileFormat.ts';
import { resolveForgeTemplateForNote } from '../atlas/forgeTemplateLinkResolver.ts';
import { createLoadedStatblockSource } from '../statblocks/statblockDataSources.ts';
import { forgeRestDataWithResources, FORGE_RESOURCE_VALUES_KEY, forgeTrackedResourceForField } from '../statblocks/forgeResourceValues.ts';
import { diceFieldFormula, diceFieldFormulaReferences, hasDiceFieldFormula, resolveDiceFieldFormula } from '../statblocks/diceFieldFormulaModel.ts';
import { evaluatePreviewFormula, resolveDisplayedNumericFieldValues } from '../render/previewValueModel.ts';
import { tableCellReferenceIndex } from '../statblocks/tableFormulaModel.ts';
import { forgeRestDiceSetById, findForgeRestDiceSetInVault, type ForgeRestDiceSet } from '../statblocks/restDiceRoller.ts';
import { rollForgeDiceFieldThroughAtlas } from '../statblocks/atlasRestDiceTool.ts';
import type { ForgeOffMapDiceRollResult } from '../statblocks/atlasOffMapDiceRoller.ts';

type ForgeSharedRollResultPresenter = (result: ForgeOffMapDiceRollResult, footerMessage: string) => void;

export const DICE_ROLL_TOGETHER_REST_STORE_KEY = 'diceRollTogetherRestStore';
export const DICE_ROLL_TOGETHER_REST_MARKER_KEY = 'statblockForgeRestTransaction';
const MAX_STORED_RECEIPTS = 500;
const MAX_PENDING_TRANSACTIONS = 64;

export interface DiceTogetherRestEvent extends JsonRecord {
  id: string;
  type: 'rest.completed';
  characterId: string;
  actorId: string;
  buttonId: string;
  buttonName: string;
  picks: Array<{ choice: string; action: string; forOther?: boolean }>;
  spends: Record<string, number>;
  counterChanges: Array<{ field: string; label?: string; row: number; from: number; to: number }>;
  resourceChanges: Array<{ field: string; label?: string; from: number; to: number; max: number; direction: 'down' | 'up' }>;
  formulaRolls: Array<{ formula: string; label: string; total: number }>;
  skipped: unknown[];
  createdAt: string;
}

export interface DiceTogetherRestReceipt {
  idempotencyKey: string;
  characterId: string;
  revision: string;
  event: DiceTogetherRestEvent;
  committedAt: string;
  requestFingerprint: string;
}

export interface DiceTogetherRestCommitRequest {
  idempotencyKey: string;
  characterId: string;
  expectedRevision: string;
  nextData: JsonRecord;
  event: DiceTogetherRestEvent;
}

export interface DiceTogetherCharacterSnapshot {
  characterId: string;
  revision: string;
  template: {
    fields: ForgeField[];
    recovery?: unknown[];
    layout?: { blocks?: Array<Record<string, unknown>> };
    header?: Record<string, unknown>;
  };
  data: JsonRecord;
}

export interface DiceTogetherForgeApiV1 {
  readonly apiVersion: 1;
  listCharacters(): Promise<Array<{ id: string; name: string; sourcePath?: string }>>;
  readCharacter(characterId: string): Promise<DiceTogetherCharacterSnapshot | null>;
  resolveRestNumericFields(characterId: string, snapshot: DiceTogetherCharacterSnapshot): Promise<Record<string, number | null>>;
  prepareDiceFieldRoll(characterId: string, fieldKey: string): Promise<{
    characterId: string;
    fieldKey: string;
    label: string;
    originalFormula: string;
    resolvedFormula: string;
    references: string[];
  }>;
  findRestReceipt(idempotencyKey: string): Promise<DiceTogetherRestReceipt | null>;
  commitRest(request: DiceTogetherRestCommitRequest): Promise<DiceTogetherRestReceipt>;
  authorizeRest(actorId: string, characterId: string): Promise<boolean>;
}

interface PendingRestJournal {
  idempotencyKey: string;
  fingerprint: string;
  characterId: string;
  expectedRevision: string;
  beforeValues: JsonRecord;
  afterValues: JsonRecord;
  event: DiceTogetherRestEvent;
  preparedAt: string;
}

export interface DiceTogetherTemplateDiceFieldV3 {
  fieldKey: string;
  label: string;
  formula: string;
  references: string[];
}

/** Player-local candidate values for GM review; unresolved references are omitted, never coerced to zero. */
export interface DiceTogetherFieldReferenceCandidatesV3 {
  characterId: string;
  fieldKey: string;
  label: string;
  originalFormula: string;
  references: string[];
  referenceValues: Record<string, number>;
  templateId: string;
  templateFingerprint: string;
}

export interface DiceTogetherTemplateDiceSetV3 {
  id: string;
  name: string;
  builtIn: boolean;
  source: 'template' | 'default-d20';
  dice: Array<{ count: number; sides: number; name?: string; colour?: string }>;
  crit: 'natural' | 'roll-under' | 'doubles' | 'high-total' | 'none';
  explode?: { dice: 'default' | 'all'; repeats: boolean; highFaces: number; lowFaces: number };
  advantage?: { kind: 'keep'; tensOnly?: true } | { kind: 'number'; value: number } | { kind: 'die'; sides: number; name?: string; colour?: string };
  disadvantage?: { kind: 'keep'; tensOnly?: true } | { kind: 'number'; value: number } | { kind: 'die'; sides: number; name?: string; colour?: string };
}

export interface DiceTogetherTemplateRollDescriptorV1 {
  templateId: string;
  templateName: string;
  /** Count of formula-backed Dice Fields that can be executed from the Template; editable Dice Fields without diceFormula are excluded. */
  diceFieldCount: number;
  duplicateId: boolean;
  valid: boolean;
}

export interface DiceTogetherTemplateRollDescriptorPageV1 {
  offset: number;
  limit: number;
  total: number;
  items: DiceTogetherTemplateRollDescriptorV1[];
}

export interface DiceTogetherTemplateRollContractV3 {
  version: 3;
  templateId: string;
  templateName: string;
  fingerprint: string;
  diceSetId: string | null;
  diceSetFingerprint: string;
  diceSetAvailable: boolean;
  /** Rest-only identity; does not include custom Dice Set configuration. */
  restFingerprint: string;
  headerHitPoints: JsonRecord | null;
  fieldKeys: string[];
  fields: JsonRecord[];
  diceFields: DiceTogetherTemplateDiceFieldV3[];
  diceSet: DiceTogetherTemplateDiceSetV3;
  recovery: unknown[];
  layoutBlocks: Array<Record<string, unknown>>;
}

export interface DiceTogetherAtlasRollResult {
  id: string;
  timestamp: number;
  formula: string;
  rolls: Array<Record<string, unknown>>;
  modifiers: number;
  total: number;
  linear?: false;
  crit?: 'high' | 'low' | null;
  diceSet?: { id: string; name: string };
  advantage?: 'advantage' | 'disadvantage';
}

export interface DiceTogetherAtlasRollRequest {
  formula: string;
  diceSet?: {
    id: string; name: string; builtIn: boolean; source: 'template' | 'default-d20';
    dice: Array<{ count: number; sides: number; name?: string; colour?: string }>;
    crit: 'natural' | 'roll-under' | 'doubles' | 'high-total' | 'none';
    explode?: { dice: 'default' | 'all'; repeats: boolean; highFaces: number; lowFaces: number };
    advantage?: { kind: 'keep'; tensOnly?: true } | { kind: 'number'; value: number } | { kind: 'die'; sides: number; name?: string; colour?: string };
    disadvantage?: { kind: 'keep'; tensOnly?: true } | { kind: 'number'; value: number } | { kind: 'die'; sides: number; name?: string; colour?: string };
  };
  characterName: string;
  fieldLabel: string;
}

export interface DiceTogetherSharedRollPresentationRequest {
  characterPath: string;
  characterName: string;
  playerName: string;
  fieldLabel: string;
  result: DiceTogetherAtlasRollResult;
}

export interface DiceTogetherForgeApiV3 extends Omit<DiceTogetherForgeApiV1, 'apiVersion' | 'readCharacter' | 'prepareDiceFieldRoll'> {
  readonly apiVersion: 3;
  listTemplateRollContractDescriptors(options?: { offset?: number; limit?: number }): Promise<DiceTogetherTemplateRollDescriptorPageV1>;
  listTemplateRollContracts(): Promise<DiceTogetherTemplateRollContractV3[]>;
  /**
   * Returns the same Template identity on GM and player clients. The default is strict
   * and resolves the real Set Dice for the GM catalog; player verification may pass
   * requireDiceSet:false because the GM supplies the authoritative JSON during the session.
   */
  getTemplateRollContract(templateId: string, options?: { requireDiceSet?: boolean }): Promise<DiceTogetherTemplateRollContractV3 | null>;
  readCharacter(characterId: string): Promise<(DiceTogetherCharacterSnapshot & { templateId: string; templateFingerprint: string; templateRestFingerprint: string }) | null>;
  /** Reads only the linked Template ID. Unlike readCharacter(), this does not resolve Dice Set JSON locally. */
  readCharacterTemplateIdentity(characterId: string): Promise<{ templateId: string; revision: string } | null>;
  prepareDiceFieldRoll(characterId: string, fieldKey: string): Promise<{
    characterId: string; fieldKey: string; label: string; originalFormula: string; resolvedFormula: string; references: string[];
    referenceValues: Record<string, number>; templateId: string; templateFingerprint: string;
  } | null>;
  /** Returns all resolvable reference candidates without requiring every optional character value to exist locally. */
  collectDiceFieldReferenceCandidates(characterId: string, fieldKey: string): Promise<DiceTogetherFieldReferenceCandidatesV3 | null>;
  /** Optional: rolls via Atlas DiceTool so Atlas shows and logs the exact same GM result. */
  rollOnAtlas?(request: DiceTogetherAtlasRollRequest): Promise<DiceTogetherAtlasRollResult | null> | DiceTogetherAtlasRollResult | null;
  /** Optional: presents the host-authoritative result in the originating player's Forge window. */
  showDiceRollTogetherResult?(request: DiceTogetherSharedRollPresentationRequest): void;
  /** Refreshes the local Forge render surface after a remote Rest updates the source note. */
  refreshCharacter?(characterId: string): Promise<void> | void;
}

export interface DiceTogetherRestStoreV1 {
  version: 1;
  receipts: DiceTogetherRestReceipt[];
  pending: PendingRestJournal[];
}

export function emptyDiceTogetherRestStore(): DiceTogetherRestStoreV1 {
  return { version: 1, receipts: [], pending: [] };
}

function isPlainRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isPlainRecord(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function hash(value: string): string {
  return sha256Hex(value);
}

function revisionFor(templateText: string, frontmatter: JsonRecord): string {
  return hash(`${templateText}\n---FORGE-STATBLOCK-VALUES---\n${stableJson(frontmatter)}`);
}

function isMarkdownFile(value: unknown): value is TFile {
  return isPlainRecord(value) && typeof value.path === 'string'
    && typeof value.extension === 'string' && value.extension.toLowerCase() === 'md'
    && typeof value.basename === 'string';
}

function isForgeTemplateFile(value: unknown): value is TFile {
  return isPlainRecord(value) && typeof value.path === 'string'
    && typeof value.extension === 'string' && value.extension.toLowerCase() === 'forgetemplate';
}

function text(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
}

function readStore(value: unknown): DiceTogetherRestStoreV1 {
  if (value === undefined || value === null) return emptyDiceTogetherRestStore();
  if (!isPlainRecord(value) || value.version !== 1 || !Array.isArray(value.receipts) || !Array.isArray(value.pending)) {
    throw new Error('The saved Dice Roll Together Rest store has an unsupported or invalid version. It was preserved and will not be overwritten.');
  }
  if (value.pending.length > MAX_PENDING_TRANSACTIONS) {
    throw new Error('The saved Dice Roll Together Rest store contains too many pending transactions. It was preserved for recovery.');
  }
  const validReceipt = (item: unknown): item is DiceTogetherRestReceipt => isPlainRecord(item)
    && text(item.idempotencyKey, 128) && text(item.characterId, 2048) && text(item.revision, 128)
    && isPlainRecord(item.event) && text(item.committedAt, 64) && text(item.requestFingerprint, 128);
  const validPending = (item: unknown): item is PendingRestJournal => isPlainRecord(item)
    && text(item.idempotencyKey, 128) && text(item.fingerprint, 128) && text(item.characterId, 2048)
    && text(item.expectedRevision, 128) && isPlainRecord(item.beforeValues) && isPlainRecord(item.afterValues)
    && isPlainRecord(item.event) && text(item.preparedAt, 64);
  if (!value.receipts.every(validReceipt) || !value.pending.every(validPending)) {
    throw new Error('The saved Dice Roll Together Rest store contains invalid entries. It was preserved and will not be overwritten.');
  }
  const receipts = value.receipts.slice(-MAX_STORED_RECEIPTS).map((item) => clone(item));
  const pending = value.pending.map((item) => clone(item));
  return { version: 1, receipts, pending };
}

function validateRestEvent(event: DiceTogetherRestEvent, request: DiceTogetherRestCommitRequest): void {
  if (!text(event.actorId, 128) || !text(event.buttonId, 128) || !text(event.buttonName, 256)
    || !text(event.createdAt, 64) || !Array.isArray(event.picks) || event.picks.length > 48
    || !isPlainRecord(event.spends) || Object.keys(event.spends).length > 128
    || !Array.isArray(event.skipped) || event.skipped.length > 256
    || event.formulaRolls.length > 256) {
    throw new Error('The Rest event contains invalid metadata or exceeds the supported limits.');
  }
  for (const [key, amount] of Object.entries(event.spends)) {
    if (!text(key, 96) || !Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000) {
      throw new Error('The Rest event contains an invalid Spend selection.');
    }
  }
  for (const pick of event.picks) {
    if (!isPlainRecord(pick) || !text(pick.choice, 128) || !text(pick.action, 128)
      || (pick.forOther !== undefined && typeof pick.forOther !== 'boolean')) {
      throw new Error('The Rest event contains an invalid Player Choice.');
    }
  }
  for (const roll of event.formulaRolls) {
    if (!isPlainRecord(roll) || !text(roll.formula, 500) || !text(roll.label, 256)
      || !Number.isSafeInteger(roll.total)) {
      throw new Error('The Rest event contains an invalid formula roll.');
    }
  }
  if (event.characterId !== request.characterId || event.id !== request.idempotencyKey) {
    throw new Error('The Rest event identity does not match its commit request.');
  }
}

function eventChangedKeys(template: ForgeTemplate, event: DiceTogetherRestEvent): string[] {
  const keys = new Set<string>();
  const counterRows = new Set<string>();
  for (const change of event.counterChanges) {
    if (!text(change.field, 128) || !Number.isSafeInteger(change.row) || change.row < 0
      || !Number.isSafeInteger(change.from) || change.from < 0
      || !Number.isSafeInteger(change.to) || change.to < 0 || change.from === change.to) {
      throw new Error('The Rest event contains an invalid Counter change.');
    }
    const rowIdentity = `${change.field}:${change.row}`;
    if (counterRows.has(rowIdentity)) throw new Error('The Rest event contains a duplicate Counter row change.');
    counterRows.add(rowIdentity);
    const field = template.fields.find((candidate) => candidate.key === change.field && candidate.type === 'counters');
    if (!field) throw new Error(`The Rest event refers to an unknown Counter Field: ${change.field}.`);
    keys.add(field.key);
  }
  let selfTrackedResourceChanged = false;
  for (const change of event.resourceChanges) {
    if (!text(change.field, 128) || !Number.isSafeInteger(change.from) || !Number.isSafeInteger(change.to)
      || !Number.isSafeInteger(change.max) || change.max < 1
      || change.from < 0 || change.from > change.max || change.to < 0 || change.to > change.max
      || change.from === change.to
      || (change.direction !== 'down' && change.direction !== 'up')) {
      throw new Error('The Rest event contains an invalid Resource change.');
    }
    const resource = forgeTrackedResourceForField(template, change.field);
    if (!resource) throw new Error(`The Rest event refers to an untracked Resource Field: ${change.field}.`);
    keys.add(change.field);
    if (resource.maxField.key === resource.field.key) selfTrackedResourceChanged = true;
  }
  if (selfTrackedResourceChanged) keys.add(FORGE_RESOURCE_VALUES_KEY);
  return [...keys];
}

function subsetValues(source: JsonRecord, keys: readonly string[]): JsonRecord {
  const result: JsonRecord = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) result[key] = clone(source[key]);
  }
  return result;
}

function valuesMatch(source: JsonRecord, expected: JsonRecord, keys: readonly string[]): boolean {
  return keys.every((key) => {
    const sourceHas = Object.prototype.hasOwnProperty.call(source, key);
    const expectedHas = Object.prototype.hasOwnProperty.call(expected, key);
    return sourceHas === expectedHas && (!sourceHas || stableJson(source[key]) === stableJson(expected[key]));
  });
}

function makeSnapshotTemplate(template: ForgeTemplate): DiceTogetherCharacterSnapshot['template'] {
  return {
    fields: clone(template.fields),
    recovery: Array.isArray(template.recovery) ? clone(template.recovery) : [],
    layout: { blocks: Array.isArray(template.layout.blocks) ? clone(template.layout.blocks) as Array<Record<string, unknown>> : [] },
    ...(isPlainRecord(template.header) ? { header: clone(template.header) } : {}),
  };
}

/**
 * Public, versioned integration provider for Dice Roll Together. It only exposes
 * Forge-native Markdown statblocks and persists Rest with a write-ahead journal.
 */
export class ForgeDiceRollTogetherApi implements DiceTogetherForgeApiV3 {
  readonly apiVersion = 3 as const;
  private store: DiceTogetherRestStoreV1;
  private readonly app: App;
  private readonly persistStore: (store: DiceTogetherRestStoreV1) => Promise<void>;
  private readonly getLanguage: () => 'en' | 'pt-BR';
  private readonly presentSharedRollResult?: ForgeSharedRollResultPresenter;
  private readonly onRefreshCharacter?: (characterId: string) => Promise<void> | void;
  private readonly characterTails = new Map<string, Promise<void>>();
  private templateDescriptorCache: { signature: string; items: DiceTogetherTemplateRollDescriptorV1[] } | null = null;
  private recovering: Promise<void> | null = null;

  constructor(input: {
    app: App;
    initialStore: unknown;
    persistStore: (store: DiceTogetherRestStoreV1) => Promise<void>;
    getLanguage?: () => 'en' | 'pt-BR';
    presentSharedRollResult?: ForgeSharedRollResultPresenter;
    refreshCharacter?: (characterId: string) => Promise<void> | void;
  }) {
    this.app = input.app;
    this.store = readStore(input.initialStore);
    this.persistStore = input.persistStore;
    this.getLanguage = input.getLanguage ?? (() => 'en');
    this.presentSharedRollResult = input.presentSharedRollResult;
    this.onRefreshCharacter = input.refreshCharacter;
  }

  async refreshCharacter(characterId: string): Promise<void> {
    if (!text(characterId, 2048)) return;
    await this.onRefreshCharacter?.(characterId);
  }

  /**
   * Returns small, paginated Template metadata for session selection. This deliberately
   * does not build or serialize execution contracts; full contracts are fetched one by
   * one only after the GM selects their Template IDs.
   */
  async listTemplateRollContractDescriptors(options: { offset?: number; limit?: number } = {}): Promise<DiceTogetherTemplateRollDescriptorPageV1> {
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;
    if (!Number.isInteger(offset) || offset < 0 || offset > 5_000
      || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('The Template descriptor page request is invalid.');
    }
    const files = this.app.vault.getFiles().filter((file) => file.extension.toLowerCase() === 'forgetemplate');
    if (files.length > 5_000) throw new Error('The GM Vault contains more than 5,000 .forgetemplate files. Narrow the Vault before listing session Templates.');

    // A descriptor cache prevents each page request from reparsing the entire Vault.
    // Obsidian TFile stats change when a file is edited, renamed or replaced.
    const statEntries = files.map((file) => {
      const stat = file.stat;
      return stat && Number.isFinite(stat.mtime) && Number.isFinite(stat.size)
        ? [file.path, stat.mtime, stat.size] as const
        : null;
    });
    const cacheSignature = statEntries.every((entry) => entry !== null)
      ? JSON.stringify(statEntries.slice().sort((a, b) => String(a?.[0]).localeCompare(String(b?.[0]))))
      : null;
    let descriptors = cacheSignature && this.templateDescriptorCache?.signature === cacheSignature
      ? this.templateDescriptorCache.items
      : null;

    if (!descriptors) {
      const built: DiceTogetherTemplateRollDescriptorV1[] = [];
      const idCounts = new Map<string, number>();
      for (const file of files) {
        try {
          const templateText = await this.app.vault.cachedRead(file);
          const parsed = parseTemplateFileText(templateText, file.extension);
          if (parsed.fileFormat !== 'forge') {
            built.push({ templateId: '', templateName: file.basename.slice(0, 120) || 'Invalid Template', diceFieldCount: 0, duplicateId: false, valid: false });
            continue;
          }
          const templateId = typeof parsed.template.id === 'string' ? parsed.template.id : '';
          if (!templateId.trim() || templateId.length > 128) {
            built.push({ templateId: '', templateName: file.basename.slice(0, 120) || 'Invalid Template', diceFieldCount: 0, duplicateId: false, valid: false });
            continue;
          }
          idCounts.set(templateId, (idCounts.get(templateId) ?? 0) + 1);
          built.push({
            templateId,
            templateName: file.basename.slice(0, 120),
            diceFieldCount: parsed.template.fields.filter((field) => field.type === 'dice' && hasDiceFieldFormula(field)).length,
            duplicateId: false,
            valid: true,
          });
        } catch {
          // One malformed Template is unavailable, but does not block the rest of the catalog.
          built.push({ templateId: '', templateName: file.basename.slice(0, 120) || 'Invalid Template', diceFieldCount: 0, duplicateId: false, valid: false });
        }
      }
      for (const item of built) {
        if (item.valid && (idCounts.get(item.templateId) ?? 0) > 1) item.duplicateId = true;
      }
      built.sort((a, b) => a.templateName.localeCompare(b.templateName) || a.templateId.localeCompare(b.templateId));
      descriptors = built;
      if (cacheSignature) this.templateDescriptorCache = { signature: cacheSignature, items: built };
    }

    return { offset, limit, total: descriptors.length, items: descriptors.slice(offset, offset + limit).map((item) => ({ ...item })) };
  }

  async listTemplateRollContracts(): Promise<DiceTogetherTemplateRollContractV3[]> {
    const files = this.app.vault.getFiles().filter((file) => file.extension.toLowerCase() === 'forgetemplate');
    const contracts: DiceTogetherTemplateRollContractV3[] = [];
    const ids = new Set<string>();
    for (const file of files) {
      const templateText = await this.app.vault.cachedRead(file);
      const parsed = parseTemplateFileText(templateText, file.extension);
      if (parsed.fileFormat !== 'forge') continue;
      const contract = await this.buildTemplateRollContract(parsed.template, file.basename);
      if (ids.has(contract.templateId)) throw new Error(`The GM Vault contains duplicate Forge Template IDs: ${contract.templateId}.`);
      ids.add(contract.templateId);
      contracts.push(contract);
    }
    return contracts.sort((a, b) => a.templateName.localeCompare(b.templateName));
  }

  async getTemplateRollContract(templateId: string, options: { requireDiceSet?: boolean } = {}): Promise<DiceTogetherTemplateRollContractV3 | null> {
    if (!text(templateId, 128)) return null;
    const matches: DiceTogetherTemplateRollContractV3[] = [];
    for (const file of this.app.vault.getFiles()) {
      if (file.extension.toLowerCase() !== 'forgetemplate') continue;
      let parsed: ReturnType<typeof parseTemplateFileText>;
      try {
        const templateText = await this.app.vault.cachedRead(file);
        parsed = parseTemplateFileText(templateText, file.extension);
      } catch {
        // A malformed, unrelated Template must not prevent the GM from using
        // another valid Template chosen for this session.
        continue;
      }
      if (parsed.fileFormat !== 'forge' || parsed.template.id !== templateId) continue;
      // GM session selection remains strict: the host must possess the custom Set Dice JSON.
      // Player profile verification may request a Template-only contract because the GM owns Set Dice.
      matches.push(await this.buildTemplateRollContract(parsed.template, file.basename, { requireDiceSet: options.requireDiceSet ?? true }));
    }
    if (matches.length > 1) throw new Error(`The GM Vault contains duplicate Forge Template IDs: ${templateId}.`);
    return matches[0] ?? null;
  }

  private async buildTemplateRollContract(
    template: ForgeTemplate,
    templateName: string,
    options: { requireDiceSet?: boolean } = {},
  ): Promise<DiceTogetherTemplateRollContractV3> {
    const diceSetId = typeof template.diceSetId === 'string' && template.diceSetId.trim() ? template.diceSetId.trim() : null;
    const resolvedDiceSet = await this.resolveTemplateDiceSet(template, options.requireDiceSet ?? true);
    const diceSet = resolvedDiceSet.diceSet;
    const fields = clone(template.fields) as JsonRecord[];
    // A `dice` Field without a configured Template diceFormula is an editable character value, not a GM-authorized execution formula.
    // Keep it in `fields`/`fieldKeys`, but omit it from the executable Dice Field contract.
    const diceFields = template.fields.filter((field) => field.type === 'dice' && hasDiceFieldFormula(field)).map((field) => ({
      fieldKey: field.key,
      label: field.label || field.key,
      formula: diceFieldFormula(field),
      references: diceFieldFormulaReferences(diceFieldFormula(field), template.fields),
    }));
    const headerHitPoints = isPlainRecord(template.header?.hitPoints) ? clone(template.header.hitPoints) : null;
    const contract = {
      version: 3 as const,
      templateId: template.id,
      templateName,
      fingerprint: '',
      diceSetId,
      diceSetFingerprint: hash(stableJson(diceSet)),
      diceSetAvailable: resolvedDiceSet.available,
      restFingerprint: '',
      headerHitPoints,
      fieldKeys: template.fields.map((field) => field.key),
      fields,
      diceFields,
      diceSet,
      recovery: Array.isArray(template.recovery) ? clone(template.recovery) : [],
      layoutBlocks: Array.isArray(template.layout?.blocks) ? clone(template.layout.blocks) as Array<Record<string, unknown>> : [],
    };
    contract.fingerprint = hash(stableJson({
      templateId: contract.templateId,
      fieldKeys: contract.fieldKeys,
      fields: contract.fields,
      diceSetId: contract.diceSetId,
      diceFields: contract.diceFields,
      recovery: contract.recovery,
      layoutBlocks: contract.layoutBlocks,
    }));
    contract.restFingerprint = hash(stableJson({
      templateId: contract.templateId,
      fieldKeys: contract.fieldKeys,
      fields: contract.fields,
      recovery: contract.recovery,
      layoutBlocks: contract.layoutBlocks,
      headerHitPoints: contract.headerHitPoints,
    }));
    return contract;
  }

  private async resolveTemplateDiceSet(
    template: ForgeTemplate,
    requireAvailable: boolean,
  ): Promise<{ diceSet: DiceTogetherTemplateDiceSetV3; available: boolean }> {
    const id = typeof template.diceSetId === 'string' ? template.diceSetId.trim() : '';
    const fallbackId = 'builtin:d20';
    const setId = id || fallbackId;
    let set: ForgeRestDiceSet | null = forgeRestDiceSetById(setId);
    if (!set && id) {
      const lookup = await findForgeRestDiceSetInVault(this.app, id);
      set = lookup.set;
      if (!set && requireAvailable) {
        if (lookup.invalidSourcePath) {
          throw new Error(`Template "${template.id}" references Dice Set "${id}", but the matching JSON at "${lookup.invalidSourcePath}" has an invalid Dice Set structure. Check its id, name, dice groups, crit and advantage/disadvantage rules.`);
        }
        throw new Error(`Template "${template.id}" references custom Dice Set "${id}", but no valid matching JSON was found under atlas-vtt/dice-sets/. The host will not silently substitute d20. Diagnostic: ${lookup.diagnostic ?? 'No further details were returned.'}`);
      }
    }
    if (!set && requireAvailable) throw new Error(`Template "${template.id}" references Dice Set "${id}" but the GM Vault does not contain a valid matching set. The host will not silently substitute d20.`);
    if (!set) {
      // Player-side display/profile checks need only the .forgetemplate definition.
      // This placeholder is never used to roll; the DRT host supplies its trusted Set Dice.
      return {
        available: false,
        diceSet: {
          id: setId, name: 'GM-authoritative Set Dice', builtIn: !id,
          source: id ? 'template' : 'default-d20',
          dice: [{ count: 1, sides: 20 }], crit: 'natural',
        },
      };
    }
    return {
      available: true,
      diceSet: {
        id: set.id, name: set.name, builtIn: set.builtIn,
        source: id ? 'template' : 'default-d20',
        dice: set.dice.map((die) => ({ ...die })), crit: set.crit,
        ...(set.explode ? { explode: { ...set.explode } } : {}),
        ...(set.advantage ? { advantage: { ...set.advantage } } : {}),
        ...(set.disadvantage ? { disadvantage: { ...set.disadvantage } } : {}),
      },
    };
  }

  async listCharacters(): Promise<Array<{ id: string; name: string; sourcePath?: string }>> {
    await this.ensureRecovered();
    const files = this.app.vault.getMarkdownFiles();
    const characters: Array<{ id: string; name: string; sourcePath?: string }> = [];
    for (const file of files) {
      try {
        const snapshot = await this.loadContext(file.path);
        if (!snapshot) continue;
        const nameField = headerFieldForPart(snapshot.template.fields, 'name');
        const rawName = nameField ? snapshot.data[nameField.key] : undefined;
        characters.push({ id: file.path, name: typeof rawName === 'string' && rawName.trim() ? rawName.trim() : file.basename, sourcePath: file.path });
      } catch {
        // One malformed or detached note must not prevent other Forge characters from appearing.
      }
    }
    return characters.sort((left, right) => left.name.localeCompare(right.name));
  }

  async readCharacter(characterId: string): Promise<(DiceTogetherCharacterSnapshot & { templateId: string; templateFingerprint: string }) | null> {
    await this.ensureRecovered();
    const context = await this.loadContext(characterId);
    if (!context) return null;
    const contract = await this.buildTemplateRollContract(context.template, context.templateFile.basename, { requireDiceSet: false });
    return { ...clone(context.snapshot), templateId: contract.templateId, templateFingerprint: contract.fingerprint, templateRestFingerprint: contract.restFingerprint };
  }

  /**
   * Returns the linked Template ID without resolving its Set Dice. Dice Roll Together
   * uses this to ask the GM host for the session-approved Set Dice, so players do not
   * need copies of custom Dice Set JSON in their own Vault.
   */
  async readCharacterTemplateIdentity(characterId: string): Promise<{ templateId: string; revision: string } | null> {
    const context = await this.loadContext(characterId);
    if (!context) return null;
    const templateId = typeof context.template.id === 'string' ? context.template.id.trim() : '';
    if (!templateId || templateId.length > 128 || !text(context.snapshot.revision, 128)) return null;
    // This lightweight descriptor deliberately does not resolve the local Dice Set JSON.
    // The GM host owns the session-approved Dice Set and is the only machine that needs it.
    return { templateId, revision: context.snapshot.revision };
  }

  async resolveRestNumericFields(
    characterId: string,
    snapshot: DiceTogetherCharacterSnapshot,
  ): Promise<Record<string, number | null>> {
    const current = await this.readCharacter(characterId);
    if (!current || current.revision !== snapshot.revision) throw new Error('The Forge character changed before numeric Rest values could be resolved. Reload it and try again.');
    // Use the latest Forge snapshot after the revision guard. The Rest profile must
    // carry the Number/Rating value visible on the statblock, not a formula Field's
    // editable frontmatter input (which may be stale or intentionally absent).
    const fields = current.template.fields;
    const data = current.data;
    const template = current.template as unknown as ForgeTemplate;
    const tableReferences = tableCellReferenceIndex((template.layout?.blocks ?? []) as ForgeTemplate['layout']['blocks']);
    return resolveDisplayedNumericFieldValues(fields, data, tableReferences, data);
  }

  /**
   * Collects the values the player's local character currently exposes for a Dice
   * Field. This is deliberately partial: a missing/optional/unresolved value is
   * omitted so the GM can verify it from the authoritative sheet instead of the
   * entire character approval being rejected on the player computer.
   */
  async collectDiceFieldReferenceCandidates(characterId: string, fieldKey: string): Promise<DiceTogetherFieldReferenceCandidatesV3 | null> {
    const context = await this.loadContext(characterId);
    if (!context) throw new Error('The selected Forge statblock is no longer available.');
    const field = context.template.fields.find((candidate) => candidate.key === fieldKey && candidate.type === 'dice');
    if (!field) return null;
    const originalFormula = diceFieldFormula(field);
    if (!originalFormula.trim()) return null;
    const references = [...new Set(diceFieldFormulaReferences(originalFormula, context.template.fields))];
    if (references.length > 80) throw new Error(`Dice Field ${fieldKey} uses more than 80 references; simplify its formula before submitting it.`);
    const tableReferences = tableCellReferenceIndex(context.template.layout.blocks);
    const referenceValues: Record<string, number> = {};
    for (const reference of references) {
      const value = evaluatePreviewFormula(`{${reference}}`, context.data, undefined,
        context.template.fields, tableReferences, context.data);
      if (typeof value === 'number' && Number.isSafeInteger(value) && Math.abs(value) <= 1_000_000_000) {
        referenceValues[reference] = value;
      }
    }
    const templateContract = await this.buildTemplateRollContract(context.template, context.templateFile.basename, { requireDiceSet: false });
    return {
      characterId,
      fieldKey,
      label: field.label || field.key,
      originalFormula,
      references,
      referenceValues,
      templateId: templateContract.templateId,
      templateFingerprint: templateContract.fingerprint,
    };
  }

  async prepareDiceFieldRoll(characterId: string, fieldKey: string): Promise<{
    characterId: string; fieldKey: string; label: string; originalFormula: string; resolvedFormula: string; references: string[];
    referenceValues: Record<string, number>; templateId: string; templateFingerprint: string;
  } | null> {
    const context = await this.loadContext(characterId);
    if (!context) throw new Error('The selected Forge statblock is no longer available.');
    const field = context.template.fields.find((candidate) => candidate.key === fieldKey && candidate.type === 'dice');
    if (!field) return null;
    const originalFormula = diceFieldFormula(field);
    // Ordinary roll links (including Set Dice bonus Fields) are sent as a link formula.
    // Only a configured Dice Formula needs a reference-value snapshot.
    if (!originalFormula.trim()) return null;
    const tableReferences = tableCellReferenceIndex(context.template.layout.blocks);
    const references = diceFieldFormulaReferences(originalFormula, context.template.fields);
    const referenceValues: Record<string, number> = {};
    const resolvedFormula = resolveDiceFieldFormula(field, context.template.fields, context.data, undefined, (reference) => {
      const value = evaluatePreviewFormula(`{${reference}}`, context.data, undefined,
        context.template.fields, tableReferences, context.data);
      if (typeof value !== 'number' || !Number.isSafeInteger(value)) return null;
      referenceValues[reference] = value;
      return value;
    });
    if (!resolvedFormula) throw new Error(`Dice Formula for ${fieldKey} could not be resolved with the current character values.`);
    const templateId = typeof context.template.id === 'string' ? context.template.id.trim() : '';
    if (!templateId || templateId.length > 128) throw new Error('The linked Forge Template does not have a valid ID.');
    const templateContract = await this.buildTemplateRollContract(context.template, context.templateFile.basename, { requireDiceSet: false });
    return {
      characterId, fieldKey, label: field.label || field.key,
      originalFormula, resolvedFormula, references, referenceValues,
      templateId,
      templateFingerprint: templateContract.fingerprint,
    };
  }

  async rollOnAtlas(request: DiceTogetherAtlasRollRequest): Promise<DiceTogetherAtlasRollResult | null> {
    if (!text(request.formula, 500) || !text(request.characterName, 80) || !text(request.fieldLabel, 80)) {
      throw new Error('The Atlas Dice Field roll request is invalid.');
    }
    const rawSet = request.diceSet;
    const set: ForgeRestDiceSet | undefined = rawSet ? {
      id: rawSet.id, name: rawSet.name, builtIn: rawSet.builtIn,
      dice: rawSet.dice.map((die) => ({ ...die })), crit: rawSet.crit,
      ...(rawSet.explode ? { explode: { ...rawSet.explode } } : {}),
      ...(rawSet.advantage ? { advantage: { ...rawSet.advantage } } : {}),
      ...(rawSet.disadvantage ? { disadvantage: { ...rawSet.disadvantage } } : {}),
    } : undefined;
    const result = await rollForgeDiceFieldThroughAtlas(this.app, request.formula, set, {
      characterName: request.characterName,
      fieldLabel: request.fieldLabel,
    });
    if (!result) return null;
    if (typeof result.id !== 'string' || !result.id || !Number.isFinite(result.timestamp)
      || typeof result.formula !== 'string' || !Array.isArray(result.rolls)
      || !Number.isFinite(result.modifiers) || !Number.isFinite(result.total)) {
      throw new Error('Atlas returned an incomplete Dice Field result.');
    }
    return {
      id: result.id,
      timestamp: Number(result.timestamp),
      formula: result.formula,
      rolls: result.rolls.map((die) => ({ ...die })),
      modifiers: Number(result.modifiers),
      total: Number(result.total),
      ...(result.linear === false ? { linear: false as const } : {}),
      ...(result.crit === 'high' || result.crit === 'low' ? { crit: result.crit } : { crit: null }),
      ...(isRecord(result.diceSet) && typeof result.diceSet.id === 'string' && typeof result.diceSet.name === 'string'
        ? { diceSet: { id: result.diceSet.id, name: result.diceSet.name } } : {}),
      ...(result.advantage === 'advantage' || result.advantage === 'disadvantage' ? { advantage: result.advantage } : {}),
    };
  }

  showDiceRollTogetherResult(request: DiceTogetherSharedRollPresentationRequest): void {
    if (!text(request.characterPath, 2048) || !text(request.characterName, 80)
      || !text(request.playerName, 80) || !text(request.fieldLabel, 100)
      || !isRecord(request.result) || !text(request.result.formula, 500)
      || !Array.isArray(request.result.rolls) || request.result.rolls.length > 120
      || !Number.isFinite(request.result.total) || !Number.isFinite(request.result.modifiers)) {
      throw new Error('The shared Forge dice result cannot be displayed because its data is invalid.');
    }
    const diceSet = request.result.diceSet
      && text(request.result.diceSet.id, 128) && text(request.result.diceSet.name, 80)
      ? { id: request.result.diceSet.id, name: request.result.diceSet.name }
      : { id: 'dice-roll-together', name: 'Dice Roll Together' };
    const result: ForgeOffMapDiceRollResult = {
      id: request.result.id,
      timestamp: request.result.timestamp,
      formula: request.result.formula,
      rolls: request.result.rolls.filter(isRecord).map((die) => ({ ...die })) as ForgeOffMapDiceRollResult['rolls'],
      modifiers: Number(request.result.modifiers),
      total: Number(request.result.total),
      crit: request.result.crit === 'high' || request.result.crit === 'low' ? request.result.crit : null,
      diceSet,
      ...(request.result.advantage === 'advantage' || request.result.advantage === 'disadvantage'
        ? { advantage: request.result.advantage } : {}),
      player: request.playerName,
      source: {
        type: 'statblock',
        statblockPath: request.characterPath,
        tokenName: request.characterName,
        abilityName: request.fieldLabel,
      },
    };
    const pt = this.getLanguage() === 'pt-BR';
    const footer = pt
      ? 'Rolagem compartilhada pelo Dice Roll Together · resultado calculado pelo host'
      : 'Shared by Dice Roll Together · result calculated by the host';
    if (!this.presentSharedRollResult) throw new Error('The Forge result dialog is not available on this computer.');
    this.presentSharedRollResult(result, footer);
  }

  async findRestReceipt(idempotencyKey: string): Promise<DiceTogetherRestReceipt | null> {
    if (!text(idempotencyKey, 128)) return null;
    await this.ensureRecovered();
    const receipt = this.store.receipts.find((entry) => entry.idempotencyKey === idempotencyKey);
    return receipt ? clone(receipt) : null;
  }

  async commitRest(request: DiceTogetherRestCommitRequest): Promise<DiceTogetherRestReceipt> {
    if (!text(request.idempotencyKey, 128) || !text(request.characterId, 2048)
      || !text(request.expectedRevision, 128) || !isPlainRecord(request.nextData)
      || !isPlainRecord(request.event) || request.event.type !== 'rest.completed'
      || !Array.isArray(request.event.counterChanges) || !Array.isArray(request.event.resourceChanges)
      || !Array.isArray(request.event.picks) || !Array.isArray(request.event.formulaRolls)
      || request.event.id !== request.idempotencyKey || request.event.characterId !== request.characterId) {
      throw new Error('The Rest commit request is invalid.');
    }
    validateRestEvent(request.event, request);
    await this.ensureRecovered();
    return this.withCharacterLock(request.characterId, async () => {
      await this.ensureRecovered();
      const existing = this.store.receipts.find((entry) => entry.idempotencyKey === request.idempotencyKey);
      if (existing) {
        if (this.fingerprintFromReceipt(existing) !== this.fingerprintFromRequest(request)) {
          throw new Error('This Rest idempotency key was already used for a different request.');
        }
        return clone(existing);
      }
      if (this.store.pending.some((entry) => entry.idempotencyKey === request.idempotencyKey)) {
        throw new Error('A previous Rest transaction with this key is still awaiting recovery.');
      }
      const context = await this.loadContext(request.characterId);
      if (!context) throw new Error('The selected Forge statblock is no longer available.');
      if (context.snapshot.revision !== request.expectedRevision) throw new Error('The Forge character changed during Rest. Reload the character and review the Rest again.');
      const keys = eventChangedKeys(context.template, request.event);
      const beforeValues = subsetValues(context.frontmatter, keys);
      const afterValues = subsetValues(request.nextData, keys);
      const fingerprint = this.fingerprintFromRequest(request);
      const pending: PendingRestJournal = {
        idempotencyKey: request.idempotencyKey,
        fingerprint,
        characterId: request.characterId,
        expectedRevision: request.expectedRevision,
        beforeValues,
        afterValues,
        event: clone(request.event),
        preparedAt: new Date().toISOString(),
      };
      await this.replaceStore({ ...this.store, pending: [...this.store.pending, pending].slice(-MAX_PENDING_TRANSACTIONS) });

      let committedRevision: string | undefined;
      try {
        const file = context.note;
        await this.app.fileManager.processFrontMatter(file, (frontmatter: unknown) => {
          if (!isPlainRecord(frontmatter)) throw new Error('The Forge statblock frontmatter is invalid.');
          const latestRevision = revisionFor(context.templateText, frontmatter);
          if (latestRevision !== request.expectedRevision) throw new Error('The Forge character changed during Rest. Reload the character and review the Rest again.');
          if (!valuesMatch(frontmatter, beforeValues, keys)) throw new Error('The tracked Resources or Counters changed before Rest could be committed.');
          for (const key of keys) {
            if (Object.prototype.hasOwnProperty.call(afterValues, key)) frontmatter[key] = clone(afterValues[key]);
            else delete frontmatter[key];
          }
          // This marker makes even no-op Rest operations recoverable if Obsidian writes
          // the note but the plugin data.json receipt write is interrupted.
          frontmatter[DICE_ROLL_TOGETHER_REST_MARKER_KEY] = request.idempotencyKey;
          committedRevision = revisionFor(context.templateText, frontmatter);
        });
      } catch (error) {
        await this.ensureRecovered().catch(() => undefined);
        const recovered = this.store.receipts.find((entry) => entry.idempotencyKey === request.idempotencyKey);
        if (recovered) return clone(recovered);
        throw error;
      }

      await this.finalizePending(request.idempotencyKey, committedRevision);
      const receipt = this.store.receipts.find((entry) => entry.idempotencyKey === request.idempotencyKey);
      if (!receipt) throw new Error('The Rest was written, but its durable receipt is awaiting recovery. Do not repeat it with a new request ID.');
      return clone(receipt);
    });
  }


  private async loadContext(characterId: string): Promise<{
    note: TFile;
    templateFile: TFile;
    templateText: string;
    template: ForgeTemplate;
    frontmatter: JsonRecord;
    snapshot: DiceTogetherCharacterSnapshot;
    data: JsonRecord;
  } | null> {
    if (!text(characterId, 2048)) return null;
    const candidate = this.app.vault.getAbstractFileByPath(characterId);
    if (!isMarkdownFile(candidate)) return null;
    await this.app.vault.cachedRead(candidate);
    const resolution = await resolveForgeTemplateForNote(this.app, candidate);
    if (resolution.status !== 'linked' || !isForgeTemplateFile(resolution.file)) return null;
    const templateText = await this.app.vault.cachedRead(resolution.file);
    const parsed = parseTemplateFileText(templateText, resolution.file.extension);
    if (parsed.fileFormat !== 'forge') return null;
    const frontmatter = this.app.metadataCache.getFileCache(candidate)?.frontmatter;
    if (!isPlainRecord(frontmatter)) return null;
    const loaded = createLoadedStatblockSource({
      path: candidate.path,
      basename: candidate.basename,
      format: 'markdown-frontmatter',
      raw: frontmatter,
      template: parsed.template,
    });
    const data = forgeRestDataWithResources(loaded.binding.data, frontmatter);
    const snapshot: DiceTogetherCharacterSnapshot = {
      characterId: candidate.path,
      revision: revisionFor(templateText, frontmatter),
      template: makeSnapshotTemplate(parsed.template),
      data: clone(data),
    };
    return {
      note: candidate,
      templateFile: resolution.file,
      templateText,
      template: parsed.template,
      frontmatter: clone(frontmatter),
      snapshot,
      data,
    };
  }

  private async ensureRecovered(): Promise<void> {
    if (this.recovering) return this.recovering;
    this.recovering = this.recoverPendingTransactions().finally(() => { this.recovering = null; });
    return this.recovering;
  }

  private async recoverPendingTransactions(): Promise<void> {
    for (const pending of [...this.store.pending]) {
      const context = await this.loadContext(pending.characterId).catch(() => null);
      if (!context) continue;
      const keys = [...new Set([...Object.keys(pending.beforeValues), ...Object.keys(pending.afterValues)])];
      const marker = context.frontmatter[DICE_ROLL_TOGETHER_REST_MARKER_KEY];
      const committed = marker === pending.idempotencyKey || valuesMatch(context.frontmatter, pending.afterValues, keys);
      const untouched = valuesMatch(context.frontmatter, pending.beforeValues, keys);
      if (committed) {
        await this.finalizePending(pending.idempotencyKey, context.snapshot.revision);
      } else if (untouched) {
        const next = { ...this.store, pending: this.store.pending.filter((item) => item.idempotencyKey !== pending.idempotencyKey) };
        await this.replaceStore(next);
      }
      // A mixed state is deliberately left pending. Never guess whether an external edit
      // should be overwritten or whether a partially completed write should be replayed.
    }
  }

  private async finalizePending(idempotencyKey: string, knownRevision?: string): Promise<void> {
    const pending = this.store.pending.find((entry) => entry.idempotencyKey === idempotencyKey);
    if (!pending) return;
    const context = knownRevision ? null : await this.loadContext(pending.characterId);
    if (!knownRevision && !context) throw new Error('The statblock disappeared before its Rest receipt could be finalized.');
    const receipt: DiceTogetherRestReceipt = {
      idempotencyKey,
      characterId: pending.characterId,
      revision: knownRevision ?? context!.snapshot.revision,
      event: clone(pending.event),
      committedAt: new Date().toISOString(),
      requestFingerprint: pending.fingerprint,
    };
    const receipts = [receipt, ...this.store.receipts.filter((item) => item.idempotencyKey !== idempotencyKey)].slice(0, MAX_STORED_RECEIPTS);
    const next = {
      ...this.store,
      receipts,
      pending: this.store.pending.filter((item) => item.idempotencyKey !== idempotencyKey),
    };
    await this.replaceStore(next);
  }

  private async replaceStore(next: DiceTogetherRestStoreV1): Promise<void> {
    const bounded = readStore(next);
    const previous = this.store;
    this.store = bounded;
    try {
      await this.persistStore(clone(bounded));
    } catch (error) {
      this.store = previous;
      throw error;
    }
  }

  private fingerprintFromRequest(request: DiceTogetherRestCommitRequest): string {
    return hash(stableJson({
      characterId: request.characterId,
      expectedRevision: request.expectedRevision,
      nextData: request.nextData,
      event: request.event,
    }));
  }

  private fingerprintFromReceipt(receipt: DiceTogetherRestReceipt): string {
    return receipt.requestFingerprint;
  }

  private async withCharacterLock<T>(characterId: string, action: () => Promise<T>): Promise<T> {
    const previous = this.characterTails.get(characterId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const tail = previous.then(() => gate);
    this.characterTails.set(characterId, tail);
    await previous;
    try { return await action(); }
    finally {
      release();
      if (this.characterTails.get(characterId) === tail) this.characterTails.delete(characterId);
    }
  }
}

export function isDiceTogetherRestStore(value: unknown): value is DiceTogetherRestStoreV1 {
  return isPlainRecord(value) && value.version === 1
    && Array.isArray(value.receipts) && Array.isArray(value.pending);
}
