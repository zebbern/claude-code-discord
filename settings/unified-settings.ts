import { SlashCommandBuilder } from "npm:discord.js@14.14.1";
import { CLAUDE_MODELS } from "../claude/enhanced-client.ts";

// Unified settings interface combining all bot settings
// NOTE: Temperature and maxTokens are NOT supported by Claude Code CLI
export interface UnifiedBotSettings {
  // Basic bot settings (formerly /settings)
  mentionEnabled: boolean;
  mentionUserId: string | null;
  
  // Claude Code settings (only CLI-supported options)
  defaultModel: string;
  defaultSystemPrompt: string | null;
  autoIncludeSystemInfo: boolean;
  autoIncludeGitContext: boolean;
  
  // Thinking mode settings (native SDK thinking config)
  thinkingMode: 'adaptive' | 'think' | 'think-hard' | 'ultrathink' | 'disabled';
  
  // Effort level (controls reasoning depth)
  effortLevel: 'low' | 'medium' | 'high' | 'max';
  
  // Mode settings
  operationMode: 'normal' | 'plan' | 'auto-accept' | 'danger' | 'dont-ask';
  
  // Budget settings
  maxBudgetUsd: number | null;
  
  // Advanced SDK features
  /** Enable 1M token context window (Sonnet 4/4.5 only) */
  enable1MContext: boolean;
  /** Enable file checkpointing for undo/rewind support */
  enableFileCheckpointing: boolean;
  /** Enable sandbox mode for safer command execution */
  enableSandbox: boolean;
  /** JSON schema for structured output (null = unstructured text) */
  outputJsonSchema: Record<string, unknown> | null;
  
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
  
  // Proxy settings
  proxyEnabled: boolean;
  proxyUrl: string | null;
  noProxyDomains: string[];
}

export const UNIFIED_DEFAULT_SETTINGS: UnifiedBotSettings = {
  // Basic bot settings
  mentionEnabled: false,
  mentionUserId: null,
  
  // Claude settings (only CLI-supported options)
  defaultModel: '',
  defaultSystemPrompt: null,
  autoIncludeSystemInfo: false,
  autoIncludeGitContext: true,
  
  // Thinking — adaptive is the default (Claude decides when to think)
  thinkingMode: 'adaptive',
  
  // Effort — high is standard
  effortLevel: 'high',
  
  // Operation mode
  operationMode: 'normal',
  
  // Budget
  maxBudgetUsd: null,
  
  // Advanced SDK features
  enable1MContext: false,
  enableFileCheckpointing: false,
  enableSandbox: false,
  outputJsonSchema: null,
  
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
  enablePerformanceMetrics: false,
  
  // Proxy
  proxyEnabled: false,
  proxyUrl: null,
  noProxyDomains: ['localhost', '127.0.0.1', '::1']
};

// Thinking mode options — maps to native SDK `thinking` option
// The new SDK supports: adaptive (Opus 4.6+), enabled (with budget), disabled
export const THINKING_MODES = {
  'adaptive': {
    name: 'Adaptive (Default)',
    description: 'Claude decides when and how much to think — best for Opus 4.6+',
    thinking: { type: 'adaptive' as const }
  },
  'think': {
    name: 'Thinking Mode',
    description: 'Extended thinking with moderate budget (10K tokens)',
    thinking: { type: 'enabled' as const, budgetTokens: 10000 }
  },
  'think-hard': {
    name: 'Deep Thinking',
    description: 'Deep analysis and reasoning (50K tokens)',
    thinking: { type: 'enabled' as const, budgetTokens: 50000 }
  },
  'ultrathink': {
    name: 'Ultra Thinking',
    description: 'Maximum thinking depth (100K tokens)',
    thinking: { type: 'enabled' as const, budgetTokens: 100000 }
  },
  'disabled': {
    name: 'No Thinking',
    description: 'Disable extended thinking entirely',
    thinking: { type: 'disabled' as const }
  }
} as const;

// Effort level options — maps to native SDK `effort` option
// Controls how much reasoning effort Claude puts into responses
export const EFFORT_LEVELS = {
  'low': {
    name: 'Low Effort',
    description: 'Minimal thinking, fastest responses'
  },
  'medium': {
    name: 'Medium Effort',
    description: 'Moderate thinking depth'
  },
  'high': {
    name: 'High Effort',
    description: 'Deep reasoning (default)'
  },
  'max': {
    name: 'Maximum Effort',
    description: 'Maximum effort — Opus 4.6 only'
  }
} as const;

// Operation mode options — maps to SDK permissionMode
// NOTE: In the new Claude Agent SDK (v0.2.45), there are 6 permission modes:
//   default, acceptEdits, bypassPermissions, plan, delegate, dontAsk
//
// For Discord bots, 'dontAsk' is ideal — it auto-denies anything not pre-approved,
// preventing the bot from hanging on interactive permission prompts.
// 'default' mode would hang waiting for interactive canUseTool callbacks.
export const OPERATION_MODES = {
  'normal': {
    name: 'Normal Mode',
    description: 'Auto-accepts edits, asks before risky operations (recommended for Discord)',
    permissionMode: 'acceptEdits' as const,
    riskLevel: 'low'
  },
  'plan': {
    name: 'Plan Mode',
    description: 'Analysis only — Claude plans but does not execute changes',
    permissionMode: 'plan' as const,
    riskLevel: 'low'
  },
  'auto-accept': {
    name: 'Auto Accept Edits',
    description: 'Automatically accepts file edits without confirmation',
    permissionMode: 'acceptEdits' as const,
    riskLevel: 'medium'
  },
  'dont-ask': {
    name: "Don't Ask Mode",
    description: "Denies any tool use that isn't pre-approved — ideal for Discord bots",
    permissionMode: 'dontAsk' as const,
    riskLevel: 'low'
  },
  'danger': {
    name: 'Bypass Permissions',
    description: 'Bypasses all permission checks — use with extreme caution',
    permissionMode: 'bypassPermissions' as const,
    riskLevel: 'high'
  }
} as const;

// Rate limit tiers for todos command
export interface RateLimitTier {
  name: string;
  description: string;
  tokensPerMinute: number;
  tokensPerHour: number;
  tokensPerDay: number;
}

export const ANTHROPIC_RATE_LIMITS: Record<string, RateLimitTier> = {
  'free': {
    name: 'Free Tier',
    description: 'Basic usage limits for free users',
    tokensPerMinute: 1000,
    tokensPerHour: 10000,
    tokensPerDay: 50000
  },
  'basic': {
    name: 'Basic Plan',
    description: 'Standard paid tier',
    tokensPerMinute: 5000,
    tokensPerHour: 50000,
    tokensPerDay: 200000
  },
  'pro': {
    name: 'Professional Plan',
    description: 'Higher limits for professional use',
    tokensPerMinute: 10000,
    tokensPerHour: 100000,
    tokensPerDay: 500000
  },
  'enterprise': {
    name: 'Enterprise Plan',
    description: 'Enterprise-grade limits',
    tokensPerMinute: 50000,
    tokensPerHour: 500000,
    tokensPerDay: 2000000
  },
  'exceeds_200k_tokens': {
    name: 'High Usage Tier',
    description: 'For users exceeding 200k tokens',
    tokensPerMinute: 20000,
    tokensPerHour: 200000,
    tokensPerDay: 1000000
  }
};

// Unified settings command
export const unifiedSettingsCommand = new SlashCommandBuilder()
  .setName('settings')
  .setDescription('Manage all bot settings in one place')
  .addStringOption(option =>
    option.setName('category')
      .setDescription('Settings category to manage')
      .setRequired(true)
      .addChoices(
        { name: 'Show All Settings', value: 'show' },
        { name: 'Bot Settings', value: 'bot' },
        { name: 'Claude Settings', value: 'claude' },
        { name: 'Mode Settings', value: 'modes' },
        { name: 'Output Settings', value: 'output' },
        { name: 'Proxy Settings', value: 'proxy' },
        { name: 'Developer Settings', value: 'developer' },
        { name: 'Reset All', value: 'reset' }
      ))
  .addStringOption(option =>
    option.setName('action')
      .setDescription('Specific action to perform')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('value')
      .setDescription('New value for the setting')
      .setRequired(false));

// New todos command
export const todosCommand = new SlashCommandBuilder()
  .setName('todos')
  .setDescription('Manage development todos with API rate limit awareness')
  .addStringOption(option =>
    option.setName('action')
      .setDescription('Todo action to perform')
      .setRequired(true)
      .addChoices(
        { name: 'List Todos', value: 'list' },
        { name: 'Add Todo', value: 'add' },
        { name: 'Complete Todo', value: 'complete' },
        { name: 'Generate from Code', value: 'generate' },
        { name: 'Prioritize Todos', value: 'prioritize' },
        { name: 'Rate Limit Status', value: 'rate-status' }
      ))
  .addStringOption(option =>
    option.setName('content')
      .setDescription('Todo content or file path for generation')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('priority')
      .setDescription('Todo priority level')
      .setRequired(false)
      .addChoices(
        { name: 'Low', value: 'low' },
        { name: 'Medium', value: 'medium' },
        { name: 'High', value: 'high' },
        { name: 'Critical', value: 'critical' }
      ))
  .addStringOption(option =>
    option.setName('rate_tier')
      .setDescription('Your Anthropic API rate limit tier')
      .setRequired(false)
      .addChoices(
        ...Object.entries(ANTHROPIC_RATE_LIMITS).map(([key, tier]) => ({
          name: tier.name,
          value: key
        }))
      ));

// MCP (Model Context Protocol) command
export const mcpCommand = new SlashCommandBuilder()
  .setName('mcp')
  .setDescription('Manage Model Context Protocol (MCP) server configurations')
  .addStringOption(option =>
    option.setName('action')
      .setDescription('MCP action to perform')
      .setRequired(true)
      .addChoices(
        { name: 'List Servers', value: 'list' },
        { name: 'Add Server', value: 'add' },
        { name: 'Remove Server', value: 'remove' },
        { name: 'Test Connection', value: 'test' },
        { name: 'Server Status', value: 'status' }
      ))
  .addStringOption(option =>
    option.setName('server_name')
      .setDescription('MCP server name (e.g. "filesystem", "brave-search")')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('command')
      .setDescription('Full command to run (e.g. "npx -y @anthropic-ai/filesystem-mcp")')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('description')
      .setDescription('Server description')
      .setRequired(false));

export const unifiedSettingsCommands = [
  unifiedSettingsCommand,
  todosCommand,
  mcpCommand
];