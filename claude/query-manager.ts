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

import { query as claudeQuery, type Query, type AccountInfo, type ModelInfo, type McpServerStatus, type SlashCommand, type RewindFilesResult, type PermissionMode, type McpSetServersResult, type McpServerConfig } from "@anthropic-ai/claude-agent-sdk";

// Re-export SDK types for consumers
export type { Query, AccountInfo, ModelInfo as SDKModelInfoFull, McpServerStatus, SlashCommand as SDKSlashCommand, RewindFilesResult, McpSetServersResult, McpServerConfig };

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
// Active Query State (per-channel isolation)
// ================================

/**
 * Per-channel query state to prevent concurrent commands from colliding.
 * When no channelId is provided, falls back to the "default" key for
 * backward compatibility with single-channel usage.
 */
const activeQueries = new Map<string, Query>();
const trackedMessagesByChannel = new Map<string, TrackedMessage[]>();

const DEFAULT_CHANNEL = '__default__';

/**
 * Set the active Query reference for a channel.
 * Called when a new query starts in sendToClaudeCode().
 */
export function setActiveQuery(q: Query | null, channelId?: string): void {
  const key = channelId || DEFAULT_CHANNEL;
  if (q) {
    activeQueries.set(key, q);
  } else {
    activeQueries.delete(key);
    trackedMessagesByChannel.delete(key);
  }
}

/**
 * Get the active Query reference for a channel.
 * Falls back to the default channel if no channelId is provided.
 */
export function getActiveQuery(channelId?: string): Query | null {
  const key = channelId || DEFAULT_CHANNEL;
  return activeQueries.get(key) ?? null;
}

/**
 * Check if any channel has an active query.
 */
export function hasAnyActiveQuery(): boolean {
  return activeQueries.size > 0;
}

/**
 * Track a user message ID for rewind support.
 */
export function trackMessageId(messageId: string, turn: number, summary: string, channelId?: string): void {
  const key = channelId || DEFAULT_CHANNEL;
  if (!trackedMessagesByChannel.has(key)) {
    trackedMessagesByChannel.set(key, []);
  }
  trackedMessagesByChannel.get(key)!.push({
    messageId,
    turn,
    timestamp: Date.now(),
    summary,
  });
}

/**
 * Get all tracked user message IDs.
 */
export function getTrackedMessages(channelId?: string): TrackedMessage[] {
  const key = channelId || DEFAULT_CHANNEL;
  return [...(trackedMessagesByChannel.get(key) || [])];
}

/**
 * Clear tracked messages.
 */
export function clearTrackedMessages(channelId?: string): void {
  const key = channelId || DEFAULT_CHANNEL;
  trackedMessagesByChannel.delete(key);
}

// ================================
// Query Control Methods
// ================================

/**
 * Interrupt the active query gracefully via SDK (better than AbortController).
 * The query will stop processing and return control.
 */
export async function interruptActiveQuery(): Promise<boolean> {
  const query = getActiveQuery();
  if (!query) return false;
  try {
    await query.interrupt();
    return true;
  } catch {
    return false;
  }
}

/**
 * Change the model on the active query mid-session.
 */
export async function setActiveModel(model?: string): Promise<boolean> {
  const query = getActiveQuery();
  if (!query) return false;
  try {
    await query.setModel(model);
    return true;
  } catch {
    return false;
  }
}

/**
 * Change the permission mode on the active query mid-session.
 */
export async function setActivePermissionMode(mode: PermissionMode): Promise<boolean> {
  const query = getActiveQuery();
  if (!query) return false;
  try {
    await query.setPermissionMode(mode);
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
  const query = getActiveQuery();
  if (!query) return null;
  try {
    return await query.rewindFiles(messageId, { dryRun });
  } catch {
    return null;
  }
}

/**
 * Get the full initialization result from the active query.
 */
export async function getInitInfo(): Promise<ClaudeInitInfo | null> {
  const query = getActiveQuery();
  if (!query) return null;
  try {
    const result = await query.initializationResult();
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
  const query = getActiveQuery();
  if (!query) return null;
  try {
    return await query.accountInfo();
  } catch {
    return null;
  }
}

/**
 * Get supported models from the active query.
 */
export async function getSupportedModels(): Promise<ModelInfo[] | null> {
  const query = getActiveQuery();
  if (!query) return null;
  try {
    return await query.supportedModels();
  } catch {
    return null;
  }
}

/**
 * Get MCP server status from the active query.
 */
export async function getMcpServerStatus(): Promise<McpServerStatus[] | null> {
  const query = getActiveQuery();
  if (!query) return null;
  try {
    return await query.mcpServerStatus();
  } catch {
    return null;
  }
}

/**
 * Stop a running background task (subagent).
 * A task_notification with status 'stopped' will be emitted.
 *
 * @param taskId - The task ID from task_notification/task_started events
 */
export async function stopActiveTask(taskId: string): Promise<boolean> {
  const query = getActiveQuery();
  if (!query) return false;
  try {
    await query.stopTask(taskId);
    return true;
  } catch {
    return false;
  }
}

// ================================
// MCP Server Management
// ================================

/**
 * Toggle an MCP server on/off mid-session via the SDK Query.
 *
 * @param serverName - The name of the MCP server to toggle
 * @param enabled - Whether the server should be enabled
 */
export async function toggleMcpServerActive(serverName: string, enabled: boolean): Promise<boolean> {
  const query = getActiveQuery();
  if (!query) return false;
  try {
    await query.toggleMcpServer(serverName, enabled);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reconnect an MCP server mid-session via the SDK Query.
 * Useful when a server has failed or disconnected.
 *
 * @param serverName - The name of the MCP server to reconnect
 */
export async function reconnectMcpServerActive(serverName: string): Promise<boolean> {
  const query = getActiveQuery();
  if (!query) return false;
  try {
    await query.reconnectMcpServer(serverName);
    return true;
  } catch {
    return false;
  }
}

/**
 * Dynamically set MCP servers mid-session via the SDK Query.
 * Replaces the current set of dynamically-added servers.
 * Servers from settings files are not affected.
 *
 * @param servers - Record of server name to configuration
 */
export async function setMcpServersActive(servers: Record<string, McpServerConfig>): Promise<McpSetServersResult | null> {
  const query = getActiveQuery();
  if (!query) return null;
  try {
    return await query.setMcpServers(servers);
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
