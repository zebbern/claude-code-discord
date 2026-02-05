/**
 * Command handler wrappers for Discord bot commands.
 * Provides factory functions to create command handlers with standardized error handling.
 * 
 * @module core/command-wrappers
 */

import type { CommandHandlers, InteractionContext } from "../discord/index.ts";
import { formatShellOutput, formatGitOutput, formatError, createFormattedEmbed } from "../discord/index.ts";
import type { AllHandlers, MessageHistoryOps } from "./handler-registry.ts";
import type { ProcessCrashHandler, ProcessHealthMonitor } from "../process/index.ts";
import { expandableContent } from "../claude/index.ts";

// ================================
// Types
// ================================

/**
 * Dependencies for command wrapper creation.
 */
export interface CommandWrapperDeps {
  /** All handler modules */
  handlers: AllHandlers;
  /** Message history operations */
  messageHistory: MessageHistoryOps;
  /** Get current Claude controller */
  getClaudeController: () => AbortController | null;
  /** Get current Claude session ID */
  getClaudeSessionId: () => string | undefined;
  /** Crash handler for error reporting */
  crashHandler: ProcessCrashHandler;
  /** Health monitor */
  healthMonitor: ProcessHealthMonitor;
  /** Bot settings */
  botSettings: { mentionEnabled: boolean; mentionUserId: string | null };
  /** Cleanup interval ID */
  cleanupInterval: number;
}

// ================================
// Simple Command Wrappers
// ================================

/**
 * Create a simple deferred command handler with standard error handling.
 */
function createDeferredHandler<T>(
  handler: (ctx: InteractionContext) => Promise<T>,
  formatSuccess: (result: T) => { title: string; data: string; color: number },
  errorTitle: string,
  crashHandler: ProcessCrashHandler,
  crashContext?: string
): { execute: (ctx: InteractionContext) => Promise<void> } {
  return {
    execute: async (ctx: InteractionContext) => {
      await ctx.deferReply();
      try {
        const result = await handler(ctx);
        const formatted = formatSuccess(result);
        const { embed } = createFormattedEmbed(formatted.title, formatted.data, formatted.color);
        await ctx.editReply({ embeds: [embed] });
      } catch (error) {
        const errorFormatted = formatError(error instanceof Error ? error : new Error(String(error)), crashContext || errorTitle);
        const { embed } = createFormattedEmbed(`❌ ${errorTitle}`, errorFormatted.formatted, 0xff0000);
        await ctx.editReply({ embeds: [embed] });
        
        if (crashHandler && crashContext) {
          await crashHandler.reportCrash('main', error instanceof Error ? error : new Error(String(error)), crashContext);
        }
      }
    }
  };
}

// ================================
// System Command Wrappers
// ================================

/**
 * Create system command handlers.
 */
export function createSystemCommandHandlers(
  handlers: AllHandlers,
  crashHandler: ProcessCrashHandler
): Map<string, { execute: (ctx: InteractionContext) => Promise<void> }> {
  const { system: systemHandlers } = handlers;
  
  return new Map([
    ['system-info', createDeferredHandler(
      async () => await systemHandlers.onSystemInfo({} as InteractionContext),
      (r) => ({ title: '🖥️ System Information', data: r.data, color: 0x00ff00 }),
      'System Info Error', crashHandler, 'system-info'
    )],
    ['system-resources', createDeferredHandler(
      async () => await systemHandlers.onSystemResources({} as InteractionContext),
      (r) => ({ title: '📊 System Resources', data: r.data, color: 0x00ffff }),
      'Resource Monitor Error', crashHandler, 'system-resources'
    )],
    ['network-info', createDeferredHandler(
      async () => await systemHandlers.onNetworkInfo({} as InteractionContext),
      (r) => ({ title: '🌐 Network Information', data: r.data, color: 0x9932cc }),
      'Network Info Error', crashHandler, 'network-info'
    )],
    ['disk-usage', createDeferredHandler(
      async () => await systemHandlers.onDiskUsage({} as InteractionContext),
      (r) => ({ title: '💽 Disk Usage', data: r.data, color: 0xff6600 }),
      'Disk Usage Error', crashHandler, 'disk-usage'
    )],
    ['uptime', createDeferredHandler(
      async () => await systemHandlers.onUptime({} as InteractionContext),
      (r) => ({ title: '⏰ System Uptime', data: r.data, color: 0x339933 }),
      'Uptime Error', crashHandler, 'uptime'
    )],
  ]);
}

/**
 * Create system commands with parameters.
 */
export function createParameterizedSystemHandlers(
  handlers: AllHandlers,
  crashHandler: ProcessCrashHandler
): Map<string, { execute: (ctx: InteractionContext) => Promise<void> }> {
  const { system: systemHandlers } = handlers;
  
  return new Map([
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
  ]);
}

// ================================
// Claude Command Wrappers  
// ================================

/**
 * Create Claude-related command handlers.
 */
export function createClaudeCommandHandlers(
  handlers: AllHandlers,
  messageHistory: MessageHistoryOps,
  getClaudeController: () => AbortController | null
): Map<string, { execute: (ctx: InteractionContext) => Promise<void>; handleButton?: (ctx: InteractionContext, customId: string) => Promise<void> }> {
  const { claude: claudeHandlers, enhancedClaude: enhancedClaudeHandlers, additionalClaude: additionalClaudeHandlers } = handlers;
  const { addToHistory } = messageHistory;

  return new Map([
    ['claude', {
      execute: async (ctx: InteractionContext) => {
        const prompt = ctx.getString('prompt', true)!;
        const sessionId = ctx.getString('session_id');
        addToHistory(prompt);
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
        if (prompt) addToHistory(prompt);
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
    // Additional Claude commands
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
  ]);
}

// ================================
// Settings Command Wrappers
// ================================

/**
 * Create settings command handlers.
 */
export function createSettingsCommandHandlers(
  handlers: AllHandlers
): Map<string, { execute: (ctx: InteractionContext) => Promise<void> }> {
  const { advancedSettings: advancedSettingsHandlers, unifiedSettings: unifiedSettingsHandlers, agent: agentHandlers } = handlers;

  return new Map([
    ['claude-settings', {
      execute: async (ctx: InteractionContext) => {
        const action = ctx.getString('action', true)!;
        const value = ctx.getString('value');
        await advancedSettingsHandlers.onClaudeSettings(ctx, action, value || undefined);
      }
    }],
    ['settings', {
      execute: async (ctx: InteractionContext) => {
        const category = ctx.getString('category', true)!;
        const action = ctx.getString('action');
        const value = ctx.getString('value');
        await unifiedSettingsHandlers.onUnifiedSettings(ctx, category, action || undefined, value || undefined);
      }
    }],
    ['todos', {
      execute: async (ctx: InteractionContext) => {
        const action = ctx.getString('action', true)!;
        const content = ctx.getString('content');
        const priority = ctx.getString('priority');
        const rateTier = ctx.getString('rate_tier');
        await unifiedSettingsHandlers.onTodos(ctx, action, content || undefined, priority || undefined, rateTier || undefined);
      }
    }],
    ['mcp', {
      execute: async (ctx: InteractionContext) => {
        const action = ctx.getString('action', true)!;
        const serverName = ctx.getString('server_name');
        const serverUrl = ctx.getString('server_url');
        const serverType = ctx.getString('server_type');
        await unifiedSettingsHandlers.onMCP(ctx, action, serverName || undefined, serverUrl || undefined, serverType || undefined);
      }
    }],
    ['agent', {
      execute: async (ctx: InteractionContext) => {
        const action = ctx.getString('action', true)!;
        const agentName = ctx.getString('agent_name');
        const message = ctx.getString('message');
        const contextFiles = ctx.getString('context_files');
        const includeSystemInfo = ctx.getBoolean('include_system_info');
        await agentHandlers.onAgent(ctx, action, agentName || undefined, message || undefined, contextFiles || undefined, includeSystemInfo || undefined);
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
}

// ================================
// Master Command Handler Factory
// ================================

// Import git/shell handlers for complete factory
import { createGitCommandHandlers, createShellCommandHandlers, createUtilityCommandHandlers, type GitShellHandlerDeps } from "./git-shell-handlers.ts";

/**
 * Extended dependencies for complete command handler creation.
 */
export interface CompleteCommandWrapperDeps extends CommandWrapperDeps {
  // All fields from CommandWrapperDeps plus git/shell specific needs
}

/**
 * Create all command handlers using the extracted wrappers.
 * This significantly reduces code in index.ts by consolidating handler creation.
 */
export function createAllCommandHandlers(deps: CommandWrapperDeps): CommandHandlers {
  const { handlers, messageHistory, getClaudeController, crashHandler, healthMonitor, botSettings, cleanupInterval } = deps;

  // Get handlers from individual factories
  const systemHandlers = createSystemCommandHandlers(handlers, crashHandler);
  const paramSystemHandlers = createParameterizedSystemHandlers(handlers, crashHandler);
  const claudeHandlers = createClaudeCommandHandlers(handlers, messageHistory, getClaudeController);
  const settingsHandlers = createSettingsCommandHandlers(handlers);

  // Create git/shell deps
  const gitShellDeps: GitShellHandlerDeps = {
    handlers,
    crashHandler,
    healthMonitor,
    getClaudeController,
    cleanupInterval,
    botSettings,
  };

  const gitHandlers = createGitCommandHandlers(gitShellDeps);
  const shellHandlers = createShellCommandHandlers(gitShellDeps);
  const utilityHandlers = createUtilityCommandHandlers(gitShellDeps);

  // Combine all handlers into single map
  const commandHandlers: CommandHandlers = new Map([
    ...systemHandlers,
    ...paramSystemHandlers,
    ...claudeHandlers,
    ...settingsHandlers,
    ...gitHandlers,
    ...shellHandlers,
    ...utilityHandlers,
  ]);

  return commandHandlers;
}
