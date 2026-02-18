/**
 * Claude Info & Control Commands — /claude-info, /rewind, mid-session controls.
 * 
 * These commands leverage the SDK Query methods for:
 * - Account info, supported models, MCP server status
 * - File rewind (with checkpointing)
 * - Mid-session model/permission changes
 * 
 * @module claude/info-commands
 */

import { SlashCommandBuilder } from "npm:discord.js@14.14.1";
import type { ClaudeModelOptions } from "./client.ts";
import {
  getActiveQuery,
  getTrackedMessages,
  fetchClaudeInfo,
  interruptActiveQuery,
  setActiveModel,
  setActivePermissionMode,
  rewindToMessage,
  getAccountInfo,
  getSupportedModels,
  getMcpServerStatus,
} from "./query-manager.ts";

// ================================
// Command Definitions
// ================================

export const infoCommands = [
  new SlashCommandBuilder()
    .setName('claude-info')
    .setDescription('Show Claude account info, available models, and MCP server status')
    .addStringOption(option =>
      option.setName('section')
        .setDescription('Which info section to show')
        .setRequired(false)
        .addChoices(
          { name: 'All — Full overview', value: 'all' },
          { name: 'Account — Billing & subscription', value: 'account' },
          { name: 'Models — Available models', value: 'models' },
          { name: 'MCP — Server status', value: 'mcp' }
        )),
  
  new SlashCommandBuilder()
    .setName('rewind')
    .setDescription('Rewind file changes to a previous state (requires file checkpointing)')
    .addIntegerOption(option =>
      option.setName('turn')
        .setDescription('Turn number to rewind to (use /rewind without args to see available turns)')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('dry_run')
        .setDescription('Preview changes without actually modifying files')
        .setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('claude-control')
    .setDescription('Mid-session controls for an active Claude query')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Control action to perform')
        .setRequired(true)
        .addChoices(
          { name: 'Interrupt — Stop current processing', value: 'interrupt' },
          { name: 'Change Model — Switch model mid-session', value: 'set-model' },
          { name: 'Change Permissions — Switch permission mode', value: 'set-permissions' },
          { name: 'Status — Show active session info', value: 'status' }
        ))
    .addStringOption(option =>
      option.setName('value')
        .setDescription('Value for the action (model name or permission mode)')
        .setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('fast')
    .setDescription('Toggle fast mode — switch between default model and a fast/cheap model (Sonnet)'),
];

// ================================
// Handler Types & Factory
// ================================

export interface InfoCommandHandlerDeps {
  workDir: string;
  getQueryOptions?: () => ClaudeModelOptions;
  /** Read current unified settings (for /fast toggle) */
  getUnifiedSettings?: () => import("../settings/unified-settings.ts").UnifiedBotSettings;
  /** Update unified settings (for /fast toggle) */
  updateUnifiedSettings?: (partial: Partial<import("../settings/unified-settings.ts").UnifiedBotSettings>) => void;
}

export function createInfoCommandHandlers(deps: InfoCommandHandlerDeps) {
  const { workDir } = deps;

  return {
    // ================================
    // /claude-info
    // ================================
    // deno-lint-ignore no-explicit-any
    async onClaudeInfo(ctx: any, section?: string): Promise<void> {
      await ctx.deferReply();
      const showSection = section || 'all';

      // Try active query first, fall back to ephemeral query
      const hasActive = !!getActiveQuery();
      
      try {
        if (showSection === 'all' || showSection === 'account') {
          let account;
          if (hasActive) {
            account = await getAccountInfo();
          }
          if (!account) {
            // Open ephemeral query for info
            const info = await fetchClaudeInfo(workDir);
            if (info) {
              account = info.account;
              // If showing all, we got everything in one call
              if (showSection === 'all') {
                await sendFullInfoEmbed(ctx, info.account, info.models, []);
                return;
              }
            }
          }
          if (account) {
            await ctx.editReply({
              embeds: [{
                color: 0x0099ff,
                title: '👤 Claude Account Info',
                fields: [
                  { name: 'Email', value: account.email || 'N/A', inline: true },
                  { name: 'Organization', value: account.organization || 'N/A', inline: true },
                  { name: 'Subscription', value: account.subscriptionType || 'N/A', inline: true },
                  { name: 'Token Source', value: account.tokenSource || 'N/A', inline: true },
                  { name: 'API Key Source', value: account.apiKeySource || 'N/A', inline: true },
                ],
                timestamp: new Date().toISOString()
              }]
            });
            return;
          }
        }

        if (showSection === 'models') {
          let models;
          if (hasActive) {
            models = await getSupportedModels();
          }
          if (!models) {
            const info = await fetchClaudeInfo(workDir);
            models = info?.models;
          }
          if (models && models.length > 0) {
            const modelList = models.map(m => `• **${m.value}** — ${m.displayName}\n  ${m.description}`).join('\n');
            // Split if too long for Discord (max 4096 chars)
            const chunks = splitText(modelList, 4000);
            await ctx.editReply({
              embeds: [{
                color: 0x00cc66,
                title: `🤖 Available Models (${models.length})`,
                description: chunks[0],
                timestamp: new Date().toISOString()
              }]
            });
            return;
          }
        }

        if (showSection === 'mcp') {
          let mcpStatus;
          if (hasActive) {
            mcpStatus = await getMcpServerStatus();
          }
          if (mcpStatus && mcpStatus.length > 0) {
            const statusLines = mcpStatus.map(s => {
              const statusIcon = s.status === 'connected' ? '🟢' : s.status === 'failed' ? '🔴' : '🟡';
              return `${statusIcon} **${s.name}** — ${s.status}${s.error ? ` (${s.error})` : ''}`;
            }).join('\n');
            await ctx.editReply({
              embeds: [{
                color: 0x9966ff,
                title: '🔌 MCP Server Status',
                description: statusLines,
                timestamp: new Date().toISOString()
              }]
            });
            return;
          } else {
            await ctx.editReply({
              embeds: [{
                color: 0x9966ff,
                title: '🔌 MCP Server Status',
                description: 'No MCP servers configured or no active session to query.',
                timestamp: new Date().toISOString()
              }]
            });
            return;
          }
        }

        // Fallback
        await ctx.editReply({
          content: 'Could not retrieve Claude info. Ensure your API key is configured.',
          ephemeral: true
        });
      } catch (error) {
        console.error('Error in /claude-info:', error);
        await ctx.editReply({
          content: `Failed to retrieve info: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ephemeral: true
        });
      }
    },

    // ================================
    // /rewind
    // ================================
    // deno-lint-ignore no-explicit-any
    async onRewind(ctx: any, turn?: number, dryRun?: boolean): Promise<void> {
      await ctx.deferReply();

      if (!getActiveQuery()) {
        await ctx.editReply({
          embeds: [{
            color: 0xff0000,
            title: '❌ No Active Session',
            description: 'File rewind requires an active Claude session with file checkpointing enabled.\n\nTo enable checkpointing, use `/settings category:modes action:toggle-checkpoint`.',
            timestamp: new Date().toISOString()
          }]
        });
        return;
      }

      const messages = getTrackedMessages();

      // If no turn specified, show available turns
      if (turn === undefined) {
        if (messages.length === 0) {
          await ctx.editReply({
            embeds: [{
              color: 0xffaa00,
              title: '📋 Rewind Points',
              description: 'No rewind points tracked yet. Rewind points are created as Claude processes user messages during an active session.',
              timestamp: new Date().toISOString()
            }]
          });
          return;
        }

        const turnList = messages.map(m =>
          `• **Turn ${m.turn}** — ${new Date(m.timestamp).toLocaleTimeString()} — \`${m.messageId.substring(0, 8)}...\``
        ).join('\n');

        await ctx.editReply({
          embeds: [{
            color: 0x0099ff,
            title: '📋 Available Rewind Points',
            description: turnList,
            fields: [{
              name: 'Usage',
              value: 'Use `/rewind turn:<number>` to rewind to a specific turn.\nUse `/rewind turn:<number> dry_run:true` to preview changes first.',
              inline: false
            }],
            timestamp: new Date().toISOString()
          }]
        });
        return;
      }

      // Find the message for the specified turn
      const targetMessage = messages.find(m => m.turn === turn);
      if (!targetMessage) {
        await ctx.editReply({
          content: `Turn ${turn} not found. Available turns: ${messages.map(m => m.turn).join(', ')}`,
          ephemeral: true
        });
        return;
      }

      const isDryRun = dryRun ?? false;

      try {
        const result = await rewindToMessage(targetMessage.messageId, isDryRun);

        if (!result) {
          await ctx.editReply({
            embeds: [{
              color: 0xff0000,
              title: '❌ Rewind Failed',
              description: 'Could not perform rewind. The session may have ended or checkpointing may not be enabled.',
              timestamp: new Date().toISOString()
            }]
          });
          return;
        }

        if (!result.canRewind) {
          await ctx.editReply({
            embeds: [{
              color: 0xff0000,
              title: '❌ Cannot Rewind',
              description: result.error || 'Rewind is not possible for this message.',
              timestamp: new Date().toISOString()
            }]
          });
          return;
        }

        const filesChanged = result.filesChanged?.length ?? 0;
        const insertions = result.insertions ?? 0;
        const deletions = result.deletions ?? 0;

        await ctx.editReply({
          embeds: [{
            color: isDryRun ? 0xffaa00 : 0x00ff00,
            title: isDryRun ? '🔍 Rewind Preview (Dry Run)' : '✅ Files Rewound Successfully',
            description: isDryRun
              ? `Preview of rewinding to Turn ${turn}:`
              : `Files have been rewound to their state at Turn ${turn}.`,
            fields: [
              { name: 'Files Changed', value: `${filesChanged}`, inline: true },
              { name: 'Insertions', value: `+${insertions}`, inline: true },
              { name: 'Deletions', value: `-${deletions}`, inline: true },
              ...(result.filesChanged && result.filesChanged.length > 0
                ? [{ name: 'Affected Files', value: result.filesChanged.slice(0, 20).join('\n'), inline: false }]
                : []),
            ],
            timestamp: new Date().toISOString()
          }]
        });
      } catch (error) {
        console.error('Error in /rewind:', error);
        await ctx.editReply({
          content: `Rewind failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ephemeral: true
        });
      }
    },

    // ================================
    // /claude-control
    // ================================
    // deno-lint-ignore no-explicit-any
    async onClaudeControl(ctx: any, action: string, value?: string): Promise<void> {
      await ctx.deferReply();

      switch (action) {
        case 'interrupt': {
          const success = await interruptActiveQuery();
          await ctx.editReply({
            embeds: [{
              color: success ? 0x00ff00 : 0xff0000,
              title: success ? '⏸️ Query Interrupted' : '❌ No Active Query',
              description: success
                ? 'The current query has been interrupted. It will stop processing and return control.'
                : 'No active Claude query to interrupt.',
              timestamp: new Date().toISOString()
            }]
          });
          break;
        }

        case 'set-model': {
          if (!value) {
            await ctx.editReply({
              content: 'Please provide a model name. Example: `/claude-control action:set-model value:claude-sonnet-4-6`',
              ephemeral: true
            });
            return;
          }
          const success = await setActiveModel(value);
          await ctx.editReply({
            embeds: [{
              color: success ? 0x00ff00 : 0xff0000,
              title: success ? '✅ Model Changed' : '❌ Cannot Change Model',
              description: success
                ? `Model switched to **${value}** for the current session.`
                : 'No active query to change model on. Start a query first.',
              timestamp: new Date().toISOString()
            }]
          });
          break;
        }

        case 'set-permissions': {
          const validModes = ['default', 'plan', 'acceptEdits', 'bypassPermissions', 'delegate', 'dontAsk'];
          if (!value || !validModes.includes(value)) {
            await ctx.editReply({
              content: `Invalid permission mode. Available: ${validModes.join(', ')}`,
              ephemeral: true
            });
            return;
          }
          // deno-lint-ignore no-explicit-any
          const success = await setActivePermissionMode(value as any);
          await ctx.editReply({
            embeds: [{
              color: success ? 0x00ff00 : 0xff0000,
              title: success ? '✅ Permission Mode Changed' : '❌ Cannot Change Permissions',
              description: success
                ? `Permission mode switched to **${value}** for the current session.`
                : 'No active query to change permissions on. Start a query first.',
              timestamp: new Date().toISOString()
            }]
          });
          break;
        }

        case 'status': {
          const hasActive = !!getActiveQuery();
          const trackedMsgs = getTrackedMessages();
          await ctx.editReply({
            embeds: [{
              color: hasActive ? 0x00ff00 : 0x666666,
              title: hasActive ? '🟢 Active Session' : '⚫ No Active Session',
              description: hasActive
                ? `A Claude query is currently running.`
                : 'No active Claude query. Use `/claude` or `/agent` to start one.',
              fields: [
                { name: 'Active', value: hasActive ? 'Yes' : 'No', inline: true },
                { name: 'Tracked Turns', value: `${trackedMsgs.length}`, inline: true },
              ],
              timestamp: new Date().toISOString()
            }]
          });
          break;
        }

        default:
          await ctx.editReply({
            content: `Unknown action: ${action}. Available: interrupt, set-model, set-permissions, status`,
            ephemeral: true
          });
      }
    },

    // ================================
    // /fast — Toggle fast mode
    // ================================
    // deno-lint-ignore no-explicit-any
    async onFast(ctx: any): Promise<void> {
      if (!deps.getUnifiedSettings || !deps.updateUnifiedSettings) {
        await ctx.reply({ content: 'Fast mode not available (settings not wired).', ephemeral: true });
        return;
      }

      const current = deps.getUnifiedSettings();
      const newFastMode = !current.fastMode;
      deps.updateUnifiedSettings({ fastMode: newFastMode });

      // If there's an active query, switch the model mid-session
      const activeQuery = getActiveQuery();
      if (activeQuery) {
        try {
          if (newFastMode) {
            await setActiveModel(current.fastModel || 'claude-sonnet-4-6');
          } else {
            // Revert to default model (undefined = SDK default)
            await setActiveModel(current.defaultModel || undefined);
          }
        } catch {
          // Mid-session switch failed — setting still applies to next query
        }
      }

      const modelName = newFastMode
        ? (current.fastModel || 'claude-sonnet-4-6')
        : (current.defaultModel || 'default (Opus)');
      const midSessionNote = activeQuery
        ? '\nModel switched on active session.'
        : '';

      await ctx.reply({
        embeds: [{
          color: newFastMode ? 0xffaa00 : 0x5865f2,
          title: newFastMode ? '⚡ Fast Mode ON' : '🧠 Fast Mode OFF',
          description: newFastMode
            ? `Switched to **${modelName}** — faster responses, lower cost.${midSessionNote}`
            : `Switched to **${modelName}** — full reasoning power.${midSessionNote}`,
          footer: { text: 'Use /fast again to toggle back' },
          timestamp: new Date().toISOString()
        }]
      });
    },
  };
}

// ================================
// Helper Functions
// ================================

// deno-lint-ignore no-explicit-any
async function sendFullInfoEmbed(ctx: any, account: any, models: any[], mcpServers: any[]): Promise<void> {
  const modelList = models.slice(0, 15).map(m => `• **${m.value}** — ${m.displayName}`).join('\n');
  const modelOverflow = models.length > 15 ? `\n... and ${models.length - 15} more` : '';

  const fields = [
    { name: 'Email', value: account?.email || 'N/A', inline: true },
    { name: 'Organization', value: account?.organization || 'N/A', inline: true },
    { name: 'Subscription', value: account?.subscriptionType || 'N/A', inline: true },
    { name: `Available Models (${models.length})`, value: (modelList + modelOverflow) || 'None', inline: false },
  ];

  if (mcpServers.length > 0) {
    const statusLines = mcpServers.map(s => {
      const icon = s.status === 'connected' ? '🟢' : s.status === 'failed' ? '🔴' : '🟡';
      return `${icon} **${s.name}** — ${s.status}`;
    }).join('\n');
    fields.push({ name: 'MCP Servers', value: statusLines, inline: false });
  }

  await ctx.editReply({
    embeds: [{
      color: 0x0099ff,
      title: '📊 Claude Info Overview',
      fields,
      timestamp: new Date().toISOString()
    }]
  });
}

function splitText(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let current = '';
  for (const line of text.split('\n')) {
    if ((current + '\n' + line).length > maxLength) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? current + '\n' + line : line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
