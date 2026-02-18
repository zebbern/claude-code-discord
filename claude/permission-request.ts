/**
 * PermissionRequest — Interactive tool-permission flow for Claude ↔ Discord.
 *
 * When Claude wants to use a tool that isn't pre-approved (e.g. Bash, Write)
 * in `default` or `acceptEdits` permission modes, the SDK fires `canUseTool`.
 * Instead of auto-denying, this module presents an Allow / Deny embed with
 * buttons in Discord and waits for the user's click.
 *
 * This replaces the terminal TUI "Allow tool X? [Y/n]" prompt with a
 * Discord-native interaction.
 *
 * @module claude/permission-request
 */

// ================================
// Types
// ================================

/**
 * Callback that presents a tool-permission request to the user and returns
 * `true` (allow) or `false` (deny).
 *
 * Throwing rejects the tool use (deny).
 */
export type PermissionRequestCallback = (
  toolName: string,
  toolInput: Record<string, unknown>,
) => Promise<boolean>;

// ================================
// Helpers
// ================================

/** Max characters to show from the tool input JSON in the embed. */
const INPUT_PREVIEW_MAX = 800;

/** Truncate a JSON string for embed display. */
function truncateJson(obj: Record<string, unknown>, maxLen: number): string {
  const raw = JSON.stringify(obj, null, 2);
  if (raw.length <= maxLen) return raw;
  return raw.slice(0, maxLen) + '\n… (truncated)';
}

/**
 * Build a short human-readable description of what the tool is about to do.
 * Covers the most common built-in tools.
 */
export function describeToolAction(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'Bash':
    case 'bash':
      return `Run command: \`${String(input.command ?? input.cmd ?? '').slice(0, 200)}\``;
    case 'Write':
    case 'write':
    case 'CreateFile':
      return `Write file: \`${String(input.file_path ?? input.path ?? 'unknown')}\``;
    case 'Edit':
    case 'edit':
      return `Edit file: \`${String(input.file_path ?? input.path ?? 'unknown')}\``;
    case 'MultiEdit':
      return `Multi-edit file: \`${String(input.file_path ?? input.path ?? 'unknown')}\``;
    default:
      return `Use tool: **${toolName}**`;
  }
}

/**
 * Build the Discord embed data for a permission request.
 *
 * Returned as a plain object so the caller (index.ts) can wrap it
 * in the Discord.js EmbedBuilder.
 */
export function buildPermissionEmbed(toolName: string, input: Record<string, unknown>): {
  color: number;
  title: string;
  description: string;
  fields: Array<{ name: string; value: string; inline: boolean }>;
  footer: { text: string };
} {
  const action = describeToolAction(toolName, input);
  const preview = truncateJson(input, INPUT_PREVIEW_MAX);

  return {
    color: 0xff9900, // Orange — "waiting for you"
    title: `🔐 Permission Request: ${toolName}`,
    description: `Claude wants to ${action}\n\nClick **Allow** to proceed or **Deny** to block this action.`,
    fields: [
      { name: 'Tool', value: `\`${toolName}\``, inline: true },
      { name: 'Input', value: `\`\`\`json\n${preview}\n\`\`\``, inline: false },
    ],
    footer: { text: 'Claude is waiting for your decision — this controls what tools are permitted' },
  };
}

/**
 * Parse a permission-request button custom ID.
 *
 * Custom IDs follow the pattern: `perm-req:<nonce>:allow` or `perm-req:<nonce>:deny`.
 */
export function parsePermissionButtonId(customId: string): { nonce: string; allowed: boolean } | null {
  const match = customId.match(/^perm-req:([^:]+):(allow|deny)$/);
  if (!match) return null;
  return { nonce: match[1], allowed: match[2] === 'allow' };
}
