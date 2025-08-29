// Agent command implementation
import { SlashCommandBuilder } from "npm:discord.js@14.14.1";

// Agent types and interfaces
export interface AgentConfig {
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
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
export const PREDEFINED_AGENTS: Record<string, AgentConfig> = {
  'code-reviewer': {
    name: 'Code Reviewer',
    description: 'Specialized in code review and quality analysis',
    model: 'claude-sonnet-4',
    systemPrompt: 'You are an expert code reviewer. Focus on code quality, security, performance, and best practices. Provide detailed feedback with specific suggestions for improvement.',
    temperature: 0.3,
    maxTokens: 4096,
    capabilities: ['code-review', 'security-analysis', 'performance-optimization'],
    riskLevel: 'low'
  },
  'architect': {
    name: 'Software Architect',
    description: 'Focused on system design and architecture decisions',
    model: 'claude-sonnet-4',
    systemPrompt: 'You are a senior software architect. Help design scalable, maintainable systems. Focus on architectural patterns, design principles, and technology choices.',
    temperature: 0.5,
    maxTokens: 4096,
    capabilities: ['system-design', 'architecture-review', 'technology-selection'],
    riskLevel: 'low'
  },
  'debugger': {
    name: 'Debug Specialist',
    description: 'Expert at finding and fixing bugs',
    model: 'claude-sonnet-4',
    systemPrompt: 'You are a debugging expert. Help identify root causes of issues, suggest debugging strategies, and provide step-by-step solutions.',
    temperature: 0.2,
    maxTokens: 4096,
    capabilities: ['bug-analysis', 'debugging', 'troubleshooting'],
    riskLevel: 'medium'
  },
  'security-expert': {
    name: 'Security Analyst',
    description: 'Specialized in security analysis and vulnerability assessment',
    model: 'claude-sonnet-4',
    systemPrompt: 'You are a cybersecurity expert. Focus on identifying security vulnerabilities, suggesting secure coding practices, and analyzing potential threats.',
    temperature: 0.1,
    maxTokens: 4096,
    capabilities: ['security-analysis', 'vulnerability-assessment', 'threat-modeling'],
    riskLevel: 'medium'
  },
  'performance-optimizer': {
    name: 'Performance Engineer',
    description: 'Expert in performance optimization and profiling',
    model: 'claude-sonnet-4',
    systemPrompt: 'You are a performance optimization expert. Help identify bottlenecks, suggest optimizations, and improve system performance.',
    temperature: 0.3,
    maxTokens: 4096,
    capabilities: ['performance-analysis', 'optimization', 'profiling'],
    riskLevel: 'medium'
  },
  'devops-engineer': {
    name: 'DevOps Engineer',
    description: 'Specialized in deployment, CI/CD, and infrastructure',
    model: 'claude-sonnet-4',
    systemPrompt: 'You are a DevOps engineer. Help with deployment strategies, CI/CD pipelines, infrastructure as code, and operational best practices.',
    temperature: 0.4,
    maxTokens: 4096,
    capabilities: ['deployment', 'ci-cd', 'infrastructure', 'monitoring'],
    riskLevel: 'high'
  },
  'general-assistant': {
    name: 'General Development Assistant',
    description: 'General-purpose development assistant',
    model: 'claude-sonnet-4',
    systemPrompt: 'You are a helpful development assistant. Provide clear, accurate, and practical help with programming tasks, answer questions, and offer suggestions.',
    temperature: 0.7,
    maxTokens: 4096,
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
}

// In-memory storage for agent sessions (in production, would be persisted)
let agentSessions: AgentSession[] = [];
let currentUserAgent: Record<string, string> = {}; // userId -> agentName

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
        { name: 'Temperature', value: agent.temperature.toString(), inline: true },
        { name: 'Message Preview', value: `\`${message.substring(0, 200)}${message.length > 200 ? '...' : ''}\``, inline: false }
      ],
      timestamp: true
    }]
  });

  // Here would be the actual Claude API call with agent configuration
  // For now, we'll simulate the response
  setTimeout(async () => {
    await ctx.editReply({
      embeds: [{
        color: 0x00ff00,
        title: `🤖 ${agent.name} Response`,
        description: `[Agent would respond here using ${agent.model} with specialized prompting for ${agent.capabilities.join(', ')}]`,
        fields: [
          { name: 'Status', value: 'Completed ✅', inline: true },
          { name: 'Tokens Used', value: 'Est. 150 tokens', inline: true },
          { name: 'Note', value: 'This is a placeholder response. Full integration would call Claude with agent-specific configuration.', inline: false }
        ],
        timestamp: true
      }]
    });
  }, 2000);
}

async function showAgentStatus(ctx: any) {
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
        { name: 'Temperature', value: agent.temperature.toString(), inline: true },
        { name: 'Risk Level', value: agent.riskLevel.toUpperCase(), inline: true },
        { name: 'Max Tokens', value: agent.maxTokens.toString(), inline: true },
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

  await ctx.editReply({
    embeds: [{
      color: 0x00ff00,
      title: '✅ Session Ended',
      description: `Agent session with ${PREDEFINED_AGENTS[activeAgent]?.name || activeAgent} has been ended.`,
      timestamp: true
    }]
  });
}

// Utility functions
function generateSessionId(): string {
  return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
