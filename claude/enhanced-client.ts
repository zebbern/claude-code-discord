import { sendToClaudeCode, type ClaudeModelOptions, type SDKPermissionMode, type ThinkingConfig, type EffortLevel, type SDKAgentDefinition, type SDKModelInfo } from "./client.ts";
import type { ClaudeMessage } from "./types.ts";
import { recordAPIUsage } from "../util/usage-tracker.ts";
import { startModelRefresh, stopModelRefresh, fetchModels } from "./model-fetcher.ts";

// Enhanced Claude Code client with additional features
// Maps user-facing settings to actual Claude Agent SDK parameters
export interface EnhancedClaudeOptions {
  workDir: string;
  model?: string;
  systemPrompt?: string;
  contextFiles?: string[];
  includeGitContext?: boolean;
  includeSystemInfo?: boolean;
  /** SDK permissionMode — controls what Claude can do */
  permissionMode?: SDKPermissionMode;
  /** Native thinking configuration (adaptive/enabled/disabled) */
  thinking?: ThinkingConfig;
  /** Effort level — controls reasoning depth */
  effort?: EffortLevel;
  /** Maximum budget in USD */
  maxBudgetUsd?: number;
  /** Extra env vars for proxy or other settings */
  extraEnv?: Record<string, string>;
  /** Native SDK agent name for the main thread */
  agent?: string;
  /** Custom subagent definitions */
  agents?: Record<string, SDKAgentDefinition>;
}

export interface ClaudeSession {
  id: string;
  startTime: Date;
  lastActivity: Date;
  messageCount: number;
  totalCost: number;
  model: string;
  workDir: string;
}

// Session manager for Claude Code
export class ClaudeSessionManager {
  private sessions = new Map<string, ClaudeSession>();

  createSession(workDir: string, model?: string): ClaudeSession {
    const session: ClaudeSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime: new Date(),
      lastActivity: new Date(),
      messageCount: 0,
      totalCost: 0,
      model: model || 'claude-3-5-sonnet-20241022',
      workDir
    };

    this.sessions.set(session.id, session);
    return session;
  }

  getSession(sessionId: string): ClaudeSession | undefined {
    return this.sessions.get(sessionId);
  }

  updateSession(sessionId: string, cost?: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      session.messageCount++;
      if (cost) {
        session.totalCost += cost;
      }
    }
  }

  getAllSessions(): ClaudeSession[] {
    return Array.from(this.sessions.values());
  }

  getActiveSessions(maxAge: number = 3600000): ClaudeSession[] { // 1 hour default
    const cutoff = Date.now() - maxAge;
    return Array.from(this.sessions.values()).filter(
      session => session.lastActivity.getTime() > cutoff
    );
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  cleanup(maxAge: number = 24 * 3600000): number { // 24 hours default
    const cutoff = Date.now() - maxAge;
    let deleted = 0;
    
    for (const [id, session] of this.sessions.entries()) {
      if (session.lastActivity.getTime() < cutoff) {
        this.sessions.delete(id);
        deleted++;
      }
    }
    
    return deleted;
  }
}

// Enhanced Claude Code client with additional context
export async function enhancedClaudeQuery(
  prompt: string,
  options: EnhancedClaudeOptions,
  controller: AbortController,
  sessionId?: string,
  onChunk?: (text: string) => void,
  onStreamJson?: (json: any) => void,
  continueMode?: boolean
) {
  let enhancedPrompt = prompt;

  // System prompt is passed via SDK's appendSystemPrompt option (not inline in prompt)
  // This ensures proper handling by Claude Code CLI

  // Add system context if requested
  if (options.includeSystemInfo) {
    const systemInfo = await getSystemContext(options.workDir);
    enhancedPrompt = `${systemInfo}\n\n${enhancedPrompt}`;
  }

  // Add Git context if requested
  if (options.includeGitContext) {
    const gitInfo = await getGitContext(options.workDir);
    if (gitInfo) {
      enhancedPrompt = `${gitInfo}\n\n${enhancedPrompt}`;
    }
  }

  // Add context from specific files if provided
  if (options.contextFiles && options.contextFiles.length > 0) {
    const fileContext = await getFileContext(options.contextFiles);
    if (fileContext) {
      enhancedPrompt = `${fileContext}\n\n${enhancedPrompt}`;
    }
  }

  // Build model options — pass through all SDK-relevant settings
  const modelOptions: ClaudeModelOptions = {};
  if (options.model) {
    modelOptions.model = options.model;
    console.log(`Enhanced Claude: Using model ${options.model}`);
  }
  if (options.permissionMode) {
    modelOptions.permissionMode = options.permissionMode;
  }
  if (options.thinking) {
    modelOptions.thinking = options.thinking;
  }
  if (options.effort) {
    modelOptions.effort = options.effort;
  }
  if (options.maxBudgetUsd) {
    modelOptions.maxBudgetUsd = options.maxBudgetUsd;
  }
  if (options.extraEnv) {
    modelOptions.extraEnv = options.extraEnv;
  }
  // Native SDK agent support
  if (options.agent) {
    modelOptions.agent = options.agent;
  }
  if (options.agents) {
    modelOptions.agents = options.agents;
  }
  // System prompt: skip appendSystemPrompt when using native agent (SDK handles it via AgentDefinition.prompt)
  if (options.systemPrompt && !options.agent) {
    modelOptions.appendSystemPrompt = options.systemPrompt;
  }

  const result = await sendToClaudeCode(
    options.workDir,
    enhancedPrompt,
    controller,
    sessionId,
    onChunk,
    onStreamJson,
    continueMode,
    modelOptions
  );
  
  // Record API usage for tracking
  await recordAPIUsage(
    result.modelUsed || options.model || 'default',
    result.cost,
    result.duration,
    'enhanced',
    result.sessionId
  );
  
  return result;
}

// Get system context for Claude
async function getSystemContext(workDir: string): Promise<string> {
  try {
    const [osInfo, nodeInfo, denoInfo] = await Promise.all([
      getOSInfo(),
      getNodeInfo(),
      getDenoInfo()
    ]);

    return `<system-context>
Working Directory: ${workDir}
${osInfo}
${nodeInfo}
${denoInfo}
Current Time: ${new Date().toISOString()}
</system-context>`;
  } catch (error) {
    return `<system-context>
Working Directory: ${workDir}
System Info: Unable to gather (${error instanceof Error ? error.message : 'Unknown error'})
Current Time: ${new Date().toISOString()}
</system-context>`;
  }
}

// Get Git repository context
async function getGitContext(workDir: string): Promise<string | null> {
  try {
    const { executeGitCommand } = await import("../git/handler.ts");
    
    const [status, branch, remotes, recentCommits] = await Promise.all([
      executeGitCommand(workDir, "git status --porcelain"),
      executeGitCommand(workDir, "git branch --show-current"),
      executeGitCommand(workDir, "git remote -v"),
      executeGitCommand(workDir, "git log --oneline -5")
    ]);

    return `<git-context>
Current Branch: ${branch.trim()}
Status: ${status || 'Clean working directory'}
Remotes: ${remotes || 'No remotes'}
Recent Commits:
${recentCommits || 'No commits'}
</git-context>`;
  } catch (error) {
    return null;
  }
}

// Get file context
async function getFileContext(filePaths: string[]): Promise<string | null> {
  try {
    const fileContents: string[] = [];

    for (const filePath of filePaths) {
      try {
        const content = await Deno.readTextFile(filePath);
        const truncatedContent = content.length > 2000 
          ? content.substring(0, 2000) + '\n... (truncated)'
          : content;
        
        fileContents.push(`<file path="${filePath}">
${truncatedContent}
</file>`);
      } catch (error) {
        fileContents.push(`<file path="${filePath}">
Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}
</file>`);
      }
    }

    return `<file-context>
${fileContents.join('\n')}
</file-context>`;
  } catch (error) {
    return null;
  }
}

// System information helpers
async function getOSInfo(): Promise<string> {
  try {
    const os = Deno.build.os;
    const arch = Deno.build.arch;
    return `OS: ${os} (${arch})`;
  } catch {
    return 'OS: Unknown';
  }
}

async function getNodeInfo(): Promise<string> {
  try {
    const process = new Deno.Command("node", {
      args: ["--version"],
      stdout: "piped",
      stderr: "piped"
    });
    
    const { stdout } = await process.output();
    const version = new TextDecoder().decode(stdout).trim();
    return `Node.js: ${version}`;
  } catch {
    return 'Node.js: Not available';
  }
}

async function getDenoInfo(): Promise<string> {
  try {
    return `Deno: ${Deno.version.deno}`;
  } catch {
    return 'Deno: Unknown version';
  }
}

// Model information interface
export interface ModelInfo {
  name: string;
  description: string;
  contextWindow: number;
  recommended: boolean;
  supportsThinking: boolean;
  tier: 'flagship' | 'balanced' | 'fast' | 'legacy';
  aliasFor?: string;
  thinkingMode?: boolean;
  deprecated?: boolean;
}

// Claude Code model options - Dynamic-friendly with aliases
// Aliases (opus, sonnet, haiku) auto-resolve to the latest version via Claude CLI
// Users can also specify full model names to pin a specific version
// This object is updated dynamically at runtime when ANTHROPIC_API_KEY is set
export let CLAUDE_MODELS: Record<string, ModelInfo> = {
  // === Aliases (always resolve to latest via CLI) ===
  'opus': {
    name: 'Claude Opus (Latest)',
    description: 'Most powerful model — auto-resolves to latest Opus via CLI alias',
    contextWindow: 200000,
    recommended: true,
    supportsThinking: true,
    tier: 'flagship',
    aliasFor: 'claude-opus-4-5-20251101'
  },
  'sonnet': {
    name: 'Claude Sonnet (Latest)',
    description: 'High-performance model — auto-resolves to latest Sonnet via CLI alias',
    contextWindow: 200000,
    recommended: true,
    supportsThinking: true,
    tier: 'balanced',
    aliasFor: 'claude-sonnet-4-5-20250929'
  },
  'haiku': {
    name: 'Claude Haiku (Latest)',
    description: 'Fast model for quick tasks — auto-resolves to latest Haiku via CLI alias',
    contextWindow: 200000,
    recommended: true,
    supportsThinking: false,
    tier: 'fast',
    aliasFor: 'claude-haiku-4-5-20251001'
  },

  // === Opus Family (Flagship) ===
  'claude-opus-4-5-20251101': {
    name: 'Claude Opus 4.5',
    description: 'Latest flagship model — superior agentic coding, long task sustenance, self-debugging',
    contextWindow: 200000,
    recommended: true,
    supportsThinking: true,
    tier: 'flagship'
  },
  'claude-opus-4-1-20250805': {
    name: 'Claude Opus 4.1',
    description: 'Previous Opus — strong agentic coding and reasoning',
    contextWindow: 200000,
    recommended: false,
    supportsThinking: true,
    tier: 'flagship'
  },
  'claude-opus-4-20250514': {
    name: 'Claude Opus 4',
    description: 'First Opus 4 release — powerful reasoning and coding',
    contextWindow: 200000,
    recommended: false,
    supportsThinking: true,
    tier: 'flagship'
  },

  // === Sonnet Family (Balanced) ===
  'claude-sonnet-4-5-20250929': {
    name: 'Claude Sonnet 4.5',
    description: 'Latest Sonnet — excellent reasoning with balanced speed/cost',
    contextWindow: 200000,
    recommended: true,
    supportsThinking: true,
    tier: 'balanced'
  },
  'claude-sonnet-4-20250514': {
    name: 'Claude Sonnet 4',
    description: 'Previous Sonnet — high-performance reasoning',
    contextWindow: 200000,
    recommended: false,
    supportsThinking: true,
    tier: 'balanced'
  },

  // === Haiku Family (Fast) ===
  'claude-haiku-4-5-20251001': {
    name: 'Claude Haiku 4.5',
    description: 'Latest Haiku — fast and efficient for quick tasks',
    contextWindow: 200000,
    recommended: false,
    supportsThinking: false,
    tier: 'fast'
  },

  // === Legacy Models ===
  'claude-3-5-sonnet-20241022': {
    name: 'Claude 3.5 Sonnet',
    description: 'Previous generation — still capable, lower cost',
    contextWindow: 200000,
    recommended: false,
    supportsThinking: false,
    tier: 'legacy',
    deprecated: true
  },
  'claude-3-5-haiku-20241022': {
    name: 'Claude 3.5 Haiku',
    description: 'Previous generation fast model',
    contextWindow: 200000,
    recommended: false,
    supportsThinking: false,
    tier: 'fast',
    deprecated: true
  },
  'claude-3-opus-20240229': {
    name: 'Claude 3 Opus',
    description: 'Legacy Opus — deprecated, use "opus" alias instead',
    contextWindow: 200000,
    recommended: false,
    supportsThinking: false,
    tier: 'legacy',
    deprecated: true
  }
};

// Resolve model alias to full model ID
// If the input is an alias, returns the resolved ID; otherwise returns the input unchanged
export function resolveModelId(modelInput: string): string {
  const model = CLAUDE_MODELS[modelInput];
  if (model?.aliasFor) {
    return model.aliasFor;
  }
  return modelInput;
}

// Check if a model string is valid (known or custom)
// Always returns true for custom model strings — let the CLI validate them
export function isValidModel(modelInput: string): boolean {
  // Known models are always valid
  if (modelInput in CLAUDE_MODELS) return true;
  // Accept any string that looks like a Claude model ID
  if (modelInput.startsWith('claude-')) return true;
  // Accept known alias patterns
  if (['opus', 'sonnet', 'haiku'].includes(modelInput.toLowerCase())) return true;
  // Accept any custom string — the CLI will validate
  return true;
}

/**
 * Initialize dynamic model fetching.
 * Call once at startup. If ANTHROPIC_API_KEY is set, fetches models
 * from the Anthropic API and refreshes every hour.
 * Falls back to the hardcoded defaults above if unavailable.
 */
export function initModels(): void {
  startModelRefresh((newModels) => {
    CLAUDE_MODELS = newModels;
    console.log(`[Models] Dynamically updated to ${Object.keys(CLAUDE_MODELS).length} models from Anthropic API`);
  });
}

/**
 * Force an immediate model refresh (useful for /claude-models command).
 * Returns the current models record.
 */
export async function refreshModels(): Promise<Record<string, ModelInfo>> {
  const fetched = await fetchModels();
  if (fetched) {
    CLAUDE_MODELS = fetched;
  }
  return CLAUDE_MODELS;
}

/**
 * Update models from SDK's supportedModels() response.
 * Merges SDK model info with our richer ModelInfo structure.
 * Call after first successful query to get definitive model list.
 */
export function updateModelsFromSDK(sdkModels: SDKModelInfo[]): void {
  if (!sdkModels || sdkModels.length === 0) return;

  let updated = 0;
  for (const sdkModel of sdkModels) {
    const id = sdkModel.value;
    if (!id) continue;

    // Update existing entry with SDK display name/description
    if (CLAUDE_MODELS[id]) {
      CLAUDE_MODELS[id].name = sdkModel.displayName || CLAUDE_MODELS[id].name;
      if (sdkModel.description) {
        CLAUDE_MODELS[id].description = sdkModel.description;
      }
      updated++;
    } else {
      // Add new model discovered via SDK
      const tier = id.includes('opus') ? 'flagship' as const
        : id.includes('haiku') ? 'fast' as const
        : id.includes('sonnet') ? 'balanced' as const
        : 'balanced' as const;

      CLAUDE_MODELS[id] = {
        name: sdkModel.displayName || id,
        description: sdkModel.description || `${sdkModel.displayName || id} (discovered via SDK)`,
        contextWindow: 200_000,
        recommended: false,
        supportsThinking: id.includes('opus') || (id.includes('sonnet') && !id.startsWith('claude-3-5-')),
        tier,
        deprecated: id.startsWith('claude-3-') && !id.startsWith('claude-3-5-'),
      };
      updated++;
    }
  }

  if (updated > 0) {
    console.log(`[Models] Merged ${updated} models from SDK supportedModels()`);
  }
}

// Quick prompt templates for common tasks
export const CLAUDE_TEMPLATES = {
  debug: "Please help me debug this issue. Analyze the error and provide a solution:",
  explain: "Please explain this code in detail, including what it does and how it works:",
  optimize: "Please review this code and suggest optimizations for performance and readability:",
  test: "Please write comprehensive tests for this code, including edge cases:",
  refactor: "Please refactor this code to improve maintainability and follow best practices:",
  document: "Please add comprehensive documentation to this code including JSDoc comments:",
  security: "Please review this code for security vulnerabilities and suggest fixes:",
  convert: "Please convert this code to TypeScript with proper types and interfaces:"
};