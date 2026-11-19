/**
 * Tracks metadata-cache notifications caused by Forge's own frontmatter writes.
 * Those writes are already reflected by the live renderer and must not trigger
 * a full panel rebuild. Entries expire so a missing Obsidian notification can
 * never suppress a later external edit indefinitely.
 */
export class SourceMetadataRefreshGate {
  private readonly pending = new Map<string, { count: number; expiresAt: number }>();
  private readonly ttlMs: number;

  constructor(ttlMs = 2_000) {
    this.ttlMs = ttlMs;
  }

  expect(path: string, now = Date.now()): void {
    const current = this.pending.get(path);
    const count = current && current.expiresAt > now ? current.count + 1 : 1;
    this.pending.set(path, { count, expiresAt: now + this.ttlMs });
  }

  consume(path: string, now = Date.now()): boolean {
    const current = this.pending.get(path);
    if (!current) return false;
    if (current.expiresAt <= now) {
      this.pending.delete(path);
      return false;
    }
    if (current.count <= 1) this.pending.delete(path);
    else this.pending.set(path, { ...current, count: current.count - 1 });
    return true;
  }

  cancel(path: string): void {
    const current = this.pending.get(path);
    if (!current) return;
    if (current.count <= 1) this.pending.delete(path);
    else this.pending.set(path, { ...current, count: current.count - 1 });
  }

  clear(): void {
    this.pending.clear();
  }
}
