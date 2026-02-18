import type { UnifiedBotSettings, RateLimitTier } from "./unified-settings.ts";
import { 
  UNIFIED_DEFAULT_SETTINGS, 
  THINKING_MODES, 
  OPERATION_MODES, 
  EFFORT_LEVELS,
  ANTHROPIC_RATE_LIMITS 
} from "./unified-settings.ts";
import { CLAUDE_MODELS, isValidModel, resolveModelId, type ModelInfo } from "../claude/enhanced-client.ts";
import { 
  getTodosManager, 
  type TodoItem as PersistenceTodoItem
} from "../util/persistence.ts";
import * as path from "https://deno.land/std@0.208.0/path/mod.ts";

// .claude/mcp.json file format types (Claude Code standard format)
export interface MCPJsonServerEntry {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  description?: string;
}

export interface MCPJsonConfig {
  mcpServers: Record<string, MCPJsonServerEntry>;
}

export interface UnifiedSettingsHandlerDeps {
  settings: UnifiedBotSettings;
  updateSettings: (newSettings: Partial<UnifiedBotSettings>) => void;
  crashHandler: any;
  workDir: string;
}

// Todo item interface (mapped from persistence)
export interface TodoItem {
  id: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  completed: boolean;
  createdAt: Date;
  completedAt?: Date;
  estimatedTokens: number;
  rateLimitTier?: string;
}

// Persistence managers (initialized on first access)
const todosManager = getTodosManager();

// In-memory cache backed by persistence
let todos: TodoItem[] = [];
let persistenceInitialized = false;

// Initialize persistence and load data
async function ensurePersistence(): Promise<void> {
  if (persistenceInitialized) return;
  
  try {
    // Load todos
    const savedTodos = await todosManager.load([]);
    todos = savedTodos.map(t => ({
      id: t.id,
      content: t.text,
      priority: t.priority,
      completed: t.completed,
      createdAt: new Date(t.createdAt),
      completedAt: t.completedAt ? new Date(t.completedAt) : undefined,
      estimatedTokens: 0,
      rateLimitTier: undefined
    }));
    
    // NOTE: MCP servers are now read from .claude/mcp.json on-demand, not loaded here
    
    persistenceInitialized = true;
    console.log(`Persistence: Loaded ${todos.length} todos`);
  } catch (error) {
    console.error('Persistence: Failed to initialize:', error);
    persistenceInitialized = true; // Don't retry on error
  }
}

// Save todos to persistence
async function saveTodos(): Promise<void> {
  const persistenceTodos: PersistenceTodoItem[] = todos.map(t => ({
    id: t.id,
    text: t.content,
    priority: t.priority,
    completed: t.completed,
    createdAt: t.createdAt.toISOString(),
    completedAt: t.completedAt?.toISOString()
  }));
  await todosManager.save(persistenceTodos);
}

// MCP config file operations (Claude Code standard location)
const MCP_JSON_DIR = ".claude";
const MCP_JSON_FILENAME = "mcp.json";

async function readMCPJsonConfig(workDir: string): Promise<MCPJsonConfig> {
  const filePath = path.join(workDir, MCP_JSON_DIR, MCP_JSON_FILENAME);
  try {
    const content = await Deno.readTextFile(filePath);
    return JSON.parse(content) as MCPJsonConfig;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      // Return empty config if file doesn't exist
      return { mcpServers: {} };
    }
    console.error(`Failed to read ${MCP_JSON_FILENAME}:`, error);
    return { mcpServers: {} };
  }
}

async function writeMCPJsonConfig(workDir: string, config: MCPJsonConfig): Promise<boolean> {
  const filePath = path.join(workDir, MCP_JSON_DIR, MCP_JSON_FILENAME);
  try {
    // Ensure .claude directory exists
    await Deno.mkdir(path.join(workDir, MCP_JSON_DIR), { recursive: true });
    const content = JSON.stringify(config, null, 2);
    await Deno.writeTextFile(filePath, content);
    console.log(`MCP: Saved ${Object.keys(config.mcpServers).length} server(s) to ${MCP_JSON_DIR}/${MCP_JSON_FILENAME}`);
    return true;
  } catch (error) {
    console.error(`Failed to write ${MCP_JSON_DIR}/${MCP_JSON_FILENAME}:`, error);
    return false;
  }
}

export function createUnifiedSettingsHandlers(deps: UnifiedSettingsHandlerDeps) {
  const { settings, updateSettings, crashHandler, workDir } = deps;

  return {
    async onUnifiedSettings(ctx: any, category: string, action?: string, value?: string) {
      try {
        await ctx.deferReply();

        switch (category) {
          case 'show':
            await showAllSettings(ctx, settings);
            break;
            
          case 'bot':
            await handleBotSettings(ctx, settings, updateSettings, action, value);
            break;
            
          case 'claude':
            await handleClaudeSettings(ctx, settings, updateSettings, action, value);
            break;
            
          case 'modes':
            await handleModeSettings(ctx, settings, updateSettings, action, value);
            break;
            
          case 'output':
            await handleOutputSettings(ctx, settings, updateSettings, action, value);
            break;
            
          case 'proxy':
            await handleProxySettings(ctx, settings, updateSettings, action, value);
            break;
            
          case 'developer':
            await handleDeveloperSettings(ctx, settings, updateSettings, action, value);
            break;
            
          case 'reset':
            await handleResetSettings(ctx, settings, updateSettings, action);
            break;
            
          default:
            await ctx.editReply({
              embeds: [{
                color: 0xff0000,
                title: '❌ Invalid Category',
                description: `Unknown settings category: ${category}`,
                timestamp: true
              }]
            });
        }
      } catch (error) {
        await crashHandler.reportCrash('settings', error instanceof Error ? error : new Error(String(error)), 'unified-settings');
        throw error;
      }
    },

    async onTodos(
      ctx: any, 
      action: string, 
      content?: string, 
      priority?: string, 
      rateTier?: string
    ) {
      try {
        await ctx.deferReply();

        switch (action) {
          case 'list':
            await listTodos(ctx);
            break;
            
          case 'add':
            if (!content) {
              await ctx.editReply({
                content: 'Content is required for adding todos.',
                ephemeral: true
              });
              return;
            }
            await addTodo(ctx, content, priority as any, rateTier);
            break;
            
          case 'complete':
            if (!content) {
              await ctx.editReply({
                content: 'Todo ID is required for completion.',
                ephemeral: true
              });
              return;
            }
            await completeTodo(ctx, content);
            break;
            
          case 'generate':
            if (!content) {
              await ctx.editReply({
                content: 'File path is required for todo generation.',
                ephemeral: true
              });
              return;
            }
            await generateTodosFromCode(ctx, content, rateTier);
            break;
            
          case 'prioritize':
            await prioritizeTodos(ctx, rateTier);
            break;
            
          case 'rate-status':
            await showRateStatus(ctx, rateTier);
            break;
            
          default:
            await ctx.editReply({
              embeds: [{
                color: 0xff0000,
                title: '❌ Invalid Action',
                description: `Unknown todo action: ${action}`,
                timestamp: true
              }]
            });
        }
      } catch (error) {
        await crashHandler.reportCrash('todos', error instanceof Error ? error : new Error(String(error)), 'todos-command');
        throw error;
      }
    },

    async onMCP(
      ctx: any,
      action: string,
      serverName?: string,
      command?: string,
      description?: string
    ) {
      try {
        await ctx.deferReply();

        switch (action) {
          case 'list':
            await listMCPServers(ctx, workDir);
            break;
            
          case 'add':
            if (!serverName || !command) {
              await ctx.editReply({
                content: 'Server name and command are required for adding MCP servers.',
                ephemeral: true
              });
              return;
            }
            await addMCPServer(ctx, workDir, serverName, command, description);
            break;
            
          case 'remove':
            if (!serverName) {
              await ctx.editReply({
                content: 'Server name is required for removal.',
                ephemeral: true
              });
              return;
            }
            await removeMCPServer(ctx, workDir, serverName);
            break;
            
          case 'test':
            if (!serverName) {
              await ctx.editReply({
                content: 'Server name is required for testing.',
                ephemeral: true
              });
              return;
            }
            await testMCPConnection(ctx, workDir, serverName);
            break;
            
          case 'status':
            await showMCPStatus(ctx, workDir);
            break;
            
          default:
            await ctx.editReply({
              embeds: [{
                color: 0xff0000,
                title: '❌ Invalid Action',
                description: `Unknown MCP action: ${action}`,
                timestamp: true
              }]
            });
        }
      } catch (error) {
        await crashHandler.reportCrash('mcp', error instanceof Error ? error : new Error(String(error)), 'mcp-command');
        throw error;
      }
    }
  };
}

// Helper functions for settings management
async function showAllSettings(ctx: any, settings: UnifiedBotSettings) {
  const fields = [
    {
      name: '🤖 Bot Settings',
      value: `Mentions: ${settings.mentionEnabled ? `Enabled (<@${settings.mentionUserId}>)` : 'Disabled'}`,
      inline: true
    },
    {
      name: '🧠 Claude Settings',
      value: `Model: ${settings.defaultModel}\nAuto Git Context: ${settings.autoIncludeGitContext ? 'On' : 'Off'}\nAuto System Info: ${settings.autoIncludeSystemInfo ? 'On' : 'Off'}`,
      inline: true
    },
    {
      name: '⚙️ Mode Settings',
      value: `Thinking: ${THINKING_MODES[settings.thinkingMode].name}\nOperation: ${OPERATION_MODES[settings.operationMode].name}\nEffort: ${EFFORT_LEVELS[settings.effortLevel].name}\nBudget: ${settings.maxBudgetUsd != null ? '$' + settings.maxBudgetUsd : 'No limit'}`,
      inline: true
    },
    {
      name: '🎨 Output Settings',
      value: `Code Highlighting: ${settings.codeHighlighting ? 'On' : 'Off'}\nMax Length: ${settings.maxOutputLength}\nTimestamp: ${settings.timestampFormat}`,
      inline: true
    },
    {
      name: '🌐 Proxy Settings',
      value: `Proxy: ${settings.proxyEnabled ? 'Enabled' : 'Disabled'}\nNo-Proxy Domains: ${settings.noProxyDomains.length}`,
      inline: true
    },
    {
      name: '🔧 Developer Settings',
      value: `Debug: ${settings.enableDebugMode ? 'On' : 'Off'}\nVerbose Errors: ${settings.verboseErrorReporting ? 'On' : 'Off'}\nMetrics: ${settings.enablePerformanceMetrics ? 'On' : 'Off'}`,
      inline: true
    }
  ];

  await ctx.editReply({
    embeds: [{
      color: 0x0099ff,
      title: '⚙️ All Bot Settings',
      description: 'Use `/settings category:[category] action:[action] value:[value]` to modify settings',
      fields,
      timestamp: true
    }]
  });
}

async function handleBotSettings(ctx: any, settings: UnifiedBotSettings, updateSettings: any, action?: string, value?: string) {
  if (!action) {
    await ctx.editReply({
      embeds: [{
        color: 0x0099ff,
        title: '🤖 Bot Settings',
        description: 'Available actions: `mention-on`, `mention-off`',
        fields: [
          {
            name: 'Current Settings',
            value: `Mentions: ${settings.mentionEnabled ? `Enabled (<@${settings.mentionUserId}>)` : 'Disabled'}`,
            inline: false
          }
        ],
        timestamp: true
      }]
    });
    return;
  }

  switch (action) {
    case 'mention-on':
      if (!value) {
        await ctx.editReply({
          content: 'User ID is required for mention-on. Usage: `/settings category:bot action:mention-on value:[user_id]`',
          ephemeral: true
        });
        return;
      }
      updateSettings({ mentionEnabled: true, mentionUserId: value });
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Mentions Enabled',
          description: `Mentions enabled for <@${value}>`,
          timestamp: true
        }]
      });
      break;
      
    case 'mention-off':
      updateSettings({ mentionEnabled: false, mentionUserId: null });
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Mentions Disabled',
          description: 'Mentions have been disabled',
          timestamp: true
        }]
      });
      break;
      
    default:
      await ctx.editReply({
        content: `Unknown bot action: ${action}. Available: mention-on, mention-off`,
        ephemeral: true
      });
  }
}

async function handleModeSettings(ctx: any, settings: UnifiedBotSettings, updateSettings: any, action?: string, value?: string) {
  if (!action) {
    const thinkingOptions = Object.entries(THINKING_MODES).map(([key, mode]) => 
      `• **${key}**: ${mode.name} - ${mode.description}`
    ).join('\n');
    
    const operationOptions = Object.entries(OPERATION_MODES).map(([key, mode]) => 
      `• **${key}**: ${mode.name} - ${mode.description} (${mode.riskLevel} risk)`
    ).join('\n');

    const effortOptions = Object.entries(EFFORT_LEVELS).map(([key, level]) =>
      `• **${key}**: ${level.name} - ${level.description}`
    ).join('\n');

    await ctx.editReply({
      embeds: [{
        color: 0x0099ff,
        title: '⚙️ Mode Settings',
        description: 'Available actions: `set-thinking`, `set-operation`, `set-effort`, `set-budget`, `toggle-1m`, `toggle-checkpoint`, `toggle-sandbox`, `toggle-structured-output`, `set-output-schema`',
        fields: [
          {
            name: 'Current Settings',
            value: `Thinking Mode: **${settings.thinkingMode}** (${THINKING_MODES[settings.thinkingMode].name})\nOperation Mode: **${settings.operationMode}** (${OPERATION_MODES[settings.operationMode].name})\nEffort Level: **${settings.effortLevel}** (${EFFORT_LEVELS[settings.effortLevel].name})\nBudget Cap: ${settings.maxBudgetUsd != null ? `$${settings.maxBudgetUsd}` : 'No limit'}\nStructured Output: ${settings.outputJsonSchema ? '**Enabled**' : 'Disabled'}`,
            inline: false
          },
          {
            name: 'Advanced Features',
            value: `1M Context Beta: ${settings.enable1MContext ? '✅ Enabled' : '❌ Disabled'}\nFile Checkpointing: ${settings.enableFileCheckpointing ? '✅ Enabled' : '❌ Disabled'}\nSandbox Mode: ${settings.enableSandbox ? '✅ Enabled' : '❌ Disabled'}`,
            inline: false
          },
          {
            name: 'Thinking Mode Options',
            value: thinkingOptions,
            inline: false
          },
          {
            name: 'Operation Mode Options',
            value: operationOptions,
            inline: false
          },
          {
            name: 'Effort Level Options',
            value: effortOptions,
            inline: false
          }
        ],
        timestamp: true
      }]
    });
    return;
  }

  switch (action) {
    case 'set-thinking':
      if (!value || !(value in THINKING_MODES)) {
        const options = Object.keys(THINKING_MODES).join(', ');
        await ctx.editReply({
          content: `Invalid thinking mode. Available options: ${options}`,
          ephemeral: true
        });
        return;
      }
      updateSettings({ thinkingMode: value as keyof typeof THINKING_MODES });
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Thinking Mode Updated',
          description: `Thinking mode set to: **${THINKING_MODES[value as keyof typeof THINKING_MODES].name}**`,
          fields: [{
            name: 'Description',
            value: THINKING_MODES[value as keyof typeof THINKING_MODES].description,
            inline: false
          }],
          timestamp: true
        }]
      });
      break;
      
    case 'set-operation':
      if (!value || !(value in OPERATION_MODES)) {
        const options = Object.keys(OPERATION_MODES).join(', ');
        await ctx.editReply({
          content: `Invalid operation mode. Available options: ${options}`,
          ephemeral: true
        });
        return;
      }
      
      const mode = OPERATION_MODES[value as keyof typeof OPERATION_MODES];
      const warningColor = mode.riskLevel === 'high' ? 0xff6600 : mode.riskLevel === 'medium' ? 0xffaa00 : 0x00ff00;
      
      updateSettings({ operationMode: value as keyof typeof OPERATION_MODES });
      await ctx.editReply({
        embeds: [{
          color: warningColor,
          title: '✅ Operation Mode Updated',
          description: `Operation mode set to: **${mode.name}**`,
          fields: [
            {
              name: 'Description',
              value: mode.description,
              inline: false
            },
            {
              name: 'Risk Level',
              value: `${mode.riskLevel.toUpperCase()}${mode.riskLevel === 'high' ? ' ⚠️' : ''}`,
              inline: true
            }
          ],
          timestamp: true
        }]
      });
      break;
      
    case 'set-effort':
      if (!value || !(value in EFFORT_LEVELS)) {
        const options = Object.keys(EFFORT_LEVELS).join(', ');
        await ctx.editReply({
          content: `Invalid effort level. Available options: ${options}`,
          ephemeral: true
        });
        return;
      }
      updateSettings({ effortLevel: value as keyof typeof EFFORT_LEVELS });
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Effort Level Updated',
          description: `Effort level set to: **${EFFORT_LEVELS[value as keyof typeof EFFORT_LEVELS].name}**`,
          fields: [{
            name: 'Description',
            value: EFFORT_LEVELS[value as keyof typeof EFFORT_LEVELS].description,
            inline: false
          }],
          timestamp: true
        }]
      });
      break;

    case 'set-budget':
      if (!value) {
        await ctx.editReply({
          content: `Provide a budget in USD (e.g. \`0.50\`) or \`none\` to remove the limit.`,
          ephemeral: true
        });
        return;
      }
      if (value === 'none' || value === 'null' || value === '0') {
        updateSettings({ maxBudgetUsd: null });
        await ctx.editReply({
          embeds: [{
            color: 0x00ff00,
            title: '✅ Budget Limit Removed',
            description: 'No budget limit is set. Queries will run until completion.',
            timestamp: true
          }]
        });
      } else {
        const budget = parseFloat(value);
        if (isNaN(budget) || budget <= 0) {
          await ctx.editReply({
            content: `Invalid budget. Provide a positive number (e.g. \`0.50\`) or \`none\`.`,
            ephemeral: true
          });
          return;
        }
        updateSettings({ maxBudgetUsd: budget });
        await ctx.editReply({
          embeds: [{
            color: 0x00ff00,
            title: '✅ Budget Limit Set',
            description: `Maximum budget per query: **$${budget.toFixed(2)}**`,
            fields: [{
              name: 'Note',
              value: 'Queries will stop if this budget is exceeded.',
              inline: false
            }],
            timestamp: true
          }]
        });
      }
      break;

    case 'toggle-1m': {
      const newVal = !settings.enable1MContext;
      updateSettings({ enable1MContext: newVal });
      await ctx.editReply({
        embeds: [{
          color: newVal ? 0x00ff00 : 0xff6600,
          title: newVal ? '✅ 1M Context Beta Enabled' : '⚠️ 1M Context Beta Disabled',
          description: newVal
            ? 'Extended context window (up to 1M tokens) is now active. This uses the `context-1m-2025-08-07` beta.'
            : '1M context beta has been disabled. Standard context window will be used.',
          timestamp: true
        }]
      });
      break;
    }

    case 'toggle-checkpoint': {
      const newVal = !settings.enableFileCheckpointing;
      updateSettings({ enableFileCheckpointing: newVal });
      await ctx.editReply({
        embeds: [{
          color: newVal ? 0x00ff00 : 0xff6600,
          title: newVal ? '✅ File Checkpointing Enabled' : '⚠️ File Checkpointing Disabled',
          description: newVal
            ? 'File checkpointing is now active. Claude will create restore points for file changes, allowing rollback via `rewindFiles()`.'
            : 'File checkpointing has been disabled.',
          timestamp: true
        }]
      });
      break;
    }

    case 'toggle-sandbox': {
      const newVal = !settings.enableSandbox;
      updateSettings({ enableSandbox: newVal });
      await ctx.editReply({
        embeds: [{
          color: newVal ? 0x00ff00 : 0xff6600,
          title: newVal ? '✅ Sandbox Mode Enabled' : '⚠️ Sandbox Mode Disabled',
          description: newVal
            ? 'Sandbox mode is now active. Commands will run in an isolated environment with restricted filesystem and network access.'
            : 'Sandbox mode has been disabled. Commands will run with normal system access.',
          timestamp: true
        }]
      });
      break;
    }

    case 'toggle-structured-output': {
      const isEnabled = settings.outputJsonSchema !== null;
      if (isEnabled) {
        updateSettings({ outputJsonSchema: null });
        await ctx.editReply({
          embeds: [{
            color: 0xff6600,
            title: '📝 Structured Output Disabled',
            description: 'Claude will respond with normal unstructured text.',
            timestamp: true
          }]
        });
      } else {
        const defaultSchema: Record<string, unknown> = {
          type: 'object',
          properties: {
            response: { type: 'string', description: 'The main response text' },
            confidence: { type: 'number', description: 'Confidence level 0-1' },
            sources: { type: 'array', items: { type: 'string' }, description: 'Referenced sources' }
          },
          required: ['response']
        };
        updateSettings({ outputJsonSchema: defaultSchema });
        await ctx.editReply({
          embeds: [{
            color: 0x00ff00,
            title: '📊 Structured Output Enabled',
            description: 'Claude will respond with JSON matching the configured schema.\n\nDefault schema has `response`, `confidence`, and `sources` fields.\nUse `set-output-schema` to customize.',
            timestamp: true
          }]
        });
      }
      break;
    }

    case 'set-output-schema': {
      if (!value) {
        await ctx.editReply({
          content: 'Provide a JSON schema string. Example: `set-output-schema {"type":"object","properties":{"answer":{"type":"string"}}}`',
          ephemeral: true
        });
        break;
      }
      try {
        const schema = JSON.parse(value) as Record<string, unknown>;
        updateSettings({ outputJsonSchema: schema });
        await ctx.editReply({
          embeds: [{
            color: 0x00ff00,
            title: '📊 Output Schema Updated',
            description: `\`\`\`json\n${JSON.stringify(schema, null, 2).slice(0, 1000)}\n\`\`\``,
            timestamp: true
          }]
        });
      } catch {
        await ctx.editReply({
          content: 'Invalid JSON schema. Please provide valid JSON.',
          ephemeral: true
        });
      }
      break;
    }

    default:
      await ctx.editReply({
        content: `Unknown mode action: ${action}. Available: set-thinking, set-operation, set-effort, set-budget, toggle-1m, toggle-checkpoint, toggle-sandbox, toggle-structured-output, set-output-schema`,
        ephemeral: true
      });
  }
}

// Additional handler functions would continue here...
// For brevity, I'll implement the key functions and the rest can follow the same pattern

async function handleClaudeSettings(ctx: any, settings: UnifiedBotSettings, updateSettings: any, action?: string, value?: string) {
  // Implementation for Claude settings management
  // NOTE: Only model, system prompt, and context options are supported by Claude Code CLI
  // Temperature and maxTokens are NOT supported
  if (!action) {
    await ctx.editReply({
      embeds: [{
        color: 0x0099ff,
        title: '🧠 Claude Settings',
        description: 'Available actions: `set-model`, `toggle-git-context`, `toggle-system-info`, `set-system-prompt`\n\n*Note: Only model and context options are supported by Claude Code CLI*',
        fields: [{
          name: 'Current Settings',
          value: `Model: ${settings.defaultModel}\nAuto Git Context: ${settings.autoIncludeGitContext ? 'On' : 'Off'}\nAuto System Info: ${settings.autoIncludeSystemInfo ? 'On' : 'Off'}\nSystem Prompt: ${settings.defaultSystemPrompt ? 'Set' : 'Not set'}`,
          inline: false
        }],
        timestamp: true
      }]
    });
    return;
  }

  switch (action) {
    case 'set-model':
      if (!value) {
        const availableModels = Object.entries(CLAUDE_MODELS).map(([key, model]) => 
          `• **${key}**: ${model.name}`
        ).join('\n');
        await ctx.editReply({
          embeds: [{
            color: 0xff6600,
            title: '❌ Invalid Model',
            description: 'Please specify a valid Claude model.',
            fields: [{
              name: 'Available Models',
              value: availableModels,
              inline: false
            }],
            timestamp: true
          }]
        });
        return;
      }
      
      updateSettings({ defaultModel: value });
      const modelInfo = CLAUDE_MODELS[value as keyof typeof CLAUDE_MODELS] || { name: value, description: 'Custom model', contextWindow: 200000, supportsThinking: false, recommended: false, tier: 'balanced' as const };
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Model Updated',
          description: `Default Claude model set to: **${modelInfo.name}**`,
          fields: [{
            name: 'Model Details',
            value: `${modelInfo.description}\nContext Window: ${modelInfo.contextWindow.toLocaleString()} tokens`,
            inline: false
          }],
          timestamp: true
        }]
      });
      break;
      
    case 'toggle-git-context':
      const newGitContext = !settings.autoIncludeGitContext;
      updateSettings({ autoIncludeGitContext: newGitContext });
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Git Context Updated',
          description: `Auto-include Git context: **${newGitContext ? 'Enabled' : 'Disabled'}**`,
          timestamp: true
        }]
      });
      break;
      
    case 'toggle-system-info':
      const newSystemInfo = !settings.autoIncludeSystemInfo;
      updateSettings({ autoIncludeSystemInfo: newSystemInfo });
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ System Info Updated',
          description: `Auto-include System Info: **${newSystemInfo ? 'Enabled' : 'Disabled'}**`,
          timestamp: true
        }]
      });
      break;
      
    case 'set-system-prompt':
      if (!value) {
        updateSettings({ defaultSystemPrompt: null });
        await ctx.editReply({
          embeds: [{
            color: 0x00ff00,
            title: '✅ System Prompt Cleared',
            description: 'Default system prompt has been removed',
            timestamp: true
          }]
        });
      } else {
        updateSettings({ defaultSystemPrompt: value });
        await ctx.editReply({
          embeds: [{
            color: 0x00ff00,
            title: '✅ System Prompt Set',
            description: `System prompt updated:\n\`${value.substring(0, 200)}${value.length > 200 ? '...' : ''}\``,
            timestamp: true
          }]
        });
      }
      break;
      
    default:
      await ctx.editReply({
        content: `Unknown Claude action: ${action}. Available: set-model, toggle-git-context, toggle-system-info, set-system-prompt`,
        ephemeral: true
      });
  }
}

// Todo management functions
async function listTodos(ctx: any) {
  await ensurePersistence();
  
  if (todos.length === 0) {
    await ctx.editReply({
      embeds: [{
        color: 0xffaa00,
        title: '📝 No Todos Found',
        description: 'No todos found. Use `/todos action:add content:[todo]` to create your first todo.',
        timestamp: true
      }]
    });
    return;
  }

  const activeTodos = todos.filter(t => !t.completed);
  const completedTodos = todos.filter(t => t.completed);
  
  const activeList = activeTodos.length > 0 ? 
    activeTodos.slice(0, 10).map(todo => 
      `• **${todo.priority.toUpperCase()}**: ${todo.content.substring(0, 100)}${todo.content.length > 100 ? '...' : ''} (\`${todo.id.substring(0, 8)}\`)`
    ).join('\n') : 'No active todos';
    
  const fields = [{
    name: `📋 Active Todos (${activeTodos.length})`,
    value: activeList,
    inline: false
  }];
  
  if (completedTodos.length > 0) {
    const recentCompleted = completedTodos.slice(-5).map(todo => 
      `• ~~${todo.content.substring(0, 80)}~~`
    ).join('\n');
    
    fields.push({
      name: `✅ Recently Completed (${completedTodos.length} total)`,
      value: recentCompleted,
      inline: false
    });
  }

  await ctx.editReply({
    embeds: [{
      color: 0x0099ff,
      title: '📝 Development Todos',
      fields,
      footer: {
        text: '💾 Persisted to disk | Use /todos action:complete content:[todo_id] to mark as complete'
      },
      timestamp: true
    }]
  });
}

async function addTodo(ctx: any, content: string, priority: 'low' | 'medium' | 'high' | 'critical' = 'medium', rateTier?: string) {
  await ensurePersistence();
  
  const todo: TodoItem = {
    id: generateTodoId(),
    content,
    priority,
    completed: false,
    createdAt: new Date(),
    estimatedTokens: estimateTokens(content),
    rateLimitTier: rateTier
  };
  
  todos.push(todo);
  await saveTodos(); // Persist changes
  
  const priorityColors = {
    low: 0x808080,
    medium: 0x0099ff,
    high: 0xff9900,
    critical: 0xff0000
  };

  await ctx.editReply({
    embeds: [{
      color: priorityColors[priority],
      title: '✅ Todo Added',
      fields: [
        { name: 'Content', value: content, inline: false },
        { name: 'Priority', value: priority.toUpperCase(), inline: true },
        { name: 'ID', value: `\`${todo.id.substring(0, 8)}\``, inline: true },
        { name: 'Estimated Tokens', value: todo.estimatedTokens.toString(), inline: true }
      ],
      footer: { text: '💾 Saved to disk' },
      timestamp: true
    }]
  });
}

async function completeTodo(ctx: any, todoId: string) {
  await ensurePersistence();
  
  const todo = todos.find(t => t.id.startsWith(todoId) && !t.completed);
  
  if (!todo) {
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: '❌ Todo Not Found',
        description: `No active todo found with ID starting with: ${todoId}`,
        timestamp: true
      }]
    });
    return;
  }
  
  todo.completed = true;
  todo.completedAt = new Date();
  await saveTodos(); // Persist changes
  
  await ctx.editReply({
    embeds: [{
      color: 0x00ff00,
      title: '✅ Todo Completed',
      fields: [
        { name: 'Completed Todo', value: todo.content, inline: false },
        { name: 'Priority', value: todo.priority.toUpperCase(), inline: true },
        { name: 'Duration', value: formatDuration(Date.now() - todo.createdAt.getTime()), inline: true }
      ],
      footer: { text: '💾 Saved to disk' },
      timestamp: true
    }]
  });
}

async function showRateStatus(ctx: any, rateTier?: string) {
  const tier = rateTier || 'basic';
  const limits = ANTHROPIC_RATE_LIMITS[tier];
  
  if (!limits) {
    await ctx.editReply({
      content: 'Invalid rate tier specified.',
      ephemeral: true
    });
    return;
  }
  
  // Get real usage data from tracker
  const { getUsageSummary, getTodayUsage } = await import("../util/usage-tracker.ts");
  const summary = await getUsageSummary();
  const todayUsage = await getTodayUsage();
  
  // Calculate usage from real data
  const totalCost = todayUsage.statistics.totalCost;
  const totalRequests = todayUsage.statistics.totalRequests;
  
  // Estimate token usage from cost (rough estimate: $0.003 per 1K input, $0.015 per 1K output)
  // Average ~$0.01 per 1K tokens combined
  const estimatedTokens = Math.round(totalCost * 100000);
  const usagePercentage = Math.min((estimatedTokens / limits.tokensPerDay) * 100, 100);
  
  const statusColor = usagePercentage > 80 ? 0xff0000 : usagePercentage > 60 ? 0xff9900 : 0x00ff00;
  
  await ctx.editReply({
    embeds: [{
      color: statusColor,
      title: '📊 API Rate Limit Status',
      fields: [
        { name: 'Current Tier', value: limits.name, inline: true },
        { name: "Today's Cost", value: summary.today.cost, inline: true },
        { name: "Today's Requests", value: totalRequests.toString(), inline: true },
        { name: 'Estimated Tokens', value: `${estimatedTokens.toLocaleString()} / ${limits.tokensPerDay.toLocaleString()}`, inline: true },
        { name: 'Usage %', value: `${usagePercentage.toFixed(1)}%`, inline: true },
        { name: 'Avg Response Time', value: summary.today.avgDuration, inline: true },
        { name: 'All-Time Cost', value: summary.allTime.cost, inline: true },
        { name: 'All-Time Requests', value: summary.allTime.requests.toString(), inline: true },
        { name: 'Top Model', value: summary.allTime.topModel, inline: true },
        { name: 'Tier Description', value: limits.description, inline: false }
      ],
      footer: { text: '💾 Real usage data from API tracker' },
      timestamp: true
    }]
  });
}

// MCP management functions (reads from .claude/mcp.json)
async function listMCPServers(ctx: any, workDir: string) {
  const config = await readMCPJsonConfig(workDir);
  const serverNames = Object.keys(config.mcpServers);
  
  if (serverNames.length === 0) {
    await ctx.editReply({
      embeds: [{
        color: 0xffaa00,
        title: '🔌 No MCP Servers',
        description: `No MCP servers configured in \`.claude/mcp.json\`.\n\nUse \`/mcp action:add\` to add your first server.`,
        footer: { text: `📁 ${path.join(workDir, MCP_JSON_FILENAME)}` },
        timestamp: true
      }]
    });
    return;
  }
  
  // Build server list with nice formatting
  const fields = serverNames.map(name => {
    const server = config.mcpServers[name];
    const command = server.args?.length 
      ? `\`${server.command} ${server.args.join(' ')}\``
      : `\`${server.command}\``;
    
    let details = command;
    if (server.description) {
      details = `${server.description}\n${command}`;
    }
    if (server.env && Object.keys(server.env).length > 0) {
      const envVars = Object.keys(server.env).join(', ');
      details += `\n🔑 Env: \`${envVars}\``;
    }
    
    return {
      name: `🔌 ${name}`,
      value: details,
      inline: false
    };
  });
  
  await ctx.editReply({
    embeds: [{
      color: 0x0099ff,
      title: '🔌 MCP Servers',
      description: `Found **${serverNames.length}** server(s) configured in \`.claude/mcp.json\``,
      fields: fields.slice(0, 25), // Discord limit
      footer: {
        text: `📁 ${path.join(workDir, MCP_JSON_FILENAME)}`
      },
      timestamp: true
    }]
  });
}

async function addMCPServer(ctx: any, workDir: string, name: string, commandOrUrl: string, description?: string) {
  const config = await readMCPJsonConfig(workDir);
  
  // Check if server name already exists
  if (config.mcpServers[name]) {
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: '❌ Server Exists',
        description: `MCP server with name "${name}" already exists in \`.claude/mcp.json\`.`,
        timestamp: true
      }]
    });
    return;
  }
  
  // Parse command - support "npx -y @package" format
  const parts = commandOrUrl.trim().split(/\s+/);
  const command = parts[0];
  const args = parts.slice(1);
  
  // Create the new server entry
  const serverEntry: MCPJsonServerEntry = {
    command,
    ...(args.length > 0 && { args }),
    ...(description && { description })
  };
  
  // Add to config
  config.mcpServers[name] = serverEntry;
  
  // Save to .claude/mcp.json
  const saved = await writeMCPJsonConfig(workDir, config);
  
  if (!saved) {
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: '❌ Save Failed',
        description: `Failed to save server to \`.claude/mcp.json\`. Check file permissions.`,
        timestamp: true
      }]
    });
    return;
  }
  
  const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
  
  await ctx.editReply({
    embeds: [{
      color: 0x00ff00,
      title: '✅ MCP Server Added',
      fields: [
        { name: 'Server Name', value: name, inline: true },
        { name: 'Command', value: `\`${fullCommand}\``, inline: false },
        ...(description ? [{ name: 'Description', value: description, inline: false }] : [])
      ],
      footer: {
        text: `📁 Saved to ${MCP_JSON_FILENAME}`
      },
      timestamp: true
    }]
  });
}

// Utility functions
function generateTodoId(): string {
  return `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

// Output settings management
async function handleOutputSettings(ctx: any, settings: UnifiedBotSettings, updateSettings: any, action?: string, value?: string) {
  if (!action) {
    await ctx.editReply({
      embeds: [{
        color: 0x0099ff,
        title: '🎨 Output Settings',
        description: 'Available actions: `toggle-highlighting`, `set-max-length`, `set-timestamp`',
        fields: [{
          name: 'Current Settings',
          value: `Code Highlighting: ${settings.codeHighlighting ? 'On' : 'Off'}\nAuto-Page Long Output: ${settings.autoPageLongOutput ? 'On' : 'Off'}\nMax Output Length: ${settings.maxOutputLength} chars\nTimestamp Format: ${settings.timestampFormat}`,
          inline: false
        }],
        timestamp: true
      }]
    });
    return;
  }

  switch (action) {
    case 'toggle-highlighting':
      const newHighlighting = !settings.codeHighlighting;
      updateSettings({ codeHighlighting: newHighlighting });
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Code Highlighting Updated',
          description: `Code highlighting: **${newHighlighting ? 'Enabled' : 'Disabled'}**`,
          timestamp: true
        }]
      });
      break;

    case 'toggle-paging':
      const newPaging = !settings.autoPageLongOutput;
      updateSettings({ autoPageLongOutput: newPaging });
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Auto-Paging Updated',
          description: `Auto-page long output: **${newPaging ? 'Enabled' : 'Disabled'}**`,
          timestamp: true
        }]
      });
      break;

    case 'set-max-length':
      if (!value) {
        await ctx.editReply({
          content: 'Please specify max length (500-10000). Usage: `/settings category:output action:set-max-length value:[number]`',
          ephemeral: true
        });
        return;
      }
      const maxLen = parseInt(value, 10);
      if (isNaN(maxLen) || maxLen < 500 || maxLen > 10000) {
        await ctx.editReply({
          content: 'Max length must be between 500 and 10000 characters.',
          ephemeral: true
        });
        return;
      }
      updateSettings({ maxOutputLength: maxLen });
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Max Output Length Updated',
          description: `Max output length set to: **${maxLen}** characters`,
          timestamp: true
        }]
      });
      break;

    case 'set-timestamp':
      if (!value || !['relative', 'absolute', 'both'].includes(value)) {
        await ctx.editReply({
          content: 'Please specify timestamp format: `relative`, `absolute`, or `both`',
          ephemeral: true
        });
        return;
      }
      updateSettings({ timestampFormat: value as 'relative' | 'absolute' | 'both' });
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Timestamp Format Updated',
          description: `Timestamp format set to: **${value}**`,
          timestamp: true
        }]
      });
      break;

    default:
      await ctx.editReply({
        content: `Unknown output action: ${action}. Available: toggle-highlighting, toggle-paging, set-max-length, set-timestamp`,
        ephemeral: true
      });
  }
}

// Proxy settings management
async function handleProxySettings(ctx: any, settings: UnifiedBotSettings, updateSettings: any, action?: string, value?: string) {
  if (!action) {
    await ctx.editReply({
      embeds: [{
        color: 0x0099ff,
        title: '🌐 Proxy Settings',
        description: 'Available actions: `enable`, `disable`, `set-url`, `add-bypass`, `remove-bypass`, `list-bypass`',
        fields: [{
          name: 'Current Settings',
          value: `Proxy: ${settings.proxyEnabled ? 'Enabled' : 'Disabled'}\nProxy URL: ${settings.proxyUrl || 'Not set'}\nBypass Domains: ${settings.noProxyDomains.length > 0 ? settings.noProxyDomains.join(', ') : 'None'}`,
          inline: false
        }],
        timestamp: true
      }]
    });
    return;
  }

  switch (action) {
    case 'enable':
      if (!settings.proxyUrl) {
        await ctx.editReply({
          content: 'Please set a proxy URL first with `/settings category:proxy action:set-url value:[url]`',
          ephemeral: true
        });
        return;
      }
      updateSettings({ proxyEnabled: true });
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Proxy Enabled',
          description: `Proxy enabled using: ${settings.proxyUrl}`,
          timestamp: true
        }]
      });
      break;

    case 'disable':
      updateSettings({ proxyEnabled: false });
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Proxy Disabled',
          description: 'Proxy has been disabled',
          timestamp: true
        }]
      });
      break;

    case 'set-url':
      if (!value) {
        await ctx.editReply({
          content: 'Please provide a proxy URL. Example: `http://proxy.example.com:8080`',
          ephemeral: true
        });
        return;
      }
      try {
        new URL(value);
        updateSettings({ proxyUrl: value });
        await ctx.editReply({
          embeds: [{
            color: 0x00ff00,
            title: '✅ Proxy URL Set',
            description: `Proxy URL set to: ${value}`,
            timestamp: true
          }]
        });
      } catch {
        await ctx.editReply({
          content: 'Invalid URL format. Please provide a valid proxy URL.',
          ephemeral: true
        });
      }
      break;

    case 'add-bypass':
      if (!value) {
        await ctx.editReply({
          content: 'Please provide a domain to bypass. Example: `localhost` or `*.internal.com`',
          ephemeral: true
        });
        return;
      }
      if (settings.noProxyDomains.includes(value)) {
        await ctx.editReply({
          content: `Domain "${value}" is already in the bypass list.`,
          ephemeral: true
        });
        return;
      }
      updateSettings({ noProxyDomains: [...settings.noProxyDomains, value] });
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Bypass Domain Added',
          description: `Added "${value}" to proxy bypass list`,
          timestamp: true
        }]
      });
      break;

    case 'remove-bypass':
      if (!value) {
        await ctx.editReply({
          content: 'Please specify which domain to remove from bypass list.',
          ephemeral: true
        });
        return;
      }
      if (!settings.noProxyDomains.includes(value)) {
        await ctx.editReply({
          content: `Domain "${value}" is not in the bypass list.`,
          ephemeral: true
        });
        return;
      }
      updateSettings({ noProxyDomains: settings.noProxyDomains.filter(d => d !== value) });
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Bypass Domain Removed',
          description: `Removed "${value}" from proxy bypass list`,
          timestamp: true
        }]
      });
      break;

    case 'list-bypass':
      await ctx.editReply({
        embeds: [{
          color: 0x0099ff,
          title: '🌐 Proxy Bypass Domains',
          description: settings.noProxyDomains.length > 0 
            ? settings.noProxyDomains.map(d => `• ${d}`).join('\n')
            : 'No bypass domains configured',
          timestamp: true
        }]
      });
      break;

    default:
      await ctx.editReply({
        content: `Unknown proxy action: ${action}. Available: enable, disable, set-url, add-bypass, remove-bypass, list-bypass`,
        ephemeral: true
      });
  }
}

// Developer settings management
async function handleDeveloperSettings(ctx: any, settings: UnifiedBotSettings, updateSettings: any, action?: string, value?: string) {
  if (!action) {
    await ctx.editReply({
      embeds: [{
        color: 0x0099ff,
        title: '🔧 Developer Settings',
        description: 'Available actions: `toggle-debug`, `toggle-verbose`, `toggle-metrics`, `show-debug`',
        fields: [{
          name: 'Current Settings',
          value: `Debug Mode: ${settings.enableDebugMode ? 'On' : 'Off'}\nVerbose Errors: ${settings.verboseErrorReporting ? 'On' : 'Off'}\nPerformance Metrics: ${settings.enablePerformanceMetrics ? 'On' : 'Off'}`,
          inline: false
        }],
        timestamp: true
      }]
    });
    return;
  }

  switch (action) {
    case 'toggle-debug':
      const newDebug = !settings.enableDebugMode;
      updateSettings({ enableDebugMode: newDebug });
      await ctx.editReply({
        embeds: [{
          color: newDebug ? 0xff9900 : 0x00ff00,
          title: newDebug ? '🔧 Debug Mode Enabled' : '✅ Debug Mode Disabled',
          description: newDebug 
            ? '⚠️ Debug mode is now **enabled**. Additional logging will be shown.'
            : 'Debug mode has been disabled.',
          timestamp: true
        }]
      });
      break;

    case 'toggle-verbose':
      const newVerbose = !settings.verboseErrorReporting;
      updateSettings({ verboseErrorReporting: newVerbose });
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Verbose Error Reporting Updated',
          description: `Verbose error reporting: **${newVerbose ? 'Enabled' : 'Disabled'}**`,
          timestamp: true
        }]
      });
      break;

    case 'toggle-metrics':
      const newMetrics = !settings.enablePerformanceMetrics;
      updateSettings({ enablePerformanceMetrics: newMetrics });
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Performance Metrics Updated',
          description: `Performance metrics: **${newMetrics ? 'Enabled' : 'Disabled'}**`,
          timestamp: true
        }]
      });
      break;

    case 'show-debug':
      const debugInfo = {
        denoVersion: Deno.version.deno,
        v8Version: Deno.version.v8,
        typescriptVersion: Deno.version.typescript,
        platform: Deno.build.os,
        arch: Deno.build.arch,
        memory: Deno.memoryUsage(),
        pid: Deno.pid,
        uptime: Math.floor(performance.now() / 1000)
      };
      await ctx.editReply({
        embeds: [{
          color: 0x0099ff,
          title: '🔧 Debug Information',
          fields: [
            { name: 'Deno Version', value: debugInfo.denoVersion, inline: true },
            { name: 'V8 Version', value: debugInfo.v8Version, inline: true },
            { name: 'TypeScript', value: debugInfo.typescriptVersion, inline: true },
            { name: 'Platform', value: `${debugInfo.platform} (${debugInfo.arch})`, inline: true },
            { name: 'PID', value: debugInfo.pid.toString(), inline: true },
            { name: 'Uptime', value: `${debugInfo.uptime}s`, inline: true },
            { name: 'Memory Usage', value: `RSS: ${(debugInfo.memory.rss / 1024 / 1024).toFixed(2)} MB\nHeap: ${(debugInfo.memory.heapUsed / 1024 / 1024).toFixed(2)} / ${(debugInfo.memory.heapTotal / 1024 / 1024).toFixed(2)} MB`, inline: false }
          ],
          timestamp: true
        }]
      });
      break;

    default:
      await ctx.editReply({
        content: `Unknown developer action: ${action}. Available: toggle-debug, toggle-verbose, toggle-metrics, show-debug`,
        ephemeral: true
      });
  }
}

// Reset settings to defaults
async function handleResetSettings(ctx: any, settings: UnifiedBotSettings, updateSettings: any, action?: string) {
  if (!action) {
    await ctx.editReply({
      embeds: [{
        color: 0xff6600,
        title: '⚠️ Reset Settings',
        description: 'Available actions: `all`, `bot`, `claude`, `modes`, `output`, `proxy`, `developer`\n\n**Warning:** This will reset settings to their default values.',
        fields: [{
          name: 'Usage',
          value: '`/settings category:reset action:[category]`\n\nExample: `/settings category:reset action:all` to reset everything',
          inline: false
        }],
        timestamp: true
      }]
    });
    return;
  }

  const defaultSettings = { ...UNIFIED_DEFAULT_SETTINGS };

  switch (action) {
    case 'all':
      updateSettings(defaultSettings);
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ All Settings Reset',
          description: 'All settings have been reset to their default values.',
          timestamp: true
        }]
      });
      break;

    case 'bot':
      updateSettings({
        mentionEnabled: defaultSettings.mentionEnabled,
        mentionUserId: defaultSettings.mentionUserId
      });
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Bot Settings Reset',
          description: 'Bot settings have been reset to defaults.',
          timestamp: true
        }]
      });
      break;

    case 'claude':
      updateSettings({
        defaultModel: defaultSettings.defaultModel,
        defaultSystemPrompt: defaultSettings.defaultSystemPrompt,
        autoIncludeSystemInfo: defaultSettings.autoIncludeSystemInfo,
        autoIncludeGitContext: defaultSettings.autoIncludeGitContext
      });
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Claude Settings Reset',
          description: 'Claude settings have been reset to defaults.',
          timestamp: true
        }]
      });
      break;

    case 'modes':
      updateSettings({
        thinkingMode: defaultSettings.thinkingMode,
        operationMode: defaultSettings.operationMode,
        effortLevel: defaultSettings.effortLevel,
        maxBudgetUsd: defaultSettings.maxBudgetUsd,
        enable1MContext: defaultSettings.enable1MContext,
        enableFileCheckpointing: defaultSettings.enableFileCheckpointing,
        enableSandbox: defaultSettings.enableSandbox
      });
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Mode Settings Reset',
          description: 'Mode settings have been reset to defaults.',
          timestamp: true
        }]
      });
      break;

    case 'output':
      updateSettings({
        codeHighlighting: defaultSettings.codeHighlighting,
        autoPageLongOutput: defaultSettings.autoPageLongOutput,
        maxOutputLength: defaultSettings.maxOutputLength,
        timestampFormat: defaultSettings.timestampFormat
      });
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Output Settings Reset',
          description: 'Output settings have been reset to defaults.',
          timestamp: true
        }]
      });
      break;

    case 'proxy':
      updateSettings({
        proxyEnabled: defaultSettings.proxyEnabled,
        proxyUrl: defaultSettings.proxyUrl,
        noProxyDomains: defaultSettings.noProxyDomains
      });
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Proxy Settings Reset',
          description: 'Proxy settings have been reset to defaults.',
          timestamp: true
        }]
      });
      break;

    case 'developer':
      updateSettings({
        enableDebugMode: defaultSettings.enableDebugMode,
        verboseErrorReporting: defaultSettings.verboseErrorReporting,
        enablePerformanceMetrics: defaultSettings.enablePerformanceMetrics
      });
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Developer Settings Reset',
          description: 'Developer settings have been reset to defaults.',
          timestamp: true
        }]
      });
      break;

    default:
      await ctx.editReply({
        content: `Unknown reset target: ${action}. Available: all, bot, claude, modes, output, proxy, developer`,
        ephemeral: true
      });
  }
}

// Generate todos from code comments (TODO, FIXME, etc.)
async function generateTodosFromCode(ctx: any, filePath: string, rateTier?: string) {
  await ensurePersistence();
  
  try {
    // Read the file content
    const content = await Deno.readTextFile(filePath);
    const lines = content.split('\n');
    
    // Regex patterns for common todo markers
    const todoPatterns = [
      /\/\/\s*(TODO|FIXME|HACK|XXX|BUG|NOTE):\s*(.+)/i,
      /\/\*\s*(TODO|FIXME|HACK|XXX|BUG|NOTE):\s*(.+)\*\//i,
      /#\s*(TODO|FIXME|HACK|XXX|BUG|NOTE):\s*(.+)/i
    ];

    const foundTodos: { type: string; content: string; line: number }[] = [];

    lines.forEach((line: string, index: number) => {
      for (const pattern of todoPatterns) {
        const match = line.match(pattern);
        if (match) {
          foundTodos.push({
            type: match[1].toUpperCase(),
            content: match[2].trim(),
            line: index + 1
          });
          break;
        }
      }
    });

    if (foundTodos.length === 0) {
      await ctx.editReply({
        embeds: [{
          color: 0xffaa00,
          title: '📝 No Todos Found',
          description: `No TODO, FIXME, HACK, XXX, BUG, or NOTE comments found in the file.`,
          fields: [{
            name: 'File Scanned',
            value: filePath,
            inline: false
          }],
          timestamp: true
        }]
      });
      return;
    }

    // Create todo items from found comments
    const priorityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      'NOTE': 'low',
      'TODO': 'medium',
      'HACK': 'medium',
      'XXX': 'high',
      'FIXME': 'high',
      'BUG': 'critical'
    };

    let addedCount = 0;
    for (const found of foundTodos) {
      const todoId = crypto.randomUUID().substring(0, 8);
      const newTodo: TodoItem = {
        id: todoId,
        content: `[${found.type}] Line ${found.line}: ${found.content}`,
        priority: priorityMap[found.type] || 'medium',
        completed: false,
        createdAt: new Date(),
        estimatedTokens: Math.ceil(found.content.length / 4) // Rough estimate
      };
      todos.push(newTodo);
      addedCount++;
    }
    
    await saveTodos(); // Persist changes

    const summary = foundTodos.slice(0, 5).map(t => 
      `• **${t.type}** (L${t.line}): ${t.content.substring(0, 60)}${t.content.length > 60 ? '...' : ''}`
    ).join('\n');

    await ctx.editReply({
      embeds: [{
        color: 0x00ff00,
        title: '✅ Todos Generated',
        description: `Found and added **${addedCount}** todos from code comments.`,
        fields: [
          { name: 'File Scanned', value: filePath, inline: false },
          { name: 'Preview (First 5)', value: summary || 'None', inline: false }
        ],
        footer: { text: '💾 Saved to disk' },
        timestamp: true
      }]
    });
  } catch (error) {
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: '❌ Error Reading File',
        description: error instanceof Error ? error.message : 'Failed to read file',
        timestamp: true
      }]
    });
  }
}

// Prioritize todos by urgency
async function prioritizeTodos(ctx: any, rateTier?: string) {
  if (todos.length === 0) {
    await ctx.editReply({
      embeds: [{
        color: 0xffaa00,
        title: '📝 No Todos to Prioritize',
        description: 'No todos found. Add some todos first.',
        timestamp: true
      }]
    });
    return;
  }

  // Sort by priority (critical > high > medium > low) then by creation date
  const priorityOrder: Record<string, number> = {
    'critical': 0,
    'high': 1,
    'medium': 2,
    'low': 3
  };

  const activeTodos = todos.filter(t => !t.completed);
  activeTodos.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  // Update the todos array with sorted order
  const completedTodos = todos.filter(t => t.completed);
  todos.length = 0;
  todos.push(...activeTodos, ...completedTodos);

  const preview = activeTodos.slice(0, 10).map((t, i) => 
    `${i + 1}. **${t.priority.toUpperCase()}**: ${t.content.substring(0, 50)}${t.content.length > 50 ? '...' : ''}`
  ).join('\n');

  await ctx.editReply({
    embeds: [{
      color: 0x00ff00,
      title: '✅ Todos Prioritized',
      description: `Sorted **${activeTodos.length}** active todos by priority and age.`,
      fields: [{
        name: 'Top 10 Priorities',
        value: preview || 'None',
        inline: false
      }],
      timestamp: true
    }]
  });
}

// Remove an MCP server configuration (from .claude/mcp.json)
async function removeMCPServer(ctx: any, workDir: string, serverName: string) {
  const config = await readMCPJsonConfig(workDir);
  const serverNames = Object.keys(config.mcpServers);
  
  // Case-insensitive search for the server
  const matchingName = serverNames.find(n => n.toLowerCase() === serverName.toLowerCase());
  
  if (!matchingName) {
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: '❌ Server Not Found',
        description: `No MCP server found with name: "${serverName}"`,
        fields: [{
          name: 'Available Servers',
          value: serverNames.length > 0 
            ? serverNames.map(s => `• ${s}`).join('\n')
            : 'No servers configured',
          inline: false
        }],
        timestamp: true
      }]
    });
    return;
  }

  const removedServer = config.mcpServers[matchingName];
  delete config.mcpServers[matchingName];
  
  const saved = await writeMCPJsonConfig(workDir, config);
  
  if (!saved) {
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: '❌ Save Failed',
        description: `Failed to save changes to \`.claude/mcp.json\`.`,
        timestamp: true
      }]
    });
    return;
  }

  const fullCommand = removedServer.args?.length 
    ? `${removedServer.command} ${removedServer.args.join(' ')}`
    : removedServer.command;

  await ctx.editReply({
    embeds: [{
      color: 0x00ff00,
      title: '✅ MCP Server Removed',
      description: `Successfully removed MCP server: **${matchingName}**`,
      fields: [
        { name: 'Command', value: `\`${fullCommand}\``, inline: false },
        ...(removedServer.description ? [{ name: 'Description', value: removedServer.description, inline: false }] : [])
      ],
      footer: { text: `📁 Changes saved to ${MCP_JSON_FILENAME}` },
      timestamp: true
    }]
  });
}

// Test MCP server connection (from .claude/mcp.json)
async function testMCPConnection(ctx: any, workDir: string, serverName: string) {
  const config = await readMCPJsonConfig(workDir);
  const serverNames = Object.keys(config.mcpServers);
  
  // Case-insensitive search for the server
  const matchingName = serverNames.find(n => n.toLowerCase() === serverName.toLowerCase());
  
  if (!matchingName) {
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: '❌ Server Not Found',
        description: `No MCP server found with name: "${serverName}"`,
        timestamp: true
      }]
    });
    return;
  }

  const server = config.mcpServers[matchingName];
  let testSuccess = false;
  let testMessage = '';

  try {
    // For MCP servers, we test by checking if the command exists
    // Most MCP servers use npx which should be available
    if (server.command === 'npx' || server.command === 'npm' || server.command === 'node') {
      // Check if npx/npm/node is available
      const cmd = new Deno.Command(server.command, {
        args: ['--version'],
        stdout: 'piped',
        stderr: 'piped'
      });
      const { code } = await cmd.output();
      testSuccess = code === 0;
      testMessage = testSuccess 
        ? `\`${server.command}\` is available and can run MCP servers`
        : `\`${server.command}\` command failed`;
    } else {
      // For other commands, check if they exist in PATH
      // Use 'where' on Windows, 'which' on Unix-like systems
      const isWindows = Deno.build.os === 'windows';
      const whichCmd = isWindows ? 'where' : 'which';
      const cmd = new Deno.Command(whichCmd, {
        args: [server.command],
        stdout: 'piped',
        stderr: 'piped'
      });
      const { code } = await cmd.output();
      testSuccess = code === 0;
      testMessage = testSuccess
        ? `Command \`${server.command}\` found in PATH`
        : `Command \`${server.command}\` not found in PATH`;
    }
  } catch (err) {
    testMessage = err instanceof Error ? err.message : 'Test failed';
  }

  const fullCommand = server.args?.length 
    ? `${server.command} ${server.args.join(' ')}`
    : server.command;

  await ctx.editReply({
    embeds: [{
      color: testSuccess ? 0x00ff00 : 0xff0000,
      title: testSuccess ? '✅ Command Available' : '❌ Command Not Found',
      description: testMessage,
      fields: [
        { name: 'Server', value: matchingName, inline: true },
        { name: 'Command', value: `\`${fullCommand}\``, inline: false },
        ...(server.description ? [{ name: 'Description', value: server.description, inline: false }] : []),
        ...(server.env ? [{ name: 'Environment', value: Object.keys(server.env).map(k => `\`${k}\``).join(', '), inline: false }] : [])
      ],
      footer: { text: 'Note: This only tests if the command is available, not the MCP server itself' },
      timestamp: true
    }]
  });
}

// Show MCP server status overview (from .claude/mcp.json)
async function showMCPStatus(ctx: any, workDir: string) {
  const config = await readMCPJsonConfig(workDir);
  const serverNames = Object.keys(config.mcpServers);
  
  if (serverNames.length === 0) {
    await ctx.editReply({
      embeds: [{
        color: 0xffaa00,
        title: '📊 MCP Status',
        description: `No MCP servers configured in \`.claude/mcp.json\`.\n\nUse \`/mcp action:add server_name:[name] command:[command]\` to add a server.`,
        footer: { text: `📁 ${path.join(workDir, MCP_JSON_FILENAME)}` },
        timestamp: true
      }]
    });
    return;
  }

  // Build detailed status view
  const fields = serverNames.map(name => {
    const server = config.mcpServers[name];
    const fullCommand = server.args?.length 
      ? `${server.command} ${server.args.join(' ')}`
      : server.command;
    
    let info = `💻 \`${fullCommand}\``;
    if (server.description) {
      info = `${server.description}\n${info}`;
    }
    if (server.env && Object.keys(server.env).length > 0) {
      const envKeys = Object.keys(server.env);
      info += `\n🔑 ${envKeys.length} env var(s): \`${envKeys.join('\`, \`')}\``;
    }
    
    return {
      name: `🔌 ${name}`,
      value: info,
      inline: false
    };
  });

  // Count servers with env vars
  const withEnvCount = serverNames.filter(name => {
    const server = config.mcpServers[name];
    return server.env && Object.keys(server.env).length > 0;
  }).length;

  await ctx.editReply({
    embeds: [{
      color: 0x00ff00,
      title: '📊 MCP Server Status',
      description: `**${serverNames.length}** MCP server(s) configured`,
      fields: [
        ...fields.slice(0, 20), // Discord field limit
        { name: '📊 Summary', value: `Total: ${serverNames.length} | With Env Vars: ${withEnvCount}`, inline: false }
      ],
      footer: { text: `📁 ${path.join(workDir, MCP_JSON_FILENAME)}` },
      timestamp: true
    }]
  });
}
