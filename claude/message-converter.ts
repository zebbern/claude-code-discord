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
  } else if (jsonData.type === 'system') {
    messages.push({
      type: 'system',
      content: '',
      metadata: jsonData
    });
  }
  
  return messages;
}