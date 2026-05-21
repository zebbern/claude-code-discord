import type { ClaudeResponse, ClaudeMessage } from "./types.ts";
import { sendToClaudeCode, type ClaudeModelOptions } from "./client.ts";
import { convertToClaudeMessages } from "./message-converter.ts";
import { SlashCommandBuilder } from "npm:discord.js@14.14.1";
import type { Message, TextBasedChannel } from "npm:discord.js@14.14.1";
import { validateProjectPath } from "../project/validate.ts";

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
  createThreadSender(prompt: string, sessionId?: string, threadName?: string, onThreadIdKnown?: (threadId: string) => void): Promise<{
    sender: (messages: ClaudeMessage[]) => Promise<void>;
    threadSessionKey: string;
    threadChannelId: string;
  }>;
  /**
   * Look up an existing thread for a session (does NOT create one).
   * Returns undefined if the session has no thread.
   */
  getThreadSender(sessionId: string): Promise<{
    sender: (messages: ClaudeMessage[]) => Promise<void>;
    threadSessionKey: string;
    threadChannelId: string;
  } | undefined>;
  /**
   * Update the session key mapping when the real SDK session ID arrives.
   */
  updateSessionId(oldKey: string, newSessionId: string): void;
  /**
   * Register an existing Discord channel/thread as the output target for a session.
   * Used by free-form cold-starts in threads so /resume and Continue route back there.
   */
  registerExistingChannelThread?(channelId: string, sessionId: string): void;
  /**
   * Remove a placeholder session thread entry (e.g. on cancel-before-session-start).
   * Prevents abandoned pending_ entries from hijacking AskUser/permission routing.
   */
  removeSessionThread?(key: string): void;
}

// Discord command definitions
export const claudeCommands = [
  new SlashCommandBuilder()
    .setName('claude')
    .setDescription('Send message to Claude Code (auto-continues in current channel)')
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('Prompt for Claude Code')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('session_id')
        .setDescription('Session ID to resume (optional)')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('claude-thread')
    .setDescription('Start a new Claude session in a dedicated thread')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Thread name')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('Prompt for Claude Code')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('dir')
        .setDescription('Bind this thread to a specific git repository directory (optional)')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the most recent Claude Code session (across all channels)')
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
  /** Resolve the effective working directory for a channel/thread */
  resolveCwdForChannel: (channelId: string, parentChannelId?: string) => string;
  /** ProjectBindings instance for seeding new thread bindings */
  bindings?: import("../project/bindings.ts").ProjectBindings;
  getClaudeController: () => AbortController | null;
  setClaudeController: (controller: AbortController | null) => void;
  /** Get session ID for a specific channel/thread (per-channel tracking) */
  getSessionForChannel: (channelId: string) => string | undefined;
  /** Set session ID for a specific channel/thread */
  setSessionForChannel: (channelId: string, sessionId: string | undefined) => void;
  /** Legacy global getter (for /resume — find most recent across channels) */
  getClaudeSessionId: () => string | undefined;
  /** Legacy global setter (keeps backward compat for session manager) */
  setClaudeSessionId: (sessionId: string | undefined) => void;
  /** Default sender — used when no thread is available (fallback) */
  sendClaudeMessages: (messages: ClaudeMessage[]) => Promise<void>;
  /** Get current runtime options from unified settings (thinking, operation, proxy) */
  getQueryOptions?: () => ClaudeModelOptions;
  /** Thread-per-session callbacks (optional — when absent, falls back to main channel) */
  sessionThreads?: SessionThreadCallbacks;
  /** Create a sender bound to an arbitrary channel/thread (for free-form message routing) */
  createSenderForChannel?: (channel: TextBasedChannel) => (messages: ClaudeMessage[]) => Promise<void>;
  /** Mark a channel as having an in-flight run, keyed by controller for ownership */
  markChannelPending?: (channelId: string, controller: AbortController) => void;
  /** Clear the in-flight marker only if this controller still owns it */
  clearChannelPending?: (channelId: string, controller: AbortController) => void;
  /** Check whether a channel has an in-flight run */
  isChannelPending?: (channelId: string) => boolean;
  /** Check whether ANY channel has an in-flight run (global scope, matches the singleton controller) */
  isAnyChannelPending?: () => boolean;
  /** Clear all pending markers owned by this controller (used by cancel) */
  clearAllPending?: (controller: AbortController) => void;
}

export function createClaudeHandlers(deps: ClaudeHandlerDeps) {
  const { workDir, sendClaudeMessages } = deps;

  return {
    /**
     * /claude — Send a message to Claude. Auto-continues the session active in the
     * current channel/thread. Starts a new session only if there isn't one yet.
     */
    // deno-lint-ignore no-explicit-any
    async onClaude(ctx: any, prompt: string, channelId: string, explicitSessionId?: string): Promise<ClaudeResponse> {
      const existingController = deps.getClaudeController();
      if (existingController) {
        existingController.abort();
      }

      const controller = new AbortController();
      deps.setClaudeController(controller);

      await ctx.deferReply();

      // Resolve which session to resume:
      // 1) Explicit session_id from user → resume that
      // 2) Active session in this channel/thread → resume that
      // 3) None → start a new session
      const activeSessionId = explicitSessionId || deps.getSessionForChannel(channelId);

      // Pick the right sender — if this channel has a thread, use it
      let activeSender = sendClaudeMessages;
      let sessionThreadChannelId: string | undefined;
      if (activeSessionId && deps.sessionThreads) {
        try {
          const existing = await deps.sessionThreads.getThreadSender(activeSessionId);
          if (existing) {
            activeSender = existing.sender;
            sessionThreadChannelId = existing.threadChannelId;
          }
        } catch { /* fallback to main sender */ }
      }

      const isResuming = !!activeSessionId;

      await ctx.editReply({
        embeds: [{
          color: 0xffff00,
          title: isResuming ? 'Claude Code Continuing...' : 'Claude Code Running...',
          description: isResuming ? 'Continuing session...' : 'Starting new session...',
          fields: [{ name: 'Prompt', value: `\`${prompt.substring(0, 1020)}\``, inline: false }],
          timestamp: true
        }]
      });

      // Use the session thread's channel id for cwd resolution when resuming.
      // This ensures cross-channel /claude session_id:X uses the correct project.
      const cwdChannelId = sessionThreadChannelId ?? channelId;
      const cwdParentId = sessionThreadChannelId ? undefined : ctx.getParentChannelId?.();
      const cwd = deps.resolveCwdForChannel(cwdChannelId, cwdParentId);
      const result = await sendToClaudeCode(
        cwd,
        prompt,
        controller,
        activeSessionId, // resume if present, new session if undefined
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

      // Guard all state writes behind ownership — stale aborted runs must not stomp.
      const stillOwner = deps.getClaudeController() === controller;
      if (stillOwner) {
        deps.setClaudeController(null);
        if (result.sessionId) {
          deps.setSessionForChannel(channelId, result.sessionId);
          deps.setClaudeSessionId(result.sessionId);
        }
      }

      return result;
    },

    /**
     * /claude-thread — Start a brand-new session in a dedicated Discord thread.
     */
    // deno-lint-ignore no-explicit-any
    async onClaudeThread(ctx: any, prompt: string, threadName?: string, dir?: string): Promise<ClaudeResponse> {
      const existingController = deps.getClaudeController();
      if (existingController) {
        existingController.abort();
      }

      const controller = new AbortController();
      deps.setClaudeController(controller);

      // Capture the invoking channel ID before any awaits.
      const invokingChannelId = ctx.getChannelId?.() as string;
      const provisionalChannelId = invokingChannelId;

      // Create a dedicated thread for this session
      let activeSender = sendClaudeMessages;
      let threadSessionKey: string | undefined;
      let threadChannelId: string | undefined;
      let markedPendingThreadId: string | undefined;
      let result: ClaudeResponse | undefined;

      // Single try/finally covers every await after markChannelPending, including
      // deferReply — so the pending marker is always cleared even if deferReply throws.
      try {
        // Defer the reply immediately — before any async work that could time out —
        // so Discord's 3-second interaction window is always satisfied.
        await ctx.deferReply();

        // Mark the invoking channel as pending right after deferReply so that
        // free-form messages and other commands see isAnyChannelPending() === true
        // during path validation, seed computation, and thread creation.
        if (provisionalChannelId) deps.markChannelPending?.(provisionalChannelId, controller);

        // Step 1 — Validate dir if provided.
        let validatedDir: string | undefined;
        if (dir) {
          try {
            validatedDir = await validateProjectPath(dir);
          } catch (err) {
            await ctx.editReply({
              embeds: [{
                color: 0xff0000,
                title: 'Invalid project path',
                description: err instanceof Error ? err.message : String(err),
                timestamp: true,
              }]
            });
            // Release the controller we set above since we're bailing out.
            if (deps.getClaudeController() === controller) deps.setClaudeController(null);
            return { response: '', sessionId: undefined };
          }
        }

        // Step 2 — Compute seedPath for inheritance.
        let seedPath: string | undefined;
        if (validatedDir) {
          seedPath = validatedDir;
        } else if (deps.bindings) {
          const invokingParentId = ctx.getParentChannelId?.() as string | undefined;
          if (deps.bindings.hasBinding(invokingChannelId)) {
            seedPath = deps.bindings.resolveWorkDir(invokingChannelId);
          } else if (!deps.bindings.hasTombstone(invokingChannelId)) {
            // Only inherit from parent if the invoking channel has not explicitly
            // opted out of inheritance via /project unbind (tombstone).
            if (invokingParentId && deps.bindings.hasBinding(invokingParentId)) {
              seedPath = deps.bindings.resolveWorkDir(invokingParentId);
            }
            // If invokingParentId also has a tombstone, we don't seed — fall through
            // to undefined (new thread gets no inherited binding).
          }
        }

        // Abort check after deferReply — a cancel during deferReply should stop before thread creation.
        if (controller.signal.aborted) throw new Error("Aborted before thread creation");

        if (deps.sessionThreads) {
          try {
            const threadResult = await deps.sessionThreads.createThreadSender(
              prompt,
              undefined,
              threadName,
              // Transfer pending from invoking channel to real thread ID (same controller).
              // Step 3 — also seed the binding for the new thread.
              (threadId) => {
                markedPendingThreadId = threadId;
                deps.markChannelPending?.(threadId, controller);
                // Clear provisional once the real thread ID is known.
                if (provisionalChannelId && provisionalChannelId !== threadId) {
                  deps.clearChannelPending?.(provisionalChannelId, controller);
                }
                // Seed binding so the new thread inherits/overrides the cwd.
                // setBindingSync is fire-and-forget by design: the in-memory map is
                // updated immediately (so the next query sees the correct cwd), and the
                // disk write is best-effort via the serial mutation queue.  The only
                // failure mode is a bot restart between binding and the next query —
                // acceptable here since thread creation is a quick path.
                if (seedPath && deps.bindings) {
                  deps.bindings.setBindingSync(threadId, seedPath);
                }
              },
            );
            activeSender = threadResult.sender;
            threadSessionKey = threadResult.threadSessionKey;
            threadChannelId = threadResult.threadChannelId;
          } catch (err) {
            console.warn('[SessionThread] Could not create thread, falling back to main channel:', err);
            if (markedPendingThreadId) deps.clearChannelPending?.(markedPendingThreadId, controller);
            // Bind the invoking channel so subsequent /claude and free-form messages
            // in this channel use the correct project directory for this session.
            if (validatedDir && deps.bindings) {
              deps.bindings.setBindingSync(invokingChannelId, validatedDir);
            }
          }
        }

        // Abort check after thread creation — bail early; finally block will clean up
        // the placeholder from SessionThreadManager if no sessionId was produced.
        if (controller.signal.aborted) throw new Error("Aborted after thread creation");

        await ctx.editReply({
          embeds: [{
            color: 0xffff00,
            title: 'Claude Code Running...',
            description: threadSessionKey
              ? 'Session started in a dedicated thread — check below ↓'
              : 'Starting new session...',
            fields: [{ name: 'Prompt', value: `\`${prompt.substring(0, 1020)}\``, inline: false }],
            timestamp: true
          }]
        });

        // Step 4 — Resolve cwd for the new thread (binding was seeded above if applicable).
        // If thread creation failed but the user specified a dir, use it directly so
        // their intent is honoured for this run even though no binding was persisted.
        const cwd = threadChannelId
          ? deps.resolveCwdForChannel(threadChannelId, ctx.getParentChannelId?.())
          : (validatedDir ?? deps.resolveCwdForChannel(invokingChannelId, ctx.getParentChannelId?.()));
        result = await sendToClaudeCode(
          cwd,
          prompt,
          controller,
          undefined, // always a new session
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
      } finally {
        // Clear markers owned by this controller only — stale finalizers won't touch newer runs.
        if (threadChannelId) deps.clearChannelPending?.(threadChannelId, controller);
        if (provisionalChannelId) deps.clearChannelPending?.(provisionalChannelId, controller);

        // If the run ended without a real sessionId (abort, error, cancel during SDK),
        // remove the placeholder from SessionThreadManager so it can't hijack
        // AskUser/permission routing for later runs.
        if (threadSessionKey && !result?.sessionId && deps.sessionThreads) {
          deps.sessionThreads.removeSessionThread?.(threadSessionKey);
        }
      }

      if (!result) return { response: '', sessionId: undefined };

      const stillOwner = deps.getClaudeController() === controller;
      if (stillOwner) {
        deps.setClaudeController(null);
        if (result.sessionId) {
          deps.setClaudeSessionId(result.sessionId);
          // Map the thread channel → session so /claude inside the thread auto-continues
          if (threadSessionKey && deps.sessionThreads) {
            deps.sessionThreads.updateSessionId(threadSessionKey, result.sessionId);
          }
          if (threadChannelId) {
            deps.setSessionForChannel(threadChannelId, result.sessionId);
          }
        }
      }

      return result;
    },

    /**
     * /resume — Continue the most recent session (global, not per-channel).
     * If that session has a thread, output goes there.
     */
    // deno-lint-ignore no-explicit-any
    async onContinue(ctx: any, prompt?: string): Promise<ClaudeResponse> {
      const existingController = deps.getClaudeController();
      if (existingController) {
        existingController.abort();
      }

      const controller = new AbortController();
      deps.setClaudeController(controller);

      const channelId = ctx.getChannelId?.() as string;
      const actualPrompt = prompt || "Please continue.";

      await ctx.deferReply();

      // Check if the most recent session has a thread — if so, reuse it
      let activeSender = sendClaudeMessages;
      let isReusingThread = false;
      let sessionThreadChannelId: string | undefined;

      if (deps.sessionThreads) {
        const currentSessionId = deps.getClaudeSessionId();
        if (currentSessionId) {
          try {
            const existing = await deps.sessionThreads.getThreadSender(currentSessionId);
            if (existing) {
              activeSender = existing.sender;
              isReusingThread = true;
              sessionThreadChannelId = existing.threadChannelId;
            }
          } catch (err) {
            console.warn('[SessionThread] Could not reuse thread for continue, falling back:', err);
          }
        }
      }

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

      const cwdChannelId = sessionThreadChannelId ?? channelId;
      const cwdParentId = sessionThreadChannelId ? undefined : ctx.getParentChannelId?.();
      const cwd = deps.resolveCwdForChannel(cwdChannelId, cwdParentId);
      const result = await sendToClaudeCode(
        cwd,
        actualPrompt,
        controller,
        undefined,
        undefined,
        (jsonData) => {
          const claudeMessages = convertToClaudeMessages(jsonData);
          if (claudeMessages.length > 0) {
            activeSender(claudeMessages).catch(() => {});
          }
        },
        true, // continueMode = true
        deps.getQueryOptions?.()
      );

      const stillOwner = deps.getClaudeController() === controller;
      if (stillOwner) {
        deps.setClaudeController(null);
        if (result.sessionId) deps.setClaudeSessionId(result.sessionId);
      }

      return result;
    },

    async onFreeFormMessage(message: Message): Promise<void> {
      const channelId = message.channelId;
      const prompt = message.content;

      // If any /claude-thread run is in-flight (global controller scope), don't abort it.
      if (deps.isAnyChannelPending?.()) {
        message.react("⌛").catch(() => {});
        return;
      }

      // Read existing session BEFORE installing new controller — synchronous, no interleaving.
      const existingSessionId = deps.getSessionForChannel(channelId);

      const prior = deps.getClaudeController();
      if (prior) prior.abort();
      const controller = new AbortController();
      deps.setClaudeController(controller);

      // Sender: use registered thread sender if the session has one,
      // else bind directly to message.channel (fixes cold-start-in-thread routing).
      let activeSender: (messages: ClaudeMessage[]) => Promise<void> = sendClaudeMessages;
      if (existingSessionId && deps.sessionThreads) {
        const existing = await deps.sessionThreads
          .getThreadSender(existingSessionId)
          .catch(() => undefined);
        if (existing) activeSender = existing.sender;
      }
      if (activeSender === sendClaudeMessages && deps.createSenderForChannel) {
        activeSender = deps.createSenderForChannel(message.channel as TextBasedChannel);
      }

      message.react("👀").catch(() => {});

      let result: ClaudeResponse | undefined;
      try {
        const cwd = deps.resolveCwdForChannel(channelId, (message.channel as any).parentId);
        result = await sendToClaudeCode(
          cwd,
          prompt,
          controller,
          existingSessionId,
          undefined,
          (jsonData) => {
            const claudeMessages = convertToClaudeMessages(jsonData);
            if (claudeMessages.length > 0) activeSender(claudeMessages).catch(() => {});
          },
          false,
          deps.getQueryOptions?.()
        );
      } catch (err) {
        console.error("[FreeForm] Claude run failed:", err);
        message.react("❌").catch(() => {});
      } finally {
        // Capture ownership once — use it for both the clear and the session write.
        const stillOwner = deps.getClaudeController() === controller;
        if (stillOwner) {
          deps.setClaudeController(null);
          if (result?.sessionId) {
            deps.setSessionForChannel(channelId, result.sessionId);
            deps.setClaudeSessionId(result.sessionId);
            // Register the originating channel as the target for this session so
            // /resume and Continue buttons route back here, not to the main channel.
            deps.sessionThreads?.registerExistingChannelThread?.(channelId, result.sessionId);
          }
        }
      }
    },

    /** Expose pending check so index.ts can pass it into BotDependencies */
    isChannelPending(channelId: string): boolean {
      return deps.isChannelPending?.(channelId) ?? false;
    },
    /** True if ANY channel has an in-flight /claude-thread run — guards the global controller */
    isAnyChannelPending(): boolean {
      return deps.isAnyChannelPending?.() ?? false;
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
      // Clear pending markers owned by this controller so the guard doesn't stay latched.
      deps.clearAllPending?.(currentController);

      return true;
    }
  };
}
