/**
 * Bot factory for creating and assembling Discord bot components.
 * Handles manager creation, crash handler initialization, and Discord client setup.
 * 
 * @module core/bot-factory
 */

import { ShellManager } from "../shell/index.ts";
import { WorktreeBotManager } from "../git/index.ts";
import { 
  ProcessCrashHandler, 
  ProcessHealthMonitor, 
  setupGlobalErrorHandlers,
  type RecoveryOptions 
} from "../process/index.ts";
import { ClaudeSessionManager } from "../claude/index.ts";
import type { AppConfig } from "./config-loader.ts";

// ================================
// Types and Interfaces
// ================================

/**
 * Core managers created by the bot factory.
 * These handle shell processes, git worktrees, crash recovery, and Claude sessions.
 */
export interface BotManagers {
  /** Shell process manager for command execution */
  shellManager: ShellManager;
  /** Git worktree bot manager for multi-branch operations */
  worktreeBotManager: WorktreeBotManager;
  /** Process crash handler for error recovery */
  crashHandler: ProcessCrashHandler;
  /** Health monitor for process status tracking */
  healthMonitor: ProcessHealthMonitor;
  /** Claude session manager for AI conversation state */
  claudeSessionManager: ClaudeSessionManager;
}

/**
 * Complete bot context including managers and cleanup resources.
 */
export interface BotContext extends BotManagers {
  /** Interval ID for periodic cleanup tasks */
  cleanupIntervalId: number;
  /** Function to stop cleanup and release resources */
  stopCleanup: () => void;
}

/**
 * Options for crash handler configuration.
 */
export interface CrashHandlerOptions extends RecoveryOptions {
  /** Callback invoked when a crash is reported */
  onCrashNotification?: (report: CrashReport) => Promise<void>;
}

/**
 * Crash report structure for notification callbacks.
 */
export interface CrashReport {
  timestamp: Date;
  processType: 'shell' | 'worktree' | 'claude' | 'main';
  processId?: number | string;
  error: Error;
  context?: string;
  recoverable: boolean;
}

/**
 * Dependencies for bot factory operations.
 * Uses dependency injection for testability.
 */
export interface BotFactoryDeps {
  /** Application configuration */
  config: AppConfig;
  /** Crash handler options (optional) */
  crashHandlerOptions?: CrashHandlerOptions;
  /** Cleanup interval in milliseconds (default: 1 hour) */
  cleanupIntervalMs?: number;
}

/**
 * Result of bot factory validation.
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Error messages if validation failed */
  errors: string[];
}

// ================================
// Default Configuration
// ================================

/**
 * Default crash handler options.
 */
export const DEFAULT_CRASH_HANDLER_OPTIONS: Required<Omit<CrashHandlerOptions, 'onCrashNotification'>> = {
  maxRetries: 3,
  retryDelay: 5000,
  enableAutoRestart: true,
  logCrashes: true,
  notifyOnCrash: true,
};

/**
 * Default cleanup interval (1 hour in milliseconds).
 */
export const DEFAULT_CLEANUP_INTERVAL_MS = 3600000;

// ================================
// Factory Functions
// ================================

/**
 * Create the shell manager for command execution.
 * 
 * @param workDir - Working directory for shell commands
 * @returns Configured ShellManager instance
 * 
 * @example
 * ```typescript
 * const shellManager = createShellManager('/path/to/project');
 * ```
 */
export function createShellManager(workDir: string): ShellManager {
  return new ShellManager(workDir);
}

/**
 * Create the worktree bot manager for git operations.
 * 
 * @returns Configured WorktreeBotManager instance
 * 
 * @example
 * ```typescript
 * const worktreeBotManager = createWorktreeBotManager();
 * ```
 */
export function createWorktreeBotManager(): WorktreeBotManager {
  return new WorktreeBotManager();
}

/**
 * Create the Claude session manager for AI conversation state.
 * 
 * @returns Configured ClaudeSessionManager instance
 * 
 * @example
 * ```typescript
 * const sessionManager = createClaudeSessionManager();
 * ```
 */
export function createClaudeSessionManager(): ClaudeSessionManager {
  return new ClaudeSessionManager();
}

/**
 * Create and configure the crash handler with health monitor.
 * 
 * @param options - Crash handler configuration options
 * @returns Tuple of [ProcessCrashHandler, ProcessHealthMonitor]
 * 
 * @example
 * ```typescript
 * const [crashHandler, healthMonitor] = createCrashHandler({
 *   maxRetries: 5,
 *   onCrashNotification: async (report) => {
 *     console.log('Crash reported:', report);
 *   }
 * });
 * ```
 */
export function createCrashHandler(
  options: CrashHandlerOptions = {}
): [ProcessCrashHandler, ProcessHealthMonitor] {
  const crashHandler = new ProcessCrashHandler({
    maxRetries: options.maxRetries ?? DEFAULT_CRASH_HANDLER_OPTIONS.maxRetries,
    retryDelay: options.retryDelay ?? DEFAULT_CRASH_HANDLER_OPTIONS.retryDelay,
    enableAutoRestart: options.enableAutoRestart ?? DEFAULT_CRASH_HANDLER_OPTIONS.enableAutoRestart,
    logCrashes: options.logCrashes ?? DEFAULT_CRASH_HANDLER_OPTIONS.logCrashes,
    notifyOnCrash: options.notifyOnCrash ?? DEFAULT_CRASH_HANDLER_OPTIONS.notifyOnCrash,
  });

  const healthMonitor = new ProcessHealthMonitor(crashHandler);

  // Setup notification callback if provided
  if (options.onCrashNotification) {
    crashHandler.setNotificationCallback(options.onCrashNotification);
  }

  return [crashHandler, healthMonitor];
}

/**
 * Create all bot managers with proper initialization and wiring.
 * 
 * @param deps - Bot factory dependencies
 * @returns All configured bot managers
 * 
 * @example
 * ```typescript
 * const managers = createBotManagers({
 *   config: { workDir: '/path/to/project', ... },
 *   crashHandlerOptions: { maxRetries: 5 }
 * });
 * ```
 */
export function createBotManagers(deps: BotFactoryDeps): BotManagers {
  const { config, crashHandlerOptions = {} } = deps;

  // Create individual managers
  const shellManager = createShellManager(config.workDir);
  const worktreeBotManager = createWorktreeBotManager();
  const claudeSessionManager = createClaudeSessionManager();
  const [crashHandler, healthMonitor] = createCrashHandler(crashHandlerOptions);

  // Wire up crash handler with managers
  crashHandler.setManagers(shellManager, worktreeBotManager);

  // Setup global error handlers
  setupGlobalErrorHandlers(crashHandler);

  return {
    shellManager,
    worktreeBotManager,
    crashHandler,
    healthMonitor,
    claudeSessionManager,
  };
}

/**
 * Setup periodic cleanup tasks for bot managers.
 * 
 * @param managers - Bot managers to clean up periodically
 * @param intervalMs - Cleanup interval in milliseconds
 * @param additionalCleanup - Optional additional cleanup functions
 * @returns Interval ID for cleanup task
 * 
 * @example
 * ```typescript
 * const intervalId = setupPeriodicCleanup(
 *   managers,
 *   3600000, // 1 hour
 *   [() => cleanupPaginationStates()]
 * );
 * ```
 */
export function setupPeriodicCleanup(
  managers: BotManagers,
  intervalMs: number = DEFAULT_CLEANUP_INTERVAL_MS,
  additionalCleanup: Array<() => void> = []
): number {
  const cleanup = () => {
    try {
      managers.crashHandler.cleanup();
      managers.claudeSessionManager.cleanup();
      
      // Run additional cleanup functions
      for (const cleanupFn of additionalCleanup) {
        try {
          cleanupFn();
        } catch (error) {
          console.error('Error during additional cleanup:', error);
        }
      }
    } catch (error) {
      console.error('Error during periodic cleanup:', error);
    }
  };

  return setInterval(cleanup, intervalMs);
}

/**
 * Create complete bot context with managers and cleanup setup.
 * This is the main entry point for bot initialization.
 * 
 * @param deps - Bot factory dependencies
 * @param additionalCleanup - Optional additional cleanup functions
 * @returns Complete bot context with cleanup controls
 * 
 * @example
 * ```typescript
 * const botContext = createBotContext(
 *   {
 *     config: loadConfig(),
 *     crashHandlerOptions: {
 *       maxRetries: 5,
 *       onCrashNotification: async (report) => {
 *         // Send Discord notification
 *       }
 *     }
 *   },
 *   [() => cleanupPaginationStates()]
 * );
 * 
 * // Later, during shutdown:
 * botContext.stopCleanup();
 * ```
 */
export function createBotContext(
  deps: BotFactoryDeps,
  additionalCleanup: Array<() => void> = []
): BotContext {
  const managers = createBotManagers(deps);
  const cleanupIntervalMs = deps.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS;
  
  const cleanupIntervalId = setupPeriodicCleanup(
    managers,
    cleanupIntervalMs,
    additionalCleanup
  );

  const stopCleanup = () => {
    clearInterval(cleanupIntervalId);
  };

  return {
    ...managers,
    cleanupIntervalId,
    stopCleanup,
  };
}

/**
 * Validate bot factory dependencies.
 * 
 * @param deps - Dependencies to validate
 * @returns Validation result with any errors
 * 
 * @example
 * ```typescript
 * const result = validateBotFactoryDeps(deps);
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors);
 * }
 * ```
 */
export function validateBotFactoryDeps(deps: BotFactoryDeps): ValidationResult {
  const errors: string[] = [];

  if (!deps.config) {
    errors.push('Configuration is required');
  } else {
    if (!deps.config.workDir) {
      errors.push('Working directory is required in configuration');
    }
  }

  if (deps.cleanupIntervalMs !== undefined && deps.cleanupIntervalMs <= 0) {
    errors.push('Cleanup interval must be a positive number');
  }

  if (deps.crashHandlerOptions) {
    const opts = deps.crashHandlerOptions;
    if (opts.maxRetries !== undefined && opts.maxRetries < 0) {
      errors.push('Max retries must be non-negative');
    }
    if (opts.retryDelay !== undefined && opts.retryDelay < 0) {
      errors.push('Retry delay must be non-negative');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create bot context with validation.
 * Throws an error if validation fails.
 * 
 * @param deps - Bot factory dependencies
 * @param additionalCleanup - Optional additional cleanup functions
 * @returns Complete bot context
 * @throws Error if validation fails
 * 
 * @example
 * ```typescript
 * try {
 *   const context = createBotContextOrThrow(deps);
 * } catch (error) {
 *   console.error('Failed to create bot context:', error.message);
 *   Deno.exit(1);
 * }
 * ```
 */
export function createBotContextOrThrow(
  deps: BotFactoryDeps,
  additionalCleanup: Array<() => void> = []
): BotContext {
  const validation = validateBotFactoryDeps(deps);
  
  if (!validation.valid) {
    throw new Error(`Bot factory validation failed:\n${validation.errors.join('\n')}`);
  }

  return createBotContext(deps, additionalCleanup);
}

/**
 * Gracefully shutdown bot context and release all resources.
 * 
 * @param context - Bot context to shutdown
 * @param options - Shutdown options
 * 
 * @example
 * ```typescript
 * shutdownBotContext(botContext, {
 *   killShellProcesses: true,
 *   killWorktreeBots: true
 * });
 * ```
 */
export function shutdownBotContext(
  context: BotContext,
  options: {
    killShellProcesses?: boolean;
    killWorktreeBots?: boolean;
  } = {}
): void {
  const { killShellProcesses = true, killWorktreeBots = true } = options;

  // Stop periodic cleanup
  context.stopCleanup();

  // Kill shell processes if requested
  if (killShellProcesses) {
    try {
      context.shellManager.killAllProcesses();
    } catch (error) {
      console.error('Error killing shell processes:', error);
    }
  }

  // Kill worktree bots if requested
  if (killWorktreeBots) {
    try {
      context.worktreeBotManager.killAllWorktreeBots();
    } catch (error) {
      console.error('Error killing worktree bots:', error);
    }
  }

  // Final cleanup
  try {
    context.crashHandler.cleanup();
    context.claudeSessionManager.cleanup();
  } catch (error) {
    console.error('Error during final cleanup:', error);
  }
}
