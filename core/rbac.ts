/**
 * Role-Based Access Control (RBAC) for Discord commands.
 * Gates dangerous commands behind configurable role requirements.
 * 
 * @module core/rbac
 */

import type { InteractionContext } from "../discord/types.ts";

/**
 * Commands that require elevated permissions.
 * Grouped by risk category.
 */
const RESTRICTED_COMMANDS: Record<string, string[]> = {
  /** Full host access — highest risk */
  shell: ['shell', 'shell-input', 'shell-list', 'shell-kill'],
  /** Repository modifications */
  git: ['git', 'worktree', 'worktree-remove', 'worktree-bots', 'worktree-kill'],
  /** System information exposure */
  system: ['env-vars', 'port-scan', 'system-logs'],
  /** Bot lifecycle */
  admin: ['shutdown'],
};

/** Flat set of all restricted command names for fast lookup */
const ALL_RESTRICTED = new Set(
  Object.values(RESTRICTED_COMMANDS).flat()
);

/**
 * RBAC configuration loaded from environment.
 */
interface RBACConfig {
  /** Whether RBAC is enabled (requires at least one role configured) */
  enabled: boolean;
  /** Set of Discord role IDs that can run restricted commands */
  allowedRoleIds: Set<string>;
  /** Set of Discord user IDs that always have access (bot owner) */
  allowedUserIds: Set<string>;
}

let cachedConfig: RBACConfig | null = null;

/**
 * Load RBAC configuration from environment variables.
 * 
 * Environment variables:
 * - `ADMIN_ROLE_IDS`: Comma-separated Discord role IDs (e.g., "123456,789012")
 * - `ADMIN_USER_IDS`: Comma-separated Discord user IDs (e.g., "123456")
 * 
 * If neither is set, RBAC is disabled and all commands are open.
 */
export function loadRBACConfig(): RBACConfig {
  if (cachedConfig) return cachedConfig;

  const roleIdsRaw = Deno.env.get("ADMIN_ROLE_IDS") ?? "";
  const userIdsRaw = Deno.env.get("ADMIN_USER_IDS") ?? "";

  const allowedRoleIds = new Set(
    roleIdsRaw.split(",").map(id => id.trim()).filter(Boolean)
  );
  const allowedUserIds = new Set(
    userIdsRaw.split(",").map(id => id.trim()).filter(Boolean)
  );

  const enabled = allowedRoleIds.size > 0 || allowedUserIds.size > 0;

  cachedConfig = { enabled, allowedRoleIds, allowedUserIds };

  if (enabled) {
    console.log(`[RBAC] Enabled — ${allowedRoleIds.size} admin role(s), ${allowedUserIds.size} admin user(s)`);
  } else {
    console.log("[RBAC] Disabled — no ADMIN_ROLE_IDS or ADMIN_USER_IDS configured. All commands are open.");
  }

  return cachedConfig;
}

/**
 * Check whether a command name is restricted.
 */
export function isRestrictedCommand(commandName: string): boolean {
  return ALL_RESTRICTED.has(commandName);
}

/**
 * Check whether the invoking user has permission to run a restricted command.
 * 
 * @returns `true` if allowed, `false` if denied
 */
export function hasPermission(ctx: InteractionContext): boolean {
  const config = loadRBACConfig();

  // If RBAC is not enabled, allow everything
  if (!config.enabled) return true;

  // Check user ID allowlist
  const userId = ctx.getUserId();
  if (userId && config.allowedUserIds.has(userId)) return true;

  // Check role IDs
  const memberRoles = ctx.getMemberRoleIds();
  for (const roleId of config.allowedRoleIds) {
    if (memberRoles.has(roleId)) return true;
  }

  return false;
}

/**
 * RBAC check that can be called before executing a command.
 * Sends an ephemeral denial message if the user lacks permission.
 * 
 * @returns `true` if the command should proceed, `false` if denied
 */
export async function checkCommandPermission(
  commandName: string,
  ctx: InteractionContext
): Promise<boolean> {
  if (!isRestrictedCommand(commandName)) return true;
  if (hasPermission(ctx)) return true;

  await ctx.reply({
    content: "🔒 **Access Denied** — You don't have permission to run this command. An admin role is required.",
    ephemeral: true
  });

  return false;
}

/**
 * Get a copy of the restricted commands map for display purposes.
 */
export function getRestrictedCommands(): Record<string, string[]> {
  return { ...RESTRICTED_COMMANDS };
}
