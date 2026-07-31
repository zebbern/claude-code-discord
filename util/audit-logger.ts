/**
 * Audit Logger — Records all bot command executions with user, timestamp, and cost.
 *
 * Provides a queryable in-memory audit log with optional JSON file persistence.
 * Useful for tracking usage, debugging, and accountability.
 *
 * @module util/audit-logger
 */

import * as path from "https://deno.land/std@0.208.0/path/mod.ts";

export interface AuditEntry {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Discord user ID who triggered the command */
  userId: string;
  /** Discord username (for readability) */
  username: string;
  /** Command or action name (e.g., "/claude", "/shell", "/git") */
  command: string;
  /** Channel or thread ID where the command was run */
  channelId: string;
  /** Brief summary of the input/arguments */
  input: string;
  /** Whether the command succeeded */
  success: boolean;
  /** Error message if the command failed */
  error?: string;
  /** API cost in USD (for Claude queries) */
  costUsd?: number;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Model used (for Claude queries) */
  model?: string;
}

// Maximum entries kept in memory
const MAX_ENTRIES = 1000;

// In-memory audit log
const auditLog: AuditEntry[] = [];

// File path for persistent audit log (set via init)
let auditFilePath: string | null = null;

/**
 * Initialize the audit logger with optional file persistence.
 * @param workDir - Working directory for the bot
 */
export function initAuditLogger(workDir: string): void {
  auditFilePath = path.join(workDir, '.claude', 'audit-log.jsonl');
}

/**
 * Record an audit entry.
 */
export async function logAudit(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
  const fullEntry: AuditEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  // Add to in-memory log
  auditLog.push(fullEntry);

  // Trim to max size
  if (auditLog.length > MAX_ENTRIES) {
    auditLog.splice(0, auditLog.length - MAX_ENTRIES);
  }

  // Persist to file (append JSONL format)
  if (auditFilePath) {
    try {
      // Ensure directory exists
      const dir = path.dirname(auditFilePath);
      try { await Deno.mkdir(dir, { recursive: true }); } catch { /* exists */ }

      await Deno.writeTextFile(
        auditFilePath,
        JSON.stringify(fullEntry) + '\n',
        { append: true }
      );
    } catch {
      // File write is best-effort — don't crash the bot
    }
  }
}

/**
 * Get recent audit entries.
 * @param count - Number of entries to return (default: 20)
 * @param filter - Optional filter by command name or user ID
 */
export function getAuditLog(count = 20, filter?: { command?: string; userId?: string }): AuditEntry[] {
  let entries = [...auditLog];

  if (filter?.command) {
    entries = entries.filter(e => e.command === filter.command);
  }
  if (filter?.userId) {
    entries = entries.filter(e => e.userId === filter.userId);
  }

  return entries.slice(-count);
}

/**
 * Get audit statistics.
 */
export function getAuditStats(): {
  totalCommands: number;
  totalCostUsd: number;
  commandCounts: Record<string, number>;
  userCounts: Record<string, number>;
} {
  const commandCounts: Record<string, number> = {};
  const userCounts: Record<string, number> = {};
  let totalCostUsd = 0;

  for (const entry of auditLog) {
    commandCounts[entry.command] = (commandCounts[entry.command] || 0) + 1;
    userCounts[entry.username] = (userCounts[entry.username] || 0) + 1;
    if (entry.costUsd) {
      totalCostUsd += entry.costUsd;
    }
  }

  return {
    totalCommands: auditLog.length,
    totalCostUsd,
    commandCounts,
    userCounts,
  };
}

/**
 * Format audit log entries for Discord display.
 */
export function formatAuditLog(entries: AuditEntry[]): string {
  if (entries.length === 0) return 'No audit entries found.';

  return entries.map(e => {
    const cost = e.costUsd ? ` | $${e.costUsd.toFixed(4)}` : '';
    const duration = e.durationMs ? ` | ${(e.durationMs / 1000).toFixed(1)}s` : '';
    const status = e.success ? 'OK' : 'FAIL';
    const time = e.timestamp.substring(11, 19); // HH:MM:SS
    return `\`${time}\` **${e.command}** by ${e.username} [${status}]${cost}${duration}`;
  }).join('\n');
}
