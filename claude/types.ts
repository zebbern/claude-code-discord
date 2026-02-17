export interface ClaudeResponse {
  response: string;
  sessionId?: string;
  cost?: number;
  duration?: number;
  modelUsed?: string;
  /** Tools that were denied by permission mode (e.g. dontAsk) */
  permissionDenials?: PermissionDenial[];
}

/** A tool invocation that was denied by the permission system */
export interface PermissionDenial {
  toolName: string;
  toolUseId: string;
  toolInput: Record<string, unknown>;
}

export interface ClaudeMessage {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'system' | 'other'
    | 'permission_denied' | 'task_notification' | 'task_started' | 'tool_progress' | 'tool_summary';
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