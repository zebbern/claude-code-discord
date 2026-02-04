/**
 * Shared type definitions used across multiple modules.
 * This file serves as the single source of truth for common interfaces.
 */

/**
 * Basic bot settings for mention functionality.
 * Used by various modules that need to control @mention behavior.
 * 
 * @example
 * ```typescript
 * const settings: BotSettings = {
 *   mentionEnabled: true,
 *   mentionUserId: "123456789012345678"
 * };
 * ```
 */
export interface BotSettings {
  /** Whether @mention notifications are enabled for bot messages */
  mentionEnabled: boolean;
  /** Discord user ID to mention, or null if no mention configured */
  mentionUserId: string | null;
}

/**
 * Function signature for updating bot settings.
 * Typically used in dependency injection patterns.
 */
export type BotSettingsUpdater = (settings: BotSettings) => void;
