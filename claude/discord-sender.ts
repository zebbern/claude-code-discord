import { splitText } from "../discord/utils.ts";
import type { ClaudeMessage } from "./types.ts";
import type { MessageContent, EmbedData, ComponentData } from "../discord/types.ts";

// Discord API limits
const DISCORD_EMBED_DESCRIPTION_LIMIT = 4096;
const DISCORD_EMBED_FIELD_VALUE_LIMIT = 1024;
const DISCORD_EMBED_TITLE_LIMIT = 256;
const DISCORD_EMBED_TOTAL_LIMIT = 6000;

/**
 * Safely truncate a string to fit within Discord's embed limits.
 * Appends a truncation indicator if the string was shortened.
 */
function safeTruncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const suffix = '\n…[truncated]';
  return text.substring(0, limit - suffix.length) + suffix;
}

// Discord sender interface for dependency injection
export interface DiscordSender {
  sendMessage(content: MessageContent): Promise<void>;
}

// Store full content for expand functionality
export const expandableContent = new Map<string, string>();

// Helper function to create action buttons for completed sessions
function createActionButtons(sessionId?: string): ComponentData[] {
  const buttons: ComponentData[] = [];
  
  if (sessionId) {
    buttons.push({
      type: 'button',
      customId: `continue:${sessionId}`,
      label: '▶️ Continue',
      style: 'primary'
    });
  }
  
  buttons.push(
    {
      type: 'button',
      customId: 'workflow:git-status',
      label: '📊 Git Status',
      style: 'secondary'
    },
    {
      type: 'button',
      customId: 'prompt-history',
      label: '📜 Prompt History',
      style: 'secondary'
    }
  );
  
  return buttons;
}

// Helper function to truncate content with smart preview
function truncateContent(content: string, maxLines = 15, maxChars = 1000): { preview: string; isTruncated: boolean; totalLines: number } {
  const lines = content.split('\n');
  const totalLines = lines.length;
  const truncatedLines = lines.slice(0, maxLines);
  const preview = truncatedLines.join('\n');
  
  if (preview.length > maxChars) {
    return {
      preview: preview.substring(0, maxChars - 3) + '...',
      isTruncated: true,
      totalLines
    };
  }
  
  return {
    preview,
    isTruncated: lines.length > maxLines,
    totalLines
  };
}

// Format stop_reason for human-readable display in completion embeds
// See SDK v0.2.31+ for stop_reason field on result messages
function formatStopReason(stopReason?: string, sdkSubtype?: string): string | null {
  // Map SDK error subtypes to user-friendly messages
  if (sdkSubtype && sdkSubtype !== 'success') {
    const subtypeMap: Record<string, string> = {
      'error_max_turns': '🔄 Hit turn limit',
      'error_budget': '💰 Budget exceeded',
      'error_tool': '🔧 Tool error',
      'error_streaming': '📡 Streaming error',
    };
    if (subtypeMap[sdkSubtype]) return subtypeMap[sdkSubtype];
  }

  if (!stopReason) return null;

  const reasonMap: Record<string, string> = {
    'end_turn': '✅ Completed',
    'max_tokens': '⚠️ Hit token limit',
    'refusal': '🚫 Request declined',
    'stop_sequence': '⏹️ Stop sequence',
    'tool_use': '🔧 Tool use',
  };

  return reasonMap[stopReason] ?? null;
}

// Helper function to detect file type from path
function getFileTypeInfo(filePath: string): { icon: string; language: string } {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  
  const fileTypes: Record<string, { icon: string; language: string }> = {
    'ts': { icon: '📘', language: 'TypeScript' },
    'tsx': { icon: '⚛️', language: 'React/TypeScript' },
    'js': { icon: '📙', language: 'JavaScript' },
    'jsx': { icon: '⚛️', language: 'React/JavaScript' },
    'py': { icon: '🐍', language: 'Python' },
    'rs': { icon: '🦀', language: 'Rust' },
    'go': { icon: '🐹', language: 'Go' },
    'java': { icon: '☕', language: 'Java' },
    'md': { icon: '📝', language: 'Markdown' },
    'json': { icon: '📋', language: 'JSON' },
    'yml': { icon: '⚙️', language: 'YAML' },
    'yaml': { icon: '⚙️', language: 'YAML' },
    'html': { icon: '🌐', language: 'HTML' },
    'css': { icon: '🎨', language: 'CSS' },
    'scss': { icon: '🎨', language: 'SCSS' },
  };
  
  return fileTypes[ext] || { icon: '📄', language: 'Text' };
}

// Tool-specific formatters
function formatGenericTool(toolName: string, metadata: any): { title: string; color: number; description: string } {
  const inputStr = JSON.stringify(metadata.input || {}, null, 2);
  const { preview, isTruncated } = truncateContent(inputStr, 10, 800);
  
  return {
    title: `🔧 Tool Use: ${toolName}`,
    color: 0x0099ff,
    description: `\`\`\`json\n${preview}\n\`\`\``
  };
}

// Create sendClaudeMessages function with dependency injection
export function createClaudeSender(sender: DiscordSender) {
  return async function sendClaudeMessages(messages: ClaudeMessage[]) {
  for (const msg of messages) {
    switch (msg.type) {
      case 'text': {
        const chunks = splitText(msg.content, DISCORD_EMBED_DESCRIPTION_LIMIT - 50);
        for (let i = 0; i < chunks.length; i++) {
          await sender.sendMessage({
            embeds: [{
              color: 0x00ff00,
              title: chunks.length > 1 ? `Assistant (${i + 1}/${chunks.length})` : 'Assistant',
              description: safeTruncate(chunks[i], DISCORD_EMBED_DESCRIPTION_LIMIT),
              timestamp: true
            }]
          });
        }
        break;
      }
      
      case 'tool_use': {
        if (msg.metadata?.name === 'TodoWrite') {
          const todos = msg.metadata?.input?.todos || [];
          const statusEmojis: Record<string, string> = {
            pending: '⏳',
            in_progress: '🔄',
            completed: '✅'
          };
          const priorityEmojis: Record<string, string> = {
            high: '🔴',
            medium: '🟡',
            low: '🟢'
          };
          
          let todoList = '';
          if (todos.length === 0) {
            todoList = 'Task list is empty';
          } else {
            for (const todo of todos) {
              const statusEmoji = statusEmojis[todo.status] || '❓';
              const priorityEmoji = priorityEmojis[todo.priority] || '';
              const priorityText = priorityEmoji ? `${priorityEmoji} ` : '';
              todoList += `${statusEmoji} ${priorityText}**${todo.content}**\n`;
            }
          }
          
          await sender.sendMessage({
            embeds: [{
              color: 0x9932cc,
              title: '📝 Todo List Updated',
              description: todoList,
              footer: { text: '⏳ Pending | 🔄 In Progress | ✅ Completed | 🔴 High | 🟡 Medium | 🟢 Low' },
              timestamp: true
            }]
          });
        } else {
          // Use simplified consistent formatting for all tools
          const toolName = msg.metadata?.name || 'Unknown';
          let embedData;
          
          // Special handling for Edit tool to keep "Replacing/With" functionality
          if (toolName === 'Edit') {
            const filePath = msg.metadata.input?.file_path || 'Unknown file';
            const oldString = msg.metadata.input?.old_string || '';
            const newString = msg.metadata.input?.new_string || '';
            const fileInfo = getFileTypeInfo(filePath);
            
            const fields = [
              { name: '📁 File Path', value: `\`${filePath}\``, inline: false }
            ];
            
            if (oldString) {
              const { preview: oldPreview } = truncateContent(oldString, 3, 150);
              fields.push({ name: '🔴 Replacing', value: `\`\`\`\n${oldPreview}\n\`\`\``, inline: false });
            }
            
            if (newString) {
              const { preview: newPreview } = truncateContent(newString, 3, 150);
              fields.push({ name: '🟢 With', value: `\`\`\`\n${newPreview}\n\`\`\``, inline: false });
            }
            
            await sender.sendMessage({
              embeds: [{
                color: 0xffaa00,
                title: '✏️ Tool Use: Edit',
                fields,
                timestamp: true
              }]
            });
          } else {
            // All other tools use generic consistent formatting
            const inputStr = JSON.stringify(msg.metadata.input || {}, null, 2);
            const { preview, isTruncated } = truncateContent(inputStr, 10, 800);
            
            const messageContent: MessageContent = {
              embeds: [{
                color: 0x0099ff,
                title: `🔧 Tool Use: ${toolName}`,
                description: `\`\`\`json\n${preview}\n\`\`\``,
                timestamp: true
              }]
            };
            
            // Add expand button if content was truncated
            if (isTruncated) {
              const expandId = `tool-${msg.metadata?.id || Date.now()}`;
              expandableContent.set(expandId, inputStr);
              
              messageContent.components = [{
                type: 'actionRow',
                components: [{
                  type: 'button',
                  customId: `expand:${expandId}`,
                  label: '📖 Show Full Content',
                  style: 'secondary'
                }]
              }];
            }
            
            await sender.sendMessage(messageContent);
          }
        }
        break;
      }
      
      case 'tool_result': {
        // Filter out system reminder content
        let cleanContent = msg.content;
        
        // Remove system reminder blocks
        cleanContent = cleanContent.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '');
        
        // Remove any remaining empty lines or extra whitespace
        cleanContent = cleanContent.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
        
        if (!cleanContent) {
          // If no content left after filtering, don't show the tool result
          break;
        }
        
        const { preview, isTruncated, totalLines } = truncateContent(cleanContent);
        
        const resultDescription = safeTruncate(`\`\`\`\n${preview}\n\`\`\``, DISCORD_EMBED_DESCRIPTION_LIMIT);
        const messageContent: MessageContent = {
          embeds: [{
            color: 0x00ffff,
            title: `✅ Tool Result${isTruncated ? ` (+${totalLines - 15} more lines)` : ''}`,
            description: resultDescription,
            timestamp: true
          }]
        };
        
        // Add expand button if content was truncated
        if (isTruncated) {
          const expandId = `result-${Date.now()}`;
          expandableContent.set(expandId, cleanContent);
          
          messageContent.components = [{
            type: 'actionRow',
            components: [{
              type: 'button',
              customId: `expand:${expandId}`,
              label: '📖 Show Full Result',
              style: 'secondary'
            }]
          }];
        }
        
        await sender.sendMessage(messageContent);
        break;
      }
      
      case 'thinking': {
        const chunks = splitText(msg.content, DISCORD_EMBED_DESCRIPTION_LIMIT - 50);
        for (let i = 0; i < chunks.length; i++) {
          await sender.sendMessage({
            embeds: [{
              color: 0x9b59b6,
              title: chunks.length > 1 ? `💭 Thinking (${i + 1}/${chunks.length})` : '💭 Thinking',
              description: safeTruncate(chunks[i], DISCORD_EMBED_DESCRIPTION_LIMIT),
              timestamp: true
            }]
          });
        }
        break;
      }
      
      case 'system': {
        const embedData: EmbedData = {
          color: msg.metadata?.subtype === 'completion' ? 0x00ff00 : 0xaaaaaa,
          title: msg.metadata?.subtype === 'completion' ? '✅ Claude Code Complete' : `⚙️ System: ${msg.metadata?.subtype || 'info'}`,
          timestamp: true,
          fields: []
        };
        
        if (msg.metadata?.cwd) {
          embedData.fields!.push({ name: 'Working Directory', value: `\`${msg.metadata.cwd}\``, inline: false });
        }
        if (msg.metadata?.session_id) {
          embedData.fields!.push({ name: 'Session ID', value: `\`${msg.metadata.session_id}\``, inline: false });
        }
        if (msg.metadata?.model) {
          embedData.fields!.push({ name: 'Model', value: msg.metadata.model, inline: true });
        }
        if (msg.metadata?.total_cost_usd !== undefined) {
          embedData.fields!.push({ name: 'Cost', value: `$${msg.metadata.total_cost_usd.toFixed(4)}`, inline: true });
        }
        if (msg.metadata?.duration_ms !== undefined) {
          embedData.fields!.push({ name: 'Duration', value: `${(msg.metadata.duration_ms / 1000).toFixed(2)}s`, inline: true });
        }
        
        // Display stop reason — why Claude finished (v0.2.31+ SDK feature)
        const stopReasonDisplay = formatStopReason(msg.metadata?.stop_reason, msg.metadata?.sdkSubtype);
        if (stopReasonDisplay) {
          embedData.fields!.push({ name: 'Stop Reason', value: stopReasonDisplay, inline: true });
        }
        
        // Special handling for shutdown
        if (msg.metadata?.subtype === 'shutdown') {
          embedData.color = 0xff0000;
          embedData.title = '🛑 Shutdown';
          embedData.description = `Bot stopped by signal ${msg.metadata.signal}`;
          embedData.fields = [
            { name: 'Category', value: msg.metadata.categoryName, inline: true },
            { name: 'Repository', value: msg.metadata.repoName, inline: true },
            { name: 'Branch', value: msg.metadata.branchName, inline: true }
          ];
        }
        
        // Add interactive buttons for completed sessions (but not shutdown messages)
        const messageContent: MessageContent = { embeds: [embedData] };
        
        if (msg.metadata?.subtype === 'completion' && msg.metadata?.session_id) {
          const actionButtons = createActionButtons(msg.metadata.session_id);
          
          messageContent.components = [
            { type: 'actionRow', components: actionButtons }
          ];
        }
        
        await sender.sendMessage(messageContent);
        break;
      }
      
      case 'other': {
        const jsonStr = JSON.stringify(msg.metadata || msg.content, null, 2);
        // Account for code block markers when splitting
        const maxChunkLength = 4096 - "```json\n\n```".length - 50; // 50 chars safety margin
        const chunks = splitText(jsonStr, maxChunkLength);
        for (let i = 0; i < chunks.length; i++) {
          await sender.sendMessage({
            embeds: [{
              color: 0xffaa00,
              title: chunks.length > 1 ? `Other Content (${i + 1}/${chunks.length})` : 'Other Content',
              description: `\`\`\`json\n${chunks[i]}\n\`\`\``,
              timestamp: true
            }]
          });
        }
        break;
      }

      case 'permission_denied': {
        const toolName = msg.metadata?.toolName || 'Unknown';
        const toolInput = msg.metadata?.toolInput || {};
        const inputPreview = JSON.stringify(toolInput, null, 2);
        const { preview } = truncateContent(inputPreview, 6, 500);
        
        await sender.sendMessage({
          embeds: [{
            color: 0xff4444,
            title: `🚫 Permission Denied: ${toolName}`,
            description: 'This tool was blocked by the current permission mode (`dontAsk`). The bot denies tools that aren\'t pre-approved.',
            fields: [
              { name: 'Tool', value: `\`${toolName}\``, inline: true },
              { name: 'Input Preview', value: `\`\`\`json\n${preview}\n\`\`\``, inline: false }
            ],
            footer: { text: 'Change operation mode with /settings → Mode Settings to allow more tools' },
            timestamp: true
          }]
        });
        break;
      }

      case 'task_started': {
        const description = msg.metadata?.description || msg.content || 'Starting subagent task...';
        const taskType = msg.metadata?.taskType;
        
        await sender.sendMessage({
          embeds: [{
            color: 0x5865f2,
            title: '🚀 Subagent Task Started',
            description,
            fields: taskType ? [{ name: 'Type', value: taskType, inline: true }] : [],
            timestamp: true
          }]
        });
        break;
      }

      case 'task_notification': {
        const status = msg.metadata?.status || 'unknown';
        const summary = msg.metadata?.summary || msg.content || 'No summary';
        const statusEmoji = status === 'completed' ? '✅' : status === 'failed' ? '❌' : '⏹️';
        const statusColor = status === 'completed' ? 0x00ff00 : status === 'failed' ? 0xff0000 : 0xffaa00;
        
        await sender.sendMessage({
          embeds: [{
            color: statusColor,
            title: `${statusEmoji} Subagent Task ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            description: summary.length > 4000 ? summary.substring(0, 3997) + '...' : summary,
            timestamp: true
          }]
        });
        break;
      }

      case 'tool_progress': {
        // Only show progress for long-running tools (>5s)
        const elapsed = msg.metadata?.elapsedSeconds || 0;
        if (elapsed >= 5) {
          const toolName = msg.metadata?.toolName || 'Unknown';
          await sender.sendMessage({
            embeds: [{
              color: 0x888888,
              title: `⏳ ${toolName} running...`,
              description: `Elapsed: ${elapsed.toFixed(1)}s`,
              timestamp: true
            }]
          });
        }
        break;
      }

      case 'tool_summary': {
        if (msg.content) {
          await sender.sendMessage({
            embeds: [{
              color: 0x00ccff,
              title: '📋 Tool Summary',
              description: msg.content.length > 4000 ? msg.content.substring(0, 3997) + '...' : msg.content,
              timestamp: true
            }]
          });
        }
        break;
      }
    }
  }
  };
}