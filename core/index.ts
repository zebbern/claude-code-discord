/**
 * Core module barrel export.
 * Provides centralized configuration and signal handling utilities.
 * 
 * @module core
 * 
 * @example
 * ```typescript
 * import { loadConfig, setupSignalHandlers } from "./core/index.ts";
 * 
 * // Load configuration from environment and CLI
 * const config = loadConfig();
 * 
 * // Setup graceful shutdown handlers
 * setupSignalHandlers({
 *   killAllShellProcesses: () => shellManager.killAll(),
 *   killAllWorktreeBots: () => worktreeManager.killAll(),
 *   getClaudeController: () => claudeController,
 *   sendShutdownNotification: async (signal) => { ... },
 *   destroyClient: () => client.destroy(),
 * });
 * ```
 */

// Configuration loading
export {
  type AppConfig,
  type ParsedArgs,
  type EnvConfig,
  type ConfigLoaderDeps,
  parseArgs,
  loadEnvConfig,
  validateEnvConfig,
  loadConfig,
  loadConfigOrExit,
  ConfigurationError,
} from "./config-loader.ts";

// Signal handling
export {
  type CleanupContext,
  type ShutdownSignal,
  type SignalHandlerConfig,
  type SignalHandlerResult,
  createShutdownHandler,
  setupSignalHandlers,
  removeSignalHandlers,
  getPlatform,
} from "./signal-handler.ts";

// Bot factory
export {
  type BotManagers,
  type BotContext,
  type CrashHandlerOptions,
  type CrashReport,
  type BotFactoryDeps,
  type ValidationResult,
  DEFAULT_CRASH_HANDLER_OPTIONS,
  DEFAULT_CLEANUP_INTERVAL_MS,
  createShellManager,
  createWorktreeBotManager,
  createClaudeSessionManager,
  createCrashHandler,
  createBotManagers,
  setupPeriodicCleanup,
  createBotContext,
  validateBotFactoryDeps,
  createBotContextOrThrow,
  shutdownBotContext,
} from "./bot-factory.ts";

// Handler registry
export {
  type MessageHistoryState,
  type MessageHistoryOps,
  type ClaudeSessionState,
  type ClaudeSessionOps,
  type BotSettingsState,
  type BotSettingsOps,
  type AllHandlers,
  type HandlerRegistryDeps,
  type HandlerRegistry,
  createMessageHistory,
  createClaudeSession,
  createBotSettings,
  createAllHandlers,
  getAllCommands,
  cleanSessionId,
} from "./handler-registry.ts";

// Button handlers
export {
  type ButtonHandlerDeps,
  type ExpandableContentMap,
  createButtonHandlers,
  createExpandButtonHandler,
} from "./button-handlers.ts";

// Command wrappers
export {
  type CommandWrapperDeps,
  createSystemCommandHandlers,
  createParameterizedSystemHandlers,
  createClaudeCommandHandlers,
  createSettingsCommandHandlers,
  createAllCommandHandlers,
} from "./command-wrappers.ts";

// Git and Shell handlers
export {
  type GitShellHandlerDeps,
  createGitCommandHandlers,
  createShellCommandHandlers,
  createUtilityCommandHandlers,
} from "./git-shell-handlers.ts";
