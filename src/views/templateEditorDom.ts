/**
 * Small, shared DOM primitives used by the template editor.
 * Keep this module free of Obsidian and Vault dependencies so UI controls
 * can be reused without coupling them to the FileView lifecycle.
 */

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(text: string, onClick: () => void, secondary = false): HTMLButtonElement {
  const node = el('button', `statblock-forge__button${secondary ? ' is-secondary' : ''}`, text);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

export function inputText(value: string, placeholder = ''): HTMLInputElement {
  const input = el('input', 'statblock-forge__input');
  input.type = 'text';
  input.value = value;
  input.placeholder = placeholder;
  return input;
}


export function textareaInput(value: string, placeholder = '', rows = 3): HTMLTextAreaElement {
  const input = el('textarea', 'statblock-forge__input');
  input.value = value;
  input.placeholder = placeholder;
  input.rows = rows;
  return input;
}

export function abilityPartTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    text: 'Text', number: 'Number', dice: 'Dice', list: 'List', choice: 'Choice', counter: 'Counter',
  };
  return labels[type] ?? `${type} (não suportado)`;
}

export function abilityPartOptionsText(value: unknown): string {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').join('\n') : '';
}

export function parseAbilityPartOptions(value: string): string[] {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

export function checkboxInput(checked: boolean, onChange: (checked: boolean) => void): HTMLInputElement {
  const input = el('input', 'statblock-forge__checkbox');
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  return input;
}

export function toggleControl(label: string, checked: boolean, onChange: (checked: boolean) => void, _hint?: string): HTMLElement {
  const wrapper = el('label', 'statblock-forge__inline-toggle');
  wrapper.append(checkboxInput(checked, onChange), document.createTextNode(label));
  return wrapper;
}

export function numberInput(value: number, min: number, max?: number, step = 1): HTMLInputElement {
  const input = el('input', 'statblock-forge__input');
  input.type = 'number';
  input.min = String(min);
  if (max !== undefined && Number.isFinite(max)) input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  return input;
}

export function selectInput(value: string, options: readonly { value: string; label: string }[]): HTMLSelectElement {
  const select = el('select', 'statblock-forge__select');
  for (const option of options) {
    const node = el('option', '', option.label);
    node.value = option.value;
    node.selected = option.value === value;
    select.append(node);
  }
  return select;
}

export function labeledControl(label: string, control: HTMLElement, _hint?: string): HTMLElement {
  const wrapper = el('label', 'statblock-forge__control');
  wrapper.append(el('span', 'statblock-forge__control-label', label), control);
  return wrapper;
}

export function section(title: string, _description?: string): HTMLElement {
  const wrapper = el('section', 'statblock-forge__panel');
  wrapper.append(el('h3', 'statblock-forge__panel-title', title));
  return wrapper;
}

export function appearanceGroup(title: string, _description?: string): HTMLElement {
  const group = el('section', 'statblock-forge__appearance-group');
  group.append(el('h5', 'statblock-forge__appearance-group-heading', title));
  return group;
}

export function collapsibleAppearanceGroup(title: string, _description?: string, open = true): HTMLDetailsElement {
  const group = el('details', 'statblock-forge__appearance-group statblock-forge__appearance-group--disclosure');
  group.open = open;
  const summary = el('summary', 'statblock-forge__appearance-group-summary');
  summary.append(el('span', 'statblock-forge__appearance-group-heading', title));
  group.append(summary);
  return group;
}

export function fieldTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    value: 'Value', metric: 'Metric', abilities: 'Abilities', table: 'Table', counters: 'Counters',
    checkboxes: 'Checkboxes', image: 'Image', tags: 'Tags', pairs: 'Pairs', spells: 'Spells',
    text: 'Text', markdown: 'Markdown', number: 'Number', rating: 'Rating', dice: 'Dice', choice: 'Choice',
    list: 'List', scores: 'Tabular Data', entries: 'Entries / Abilities',
  };
  return labels[type] ?? type;
}

export const FIELD_TYPE_OPTIONS = [
  'text', 'markdown', 'number', 'rating', 'dice', 'choice', 'list', 'scores', 'entries', 'pairs', 'image', 'spells', 'counters', 'checkboxes',
].map((type) => ({ value: type, label: fieldTypeLabel(type) }));

export const FIELD_MEANING_OPTIONS = [
  { value: '', label: 'Nenhum' },
  { value: 'hit-points', label: 'Hit points' },
  { value: 'armor', label: 'Armor' },
  { value: 'rating', label: 'Rating / Level' },
  { value: 'size', label: 'Size' },
  { value: 'creature-type', label: 'Creature type' },
  { value: 'senses', label: 'Senses' },
  { value: 'initiative', label: 'Initiative' },
  { value: 'traits', label: 'Traits' },
  { value: 'description', label: 'Description' },
  { value: 'display-name', label: 'Display name' },
] as const;
