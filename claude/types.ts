export interface ClaudeResponse {
  response: string;
  sessionId?: string;
  cost?: number;
  duration?: number;
  modelUsed?: string;
}

export interface ClaudeMessage {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'system' | 'other';
  content: string;
  // deno-lint-ignore no-explicit-any
  metadata?: any;
}

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
}