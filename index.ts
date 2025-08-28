#!/usr/bin/env -S deno run --allow-all

import { 
  createDiscordBot, 
  type BotConfig,
  type InteractionContext,
  type CommandHandlers,
  type ButtonHandlers,
  type BotDependencies
} from "./discord/index.ts";

import { ShellManager } from "./shell/index.ts";
import { getGitInfo } from "./git/index.ts";

import { createClaudeHandlers, claudeCommands, cleanSessionId, createClaudeSender, expandableContent, type DiscordSender, ClaudeMessage, enhancedClaudeCommands, createEnhancedClaudeHandlers, ClaudeSessionManager } from "./claude/index.ts";
import { additionalClaudeCommands, createAdditionalClaudeHandlers } from "./claude/additional-index.ts";
import { advancedSettingsCommands, createAdvancedSettingsHandlers, DEFAULT_SETTINGS, type AdvancedBotSettings } from "./settings/index.ts";
import { createGitHandlers, gitCommands, WorktreeBotManager } from "./git/index.ts";
import { createShellHandlers, shellCommands } from "./shell/index.ts";
import { createUtilsHandlers, utilsCommands } from "./util/index.ts";
import { systemCommands, createSystemHandlers } from "./system/index.ts";
import { helpCommand, createHelpHandlers } from "./help/index.ts";
import { ProcessCrashHandler, setupGlobalErrorHandlers, ProcessHealthMonitor } from "./process/index.ts";
import { handlePaginationInteraction, cleanupPaginationStates, formatShellOutput, formatGitOutput, formatError, createFormattedEmbed } from "./discord/index.ts";



// Parse command line arguments
function parseArgs(args: string[]): { category?: string; userId?: string } {
  const result: { category?: string; userId?: string } = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--category' && i + 1 < args.length) {
      result.category = args[i + 1];
      i++; // Skip next argument
    } else if (arg === '--user-id' && i + 1 < args.length) {
      result.userId = args[i + 1];
      i++; // Skip next argument
    } else if (arg.startsWith('--category=')) {
      result.category = arg.split('=')[1];
    } else if (arg.startsWith('--user-id=')) {
      result.userId = arg.split('=')[1];
    } else if (!arg.startsWith('--')) {
      // For positional arguments (backward compatibility)
      if (!result.category) {
        result.category = arg;
      } else if (!result.userId) {
        result.userId = arg;
      }
    }
  }
  
  return result;
}

// Re-export for backward compatibility
export { getGitInfo, executeGitCommand } from "./git/index.ts";
export { sendToClaudeCode } from "./claude/index.ts";

// Create Claude Code Discord Bot
export async function createClaudeCodeBot(config: BotConfig) {
  const { discordToken, applicationId, workDir, repoName, branchName, categoryName, defaultMentionUserId } = config;
  
  // Determine category name (use repository name if not specified)
  const actualCategoryName = categoryName || repoName;
  
  // Claude Code session management
  let claudeController: AbortController | null = null;
  // deno-lint-ignore no-unused-vars
  let claudeSessionId: string | undefined;
  
  // Message history for navigation (like terminal history)
  const messageHistory: string[] = [];
  let currentHistoryIndex = -1;
  
  // Helper functions for message history
  function addToHistory(message: string) {
    // Don't add duplicate consecutive messages
    if (messageHistory.length === 0 || messageHistory[messageHistory.length - 1] !== message) {
      messageHistory.push(message);
      // Keep only last 50 messages to prevent memory bloat
      if (messageHistory.length > 50) {
        messageHistory.shift();
      }
    }
    currentHistoryIndex = -1; // Reset to latest
  }
  
  function getPreviousMessage(): string | null {
    if (messageHistory.length === 0) return null;
    
    if (currentHistoryIndex === -1) {
      currentHistoryIndex = messageHistory.length - 1;
    } else if (currentHistoryIndex > 0) {
      currentHistoryIndex--;
    }
    
    return messageHistory[currentHistoryIndex] || null;
  }
  
  function getNextMessage(): string | null {
    if (messageHistory.length === 0 || currentHistoryIndex === -1) return null;
    
    if (currentHistoryIndex < messageHistory.length - 1) {
      currentHistoryIndex++;
      return messageHistory[currentHistoryIndex];
    } else {
      currentHistoryIndex = -1; // Reset to latest
      return null; // No next message, at the end
    }
  }
  
  // Create shell manager
  const shellManager = new ShellManager(workDir);
  
  // Create worktree bot manager
  const worktreeBotManager = new WorktreeBotManager();
  
  // Create crash handler and health monitor
  const crashHandler = new ProcessCrashHandler({
    maxRetries: 3,
    retryDelay: 5000,
    enableAutoRestart: true,
    logCrashes: true,
    notifyOnCrash: true
  });
  
  const healthMonitor = new ProcessHealthMonitor(crashHandler);
  
  // Setup global error handlers
  setupGlobalErrorHandlers(crashHandler);
  
  // Create Claude session manager
  const claudeSessionManager = new ClaudeSessionManager();
  
  // Set up crash handler dependencies
  crashHandler.setManagers(shellManager, worktreeBotManager);
  
  // Setup periodic cleanup tasks
  const cleanupInterval = setInterval(() => {
    try {
      crashHandler.cleanup();
      cleanupPaginationStates();
      claudeSessionManager.cleanup(); // Clean up old Claude sessions
    } catch (error) {
      console.error('Error during periodic cleanup:', error);
    }
  }, 3600000); // Clean up every hour
  
  // Setup crash notification
  crashHandler.setNotificationCallback(async (report) => {
    // Notification will be sent through Discord when bot is ready
    console.warn(`Process crash: ${report.processType} ${report.processId || ''} - ${report.error.message}`);
  });
  
  // Initialize advanced bot settings
  const advancedSettings: AdvancedBotSettings = {
    ...DEFAULT_SETTINGS,
    mentionEnabled: !!defaultMentionUserId,
    mentionUserId: defaultMentionUserId || null,
  };

  // Legacy bot settings for backward compatibility
  const botSettings = {
    mentionEnabled: advancedSettings.mentionEnabled,
    mentionUserId: advancedSettings.mentionUserId,
  };

  // Function to update settings
  const updateAdvancedSettings = (newSettings: Partial<AdvancedBotSettings>) => {
    Object.assign(advancedSettings, newSettings);
    // Update legacy settings
    botSettings.mentionEnabled = advancedSettings.mentionEnabled;
    botSettings.mentionUserId = advancedSettings.mentionUserId;
  };
  
  // Create Discord bot first
  // deno-lint-ignore no-explicit-any prefer-const
  let bot: any;
  
  // We'll create the Claude sender after bot initialization
  let claudeSender: ((messages: ClaudeMessage[]) => Promise<void>) | null = null;
  
  // Create handlers with dependencies (sendClaudeMessages will be updated after bot creation)
  const claudeHandlers = createClaudeHandlers({
    workDir,
    claudeController,
    setClaudeController: (controller) => { claudeController = controller; },
    setClaudeSessionId: (sessionId) => { claudeSessionId = sessionId; },
    sendClaudeMessages: async (messages) => {
      if (claudeSender) {
        await claudeSender(messages);
      }
    }
  });
  
  const gitHandlers = createGitHandlers({
    workDir,
    actualCategoryName,
    discordToken,
    applicationId,
    botSettings,
    worktreeBotManager
  });
  
  const shellHandlers = createShellHandlers({
    shellManager
  });
  
  const utilsHandlers = createUtilsHandlers({
    workDir,
    repoName,
    branchName,
    actualCategoryName,
    botSettings,
    updateBotSettings: (settings) => {
      botSettings.mentionEnabled = settings.mentionEnabled;
      botSettings.mentionUserId = settings.mentionUserId;
      if (bot) {
        bot.updateBotSettings(settings);
      }
    }
  });

  const helpHandlers = createHelpHandlers({
    workDir,
    repoName,
    branchName,
    categoryName: actualCategoryName
  });

  const enhancedClaudeHandlers = createEnhancedClaudeHandlers({
    workDir,
    claudeController,
    setClaudeController: (controller) => { claudeController = controller; },
    setClaudeSessionId: (sessionId) => { claudeSessionId = sessionId; },
    sendClaudeMessages: async (messages) => {
      if (claudeSender) {
        await claudeSender(messages);
      }
    },
    sessionManager: claudeSessionManager,
    crashHandler
  });

  const systemHandlers = createSystemHandlers({
    workDir,
    crashHandler
  });

  const additionalClaudeHandlers = createAdditionalClaudeHandlers({
    workDir,
    claudeController,
    setClaudeController: (controller) => { claudeController = controller; },
    sendClaudeMessages: async (messages) => {
      if (claudeSender) {
        await claudeSender(messages);
      }
    },
    sessionManager: claudeSessionManager,
    crashHandler,
    settings: advancedSettings
  });

  const advancedSettingsHandlers = createAdvancedSettingsHandlers({
    settings: advancedSettings,
    updateSettings: updateAdvancedSettings,
    crashHandler
  });
  
  // Command handlers implementation
  const handlers: CommandHandlers = new Map([
    ['claude', {
      execute: async (ctx: InteractionContext) => {
        const prompt = ctx.getString('prompt', true)!;
        const sessionId = ctx.getString('session_id');
        addToHistory(prompt); // Add to message history
        await claudeHandlers.onClaude(ctx, prompt, sessionId || undefined);
      },
      handleButton: async (ctx: InteractionContext, customId: string) => {
        if (customId.startsWith('expand:')) {
          const expandId = customId.substring(7);
          const fullContent = expandableContent.get(expandId);
          
          if (!fullContent) {
            await ctx.update({
              embeds: [{
                color: 0xffaa00,
                title: '📖 Content Not Available',
                description: 'The full content is no longer available for expansion.',
                timestamp: true
              }],
              components: []
            });
            return;
          }
          
          // Split content into chunks if too large for Discord
          const maxLength = 4090 - "```\n\n```".length;
          if (fullContent.length <= maxLength) {
            await ctx.update({
              embeds: [{
                color: 0x0099ff,
                title: '📖 Full Content',
                description: expandId.startsWith('result-') ? 
                  `\`\`\`\n${fullContent}\n\`\`\`` : 
                  `\`\`\`json\n${fullContent}\n\`\`\``,
                timestamp: true
              }],
              components: [{
                type: 'actionRow',
                components: [{
                  type: 'button',
                  customId: 'collapse-content',
                  label: '🔼 Collapse',
                  style: 'secondary'
                }]
              }]
            });
          } else {
            // Content is still too large, show first part with pagination
            const chunk = fullContent.substring(0, maxLength - 100);
            await ctx.update({
              embeds: [{
                color: 0x0099ff,
                title: '📖 Full Content (Large - Showing First Part)',
                description: expandId.startsWith('result-') ? 
                  `\`\`\`\n${chunk}...\n\`\`\`` : 
                  `\`\`\`json\n${chunk}...\n\`\`\``,
                fields: [
                  { name: 'Note', value: 'Content is very large. This shows the first portion.', inline: false }
                ],
                timestamp: true
              }],
              components: [{
                type: 'actionRow',
                components: [{
                  type: 'button',
                  customId: 'collapse-content',
                  label: '🔼 Collapse',
                  style: 'secondary'
                }]
              }]
            });
          }
        }
      }
    }],
    ['continue', {
      execute: async (ctx: InteractionContext) => {
        const prompt = ctx.getString('prompt');
        if (prompt) addToHistory(prompt); // Add to message history if prompt provided
        await claudeHandlers.onContinue(ctx, prompt || undefined);
      }
    }],
    ['claude-cancel', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        const cancelled = claudeHandlers.onClaudeCancel(ctx);
        await ctx.editReply({
          embeds: [{
            color: cancelled ? 0xff0000 : 0x808080,
            title: cancelled ? 'Cancel Successful' : 'Cancel Failed',
            description: cancelled ? 'Claude Code session cancelled.' : 'No running Claude Code session.',
            timestamp: true
          }]
        });
      }
    }],
    ['git', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        const command = ctx.getString('command', true)!;
        try {
          const result = await gitHandlers.onGit(ctx, command);
          const formatted = formatGitOutput(command, result);
          
          const { embed } = createFormattedEmbed(
            formatted.isError ? '❌ Git Command Error' : '✅ Git Command Result',
            formatted.formatted,
            formatted.isError ? 0xff0000 : 0x00ff00
          );

          await ctx.editReply({ embeds: [embed] });
        } catch (error) {
          const errorFormatted = formatError(error instanceof Error ? error : new Error(String(error)), `git ${command}`);
          const { embed } = createFormattedEmbed(
            '❌ Git Command Exception',
            errorFormatted.formatted,
            0xff0000
          );

          await ctx.editReply({ embeds: [embed] });
          
          // Report crash for monitoring
          await crashHandler.reportCrash('main', error instanceof Error ? error : new Error(String(error)), 'git', `Command: ${command}`);
        }
      }
    }],
    ['worktree', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        const branch = ctx.getString('branch', true)!;
        const ref = ctx.getString('ref');
        try {
          const result = await gitHandlers.onWorktree(ctx, branch, ref || undefined);
          
          // Check if the result contains an error
          const isError = result.result.startsWith('Execution error:') || result.result.startsWith('Error:') || result.result.includes('fatal:');
          
          if (!isError || result.isExisting === true) {
            // Worktree created successfully, start bot process
            await ctx.editReply({
              embeds: [{
                color: 0xffff00,
                title: result.isExisting === true ? 'Worktree Detected - Starting Bot...' : 'Worktree Created Successfully - Starting Bot...',
                fields: [
                  { name: 'Branch', value: branch, inline: true },
                  { name: 'Path', value: result.fullPath, inline: false },
                  { name: 'Result', value: `\`\`\`\n${result.result}\n\`\`\``, inline: false },
                  { name: 'Status', value: 'Starting Bot process...', inline: false }
                ],
                timestamp: true
              }]
            });
            
            // Start bot process for the worktree
            try {
              await gitHandlers.onWorktreeBot(ctx, result.fullPath, branch);
              
              // Update with success
              await ctx.editReply({
                embeds: [{
                  color: 0x00ff00,
                  title: result.isExisting === true ? 'Worktree Bot Started' : 'Worktree Creation Complete',
                  fields: [
                    { name: 'Branch', value: branch, inline: true },
                    { name: 'Path', value: result.fullPath, inline: false },
                    { name: 'Result', value: `\`\`\`\n${result.result}\n\`\`\``, inline: false },
                    { name: 'Bot Status', value: result.isExisting === true ? '✅ Bot process started in existing Worktree' : '✅ New Bot process started', inline: false }
                  ],
                  timestamp: true
                }]
              });
            } catch (botError) {
              // Bot start failed, but worktree was created
              await ctx.editReply({
                embeds: [{
                  color: 0xff9900,
                  title: result.isExisting === true ? 'Worktree Detected - Bot Start Failed' : 'Worktree Created Successfully - Bot Start Failed',
                  fields: [
                    { name: 'Branch', value: branch, inline: true },
                    { name: 'Path', value: result.fullPath, inline: false },
                    { name: 'Result', value: `\`\`\`\n${result.result}\n\`\`\``, inline: false },
                    { name: 'Bot Error', value: `\`\`\`\n${botError instanceof Error ? botError.message : String(botError)}\n\`\`\``, inline: false }
                  ],
                  timestamp: true
                }]
              });
            }
          } else {
            // Worktree creation failed
            await ctx.editReply({
              embeds: [{
                color: 0xff0000,
                title: 'Worktree Creation Error',
                fields: [
                  { name: 'Branch', value: branch, inline: true },
                  { name: 'Path', value: result.fullPath, inline: false },
                  { name: 'Error Details', value: `\`\`\`\n${result.result}\n\`\`\``, inline: false }
                ],
                timestamp: true
              }]
            });
          }
        } catch (error) {
          await ctx.editReply({
            embeds: [{
              color: 0xff0000,
              title: 'Worktree Creation Error',
              fields: [
                { name: 'Branch', value: branch, inline: true },
                { name: 'Error', value: `\`\`\`\n${error instanceof Error ? error.message : String(error)}\n\`\`\``, inline: false }
              ],
              timestamp: true
            }]
          });
        }
      }
    }],
    ['worktree-list', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        try {
          const result = await gitHandlers.onWorktreeList(ctx);
          await ctx.editReply({
            embeds: [{
              color: 0x00ffff,
              title: 'Git Worktrees',
              fields: [{ name: 'List', value: `\`\`\`\n${result.result}\n\`\`\``, inline: false }],
              timestamp: true
            }]
          });
        } catch (error) {
          await ctx.editReply({
            embeds: [{
              color: 0xff0000,
              title: 'Worktree List Error',
              fields: [{ name: 'Error', value: `\`\`\`\n${error instanceof Error ? error.message : String(error)}\n\`\`\``, inline: false }],
              timestamp: true
            }]
          });
        }
      }
    }],
    ['worktree-remove', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        const branch = ctx.getString('branch', true)!;
        try {
          await gitHandlers.onWorktreeRemove(ctx, branch);
          await ctx.editReply({
            embeds: [{
              color: 0x00ff00,
              title: 'Worktree Removal Successful',
              fields: [{ name: 'Branch', value: branch, inline: true }],
              timestamp: true
            }]
          });
        } catch (error) {
          await ctx.editReply({
            embeds: [{
              color: 0xff0000,
              title: 'Worktree Removal Error',
              fields: [
                { name: 'Branch', value: branch, inline: true },
                { name: 'Error', value: `\`\`\`\n${error instanceof Error ? error.message : String(error)}\n\`\`\``, inline: false }
              ],
              timestamp: true
            }]
          });
        }
      }
    }],
    ['worktree-bots', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        const status = gitHandlers.onWorktreeBots(ctx);
        
        const fields = status.bots.map(bot => ({
          name: `${bot.branch} (${bot.category})`,
          value: `Path: \`${bot.workDir}\`\nUptime: ${bot.uptime}\nStarted: ${new Date(bot.startTime).toLocaleString()}`,
          inline: false
        }));
        
        await ctx.editReply({
          embeds: [{
            color: 0x00ffff,
            title: 'Running Worktree Bot Processes',
            description: status.totalBots === 0 ? 'No worktree bots running.' : `${status.totalBots} worktree bot(s) running:`,
            fields: fields.slice(0, 25), // Discord limit
            timestamp: true
          }]
        });
      }
    }],
    ['worktree-kill', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        const path = ctx.getString('path', true)!;
        try {
          const result = gitHandlers.onWorktreeKill(ctx, path);
          await ctx.editReply({
            embeds: [{
              color: result.success ? 0x00ff00 : 0xff0000,
              title: result.success ? 'Worktree Bot Killed' : 'Kill Failed',
              fields: [
                { name: 'Path', value: `\`${path}\``, inline: false },
                { name: 'Result', value: result.message, inline: false }
              ],
              timestamp: true
            }]
          });
        } catch (error) {
          await ctx.editReply({
            embeds: [{
              color: 0xff0000,
              title: 'Worktree Kill Error',
              fields: [
                { name: 'Path', value: `\`${path}\``, inline: false },
                { name: 'Error', value: `\`\`\`\n${error instanceof Error ? error.message : String(error)}\n\`\`\``, inline: false }
              ],
              timestamp: true
            }]
          });
        }
      }
    }],
    ['shell', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        const command = ctx.getString('command', true)!;
        const input = ctx.getString('input');
        try {
          const executionResult = await shellHandlers.onShell(ctx, command, input || undefined);
          
          let isCompleted = false;
          
          // Handle completion asynchronously
          executionResult.onComplete(async (exitCode, output) => {
            if (isCompleted) return;
            isCompleted = true;
            
            const formatted = formatShellOutput(command, output, exitCode);
            const { embed } = createFormattedEmbed(
              exitCode === 0 ? '✅ Shell Command Complete' : '❌ Shell Command Failed',
              formatted.formatted,
              exitCode === 0 ? 0x00ff00 : 0xff0000
            );

            // Add process info as fields
            embed.fields = [
              { name: 'Process ID', value: executionResult.processId.toString(), inline: true },
              { name: 'Exit Code', value: exitCode.toString(), inline: true },
              ...(embed.fields || [])
            ];

            await ctx.editReply({ embeds: [embed] });
            
            // Report crash if command failed
            if (exitCode !== 0) {
              await crashHandler.reportCrash('shell', new Error(`Process exited with code ${exitCode}`), executionResult.processId, `Command: ${command}`);
            }
          });
          
          executionResult.onError(async (error) => {
            if (isCompleted) return;
            isCompleted = true;
            
            await ctx.editReply({
              embeds: [{
                color: 0xff0000,
                title: 'Shell Command Error',
                description: `\`${command}\``,
                fields: [
                  { name: 'Process ID', value: executionResult.processId.toString(), inline: true },
                  { name: 'Error', value: `\`\`\`\n${error.message}\n\`\`\``, inline: false }
                ],
                timestamp: true
              }]
            });
          });
          
          // Show initial running status and wait a bit to see if it completes quickly
          await ctx.editReply({
            embeds: [{
              color: 0xffff00,
              title: 'Shell Command Started',
              description: `\`${command}\``,
              fields: [
                { name: 'Process ID', value: executionResult.processId.toString(), inline: true },
                { name: 'Status', value: 'Running...', inline: true }
              ],
              timestamp: true
            }]
          });
          
          // Wait a short time for quick commands
          setTimeout(async () => {
            if (!isCompleted) {
              // Still running after timeout, show long-running status
              try {
                await ctx.editReply({
                  embeds: [{
                    color: 0x0099ff,
                    title: 'Shell Command Running',
                    description: `\`${command}\``,
                    fields: [
                      { name: 'Process ID', value: executionResult.processId.toString(), inline: true },
                      { name: 'Status', value: 'Long-running process... (will update when complete)', inline: false }
                    ],
                    timestamp: true
                  }]
                });
              } catch {
                // Ignore errors if interaction is no longer valid
              }
            }
          }, 2000);
        } catch (error) {
          await ctx.editReply({
            embeds: [{
              color: 0xff0000,
              title: 'Shell Command Error',
              description: `\`${command}\``,
              fields: [{ name: 'Error', value: `\`\`\`\n${error instanceof Error ? error.message : String(error)}\n\`\`\``, inline: false }],
              timestamp: true
            }]
          });
        }
      }
    }],
    ['shell-input', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        const processId = ctx.getInteger('id', true)!;
        const input = ctx.getString('text', true)!;
        try {
          const result = await shellHandlers.onShellInput(ctx, processId, input);
          
          if (result.success) {
            await ctx.editReply({
              embeds: [{
                color: 0x00ff00,
                title: 'Input Sent Successfully',
                fields: [
                  { name: 'Process ID', value: processId.toString(), inline: true },
                  { name: 'Sent Data', value: `\`${input}\``, inline: false },
                  { name: 'Result', value: '✅ Input sent. New output will be displayed below if available.', inline: false }
                ],
                timestamp: true
              }]
            });
            
            // Wait a moment for output to be generated, then show new output
            // Use longer timeout for Python3 due to buffering behavior
            const waitTime = input.toLowerCase().includes('python') ? 2000 : 1000;
            setTimeout(async () => {
              const newOutput = shellHandlers.getNewOutput(processId);
              if (newOutput.trim()) {
                const truncatedOutput = newOutput.substring(0, 4000);
                try {
                  await ctx.followUp({
                    embeds: [{
                      color: 0x0099ff,
                      title: 'New Output',
                      fields: [
                        { name: 'Process ID', value: processId.toString(), inline: true },
                        { name: 'Input', value: `\`${input}\``, inline: true },
                        { name: 'Output', value: `\`\`\`\n${truncatedOutput}\n\`\`\``, inline: false }
                      ],
                      timestamp: true
                    }]
                  });
                } catch (error) {
                  console.error('Failed to send followUp output:', error);
                }
              } else {
                // If no output yet, check again after additional time for Python
                setTimeout(async () => {
                  const lateOutput = shellHandlers.getNewOutput(processId);
                  if (lateOutput.trim()) {
                    const truncatedOutput = lateOutput.substring(0, 4000);
                    try {
                      await ctx.followUp({
                        embeds: [{
                          color: 0x0099ff,
                          title: 'New Output (Delayed)',
                          fields: [
                            { name: 'Process ID', value: processId.toString(), inline: true },
                            { name: 'Input', value: `\`${input}\``, inline: true },
                            { name: 'Output', value: `\`\`\`\n${truncatedOutput}\n\`\`\``, inline: false }
                          ],
                          timestamp: true
                        }]
                      });
                    } catch (error) {
                      console.error('Failed to send delayed followUp output:', error);
                    }
                  }
                }, 2000);
              }
            }, waitTime);
          } else {
            await ctx.editReply({
              embeds: [{
                color: 0xff0000,
                title: 'Input Send Failed',
                fields: [
                  { name: 'Process ID', value: processId.toString(), inline: true },
                  { name: 'Sent Data', value: `\`${input}\``, inline: false },
                  { name: 'Result', value: '❌ Process not found. The process may have terminated.', inline: false }
                ],
                timestamp: true
              }]
            });
          }
        } catch (error) {
          await ctx.editReply({
            embeds: [{
              color: 0xff0000,
              title: 'Input Send Error',
              fields: [
                { name: 'Process ID', value: processId.toString(), inline: true },
                { name: 'Error', value: `\`\`\`\n${error instanceof Error ? error.message : String(error)}\n\`\`\``, inline: false }
              ],
              timestamp: true
            }]
          });
        }
      }
    }],
    ['shell-list', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        const processes = shellHandlers.onShellList(ctx);
        const fields = Array.from(processes.entries()).map(([id, proc]) => ({
          name: `ID: ${id}`,
          value: `\`${proc.command}\`\nStarted: ${proc.startTime.toLocaleTimeString()}`,
          inline: false
        }));
        
        await ctx.editReply({
          embeds: [{
            color: 0x00ffff,
            title: 'Running Shell Processes',
            description: processes.size === 0 ? 'No running processes.' : undefined,
            fields: fields.slice(0, 25), // Discord limit
            timestamp: true
          }]
        });
      }
    }],
    ['shell-kill', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        const processId = ctx.getInteger('id', true)!;
        try {
          const result = await shellHandlers.onShellKill(ctx, processId);
          await ctx.editReply({
            embeds: [{
              color: result.success ? 0x00ff00 : 0xff0000,
              title: result.success ? 'Process Stop Successful' : 'Process Stop Failed',
              fields: [
                { name: 'Process ID', value: processId.toString(), inline: true },
                { name: 'Result', value: result.success ? 'Process stopped' : 'Process not found', inline: false }
              ],
              timestamp: true
            }]
          });
        } catch (error) {
          await ctx.editReply({
            embeds: [{
              color: 0xff0000,
              title: 'Process Stop Error',
              fields: [
                { name: 'Process ID', value: processId.toString(), inline: true },
                { name: 'Error', value: `\`\`\`\n${error instanceof Error ? error.message : String(error)}\n\`\`\``, inline: false }
              ],
              timestamp: true
            }]
          });
        }
      }
    }],
    ['status', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        const sessionStatus = claudeController ? "Running" : "Idle";
        const gitStatusInfo = await gitHandlers.getStatus();
        const runningCount = shellHandlers.onShellList(ctx).size;
        const worktreeStatus = gitHandlers.onWorktreeBots(ctx);
        
        await ctx.editReply({
          embeds: [{
            color: 0x00ffff,
            title: 'Status',
            fields: [
              { name: 'Claude Code', value: sessionStatus, inline: true },
              { name: 'Git Branch', value: gitStatusInfo.branch, inline: true },
              { name: 'Shell Processes', value: `${runningCount} running`, inline: true },
              { name: 'Worktree Bots', value: `${worktreeStatus.totalBots} running`, inline: true },
              { name: 'Mentions', value: botSettings.mentionEnabled ? `Enabled (<@${botSettings.mentionUserId}>)` : 'Disabled', inline: true }
            ],
            timestamp: true
          }]
        });
      }
    }],
    ['settings', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        const action = ctx.getString('action', true)!;
        const value = ctx.getString('value');
        const result = utilsHandlers.onSettings(ctx, action, value || undefined);
        
        if (!result.success) {
          await ctx.editReply({
            embeds: [{
              color: 0xff0000,
              title: 'Settings Error',
              description: result.message,
              timestamp: true
            }]
          });
        } else {
          await ctx.editReply({
            embeds: [{
              color: 0x00ff00,
              title: 'Settings',
              fields: [
                { name: 'Mentions', value: result.mentionEnabled ? `Enabled (<@${result.mentionUserId}>)` : 'Disabled', inline: true }
              ],
              timestamp: true
            }]
          });
        }
      }
    }],
    ['pwd', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        const result = utilsHandlers.getPwd();
        await ctx.editReply({
          embeds: [{
            color: 0x0099ff,
            title: 'Working Directory',
            fields: [
              { name: 'Path', value: `\`${result.workDir}\``, inline: false },
              { name: 'Category', value: result.categoryName, inline: true },
              { name: 'Repository', value: result.repoName, inline: true },
              { name: 'Branch', value: result.branchName, inline: true }
            ],
            timestamp: true
          }]
        });
      }
    }],
    ['shutdown', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        await ctx.editReply({
          embeds: [{
            color: 0xff0000,
            title: 'Shutdown',
            description: 'Stopping bot...',
            timestamp: true
          }]
        });
        
        // Stop all processes
        shellHandlers.killAllProcesses();
        
        // Kill all worktree bots
        gitHandlers.killAllWorktreeBots();
        
        // Cancel Claude Code session
        if (claudeController) {
          claudeController.abort();
        }
        
        // Clean up monitoring and crash handlers
        healthMonitor.stopAll();
        crashHandler.cleanup();
        
        // Clean up pagination states
        cleanupPaginationStates();
        
        // Clear periodic cleanup
        clearInterval(cleanupInterval);
        
        // Wait a bit before exiting
        setTimeout(() => {
          Deno.exit(0);
        }, 1000);
      }
    }],
    ['help', {
      execute: async (ctx: InteractionContext) => {
        const commandName = ctx.getString('command');
        await helpHandlers.onHelp(ctx, commandName || undefined);
      }
    }],
    ['claude-enhanced', {
      execute: async (ctx: InteractionContext) => {
        const prompt = ctx.getString('prompt', true)!;
        const model = ctx.getString('model');
        const template = ctx.getString('template');
        const includeSystemInfo = ctx.getBoolean('include_system_info');
        const includeGitContext = ctx.getBoolean('include_git_context');
        const contextFiles = ctx.getString('context_files');
        const sessionId = ctx.getString('session_id');
        
        await enhancedClaudeHandlers.onClaudeEnhanced(
          ctx, prompt, model || undefined, template || undefined,
          includeSystemInfo || undefined, includeGitContext || undefined,
          contextFiles || undefined, sessionId || undefined
        );
      }
    }],
    ['claude-models', {
      execute: async (ctx: InteractionContext) => {
        await enhancedClaudeHandlers.onClaudeModels(ctx);
      }
    }],
    ['claude-sessions', {
      execute: async (ctx: InteractionContext) => {
        const action = ctx.getString('action', true)!;
        const sessionId = ctx.getString('session_id');
        await enhancedClaudeHandlers.onClaudeSessions(ctx, action, sessionId || undefined);
      }
    }],
    ['claude-templates', {
      execute: async (ctx: InteractionContext) => {
        const template = ctx.getString('template', true)!;
        const content = ctx.getString('content', true)!;
        await enhancedClaudeHandlers.onClaudeTemplates(ctx, template, content);
      }
    }],
    ['claude-context', {
      execute: async (ctx: InteractionContext) => {
        const includeSystemInfo = ctx.getBoolean('include_system_info');
        const includeGitContext = ctx.getBoolean('include_git_context');
        const contextFiles = ctx.getString('context_files');
        await enhancedClaudeHandlers.onClaudeContext(
          ctx, includeSystemInfo || undefined, includeGitContext || undefined,
          contextFiles || undefined
        );
      }
    }],
    ['system-info', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        try {
          const result = await systemHandlers.onSystemInfo(ctx);
          const { embed } = createFormattedEmbed('🖥️ System Information', result.data, 0x00ff00);
          await ctx.editReply({ embeds: [embed] });
        } catch (error) {
          const errorFormatted = formatError(error instanceof Error ? error : new Error(String(error)), 'system-info');
          const { embed } = createFormattedEmbed('❌ System Info Error', errorFormatted.formatted, 0xff0000);
          await ctx.editReply({ embeds: [embed] });
        }
      }
    }],
    ['processes', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        const filter = ctx.getString('filter');
        const limit = ctx.getInteger('limit') || 20;
        try {
          const result = await systemHandlers.onProcesses(ctx, filter || undefined, limit);
          const { embed } = createFormattedEmbed('⚙️ Running Processes', result.data, 0x0099ff);
          await ctx.editReply({ embeds: [embed] });
        } catch (error) {
          const errorFormatted = formatError(error instanceof Error ? error : new Error(String(error)), 'processes');
          const { embed } = createFormattedEmbed('❌ Process List Error', errorFormatted.formatted, 0xff0000);
          await ctx.editReply({ embeds: [embed] });
        }
      }
    }],
    ['system-resources', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        try {
          const result = await systemHandlers.onSystemResources(ctx);
          const { embed } = createFormattedEmbed('📊 System Resources', result.data, 0x00ffff);
          await ctx.editReply({ embeds: [embed] });
        } catch (error) {
          const errorFormatted = formatError(error instanceof Error ? error : new Error(String(error)), 'system-resources');
          const { embed } = createFormattedEmbed('❌ Resource Monitor Error', errorFormatted.formatted, 0xff0000);
          await ctx.editReply({ embeds: [embed] });
        }
      }
    }],
    ['network-info', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        try {
          const result = await systemHandlers.onNetworkInfo(ctx);
          const { embed } = createFormattedEmbed('🌐 Network Information', result.data, 0x9932cc);
          await ctx.editReply({ embeds: [embed] });
        } catch (error) {
          const errorFormatted = formatError(error instanceof Error ? error : new Error(String(error)), 'network-info');
          const { embed } = createFormattedEmbed('❌ Network Info Error', errorFormatted.formatted, 0xff0000);
          await ctx.editReply({ embeds: [embed] });
        }
      }
    }],
    ['disk-usage', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        try {
          const result = await systemHandlers.onDiskUsage(ctx);
          const { embed } = createFormattedEmbed('💽 Disk Usage', result.data, 0xff6600);
          await ctx.editReply({ embeds: [embed] });
        } catch (error) {
          const errorFormatted = formatError(error instanceof Error ? error : new Error(String(error)), 'disk-usage');
          const { embed } = createFormattedEmbed('❌ Disk Usage Error', errorFormatted.formatted, 0xff0000);
          await ctx.editReply({ embeds: [embed] });
        }
      }
    }],
    ['env-vars', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        const filter = ctx.getString('filter');
        try {
          const result = await systemHandlers.onEnvVars(ctx, filter || undefined);
          const { embed } = createFormattedEmbed('🔧 Environment Variables', result.data, 0x663399);
          await ctx.editReply({ embeds: [embed] });
        } catch (error) {
          const errorFormatted = formatError(error instanceof Error ? error : new Error(String(error)), 'env-vars');
          const { embed } = createFormattedEmbed('❌ Environment Variables Error', errorFormatted.formatted, 0xff0000);
          await ctx.editReply({ embeds: [embed] });
        }
      }
    }],
    ['system-logs', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        const lines = ctx.getInteger('lines') || 50;
        const service = ctx.getString('service');
        try {
          const result = await systemHandlers.onSystemLogs(ctx, lines, service || undefined);
          const { embed } = createFormattedEmbed('📋 System Logs', result.data, 0x990000);
          await ctx.editReply({ embeds: [embed] });
        } catch (error) {
          const errorFormatted = formatError(error instanceof Error ? error : new Error(String(error)), 'system-logs');
          const { embed } = createFormattedEmbed('❌ System Logs Error', errorFormatted.formatted, 0xff0000);
          await ctx.editReply({ embeds: [embed] });
        }
      }
    }],
    ['port-scan', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        const host = ctx.getString('host') || 'localhost';
        const ports = ctx.getString('ports');
        try {
          const result = await systemHandlers.onPortScan(ctx, host, ports || undefined);
          const { embed } = createFormattedEmbed('🔍 Port Scan Results', result.data, 0x006600);
          await ctx.editReply({ embeds: [embed] });
        } catch (error) {
          const errorFormatted = formatError(error instanceof Error ? error : new Error(String(error)), 'port-scan');
          const { embed } = createFormattedEmbed('❌ Port Scan Error', errorFormatted.formatted, 0xff0000);
          await ctx.editReply({ embeds: [embed] });
        }
      }
    }],
    ['service-status', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        const service = ctx.getString('service');
        try {
          const result = await systemHandlers.onServiceStatus(ctx, service || undefined);
          const { embed } = createFormattedEmbed('🔧 Service Status', result.data, 0x0066cc);
          await ctx.editReply({ embeds: [embed] });
        } catch (error) {
          const errorFormatted = formatError(error instanceof Error ? error : new Error(String(error)), 'service-status');
          const { embed } = createFormattedEmbed('❌ Service Status Error', errorFormatted.formatted, 0xff0000);
          await ctx.editReply({ embeds: [embed] });
        }
      }
    }],
    ['uptime', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        try {
          const result = await systemHandlers.onUptime(ctx);
          const { embed } = createFormattedEmbed('⏰ System Uptime', result.data, 0x339933);
          await ctx.editReply({ embeds: [embed] });
        } catch (error) {
          const errorFormatted = formatError(error instanceof Error ? error : new Error(String(error)), 'uptime');
          const { embed } = createFormattedEmbed('❌ Uptime Error', errorFormatted.formatted, 0xff0000);
          await ctx.editReply({ embeds: [embed] });
        }
      }
    }],
    // Additional Claude Commands
    ['claude-explain', {
      execute: async (ctx: InteractionContext) => {
        const content = ctx.getString('content', true)!;
        const detailLevel = ctx.getString('detail_level');
        const includeExamples = ctx.getBoolean('include_examples');
        await additionalClaudeHandlers.onClaudeExplain(ctx, content, detailLevel || undefined, includeExamples || undefined);
      }
    }],
    ['claude-debug', {
      execute: async (ctx: InteractionContext) => {
        const errorOrCode = ctx.getString('error_or_code', true)!;
        const language = ctx.getString('language');
        const contextFiles = ctx.getString('context_files');
        await additionalClaudeHandlers.onClaudeDebug(ctx, errorOrCode, language || undefined, contextFiles || undefined);
      }
    }],
    ['claude-optimize', {
      execute: async (ctx: InteractionContext) => {
        const code = ctx.getString('code', true)!;
        const focus = ctx.getString('focus');
        const preserveFunctionality = ctx.getBoolean('preserve_functionality');
        await additionalClaudeHandlers.onClaudeOptimize(ctx, code, focus || undefined, preserveFunctionality || undefined);
      }
    }],
    ['claude-review', {
      execute: async (ctx: InteractionContext) => {
        const codeOrFile = ctx.getString('code_or_file', true)!;
        const reviewType = ctx.getString('review_type');
        const includeSecurity = ctx.getBoolean('include_security');
        const includePerformance = ctx.getBoolean('include_performance');
        await additionalClaudeHandlers.onClaudeReview(ctx, codeOrFile, reviewType || undefined, includeSecurity || undefined, includePerformance || undefined);
      }
    }],
    ['claude-generate', {
      execute: async (ctx: InteractionContext) => {
        const request = ctx.getString('request', true)!;
        const type = ctx.getString('type');
        const style = ctx.getString('style');
        await additionalClaudeHandlers.onClaudeGenerate(ctx, request, type || undefined, style || undefined);
      }
    }],
    ['claude-refactor', {
      execute: async (ctx: InteractionContext) => {
        const code = ctx.getString('code', true)!;
        const goal = ctx.getString('goal');
        const preserveBehavior = ctx.getBoolean('preserve_behavior');
        const addTests = ctx.getBoolean('add_tests');
        await additionalClaudeHandlers.onClaudeRefactor(ctx, code, goal || undefined, preserveBehavior || undefined, addTests || undefined);
      }
    }],
    ['claude-learn', {
      execute: async (ctx: InteractionContext) => {
        const topic = ctx.getString('topic', true)!;
        const level = ctx.getString('level');
        const includeExercises = ctx.getBoolean('include_exercises');
        const stepByStep = ctx.getBoolean('step_by_step');
        await additionalClaudeHandlers.onClaudeLearn(ctx, topic, level || undefined, includeExercises || undefined, stepByStep || undefined);
      }
    }],
    // Advanced Settings Commands
    ['claude-settings', {
      execute: async (ctx: InteractionContext) => {
        const action = ctx.getString('action', true)!;
        const value = ctx.getString('value');
        await advancedSettingsHandlers.onClaudeSettings(ctx, action, value || undefined);
      }
    }],
    ['output-settings', {
      execute: async (ctx: InteractionContext) => {
        const action = ctx.getString('action', true)!;
        const value = ctx.getString('value');
        await advancedSettingsHandlers.onOutputSettings(ctx, action, value || undefined);
      }
    }],
    ['quick-model', {
      execute: async (ctx: InteractionContext) => {
        const model = ctx.getString('model', true)!;
        await advancedSettingsHandlers.onQuickModel(ctx, model);
      }
    }]
  ]);
  
  // Create dependencies object
  const dependencies: BotDependencies = {
    commands: [
      ...claudeCommands,
      ...enhancedClaudeCommands,
      ...gitCommands,
      ...shellCommands,
      ...utilsCommands,
      ...systemCommands,
      helpCommand,
    ],
    cleanSessionId,
    botSettings
  };

  // Create Discord bot
  // Button handlers
  const buttonHandlers: ButtonHandlers = new Map([
    // Claude action buttons
    ['cancel-claude', async (ctx: InteractionContext) => {
      const cancelled = claudeHandlers.onClaudeCancel(ctx);
      await ctx.update({
        embeds: [{
          color: cancelled ? 0xff0000 : 0x808080,
          title: cancelled ? 'Cancel Successful' : 'Cancel Failed',
          description: cancelled ? 'Claude Code session cancelled.' : 'No running Claude Code session.',
          timestamp: true
        }]
      });
    }],
    
    // Copy session ID button
    ['copy-session', async (ctx: InteractionContext) => {
      const sessionId = claudeSessionId;
      await ctx.update({
        embeds: [{
          color: 0x00ff00,
          title: 'Session ID',
          description: sessionId ? `\`${sessionId}\`` : 'No active session',
          timestamp: true
        }]
      });
    }],
    
    // Jump to previous message button
    ['jump-previous', async (ctx: InteractionContext) => {
      const previousMessage = getPreviousMessage();
      
      if (!previousMessage) {
        await ctx.update({
          embeds: [{
            color: 0xffaa00,
            title: '⬆️ No Previous Messages',
            description: 'No previous messages found in history.',
            fields: [
              { name: 'Tip', value: 'Send some Claude commands to build up your message history!', inline: false }
            ],
            timestamp: true
          }]
        });
        return;
      }
      
      // Show the previous message with navigation options
      const historyPosition = currentHistoryIndex + 1;
      const totalMessages = messageHistory.length;
      
      await ctx.update({
        embeds: [{
          color: 0x0099ff,
          title: `⬆️ Previous Message (${historyPosition}/${totalMessages})`,
          description: `\`\`\`\n${previousMessage}\n\`\`\``,
          fields: [
            { name: 'Usage', value: 'Copy this message to use with `/claude prompt:...`', inline: false },
            { name: 'Navigation', value: `Position ${historyPosition} of ${totalMessages} messages in history`, inline: false }
          ],
          timestamp: true
        }],
        components: [
          {
            type: 'actionRow',
            components: [
              {
                type: 'button',
                customId: 'history-previous',
                label: '⬅️ Older',
                style: 'secondary'
              },
              {
                type: 'button',
                customId: 'history-next',
                label: '➡️ Newer',
                style: 'secondary'
              },
              {
                type: 'button',
                customId: 'history-use',
                label: '🔄 Use This Message',
                style: 'primary'
              },
              {
                type: 'button',
                customId: 'history-close',
                label: '❌ Close',
                style: 'danger'
              }
            ]
          }
        ]
      });
    }],
    
    // Continue button with session ID
    ['continue', async (ctx: InteractionContext) => {
      const sessionId = claudeSessionId;
      if (!sessionId) {
        await ctx.update({
          embeds: [{
            color: 0xff0000,
            title: '❌ No Session Available',
            description: 'No active session found. Use `/claude` to start a new conversation.',
            timestamp: true
          }]
        });
        return;
      }
      
      await ctx.update({
        embeds: [{
          color: 0xffff00,
          title: '➡️ Continue Session',
          description: `Use \`/continue\` or \`/claude session_id:${sessionId}\` to continue the conversation.`,
          fields: [
            { name: 'Session ID', value: `\`${sessionId}\``, inline: false }
          ],
          timestamp: true
        }]
      });
    }],
    
    // History navigation buttons
    ['history-previous', async (ctx: InteractionContext) => {
      const olderMessage = getPreviousMessage();
      
      if (!olderMessage) {
        await ctx.update({
          embeds: [{
            color: 0xffaa00,
            title: '⬅️ No Older Messages',
            description: 'You\'ve reached the beginning of your message history.',
            timestamp: true
          }],
          components: []
        });
        return;
      }
      
      const historyPosition = currentHistoryIndex + 1;
      const totalMessages = messageHistory.length;
      
      await ctx.update({
        embeds: [{
          color: 0x0099ff,
          title: `⬅️ Older Message (${historyPosition}/${totalMessages})`,
          description: `\`\`\`\n${olderMessage}\n\`\`\``,
          fields: [
            { name: 'Usage', value: 'Copy this message to use with `/claude prompt:...`', inline: false },
            { name: 'Navigation', value: `Position ${historyPosition} of ${totalMessages} messages in history`, inline: false }
          ],
          timestamp: true
        }],
        components: [
          {
            type: 'actionRow',
            components: [
              {
                type: 'button',
                customId: 'history-previous',
                label: '⬅️ Older',
                style: 'secondary'
              },
              {
                type: 'button',
                customId: 'history-next',
                label: '➡️ Newer',
                style: 'secondary'
              },
              {
                type: 'button',
                customId: 'history-use',
                label: '🔄 Use This Message',
                style: 'primary'
              },
              {
                type: 'button',
                customId: 'history-close',
                label: '❌ Close',
                style: 'danger'
              }
            ]
          }
        ]
      });
    }],
    
    ['history-next', async (ctx: InteractionContext) => {
      const newerMessage = getNextMessage();
      
      if (!newerMessage) {
        await ctx.update({
          embeds: [{
            color: 0xffaa00,
            title: '➡️ No Newer Messages',
            description: 'You\'ve reached the end of your message history.',
            timestamp: true
          }],
          components: []
        });
        return;
      }
      
      const historyPosition = currentHistoryIndex + 1;
      const totalMessages = messageHistory.length;
      
      await ctx.update({
        embeds: [{
          color: 0x0099ff,
          title: `➡️ Newer Message (${historyPosition}/${totalMessages})`,
          description: `\`\`\`\n${newerMessage}\n\`\`\``,
          fields: [
            { name: 'Usage', value: 'Copy this message to use with `/claude prompt:...`', inline: false },
            { name: 'Navigation', value: `Position ${historyPosition} of ${totalMessages} messages in history`, inline: false }
          ],
          timestamp: true
        }],
        components: [
          {
            type: 'actionRow',
            components: [
              {
                type: 'button',
                customId: 'history-previous',
                label: '⬅️ Older',
                style: 'secondary'
              },
              {
                type: 'button',
                customId: 'history-next',
                label: '➡️ Newer',
                style: 'secondary'
              },
              {
                type: 'button',
                customId: 'history-use',
                label: '🔄 Use This Message',
                style: 'primary'
              },
              {
                type: 'button',
                customId: 'history-close',
                label: '❌ Close',
                style: 'danger'
              }
            ]
          }
        ]
      });
    }],
    
    ['history-use', async (ctx: InteractionContext) => {
      const currentMessage = messageHistory[currentHistoryIndex];
      if (!currentMessage) {
        await ctx.update({
          embeds: [{
            color: 0xff0000,
            title: '❌ No Message Selected',
            description: 'No message available to use.',
            timestamp: true
          }],
          components: []
        });
        return;
      }
      
      await ctx.update({
        embeds: [{
          color: 0x00ff00,
          title: '🔄 Using Previous Message',
          description: `Running Claude Code with:\n\`\`\`\n${currentMessage}\n\`\`\``,
          fields: [
            { name: 'Status', value: 'Executing...', inline: false }
          ],
          timestamp: true
        }],
        components: []
      });
      
      // Add the reused message to history again (as it's being sent again)
      addToHistory(currentMessage);
      // Execute the Claude command with the selected message
      await claudeHandlers.onClaude(ctx, currentMessage);
    }],
    
    ['history-close', async (ctx: InteractionContext) => {
      await ctx.update({
        embeds: [{
          color: 0x808080,
          title: '✅ History Closed',
          description: 'Message history navigation closed.',
          timestamp: true
        }],
        components: []
      });
    }],
    
    // Collapse content button
    ['collapse-content', async (ctx: InteractionContext) => {
      await ctx.update({
        embeds: [{
          color: 0x808080,
          title: '🔼 Content Collapsed',
          description: 'Content has been collapsed. Use the expand button to view it again.',
          timestamp: true
        }],
        components: []
      });
    }],
    
    ['workflow:git-status', async (ctx: InteractionContext) => {
      await ctx.deferReply();
      try {
        const gitStatusInfo = await gitHandlers.getStatus();
        await ctx.editReply({
          embeds: [{
            color: 0x00ff00,
            title: '📊 Git Status',
            fields: [
              { name: 'Branch', value: gitStatusInfo.branch || 'Unknown', inline: true },
              { name: 'Status', value: `\`\`\`\n${gitStatusInfo.status || 'No changes'}\n\`\`\``, inline: false },
              { name: 'Remote', value: `\`\`\`\n${gitStatusInfo.remote || 'No remote'}\n\`\`\``, inline: false }
            ],
            timestamp: true
          }]
        });
      } catch (error) {
        await ctx.editReply({
          embeds: [{
            color: 0xff0000,
            title: '📊 Git Status Error',
            description: `Error: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: true
          }]
        });
      }
    }]
  ]);
  
  bot = await createDiscordBot(config, handlers, buttonHandlers, dependencies, crashHandler);
  
  // Create Discord sender for Claude messages
  const discordSender: DiscordSender = {
    async sendMessage(content) {
      const channel = bot.getChannel();
      if (channel) {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import("npm:discord.js@14.14.1");
        
        // Convert MessageContent to Discord format
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
  
  // Create Claude sender function
  claudeSender = createClaudeSender(discordSender);
  
  // Signal handlers
  const handleSignal = async (signal: string) => {
    console.log(`\n${signal} signal received. Stopping bot...`);
    
    try {
      // Stop all processes
      shellHandlers.killAllProcesses();
      
      // Kill all worktree bots
      gitHandlers.killAllWorktreeBots();
      
      // Cancel Claude Code session
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
      
      setTimeout(() => {
        bot.client.destroy();
        Deno.exit(0);
      }, 1000);
    } catch (error) {
      console.error('Error during shutdown:', error);
      Deno.exit(1);
    }
  };
  
  Deno.addSignalListener("SIGINT", () => handleSignal("SIGINT"));
  Deno.addSignalListener("SIGTERM", () => handleSignal("SIGTERM"));
  
  return bot;
}

// Main execution
if (import.meta.main) {
  try {
    // Get environment variables and command line arguments
    const discordToken = Deno.env.get("DISCORD_TOKEN");
    const applicationId = Deno.env.get("APPLICATION_ID");
    const envCategoryName = Deno.env.get("CATEGORY_NAME");
    const envMentionUserId = Deno.env.get("DEFAULT_MENTION_USER_ID");
    
    if (!discordToken || !applicationId) {
      console.error("Error: DISCORD_TOKEN and APPLICATION_ID environment variables are required");
      Deno.exit(1);
    }
    
    // Parse command line arguments
    const args = parseArgs(Deno.args);
    const categoryName = args.category || envCategoryName;
    const defaultMentionUserId = args.userId || envMentionUserId;
    
    // Get Git information
    const gitInfo = await getGitInfo();
    
    // Create and start bot
    await createClaudeCodeBot({
      discordToken,
      applicationId,
      workDir: Deno.cwd(),
      repoName: gitInfo.repo,
      branchName: gitInfo.branch,
      categoryName,
      defaultMentionUserId,
    });
    
    console.log("Bot has started. Press Ctrl+C to stop.");
  } catch (error) {
    console.error("Failed to start bot:", error);
    Deno.exit(1);
  }
}