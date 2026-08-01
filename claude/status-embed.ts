/**
 * Shared Claude status-embed helpers (Cancel button + session footer).
 */

import type { EmbedData, MessageContent } from "../discord/types.ts";
import { EMBED_COLORS } from "../discord/embed-theme.ts";

export const CANCEL_CLAUDE_BUTTON_ID = "cancel-claude";

/** Danger Cancel button row for in-flight Claude status embeds. */
export function cancelClaudeComponents(): NonNullable<MessageContent["components"]> {
  return [{
    type: "actionRow",
    components: [{
      type: "button",
      customId: CANCEL_CLAUDE_BUTTON_ID,
      label: "Cancel",
      style: "danger",
    }],
  }];
}

/** First 8 chars of a session id for compact footers. */
export function shortSessionId(sessionId: string): string {
  return sessionId.length <= 8 ? sessionId : sessionId.slice(0, 8);
}

/**
 * Footer: `session abcdef12 · <#threadId>` or `session pending…`
 * Always returns a footer object for status embeds (pending when id unknown).
 */
export function buildSessionFooter(
  sessionId?: string,
  threadChannelId?: string,
): NonNullable<EmbedData["footer"]> {
  if (!sessionId) {
    return { text: "session pending…" };
  }
  const short = shortSessionId(sessionId);
  if (threadChannelId) {
    return { text: `session ${short} · <#${threadChannelId}>` };
  }
  return { text: `session ${short}` };
}

export function resolveThreadChannelId(opts: {
  sessionId?: string;
  channelId?: string;
  knownThreadChannelId?: string;
  getThreadChannelId?: (sessionId: string) => string | undefined;
  findSessionByThreadId?: (threadId: string) => string | undefined;
}): string | undefined {
  if (opts.knownThreadChannelId) return opts.knownThreadChannelId;
  if (opts.sessionId && opts.getThreadChannelId) {
    const mapped = opts.getThreadChannelId(opts.sessionId);
    if (mapped) return mapped;
  }
  if (opts.channelId && opts.findSessionByThreadId?.(opts.channelId)) {
    return opts.channelId;
  }
  return undefined;
}

export function claudeCancelledEmbed(description?: string): EmbedData {
  return {
    color: EMBED_COLORS.fail,
    title: "/claude · cancelled",
    description: description ?? "Claude Code session cancelled.",
    timestamp: true,
  };
}
