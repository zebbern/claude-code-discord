import { SlashCommandBuilder } from "npm:discord.js@14.14.1";
import { CLAUDE_MODELS } from "../claude/enhanced-client.ts";

// Advanced bot settings configuration
export interface AdvancedBotSettings {
  // Notification settings
  mentionEnabled: boolean;
  mentionUserId: string | null;
  
  // Claude Code settings
  defaultModel: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
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
  
  // Claude Code
  defaultModel: 'claude-sonnet-4',
  defaultTemperature: 0.7,
  defaultMaxTokens: 4096,
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
          { name: 'set-temperature', value: 'set-temperature' },
          { name: 'set-max-tokens', value: 'set-max-tokens' },
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

  new SlashCommandBuilder()
    .setName('session-settings')
    .setDescription('Configure Claude Code session management')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Session setting to configure')
        .setRequired(true)
        .addChoices(
          { name: 'show', value: 'show' },
          { name: 'toggle-auto-save', value: 'toggle-auto-save' },
          { name: 'set-timeout', value: 'set-timeout' },
          { name: 'set-max-sessions', value: 'set-max-sessions' },
          { name: 'cleanup-old-sessions', value: 'cleanup-old-sessions' }
        ))
    .addIntegerOption(option =>
      option.setName('value')
        .setDescription('New value for the setting')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('monitoring-settings')
    .setDescription('Configure system monitoring defaults')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Monitoring setting to configure')
        .setRequired(true)
        .addChoices(
          { name: 'show', value: 'show' },
          { name: 'set-process-limit', value: 'set-process-limit' },
          { name: 'set-log-lines', value: 'set-log-lines' },
          { name: 'toggle-warnings', value: 'toggle-warnings' }
        ))
    .addIntegerOption(option =>
      option.setName('value')
        .setDescription('New value for the setting')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('developer-settings')
    .setDescription('Configure developer and debugging options')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Developer setting to configure')
        .setRequired(true)
        .addChoices(
          { name: 'show', value: 'show' },
          { name: 'toggle-debug', value: 'toggle-debug' },
          { name: 'toggle-verbose-errors', value: 'toggle-verbose-errors' },
          { name: 'toggle-performance-metrics', value: 'toggle-performance-metrics' },
          { name: 'export-settings', value: 'export-settings' },
          { name: 'reset-all', value: 'reset-all' }
        )),

  new SlashCommandBuilder()
    .setName('profile-settings')
    .setDescription('Manage user profiles and preferences')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Profile action to perform')
        .setRequired(true)
        .addChoices(
          { name: 'show', value: 'show' },
          { name: 'create-profile', value: 'create-profile' },
          { name: 'load-profile', value: 'load-profile' },
          { name: 'save-profile', value: 'save-profile' },
          { name: 'delete-profile', value: 'delete-profile' },
          { name: 'list-profiles', value: 'list-profiles' }
        ))
    .addStringOption(option =>
      option.setName('profile_name')
        .setDescription('Profile name')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('quick-model')
    .setDescription('Quickly switch Claude model for next conversation')
    .addStringOption(option =>
      option.setName('model')
        .setDescription('Claude model to use')
        .setRequired(true)
        .addChoices(
          ...Object.entries(CLAUDE_MODELS).map(([key, model]) => ({
            name: `${model.name}${model.recommended ? ' ⭐' : ''}`,
            value: key
          }))
        ))
];