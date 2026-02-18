/**
 * Git and Shell command handlers for Discord bot.
 * Extracts complex command handling logic from index.ts.
 * 
 * @module core/git-shell-handlers
 */

import type { CommandHandlers, InteractionContext } from "../discord/index.ts";
import { formatShellOutput, formatGitOutput, formatError, createFormattedEmbed, cleanupPaginationStates } from "../discord/index.ts";
import type { AllHandlers } from "./handler-registry.ts";
import type { ProcessCrashHandler, ProcessHealthMonitor } from "../process/index.ts";
import { BOT_VERSION, getLastCheckResult } from "../util/version-check.ts";

// ================================
// Types
// ================================

/**
 * Dependencies for git/shell handler creation.
 */
export interface GitShellHandlerDeps {
  /** All handler modules */
  handlers: AllHandlers;
  /** Crash handler for error reporting */
  crashHandler: ProcessCrashHandler;
  /** Health monitor */
  healthMonitor: ProcessHealthMonitor;
  /** Get current Claude controller */
  getClaudeController: () => AbortController | null;
  /** Cleanup interval ID */
  cleanupInterval: number;
  /** Bot settings */
  botSettings: { mentionEnabled: boolean; mentionUserId: string | null };
}

// ================================
// Git Command Handlers
// ================================

/**
 * Create git command handlers.
 */
export function createGitCommandHandlers(
  deps: GitShellHandlerDeps
): Map<string, { execute: (ctx: InteractionContext) => Promise<void> }> {
  const { handlers, crashHandler } = deps;
  const { git: gitHandlers } = handlers;

  return new Map([
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
          const { embed } = createFormattedEmbed('❌ Git Command Exception', errorFormatted.formatted, 0xff0000);
          await ctx.editReply({ embeds: [embed] });
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
          const isError = result.result.startsWith('Execution error:') || result.result.startsWith('Error:') || result.result.includes('fatal:');
          
          if (!isError || result.isExisting === true) {
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
            
            try {
              await gitHandlers.onWorktreeBot(ctx, result.fullPath, branch);
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
            fields: fields.slice(0, 25),
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
  ]);
}

// ================================
// Shell Command Handlers
// ================================

/**
 * Create shell command handlers.
 */
export function createShellCommandHandlers(
  deps: GitShellHandlerDeps
): Map<string, { execute: (ctx: InteractionContext) => Promise<void> }> {
  const { handlers, crashHandler } = deps;
  const { shell: shellHandlers } = handlers;

  return new Map([
    ['shell', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        const command = ctx.getString('command', true)!;
        const input = ctx.getString('input');
        try {
          const executionResult = await shellHandlers.onShell(ctx, command, input || undefined);
          let isCompleted = false;
          
          executionResult.onComplete(async (exitCode, output) => {
            if (isCompleted) return;
            isCompleted = true;
            
            const formatted = formatShellOutput(command, output, exitCode);
            const { embed } = createFormattedEmbed(
              exitCode === 0 ? '✅ Shell Command Complete' : '❌ Shell Command Failed',
              formatted.formatted,
              exitCode === 0 ? 0x00ff00 : 0xff0000
            );

            embed.fields = [
              { name: 'Process ID', value: executionResult.processId.toString(), inline: true },
              { name: 'Exit Code', value: exitCode.toString(), inline: true },
              ...(embed.fields || [])
            ];

            await ctx.editReply({ embeds: [embed] });
            
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
          
          setTimeout(async () => {
            if (!isCompleted) {
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
            fields: fields.slice(0, 25),
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
  ]);
}

// ================================
// Utility Command Handlers
// ================================

/**
 * Create utility command handlers (status, pwd, shutdown, help).
 */
export function createUtilityCommandHandlers(
  deps: GitShellHandlerDeps
): Map<string, { execute: (ctx: InteractionContext) => Promise<void> }> {
  const { handlers, crashHandler, healthMonitor, getClaudeController, cleanupInterval, botSettings } = deps;
  const { git: gitHandlers, shell: shellHandlers, utils: utilsHandlers, help: helpHandlers } = handlers;

  return new Map([
    ['status', {
      execute: async (ctx: InteractionContext) => {
        await ctx.deferReply();
        const claudeController = getClaudeController();
        const sessionStatus = claudeController ? "Running" : "Idle";
        const gitStatusInfo = await gitHandlers.getStatus();
        const runningCount = shellHandlers.onShellList(ctx).size;
        const worktreeStatus = gitHandlers.onWorktreeBots(ctx);
        const lastCheck = getLastCheckResult();
        const updateStatus = lastCheck
          ? (lastCheck.behind ? `⚠️ Update available (${lastCheck.remoteCommit})` : "✅ Up to date")
          : "⏳ Checking...";
        
        await ctx.editReply({
          embeds: [{
            color: 0x00ffff,
            title: 'Status',
            fields: [
              { name: 'Version', value: `v${BOT_VERSION}`, inline: true },
              { name: 'Updates', value: updateStatus, inline: true },
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
        
        shellHandlers.killAllProcesses();
        gitHandlers.killAllWorktreeBots();
        
        const claudeController = getClaudeController();
        if (claudeController) {
          claudeController.abort();
        }
        
        healthMonitor.stopAll();
        crashHandler.cleanup();
        cleanupPaginationStates();
        clearInterval(cleanupInterval);
        
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
  ]);
}
