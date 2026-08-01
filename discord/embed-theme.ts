/** Shared Discord embed colors and status helpers for consistent UX. */

export const EMBED_COLORS = {
  running: 0xf0a500,
  success: 0x2ecc71,
  fail: 0xe74c3c,
  info: 0x3498db,
} as const;

export type EmbedColorName = keyof typeof EMBED_COLORS;

/** Format a duration for compact embed titles / fields. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) {
    const rounded = seconds < 10 ? seconds.toFixed(1) : Math.round(seconds).toString();
    return `${rounded}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rem = Math.round(seconds % 60);
  return rem > 0 ? `${minutes}m ${rem}s` : `${minutes}m`;
}

/** Truncate a Discord embed field value (max 1024). */
export function truncateField(value: string, max = 1024): string {
  if (value.length <= max) return value;
  return value.slice(0, Math.max(0, max - 1)) + "…";
}

/** First non-empty line of text, suitable for a short Error field. */
export function firstNonEmptyLine(text: string): string | undefined {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return undefined;
}
