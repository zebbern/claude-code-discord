/**
 * SDK Hooks — Discord-integrated hook callbacks for Claude Code SDK.
 * 
 * Hooks provide deep integration points that fire during query execution:
 * - PreToolUse: Log/audit tool usage before execution
 * - PostToolUse: Log completed tool usage
 * - PostToolUseFailure: Log tool failures
 * - Notification: Forward Claude's notifications to Discord
 * - TaskCompleted: Notify when background tasks finish
 * 
 * All hooks are passive observers — they log to Discord but don't block execution.
 * They return `{ continue: true }` to let the SDK proceed normally.
 * 
 * @module claude/hooks
 */

import type { 
  HookCallbackMatcher, 
  HookCallback,
  HookInput,
  PreToolUseHookInput,
  PostToolUseHookInput,
  PostToolUseFailureHookInput,
  NotificationHookInput,
  TaskCompletedHookInput,
  HookEvent,
  SyncHookJSONOutput,
} from "@anthropic-ai/claude-agent-sdk";

/**
 * Configuration for which hooks to enable and how to route events.
 */
export interface HookConfig {
  /** Enable tool-use logging (PreToolUse + PostToolUse + PostToolUseFailure) */
  logToolUse: boolean;
  /** Enable notification forwarding */
  logNotifications: boolean;
  /** Enable task completion notifications */
  logTaskCompletions: boolean;
  /** Callback to send hook events to Discord */
  onHookEvent: (event: HookEvent_Discord) => void;
}

/**
 * Discord-formatted hook event for display.
 */
export interface HookEvent_Discord {
  type: 'tool_start' | 'tool_complete' | 'tool_failure' | 'notification' | 'task_completed';
  toolName?: string;
  // deno-lint-ignore no-explicit-any
  toolInput?: any;
  // deno-lint-ignore no-explicit-any
  toolResponse?: any;
  error?: string;
  message?: string;
  title?: string;
  taskId?: string;
  taskSubject?: string;
  timestamp: number;
}

/**
 * Build SDK hook callbacks based on the provided configuration.
 * Returns a Partial<Record<HookEvent, HookCallbackMatcher[]>> suitable
 * for passing directly to the SDK query `options.hooks`.
 */
export function buildHooks(config: HookConfig): Partial<Record<HookEvent, HookCallbackMatcher[]>> {
  const hooks: Partial<Record<HookEvent, HookCallbackMatcher[]>> = {};

  if (config.logToolUse) {
    // PreToolUse — log when a tool is about to be used
    const preToolHook: HookCallback = async (input: HookInput) => {
      const preInput = input as PreToolUseHookInput;
      config.onHookEvent({
        type: 'tool_start',
        toolName: preInput.tool_name,
        toolInput: preInput.tool_input,
        timestamp: Date.now(),
      });
      // Passive: don't block, don't modify
      return { continue: true } satisfies SyncHookJSONOutput;
    };

    hooks.PreToolUse = [{
      hooks: [preToolHook],
    }];

    // PostToolUse — log after a tool runs successfully
    const postToolHook: HookCallback = async (input: HookInput) => {
      const postInput = input as PostToolUseHookInput;
      config.onHookEvent({
        type: 'tool_complete',
        toolName: postInput.tool_name,
        toolInput: postInput.tool_input,
        toolResponse: postInput.tool_response,
        timestamp: Date.now(),
      });
      return { continue: true } satisfies SyncHookJSONOutput;
    };

    hooks.PostToolUse = [{
      hooks: [postToolHook],
    }];

    // PostToolUseFailure — log tool failures
    const failureHook: HookCallback = async (input: HookInput) => {
      const failInput = input as PostToolUseFailureHookInput;
      config.onHookEvent({
        type: 'tool_failure',
        toolName: failInput.tool_name,
        toolInput: failInput.tool_input,
        error: failInput.error,
        timestamp: Date.now(),
      });
      return { continue: true } satisfies SyncHookJSONOutput;
    };

    hooks.PostToolUseFailure = [{
      hooks: [failureHook],
    }];
  }

  if (config.logNotifications) {
    // Notification — forward Claude's notifications to Discord
    const notificationHook: HookCallback = async (input: HookInput) => {
      const notifInput = input as NotificationHookInput;
      config.onHookEvent({
        type: 'notification',
        message: notifInput.message,
        title: notifInput.title,
        timestamp: Date.now(),
      });
      return { continue: true } satisfies SyncHookJSONOutput;
    };

    hooks.Notification = [{
      hooks: [notificationHook],
    }];
  }

  if (config.logTaskCompletions) {
    // TaskCompleted — notify when background tasks finish
    const taskHook: HookCallback = async (input: HookInput) => {
      const taskInput = input as TaskCompletedHookInput;
      config.onHookEvent({
        type: 'task_completed',
        taskId: taskInput.task_id,
        taskSubject: taskInput.task_subject,
        message: taskInput.task_description,
        timestamp: Date.now(),
      });
      return { continue: true } satisfies SyncHookJSONOutput;
    };

    hooks.TaskCompleted = [{
      hooks: [taskHook],
    }];
  }

  return hooks;
}
