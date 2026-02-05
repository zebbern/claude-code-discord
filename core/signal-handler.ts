/**
 * Signal handler for graceful shutdown of the Discord bot.
 * Handles SIGINT (Ctrl+C), SIGTERM, and SIGBREAK (Windows) signals.
 * 
 * @module core/signal-handler
 */

/**
 * Context required for cleanup operations during shutdown.
 */
export interface CleanupContext {
  /** Callback to kill all running shell processes */
  killAllShellProcesses: () => void;
  /** Callback to kill all worktree bots */
  killAllWorktreeBots: () => void;
  /** AbortController for the Claude session, if active */
  getClaudeController: () => AbortController | null;
  /** Callback to send shutdown notification */
  sendShutdownNotification: (signal: string) => Promise<void>;
  /** Callback to destroy the Discord client */
  destroyClient: () => void;
}

/**
 * Signal types that can trigger shutdown.
 */
export type ShutdownSignal = 'SIGINT' | 'SIGTERM' | 'SIGBREAK';

/**
 * Configuration for signal handler setup.
 */
export interface SignalHandlerConfig {
  /** Delay in ms before forcing exit (default: 1000) */
  exitDelay?: number;
  /** Whether to log signal events (default: true) */
  verbose?: boolean;
}

/**
 * Result of signal handler registration.
 */
export interface SignalHandlerResult {
  /** Signals that were successfully registered */
  registeredSignals: ShutdownSignal[];
  /** Signals that failed to register with their error messages */
  failedSignals: Array<{ signal: ShutdownSignal; error: string }>;
}

/**
 * Creates the shutdown handler function.
 * 
 * @param ctx - Cleanup context with callbacks for shutdown operations
 * @param config - Configuration options
 * @returns Async function that handles the shutdown process
 */
export function createShutdownHandler(
  ctx: CleanupContext,
  config: SignalHandlerConfig = {}
): (signal: ShutdownSignal) => Promise<void> {
  const { exitDelay = 1000, verbose = true } = config;
  
  return async (signal: ShutdownSignal): Promise<void> => {
    if (verbose) {
      console.log(`\n${signal} signal received. Stopping bot...`);
    }
    
    try {
      // Stop all shell processes
      ctx.killAllShellProcesses();
      
      // Kill all worktree bots
      ctx.killAllWorktreeBots();
      
      // Cancel Claude Code session if active
      const claudeController = ctx.getClaudeController();
      if (claudeController) {
        claudeController.abort();
      }
      
      // Send shutdown notification
      await ctx.sendShutdownNotification(signal);
      
      // Allow time for messages to be sent before destroying client
      setTimeout(() => {
        ctx.destroyClient();
        Deno.exit(0);
      }, exitDelay);
    } catch (error) {
      console.error('Error during shutdown:', error);
      Deno.exit(1);
    }
  };
}

/**
 * Get the current operating system platform.
 * Abstracted for testability.
 * 
 * @returns Platform identifier ('windows', 'darwin', 'linux', etc.)
 */
export function getPlatform(): typeof Deno.build.os {
  return Deno.build.os;
}

/**
 * Register a signal listener with error handling.
 * 
 * @param signal - Signal to listen for
 * @param handler - Handler function to call when signal is received
 * @returns True if registration succeeded, error message if failed
 */
function tryRegisterSignal(
  signal: Deno.Signal,
  handler: () => void
): { success: true } | { success: false; error: string } {
  try {
    Deno.addSignalListener(signal, handler);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

/**
 * Setup cross-platform signal handlers for graceful shutdown.
 * 
 * Registers appropriate signal handlers based on the operating system:
 * - **All platforms**: SIGINT (Ctrl+C)
 * - **Windows**: SIGBREAK (Ctrl+Break)
 * - **Unix/Linux/macOS**: SIGTERM
 * 
 * @param ctx - Cleanup context with necessary callbacks
 * @param config - Optional configuration for handler behavior
 * @returns Result indicating which signals were registered successfully
 * 
 * @example
 * ```typescript
 * const result = setupSignalHandlers({
 *   killAllShellProcesses: () => shellManager.killAll(),
 *   killAllWorktreeBots: () => worktreeManager.killAll(),
 *   getClaudeController: () => claudeController,
 *   sendShutdownNotification: async (signal) => {
 *     await sender([{ type: 'system', content: '', metadata: { subtype: 'shutdown', signal } }]);
 *   },
 *   destroyClient: () => client.destroy(),
 * });
 * 
 * console.log('Registered signals:', result.registeredSignals);
 * ```
 */
export function setupSignalHandlers(
  ctx: CleanupContext,
  config: SignalHandlerConfig = {}
): SignalHandlerResult {
  const { verbose = true } = config;
  const platform = getPlatform();
  
  const result: SignalHandlerResult = {
    registeredSignals: [],
    failedSignals: [],
  };
  
  // Create the shutdown handler
  const handleSignal = createShutdownHandler(ctx, config);
  
  // SIGINT (Ctrl+C) - works on all platforms
  const sigintResult = tryRegisterSignal('SIGINT', () => handleSignal('SIGINT'));
  if (sigintResult.success) {
    result.registeredSignals.push('SIGINT');
  } else {
    result.failedSignals.push({ signal: 'SIGINT', error: sigintResult.error });
    if (verbose) {
      console.warn('Could not register SIGINT handler:', sigintResult.error);
    }
  }
  
  // Platform-specific signals
  if (platform === 'windows') {
    // Windows-specific: SIGBREAK (Ctrl+Break)
    const sigbreakResult = tryRegisterSignal('SIGBREAK', () => handleSignal('SIGBREAK'));
    if (sigbreakResult.success) {
      result.registeredSignals.push('SIGBREAK');
    } else {
      result.failedSignals.push({ signal: 'SIGBREAK', error: sigbreakResult.error });
      if (verbose) {
        console.warn('Could not register SIGBREAK handler:', sigbreakResult.error);
      }
    }
  } else {
    // Unix-like systems: SIGTERM
    const sigtermResult = tryRegisterSignal('SIGTERM', () => handleSignal('SIGTERM'));
    if (sigtermResult.success) {
      result.registeredSignals.push('SIGTERM');
    } else {
      result.failedSignals.push({ signal: 'SIGTERM', error: sigtermResult.error });
      if (verbose) {
        console.warn('Could not register SIGTERM handler:', sigtermResult.error);
      }
    }
  }
  
  return result;
}

/**
 * Remove all registered signal handlers.
 * Useful for cleanup in tests or when restarting signal handling.
 * 
 * @param signals - Array of signals to remove handlers for
 */
export function removeSignalHandlers(signals: ShutdownSignal[]): void {
  for (const signal of signals) {
    try {
      // Note: Deno doesn't have removeSignalListener, so we track handlers externally
      // This is a placeholder for future implementation if needed
      console.log(`Signal handler for ${signal} would be removed (not yet supported by Deno)`);
    } catch {
      // Ignore errors when removing handlers
    }
  }
}
