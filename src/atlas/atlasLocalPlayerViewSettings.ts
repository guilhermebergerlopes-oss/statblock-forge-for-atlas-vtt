import type { App } from 'obsidian';

interface AtlasLocalPlayerViewSettingsService {
  initialize?: () => Promise<void> | void;
  getLocalPlayerViewSettings?: () => unknown;
  setLocalPlayerViewSettings?: (settings: { showDiceRolls: boolean }) => void;
  saveSettingsNow?: () => Promise<void> | void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Makes Atlas show GM rolls as toasts in its Local Player View. Atlas exposes
 * this setting through the public settingsService property on its plugin.
 * Other Local Player View preferences are read-only and remain unchanged.
 */
export async function enableAtlasLocalPlayerDiceRolls(app: App): Promise<boolean> {
  try {
    const plugins = (app as unknown as { plugins?: { plugins?: Record<string, unknown> } }).plugins?.plugins;
    const atlasPlugin = plugins?.['atlas-vtt'];
    if (!isRecord(atlasPlugin)) return false;
    const serviceValue = atlasPlugin.settingsService;
    if (!isRecord(serviceValue)) return false;
    const service = serviceValue as unknown as AtlasLocalPlayerViewSettingsService;
    if (typeof service.initialize === 'function') await service.initialize();
    if (typeof service.getLocalPlayerViewSettings !== 'function'
      || typeof service.setLocalPlayerViewSettings !== 'function') return false;
    const settings = service.getLocalPlayerViewSettings();
    if (!isRecord(settings) || typeof settings.showDiceRolls !== 'boolean') return false;
    if (settings.showDiceRolls) return true;
    service.setLocalPlayerViewSettings({ showDiceRolls: true });
    if (typeof service.saveSettingsNow === 'function') await service.saveSettingsNow();
    return true;
  } catch (error) {
    console.warn('[Statblock Forge] Could not enable dice-roll visibility in Atlas Local Player View:', error);
    return false;
  }
}
