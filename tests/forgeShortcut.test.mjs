import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TOGGLE_STATBLOCK_MODE_SHORTCUT,
  forgeShortcutFromKeydown,
  matchesForgeShortcut,
  normalizeForgeShortcut,
} from '../src/settings/forgeShortcut.ts';

const keydown = (overrides = {}) => ({
  key: 'S',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...overrides,
});

test('shortcut normalization keeps modifiers in a stable portable order', () => {
  assert.equal(normalizeForgeShortcut('shift + mod + s'), 'Mod+Shift+S');
  assert.equal(normalizeForgeShortcut('option + ctrl + k'), 'Ctrl+Alt+K');
  assert.equal(normalizeForgeShortcut(''), DEFAULT_TOGGLE_STATBLOCK_MODE_SHORTCUT);
  assert.equal(normalizeForgeShortcut('S'), DEFAULT_TOGGLE_STATBLOCK_MODE_SHORTCUT);
});

test('shortcut capture maps Ctrl on Windows/Linux and Cmd on macOS to Mod', () => {
  assert.equal(forgeShortcutFromKeydown(keydown({ ctrlKey: true, shiftKey: true }), false), 'Mod+Shift+S');
  assert.equal(forgeShortcutFromKeydown(keydown({ metaKey: true, shiftKey: true }), true), 'Mod+Shift+S');
});

test('shortcut capture supports explicit Ctrl on macOS and refuses unmodified keys', () => {
  assert.equal(forgeShortcutFromKeydown(keydown({ ctrlKey: true, altKey: true }), true), 'Ctrl+Alt+S');
  assert.equal(forgeShortcutFromKeydown(keydown(), false), null);
});

test('Space is normalized consistently when capturing and matching a shortcut', () => {
  assert.equal(normalizeForgeShortcut('Mod+Space'), 'Mod+Space');
  assert.equal(forgeShortcutFromKeydown(keydown({ key: ' ', ctrlKey: true }), false), 'Mod+Space');
  assert.equal(matchesForgeShortcut(keydown({ key: ' ', ctrlKey: true }), 'Mod+Space', false), true);
});

test('Mod matches only the platform-native modifier', () => {
  const shortcut = 'Mod+Shift+S';
  assert.equal(matchesForgeShortcut(keydown({ ctrlKey: true, shiftKey: true }), shortcut, false), true);
  assert.equal(matchesForgeShortcut(keydown({ metaKey: true, shiftKey: true }), shortcut, true), true);
  assert.equal(matchesForgeShortcut(keydown({ ctrlKey: true, shiftKey: true }), shortcut, true), false);
  assert.equal(matchesForgeShortcut(keydown({ metaKey: true, shiftKey: true }), shortcut, false), false);
});

test('all required modifiers must match exactly', () => {
  assert.equal(matchesForgeShortcut(keydown({ ctrlKey: true, shiftKey: true, altKey: true }), 'Mod+Shift+S', false), false);
  assert.equal(matchesForgeShortcut(keydown({ ctrlKey: true, shiftKey: true }), 'Mod+Shift+S', false), true);
});
