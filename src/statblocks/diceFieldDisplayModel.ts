import type { ForgeField } from '../templates/forgeTemplate.ts';

export const DICE_FIELD_DISPLAY_ICON_SIDES = [4, 6, 8, 10, 12, 20] as const;
export type DiceFieldDisplayIconSides = typeof DICE_FIELD_DISPLAY_ICON_SIDES[number];
export type DiceFieldDisplayMode = 'formula' | 'icon' | 'text';

export interface DiceFieldDisplaySettings {
  mode: DiceFieldDisplayMode;
  iconSides: DiceFieldDisplayIconSides;
  text: string;
}

const DEFAULT_ICON_SIDES: DiceFieldDisplayIconSides = 6;
const MAX_DISPLAY_TEXT_LENGTH = 40;

function isDiceFieldDisplayIconSides(value: unknown): value is DiceFieldDisplayIconSides {
  return typeof value === 'number'
    && (DICE_FIELD_DISPLAY_ICON_SIDES as readonly number[]).includes(value);
}

/** Reads the optional visual override. Legacy Dice Fields continue to show their formula. */
export function getDiceFieldDisplaySettings(field: ForgeField): DiceFieldDisplaySettings {
  const mode = field.diceDisplayMode === 'icon' || field.diceDisplayMode === 'text'
    ? field.diceDisplayMode
    : 'formula';
  return {
    mode,
    iconSides: isDiceFieldDisplayIconSides(field.diceDisplayIconSides)
      ? field.diceDisplayIconSides
      : DEFAULT_ICON_SIDES,
    text: typeof field.diceDisplayText === 'string'
      ? field.diceDisplayText.slice(0, MAX_DISPLAY_TEXT_LENGTH)
      : '',
  };
}

export function setDiceFieldDisplayMode(field: ForgeField, mode: DiceFieldDisplayMode): void {
  if (mode === 'formula') {
    delete field.diceDisplayMode;
    delete field.diceDisplayIconSides;
    delete field.diceDisplayText;
    return;
  }
  field.diceDisplayMode = mode;
  if (mode === 'icon') {
    delete field.diceDisplayText;
    if (!isDiceFieldDisplayIconSides(field.diceDisplayIconSides)) {
      field.diceDisplayIconSides = DEFAULT_ICON_SIDES;
    }
  } else {
    delete field.diceDisplayIconSides;
  }
}

export function setDiceFieldDisplayIconSides(field: ForgeField, sides: number): boolean {
  if (!isDiceFieldDisplayIconSides(sides)) return false;
  field.diceDisplayMode = 'icon';
  field.diceDisplayIconSides = sides;
  delete field.diceDisplayText;
  return true;
}

export function setDiceFieldDisplayText(field: ForgeField, text: string): void {
  field.diceDisplayMode = 'text';
  field.diceDisplayText = text.slice(0, MAX_DISPLAY_TEXT_LENGTH);
  delete field.diceDisplayIconSides;
}

/** Clears display-only metadata when a Field stops being a Dice Field. */
export function clearDiceFieldDisplaySettings(field: ForgeField): void {
  delete field.diceDisplayMode;
  delete field.diceDisplayIconSides;
  delete field.diceDisplayText;
}
