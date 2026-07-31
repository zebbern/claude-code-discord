// Enhanced process crash handling and recovery
import type { ShellManager } from "../shell/handler.ts";
import type { WorktreeBotManager } from "../git/process-manager.ts";

export interface CrashReport {
  timestamp: Date;
  processType: 'shell' | 'worktree' | 'claude' | 'main';
  processId?: number | string;
  error: Error;
  context?: string;
  recoverable: boolean;
}

export interface RecoveryOptions {
  maxRetries?: number;
  retryDelay?: number;
  enableAutoRestart?: boolean;
  logCrashes?: boolean;
  notifyOnCrash?: boolean;
}

export class ProcessCrashHandler {
  private crashes: CrashReport[] = [];
  private retryCounters = new Map<string, number>();
  private options: Required<RecoveryOptions>;
  private shellManager?: ShellManager;
  private worktreeManager?: WorktreeBotManager;
  private notificationCallback?: (report: CrashReport) => Promise<void>;

  constructor(options: RecoveryOptions = {}) {
    this.options = {
      maxRetries: 3,
      retryDelay: 5000,
      enableAutoRestart: true,
      logCrashes: true,
      notifyOnCrash: true,
      ...options
    };
  }

  setManagers(shellManager: ShellManager, worktreeManager: WorktreeBotManager) {
    this.shellManager = shellManager;
    this.worktreeManager = worktreeManager;
  }

  setNotificationCallback(callback: (report: CrashReport) => Promise<void>) {
    this.notificationCallback = callback;
  }

  // Report a process crash
  async reportCrash(
    processType: CrashReport['processType'],
    error: Error,
    processId?: number | string,
    context?: string
  ): Promise<boolean> {
    const report: CrashReport = {
      timestamp: new Date(),
      processType,
      processId,
      error,
      context,
      recoverable: this.isRecoverable(error)
    };

    this.crashes.push(report);

    // Keep only last 100 crash reports
    if (this.crashes.length > 100) {
      this.crashes.shift();
    }

    if (this.options.logCrashes) {
      console.error(`Process crash reported:`, {
        type: processType,
        id: processId,
        error: error.message,
        context,
        recoverable: report.recoverable
      });
    }

    if (this.options.notifyOnCrash && this.notificationCallback) {
      try {
        await this.notificationCallback(report);
      } catch (notificationError) {
        console.error('Failed to send crash notification:', notificationError);
      }
    }

    // Attempt recovery if enabled and process is recoverable
    if (this.options.enableAutoRestart && report.recoverable) {
      return await this.attemptRecovery(report);
    }

    return false;
  }

  // Determine if a process crash is recoverable
  private isRecoverable(error: Error): boolean {
    const unrecoverablePatterns = [
      /ENOENT.*node/i, // Node.js not found
      /ENOENT.*deno/i, // Deno not found
      /EACCES.*permission/i, // Permission denied
      /EMFILE/i, // Too many open files
      /ENOMEM/i, // Out of memory
      /SIGKILL/i, // Force killed
    ];

    return !unrecoverablePatterns.some(pattern => pattern.test(error.message));
  }

  // Attempt to recover from a crash
  private async attemptRecovery(report: CrashReport): Promise<boolean> {
    const key = `${report.processType}_${report.processId}`;
    const currentRetries = this.retryCounters.get(key) || 0;

    if (currentRetries >= this.options.maxRetries) {
      console.error(`Max retries reached for ${key}, giving up`);
      return false;
    }

    this.retryCounters.set(key, currentRetries + 1);

    console.log(`Attempting recovery for ${key} (attempt ${currentRetries + 1}/${this.options.maxRetries})`);

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));

    try {
      switch (report.processType) {
        case 'shell':
          return await this.recoverShellProcess(report);
        case 'worktree':
          return await this.recoverWorktreeProcess(report);
        case 'claude':
          return await this.recoverClaudeProcess(report);
        default:
          console.warn(`Recovery not implemented for process type: ${report.processType}`);
          return false;
      }
    } catch (recoveryError) {
      console.error(`Recovery failed for ${key}:`, recoveryError);
      return false;
    }
  }

  /**
   * Recover a crashed shell process by cleaning up its state.
   * Shell processes cannot be automatically re-run (we don't know what
   * the user intended), so recovery means releasing resources cleanly.
   */
  private async recoverShellProcess(report: CrashReport): Promise<boolean> {
    if (!this.shellManager || typeof report.processId !== 'number') {
      console.warn(`[CrashHandler] Cannot recover shell process: ${!this.shellManager ? 'no ShellManager' : 'invalid processId type'}`);
      return false;
    }

    try {
      // Attempt to kill the process if it's still running
      const result = await this.shellManager.killProcess(report.processId);
      if (result.success) {
        console.log(`[CrashHandler] Cleaned up crashed shell process ${report.processId}`);
      } else {
        // Process already gone — that's fine, we just needed to ensure cleanup
        console.log(`[CrashHandler] Shell process ${report.processId} already terminated`);
      }
      return true;
    } catch (error) {
      console.error(`[CrashHandler] Failed to clean up shell process ${report.processId}:`, error);
      return false;
    }
  }

  /**
   * Recover a crashed worktree bot process by cleaning up its state.
   * Worktree bots require the original spawn parameters to restart,
   * so recovery kills the zombie and marks the slot available.
   */
  private async recoverWorktreeProcess(report: CrashReport): Promise<boolean> {
    if (!this.worktreeManager || typeof report.processId !== 'string') {
      console.warn(`[CrashHandler] Cannot recover worktree process: ${!this.worktreeManager ? 'no WorktreeManager' : 'invalid processId type'}`);
      return false;
    }

    try {
      // Kill the crashed worktree bot to release resources
      const killed = this.worktreeManager.killWorktreeBot(report.processId);
      if (killed) {
        console.log(`[CrashHandler] Killed crashed worktree bot at ${report.processId}`);
      } else {
        console.log(`[CrashHandler] Worktree bot at ${report.processId} already terminated`);
      }

      // Wait for OS-level cleanup of child process
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Note: Cannot auto-restart without the original spawn parameters.
      // The user will need to re-run the /worktree command to restart.
      console.log(`[CrashHandler] Worktree bot at ${report.processId} cleaned up. User must re-run /worktree to restart.`);
      return true;
    } catch (error) {
      console.error(`[CrashHandler] Failed to recover worktree process ${report.processId}:`, error);
      return false;
    }
  }

  /**
   * Handle a Claude process crash. Claude sessions are stateful via
   * session IDs, so a crash just means the current query is lost.
   * The next query will start a fresh subprocess automatically.
   */
  private async recoverClaudeProcess(report: CrashReport): Promise<boolean> {
    console.log(`[CrashHandler] Claude process crash (${report.context || 'unknown context'}). Session will reset on next request.`);
    // Reset the retry counter so the next query attempt starts fresh
    if (report.processId !== undefined) {
      this.resetRetryCounter('claude', report.processId);
    }
    return true;
  }

  // Get crash statistics
  getCrashStats(): {
    totalCrashes: number;
    recentCrashes: number;
    crashesByType: Record<string, number>;
    recoveryRate: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - 3600000; // 1 hour

    const recentCrashes = this.crashes.filter(crash => 
      crash.timestamp.getTime() > oneHourAgo
    );

    const crashesByType = this.crashes.reduce((acc, crash) => {
      acc[crash.processType] = (acc[crash.processType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const recoverableCrashes = this.crashes.filter(crash => crash.recoverable).length;
    const recoveryRate = this.crashes.length > 0 ? recoverableCrashes / this.crashes.length : 0;

    return {
      totalCrashes: this.crashes.length,
      recentCrashes: recentCrashes.length,
      crashesByType,
      recoveryRate
    };
  }

  // Get recent crash reports
  getRecentCrashes(hours: number = 24): CrashReport[] {
    const cutoff = Date.now() - (hours * 3600000);
    return this.crashes.filter(crash => crash.timestamp.getTime() > cutoff);
  }

  // Clean up old crash reports
  cleanup(maxAge: number = 7 * 24 * 3600000): void { // 7 days default
    const cutoff = Date.now() - maxAge;
    this.crashes = this.crashes.filter(crash => crash.timestamp.getTime() > cutoff);
    
    // Clean up retry counters for old processes
    const activeKeys = new Set(this.crashes.map(crash => `${crash.processType}_${crash.processId}`));
    for (const key of this.retryCounters.keys()) {
      if (!activeKeys.has(key)) {
        this.retryCounters.delete(key);
      }
    }
  }

  // Reset retry counter for a process
  resetRetryCounter(processType: string, processId: number | string): void {
    const key = `${processType}_${processId}`;
    this.retryCounters.delete(key);
  }
}

// Global process error handlers
export function setupGlobalErrorHandlers(crashHandler: ProcessCrashHandler) {
  // Handle uncaught exceptions
  globalThis.addEventListener('error', (event) => {
    crashHandler.reportCrash('main', event.error, 'global', 'Uncaught exception');
  });

  // Handle unhandled promise rejections
  globalThis.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    crashHandler.reportCrash('main', error, 'global', 'Unhandled promise rejection');
  });

  // Handle Deno-specific signals
  const handleSignal = (signal: string) => {
    console.log(`Received ${signal}, initiating graceful shutdown...`);
    
    // Perform cleanup here
    crashHandler.cleanup();
    
    // Exit after cleanup
    setTimeout(() => Deno.exit(0), 1000);
  };

  try {
    // Cross-platform signal handling
    const platform = Deno.build.os;
    
    // SIGINT (Ctrl+C) is supported on all platforms
    Deno.addSignalListener("SIGINT", () => handleSignal("SIGINT"));
    
    if (platform === "windows") {
      // Windows-specific signals
      try {
        Deno.addSignalListener("SIGBREAK", () => handleSignal("SIGBREAK"));
      } catch (winError) {
        console.warn('Could not register SIGBREAK handler:', winError);
      }
      
      // Note: SIGTERM is not supported on Windows
      console.log('Signal handlers registered for Windows (SIGINT, SIGBREAK)');
    } else {
      // Unix-like systems (Linux, macOS)
      try {
        Deno.addSignalListener("SIGTERM", () => handleSignal("SIGTERM"));
        console.log('Signal handlers registered for Unix (SIGINT, SIGTERM)');
      } catch (unixError) {
        console.warn('Could not register SIGTERM handler:', unixError);
      }
    }
  } catch (error) {
    console.warn('Could not register signal handlers:', error);
  }
}

// Wrapper function to automatically report crashes from async operations
export function withCrashReporting<T extends any[], R>(
  crashHandler: ProcessCrashHandler,
  processType: CrashReport['processType'],
  processId?: number | string,
  context?: string
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: T): Promise<R> {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        await crashHandler.reportCrash(
          processType,
          error instanceof Error ? error : new Error(String(error)),
          processId,
          `${target.constructor.name}.${propertyKey}: ${context || ''}`
        );
        throw error;
      }
    };

    return descriptor;
  };
}

// Health check utilities
export class ProcessHealthMonitor {
  private intervals = new Map<string, number>();
  private healthStatus = new Map<string, boolean>();
  
  constructor(private crashHandler: ProcessCrashHandler) {}

  // Start monitoring a process
  startMonitoring(
    processId: string,
    checkFunction: () => Promise<boolean>,
    interval: number = 30000
  ): void {
    this.stopMonitoring(processId); // Stop any existing monitoring
    
    const intervalId = setInterval(async () => {
      try {
        const isHealthy = await checkFunction();
        this.healthStatus.set(processId, isHealthy);
        
        if (!isHealthy) {
          await this.crashHandler.reportCrash(
            'main',
            new Error('Health check failed'),
            processId,
            'Process health monitor'
          );
        }
      } catch (error) {
        this.healthStatus.set(processId, false);
        await this.crashHandler.reportCrash(
          'main',
          error instanceof Error ? error : new Error(String(error)),
          processId,
          'Health check error'
        );
      }
    }, interval);
    
    this.intervals.set(processId, intervalId);
  }

  // Stop monitoring a process
  stopMonitoring(processId: string): void {
    const intervalId = this.intervals.get(processId);
    if (intervalId !== undefined) {
      clearInterval(intervalId);
      this.intervals.delete(processId);
    }
    this.healthStatus.delete(processId);
  }

  // Get health status
  getHealthStatus(): Record<string, boolean> {
    return Object.fromEntries(this.healthStatus);
  }

  // Stop all monitoring
  stopAll(): void {
    for (const [processId] of this.intervals) {
      this.stopMonitoring(processId);
    }
  }
}