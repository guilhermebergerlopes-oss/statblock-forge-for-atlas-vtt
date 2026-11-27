/** Minimal public surface exposed by Dice Roll Together to Statblock Forge. */
export interface DiceRollTogetherBridgeRequest {
  characterPath: string;
  fieldKey: string;
  formula: string;
  fieldLabel?: string;
  forceLinkFormula?: boolean;
  prependTemplateDefaultDice?: boolean;
  requestedAdvantage?: 'advantage' | 'disadvantage';
}

export interface DiceRollTogetherBridgePlugin {
  canAcceptForgeDiceRoll?: () => boolean | Promise<boolean>;
  handleForgeDiceFieldRoll?: (request: DiceRollTogetherBridgeRequest) => boolean | Promise<boolean>;
}

/**
 * Routes a Forge roll to the active DRT session. `false` means there is no DRT
 * session to receive the roll; if DRT says a session is active but refuses the
 * request, fail loudly so Forge does not silently roll locally and lose the
 * queued modifiers from the shared session.
 */
export async function dispatchDiceRollTogetherForgeRoll(
  pluginRegistry: unknown,
  request: DiceRollTogetherBridgeRequest,
): Promise<boolean> {
  if (!pluginRegistry || typeof pluginRegistry !== 'object') return false;
  const plugin = (pluginRegistry as Record<string, unknown>)['dice-roll-together-for-statblock-forge'];
  if (!plugin || typeof plugin !== 'object') return false;
  const bridge = plugin as DiceRollTogetherBridgePlugin;
  if (typeof bridge.handleForgeDiceFieldRoll !== 'function') return false;

  const active = typeof bridge.canAcceptForgeDiceRoll === 'function'
    ? await bridge.canAcceptForgeDiceRoll()
    : null;
  if (active === false) return false;

  const handled = await bridge.handleForgeDiceFieldRoll(request);
  if (!handled && active === true) {
    throw new Error('Dice Roll Together reports an active session but did not accept the Forge roll. Check that both plugins are up to date.');
  }
  return handled === true;
}
