import { Component, Notice, TFile, type App } from 'obsidian';
import type StatblockForgePlugin from '../../main';
import { createForgeLayout, headerFieldForPart, parseForgeLayout, type ForgeTemplate, type JsonRecord } from '../templates/forgeTemplate.ts';
import { parseTemplateFileText } from '../templates/forgeFileFormat.ts';
import { applyPinnedTemplateImages, pinnedTemplateImageValue } from '../templates/imageFieldModel.ts';
import { readForgeTemplateLink, resolveForgeTemplateForNote } from './forgeTemplateLinkResolver.ts';
import { loadStatblockSource } from '../statblocks/statblockDataSources.ts';
import { forgeRestDataWithResources } from '../statblocks/forgeResourceValues.ts';
import { projectForgeStatblockDataForLegacyNote } from './atlasTemplateAdapter.ts';
import { FORGE_STATBLOCK_IMAGE_FRAMES_KEY, readStatblockImageFrames, withStatblockImageFrame, type StatblockImageFrame, type StatblockImageFrames } from '../statblocks/statblockImageFraming.ts';
import { VaultImagePickerModal } from '../views/StatblockFilePickers.ts';
import { openImageSocketActionsMenu } from '../render/imageSocketActionsMenu.ts';
import { renderStatblock } from '../render/statblockPreviewRenderer.ts';
import { resolveVaultImageResource } from '../render/vaultImageResolver.ts';
import { attachForgeStatblockDiceRolling } from '../render/statblockDiceLinks.ts';
import { normalizeForgeLanguage } from '../i18n/localization.ts';
import { FORGE_STATBLOCK_SHEET_WIDTH_KEY, resolveForgeSheetWidth } from '../templates/sheetWidth.ts';
import type { AtlasDiceTokenRollContextLike } from './atlasDiceRuntime.ts';
import { forgePickerDetail, forgePickerScalar, type ForgeStatblockPickerEntry } from './forgeStatblockPickerModel.ts';


interface ForgePreviewRenderContext {
  readonly renderId: string;
  readonly atlasViewId?: string;
  readonly atlasOriginContext?: AtlasDiceTokenRollContextLike;
  readonly container: HTMLElement;
  readonly instanceId: string;
  readonly sceneId: string;
  readonly variant: 'full' | 'preview';
  readonly token?: { readonly tokenId: string; readonly name: string; readonly imagePath: string };
  /** The Link Statblock dialog previews the statblock as it will appear for the selected Token. */
  readonly preferTokenImage?: boolean;
  readonly signal: AbortSignal;
}

interface ForgePreviewRenderHandle {
  update?(context: ForgePreviewRenderContext): void | Promise<void>;
  dispose(): void;
}

interface ForgePreviewRenderer {
  render(sourceId: string, context: ForgePreviewRenderContext): Promise<ForgePreviewRenderHandle | null>;
}

interface ForgeResolvedSource {
  note: TFile;
  templateFile: TFile;
  template: ForgeTemplate;
  layout: ReturnType<typeof createForgeLayout>;
  data: JsonRecord;
  basename: string;
  sheetWidth: number;
  imageFrames: StatblockImageFrames;
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
    sheetWidth: resolveForgeSheetWidth(source.raw[FORGE_STATBLOCK_SHEET_WIDTH_KEY], layout.sheetWidth),
    imageFrames: readStatblockImageFrames(source.raw),
  };
}

/**
 * Read the Forge-native notes which Atlas lists in its Link Statblock dialog.
 * The Atlas list renders frontmatter `name` (or the file basename), then its
 * conventional size/type/rating details; mirror that metadata so the DOM
 * bridge can add Forge badges without relying on React internals or row order.
 */
export async function readForgeStatblockPickerEntries(
  app: App,
  plugin: StatblockForgePlugin,
): Promise<ForgeStatblockPickerEntry[]> {
  const files = app.vault.getMarkdownFiles().filter((file) => readForgeTemplateLink(app, file)?.version === 2);
  // Atlas builds its Link Statblock rows from the note frontmatter, not from
  // the resolved Forge data snapshot. Match that same source exactly: the
  // snapshot can contain normalized/formula values which are not displayed by
  // Atlas' statblockNoteEntries parser and therefore caused the Forge badge to
  // miss otherwise valid rows.
  const entries = files.map((file): ForgeStatblockPickerEntry => {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
    const fields: JsonRecord = frontmatter && typeof frontmatter === 'object'
      ? { ...(frontmatter as Record<string, unknown>) }
      : {};
    return {
      path: file.path,
      name: forgePickerScalar(fields.name) ?? file.basename,
      detail: forgePickerDetail({ path: file.path, fields }),
    };
  });
  return entries.sort((left, right) => left.name.localeCompare(right.name));
}

function createForgePreviewRenderer(app: App, plugin: StatblockForgePlugin): ForgePreviewRenderer {
  const resolveDefinition = async (sourceId: string): Promise<ForgeResolvedSource | null> => resolveForgeSource(app, plugin, sourceId);
  const renderer: ForgePreviewRenderer = {
    async render(sourceId, context) {
      let disposed = false;
      let markdownComponent: Component | null = null;
      let renderedCard: HTMLElement | null = null;
      let diceCleanup: (() => void) | null = null;
      let drawSequence = 0;
      let saveQueue: Promise<void> = Promise.resolve();

      let activeContext = context;
      const clear = (): void => {
        diceCleanup?.();
        diceCleanup = null;
        markdownComponent?.unload();
        markdownComponent = null;
        renderedCard?.remove();
        renderedCard = null;
        activeContext.container.replaceChildren();
        delete activeContext.container.dataset.forgeSheetWidth;
        activeContext.container.style.removeProperty('--statblock-forge-sheet-width');
        const previewWindow = activeContext.container.closest<HTMLElement>('.atlas-statblock-preview-window');
        previewWindow?.classList.remove('statblock-forge__atlas-width-preview');
        previewWindow?.style.removeProperty('--statblock-forge-sheet-width');
      };

      const draw = async (): Promise<void> => {
        const sequence = ++drawSequence;
        const renderContext = activeContext;
        clear();
        // Atlas' Ctrl-hover window is a height-constrained flex column. Mark
        // only its preview render container so Forge can make the card/body
        // participate in that constraint and expose a real scroll viewport.
        // The Atlas-owned class and data attributes are left untouched.
        renderContext.container.classList.toggle(
          'statblock-forge__atlas-preview-mount',
          renderContext.variant === 'preview',
        );
        const resolved = await resolveDefinition(sourceId);
        if (disposed || renderContext.signal.aborted || sequence !== drawSequence) return;
        if (!resolved) {
          const message = plugin.settings.language === 'pt-BR'
            ? 'Não foi possível carregar esta ficha do Statblock Forge.'
            : 'This Statblock Forge sheet could not be loaded.';
          renderContext.container.textContent = message;
          return;
        }

        const data = { ...resolved.data };
        // Atlas hover previews keep explicit Forge art; the link dialog can preview the selected Token's art.
        const imageField = headerFieldForPart(resolved.template.fields, 'image');
        if (imageField && renderContext.token?.imagePath
          && (renderContext.preferTokenImage === true || !data[imageField.key])) {
          data[imageField.key] = renderContext.token.imagePath;
        }

        const enqueueSave = (operation: () => Promise<void>): Promise<void> => {
          const save = saveQueue.catch(() => undefined).then(operation);
          saveQueue = save.then(() => undefined, () => undefined);
          return save;
        };
        const showSaveError = (error: unknown): void => {
          const detail = error instanceof Error ? error.message : String(error);
          new Notice(plugin.settings.language === 'pt-BR'
            ? `Falha ao salvar a ficha: ${detail}`
            : `Could not save the statblock: ${detail}`, 7000);
        };
        const persistFieldValue = (fieldKey: string, value: unknown): Promise<void> => enqueueSave(async () => {
          const sourceFile = app.vault.getAbstractFileByPath(resolved.note.path);
          if (!(sourceFile instanceof TFile)) throw new Error('A nota deste statblock não está disponível no Vault.');
          const projected = projectForgeStatblockDataForLegacyNote(
            resolved.template,
            { ...data, [fieldKey]: value },
          ).data[fieldKey];
          await app.fileManager.processFrontMatter(sourceFile, (frontmatter) => {
            if (value === undefined) delete frontmatter[fieldKey];
            else frontmatter[fieldKey] = projected;
          });
        }).catch((error: unknown) => {
          showSaveError(error);
          throw error;
        });
        let imageFrames = { ...resolved.imageFrames };
        const persistImageFrames = (nextFrames: StatblockImageFrames): Promise<void> => enqueueSave(async () => {
          const sourceFile = app.vault.getAbstractFileByPath(resolved.note.path);
          if (!(sourceFile instanceof TFile)) throw new Error('A nota deste statblock não está disponível no Vault.');
          await app.fileManager.processFrontMatter(sourceFile, (frontmatter) => {
            frontmatter[FORGE_STATBLOCK_IMAGE_FRAMES_KEY] = nextFrames;
          });
        });
        const redrawPreservingScroll = async (): Promise<void> => {
          const oldBody = renderedCard?.querySelector<HTMLElement>('.statblock-forge__preview-body');
          const scrollTop = oldBody?.scrollTop ?? 0;
          await draw();
          const newBody = renderedCard?.querySelector<HTMLElement>('.statblock-forge__preview-body');
          if (newBody) newBody.scrollTop = scrollTop;
        };
        const openImageActions = (fieldKey: string, socket: HTMLButtonElement): void => {
          const pinned = pinnedTemplateImageValue(resolved.template, resolved.layout, fieldKey);
          const language = normalizeForgeLanguage(plugin.settings.language);
          const portuguese = language === 'pt-BR';
          const actions = pinned === null ? [
            {
              id: 'choose-image',
              label: portuguese ? 'Escolher do Vault…' : 'Choose from Vault…',
              icon: 'image' as const,
              run: () => {
                new VaultImagePickerModal(app, (file) => {
                  void (async () => {
                    data[fieldKey] = file.path;
                    await persistFieldValue(fieldKey, file.path);
                    await redrawPreservingScroll();
                  })().catch(() => undefined);
                }, language).open();
              },
            },
            {
              id: 'clear-image',
              label: portuguese ? 'Remover imagem' : 'Remove image',
              icon: 'clear' as const,
              disabled: !(typeof data[fieldKey] === 'string' && String(data[fieldKey]).trim()),
              run: () => {
                void (async () => {
                  data[fieldKey] = null;
                  await persistFieldValue(fieldKey, null);
                  await redrawPreservingScroll();
                })().catch(() => undefined);
              },
            },
          ] : [];
          openImageSocketActionsMenu(socket, {
            label: pinned !== null
              ? (portuguese ? 'Imagem fixada pelo template' : 'Image pinned by template')
              : (portuguese ? 'Ações da imagem' : 'Image actions'),
            actions,
            ...(pinned !== null ? { hint: portuguese
              ? 'Esta imagem é controlada pelo template e não pode ser substituída ou removida neste statblock.'
              : 'This image is controlled by the template and cannot be replaced or removed in this statblock.' } : {}),
          });
        };

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
          interactiveCounters: true,
          onFieldValueChange: (fieldKey, value) => persistFieldValue(fieldKey, value),
          getLiveFieldData: () => data,
          onAbilityCounterMaxChange: (fieldKey) => {
            void persistFieldValue(fieldKey, data[fieldKey]).catch(() => undefined);
          },
          onImageFieldAction: openImageActions,
          imageFrames,
          onImageFrameChange: (blockId: string, frame: StatblockImageFrame) => {
            imageFrames = withStatblockImageFrame(imageFrames, blockId, frame);
            void persistImageFrames({ ...imageFrames }).catch(showSaveError);
          },
          resolveImage: (path) => resolveVaultImageResource(app, path, resolved.note.path),
        });
        renderedCard.classList.add('statblock-forge__final-card');
        renderedCard.dataset.forgeRenderTarget = 'atlas-direct-preview';
        renderedCard.setCssProps({ ['--statblock-forge-sheet-width']: `${resolved.sheetWidth}px` });
        if (renderContext.variant === 'preview') {
          const width = `${resolved.sheetWidth}px`;
          renderContext.container.dataset.forgeSheetWidth = String(resolved.sheetWidth);
          renderContext.container.style.setProperty('--statblock-forge-sheet-width', width);
          // Atlas caps its native hover surface to a generic preview width.
          // Forge cards use the Template's configured width, so widen this
          // Forge-owned window to fit that card (plus its surface padding),
          // while still respecting the available viewport width.
          const previewWindow = renderContext.container.closest<HTMLElement>('.atlas-statblock-preview-window');
          previewWindow?.classList.add('statblock-forge__atlas-width-preview');
          previewWindow?.style.setProperty('--statblock-forge-sheet-width', width);
        }
        if (disposed || renderContext.signal.aborted || sequence !== drawSequence) {
          if (sequence === drawSequence) clear();
          return;
        }
        renderContext.container.replaceChildren(renderedCard);
        diceCleanup = attachForgeStatblockDiceRolling(renderedCard, {
          app,
          template: resolved.template,
          statblockPath: resolved.note.path,
          statblockName: resolved.basename,
          language: normalizeForgeLanguage(plugin.settings.language),
          ...(renderContext.atlasViewId ? { atlasRollContext: { viewId: renderContext.atlasViewId, ...(renderContext.token ? { tokenId: renderContext.token.tokenId, tokenImagePath: renderContext.token.imagePath } : {}), ...(renderContext.atlasOriginContext ? { originContext: renderContext.atlasOriginContext } : {}) } } : {}),
        });
      };

      await draw();
      return {
        update: async (nextContext) => {
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
  return renderer;
}

export interface ForgeAtlasPreviewRenderOptions {
  readonly sourcePath: string;
  readonly container: HTMLElement;
  readonly instanceId: string;
  readonly sceneId: string;
  readonly viewId?: string;
  readonly originContext?: AtlasDiceTokenRollContextLike;
  readonly renderId: string;
  readonly token?: { readonly tokenId: string; readonly name: string; readonly imagePath: string };
  /** The Link Statblock dialog previews the statblock as it will appear for the selected Token. */
  readonly preferTokenImage?: boolean;
  readonly signal: AbortSignal;
  /** Render surface: the full statblock hover/selection preview. */
  readonly variant?: 'preview';
}

export interface ForgeAtlasPreviewRenderSession {
  updateToken(token: { readonly tokenId: string; readonly name: string; readonly imagePath: string } | undefined): Promise<void>;
  dispose(): void;
}

/** Renders a Forge-native v2 statblock directly into an Atlas-owned preview window. */
export async function renderForgeStatblockPreview(
  app: App,
  plugin: StatblockForgePlugin,
  options: ForgeAtlasPreviewRenderOptions,
): Promise<ForgeAtlasPreviewRenderSession | null> {
  const renderer = createForgePreviewRenderer(app, plugin);
  if (options.signal.aborted) return null;

  let activeContext: ForgePreviewRenderContext = {
    renderId: options.renderId,
    container: options.container,
    instanceId: options.instanceId,
    sceneId: options.sceneId,
    ...(options.viewId ? { atlasViewId: options.viewId } : {}),
    ...(options.originContext ? { atlasOriginContext: options.originContext } : {}),
    variant: options.variant ?? 'preview',
    ...(options.token ? { token: options.token } : {}),
    ...(options.preferTokenImage ? { preferTokenImage: true } : {}),
    signal: options.signal,
  };
  const handle = await renderer.render(options.sourcePath, activeContext);
  if (!handle) return null;
  if (options.signal.aborted) {
    handle.dispose();
    return null;
  }

  return {
    updateToken: async (token) => {
      if (options.signal.aborted || !handle.update) return;
      activeContext = {
        ...activeContext,
        ...(token ? { token } : { token: undefined }),
      };
      await handle.update(activeContext);
    },
    dispose: () => handle.dispose(),
  };
}

/** True only for Forge-native v2 notes; Atlas-published v1 notes keep native rendering. */
export function isForgeNativeV2Statblock(app: App, sourcePath: string): boolean {
  const file = app.vault.getAbstractFileByPath(sourcePath.split('#', 1)[0]!);
  if (!(file instanceof TFile)) return false;
  const link = readForgeTemplateLink(app, file);
  return link?.version === 2 && !link.atlasTemplateId;
}
