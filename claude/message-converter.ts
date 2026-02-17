import type { ClaudeMessage } from "./types.ts";

// Convert JSON messages to ClaudeMessage
// deno-lint-ignore no-explicit-any
export function convertToClaudeMessages(jsonData: any): ClaudeMessage[] {
  const messages: ClaudeMessage[] = [];
  
  if (jsonData.type === 'assistant') {
    if (jsonData.message?.content) {
      const textContent = jsonData.message.content
        // deno-lint-ignore no-explicit-any
        .filter((c: any) => c.type === 'text')
        // deno-lint-ignore no-explicit-any
        .map((c: any) => c.text)
        .join('');
      
      if (textContent) {
        messages.push({ type: 'text', content: textContent });
      }
      
      // Process tool_use individually
      const toolUseContent = jsonData.message.content
        // deno-lint-ignore no-explicit-any
        .filter((c: any) => c.type === 'tool_use');
      
      for (const tool of toolUseContent) {
        messages.push({
          type: 'tool_use',
          content: '',
          metadata: tool
        });
      }
      
      // Process thinking content
      const thinkingContent = jsonData.message.content
        // deno-lint-ignore no-explicit-any
        .filter((c: any) => c.type === 'thinking');
      
      for (const thinking of thinkingContent) {
        if (thinking.thinking) {
          messages.push({
            type: 'thinking',
            content: thinking.thinking
          });
        }
      }
      
      // Process other content
      const otherContent = jsonData.message.content
        // deno-lint-ignore no-explicit-any
        .filter((c: any) => c.type !== 'text' && c.type !== 'tool_use' && c.type !== 'thinking');
      
      for (const other of otherContent) {
        messages.push({
          type: 'other',
          content: JSON.stringify(other, null, 2),
          metadata: other
        });
      }
    }
  } else if (jsonData.type === 'user') {
    if (jsonData.message?.content) {
      const toolResults = jsonData.message.content
        // deno-lint-ignore no-explicit-any
        .filter((c: any) => c.type === 'tool_result');
      
      for (const result of toolResults) {
        messages.push({
          type: 'tool_result',
          content: result.content || JSON.stringify(result, null, 2)
        });
      }
      
      const otherContent = jsonData.message.content
        // deno-lint-ignore no-explicit-any
        .filter((c: any) => c.type !== 'tool_result');
      
      for (const other of otherContent) {
        messages.push({
          type: 'other',
          content: JSON.stringify(other, null, 2),
          metadata: other
        });
      }
    }
  } else if (jsonData.type === 'result') {
    // Handle result messages — surface permission denials and errors
    if (jsonData.permission_denials && jsonData.permission_denials.length > 0) {
      for (const denial of jsonData.permission_denials) {
        messages.push({
          type: 'permission_denied',
          content: `Tool "${denial.tool_name}" was denied by permission mode`,
          metadata: {
            toolName: denial.tool_name,
            toolUseId: denial.tool_use_id,
            toolInput: denial.tool_input,
          }
        });
      }
    }
    // Surface result metadata (cost, duration, etc.) as system
    messages.push({
      type: 'system',
      content: '',
      metadata: { ...jsonData, subtype: jsonData.subtype === 'success' ? 'completion' : 'error' }
    });
  } else if (jsonData.type === 'system') {
    // Task notifications from subagents
    if (jsonData.subtype === 'task_notification') {
      messages.push({
        type: 'task_notification',
        content: jsonData.summary || '',
        metadata: {
          taskId: jsonData.task_id,
          status: jsonData.status,
          outputFile: jsonData.output_file,
          summary: jsonData.summary,
        }
      });
    }
    // Task started notifications
    else if (jsonData.subtype === 'task_started') {
      messages.push({
        type: 'task_started',
        content: jsonData.description || '',
        metadata: {
          taskId: jsonData.task_id,
          description: jsonData.description,
          taskType: jsonData.task_type,
        }
      });
    }
    // Generic system messages
    else {
      messages.push({
        type: 'system',
        content: '',
        metadata: jsonData
      });
    }
  } else if (jsonData.type === 'tool_progress') {
    // Tool progress updates (long-running tools)
    messages.push({
      type: 'tool_progress',
      content: `${jsonData.tool_name}: ${jsonData.elapsed_time_seconds}s`,
      metadata: {
        toolUseId: jsonData.tool_use_id,
        toolName: jsonData.tool_name,
        elapsedSeconds: jsonData.elapsed_time_seconds,
      }
    });
  } else if (jsonData.type === 'tool_use_summary') {
    // Tool use summary messages
    messages.push({
      type: 'tool_summary',
      content: jsonData.summary || '',
      metadata: {
        summary: jsonData.summary,
        toolUseIds: jsonData.preceding_tool_use_ids,
      }
    });
  }
  
  return messages;
}