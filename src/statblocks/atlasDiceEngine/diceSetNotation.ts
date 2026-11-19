/** Atlas-compatible helpers for the default dice notation used by a dice set. */
export interface DiceSetGroup {
  count: number;
  sides: number;
}

/** Parses one or more `NdS` groups joined by `+`, as Atlas does for a default roll. */
export function parseRollGroups(defaultRoll: string): DiceSetGroup[] | null {
  const parts = defaultRoll.replace(/\s+/g, '').split('+');
  const groups: DiceSetGroup[] = [];
  for (const part of parts) {
    const match = /^([1-9]\d?)?d([2-9]|[1-9]\d{1,2})$/i.exec(part);
    if (!match) return null;
    const count = Number(match[1] ?? '1');
    const sides = Number(match[2]);
    if (count < 1 || count > 20 || sides < 2 || sides > 999) return null;
    groups.push({ count, sides });
  }
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  return groups.length > 0 && groups.length <= 6 && total <= 20 ? groups : null;
}

export function setRoll(dice: readonly DiceSetGroup[]): string {
  return dice.map(({ count, sides }) => `${count}d${sides}`).join('+');
}
