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
  defaultModel: '',
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
  // NOTE: /claude-settings and /output-settings have been removed.
  // Their functionality is fully covered by the unified /settings command
  // (category:claude and category:output respectively).

  new SlashCommandBuilder()
    .setName('quick-model')
    .setDescription('Quickly switch Claude model for next conversation')
    .addStringOption(option =>
      option.setName('model')
        .setDescription('Claude model to use (e.g. sonnet, opus, haiku, claude-sonnet-4)')
        .setRequired(true))
];