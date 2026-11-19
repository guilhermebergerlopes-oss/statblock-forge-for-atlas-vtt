import { Component, TFile, type App } from 'obsidian';
import type StatblockForgePlugin from '../../main';
import { createForgeLayout, headerFieldForPart, parseForgeLayout, type ForgeField, type ForgeTemplate, type JsonRecord } from '../templates/forgeTemplate.ts';
import { parseTemplateFileText } from '../templates/forgeFileFormat.ts';
import { applyPinnedTemplateImages } from '../templates/imageFieldModel.ts';
import { readForgeTemplateLink, resolveForgeTemplateForNote } from './forgeTemplateLinkResolver.ts';
import { loadStatblockSource } from '../statblocks/statblockDataSources.ts';
import { forgeRestDataWithResources, forgeTrackedResourceForField } from '../statblocks/forgeResourceValues.ts';
import { renderStatblock } from '../render/statblockPreviewRenderer.ts';
import { resolveVaultImageResource } from '../render/vaultImageResolver.ts';
import { attachForgeStatblockDiceRolling } from '../render/statblockDiceLinks.ts';
import { normalizeForgeLanguage } from '../i18n/localization.ts';

const FORGE_SHEET_PROVIDER_ID = 'statblock-forge';

type AtlasSheetFieldValue =
  | { readonly key: string; readonly label: string; readonly valueType: 'number'; readonly value: number; readonly resourceCompatible?: true }
  | { readonly key: string; readonly label: string; readonly valueType: 'text'; readonly value: string }
  | { readonly key: string; readonly label: string; readonly valueType: 'boolean'; readonly value: boolean }
  | { readonly key: string; readonly label: string; readonly valueType: 'unsupported' };

interface AtlasSheetDefinition {
  readonly providerId: string;
  readonly sourceId: string;
  readonly name: string;
  readonly revision: string;
  readonly fields: readonly AtlasSheetFieldValue[];
  readonly metadata: Readonly<Record<string, string | number | boolean>>;
}

interface AtlasSheetRenderContext {
  readonly renderId: string;
  readonly container: HTMLElement;
  readonly instanceId: string;
  readonly sceneId: string;
  readonly variant: 'full' | 'preview' | 'feed';
  readonly token?: { readonly tokenId: string; readonly name: string; readonly imagePath: string };
  readonly signal: AbortSignal;
}

interface AtlasSheetRenderHandle {
  update?(definition: AtlasSheetDefinition, context: AtlasSheetRenderContext): void | Promise<void>;
  dispose(): void;
}

interface AtlasSheetProvider {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  getSheet(sourceId: string): Promise<AtlasSheetDefinition | null>;
  render(definition: AtlasSheetDefinition, context: AtlasSheetRenderContext): Promise<AtlasSheetRenderHandle>;
}

interface AtlasPublicAPI {
  readonly apiVersion: number;
  readonly capabilities: readonly string[];
  readonly sheets: {
    registerProvider(provider: AtlasSheetProvider): () => void;
  };
}

interface ForgeResolvedSource {
  note: TFile;
  templateFile: TFile;
  template: ForgeTemplate;
  layout: ReturnType<typeof createForgeLayout>;
  data: JsonRecord;
  basename: string;
}

async function resolveForgeSource(app: App, plugin: StatblockForgePlugin, sourceId: string): Promise<ForgeResolvedSource | null> {
  const note = app.vault.getAbstractFileByPath(sourceId);
  if (!(note instanceof TFile) || note.extension.toLowerCase() !== 'md' || !readForgeTemplateLink(app, note)) return null;
  const templateResolution = await resolveForgeTemplateForNote(app, note);
  if (templateResolution.status !== 'linked') return null;

  const templateFile = templateResolution.file;
  const parsed = parseTemplateFileText(await app.vault.cachedRead(templateFile), templateFile.extension);
  if (parsed.fileFormat !== 'forge') return null;
  let layout = parsed.layout;
  if (!layout) {
    const sidecarPath = `${plugin.settings.templateFolder}/.statblock-forge/layouts/${parsed.template.id}.json`;
    const sidecar = app.vault.getAbstractFileByPath(sidecarPath);
    layout = sidecar instanceof TFile
      ? parseForgeLayout(await app.vault.cachedRead(sidecar), parsed.template)
      : createForgeLayout(parsed.template);
  }

  const source = await loadStatblockSource(app, note, parsed.template);
  applyPinnedTemplateImages(parsed.template, layout, source.binding.data);
  return {
    note,
    templateFile,
    template: parsed.template,
    layout,
    data: forgeRestDataWithResources(source.binding.data, source.raw),
    basename: source.basename,
  };
}

function atlasFieldsFor(template: ForgeTemplate, data: JsonRecord): AtlasSheetFieldValue[] {
  return template.fields.map((field: ForgeField): AtlasSheetFieldValue => {
    const value = data[field.key];
    const tracked = field.type === 'number' && !!forgeTrackedResourceForField(template, field.key);
    if (typeof value === 'number' && Number.isFinite(value)) {
      return { key: field.key, label: field.label, valueType: 'number', value, ...(tracked ? { resourceCompatible: true as const } : {}) };
    }
    if (typeof value === 'string') return { key: field.key, label: field.label, valueType: 'text', value };
    if (typeof value === 'boolean') return { key: field.key, label: field.label, valueType: 'boolean', value };
    return { key: field.key, label: field.label, valueType: 'unsupported' };
  });
}

function createForgeSheetProvider(app: App, plugin: StatblockForgePlugin): AtlasSheetProvider {
  const resolveDefinition = async (sourceId: string): Promise<ForgeResolvedSource | null> => resolveForgeSource(app, plugin, sourceId);
  const provider: AtlasSheetProvider = {
    id: FORGE_SHEET_PROVIDER_ID,
    name: 'Statblock Forge',
    version: '0.4.3',
    async getSheet(sourceId) {
      const resolved = await resolveDefinition(sourceId);
      if (!resolved) return null;
      return {
        providerId: FORGE_SHEET_PROVIDER_ID,
        sourceId,
        name: String(resolved.data[headerFieldForPart(resolved.template.fields, 'name')?.key ?? 'name'] ?? resolved.basename),
        revision: `${resolved.note.stat.mtime}:${resolved.templateFile.stat.mtime}`,
        fields: atlasFieldsFor(resolved.template, resolved.data),
        metadata: { templateId: resolved.template.id, templatePath: resolved.templateFile.path, format: 'statblock-forge-v2' },
      };
    },
    async render(_definition, context) {
      let disposed = false;
      let markdownComponent: Component | null = null;
      let renderedCard: HTMLElement | null = null;
      let diceCleanup: (() => void) | null = null;

      let activeContext = context;
      const clear = (): void => {
        diceCleanup?.();
        diceCleanup = null;
        markdownComponent?.unload();
        markdownComponent = null;
        renderedCard?.remove();
        renderedCard = null;
        context.container.replaceChildren();
      };

      const draw = async (): Promise<void> => {
        clear();
        // Atlas' Ctrl-hover window is a height-constrained flex column. Mark
        // only its preview render container so Forge can make the card/body
        // participate in that constraint and expose a real scroll viewport.
        // The Atlas-owned class and data attributes are left untouched.
        activeContext.container.classList.toggle(
          'statblock-forge__atlas-preview-mount',
          activeContext.variant === 'preview',
        );
        const sourceId = _definition.sourceId;
        const resolved = await resolveDefinition(sourceId);
        if (disposed || activeContext.signal.aborted) return;
        if (!resolved) {
          const message = plugin.settings.language === 'pt-BR'
            ? 'Não foi possível carregar esta ficha do Statblock Forge.'
            : 'This Statblock Forge sheet could not be loaded.';
          context.container.textContent = message;
          return;
        }

        const data = { ...resolved.data };
        // Token art is a fallback only; explicit Forge image values remain authoritative.
        const imageField = headerFieldForPart(resolved.template.fields, 'image');
        if (imageField && activeContext.token?.imagePath && !data[imageField.key]) data[imageField.key] = activeContext.token.imagePath;

        markdownComponent = new Component();
        markdownComponent.load();
        renderedCard = renderStatblock({
          app,
          markdownComponent,
          sourcePath: resolved.note.path,
          template: resolved.template,
          layout: resolved.layout,
          data,
          language: normalizeForgeLanguage(plugin.settings.language),
          hideTotalHiddenBlocks: true,
          foldSectionsIntoFooter: true,
          resolveImage: (path) => resolveVaultImageResource(app, path, resolved.note.path),
        });
        renderedCard.classList.add('statblock-forge__final-card');
        renderedCard.dataset.forgeRenderTarget = 'atlas-provider-preview';
        if (disposed || activeContext.signal.aborted) {
          clear();
          return;
        }
        activeContext.container.replaceChildren(renderedCard);
        diceCleanup = attachForgeStatblockDiceRolling(renderedCard, {
          app,
          template: resolved.template,
          statblockPath: resolved.note.path,
          statblockName: resolved.basename,
          language: normalizeForgeLanguage(plugin.settings.language),
        });
      };

      await draw();
      return {
        update: async (_nextDefinition, nextContext) => {
          if (disposed || nextContext.signal.aborted) return;
          activeContext = nextContext;
          await draw();
        },
        dispose: () => {
          if (disposed) return;
          disposed = true;
          clear();
        },
      };
    },
  };
  return provider;
}

/** Register the Forge renderer with the currently enabled Atlas fork, if available. */
export function registerForgeAtlasSheetProvider(app: App, plugin: StatblockForgePlugin): (() => void) | null {
  const pluginManager = (app as unknown as { plugins?: { plugins?: Record<string, { publicAPI?: AtlasPublicAPI }> } }).plugins;
  const atlas = pluginManager?.plugins?.['statblock-forge-forked-atlas-vtt-compatibility'];
  const api = atlas?.publicAPI;
  if (api?.apiVersion !== 1 || !api.capabilities.includes('sheets.provider-registration') || !api.sheets?.registerProvider) return null;
  try {
    return api.sheets.registerProvider(createForgeSheetProvider(app, plugin));
  } catch (error) {
    console.warn('[Statblock Forge] Could not register the Atlas sheet renderer:', error);
    return null;
  }
}
