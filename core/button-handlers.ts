/**
 * Button handlers for Discord bot interactions.
 * Extracts button handler logic from index.ts for better organization.
 * 
 * @module core/button-handlers
 */

import type { ButtonHandlers, InteractionContext } from "../discord/index.ts";
import type { MessageHistoryOps } from "./handler-registry.ts";
import type { AllHandlers } from "./handler-registry.ts";
import type { ClaudeMessage } from "../claude/index.ts";

// ================================
// Session Reader Utility
// ================================

interface RecentSession {
  id: string;
  prompt: string;
  timestamp: Date;
}

/**
 * Read recent sessions from ~/.claude/projects/<slug>/.
 * Claude Code stores session data as JSONL files — the filename is the session ID.
 */
async function readRecentSessions(workDir: string): Promise<RecentSession[]> {
  try {
    // Build project slug: absolute path with separators replaced
    const slug = workDir
      .replace(/^[A-Za-z]:/, (m) => m[0].toUpperCase())
      .replace(/[\\/]/g, '-')
      .replace(/^-/, '');
    
    const homeDir = Deno.env.get('USERPROFILE') || Deno.env.get('HOME') || '';
    const projectDir = `${homeDir}/.claude/projects/${slug}`;
    
    const entries: RecentSession[] = [];
    
    for await (const entry of Deno.readDir(projectDir)) {
      if (!entry.name.endsWith('.jsonl') || entry.isDirectory) continue;
      
      const sessionId = entry.name.replace('.jsonl', '');
      const filePath = `${projectDir}/${entry.name}`;
      const stat = await Deno.stat(filePath);
      
      // Read only the first few bytes to extract the prompt
      let prompt = '(unknown)';
      try {
        const file = await Deno.open(filePath);
        const buf = new Uint8Array(2048);
        const bytesRead = await file.read(buf);
        file.close();
        if (bytesRead && bytesRead > 0) {
          const text = new TextDecoder().decode(buf.subarray(0, bytesRead));
          const lines = text.split('\n');
          // Find the first user message line
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const obj = JSON.parse(line);
              if (obj.type === 'user' && obj.message?.content) {
                const content = obj.message.content;
                if (Array.isArray(content)) {
                  const textBlock = content.find((b: { type: string }) => b.type === 'text');
                  if (textBlock) prompt = textBlock.text;
                } else if (typeof content === 'string') {
                  prompt = content;
                }
                break;
              }
            } catch { /* skip malformed lines */ }
          }
        }
      } catch { /* skip unreadable files */ }
      
      entries.push({
        id: sessionId,
        prompt,
        timestamp: stat.mtime ?? new Date(0),
      });
    }
    
    // Sort by most recent first
    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return entries;
  } catch {
    return [];
  }
}

// ================================
// Types
// ================================

/**
 * Dependencies for button handler creation.
 */
export interface ButtonHandlerDeps {
  /** Message history operations */
  messageHistory: MessageHistoryOps;
  /** All handler modules */
  handlers: AllHandlers;
  /** Get current Claude session ID */
  getClaudeSessionId: () => string | undefined;
  /** Function to send Claude messages */
  sendClaudeMessages?: (messages: ClaudeMessage[]) => Promise<void>;
  /** Working directory */
  workDir: string;
}

/**
 * Expandable content storage (shared with claude handlers).
 */
export type ExpandableContentMap = Map<string, string>;

// ================================
// Button Handler Factory
// ================================

/**
 * Create all button handlers for Discord interactions.
 * 
 * @param deps - Button handler dependencies
 * @param expandableContent - Map for expandable content storage
 * @returns ButtonHandlers map
 */
export function createButtonHandlers(
  deps: ButtonHandlerDeps,
  expandableContent: ExpandableContentMap
): ButtonHandlers {
  const { messageHistory, handlers } = deps;
  const { addToHistory, getPreviousMessage, getNextMessage, getState } = messageHistory;
  const { claude: claudeHandlers, git: gitHandlers } = handlers;

  const buttonHandlers: ButtonHandlers = new Map([
    // Cancel Claude session (kept for programmatic use, no longer on completion buttons)
    ['cancel-claude', async (ctx: InteractionContext) => {
      const cancelled = claudeHandlers.onClaudeCancel(ctx);
      await ctx.update({
        embeds: [{
          color: cancelled ? 0xff0000 : 0x808080,
          title: cancelled ? 'Cancel Successful' : 'Cancel Failed',
          description: cancelled ? 'Claude Code session cancelled.' : 'No running Claude Code session.',
          timestamp: true
        }]
      });
    }],
    
    // Prompt history — replaces old "jump-previous"
    ['prompt-history', async (ctx: InteractionContext) => {
      const previousMessage = getPreviousMessage();
      
      if (!previousMessage) {
        await ctx.update({
          embeds: [{
            color: 0xffaa00,
            title: '📜 No Prompt History',
            description: 'No previous prompts found.',
            fields: [
              { name: 'Tip', value: 'Use `/claude` to send prompts — they\'ll appear here for reuse.', inline: false }
            ],
            timestamp: true
          }]
        });
        return;
      }
      
      const historyState = getState();
      const historyPosition = historyState.currentIndex + 1;
      const totalMessages = historyState.history.length;
      
      await ctx.update({
        embeds: [{
          color: 0x0099ff,
          title: `📜 Prompt History (${historyPosition}/${totalMessages})`,
          description: `\`\`\`\n${previousMessage}\n\`\`\``,
          timestamp: true
        }],
        components: [
          {
            type: 'actionRow',
            components: [
              { type: 'button', customId: 'history-previous', label: '⬅️ Older', style: 'secondary' },
              { type: 'button', customId: 'history-next', label: '➡️ Newer', style: 'secondary' },
              { type: 'button', customId: 'history-use', label: '▶️ Run This Prompt', style: 'primary' },
              { type: 'button', customId: 'history-close', label: '❌ Close', style: 'danger' }
            ]
          }
        ]
      });
    }],
    
    // Legacy alias — old messages may still have jump-previous buttons
    ['jump-previous', async (ctx: InteractionContext) => {
      // Delegate to prompt-history handler
      const handler = buttonHandlers.get('prompt-history');
      if (handler) await handler(ctx);
    }],
    
    // History navigation - older
    ['history-previous', async (ctx: InteractionContext) => {
      const olderMessage = getPreviousMessage();
      
      if (!olderMessage) {
        await ctx.update({
          embeds: [{
            color: 0xffaa00,
            title: '⬅️ No Older Prompts',
            description: 'You\'ve reached the beginning of your prompt history.',
            timestamp: true
          }],
          components: []
        });
        return;
      }
      
      const historyState = getState();
      const historyPosition = historyState.currentIndex + 1;
      const totalMessages = historyState.history.length;
      
      await ctx.update({
        embeds: [{
          color: 0x0099ff,
          title: `📜 Prompt History (${historyPosition}/${totalMessages})`,
          description: `\`\`\`\n${olderMessage}\n\`\`\``,
          timestamp: true
        }],
        components: [
          {
            type: 'actionRow',
            components: [
              { type: 'button', customId: 'history-previous', label: '⬅️ Older', style: 'secondary' },
              { type: 'button', customId: 'history-next', label: '➡️ Newer', style: 'secondary' },
              { type: 'button', customId: 'history-use', label: '▶️ Run This Prompt', style: 'primary' },
              { type: 'button', customId: 'history-close', label: '❌ Close', style: 'danger' }
            ]
          }
        ]
      });
    }],
    
    // History navigation - newer
    ['history-next', async (ctx: InteractionContext) => {
      const newerMessage = getNextMessage();
      
      if (!newerMessage) {
        await ctx.update({
          embeds: [{
            color: 0xffaa00,
            title: '➡️ No Newer Prompts',
            description: 'You\'ve reached the end of your prompt history.',
            timestamp: true
          }],
          components: []
        });
        return;
      }
      
      const historyState = getState();
      const historyPosition = historyState.currentIndex + 1;
      const totalMessages = historyState.history.length;
      
      await ctx.update({
        embeds: [{
          color: 0x0099ff,
          title: `📜 Prompt History (${historyPosition}/${totalMessages})`,
          description: `\`\`\`\n${newerMessage}\n\`\`\``,
          timestamp: true
        }],
        components: [
          {
            type: 'actionRow',
            components: [
              { type: 'button', customId: 'history-previous', label: '⬅️ Older', style: 'secondary' },
              { type: 'button', customId: 'history-next', label: '➡️ Newer', style: 'secondary' },
              { type: 'button', customId: 'history-use', label: '▶️ Run This Prompt', style: 'primary' },
              { type: 'button', customId: 'history-close', label: '❌ Close', style: 'danger' }
            ]
          }
        ]
      });
    }],
    
    // Use selected message from history
    ['history-use', async (ctx: InteractionContext) => {
      const historyState = getState();
      const currentMessage = historyState.history[historyState.currentIndex];
      if (!currentMessage) {
        await ctx.update({
          embeds: [{
            color: 0xff0000,
            title: '❌ No Prompt Selected',
            description: 'No prompt available to run.',
            timestamp: true
          }],
          components: []
        });
        return;
      }
      
      await ctx.update({
        embeds: [{
          color: 0x00ff00,
          title: '▶️ Running Prompt',
          description: `\`\`\`\n${currentMessage}\n\`\`\``,
          timestamp: true
        }],
        components: []
      });
      
      // Add the reused message to history again (as it's being sent again)
      addToHistory(currentMessage);
      // Execute the Claude command with the selected message
      await claudeHandlers.onClaude(ctx, currentMessage);
    }],
    
    // Close history view
    ['history-close', async (ctx: InteractionContext) => {
      await ctx.update({
        embeds: [{
          color: 0x808080,
          title: '✅ History Closed',
          description: 'Message history navigation closed.',
          timestamp: true
        }],
        components: []
      });
    }],
    
    // Collapse expanded content
    ['collapse-content', async (ctx: InteractionContext) => {
      await ctx.update({
        embeds: [{
          color: 0x808080,
          title: '🔼 Content Collapsed',
          description: 'Content has been collapsed. Use the expand button to view it again.',
          timestamp: true
        }],
        components: []
      });
    }],
    
    // Git status workflow button
    ['workflow:git-status', async (ctx: InteractionContext) => {
      await ctx.deferReply();
      try {
        const gitStatusInfo = await gitHandlers.getStatus();
        await ctx.editReply({
          embeds: [{
            color: 0x00ff00,
            title: '📊 Git Status',
            fields: [
              { name: 'Branch', value: gitStatusInfo.branch || 'Unknown', inline: true },
              { name: 'Status', value: `\`\`\`\n${gitStatusInfo.status || 'No changes'}\n\`\`\``, inline: false },
              { name: 'Remote', value: `\`\`\`\n${gitStatusInfo.remote || 'No remote'}\n\`\`\``, inline: false }
            ],
            timestamp: true
          }]
        });
      } catch (error) {
        await ctx.editReply({
          embeds: [{
            color: 0xff0000,
            title: '📊 Git Status Error',
            description: `Error: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: true
          }]
        });
      }
    }],

    // ================================
    // Startup Buttons
    // ================================

    // Continue last session (uses SDK's continue: true — picks up most recent conversation)
    ['startup:continue', async (ctx: InteractionContext) => {
      await ctx.deferReply();
      try {
        await claudeHandlers.onContinue(ctx, undefined);
      } catch (error) {
        await ctx.editReply({
          embeds: [{
            color: 0xff0000,
            title: '❌ Resume Failed',
            description: `${error instanceof Error ? error.message : String(error)}`,
            timestamp: true
          }]
        });
      }
    }],

    // Recent sessions — reads from ~/.claude/projects/ to show recent conversations
    ['startup:sessions', async (ctx: InteractionContext) => {
      await ctx.deferReply();
      try {
        const sessions = await readRecentSessions(deps.workDir);
        if (sessions.length === 0) {
          await ctx.editReply({
            embeds: [{
              color: 0xffaa00,
              title: '📂 No Recent Sessions',
              description: 'No session history found for this project.',
              timestamp: true
            }]
          });
          return;
        }

        const fields = sessions.slice(0, 10).map((s, i) => ({
          name: `${i + 1}. ${s.timestamp.toLocaleString()}`,
          value: `\`${s.id}\`\n${s.prompt.substring(0, 80)}${s.prompt.length > 80 ? '...' : ''}`,
          inline: false
        }));

        await ctx.editReply({
          embeds: [{
            color: 0x0099ff,
            title: '📂 Recent Sessions',
            description: 'Use `/resume` or `/claude session_id:<id>` to resume any session.',
            fields,
            timestamp: true
          }]
        });
      } catch (error) {
        await ctx.editReply({
          embeds: [{
            color: 0xff0000,
            title: '📂 Sessions Error',
            description: `${error instanceof Error ? error.message : String(error)}`,
            timestamp: true
          }]
        });
      }
    }],

    // System info — quick health check
    ['startup:system-info', async (ctx: InteractionContext) => {
      await ctx.deferReply();
      try {
        const result = await handlers.system.onSystemInfo(ctx);
        const info = result.data;
        // Truncate to fit embed
        const truncated = info.length > 4000 ? info.substring(0, 4000) + '...' : info;
        await ctx.editReply({
          embeds: [{
            color: 0x0099ff,
            title: '💻 System Info',
            description: `\`\`\`\n${truncated}\n\`\`\``,
            timestamp: true
          }]
        });
      } catch (error) {
        await ctx.editReply({
          embeds: [{
            color: 0xff0000,
            title: '💻 System Info Error',
            description: `${error instanceof Error ? error.message : String(error)}`,
            timestamp: true
          }]
        });
      }
    }]
  ]);

  return buttonHandlers;
}

/**
 * Create the expand content button handler (separate due to shared state needs).
 * This handles the 'expand:' prefixed button IDs.
 * 
 * @param expandableContent - Map of expandable content
 * @returns Button handler function
 */
export function createExpandButtonHandler(
  expandableContent: ExpandableContentMap
): (ctx: InteractionContext, customId: string) => Promise<void> {
  return async (ctx: InteractionContext, customId: string) => {
    if (!customId.startsWith('expand:')) return;
    
    const expandId = customId.substring(7);
    const fullContent = expandableContent.get(expandId);
    
    if (!fullContent) {
      await ctx.update({
        embeds: [{
          color: 0xffaa00,
          title: '📖 Content Not Available',
          description: 'The full content is no longer available for expansion.',
          timestamp: true
        }],
        components: []
      });
      return;
    }
    
    // Split content into chunks if too large for Discord
    const maxLength = 4090 - "```\n\n```".length;
    if (fullContent.length <= maxLength) {
      await ctx.update({
        embeds: [{
          color: 0x0099ff,
          title: '📖 Full Content',
          description: expandId.startsWith('result-') ? 
            `\`\`\`\n${fullContent}\n\`\`\`` : 
            `\`\`\`json\n${fullContent}\n\`\`\``,
          timestamp: true
        }],
        components: [{
          type: 'actionRow',
          components: [{
            type: 'button',
            customId: 'collapse-content',
            label: '🔼 Collapse',
            style: 'secondary'
          }]
        }]
      });
    } else {
      // Content is still too large, show first part with pagination
      const chunk = fullContent.substring(0, maxLength - 100);
      await ctx.update({
        embeds: [{
          color: 0x0099ff,
          title: '📖 Full Content (Large - Showing First Part)',
          description: expandId.startsWith('result-') ? 
            `\`\`\`\n${chunk}...\n\`\`\`` : 
            `\`\`\`json\n${chunk}...\n\`\`\``,
          fields: [
            { name: 'Note', value: 'Content is very large. This shows the first portion.', inline: false }
          ],
          timestamp: true
        }],
        components: [{
          type: 'actionRow',
          components: [{
            type: 'button',
            customId: 'collapse-content',
            label: '🔼 Collapse',
            style: 'secondary'
          }]
        }]
      });
    }
  };
}
