/** A configurable keyboard shortcut used by Forge while its editor is active. */
export const DEFAULT_TOGGLE_STATBLOCK_MODE_SHORTCUT = 'Mod+Shift+S';

const MODIFIER_ORDER = ['Mod', 'Ctrl', 'Alt', 'Shift'] as const;
type ShortcutModifier = typeof MODIFIER_ORDER[number];

function normalizeKey(value: string): string {
  if (value === ' ') return 'Space';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length === 1) return trimmed.toUpperCase();
  const aliases: Record<string, string> = {
    esc: 'Escape',
    space: 'Space',
    ' ': 'Space',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    up: 'ArrowUp',
    down: 'ArrowDown',
    del: 'Delete',
    return: 'Enter',
  };
  return aliases[trimmed.toLowerCase()] ?? trimmed[0]!.toUpperCase() + trimmed.slice(1);
}

export function normalizeForgeShortcut(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_TOGGLE_STATBLOCK_MODE_SHORTCUT;
  const parts = value.split('+').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return DEFAULT_TOGGLE_STATBLOCK_MODE_SHORTCUT;
  const keyPart = parts.pop()!;
  const key = normalizeKey(keyPart);
  if (!key || ['Control', 'Alt', 'Shift', 'Meta', 'Mod'].includes(key)) return DEFAULT_TOGGLE_STATBLOCK_MODE_SHORTCUT;
  const modifiers = new Set<ShortcutModifier>();
  for (const part of parts) {
    const normalized = part.toLowerCase();
    if (normalized === 'mod' || normalized === 'cmd' || normalized === 'command' || normalized === 'meta') modifiers.add('Mod');
    else if (normalized === 'ctrl' || normalized === 'control') modifiers.add('Ctrl');
    else if (normalized === 'alt' || normalized === 'option') modifiers.add('Alt');
    else if (normalized === 'shift') modifiers.add('Shift');
  }
  if (modifiers.size === 0) return DEFAULT_TOGGLE_STATBLOCK_MODE_SHORTCUT;
  return [...MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)), key].join('+');
}

/** Convert a keydown from the settings shortcut field into its portable representation. */
export function forgeShortcutFromKeydown(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>,
  isMacOS: boolean,
): string | null {
  const key = normalizeKey(event.key);
  if (!key || ['Control', 'Alt', 'Shift', 'Meta', 'Mod'].includes(key)) return null;

  const modifiers = new Set<ShortcutModifier>();
  if (isMacOS ? event.metaKey : event.ctrlKey) modifiers.add('Mod');
  if (isMacOS && event.ctrlKey) modifiers.add('Ctrl');
  if (event.altKey) modifiers.add('Alt');
  if (event.shiftKey) modifiers.add('Shift');

  // Avoid capturing ordinary letters: they would conflict with normal editor use.
  if (modifiers.size === 0) return null;
  return normalizeForgeShortcut([...MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)), key].join('+'));
}

/** Match Mod to Cmd on macOS and Ctrl on Windows/Linux; explicit Ctrl stays physical Ctrl. */
export function matchesForgeShortcut(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>,
  shortcut: string,
  isMacOS: boolean,
): boolean {
  const normalized = normalizeForgeShortcut(shortcut);
  const parts = normalized.split('+');
  const key = parts.pop()!;
  const modifiers = new Set(parts);
  const wantsMod = modifiers.has('Mod');
  const wantsCtrl = modifiers.has('Ctrl');
  const expectedCtrl = isMacOS ? wantsCtrl : (wantsMod || wantsCtrl);
  const expectedMeta = isMacOS && wantsMod;

  if (event.ctrlKey !== expectedCtrl) return false;
  if (event.metaKey !== expectedMeta) return false;
  if (modifiers.has('Alt') !== event.altKey) return false;
  if (modifiers.has('Shift') !== event.shiftKey) return false;
  return normalizeKey(event.key).toLowerCase() === key.toLowerCase();
}
