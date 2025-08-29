import type { ShellProcess, ShellExecutionResult, ShellInputResult, ShellKillResult } from "./types.ts";
import { detectPlatform, getShellCommand } from "../util/platform.ts";

/**
 * Cross-platform process termination
 */
function killProcessCrossPlatform(childProcess: Deno.ChildProcess, signal: "SIGTERM" | "SIGKILL" = "SIGTERM"): void {
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
      console.error('Failed to force kill process:', fallbackError);
    }
  }
}

export class ShellManager {
  private runningProcesses = new Map<number, ShellProcess>();
  private processIdCounter = 0;
  private workDir: string;
  private platform: string;

  constructor(workDir: string) {
    this.workDir = workDir;
    this.platform = detectPlatform();
  }

  // deno-lint-ignore no-explicit-any
  async execute(command: string, input?: string, discordContext?: any): Promise<ShellExecutionResult> {
    const processId = ++this.processIdCounter;
    let output = '';
    const outputCallbacks: ((data: string) => void)[] = [];
    const completeCallbacks: ((code: number, output: string) => void)[] = [];
    const errorCallbacks: ((error: Error) => void)[] = [];

    // Cross-platform command handling
    let modifiedCommand = command;
    
    if (this.platform === 'windows') {
      // Handle Windows-specific command modifications
      if (command.trim().startsWith('python3')) {
        // On Windows, python3 is often just 'python'
        modifiedCommand = command.replace(/^python3/, 'python');
        if (!modifiedCommand.includes('-u')) {
          modifiedCommand = modifiedCommand.replace(/^python\s*/, 'python -u ');
        }
      }
      // Handle other Windows-specific cases
      if (command.includes('ls ')) {
        modifiedCommand = command.replace(/\bls\b/g, 'dir');
      }
      if (command.includes('cat ')) {
        modifiedCommand = command.replace(/\bcat\b/g, 'type');
      }
    } else {
      // Handle Python3 buffering issues by adding -u flag for unbuffered output (Unix-like systems)
      if (command.trim().startsWith('python3') && !command.includes('-u')) {
        modifiedCommand = command.replace(/^python3\s*/, 'python3 -u ');
      } else if (command.trim() === 'python3') {
        modifiedCommand = 'python3 -u';
      }
    }

    // Get platform-appropriate shell command
    const shellCmd = getShellCommand();
    
    const proc = new Deno.Command(shellCmd[0], {
      args: [...shellCmd.slice(1), modifiedCommand],
      cwd: this.workDir,
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });

    const child = proc.spawn();
    const stdin = child.stdin.getWriter();

    this.runningProcesses.set(processId, {
      command,
      startTime: new Date(),
      child,
      stdin,
      discordContext,
      outputSinceLastUpdate: '',
    });

    if (input) {
      await stdin.write(new TextEncoder().encode(input + '\n'));
    }

    const decoder = new TextDecoder();

    (async () => {
      const reader = child.stdout.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          output += text;
          // Track new output since last update
          const process = this.runningProcesses.get(processId);
          if (process) {
            process.outputSinceLastUpdate += text;
          }
          outputCallbacks.forEach(cb => cb(text));
        }
      } catch (error) {
        console.error('stdout read error:', error);
      }
    })();

    (async () => {
      const reader = child.stderr.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          output += text;
          // Track new output since last update
          const process = this.runningProcesses.get(processId);
          if (process) {
            process.outputSinceLastUpdate += text;
          }
          outputCallbacks.forEach(cb => cb(text));
        }
      } catch (error) {
        console.error('stderr read error:', error);
      }
    })();

    child.status.then((status) => {
      this.runningProcesses.delete(processId);
      completeCallbacks.forEach(cb => cb(status.code, output));
    }).catch((error) => {
      this.runningProcesses.delete(processId);
      errorCallbacks.forEach(cb => cb(error));
    });

    return {
      processId,
      onOutput: (callback: (output: string) => void) => {
        outputCallbacks.push(callback);
      },
      onComplete: (callback: (code: number, output: string) => void) => {
        completeCallbacks.push(callback);
      },
      onError: (callback: (error: Error) => void) => {
        errorCallbacks.push(callback);
      },
    };
  }

  async sendInput(processId: number, text: string): Promise<ShellInputResult> {
    const process = this.runningProcesses.get(processId);
    if (!process || !process.stdin) {
      return { success: false };
    }

    try {
      await process.stdin.write(new TextEncoder().encode(text + '\n'));
      return { success: true, process };
    } catch (error) {
      console.error(`Failed to send input to process ${processId}:`, error);
      return { success: false };
    }
  }

  getRunningProcesses(): Map<number, ShellProcess> {
    return this.runningProcesses;
  }

  getNewOutput(processId: number): string {
    const process = this.runningProcesses.get(processId);
    if (!process) {
      return '';
    }
    
    const newOutput = process.outputSinceLastUpdate || '';
    process.outputSinceLastUpdate = ''; // Clear after getting
    return newOutput;
  }

  async killProcess(processId: number): Promise<ShellKillResult> {
    const process = this.runningProcesses.get(processId);
    if (!process) {
      return { success: false };
    }

    try {
      process.child.kill("SIGTERM");

      const timeout = setTimeout(() => {
        process.child.kill("SIGKILL");
      }, 5000);

      await process.child.status;
      clearTimeout(timeout);

      this.runningProcesses.delete(processId);
      return { success: true, process };
    } catch (error) {
      console.error(`Failed to kill process ${processId}:`, error);
      return { success: false };
    }
  }

  killAllProcesses(): void {
    for (const [id, process] of this.runningProcesses) {
      try {
        process.child.kill("SIGTERM");
      } catch (error) {
        console.error(`Failed to kill process ${id}:`, error);
      }
    }
  }
}