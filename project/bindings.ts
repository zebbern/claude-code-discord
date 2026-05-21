/**
 * ProjectBindings — maps Discord channel/thread IDs to git repo work-tree roots.
 *
 * In-memory map is the source of truth; disk is updated asynchronously through
 * a serial `mutationQueue` so reads never block and writes never race.
 */

import { PersistenceManager } from "../util/persistence.ts";

interface BindingsData {
  version: 1;
  bindings: Record<string, string>;
}

const DEFAULT_DATA: BindingsData = { version: 1, bindings: {} };
Object.freeze(DEFAULT_DATA);
Object.freeze(DEFAULT_DATA.bindings);

export class ProjectBindings {
  private readonly globalWorkDir: string;
  private readonly persistence: PersistenceManager<BindingsData>;
  private map: Map<string, string> = new Map();
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(globalWorkDir: string, dataDir?: string) {
    this.globalWorkDir = globalWorkDir;
    this.persistence = new PersistenceManager<BindingsData>(
      "thread-projects",
      { dataDir: dataDir ?? ".bot-data" },
    );
  }

  /** Load persisted bindings from disk. Call once at startup. */
  async load(): Promise<void> {
    let data: BindingsData;
    try {
      data = await this.persistence.load(DEFAULT_DATA);
      // Guard against malformed or version-mismatched data
      if (
        !data ||
        data.version !== 1 ||
        typeof data.bindings !== "object" ||
        data.bindings === null ||
        Array.isArray(data.bindings)
      ) {
        data = DEFAULT_DATA;
      }
    } catch {
      data = DEFAULT_DATA;
    }
    this.map = new Map(Object.entries(data.bindings));
  }

  /** Synchronously resolve the working directory for a channel.
   * A tombstone value ("") resolves to the global working directory. */
  resolveWorkDir(channelId: string): string {
    const val = this.map.get(channelId);
    if (val === undefined || val === "") return this.globalWorkDir;
    return val;
  }

  /**
   * Bind a channel to an absolute path and persist.
   * Awaitable — used by /project bind.
   */
  async setBinding(channelId: string, absPath: string): Promise<void> {
    this.map.set(channelId, absPath);
    await this._persist();
  }

  /**
   * Remove a binding and persist a tombstone ("") so the channel explicitly
   * opts out of parent-channel inheritance. Used by /project unbind.
   */
  async unsetBinding(channelId: string): Promise<void> {
    this.map.set(channelId, "");
    await this._persist();
  }

  /**
   * Synchronous tombstone — used from sync callbacks where await is not possible.
   * Never throws.
   */
  unsetBindingSync(channelId: string): void {
    this.map.set(channelId, "");
    this.mutationQueue = this.mutationQueue
      .then(() => this._writeToDisk())
      .catch((e) =>
        console.error("[ProjectBindings] persist error:", e)
      );
  }

  /**
   * Synchronously update in-memory map and enqueue a fire-and-forget persist.
   * Used from sync callbacks where await is not possible. Never throws.
   */
  setBindingSync(channelId: string, absPath: string): void {
    this.map.set(channelId, absPath);
    this.mutationQueue = this.mutationQueue
      .then(() => this._writeToDisk())
      .catch((e) =>
        console.error("[ProjectBindings] persist error:", e)
      );
  }

  /** All [channelId, absPath] entries (excludes tombstones). */
  listBindings(): Array<[string, string]> {
    return Array.from(this.map.entries()).filter(([, v]) => v !== "");
  }

  /**
   * Returns true if the channel has a real (non-tombstone) binding.
   * A tombstone ("") is stored but does not count as a binding for inheritance.
   */
  hasBinding(channelId: string): boolean {
    const val = this.map.get(channelId);
    return val !== undefined && val !== "";
  }

  /**
   * Returns true if the channel has an explicit tombstone, meaning it has
   * opted out of parent-channel binding inheritance.
   */
  hasTombstone(channelId: string): boolean {
    return this.map.get(channelId) === "";
  }

  /**
   * Resolve effective working directory with source attribution.
   * Checks the channel itself, then its parent (for threads), then global.
   * A tombstone on the channel suppresses parent fallback.
   */
  getEffectiveResolution(
    channelId: string,
    parentChannelId?: string,
  ): { source: "thread" | "parent" | "global" | "none (explicit)"; path: string } {
    if (this.hasBinding(channelId)) {
      return { source: "thread", path: this.map.get(channelId)! };
    }
    if (this.hasTombstone(channelId)) {
      return { source: "none (explicit)", path: this.globalWorkDir };
    }
    if (parentChannelId && this.hasBinding(parentChannelId)) {
      return { source: "parent", path: this.map.get(parentChannelId)! };
    }
    return { source: "global", path: this.globalWorkDir };
  }

  // ── private helpers ──────────────────────────────────────────────────────

  /** Persist current in-memory map through the serial mutation queue. Re-throws on error. */
  private async _persist(): Promise<void> {
    const next = this.mutationQueue.then(() => this._writeToDisk());
    this.mutationQueue = next.catch(() => {}); // recover queue to resolved state even on error
    await next;                                // re-throw to caller
  }

  private async _writeToDisk(): Promise<void> {
    const data: BindingsData = {
      version: 1,
      bindings: Object.fromEntries(this.map),
    };
    const success = await this.persistence.save(data);
    if (!success) throw new Error('[ProjectBindings] Binding saved in memory but failed to persist to disk — will not survive restart');
  }
}
