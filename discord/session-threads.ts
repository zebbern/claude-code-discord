/**
 * Session Thread Manager — Maps Claude sessions to dedicated Discord threads.
 *
 * Each `/claude` invocation creates a new thread in the bot's main channel.
 * All output, AskUser prompts, and permission requests for that session
 * are routed into the thread, keeping the main channel clean.
 *
 * @module discord/session-threads
 */

import {
  ChannelType,
  type TextChannel,
  type ThreadChannel,
} from "npm:discord.js@14.14.1";

import type { SessionThread } from "./types.ts";

/**
 * Truncate and sanitise a user prompt into a thread name (max 100 chars for Discord).
 */
export function threadNameFromPrompt(prompt: string): string {
  // Strip code fences and excessive whitespace
  const cleaned = prompt
    .replace(/```[\s\S]*?```/g, "[code]")
    .replace(/\n+/g, " ")
    .trim();

  const maxLen = 80; // Leave room for potential prefix
  if (cleaned.length <= maxLen) return cleaned || "Claude Session";
  return cleaned.substring(0, maxLen - 1) + "…";
}

/**
 * Manages the mapping between Claude sessions and Discord threads.
 */
export class SessionThreadManager {
  /** sessionId → SessionThread metadata */
  private threads = new Map<string, SessionThread>();
  /** sessionId → live ThreadChannel reference (may be stale) */
  private threadChannels = new Map<string, ThreadChannel>();

  // ───────────────────── Create ─────────────────────

  /**
   * Create a new Discord thread for a session and register it.
   *
   * @param channel  The bot's main text channel
   * @param sessionId  Claude session ID (may be placeholder before SDK returns one)
   * @param prompt  The user's prompt — used to name the thread
   * @returns The created ThreadChannel
   */
  async createSessionThread(
    channel: TextChannel,
    sessionId: string,
    prompt: string,
  ): Promise<ThreadChannel> {
    const threadName = threadNameFromPrompt(prompt);

    const thread = await channel.threads.create({
      name: `🤖 ${threadName}`,
      type: ChannelType.PublicThread,
      autoArchiveDuration: 1440, // 24 hours
      reason: `Claude session ${sessionId}`,
    });

    const meta: SessionThread = {
      sessionId,
      threadId: thread.id,
      threadName,
      createdAt: new Date(),
      lastActivity: new Date(),
      messageCount: 0,
    };

    this.threads.set(sessionId, meta);
    this.threadChannels.set(sessionId, thread);

    return thread;
  }

  // ───────────────────── Lookup ─────────────────────

  /**
   * Get the ThreadChannel for a session, if it exists.
   */
  getThread(sessionId: string): ThreadChannel | undefined {
    return this.threadChannels.get(sessionId);
  }

  /**
   * Get the metadata for a session thread.
   */
  getSessionThread(sessionId: string): SessionThread | undefined {
    return this.threads.get(sessionId);
  }

  /**
   * Find a session ID by its Discord thread ID.
   */
  findSessionByThreadId(threadId: string): string | undefined {
    for (const [sessionId, meta] of this.threads) {
      if (meta.threadId === threadId) return sessionId;
    }
    return undefined;
  }

  /**
   * List all tracked session threads.
   */
  getAllSessionThreads(): SessionThread[] {
    return Array.from(this.threads.values());
  }

  /**
   * List active session threads (those with recent activity).
   */
  getActiveSessionThreads(maxAgeMs = 3_600_000): SessionThread[] {
    const cutoff = Date.now() - maxAgeMs;
    return Array.from(this.threads.values()).filter(
      (t) => t.lastActivity.getTime() > cutoff,
    );
  }

  // ───────────────────── Update ─────────────────────

  /**
   * Record that a message was sent in a session thread.
   */
  recordActivity(sessionId: string): void {
    const meta = this.threads.get(sessionId);
    if (meta) {
      meta.lastActivity = new Date();
      meta.messageCount++;
    }
  }

  /**
   * Update the session ID mapping (e.g., when the real SDK session ID arrives
   * after we created the thread with a placeholder).
   */
  updateSessionId(oldId: string, newId: string): void {
    const meta = this.threads.get(oldId);
    const channel = this.threadChannels.get(oldId);

    if (meta) {
      meta.sessionId = newId;
      this.threads.delete(oldId);
      this.threads.set(newId, meta);
    }

    if (channel) {
      this.threadChannels.delete(oldId);
      this.threadChannels.set(newId, channel);
    }
  }

  /**
   * Store a ThreadChannel reference obtained externally (e.g., fetched from cache).
   */
  setThreadChannel(sessionId: string, thread: ThreadChannel): void {
    this.threadChannels.set(sessionId, thread);
  }

  // ───────────────────── Cleanup ─────────────────────

  /**
   * Remove sessions older than the given age.
   * Does NOT archive the Discord threads — that's handled by autoArchiveDuration.
   */
  cleanup(maxAgeMs = 24 * 3_600_000): number {
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;
    for (const [id, meta] of this.threads) {
      if (meta.lastActivity.getTime() < cutoff) {
        this.threads.delete(id);
        this.threadChannels.delete(id);
        removed++;
      }
    }
    return removed;
  }
}
