import { isRecord, type ForgeField, type JsonRecord } from './forgeTemplate.ts';

export interface CheckboxFieldOption {
  /** Stable boolean property stored inside the Field value object. */
  key: string;
  /** Human-readable name shown beside the checkbox. */
  label: string;
  /** Older keys retained to preserve values after an option is renamed. */
  aliases?: string[];
}

const OPTION_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

export interface CheckboxFieldOptionValidationIssue {
  fieldKey: string;
  optionIndex: number;
  code: 'malformed-option' | 'invalid-key' | 'duplicate-key' | 'invalid-alias' | 'duplicate-alias' | 'key-alias-conflict';
  message: string;
}

/** Diagnose legacy/imported checkbox key and alias collisions without mutating any values. */
export function validateCheckboxFieldOptions(fields: readonly ForgeField[]): CheckboxFieldOptionValidationIssue[] {
  const issues: CheckboxFieldOptionValidationIssue[] = [];
  for (const field of fields) {
    if (field.type !== 'checkboxes' || field.options === undefined) continue;
    if (!Array.isArray(field.options)) {
      issues.push({ fieldKey: field.key, optionIndex: -1, code: 'malformed-option', message: `As opções do Field "${field.label}" não estão em uma lista válida.` });
      continue;
    }
    const owners = new Map<string, { index: number; kind: 'key' | 'alias' }>();
    field.options.forEach((raw, optionIndex) => {
      if (!isRecord(raw)) {
        issues.push({ fieldKey: field.key, optionIndex, code: 'malformed-option', message: `A opção ${optionIndex + 1} de "${field.label}" possui estrutura inválida.` });
        return;
      }
      const key = typeof raw.key === 'string' ? raw.key.trim().toLowerCase() : '';
      if (!OPTION_KEY_PATTERN.test(key)) {
        issues.push({ fieldKey: field.key, optionIndex, code: 'invalid-key', message: `A key da opção ${optionIndex + 1} em "${field.label}" é inválida.` });
      } else {
        const previous = owners.get(key);
        if (previous) {
          issues.push({ fieldKey: field.key, optionIndex, code: previous.kind === 'key' ? 'duplicate-key' : 'key-alias-conflict', message: `A key "${key}" da opção ${optionIndex + 1} em "${field.label}" conflita com ${previous.kind === 'key' ? 'outra opção' : 'um alias'}.` });
        } else owners.set(key, { index: optionIndex, kind: 'key' });
      }

      if (raw.aliases !== undefined && !Array.isArray(raw.aliases)) {
        issues.push({ fieldKey: field.key, optionIndex, code: 'invalid-alias', message: `Os aliases da opção ${optionIndex + 1} em "${field.label}" precisam ser uma lista.` });
        return;
      }
      const localAliases = new Set<string>();
      for (const rawAlias of Array.isArray(raw.aliases) ? raw.aliases : []) {
        const alias = typeof rawAlias === 'string' ? rawAlias.trim().toLowerCase() : '';
        if (!OPTION_KEY_PATTERN.test(alias)) {
          issues.push({ fieldKey: field.key, optionIndex, code: 'invalid-alias', message: `Um alias da opção ${optionIndex + 1} em "${field.label}" é inválido.` });
          continue;
        }
        if (alias === key) {
          issues.push({ fieldKey: field.key, optionIndex, code: 'key-alias-conflict', message: `O alias "${alias}" repete a key da própria opção em "${field.label}".` });
          continue;
        }
        if (localAliases.has(alias)) {
          issues.push({ fieldKey: field.key, optionIndex, code: 'duplicate-alias', message: `O alias "${alias}" aparece mais de uma vez na opção ${optionIndex + 1} de "${field.label}".` });
          continue;
        }
        localAliases.add(alias);
        const previous = owners.get(alias);
        if (previous) {
          issues.push({ fieldKey: field.key, optionIndex, code: 'key-alias-conflict', message: `O alias "${alias}" da opção ${optionIndex + 1} em "${field.label}" conflita com ${previous.kind === 'key' ? 'a key' : 'outro alias'} da opção ${previous.index + 1}.` });
        } else owners.set(alias, { index: optionIndex, kind: 'alias' });
      }
    });
  }
  return issues;
}

export function checkboxFieldOptions(field: ForgeField): CheckboxFieldOption[] {
  if (field.type !== 'checkboxes' || !Array.isArray(field.options)) return [];
  return field.options.filter((option): option is CheckboxFieldOption => isRecord(option)
    && typeof option.key === 'string' && OPTION_KEY_PATTERN.test(option.key)
    && typeof option.label === 'string')
    .map((option) => ({
      key: option.key,
      label: option.label,
      ...(Array.isArray(option.aliases)
        ? { aliases: option.aliases.flatMap((alias): string[] => {
          if (typeof alias !== 'string') return [];
          const normalized = alias.trim().toLowerCase();
          return OPTION_KEY_PATTERN.test(normalized) ? [normalized] : [];
        }) }
        : {}),
    }));
}

export function checkboxOptionKeyFromLabel(label: string): string {
  const normalized = label.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  return /^[a-z]/.test(normalized) ? normalized : `option_${normalized}`.slice(0, 40);
}

export function uniqueCheckboxOptionKey(field: ForgeField, preferred: string): string {
  const base = checkboxOptionKeyFromLabel(preferred) || 'option';
  const used = new Set(checkboxFieldOptions(field).flatMap((option) => [option.key, ...(option.aliases ?? [])]).map((key) => key.toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  for (let suffix = 2; suffix < 10000; suffix += 1) {
    const candidate = `${base.slice(0, 40 - String(suffix).length - 1)}_${suffix}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  throw new Error('Não foi possível gerar uma key exclusiva para a opção.');
}

export function newCheckboxFieldOption(field: ForgeField, label = 'Nova opção'): CheckboxFieldOption {
  return { key: uniqueCheckboxOptionKey(field, label), label };
}

export interface CheckboxFieldKeyRepair {
  from: string;
  to: string;
  optionIndex: number;
}

/** Explicitly rebuild colliding checkbox identifiers while leaving raw values available for migration. */
export function repairCheckboxFieldOptionKeys(field: ForgeField): CheckboxFieldKeyRepair[] {
  if (field.type !== 'checkboxes' || !Array.isArray(field.options)) return [];
  const rows = field.options.map((raw, index) => {
    const option = isRecord(raw) ? raw : {};
    return {
      index,
      rawKey: typeof option.key === 'string' ? option.key : '',
      key: typeof option.key === 'string' ? option.key.trim().toLowerCase() : '',
      label: typeof option.label === 'string' ? option.label.trim().slice(0, 100) : `Option ${index + 1}`,
      rawAliases: Array.isArray(option.aliases) ? option.aliases : [],
      original: option,
    };
  });
  const usedKeys = new Set<string>();
  const repairs: CheckboxFieldKeyRepair[] = [];
  for (const row of rows) {
    const baseCandidate = OPTION_KEY_PATTERN.test(row.key) ? row.key : checkboxOptionKeyFromLabel(row.label) || `option_${row.index + 1}`;
    let candidate = baseCandidate;
    if (!OPTION_KEY_PATTERN.test(candidate) || usedKeys.has(candidate)) {
      const base = OPTION_KEY_PATTERN.test(candidate) ? candidate : `option_${row.index + 1}`;
      let suffix = 2;
      do {
        const tail = `_${suffix++}`;
        candidate = `${base.slice(0, 40 - tail.length)}${tail}`;
      } while (usedKeys.has(candidate));
    }
    row.key = candidate;
    usedKeys.add(candidate);
    if (row.rawKey !== candidate) repairs.push({ from: row.rawKey, to: candidate, optionIndex: row.index });
  }

  // Reserve every final key before considering aliases, so an old alias can
  // never shadow another option's current property.
  const claimed = new Set(usedKeys);
  const normalized = rows.map((row) => {
    const aliases = new Set<string>();
    const candidates = [...row.rawAliases, ...(row.rawKey && row.rawKey.toLowerCase() !== row.key ? [row.rawKey] : [])];
    for (const rawAlias of candidates) {
      const alias = typeof rawAlias === 'string' ? rawAlias.trim().toLowerCase() : '';
      if (!OPTION_KEY_PATTERN.test(alias) || alias === row.key || claimed.has(alias)) continue;
      aliases.add(alias);
      claimed.add(alias);
    }
    const repairedOption: JsonRecord = {
      ...row.original,
      key: row.key,
      label: row.label,
    };
    if (aliases.size > 0) repairedOption.aliases = [...aliases];
    else delete repairedOption.aliases;
    return repairedOption;
  });
  field.options = normalized;
  return repairs;
}

export function setCheckboxFieldOptions(field: ForgeField, options: readonly CheckboxFieldOption[]): boolean {
  if (field.type !== 'checkboxes') return false;
  const previous = checkboxFieldOptions(field);
  const normalized: CheckboxFieldOption[] = [];
  for (const option of options) {
    const key = typeof option.key === 'string' ? option.key.trim().toLowerCase().slice(0, 40) : '';
    const label = typeof option.label === 'string' ? option.label.trim().slice(0, 100) : '';
    if (!OPTION_KEY_PATTERN.test(key)) throw new Error(`A key "${key}" não é válida. Use letras minúsculas e números/_, começando por uma letra.`);
    const suppliedAliases = Array.isArray(option.aliases) ? option.aliases : [];
    const related = previous.find((candidate) => candidate.key.toLowerCase() === key
      || suppliedAliases.some((alias) => alias.toLowerCase() === candidate.key.toLowerCase()));
    const aliases = new Set<string>();
    for (const rawAlias of [
      ...(Array.isArray(related?.aliases) ? related.aliases : []),
      ...suppliedAliases,
      ...(related && related.key.toLowerCase() !== key ? [related.key] : []),
    ]) {
      const alias = typeof rawAlias === 'string' ? rawAlias.trim().toLowerCase() : '';
      if (!OPTION_KEY_PATTERN.test(alias)) throw new Error(`O alias "${alias}" não é válido.`);
      // The current key is authoritative; it does not need to be retained as its own alias.
      if (alias !== key) aliases.add(alias);
    }
    normalized.push({ key, label, ...(aliases.size ? { aliases: [...aliases] } : {}) });
  }

  // Keys and aliases share the same namespace. A value key must resolve to one
  // option only; otherwise normalization could delete or transfer another option's value.
  const ownerByToken = new Map<string, number>();
  normalized.forEach((option, index) => {
    for (const token of [option.key, ...(option.aliases ?? [])]) {
      const normalizedToken = token.toLowerCase();
      const owner = ownerByToken.get(normalizedToken);
      if (owner !== undefined && owner !== index) {
        throw new Error(`A key/alias "${token}" está sendo usada por mais de uma opção deste Field.`);
      }
      ownerByToken.set(normalizedToken, index);
    }
  });

  if (JSON.stringify(field.options ?? []) === JSON.stringify(normalized)) return false;
  if (normalized.length > 0) field.options = normalized;
  else delete field.options;
  return true;
}

/** Each configured option is a boolean. Unknown properties are retained for forward compatibility. */
export function checkboxAliasBooleanValue(values: JsonRecord, aliases: readonly string[]): boolean | undefined {
  const accepted = new Set(aliases.map((alias) => alias.trim().toLowerCase()));
  for (const [key, value] of Object.entries(values)) {
    if (accepted.has(key.toLowerCase()) && typeof value === 'boolean') return value;
  }
  return undefined;
}

export function normalizeCheckboxFieldValue(field: ForgeField, raw: unknown): JsonRecord {
  const value = isRecord(raw) ? { ...raw } : {};
  // Ambiguous aliases can otherwise delete a different option's value during
  // normalization. Keep the raw object untouched until the schema is repaired.
  if (validateCheckboxFieldOptions([field]).length > 0) return value;
  for (const option of checkboxFieldOptions(field)) {
    const current = value[option.key];
    const aliasValue = checkboxAliasBooleanValue(value, option.aliases ?? []);
    value[option.key] = typeof current === 'boolean' ? current : typeof aliasValue === 'boolean' ? aliasValue : false;
    const aliases = new Set((option.aliases ?? []).map((alias) => alias.toLowerCase()));
    for (const existingKey of Object.keys(value)) {
      if (aliases.has(existingKey.toLowerCase())) delete value[existingKey];
    }
  }
  return value;
}

export function checkboxOptionIsEnabled(data: JsonRecord, fieldKey: string, optionKey: string): boolean {
  const fieldValue = isRecord(data[fieldKey]) ? data[fieldKey] : {};
  return fieldValue[optionKey] === true;
}

export function withCheckboxOptionValue(
  data: JsonRecord,
  field: ForgeField,
  optionKey: string,
  enabled: boolean,
): JsonRecord {
  const fieldValue = data[field.key];
  const current = isRecord(fieldValue) ? fieldValue : {};
  return { ...current, [optionKey]: enabled };
}
