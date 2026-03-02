import type { ClaudeResponse, ClaudeMessage } from "./types.ts";
import { sendToClaudeCode, type ClaudeModelOptions } from "./client.ts";
import { convertToClaudeMessages } from "./message-converter.ts";
import { SlashCommandBuilder } from "npm:discord.js@14.14.1";

// Callback that creates (or retrieves) a session thread and returns a
// sender function bound to that thread.
export interface SessionThreadCallbacks {
  /**
   * Create a new Discord thread for this session and return a sender bound to it.
   * Also posts a summary embed in the main channel linking to the thread.
   *
   * @param prompt The user's prompt (used to name the thread)
   * @param sessionId Optional pre-existing session ID (reuses thread if one exists)
   * @returns Object with the thread-bound sender and a placeholder session key
   */
  createThreadSender(prompt: string, sessionId?: string): Promise<{
    sender: (messages: ClaudeMessage[]) => Promise<void>;
    threadSessionKey: string;
  }>;
  /**
   * Look up an existing thread for a session (does NOT create one).
   * Returns undefined if the session has no thread.
   */
  getThreadSender(sessionId: string): Promise<{
    sender: (messages: ClaudeMessage[]) => Promise<void>;
    threadSessionKey: string;
  } | undefined>;
  /**
   * Update the session key mapping when the real SDK session ID arrives.
   */
  updateSessionId(oldKey: string, newSessionId: string): void;
}

// Discord command definitions
export const claudeCommands = [
  new SlashCommandBuilder()
    .setName('claude')
    .setDescription('Send message to Claude Code')
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('Prompt for Claude Code')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('session_id')
        .setDescription('Session ID to continue (optional)')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('thread')
    .setDescription('Send message to Claude Code in a dedicated thread')
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('Prompt for Claude Code')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the previous Claude Code session')
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('Prompt for Claude Code (optional)')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('claude-cancel')
    .setDescription('Cancel currently running Claude Code command'),
];

export interface ClaudeHandlerDeps {
  workDir: string;
  getClaudeController: () => AbortController | null;
  setClaudeController: (controller: AbortController | null) => void;
  getClaudeSessionId: () => string | undefined;
  setClaudeSessionId: (sessionId: string | undefined) => void;
  /** Default sender — used when no thread is available (fallback) */
  sendClaudeMessages: (messages: ClaudeMessage[]) => Promise<void>;
  /** Get current runtime options from unified settings (thinking, operation, proxy) */
  getQueryOptions?: () => ClaudeModelOptions;
  /** Thread-per-session callbacks (optional — when absent, falls back to main channel) */
  sessionThreads?: SessionThreadCallbacks;
}

export function createClaudeHandlers(deps: ClaudeHandlerDeps) {
  const { workDir, sendClaudeMessages } = deps;

  return {
    // deno-lint-ignore no-explicit-any
    async onClaude(ctx: any, prompt: string, sessionId?: string): Promise<ClaudeResponse> {
      // Cancel any existing session
      const existingController = deps.getClaudeController();
      if (existingController) {
        existingController.abort();
      }

      const controller = new AbortController();
      deps.setClaudeController(controller);

      // Defer interaction (execute first)
      await ctx.deferReply();

      // /claude always uses the main channel sender
      const activeSender = sendClaudeMessages;

      // Send initial message
      await ctx.editReply({
        embeds: [{
          color: 0xffff00,
          title: 'Claude Code Running...',
          description: 'Waiting for response...',
          fields: [{ name: 'Prompt', value: `\`${prompt.substring(0, 1020)}\``, inline: false }],
          timestamp: true
        }]
      });

      const result = await sendToClaudeCode(
        workDir,
        prompt,
        controller,
        sessionId,
        undefined, // onChunk callback not used
        (jsonData) => {
          // Process JSON stream data and send to Discord (thread or main channel)
          const claudeMessages = convertToClaudeMessages(jsonData);
          if (claudeMessages.length > 0) {
            activeSender(claudeMessages).catch(() => {});
          }
        },
        false, // continueMode = false
        deps.getQueryOptions?.() // Pass runtime settings (thinking, operation, proxy)
      );

      deps.setClaudeSessionId(result.sessionId);
      deps.setClaudeController(null);

      return result;
    },

    // /thread — creates a dedicated Discord thread for this session
    // deno-lint-ignore no-explicit-any
    async onThread(ctx: any, prompt: string): Promise<ClaudeResponse> {
      const existingController = deps.getClaudeController();
      if (existingController) {
        existingController.abort();
      }

      const controller = new AbortController();
      deps.setClaudeController(controller);

      await ctx.deferReply();

      // Create a dedicated thread for this session
      let activeSender = sendClaudeMessages;
      let threadSessionKey: string | undefined;

      if (deps.sessionThreads) {
        try {
          const threadResult = await deps.sessionThreads.createThreadSender(prompt);
          activeSender = threadResult.sender;
          threadSessionKey = threadResult.threadSessionKey;
        } catch (err) {
          console.warn('[SessionThread] Could not create thread, falling back to main channel:', err);
        }
      }

      await ctx.editReply({
        embeds: [{
          color: 0xffff00,
          title: 'Claude Code Running...',
          description: threadSessionKey
            ? 'Session started in a dedicated thread — check below ↓'
            : 'Waiting for response...',
          fields: [{ name: 'Prompt', value: `\`${prompt.substring(0, 1020)}\``, inline: false }],
          timestamp: true
        }]
      });

      const result = await sendToClaudeCode(
        workDir,
        prompt,
        controller,
        undefined,
        undefined,
        (jsonData) => {
          const claudeMessages = convertToClaudeMessages(jsonData);
          if (claudeMessages.length > 0) {
            activeSender(claudeMessages).catch(() => {});
          }
        },
        false,
        deps.getQueryOptions?.()
      );

      deps.setClaudeSessionId(result.sessionId);
      deps.setClaudeController(null);

      if (threadSessionKey && result.sessionId && deps.sessionThreads) {
        deps.sessionThreads.updateSessionId(threadSessionKey, result.sessionId);
      }

      return result;
    },

    // /resume — continue the last session; if it had a thread, reuse it
    // deno-lint-ignore no-explicit-any
    async onContinue(ctx: any, prompt?: string): Promise<ClaudeResponse> {
      const existingController = deps.getClaudeController();
      if (existingController) {
        existingController.abort();
      }

      const controller = new AbortController();
      deps.setClaudeController(controller);

      const actualPrompt = prompt || "Please continue.";

      await ctx.deferReply();

      // Check if the current session has a thread — if so, reuse it
      let activeSender = sendClaudeMessages;
      let isReusingThread = false;

      if (deps.sessionThreads) {
        const currentSessionId = deps.getClaudeSessionId();
        if (currentSessionId) {
          try {
            const existing = await deps.sessionThreads.getThreadSender(currentSessionId);
            if (existing) {
              activeSender = existing.sender;
              isReusingThread = true;
            }
          } catch (err) {
            console.warn('[SessionThread] Could not reuse thread for continue, falling back:', err);
          }
        }
      }

      // Send initial message
      const embedData: { color: number; title: string; description: string; timestamp: boolean; fields?: Array<{ name: string; value: string; inline: boolean }> } = {
        color: 0xffff00,
        title: 'Claude Code Continuing Conversation...',
        description: isReusingThread
          ? 'Continuing in session thread...'
          : 'Loading latest conversation and waiting for response...',
        timestamp: true
      };

      if (prompt) {
        embedData.fields = [{ name: 'Prompt', value: `\`${prompt.substring(0, 1020)}\``, inline: false }];
      }

      await ctx.editReply({ embeds: [embedData] });

      const result = await sendToClaudeCode(
        workDir,
        actualPrompt,
        controller,
        undefined, // sessionId not used
        undefined, // onChunk callback not used
        (jsonData) => {
          const claudeMessages = convertToClaudeMessages(jsonData);
          if (claudeMessages.length > 0) {
            activeSender(claudeMessages).catch(() => {});
          }
        },
        true, // continueMode = true
        deps.getQueryOptions?.()
      );

      deps.setClaudeSessionId(result.sessionId);
      deps.setClaudeController(null);

      return result;
    },

    // deno-lint-ignore no-explicit-any
    onClaudeCancel(_ctx: any): boolean {
      const currentController = deps.getClaudeController();
      if (!currentController) {
        return false;
      }

      console.log("Cancelling Claude Code session...");
      currentController.abort();
      deps.setClaudeController(null);
      deps.setClaudeSessionId(undefined);

      return true;
    }
  };
}
