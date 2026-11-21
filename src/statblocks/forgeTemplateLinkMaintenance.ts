import {
  forgeStatblockTemplateLinkFromFrontmatter,
  refreshForgeStatblockTemplateLinkPath,
} from './forgeTemplateLink.ts';

export interface ForgeTemplateLinkTemplateRecord {
  readonly path: string;
  readonly templateId: string;
}

export interface ForgeTemplateLinkNoteRecord {
  readonly path: string;
  readonly frontmatter: unknown;
}

export interface ForgeTemplateLinkMaintenanceHost {
  listTemplates(): Promise<readonly ForgeTemplateLinkTemplateRecord[]>;
  listStatblockNotes(): Promise<readonly ForgeTemplateLinkNoteRecord[]>;
  /** Must mutate the current frontmatter atomically and return whether it changed. */
  updateNoteLink(
    notePath: string,
    update: (frontmatter: Record<string, unknown>) => boolean,
  ): Promise<boolean>;
  /** Subscribe to .forgetemplate creation/rename or a folder rename. */
  onTemplateTreeChanged(callback: () => void): () => void;
  onReady(callback: () => void): void;
}

export interface ForgeTemplateLinkMaintenanceResult {
  readonly notesScanned: number;
  readonly notesUpdated: number;
  readonly missingTemplates: number;
  readonly ambiguousTemplates: number;
  readonly failedNotes: readonly { path: string; message: string }[];
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
}

/**
 * Repair stale template paths in statblock frontmatter after a template move or
 * restore. Stable template IDs are authoritative, but automatic repair is
 * performed only when exactly one current .forgetemplate owns that ID.
 */
export async function repairForgeTemplateLinks(
  host: Pick<ForgeTemplateLinkMaintenanceHost, 'listTemplates' | 'listStatblockNotes' | 'updateNoteLink'>,
): Promise<ForgeTemplateLinkMaintenanceResult> {
  const [templates, notes] = await Promise.all([host.listTemplates(), host.listStatblockNotes()]);
  const templatesById = new Map<string, ForgeTemplateLinkTemplateRecord[]>();
  const exactByPathAndId = new Set<string>();
  for (const template of templates) {
    const path = normalizePath(template.path);
    const id = template.templateId.trim();
    if (!path || !id) continue;
    const rows = templatesById.get(id) ?? [];
    rows.push({ ...template, path });
    templatesById.set(id, rows);
    exactByPathAndId.add(`${path}\u0000${id}`);
  }

  let notesUpdated = 0;
  let missingTemplates = 0;
  let ambiguousTemplates = 0;
  const failedNotes: Array<{ path: string; message: string }> = [];
  for (const note of notes) {
    const link = forgeStatblockTemplateLinkFromFrontmatter(note.frontmatter);
    if (!link) continue;
    const oldPath = normalizePath(link.templatePath);
    if (exactByPathAndId.has(`${oldPath}\u0000${link.templateId}`)) continue;
    const candidates = templatesById.get(link.templateId) ?? [];
    if (candidates.length === 0) {
      missingTemplates += 1;
      continue;
    }
    if (candidates.length !== 1) {
      ambiguousTemplates += 1;
      continue;
    }
    const target = candidates[0]!;
    if (target.path === oldPath) continue;
    try {
      const changed = await host.updateNoteLink(note.path, (frontmatter) =>
        refreshForgeStatblockTemplateLinkPath(frontmatter, target.path, {
          expectedOldPath: oldPath,
          expectedTemplateId: link.templateId,
        }));
      if (changed) notesUpdated += 1;
    } catch (error) {
      failedNotes.push({ path: note.path, message: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    notesScanned: notes.length,
    notesUpdated,
    missingTemplates,
    ambiguousTemplates,
    failedNotes,
  };
}

/** Count only notes whose current metadata points at the exact template identity. */
export function countForgeTemplateBacklinks(
  notes: readonly ForgeTemplateLinkNoteRecord[],
  target: { readonly kind: 'forge' | 'atlas'; readonly path: string; readonly templateId: string },
): number {
  const targetPath = normalizePath(target.path);
  let count = 0;
  for (const note of notes) {
    if (target.kind === 'forge') {
      const link = forgeStatblockTemplateLinkFromFrontmatter(note.frontmatter);
      if (link?.templateId === target.templateId && normalizePath(link.templatePath) === targetPath) count += 1;
      continue;
    }
    const frontmatter = note.frontmatter as Record<string, unknown> | null;
    if (frontmatter && typeof frontmatter === 'object' && frontmatter['atlas-template'] === target.templateId) count += 1;
  }
  return count;
}

/** Serializes startup/rename/restore scans and owns all event subscriptions. */
export class ForgeTemplateLinkMaintenance {
  private started = false;
  private stopped = false;
  private queue: Promise<void> = Promise.resolve();
  private stopTreeListener: (() => void) | null = null;
  private readonly host: ForgeTemplateLinkMaintenanceHost;
  private readonly onResult?: (result: ForgeTemplateLinkMaintenanceResult) => void;
  private readonly onError?: (error: unknown) => void;

  constructor(
    host: ForgeTemplateLinkMaintenanceHost,
    onResult?: (result: ForgeTemplateLinkMaintenanceResult) => void,
    onError?: (error: unknown) => void,
  ) {
    this.host = host;
    this.onResult = onResult;
    this.onError = onError;
  }

  start(): void {
    if (this.started || this.stopped) return;
    this.started = true;
    this.stopTreeListener = this.host.onTemplateTreeChanged(() => this.schedule());
    this.host.onReady(() => this.schedule());
  }

  schedule(): void {
    if (!this.started || this.stopped) return;
    this.queue = this.queue
      .then(async () => {
        if (this.stopped) return;
        const result = await repairForgeTemplateLinks(this.host);
        if (!this.stopped) this.onResult?.(result);
      })
      .catch((error: unknown) => {
        if (!this.stopped) this.onError?.(error);
      });
  }

  async flush(): Promise<void> {
    await this.queue;
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.stopTreeListener?.();
    this.stopTreeListener = null;
  }
}
