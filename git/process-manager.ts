// Worktree bot process management
import { killProcessCrossPlatform } from "../util/process.ts";
import type { BotSettings } from "../types/shared.ts";

export interface WorktreeBotProcess {
  process: Deno.ChildProcess;
  branch: string;
  workDir: string;
  startTime: Date;
  category: string;
}

export class WorktreeBotManager {
  private spawnedBots = new Map<string, WorktreeBotProcess>();

  // Spawn a new worktree bot process
  async spawnWorktreeBot(config: {
    fullPath: string;
    branch: string;
    actualCategoryName: string;
    discordToken: string;
    applicationId: string;
    /** Bot mention settings to propagate to spawned bot */
    botSettings: BotSettings;
  }): Promise<void> {
    const { fullPath, branch, actualCategoryName, discordToken, applicationId, botSettings } = config;
    
    // Check if bot already exists for this path
    const existingBot = this.spawnedBots.get(fullPath);
    if (existingBot) {
      console.log(`Worktree bot already running for ${fullPath}, skipping spawn`);
      return;
    }

    const args = ["--category", actualCategoryName];
    if (botSettings.mentionUserId) {
      args.push("--user-id", botSettings.mentionUserId);
    }

    const botProcess = new Deno.Command(Deno.execPath(), {
      args: ["run", "--allow-all", Deno.mainModule, ...args],
      cwd: fullPath,
      env: {
        ...Deno.env.toObject(),
        DISCORD_TOKEN: discordToken,
        APPLICATION_ID: applicationId,
      },
      stdout: "inherit",
      stderr: "inherit",
    });

    const childProcess = botProcess.spawn();
    
    // Store the process info
    this.spawnedBots.set(fullPath, {
      process: childProcess,
      branch,
      workDir: fullPath,
      startTime: new Date(),
      category: actualCategoryName,
    });

    // Monitor the process for completion
    this.monitorProcess(fullPath, childProcess);

    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log(`Started worktree bot process: ${fullPath}`);
  }

  // Monitor a process and clean up when it exits
  private async monitorProcess(path: string, process: Deno.ChildProcess) {
    try {
      const status = await process.status;
      console.log(`Worktree bot for ${path} exited with code ${status.code}`);
    } catch (error) {
      console.log(`Worktree bot for ${path} terminated: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // Clean up from our tracking
      this.spawnedBots.delete(path);
    }
  }

  // Kill a specific worktree bot
  killWorktreeBot(path: string): boolean {
    const botInfo = this.spawnedBots.get(path);
    if (!botInfo) {
      return false;
    }

    try {
      killProcessCrossPlatform(botInfo.process, "SIGTERM");
      console.log(`Sent termination signal to worktree bot: ${path}`);
      return true;
    } catch (error) {
      console.error(`Failed to kill worktree bot ${path}:`, error);
      // Remove from tracking even if kill failed
      this.spawnedBots.delete(path);
      return false;
    }
  }

  // Kill all spawned worktree bots
  killAllWorktreeBots(): void {
    console.log(`Killing ${this.spawnedBots.size} worktree bot processes...`);
    
    for (const [path, botInfo] of this.spawnedBots.entries()) {
      try {
        killProcessCrossPlatform(botInfo.process, "SIGTERM");
        console.log(`Sent termination signal to worktree bot: ${path}`);
      } catch (error) {
        console.error(`Failed to kill worktree bot ${path}:`, error);
      }
    }
    
    // Clear the tracking map
    this.spawnedBots.clear();
  }

  // Get list of running worktree bots
  getRunningBots(): WorktreeBotProcess[] {
    return Array.from(this.spawnedBots.values());
  }

  // Get status of all running bots
  getStatus(): {
    totalBots: number;
    bots: Array<{
      branch: string;
      workDir: string;
      startTime: string;
      uptime: string;
      category: string;
    }>;
  } {
    const now = new Date();
    const bots = Array.from(this.spawnedBots.values()).map(bot => ({
      branch: bot.branch,
      workDir: bot.workDir,
      startTime: bot.startTime.toISOString(),
      uptime: this.formatUptime(now.getTime() - bot.startTime.getTime()),
      category: bot.category,
    }));

    return {
      totalBots: this.spawnedBots.size,
      bots,
    };
  }

  private formatUptime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}