/**
 * Helpers for Discord file attachments (truncated output → .txt).
 */

import type { FileAttachment } from "./types.ts";

/** Cap attached text under Discord's practical limit (shell already kills ~10 MB). */
export const MAX_TEXT_ATTACHMENT_BYTES = 8 * 1024 * 1024;

/**
 * Build an in-memory .txt attachment from full text.
 * Truncates the file body (not the embed) if over the byte cap.
 */
export function buildTextAttachment(
  fullText: string,
  baseName = "output.txt",
): FileAttachment {
  const name = baseName.endsWith(".txt") ? baseName : `${baseName}.txt`;
  const encoder = new TextEncoder();
  let body = fullText;
  let bytes = encoder.encode(body);

  if (bytes.byteLength > MAX_TEXT_ATTACHMENT_BYTES) {
    // Binary-safe trim: decode a prefix under the cap, then note clipping
    let lo = 0;
    let hi = body.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);
      const slice = body.slice(0, mid);
      if (encoder.encode(slice).byteLength <= MAX_TEXT_ATTACHMENT_BYTES - 80) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    body = body.slice(0, lo) +
      `\n\n... (attachment clipped at ${MAX_TEXT_ATTACHMENT_BYTES} bytes; original ${bytes.byteLength} bytes)`;
    bytes = encoder.encode(body);
  }

  return {
    content: bytes,
    name,
    description: "Full output (embed was truncated)",
  };
}

/** Attach full text when embed payload was truncated. */
export function filesForTruncation(
  wasTruncated: boolean,
  fullText: string,
  baseName = "output.txt",
): FileAttachment[] | undefined {
  if (!wasTruncated || fullText.length === 0) return undefined;
  return [buildTextAttachment(fullText, baseName)];
}
