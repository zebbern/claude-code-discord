import type { ClaudeResponse, ClaudeMessage } from "./types.ts";
import { sendToClaudeCode, type ClaudeModelOptions } from "./client.ts";
import { convertToClaudeMessages } from "./message-converter.ts";
import {
  tryEnqueueClaudeJob,
  takeClaudeJob,
  clearClaudeJob,
} from "./channel-queue.ts";
import {
  buildSessionFooter,
  cancelClaudeComponents,
  claudeCancelledEmbed,
  resolveThreadChannelId,
} from "./status-embed.ts";
import { EMBED_COLORS } from "../discord/embed-theme.ts";
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
  createThreadSender(prompt: string, sessionId?: string, threadName?: string): Promise<{
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
  } | undefined>;
  /**
   * Update the session key mapping when the real SDK session ID arrives.
   */
  updateSessionId(oldKey: string, newSessionId: string): void;
  /** Discord thread channel id for a session, if tracked. */
  getThreadChannelId(sessionId: string): string | undefined;
  /** Session id for a Discord thread channel, if tracked. */
  findSessionByThreadId(threadId: string): string | undefined;
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
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the most recent Claude Code session (across all channels)')
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('Prompt for Claude Code (optional)')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('claude-cancel')
    .setDescription('Cancel currently running Claude Code command (also available as Cancel on the running embed)'),
];

export interface ClaudeHandlerDeps {
  workDir: string;
  getClaudeController: (channelId?: string) => AbortController | null;
  setClaudeController: (controller: AbortController | null, channelId?: string) => void;
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
}

export function createClaudeHandlers(deps: ClaudeHandlerDeps) {
  const { workDir, sendClaudeMessages } = deps;

  function threadIdFor(sessionId?: string, channelId?: string, knownThreadChannelId?: string): string | undefined {
    return resolveThreadChannelId({
      sessionId,
      channelId,
      knownThreadChannelId,
      getThreadChannelId: deps.sessionThreads?.getThreadChannelId.bind(deps.sessionThreads),
      findSessionByThreadId: deps.sessionThreads?.findSessionByThreadId.bind(deps.sessionThreads),
    });
  }

  // deno-lint-ignore no-explicit-any
  async function runClaudeJob(
    ctx: any,
    prompt: string,
    channelId: string,
    explicitSessionId: string | undefined,
    alreadyDeferred: boolean,
  ): Promise<ClaudeResponse> {
    const controller = new AbortController();
    deps.setClaudeController(controller, channelId);

    try {
      if (!alreadyDeferred) {
        await ctx.deferReply();
      }

      // Resolve which session to resume:
      // 1) Explicit session_id from user → resume that
      // 2) Active session in this channel/thread → resume that
      // 3) None → start a new session
      const activeSessionId = explicitSessionId || deps.getSessionForChannel(channelId);

      let activeSender = sendClaudeMessages;
      if (activeSessionId && deps.sessionThreads) {
        try {
          const existing = await deps.sessionThreads.getThreadSender(activeSessionId);
          if (existing) {
            activeSender = existing.sender;
          }
        } catch { /* fallback to main sender */ }
      }

      const isResuming = !!activeSessionId;
      const runningThreadId = threadIdFor(activeSessionId, channelId);

      await ctx.editReply({
        embeds: [{
          color: EMBED_COLORS.running,
          title: isResuming ? '/claude · continuing' : '/claude · running',
          description: isResuming ? 'Continuing session...' : 'Starting new session...',
          fields: [{ name: 'Prompt', value: `\`${prompt.substring(0, 1020)}\``, inline: false }],
          footer: buildSessionFooter(activeSessionId, runningThreadId),
          timestamp: true,
        }],
        components: cancelClaudeComponents(),
      });

      let result: ClaudeResponse;
      try {
        result = await sendToClaudeCode(
          workDir,
          prompt,
          controller,
          activeSessionId,
          undefined,
          (jsonData) => {
            const claudeMessages = convertToClaudeMessages(jsonData);
            if (claudeMessages.length > 0) {
              activeSender(claudeMessages).catch(() => {});
            }
          },
          false,
          { ...deps.getQueryOptions?.(), channelId },
        );
      } catch (err) {
        if (controller.signal.aborted) {
          try {
            await ctx.editReply({
              embeds: [claudeCancelledEmbed()],
              components: [],
            });
          } catch { /* button handler may have already updated */ }
          return { response: 'Cancelled' };
        }
        throw err;
      }

      if (controller.signal.aborted) {
        try {
          await ctx.editReply({
            embeds: [claudeCancelledEmbed()],
            components: [],
          });
        } catch { /* ignore */ }
        return { response: 'Cancelled', sessionId: result.sessionId };
      }

      if (result.sessionId) {
        deps.setSessionForChannel(channelId, result.sessionId);
      }
      deps.setClaudeSessionId(result.sessionId);

      const doneThreadId = threadIdFor(result.sessionId, channelId, runningThreadId);
      try {
        await ctx.editReply({
          embeds: [{
            color: EMBED_COLORS.success,
            title: '/claude · done',
            description: 'Response posted above. Use `/claude` to continue in this channel.',
            fields: [{ name: 'Prompt', value: `\`${prompt.substring(0, 1020)}\``, inline: false }],
            footer: buildSessionFooter(result.sessionId, doneThreadId),
            timestamp: true,
          }],
          components: [],
        });
      } catch { /* interaction may have expired */ }

      return result;
    } finally {
      deps.setClaudeController(null, channelId);

      // Drain one queued /claude for this channel (max depth 1)
      const next = takeClaudeJob(channelId);
      if (next) {
        void runClaudeJob(
          next.ctx,
          next.prompt,
          channelId,
          next.explicitSessionId,
          true, // queued jobs already deferred
        ).catch((err) => {
          console.error('[ClaudeQueue] Failed to run queued job:', err);
          try {
            // deno-lint-ignore no-explicit-any
            (next.ctx as any).editReply?.({
              embeds: [{
                color: EMBED_COLORS.fail,
                title: '/claude · queue failed',
                description: err instanceof Error ? err.message : String(err),
                timestamp: true,
              }],
              components: [],
            });
          } catch { /* interaction may have expired */ }
        });
      }
    }
  }

  return {
    /**
     * /claude — Send a message to Claude. Auto-continues the session active in the
     * current channel/thread. Starts a new session only if there isn't one yet.
     * Same-channel: one waiting slot (queue); if full, busy-reject.
     * (continue/thread/enhanced still abort-replace — not queued.)
     */
    // deno-lint-ignore no-explicit-any
    async onClaude(ctx: any, prompt: string, channelId: string, explicitSessionId?: string): Promise<ClaudeResponse> {
      const existingController = deps.getClaudeController(channelId);
      if (existingController) {
        const enqueued = tryEnqueueClaudeJob(channelId, {
          ctx,
          prompt,
          explicitSessionId,
          enqueuedAt: Date.now(),
        });
        if (enqueued) {
          await ctx.deferReply();
          const queuedSessionId = explicitSessionId || deps.getSessionForChannel(channelId);
          await ctx.editReply({
            embeds: [{
              color: EMBED_COLORS.info,
              title: '/claude · queued',
              description:
                'A Claude session is already running in this channel. Your prompt will run next when it finishes. Use Cancel or `/claude-cancel` to abort the current run and drop the queue.',
              fields: [{ name: 'Prompt', value: `\`${prompt.substring(0, 1020)}\``, inline: false }],
              footer: buildSessionFooter(queuedSessionId, threadIdFor(queuedSessionId, channelId)),
              timestamp: true,
            }],
            components: cancelClaudeComponents(),
          });
          return { response: 'Queued — will run when the current session finishes.' };
        }

        await ctx.reply({
          embeds: [{
            color: EMBED_COLORS.running,
            title: '/claude · busy',
            description:
              'A Claude session is already running and one prompt is already queued. Use Cancel on the running embed or `/claude-cancel`, then try again.',
            timestamp: true,
          }],
        });
        return { response: 'A Claude session is already running in this channel (queue full).' };
      }

      return await runClaudeJob(ctx, prompt, channelId, explicitSessionId, false);
    },

    /**
     * /claude-thread — Start a brand-new session in a dedicated Discord thread.
     */
    // deno-lint-ignore no-explicit-any
    async onClaudeThread(ctx: any, prompt: string, threadName?: string): Promise<ClaudeResponse> {
      const parentChannelId = typeof ctx.getChannelId === 'function' ? ctx.getChannelId() : undefined;

      // Register/abort immediately so cancel works during defer + thread creation
      if (parentChannelId) {
        const existingController = deps.getClaudeController(parentChannelId);
        if (existingController) {
          existingController.abort();
        }
      }
      const controller = new AbortController();
      if (parentChannelId) {
        deps.setClaudeController(controller, parentChannelId);
      }

      await ctx.deferReply();

      // Create a dedicated thread for this session
      let activeSender = sendClaudeMessages;
      let threadSessionKey: string | undefined;
      let threadChannelId: string | undefined;

      if (deps.sessionThreads) {
        try {
          const threadResult = await deps.sessionThreads.createThreadSender(prompt, undefined, threadName);
          activeSender = threadResult.sender;
          threadSessionKey = threadResult.threadSessionKey;
          threadChannelId = threadResult.threadChannelId;
        } catch (err) {
          console.warn('[SessionThread] Could not create thread, falling back to main channel:', err);
        }
      }

      const channelId = threadChannelId || parentChannelId;
      // Rebind controller to the thread channel so cancel inside the thread hits the right key
      if (threadChannelId && parentChannelId && threadChannelId !== parentChannelId) {
        deps.setClaudeController(null, parentChannelId);
        deps.setClaudeController(controller, threadChannelId);
      }

      try {
        await ctx.editReply({
          embeds: [{
            color: EMBED_COLORS.running,
            title: '/claude-thread · running',
            description: threadSessionKey
              ? 'Session started in a dedicated thread — check below ↓'
              : 'Starting new session...',
            fields: [{ name: 'Prompt', value: `\`${prompt.substring(0, 1020)}\``, inline: false }],
            footer: buildSessionFooter(undefined, threadChannelId),
            timestamp: true,
          }],
          components: cancelClaudeComponents(),
        });

        let result: ClaudeResponse;
        try {
          result = await sendToClaudeCode(
            workDir,
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
            { ...deps.getQueryOptions?.(), channelId },
          );
        } catch (err) {
          if (controller.signal.aborted) {
            try {
              await ctx.editReply({
                embeds: [claudeCancelledEmbed()],
                components: [],
              });
            } catch { /* ignore */ }
            return { response: 'Cancelled' };
          }
          throw err;
        }

        if (controller.signal.aborted) {
          try {
            await ctx.editReply({
              embeds: [claudeCancelledEmbed()],
              components: [],
            });
          } catch { /* ignore */ }
          return { response: 'Cancelled', sessionId: result.sessionId };
        }

        deps.setClaudeSessionId(result.sessionId);

        // Map the thread channel → session so /claude inside the thread auto-continues
        if (threadSessionKey && result.sessionId && deps.sessionThreads) {
          deps.sessionThreads.updateSessionId(threadSessionKey, result.sessionId);
        }
        if (threadChannelId && result.sessionId) {
          deps.setSessionForChannel(threadChannelId, result.sessionId);
        }

        try {
          await ctx.editReply({
            embeds: [{
              color: EMBED_COLORS.success,
              title: '/claude-thread · done',
              description: threadChannelId
                ? `Session running in <#${threadChannelId}>.`
                : 'Response posted above.',
              fields: [{ name: 'Prompt', value: `\`${prompt.substring(0, 1020)}\``, inline: false }],
              footer: buildSessionFooter(result.sessionId, threadChannelId),
              timestamp: true,
            }],
            components: [],
          });
        } catch { /* ignore */ }

        return result;
      } finally {
        if (channelId) {
          deps.setClaudeController(null, channelId);
        }
      }
    },

    /**
     * /resume — Continue the most recent session (global, not per-channel).
     * If that session has a thread, output goes there.
     */
    // deno-lint-ignore no-explicit-any
    async onContinue(ctx: any, prompt?: string): Promise<ClaudeResponse> {
      const channelId = typeof ctx.getChannelId === 'function' ? ctx.getChannelId() : undefined;
      const existingController = deps.getClaudeController(channelId);
      if (existingController) {
        existingController.abort();
      }

      const controller = new AbortController();
      deps.setClaudeController(controller, channelId);

      try {
        const actualPrompt = prompt || "Please continue.";

        await ctx.deferReply();

        // Check if the most recent session has a thread — if so, reuse it
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

        const resumeSessionId = deps.getClaudeSessionId();
        const resumeThreadId = threadIdFor(resumeSessionId, channelId);

        await ctx.editReply({
          embeds: [{
            color: EMBED_COLORS.running,
            title: '/resume · continuing',
            description: isReusingThread
              ? 'Continuing in session thread...'
              : 'Loading latest conversation and waiting for response...',
            fields: prompt
              ? [{ name: 'Prompt', value: `\`${prompt.substring(0, 1020)}\``, inline: false }]
              : undefined,
            footer: buildSessionFooter(resumeSessionId, resumeThreadId),
            timestamp: true,
          }],
          components: cancelClaudeComponents(),
        });

        let result: ClaudeResponse;
        try {
          result = await sendToClaudeCode(
            workDir,
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
            { ...deps.getQueryOptions?.(), channelId },
          );
        } catch (err) {
          if (controller.signal.aborted) {
            try {
              await ctx.editReply({
                embeds: [claudeCancelledEmbed()],
                components: [],
              });
            } catch { /* ignore */ }
            return { response: 'Cancelled' };
          }
          throw err;
        }

        if (controller.signal.aborted) {
          try {
            await ctx.editReply({
              embeds: [claudeCancelledEmbed()],
              components: [],
            });
          } catch { /* ignore */ }
          return { response: 'Cancelled', sessionId: result.sessionId };
        }

        deps.setClaudeSessionId(result.sessionId);

        try {
          await ctx.editReply({
            embeds: [{
              color: EMBED_COLORS.success,
              title: '/resume · done',
              description: 'Response posted above. Use `/resume` or `/claude` to continue.',
              fields: prompt
                ? [{ name: 'Prompt', value: `\`${prompt.substring(0, 1020)}\``, inline: false }]
                : undefined,
              footer: buildSessionFooter(
                result.sessionId,
                threadIdFor(result.sessionId, channelId, resumeThreadId),
              ),
              timestamp: true,
            }],
            components: [],
          });
        } catch { /* ignore */ }

        return result;
      } finally {
        deps.setClaudeController(null, channelId);
      }
    },

    // deno-lint-ignore no-explicit-any
    onClaudeCancel(ctx: any): boolean {
      const channelId = typeof ctx?.getChannelId === 'function' ? ctx.getChannelId() : undefined;
      const currentController = deps.getClaudeController(channelId);
      const dropped = channelId ? clearClaudeJob(channelId) : undefined;

      if (dropped) {
        try {
          // deno-lint-ignore no-explicit-any
          (dropped.ctx as any).editReply?.({
            embeds: [{
              color: EMBED_COLORS.fail,
              title: '/claude · queue cancelled',
              description: 'Queued prompt was dropped because Cancel or `/claude-cancel` was used.',
              timestamp: true,
            }],
            components: [],
          });
        } catch { /* interaction may have expired */ }
      }

      if (!currentController && !dropped) {
        return false;
      }

      if (currentController) {
        console.log("Cancelling Claude Code session...");
        currentController.abort();
        deps.setClaudeController(null, channelId);
      }

      // Clear only this channel's session; leave global alone unless it belongs here
      if (channelId) {
        const channelSession = deps.getSessionForChannel(channelId);
        deps.setSessionForChannel(channelId, undefined);
        if (channelSession && deps.getClaudeSessionId() === channelSession) {
          deps.setClaudeSessionId(undefined);
        }
      }

      return true;
    }
  };
}
