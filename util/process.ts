/**
 * Cross-platform process utilities for Deno applications
 * @module util/process
 */

import { detectPlatform } from "./platform.ts";

/**
 * Terminates a child process in a cross-platform compatible manner.
 * 
 * On Windows, SIGTERM is not supported, so this function maps:
 * - SIGTERM → SIGINT (graceful shutdown equivalent)
 * - SIGKILL → SIGKILL (force kill, works on all platforms)
 * 
 * On Unix-like systems (Linux, macOS), both signals work natively.
 * 
 * If the initial kill attempt fails, the function falls back to SIGKILL
 * as a last resort to ensure the process is terminated.
 * 
 * @param childProcess - The Deno.ChildProcess instance to terminate
 * @param signal - The termination signal: "SIGTERM" for graceful shutdown, "SIGKILL" for force kill
 * @default signal "SIGTERM"
 * 
 * @example
 * ```typescript
 * import { killProcessCrossPlatform } from "./util/process.ts";
 * 
 * // Graceful shutdown
 * killProcessCrossPlatform(childProcess);
 * 
 * // Force kill
 * killProcessCrossPlatform(childProcess, "SIGKILL");
 * ```
 */
export function killProcessCrossPlatform(
  childProcess: Deno.ChildProcess,
  signal: "SIGTERM" | "SIGKILL" = "SIGTERM"
): void {
  const platform = detectPlatform();

  try {
    if (platform === "windows") {
      // On Windows, use SIGINT or SIGKILL (SIGTERM not supported)
      if (signal === "SIGTERM") {
        childProcess.kill("SIGINT"); // Windows equivalent of graceful shutdown
      } else {
        childProcess.kill("SIGKILL"); // Force kill works on Windows
      }
    } else {
      // Unix-like systems support both SIGTERM and SIGKILL
      childProcess.kill(signal);
    }
  } catch (error) {
    console.error(`Failed to kill process with ${signal}:`, error);
    // Fallback: try SIGKILL on any platform
    try {
      childProcess.kill("SIGKILL");
    } catch (fallbackError) {
      console.error("Failed to force kill process:", fallbackError);
    }
  }
}
