#!/usr/bin/env -S deno run --allow-all

/**
 * Claude Code Discord Bot - Main Entry Point
 * 
 * This file bootstraps the Discord bot with Claude Code integration.
 * Most command handlers are now extracted to core modules for maintainability.
 * 
 * @module index
 */

import { 
  createDiscordBot, 
  type BotConfig,
  type InteractionContext,
  type CommandHandlers,
  type ButtonHandlers,
  type BotDependencies
} from "./discord/index.ts";

import { getGitInfo } from "./git/index.ts";
import { createClaudeSender, expandableContent, type DiscordSender, type ClaudeMessage } from "./claude/index.ts";
import { claudeCommands, enhancedClaudeCommands } from "./claude/index.ts";
import { additionalClaudeCommands } from "./claude/additional-index.ts";
import { initModels } from "./claude/enhanced-client.ts";
import { advancedSettingsCommands, DEFAULT_SETTINGS, unifiedSettingsCommands, UNIFIED_DEFAULT_SETTINGS } from "./settings/index.ts";
import { gitCommands } from "./git/index.ts";
import { shellCommands } from "./shell/index.ts";
import { utilsCommands } from "./util/index.ts";
import { systemCommands } from "./system/index.ts";
import { helpCommand } from "./help/index.ts";
import { agentCommand } from "./agent/index.ts";
import { cleanupPaginationStates } from "./discord/index.ts";

// Core modules - now handle most of the heavy lifting
import { 
  parseArgs, 
  createMessageHistory, 
  createBotManagers, 
  setupPeriodicCleanup, 
  createBotSettings,
  createAllHandlers,
  getAllCommands,
  cleanSessionId,
  createButtonHandlers,
  createAllCommandHandlers,
  type BotManagers,
  type AllHandlers,
  type MessageHistoryOps,
} from "./core/index.ts";

// Re-export for backward compatibility
export { getGitInfo, executeGitCommand } from "./git/index.ts";
export { sendToClaudeCode } from "./claude/index.ts";

// ================================
// Bot Creation
// ================================

/**
 * Create Claude Code Discord Bot with all handlers and integrations.
 */
export async function createClaudeCodeBot(config: BotConfig) {
  const { discordToken, applicationId, workDir, repoName, branchName, categoryName, defaultMentionUserId } = config;
  
  // Determine category name (use repository name if not specified)
  const actualCategoryName = categoryName || repoName;
  
  // Claude Code session management (closures needed for handler state)
  let claudeController: AbortController | null = null;
  let claudeSessionId: string | undefined;
  
  // Message history for navigation
  const messageHistoryOps: MessageHistoryOps = createMessageHistory(50);
  
  // Create all managers using bot-factory
  const managers: BotManagers = createBotManagers({
    config: {
      discordToken,
      applicationId,
      workDir,
      categoryName: actualCategoryName,
      userId: defaultMentionUserId,
    },
    crashHandlerOptions: {
      maxRetries: 3,
      retryDelay: 5000,
      enableAutoRestart: true,
      logCrashes: true,
      notifyOnCrash: true,
      // deno-lint-ignore require-await
      onCrashNotification: async (report) => {
        console.warn(`Process crash: ${report.processType} ${report.processId || ''} - ${report.error.message}`);
      },
    },
  });
  
  const { shellManager, worktreeBotManager, crashHandler, healthMonitor, claudeSessionManager } = managers;
  
  // Initialize dynamic model fetching (uses ANTHROPIC_API_KEY if available)
  initModels();

  // Setup periodic cleanup tasks
  const cleanupInterval = setupPeriodicCleanup(managers, 3600000, [cleanupPaginationStates]);
  
  // Initialize bot settings
  const settingsOps = createBotSettings(defaultMentionUserId, DEFAULT_SETTINGS, UNIFIED_DEFAULT_SETTINGS);
  const currentSettings = settingsOps.getSettings();
  const botSettings = currentSettings.legacy;
  
  // Bot instance placeholder
  // deno-lint-ignore no-explicit-any prefer-const
  let bot: any;
  let claudeSender: ((messages: ClaudeMessage[]) => Promise<void>) | null = null;
  
  // Create sendClaudeMessages function that uses the sender when available
  const sendClaudeMessages = async (messages: ClaudeMessage[]) => {
    if (claudeSender) {
      await claudeSender(messages);
    }
  };

  // Create all handlers using the registry (centralized handler creation)
  const allHandlers: AllHandlers = createAllHandlers(
    {
      workDir,
      repoName,
      branchName,
      categoryName: actualCategoryName,
      discordToken,
      applicationId,
      defaultMentionUserId,
      shellManager,
      worktreeBotManager,
      crashHandler,
      healthMonitor,
      claudeSessionManager,
      sendClaudeMessages,
      onBotSettingsUpdate: (settings) => {
        botSettings.mentionEnabled = settings.mentionEnabled;
        botSettings.mentionUserId = settings.mentionUserId;
        if (bot) {
          bot.updateBotSettings(settings);
        }
      },
    },
    {
      getController: () => claudeController,
      setController: (controller) => { claudeController = controller; },
      getSessionId: () => claudeSessionId,
      setSessionId: (sessionId) => { claudeSessionId = sessionId; },
    },
    settingsOps
  );

  // Create command handlers using the wrapper factory
  const handlers: CommandHandlers = createAllCommandHandlers({
    handlers: allHandlers,
    messageHistory: messageHistoryOps,
    getClaudeController: () => claudeController,
    getClaudeSessionId: () => claudeSessionId,
    crashHandler,
    healthMonitor,
    botSettings,
    cleanupInterval,
  });

  // Create button handlers using the button handler factory
  const buttonHandlers: ButtonHandlers = createButtonHandlers(
    {
      messageHistory: messageHistoryOps,
      handlers: allHandlers,
      getClaudeSessionId: () => claudeSessionId,
      sendClaudeMessages,
    },
    expandableContent
  );

  // Create dependencies object for Discord bot
  const dependencies: BotDependencies = {
    commands: getAllCommands(),
    cleanSessionId,
    botSettings
  };

  // Create Discord bot
  bot = await createDiscordBot(config, handlers, buttonHandlers, dependencies, crashHandler);
  
  // Create Discord sender for Claude messages
  claudeSender = createClaudeSender(createDiscordSenderAdapter(bot));
  
  // Setup signal handlers for graceful shutdown
  setupSignalHandlers({
    managers,
    allHandlers,
    getClaudeController: () => claudeController,
    claudeSender,
    actualCategoryName,
    repoName,
    branchName,
    cleanupInterval,
    // deno-lint-ignore no-explicit-any
    bot: bot as any,
  });
  
  return bot;
}

// ================================
// Helper Functions
// ================================

/**
 * Create Discord sender adapter from bot instance.
 */
// deno-lint-ignore no-explicit-any
function createDiscordSenderAdapter(bot: any): DiscordSender {
  return {
    async sendMessage(content) {
      const channel = bot.getChannel();
      if (channel) {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import("npm:discord.js@14.14.1");
        
        // deno-lint-ignore no-explicit-any
        const payload: any = {};
        
        if (content.content) payload.content = content.content;
        
        if (content.embeds) {
          payload.embeds = content.embeds.map(e => {
            const embed = new EmbedBuilder();
            if (e.color !== undefined) embed.setColor(e.color);
            if (e.title) embed.setTitle(e.title);
            if (e.description) embed.setDescription(e.description);
            if (e.fields) e.fields.forEach(f => embed.addFields(f));
            if (e.footer) embed.setFooter(e.footer);
            if (e.timestamp) embed.setTimestamp();
            return embed;
          });
        }
        
        if (content.components) {
          payload.components = content.components.map(row => {
            // deno-lint-ignore no-explicit-any
            const actionRow = new ActionRowBuilder<any>();
            row.components.forEach(comp => {
              const button = new ButtonBuilder()
                .setCustomId(comp.customId)
                .setLabel(comp.label);
              
              switch (comp.style) {
                case 'primary': button.setStyle(ButtonStyle.Primary); break;
                case 'secondary': button.setStyle(ButtonStyle.Secondary); break;
                case 'success': button.setStyle(ButtonStyle.Success); break;
                case 'danger': button.setStyle(ButtonStyle.Danger); break;
                case 'link': button.setStyle(ButtonStyle.Link); break;
              }
              
              actionRow.addComponents(button);
            });
            return actionRow;
          });
        }
        
        await channel.send(payload);
      }
    }
  };
}

/**
 * Setup signal handlers for graceful shutdown.
 */
function setupSignalHandlers(ctx: {
  managers: BotManagers;
  allHandlers: AllHandlers;
  getClaudeController: () => AbortController | null;
  claudeSender: ((messages: ClaudeMessage[]) => Promise<void>) | null;
  actualCategoryName: string;
  repoName: string;
  branchName: string;
  cleanupInterval: number;
  // deno-lint-ignore no-explicit-any
  bot: any;
}) {
  const { managers, allHandlers, getClaudeController, claudeSender, actualCategoryName, repoName, branchName, cleanupInterval, bot } = ctx;
  const { crashHandler, healthMonitor } = managers;
  const { shell: shellHandlers, git: gitHandlers } = allHandlers;
  
  const handleSignal = async (signal: string) => {
    console.log(`\n${signal} signal received. Stopping bot...`);
    
    try {
      // Stop all processes
      shellHandlers.killAllProcesses();
      gitHandlers.killAllWorktreeBots();
      
      // Cancel Claude Code session
      const claudeController = getClaudeController();
      if (claudeController) {
        claudeController.abort();
      }
      
      // Send shutdown message
      if (claudeSender) {
        await claudeSender([{
          type: 'system',
          content: '',
          metadata: {
            subtype: 'shutdown',
            signal,
            categoryName: actualCategoryName,
            repoName,
            branchName
          }
        }]);
      }
      
      // Cleanup
      healthMonitor.stopAll();
      crashHandler.cleanup();
      cleanupPaginationStates();
      clearInterval(cleanupInterval);
      
      setTimeout(() => {
        bot.client.destroy();
        Deno.exit(0);
      }, 1000);
    } catch (error) {
      console.error('Error during shutdown:', error);
      Deno.exit(1);
    }
  };
  
  // Cross-platform signal handling
  const platform = Deno.build.os;
  
  try {
    Deno.addSignalListener("SIGINT", () => handleSignal("SIGINT"));
    
    if (platform === "windows") {
      try {
        Deno.addSignalListener("SIGBREAK", () => handleSignal("SIGBREAK"));
      } catch (winError) {
        const message = winError instanceof Error ? winError.message : String(winError);
        console.warn('Could not register SIGBREAK handler:', message);
      }
    } else {
      try {
        Deno.addSignalListener("SIGTERM", () => handleSignal("SIGTERM"));
      } catch (unixError) {
        const message = unixError instanceof Error ? unixError.message : String(unixError);
        console.warn('Could not register SIGTERM handler:', message);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Signal handler registration error:', message);
  }
}

// ================================
// .env Auto-Load
// ================================

/**
 * Load environment variables from .env file if it exists.
 * This enables zero-config startup when .env is present.
 */
async function loadEnvFile(): Promise<void> {
  try {
    const envPath = `${Deno.cwd()}/.env`;
    const stat = await Deno.stat(envPath).catch(() => null);
    
    if (!stat?.isFile) return;
    
    const content = await Deno.readTextFile(envPath);
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      // Parse KEY=VALUE format
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      
      const key = trimmed.substring(0, eqIndex).trim();
      let value = trimmed.substring(eqIndex + 1).trim();
      
      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      // Only set if not already defined (env vars take precedence)
      if (!Deno.env.get(key) && key && value) {
        Deno.env.set(key, value);
      }
    }
    
    console.log('✓ Loaded configuration from .env file');
  } catch (error) {
    // Silently ignore .env loading errors
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Note: Could not load .env file: ${message}`);
  }
}

// ================================
// Main Execution
// ================================

if (import.meta.main) {
  try {
    // Auto-load .env file (if present)
    await loadEnvFile();
    
    // Get environment variables and command line arguments
    const discordToken = Deno.env.get("DISCORD_TOKEN");
    const applicationId = Deno.env.get("APPLICATION_ID");
    const envCategoryName = Deno.env.get("CATEGORY_NAME");
    const envMentionUserId = Deno.env.get("USER_ID") || Deno.env.get("DEFAULT_MENTION_USER_ID");
    const envWorkDir = Deno.env.get("WORK_DIR");
    
    if (!discordToken || !applicationId) {
      console.error("╔═══════════════════════════════════════════════════════════╗");
      console.error("║  Error: Missing required configuration                    ║");
      console.error("╠═══════════════════════════════════════════════════════════╣");
      console.error("║  DISCORD_TOKEN and APPLICATION_ID are required.           ║");
      console.error("║                                                           ║");
      console.error("║  Options:                                                 ║");
      console.error("║  1. Create a .env file with these variables               ║");
      console.error("║  2. Set environment variables before running              ║");
      console.error("║  3. Run setup script: ./setup.sh or .\\setup.ps1          ║");
      console.error("╚═══════════════════════════════════════════════════════════╝");
      Deno.exit(1);
    }
    
    // Parse command line arguments
    const args = parseArgs(Deno.args);
    const categoryName = args.category || envCategoryName;
    const defaultMentionUserId = args.userId || envMentionUserId;
    const workDir = envWorkDir || Deno.cwd();
    
    // Get Git information
    const gitInfo = await getGitInfo();
    
    // Create and start bot
    await createClaudeCodeBot({
      discordToken,
      applicationId,
      workDir,
      repoName: gitInfo.repo,
      branchName: gitInfo.branch,
      categoryName,
      defaultMentionUserId,
    });
    
    console.log("✓ Bot has started. Press Ctrl+C to stop.");
  } catch (error) {
    console.error("Failed to start bot:", error);
    Deno.exit(1);
  }
}
