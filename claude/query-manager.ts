/**
 * Query Manager — Manages active SDK Query references for mid-session controls,
 * info retrieval, and file rewind capabilities.
 * 
 * The SDK `query()` function returns a `Query` interface that extends AsyncGenerator
 * with control methods (interrupt, setModel, setPermissionMode, accountInfo, etc.).
 * This module stores the active Query so these methods can be called from Discord commands.
 * 
 * @module claude/query-manager
 */

import { query as claudeQuery, type Query, type AccountInfo, type ModelInfo, type McpServerStatus, type SlashCommand, type RewindFilesResult, type PermissionMode } from "@anthropic-ai/claude-agent-sdk";

// Re-export SDK types for consumers
export type { Query, AccountInfo, ModelInfo as SDKModelInfoFull, McpServerStatus, SlashCommand as SDKSlashCommand, RewindFilesResult };

/**
 * Full initialization result from the SDK.
 */
export interface ClaudeInitInfo {
  commands: SlashCommand[];
  models: ModelInfo[];
  account: AccountInfo;
  outputStyles: string[];
}

/**
 * Tracked user message for rewind support.
 */
interface TrackedMessage {
  /** SDK message ID (UUID) */
  messageId: string;
  /** Turn number (1-indexed) */
  turn: number;
  /** Timestamp */
  timestamp: number;
  /** Brief description of the turn */
  summary: string;
}

// ================================
// Active Query State
// ================================

let activeQuery: Query | null = null;
let trackedMessages: TrackedMessage[] = [];

/**
 * Set the active Query reference.
 * Called when a new query starts in sendToClaudeCode().
 */
export function setActiveQuery(q: Query | null): void {
  activeQuery = q;
  if (!q) {
    trackedMessages = [];
  }
}

/**
 * Get the active Query reference.
 */
export function getActiveQuery(): Query | null {
  return activeQuery;
}

/**
 * Track a user message ID for rewind support.
 */
export function trackMessageId(messageId: string, turn: number, summary: string): void {
  trackedMessages.push({
    messageId,
    turn,
    timestamp: Date.now(),
    summary,
  });
}

/**
 * Get all tracked user message IDs.
 */
export function getTrackedMessages(): TrackedMessage[] {
  return [...trackedMessages];
}

/**
 * Clear tracked messages.
 */
export function clearTrackedMessages(): void {
  trackedMessages = [];
}

// ================================
// Query Control Methods
// ================================

/**
 * Interrupt the active query gracefully via SDK (better than AbortController).
 * The query will stop processing and return control.
 */
export async function interruptActiveQuery(): Promise<boolean> {
  if (!activeQuery) return false;
  try {
    await activeQuery.interrupt();
    return true;
  } catch {
    return false;
  }
}

/**
 * Change the model on the active query mid-session.
 */
export async function setActiveModel(model?: string): Promise<boolean> {
  if (!activeQuery) return false;
  try {
    await activeQuery.setModel(model);
    return true;
  } catch {
    return false;
  }
}

/**
 * Change the permission mode on the active query mid-session.
 */
export async function setActivePermissionMode(mode: PermissionMode): Promise<boolean> {
  if (!activeQuery) return false;
  try {
    await activeQuery.setPermissionMode(mode);
    return true;
  } catch {
    return false;
  }
}

/**
 * Rewind files to their state at a specific user message.
 * Requires enableFileCheckpointing to have been set.
 * 
 * @param messageId - UUID of the user message to rewind to
 * @param dryRun - If true, preview changes without modifying files
 */
export async function rewindToMessage(messageId: string, dryRun = false): Promise<RewindFilesResult | null> {
  if (!activeQuery) return null;
  try {
    return await activeQuery.rewindFiles(messageId, { dryRun });
  } catch {
    return null;
  }
}

/**
 * Get the full initialization result from the active query.
 */
export async function getInitInfo(): Promise<ClaudeInitInfo | null> {
  if (!activeQuery) return null;
  try {
    const result = await activeQuery.initializationResult();
    return {
      commands: result.commands,
      models: result.models,
      account: result.account,
      outputStyles: result.available_output_styles,
    };
  } catch {
    return null;
  }
}

/**
 * Get account info from the active query.
 */
export async function getAccountInfo(): Promise<AccountInfo | null> {
  if (!activeQuery) return null;
  try {
    return await activeQuery.accountInfo();
  } catch {
    return null;
  }
}

/**
 * Get supported models from the active query.
 */
export async function getSupportedModels(): Promise<ModelInfo[] | null> {
  if (!activeQuery) return null;
  try {
    return await activeQuery.supportedModels();
  } catch {
    return null;
  }
}

/**
 * Get MCP server status from the active query.
 */
export async function getMcpServerStatus(): Promise<McpServerStatus[] | null> {
  if (!activeQuery) return null;
  try {
    return await activeQuery.mcpServerStatus();
  } catch {
    return null;
  }
}

// ================================
// Ephemeral Info Query
// ================================

/**
 * Open a short-lived query just to retrieve info (account, models, MCP status).
 * Creates a minimal session, gets initialization data, then closes.
 * Use this when no active query exists.
 * 
 * @param workDir - Working directory for the session
 * @param envVars - Environment variables (must include ANTHROPIC_API_KEY)
 */
export async function fetchClaudeInfo(workDir: string, envVars?: Record<string, string>): Promise<ClaudeInitInfo | null> {
  let infoQuery: Query | null = null;
  try {
    // Create a minimal query — it will start the CLI subprocess
    infoQuery = claudeQuery({
      prompt: "Say 'info' and nothing else.",
      options: {
        cwd: workDir,
        permissionMode: 'plan', // Read-only, safest mode
        maxTurns: 1,
        thinking: { type: 'disabled' },
        effort: 'low',
        persistSession: false,
        env: envVars ?? Object.fromEntries(
          Object.entries(Deno.env.toObject())
        ),
      },
    });

    // Get the initialization result (available immediately after the process starts)
    const initResult = await infoQuery.initializationResult();
    
    const info: ClaudeInitInfo = {
      commands: initResult.commands,
      models: initResult.models,
      account: initResult.account,
      outputStyles: initResult.available_output_styles,
    };

    return info;
  } catch (error) {
    console.error("Failed to fetch Claude info:", error);
    return null;
  } finally {
    // Close the query to release resources
    if (infoQuery) {
      try {
        infoQuery.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}
