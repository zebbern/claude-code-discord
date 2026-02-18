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
import { buildQuestionMessages, parseAskUserButtonId, parseAskUserConfirmId, type AskUserQuestionInput } from "./claude/index.ts";
import { buildPermissionEmbed, parsePermissionButtonId, type PermissionRequestCallback } from "./claude/index.ts";
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
import { runVersionCheck, startPeriodicUpdateCheck, BOT_VERSION } from "./util/version-check.ts";

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
  
  // Late-bound AskUserQuestion handler — set after bot is created.
  // When Claude needs clarification mid-session, this sends buttons to Discord
  // and waits for the user's click.
  // Uses an object wrapper so TypeScript doesn't narrow the closure to `never`.
  const askUserState: { handler: ((input: AskUserQuestionInput) => Promise<Record<string, string>>) | null } = { handler: null };

  // Late-bound PermissionRequest handler — set after bot is created.
  // When Claude wants to use a tool that isn't pre-approved, this shows
  // Allow/Deny buttons in Discord and returns the user's decision.
  const permReqState: { handler: PermissionRequestCallback | null } = { handler: null };
  
  // Create sendClaudeMessages function that uses the sender when available
  const sendClaudeMessages = async (messages: ClaudeMessage[]) => {
    if (claudeSender) {
      await claudeSender(messages);
    }
  };
  
  // Create onAskUser wrapper — delegates to askUserState.handler once bot is ready
  const onAskUser = async (input: AskUserQuestionInput): Promise<Record<string, string>> => {
    if (!askUserState.handler) {
      throw new Error('AskUserQuestion handler not initialized — bot not ready');
    }
    return await askUserState.handler(input);
  };

  // Create onPermissionRequest wrapper — delegates to permReqState.handler once bot is ready
  const onPermissionRequest: PermissionRequestCallback = async (toolName, toolInput) => {
    if (!permReqState.handler) {
      console.warn('[PermissionRequest] Handler not initialized — auto-denying');
      return false;
    }
    return await permReqState.handler(toolName, toolInput);
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
      onAskUser,
      onPermissionRequest,
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
      workDir,
    },
    expandableContent
  );

  // Create dependencies object for Discord bot
  const dependencies: BotDependencies = {
    commands: getAllCommands(),
    cleanSessionId,
    botSettings,
    onContinueSession: async (ctx) => {
      await allHandlers.claude.onContinue(ctx);
    },
  };

  // Create Discord bot
  bot = await createDiscordBot(config, handlers, buttonHandlers, dependencies, crashHandler);
  
  // Create Discord sender for Claude messages
  claudeSender = createClaudeSender(createDiscordSenderAdapter(bot));
  
  // Initialize AskUserQuestion handler — sends questions to Discord, waits for button clicks
  askUserState.handler = createAskUserDiscordHandler(bot);

  // Initialize PermissionRequest handler — shows Allow/Deny buttons for unapproved tools
  permReqState.handler = createPermissionRequestHandler(bot);
  
  // Check for updates (non-blocking)
  runVersionCheck().then(async ({ updateAvailable, embed }) => {
    if (updateAvailable && embed) {
      const channel = bot.getChannel();
      if (channel) {
        const { EmbedBuilder } = await import("npm:discord.js@14.14.1");
        const discordEmbed = new EmbedBuilder()
          .setColor(embed.color)
          .setTitle(embed.title)
          .setDescription(embed.description)
          .setTimestamp();
        embed.fields.forEach(f => discordEmbed.addFields(f));
        await channel.send({ embeds: [discordEmbed] });
      }
    }
  }).catch(() => { /* version check is best-effort */ });

  // Start periodic update checks (every 12 hours)
  startPeriodicUpdateCheck(async (result) => {
    try {
      const channel = bot.getChannel();
      if (channel) {
        const { EmbedBuilder } = await import("npm:discord.js@14.14.1");
        const embed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle("🔄 Update Available")
          .setDescription(`A newer version is available. You are running **v${BOT_VERSION}** (\`${result.localCommit}\`).`)
          .addFields(
            { name: "Latest Commit", value: `\`${result.remoteCommit}\``, inline: true },
            {
              name: "How to Update",
              value: Deno.env.get("DOCKER_CONTAINER")
                ? "```\ndocker compose pull && docker compose up -d\n```"
                : "```\ngit pull origin main && deno task start\n```",
              inline: false
            }
          )
          .setTimestamp();
        await channel.send({ embeds: [embed] });
      }
    } catch {
      // Periodic notification is best-effort
    }
  });
  
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
 * Create the AskUserQuestion handler that uses the Discord channel.
 *
 * When Claude calls the AskUserQuestion tool:
 * 1. Builds embeds with option buttons for each question
 * 2. Sends them to the bot's channel
 * 3. Waits up to 5 minutes for button clicks
 * 4. Returns answers to the SDK so Claude can continue
 */
// deno-lint-ignore no-explicit-any
function createAskUserDiscordHandler(bot: any): (input: AskUserQuestionInput) => Promise<Record<string, string>> {
  return async (input: AskUserQuestionInput): Promise<Record<string, string>> => {
    const channel = bot.getChannel();
    if (!channel) {
      throw new Error('Discord channel not available');
    }

    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = await import("npm:discord.js@14.14.1");
    const answers: Record<string, string> = {};

    for (let qi = 0; qi < input.questions.length; qi++) {
      const q = input.questions[qi];

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(0xff9900)
        .setTitle(`❓ Claude needs your input — ${q.header}`)
        .setDescription(q.question)
        .setFooter({ text: q.multiSelect ? 'Select option(s), then click ✅ Confirm — Claude is waiting' : 'Click an option to answer — Claude is waiting' })
        .setTimestamp();

      for (let oi = 0; oi < q.options.length; oi++) {
        embed.addFields({ name: `${oi + 1}. ${q.options[oi].label}`, value: q.options[oi].description, inline: true });
      }

      // Build buttons
      const row = new ActionRowBuilder();
      for (let oi = 0; oi < q.options.length; oi++) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`ask-user:${qi}:${oi}`)
            .setLabel(q.options[oi].label)
            .setStyle(ButtonStyle.Primary)
        );
      }

      if (q.multiSelect) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`ask-user-confirm:${qi}`)
            .setLabel('✅ Confirm')
            .setStyle(ButtonStyle.Success)
        );
      }

      // Send the question message
      const questionMsg = await channel.send({ embeds: [embed], components: [row] });

      // Collect response
      if (q.multiSelect) {
        // Multi-select: collect multiple clicks, then wait for confirm
        const selected: string[] = [];
        const collector = questionMsg.createMessageComponentCollector({
          componentType: ComponentType.Button,
        });

        await new Promise<void>((resolve, reject) => {
          // deno-lint-ignore no-explicit-any
          collector.on('collect', async (i: any) => {
            const parsed = parseAskUserButtonId(i.customId);
            if (parsed && parsed.questionIndex === qi) {
              const label = q.options[parsed.optionIndex].label;
              if (!selected.includes(label)) {
                selected.push(label);
              }
              await i.update({
                embeds: [embed.setFooter({ text: `Selected: ${selected.join(', ')} — click ✅ Confirm when done` })],
                components: [row],
              });
            } else if (parseAskUserConfirmId(i.customId)?.questionIndex === qi) {
              answers[q.question] = selected.join(', ');
              collector.stop('confirmed');
              await i.update({
                embeds: [embed.setColor(0x00ff00).setFooter({ text: `✅ Answered: ${selected.join(', ')}` })],
                components: [],
              });
              resolve();
            }
          });

          collector.on('end', (_: unknown, reason: string) => {
            if (reason !== 'confirmed') {
              reject(new Error(`Question "${q.header}" was cancelled`));
            }
          });
        });
      } else {
        // Single-select: wait for one button click
        // deno-lint-ignore no-explicit-any
        const interaction: any = await questionMsg.awaitMessageComponent({
          componentType: ComponentType.Button,
        });

        const parsed = parseAskUserButtonId(interaction.customId);
        if (parsed && parsed.questionIndex === qi) {
          const label = q.options[parsed.optionIndex].label;
          answers[q.question] = label;

          await interaction.update({
            embeds: [embed.setColor(0x00ff00).setFooter({ text: `✅ Answered: ${label}` })],
            components: [],
          });
        } else {
          throw new Error(`Unexpected button ID: ${interaction.customId}`);
        }
      }
    }

    console.log('[AskUserQuestion] Collected answers:', JSON.stringify(answers));
    return answers;
  };
}

/**
 * Create the PermissionRequest handler that uses the Discord channel.
 *
 * When Claude wants to use a tool that isn't pre-approved:
 * 1. Builds an embed showing the tool name and input preview
 * 2. Adds Allow / Deny buttons
 * 3. Sends to the bot's channel
 * 4. Waits for a button click (no timeout — user decides)
 * 5. Returns true (allow) or false (deny)
 */
// deno-lint-ignore no-explicit-any
function createPermissionRequestHandler(bot: any): PermissionRequestCallback {
  // Simple incrementing nonce to disambiguate concurrent requests
  let nonce = 0;

  return async (toolName: string, toolInput: Record<string, unknown>): Promise<boolean> => {
    const channel = bot.getChannel();
    if (!channel) {
      console.warn('[PermissionRequest] No channel — auto-denying');
      return false;
    }

    const reqNonce = String(++nonce);
    const embedData = buildPermissionEmbed(toolName, toolInput);

    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = await import("npm:discord.js@14.14.1");

    const embed = new EmbedBuilder()
      .setColor(embedData.color)
      .setTitle(embedData.title)
      .setDescription(embedData.description)
      .setFooter({ text: embedData.footer.text })
      .setTimestamp();

    for (const field of embedData.fields) {
      embed.addFields({ name: field.name, value: field.value, inline: field.inline });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`perm-req:${reqNonce}:allow`)
        .setLabel('✅ Allow')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`perm-req:${reqNonce}:deny`)
        .setLabel('❌ Deny')
        .setStyle(ButtonStyle.Danger),
    );

    const msg = await channel.send({ embeds: [embed], components: [row] });

    // Wait for exactly one button click — no timeout
    // deno-lint-ignore no-explicit-any
    const interaction: any = await msg.awaitMessageComponent({
      componentType: ComponentType.Button,
    });

    const parsed = parsePermissionButtonId(interaction.customId);
    const allowed = parsed?.allowed ?? false;

    // Update the embed to reflect the decision
    embed.setColor(allowed ? 0x00ff00 : 0xff4444)
      .setFooter({ text: allowed ? `✅ Allowed by user` : `❌ Denied by user` });

    await interaction.update({
      embeds: [embed],
      components: [], // Remove buttons after decision
    });

    console.log(`[PermissionRequest] Tool "${toolName}" — ${allowed ? 'ALLOWED' : 'DENIED'} by user`);
    return allowed;
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
