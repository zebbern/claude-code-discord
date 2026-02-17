// Agent command implementation
import { SlashCommandBuilder } from "npm:discord.js@14.14.1";
import { 
  getAgentSessionsManager,
  type AgentSessionData 
} from "../util/persistence.ts";
import type { ClaudeModelOptions } from "../claude/index.ts";

// Agent types and interfaces
// NOTE: Temperature and maxTokens are NOT supported by Claude Code CLI
// These agents use model and systemPrompt (which ARE supported)
export interface AgentConfig {
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  capabilities: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface AgentSession {
  id: string;
  agentName: string;
  startTime: Date;
  messageCount: number;
  totalCost: number;
  lastActivity: Date;
  status: 'active' | 'paused' | 'completed' | 'error';
}

// Predefined agent configurations
// NOTE: These agents use model and systemPrompt which ARE supported by Claude Code CLI
export const PREDEFINED_AGENTS: Record<string, AgentConfig> = {
  'code-reviewer': {
    name: 'Code Reviewer',
    description: 'Specialized in code review and quality analysis',
    model: 'sonnet',
    systemPrompt: 'You are an expert code reviewer. Focus on code quality, security, performance, and best practices. Provide detailed feedback with specific suggestions for improvement.',
    capabilities: ['code-review', 'security-analysis', 'performance-optimization'],
    riskLevel: 'low'
  },
  'architect': {
    name: 'Software Architect',
    description: 'Focused on system design and architecture decisions',
    model: 'sonnet',
    systemPrompt: 'You are a senior software architect. Help design scalable, maintainable systems. Focus on architectural patterns, design principles, and technology choices.',
    capabilities: ['system-design', 'architecture-review', 'technology-selection'],
    riskLevel: 'low'
  },
  'debugger': {
    name: 'Debug Specialist',
    description: 'Expert at finding and fixing bugs',
    model: 'sonnet',
    systemPrompt: 'You are a debugging expert. Help identify root causes of issues, suggest debugging strategies, and provide step-by-step solutions.',
    capabilities: ['bug-analysis', 'debugging', 'troubleshooting'],
    riskLevel: 'medium'
  },
  'security-expert': {
    name: 'Security Analyst',
    description: 'Specialized in security analysis and vulnerability assessment',
    model: 'sonnet',
    systemPrompt: 'You are a cybersecurity expert. Focus on identifying security vulnerabilities, suggesting secure coding practices, and analyzing potential threats.',
    capabilities: ['security-analysis', 'vulnerability-assessment', 'threat-modeling'],
    riskLevel: 'medium'
  },
  'performance-optimizer': {
    name: 'Performance Engineer',
    description: 'Expert in performance optimization and profiling',
    model: 'sonnet',
    systemPrompt: 'You are a performance optimization expert. Help identify bottlenecks, suggest optimizations, and improve system performance.',
    capabilities: ['performance-analysis', 'optimization', 'profiling'],
    riskLevel: 'medium'
  },
  'devops-engineer': {
    name: 'DevOps Engineer',
    description: 'Specialized in deployment, CI/CD, and infrastructure',
    model: 'sonnet',
    systemPrompt: 'You are a DevOps engineer. Help with deployment strategies, CI/CD pipelines, infrastructure as code, and operational best practices.',
    capabilities: ['deployment', 'ci-cd', 'infrastructure', 'monitoring'],
    riskLevel: 'high'
  },
  'general-assistant': {
    name: 'General Development Assistant',
    description: 'General-purpose development assistant',
    model: 'sonnet',
    systemPrompt: 'You are a helpful development assistant. Provide clear, accurate, and practical help with programming tasks, answer questions, and offer suggestions.',
    capabilities: ['general-help', 'coding', 'explanation', 'guidance'],
    riskLevel: 'low'
  }
};

// Agent command definition
export const agentCommand = new SlashCommandBuilder()
  .setName('agent')
  .setDescription('Interact with specialized AI agents for different development tasks')
  .addStringOption(option =>
    option.setName('action')
      .setDescription('Agent action to perform')
      .setRequired(true)
      .addChoices(
        { name: 'List Agents', value: 'list' },
        { name: 'Start Session', value: 'start' },
        { name: 'Chat with Agent', value: 'chat' },
        { name: 'Switch Agent', value: 'switch' },
        { name: 'Agent Status', value: 'status' },
        { name: 'End Session', value: 'end' },
        { name: 'Agent Info', value: 'info' }
      ))
  .addStringOption(option =>
    option.setName('agent_name')
      .setDescription('Name of the agent to interact with')
      .setRequired(false)
      .addChoices(
        ...Object.entries(PREDEFINED_AGENTS).map(([key, agent]) => ({
          name: agent.name,
          value: key
        }))
      ))
  .addStringOption(option =>
    option.setName('message')
      .setDescription('Message to send to the agent')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('context_files')
      .setDescription('Comma-separated list of files to include in context')
      .setRequired(false))
  .addBooleanOption(option =>
    option.setName('include_system_info')
      .setDescription('Include system information in context')
      .setRequired(false));

export interface AgentHandlerDeps {
  workDir: string;
  crashHandler: any;
  sendClaudeMessages: (messages: any[]) => Promise<void>;
  sessionManager: any;
  getQueryOptions?: () => ClaudeModelOptions;
}

// Persistence manager for agent sessions
const agentSessionsManager = getAgentSessionsManager();

// In-memory cache backed by persistence
let agentSessions: AgentSession[] = [];
let currentUserAgent: Record<string, string> = {}; // userId -> agentName
let persistenceInitialized = false;

// Initialize persistence and load data
async function ensureAgentPersistence(): Promise<void> {
  if (persistenceInitialized) return;
  
  try {
    const savedSessions = await agentSessionsManager.load([]);
    agentSessions = savedSessions.map(s => ({
      id: s.id,
      agentName: s.agentType,
      startTime: new Date(s.startTime),
      messageCount: s.messageCount,
      totalCost: 0,
      lastActivity: new Date(s.lastActivity),
      status: 'active' as const
    }));
    
    // Rebuild currentUserAgent from active sessions
    // Note: This is a simplification - in production you'd store user->agent mapping too
    
    persistenceInitialized = true;
    console.log(`Agent Persistence: Loaded ${agentSessions.length} sessions`);
  } catch (error) {
    console.error('Agent Persistence: Failed to initialize:', error);
    persistenceInitialized = true;
  }
}

// Save agent sessions to persistence
async function saveAgentSessions(): Promise<void> {
  const persistenceSessions: AgentSessionData[] = agentSessions.map(s => ({
    id: s.id,
    agentType: s.agentName,
    startTime: s.startTime.toISOString(),
    lastActivity: s.lastActivity.toISOString(),
    messageCount: s.messageCount,
    context: undefined
  }));
  await agentSessionsManager.save(persistenceSessions);
}

export function createAgentHandlers(deps: AgentHandlerDeps) {
  const { workDir, crashHandler, sendClaudeMessages, sessionManager } = deps;

  return {
    async onAgent(
      ctx: any,
      action: string,
      agentName?: string,
      message?: string,
      contextFiles?: string,
      includeSystemInfo?: boolean
    ) {
      try {
        await ctx.deferReply();

        switch (action) {
          case 'list':
            await listAgents(ctx);
            break;
            
          case 'start':
            if (!agentName) {
              await ctx.editReply({
                content: 'Agent name is required for starting a session.',
                ephemeral: true
              });
              return;
            }
            await startAgentSession(ctx, agentName);
            break;
            
          case 'chat':
            if (!message) {
              await ctx.editReply({
                content: 'Message is required for chatting with agent.',
                ephemeral: true
              });
              return;
            }
            await chatWithAgent(ctx, message, agentName, contextFiles, includeSystemInfo, deps);
            break;
            
          case 'switch':
            if (!agentName) {
              await ctx.editReply({
                content: 'Agent name is required for switching agents.',
                ephemeral: true
              });
              return;
            }
            await switchAgent(ctx, agentName);
            break;
            
          case 'status':
            await showAgentStatus(ctx);
            break;
            
          case 'end':
            await endAgentSession(ctx);
            break;
            
          case 'info':
            if (!agentName) {
              await ctx.editReply({
                content: 'Agent name is required for showing agent info.',
                ephemeral: true
              });
              return;
            }
            await showAgentInfo(ctx, agentName);
            break;
            
          default:
            await ctx.editReply({
              embeds: [{
                color: 0xff0000,
                title: '❌ Invalid Action',
                description: `Unknown agent action: ${action}`,
                timestamp: true
              }]
            });
        }
      } catch (error) {
        await crashHandler.reportCrash('agent', error instanceof Error ? error : new Error(String(error)), 'agent-command');
        throw error;
      }
    }
  };
}

// Helper functions for agent management
async function listAgents(ctx: any) {
  const agentList = Object.entries(PREDEFINED_AGENTS).map(([key, agent]) => {
    const riskEmoji = agent.riskLevel === 'high' ? '🔴' : agent.riskLevel === 'medium' ? '🟡' : '🟢';
    return `${riskEmoji} **${agent.name}** (\`${key}\`)\n   ${agent.description}\n   Capabilities: ${agent.capabilities.join(', ')}`;
  }).join('\n\n');

  await ctx.editReply({
    embeds: [{
      color: 0x0099ff,
      title: '🤖 Available AI Agents',
      description: agentList,
      fields: [{
        name: 'Risk Levels',
        value: '🟢 Low Risk • 🟡 Medium Risk • 🔴 High Risk',
        inline: false
      }],
      footer: {
        text: 'Use /agent action:start agent_name:[name] to begin a session'
      },
      timestamp: true
    }]
  });
}

async function startAgentSession(ctx: any, agentName: string) {
  await ensureAgentPersistence();
  
  const agent = PREDEFINED_AGENTS[agentName];
  if (!agent) {
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: '❌ Agent Not Found',
        description: `No agent found with name: ${agentName}`,
        timestamp: true
      }]
    });
    return;
  }

  const userId = ctx.user.id;
  currentUserAgent[userId] = agentName;

  const session: AgentSession = {
    id: generateSessionId(),
    agentName,
    startTime: new Date(),
    messageCount: 0,
    totalCost: 0,
    lastActivity: new Date(),
    status: 'active'
  };

  agentSessions.push(session);
  await saveAgentSessions(); // Persist changes

  const riskColor = agent.riskLevel === 'high' ? 0xff6600 : agent.riskLevel === 'medium' ? 0xffaa00 : 0x00ff00;

  await ctx.editReply({
    embeds: [{
      color: riskColor,
      title: '🚀 Agent Session Started',
      fields: [
        { name: 'Agent', value: agent.name, inline: true },
        { name: 'Risk Level', value: agent.riskLevel.toUpperCase(), inline: true },
        { name: 'Session ID', value: `\`${session.id.substring(0, 12)}\``, inline: true },
        { name: 'Description', value: agent.description, inline: false },
        { name: 'Capabilities', value: agent.capabilities.join(', '), inline: false },
        { name: 'Usage', value: 'Use `/agent action:chat message:[your message]` to chat with this agent', inline: false }
      ],
      footer: { text: '💾 Session saved to disk' },
      timestamp: true
    }]
  });
}

async function chatWithAgent(
  ctx: any,
  message: string,
  agentName?: string,
  contextFiles?: string,
  includeSystemInfo?: boolean,
  deps?: AgentHandlerDeps
) {
  await ensureAgentPersistence();
  
  const userId = ctx.user.id;
  const activeAgentName = agentName || currentUserAgent[userId];

  if (!activeAgentName) {
    await ctx.editReply({
      embeds: [{
        color: 0xff6600,
        title: '⚠️ No Active Agent',
        description: 'No agent session active. Use `/agent action:start agent_name:[name]` to start one.',
        timestamp: true
      }]
    });
    return;
  }

  const agent = PREDEFINED_AGENTS[activeAgentName];
  if (!agent) {
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: '❌ Agent Not Found',
        description: `Agent ${activeAgentName} is not available.`,
        timestamp: true
      }]
    });
    return;
  }

  // Build the enhanced prompt with agent's system prompt
  let enhancedPrompt = `${agent.systemPrompt}\n\nUser Query: ${message}`;

  // Add context if requested
  if (includeSystemInfo) {
    const systemInfo = `System: ${Deno.build.os} ${Deno.build.arch}\nWorking Directory: ${deps?.workDir}`;
    enhancedPrompt += `\n\nSystem Context:\n${systemInfo}`;
  }

  if (contextFiles) {
    enhancedPrompt += `\n\nRelevant Files: ${contextFiles}`;
  }

  await ctx.editReply({
    embeds: [{
      color: 0xffff00,
      title: `🤖 ${agent.name} Processing...`,
      description: 'Agent is analyzing your request...',
      fields: [
        { name: 'Agent', value: agent.name, inline: true },
        { name: 'Model', value: agent.model, inline: true },
        { name: 'Risk Level', value: agent.riskLevel, inline: true },
        { name: 'Message Preview', value: `\`${message.substring(0, 200)}${message.length > 200 ? '...' : ''}\``, inline: false }
      ],
      timestamp: true
    }]
  });

  // Call Claude Code with agent-specific configuration
  try {
    const { enhancedClaudeQuery } = await import("../claude/enhanced-client.ts");
    const { convertToClaudeMessages } = await import("../claude/message-converter.ts");
    
    const controller = new AbortController();
    const startTime = Date.now();
    
    // Parse context files if provided
    const contextFilesList = contextFiles ? 
      contextFiles.split(',').map(f => f.trim()).filter(f => f.length > 0) : 
      undefined;

    // Merge runtime settings (permissionMode, thinkingBudget, proxy, etc.)
    const runtimeOpts = deps?.getQueryOptions?.() || {};

    const result = await enhancedClaudeQuery(
      enhancedPrompt,
      {
        workDir: deps?.workDir || Deno.cwd(),
        model: agent.model,
        systemPrompt: agent.systemPrompt,
        includeSystemInfo: !!includeSystemInfo,
        includeGitContext: false,
        contextFiles: contextFilesList,
        ...runtimeOpts,
      },
      controller,
      undefined, // sessionId
      undefined, // messages
      async (jsonData) => {
        // Stream responses to Discord
        const claudeMessages = convertToClaudeMessages(jsonData);
        if (claudeMessages.length > 0 && deps?.sendClaudeMessages) {
          await deps.sendClaudeMessages(claudeMessages);
        }
      },
      false // allowToolUse
    );

    const duration = Date.now() - startTime;
    
    // Update agent session stats
    const session = agentSessions.find(s => 
      s.agentName === activeAgentName && s.status === 'active'
    );
    if (session) {
      session.messageCount++;
      session.totalCost += result.cost || 0;
      session.lastActivity = new Date();
      await saveAgentSessions(); // Persist session updates
    }

    await ctx.editReply({
      embeds: [{
        color: 0x00ff00,
        title: `🤖 ${agent.name} - Task Complete`,
        description: 'Agent has finished processing your request.',
        fields: [
          { name: 'Status', value: 'Completed ✅', inline: true },
          { name: 'Duration', value: `${(duration / 1000).toFixed(1)}s`, inline: true },
          { name: 'Cost', value: result.cost ? `$${result.cost.toFixed(4)}` : 'N/A', inline: true },
          { name: 'Model Used', value: result.modelUsed || agent.model, inline: true },
          { name: 'Session', value: result.sessionId ? `\`${result.sessionId.substring(0, 12)}\`` : 'N/A', inline: true }
        ],
        footer: { text: '💾 Session stats saved' },
        timestamp: true
      }]
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: `❌ ${agent.name} - Error`,
        description: 'An error occurred while processing your request.',
        fields: [
          { name: 'Error', value: errorMessage.substring(0, 1000), inline: false },
          { name: 'Agent', value: agent.name, inline: true },
          { name: 'Risk Level', value: agent.riskLevel.toUpperCase(), inline: true }
        ],
        timestamp: true
      }]
    });

    // Report to crash handler if available
    if (deps?.crashHandler) {
      await deps.crashHandler.reportCrash(
        'agent',
        error instanceof Error ? error : new Error(errorMessage),
        `agent-${activeAgentName}`
      );
    }
  }
}

async function showAgentStatus(ctx: any) {
  await ensureAgentPersistence();
  
  const userId = ctx.user.id;
  const activeAgent = currentUserAgent[userId];
  const activeSessions = agentSessions.filter(s => s.status === 'active');

  await ctx.editReply({
    embeds: [{
      color: 0x0099ff,
      title: '📊 Agent Status',
      fields: [
        {
          name: 'Current Agent',
          value: activeAgent ? PREDEFINED_AGENTS[activeAgent]?.name || 'Unknown' : 'None',
          inline: true
        },
        {
          name: 'Active Sessions',
          value: activeSessions.length.toString(),
          inline: true
        },
        {
          name: 'Total Agents',
          value: Object.keys(PREDEFINED_AGENTS).length.toString(),
          inline: true
        }
      ],
      footer: { text: '💾 Sessions persisted to disk' },
      timestamp: true
    }]
  });
}

async function showAgentInfo(ctx: any, agentName: string) {
  const agent = PREDEFINED_AGENTS[agentName];
  if (!agent) {
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: '❌ Agent Not Found',
        description: `No agent found with name: ${agentName}`,
        timestamp: true
      }]
    });
    return;
  }

  const riskColor = agent.riskLevel === 'high' ? 0xff6600 : agent.riskLevel === 'medium' ? 0xffaa00 : 0x00ff00;

  await ctx.editReply({
    embeds: [{
      color: riskColor,
      title: `🤖 ${agent.name}`,
      description: agent.description,
      fields: [
        { name: 'Model', value: agent.model, inline: true },
        { name: 'Risk Level', value: agent.riskLevel.toUpperCase(), inline: true },
        { name: 'Capabilities', value: agent.capabilities.join(', '), inline: false },
        { name: 'System Prompt Preview', value: `\`${agent.systemPrompt.substring(0, 200)}...\``, inline: false }
      ],
      timestamp: true
    }]
  });
}

async function switchAgent(ctx: any, agentName: string) {
  const agent = PREDEFINED_AGENTS[agentName];
  if (!agent) {
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: '❌ Agent Not Found',
        description: `No agent found with name: ${agentName}`,
        timestamp: true
      }]
    });
    return;
  }

  const userId = ctx.user.id;
  const previousAgent = currentUserAgent[userId];
  currentUserAgent[userId] = agentName;

  await ctx.editReply({
    embeds: [{
      color: 0x00ff00,
      title: '🔄 Agent Switched',
      fields: [
        { name: 'Previous Agent', value: previousAgent ? PREDEFINED_AGENTS[previousAgent]?.name || 'None' : 'None', inline: true },
        { name: 'New Agent', value: agent.name, inline: true },
        { name: 'Ready', value: 'Use `/agent action:chat` to start chatting', inline: false }
      ],
      timestamp: true
    }]
  });
}

async function endAgentSession(ctx: any) {
  await ensureAgentPersistence();
  
  const userId = ctx.user.id;
  const activeAgent = currentUserAgent[userId];

  if (!activeAgent) {
    await ctx.editReply({
      embeds: [{
        color: 0xffaa00,
        title: '⚠️ No Active Session',
        description: 'No active agent session to end.',
        timestamp: true
      }]
    });
    return;
  }

  delete currentUserAgent[userId];

  // Mark sessions as completed
  agentSessions.forEach(session => {
    if (session.agentName === activeAgent && session.status === 'active') {
      session.status = 'completed';
    }
  });
  
  await saveAgentSessions(); // Persist changes

  await ctx.editReply({
    embeds: [{
      color: 0x00ff00,
      title: '✅ Session Ended',
      description: `Agent session with ${PREDEFINED_AGENTS[activeAgent]?.name || activeAgent} has been ended.`,
      footer: { text: '💾 Session status saved to disk' },
      timestamp: true
    }]
  });
}

// Utility functions
function generateSessionId(): string {
  return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
