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
  
  // New: Thinking mode settings
  thinkingMode: 'none' | 'think' | 'think-hard' | 'ultrathink';
  
  // New: Mode settings
  operationMode: 'normal' | 'plan' | 'auto-accept' | 'danger';
  
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
  
  // Proxy settings (new)
  proxyEnabled: boolean;
  proxyUrl: string | null;
  noProxyDomains: string[];
}

export const UNIFIED_DEFAULT_SETTINGS: UnifiedBotSettings = {
  // Basic bot settings
  mentionEnabled: false,
  mentionUserId: null,
  
  // Claude settings (only CLI-supported options)
  defaultModel: 'claude-sonnet-4',
  defaultSystemPrompt: null,
  autoIncludeSystemInfo: false,
  autoIncludeGitContext: true,
  
  // New modes
  thinkingMode: 'none',
  operationMode: 'normal',
  
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

// Thinking mode options
export const THINKING_MODES = {
  'none': {
    name: 'Standard Mode',
    description: 'Regular Claude responses without thinking mode',
    parameter: null
  },
  'think': {
    name: 'Thinking Mode',
    description: 'Claude thinks through problems step by step',
    parameter: 'thinking_mode=true'
  },
  'think-hard': {
    name: 'Deep Thinking',
    description: 'Claude engages in deeper analysis and reasoning',
    parameter: 'thinking_mode=deep'
  },
  'ultrathink': {
    name: 'Ultra Thinking',
    description: 'Maximum depth thinking for complex problems',
    parameter: 'thinking_mode=ultra'
  }
} as const;

// Operation mode options
export const OPERATION_MODES = {
  'normal': {
    name: 'Normal Mode',
    description: 'Standard operation with user confirmation for changes',
    riskLevel: 'low'
  },
  'plan': {
    name: 'Plan Mode',
    description: 'Focus on planning and architecture without execution',
    riskLevel: 'low'
  },
  'auto-accept': {
    name: 'Auto Accept Edits',
    description: 'Automatically apply suggested changes without confirmation',
    riskLevel: 'medium'
  },
  'danger': {
    name: 'Danger Mode',
    description: 'Unrestricted mode - use with extreme caution',
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
      .setDescription('MCP server name')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('server_url')
      .setDescription('MCP server URL or connection string')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('server_type')
      .setDescription('Type of MCP server')
      .setRequired(false)
      .addChoices(
        { name: 'Local Process', value: 'local' },
        { name: 'HTTP API', value: 'http' },
        { name: 'WebSocket', value: 'websocket' },
        { name: 'SSH Remote', value: 'ssh' }
      ));

export const unifiedSettingsCommands = [
  unifiedSettingsCommand,
  todosCommand,
  mcpCommand
];