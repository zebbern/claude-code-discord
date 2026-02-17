import { SlashCommandBuilder } from "npm:discord.js@14.14.1";
import { CLAUDE_MODELS, type ModelInfo } from "../claude/enhanced-client.ts";

// Advanced bot settings configuration
// NOTE: Temperature and maxTokens are NOT supported by Claude Code CLI
// Only model selection, system prompts, and context options are supported
export interface AdvancedBotSettings {
  // Notification settings
  mentionEnabled: boolean;
  mentionUserId: string | null;
  
  // Claude Code settings (only features supported by CLI)
  defaultModel: string;
  defaultSystemPrompt: string | null;
  autoIncludeSystemInfo: boolean;
  autoIncludeGitContext: boolean;
  
  // Output settings
  codeHighlighting: boolean;
  autoPageLongOutput: boolean;
  maxOutputLength: number;
  timestampFormat: 'relative' | 'absolute' | 'both';
  
  // Session settings
  autoSaveConversations: boolean;
  sessionTimeout: number; // in minutes
  maxSessionsPerUser: number;
  
  // System monitoring settings
  defaultProcessLimit: number;
  defaultLogLines: number;
  showSystemWarnings: boolean;
  
  // Developer settings
  enableDebugMode: boolean;
  verboseErrorReporting: boolean;
  enablePerformanceMetrics: boolean;
}

export const DEFAULT_SETTINGS: AdvancedBotSettings = {
  // Notifications
  mentionEnabled: false,
  mentionUserId: null,
  
  // Claude Code (only CLI-supported options)
  defaultModel: 'claude-sonnet-4',
  defaultSystemPrompt: null,
  autoIncludeSystemInfo: false,
  autoIncludeGitContext: true,
  
  // Output
  codeHighlighting: true,
  autoPageLongOutput: true,
  maxOutputLength: 4000,
  timestampFormat: 'relative',
  
  // Sessions
  autoSaveConversations: true,
  sessionTimeout: 60, // 1 hour
  maxSessionsPerUser: 10,
  
  // System monitoring
  defaultProcessLimit: 20,
  defaultLogLines: 50,
  showSystemWarnings: true,
  
  // Developer
  enableDebugMode: false,
  verboseErrorReporting: false,
  enablePerformanceMetrics: false
};

export const advancedSettingsCommands = [
  new SlashCommandBuilder()
    .setName('claude-settings')
    .setDescription('Manage Claude Code specific settings')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Setting action to perform')
        .setRequired(true)
        .addChoices(
          { name: 'show', value: 'show' },
          { name: 'set-model', value: 'set-model' },
          { name: 'set-system-prompt', value: 'set-system-prompt' },
          { name: 'toggle-auto-system-info', value: 'toggle-auto-system-info' },
          { name: 'toggle-auto-git-context', value: 'toggle-auto-git-context' },
          { name: 'reset-defaults', value: 'reset-defaults' }
        ))
    .addStringOption(option =>
      option.setName('value')
        .setDescription('New value for the setting')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('output-settings')
    .setDescription('Configure output formatting and display settings')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Output setting to configure')
        .setRequired(true)
        .addChoices(
          { name: 'show', value: 'show' },
          { name: 'toggle-code-highlighting', value: 'toggle-code-highlighting' },
          { name: 'toggle-auto-pagination', value: 'toggle-auto-pagination' },
          { name: 'set-max-length', value: 'set-max-length' },
          { name: 'set-timestamp-format', value: 'set-timestamp-format' }
        ))
    .addStringOption(option =>
      option.setName('value')
        .setDescription('New value for the setting')
        .setRequired(false)),

  // NOTE: Removed non-implemented advanced settings commands:
  // - session-settings, monitoring-settings, developer-settings, profile-settings
  // These commands were defined but had no handlers implemented
  // Their functionality is now available through the unified settings system

  new SlashCommandBuilder()
    .setName('quick-model')
    .setDescription('Quickly switch Claude model for next conversation')
    .addStringOption(option =>
      option.setName('model')
        .setDescription('Claude model to use (e.g. sonnet, opus, haiku, claude-sonnet-4)')
        .setRequired(true))
];