import { CLAUDE_MODELS } from "../claude/enhanced-client.ts";
import type { AdvancedBotSettings } from "./advanced-settings.ts";

export interface SettingsHandlerDeps {
  settings: AdvancedBotSettings;
  updateSettings: (settings: Partial<AdvancedBotSettings>) => void;
  crashHandler: any;
}

export function createAdvancedSettingsHandlers(deps: SettingsHandlerDeps) {
  const { settings, updateSettings, crashHandler } = deps;

  return {
    // Claude Settings
    async onClaudeSettings(ctx: any, action: string, value?: string) {
      try {
        switch (action) {
          case 'show':
            await ctx.reply({
              embeds: [{
                color: 0x0099ff,
                title: '🤖 Claude Code Settings',
                fields: [
                  { name: 'Default Model', value: `\`${settings.defaultModel}\`\n${CLAUDE_MODELS[settings.defaultModel as keyof typeof CLAUDE_MODELS]?.name || 'Unknown'}`, inline: true },
                  { name: 'Temperature', value: settings.defaultTemperature.toString(), inline: true },
                  { name: 'Max Tokens', value: settings.defaultMaxTokens.toString(), inline: true },
                  { name: 'Auto System Info', value: settings.autoIncludeSystemInfo ? 'Enabled' : 'Disabled', inline: true },
                  { name: 'Auto Git Context', value: settings.autoIncludeGitContext ? 'Enabled' : 'Disabled', inline: true },
                  { name: 'System Prompt', value: settings.defaultSystemPrompt || 'Not set', inline: false }
                ],
                timestamp: true
              }],
              ephemeral: true
            });
            break;

          case 'set-model':
            if (!value || !CLAUDE_MODELS[value as keyof typeof CLAUDE_MODELS]) {
              const modelList = Object.entries(CLAUDE_MODELS).map(([key, model]) => 
                `• \`${key}\` - ${model.name}`
              ).join('\n');
              
              await ctx.reply({
                embeds: [{
                  color: 0xff6600,
                  title: '❌ Invalid Model',
                  description: 'Please specify a valid Claude model.',
                  fields: [{ name: 'Available Models', value: modelList, inline: false }],
                  timestamp: true
                }],
                ephemeral: true
              });
              return;
            }
            
            updateSettings({ defaultModel: value });
            const selectedModel = CLAUDE_MODELS[value as keyof typeof CLAUDE_MODELS];
            
            await ctx.reply({
              embeds: [{
                color: 0x00ff00,
                title: '✅ Model Updated',
                description: `Default Claude model set to **${selectedModel.name}**`,
                fields: [
                  { name: 'Description', value: selectedModel.description, inline: false },
                  { name: 'Context Window', value: selectedModel.contextWindow.toLocaleString() + ' tokens', inline: true },
                  { name: 'Supports Thinking', value: selectedModel.supportsThinking ? 'Yes' : 'No', inline: true }
                ],
                timestamp: true
              }],
              ephemeral: true
            });
            break;

          case 'set-temperature':
            if (!value) {
              await ctx.reply({
                content: 'Please provide a temperature value between 0.0 and 2.0',
                ephemeral: true
              });
              return;
            }
            
            const temp = parseFloat(value);
            if (isNaN(temp) || temp < 0 || temp > 2) {
              await ctx.reply({
                content: 'Temperature must be a number between 0.0 and 2.0',
                ephemeral: true
              });
              return;
            }
            
            updateSettings({ defaultTemperature: temp });
            await ctx.reply({
              embeds: [{
                color: 0x00ff00,
                title: '✅ Temperature Updated',
                description: `Default temperature set to ${temp}`,
                fields: [
                  { name: 'Effect', value: temp < 0.5 ? 'More focused and deterministic' : 
                                          temp > 1.5 ? 'More creative and varied' : 
                                          'Balanced creativity and focus', inline: false }
                ],
                timestamp: true
              }],
              ephemeral: true
            });
            break;

          case 'set-max-tokens':
            if (!value) {
              await ctx.reply({
                content: 'Please provide a max tokens value between 1 and 8192',
                ephemeral: true
              });
              return;
            }
            
            const maxTokens = parseInt(value);
            if (isNaN(maxTokens) || maxTokens < 1 || maxTokens > 8192) {
              await ctx.reply({
                content: 'Max tokens must be between 1 and 8192',
                ephemeral: true
              });
              return;
            }
            
            updateSettings({ defaultMaxTokens: maxTokens });
            await ctx.reply({
              embeds: [{
                color: 0x00ff00,
                title: '✅ Max Tokens Updated',
                description: `Default max tokens set to ${maxTokens}`,
                timestamp: true
              }],
              ephemeral: true
            });
            break;

          case 'set-system-prompt':
            if (!value) {
              updateSettings({ defaultSystemPrompt: null });
              await ctx.reply({
                embeds: [{
                  color: 0x00ff00,
                  title: '✅ System Prompt Cleared',
                  description: 'Default system prompt has been removed',
                  timestamp: true
                }],
                ephemeral: true
              });
            } else {
              updateSettings({ defaultSystemPrompt: value });
              await ctx.reply({
                embeds: [{
                  color: 0x00ff00,
                  title: '✅ System Prompt Set',
                  description: `System prompt updated: ${value.substring(0, 200)}${value.length > 200 ? '...' : ''}`,
                  timestamp: true
                }],
                ephemeral: true
              });
            }
            break;

          case 'toggle-auto-system-info':
            const newSystemInfo = !settings.autoIncludeSystemInfo;
            updateSettings({ autoIncludeSystemInfo: newSystemInfo });
            await ctx.reply({
              embeds: [{
                color: 0x00ff00,
                title: `✅ Auto System Info ${newSystemInfo ? 'Enabled' : 'Disabled'}`,
                description: `System information will ${newSystemInfo ? '' : 'not '}be automatically included in Claude requests`,
                timestamp: true
              }],
              ephemeral: true
            });
            break;

          case 'toggle-auto-git-context':
            const newGitContext = !settings.autoIncludeGitContext;
            updateSettings({ autoIncludeGitContext: newGitContext });
            await ctx.reply({
              embeds: [{
                color: 0x00ff00,
                title: `✅ Auto Git Context ${newGitContext ? 'Enabled' : 'Disabled'}`,
                description: `Git context will ${newGitContext ? '' : 'not '}be automatically included in Claude requests`,
                timestamp: true
              }],
              ephemeral: true
            });
            break;

          case 'reset-defaults':
            const { DEFAULT_SETTINGS } = await import("./advanced-settings.ts");
            updateSettings({
              defaultModel: DEFAULT_SETTINGS.defaultModel,
              defaultTemperature: DEFAULT_SETTINGS.defaultTemperature,
              defaultMaxTokens: DEFAULT_SETTINGS.defaultMaxTokens,
              defaultSystemPrompt: DEFAULT_SETTINGS.defaultSystemPrompt,
              autoIncludeSystemInfo: DEFAULT_SETTINGS.autoIncludeSystemInfo,
              autoIncludeGitContext: DEFAULT_SETTINGS.autoIncludeGitContext
            });
            await ctx.reply({
              embeds: [{
                color: 0x00ff00,
                title: '✅ Settings Reset',
                description: 'Claude Code settings have been reset to defaults',
                timestamp: true
              }],
              ephemeral: true
            });
            break;

          default:
            await ctx.reply({
              content: 'Unknown action. Use `/claude-settings action: show` to see current settings.',
              ephemeral: true
            });
        }
      } catch (error) {
        await crashHandler.reportCrash('main', error instanceof Error ? error : new Error(String(error)), 'claude-settings', `Action: ${action}`);
        throw error;
      }
    },

    // Output Settings
    async onOutputSettings(ctx: any, action: string, value?: string) {
      try {
        switch (action) {
          case 'show':
            await ctx.reply({
              embeds: [{
                color: 0x9932cc,
                title: '🎨 Output Display Settings',
                fields: [
                  { name: 'Code Highlighting', value: settings.codeHighlighting ? 'Enabled' : 'Disabled', inline: true },
                  { name: 'Auto Pagination', value: settings.autoPageLongOutput ? 'Enabled' : 'Disabled', inline: true },
                  { name: 'Max Output Length', value: settings.maxOutputLength.toString(), inline: true },
                  { name: 'Timestamp Format', value: settings.timestampFormat, inline: true }
                ],
                timestamp: true
              }],
              ephemeral: true
            });
            break;

          case 'toggle-code-highlighting':
            const newHighlighting = !settings.codeHighlighting;
            updateSettings({ codeHighlighting: newHighlighting });
            await ctx.reply({
              embeds: [{
                color: 0x00ff00,
                title: `✅ Code Highlighting ${newHighlighting ? 'Enabled' : 'Disabled'}`,
                description: `Syntax highlighting ${newHighlighting ? 'will be applied' : 'has been disabled'} for code blocks`,
                timestamp: true
              }],
              ephemeral: true
            });
            break;

          case 'toggle-auto-pagination':
            const newPagination = !settings.autoPageLongOutput;
            updateSettings({ autoPageLongOutput: newPagination });
            await ctx.reply({
              embeds: [{
                color: 0x00ff00,
                title: `✅ Auto Pagination ${newPagination ? 'Enabled' : 'Disabled'}`,
                description: `Long outputs ${newPagination ? 'will be paginated' : 'will be truncated'} automatically`,
                timestamp: true
              }],
              ephemeral: true
            });
            break;

          case 'set-max-length':
            if (!value) {
              await ctx.reply({
                content: 'Please provide a max length value between 1000 and 8000',
                ephemeral: true
              });
              return;
            }
            
            const maxLength = parseInt(value);
            if (isNaN(maxLength) || maxLength < 1000 || maxLength > 8000) {
              await ctx.reply({
                content: 'Max length must be between 1000 and 8000 characters',
                ephemeral: true
              });
              return;
            }
            
            updateSettings({ maxOutputLength: maxLength });
            await ctx.reply({
              embeds: [{
                color: 0x00ff00,
                title: '✅ Max Length Updated',
                description: `Output max length set to ${maxLength} characters`,
                timestamp: true
              }],
              ephemeral: true
            });
            break;

          case 'set-timestamp-format':
            if (!value || !['relative', 'absolute', 'both'].includes(value)) {
              await ctx.reply({
                content: 'Please specify: relative, absolute, or both',
                ephemeral: true
              });
              return;
            }
            
            updateSettings({ timestampFormat: value as 'relative' | 'absolute' | 'both' });
            await ctx.reply({
              embeds: [{
                color: 0x00ff00,
                title: '✅ Timestamp Format Updated',
                description: `Timestamp format set to ${value}`,
                timestamp: true
              }],
              ephemeral: true
            });
            break;

          default:
            await ctx.reply({
              content: 'Unknown action. Use `/output-settings action: show` to see current settings.',
              ephemeral: true
            });
        }
      } catch (error) {
        await crashHandler.reportCrash('main', error instanceof Error ? error : new Error(String(error)), 'output-settings', `Action: ${action}`);
        throw error;
      }
    },

    // Quick model switch
    async onQuickModel(ctx: any, model: string) {
      try {
        if (!CLAUDE_MODELS[model as keyof typeof CLAUDE_MODELS]) {
          await ctx.reply({
            content: 'Invalid model specified',
            ephemeral: true
          });
          return;
        }

        updateSettings({ defaultModel: model });
        const selectedModel = CLAUDE_MODELS[model as keyof typeof CLAUDE_MODELS];

        await ctx.reply({
          embeds: [{
            color: 0x00ff00,
            title: '🚀 Model Switched',
            description: `Now using **${selectedModel.name}** for Claude conversations`,
            fields: [
              { name: 'Model ID', value: `\`${model}\``, inline: true },
              { name: 'Context Window', value: selectedModel.contextWindow.toLocaleString() + ' tokens', inline: true },
              { name: 'Thinking Mode', value: selectedModel.thinkingMode ? 'Enabled' : 'Disabled', inline: true }
            ],
            footer: { text: 'This applies to all new conversations' },
            timestamp: true
          }],
          ephemeral: true
        });
      } catch (error) {
        await crashHandler.reportCrash('main', error instanceof Error ? error : new Error(String(error)), 'quick-model', `Model: ${model}`);
        throw error;
      }
    }
  };
}