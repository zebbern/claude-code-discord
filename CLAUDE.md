# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Runtime & Commands

This project uses **Deno** (not Node.js). All commands use `deno task` or `deno run`.

```bash
deno task start          # Run the bot
deno task dev            # Run with hot reload (--watch)
deno task lint           # Lint with deno lint
deno task fmt            # Format with deno fmt
deno task check          # Type-check index.ts and all imports
```

There is no test suite yet. Type-checking is the primary correctness gate: `deno task check` catches import errors, type mismatches, and structural issues across the full module graph.

## Architecture

The bot is a Discord slash-command interface to the Claude Code SDK (`@anthropic-ai/claude-agent-sdk`).

### Data flow for a Claude query

```
Discord slash command
  → core/handler-registry.ts   (route command, build ClaudeModelOptions from settings)
  → claude/enhanced-client.ts  (create SDK Query, manage session lifecycle)
  → claude-agent-sdk            (streaming async generator of SDKMessage objects)
  → claude/message-converter.ts (SDK JSON → ClaudeMessage internal format)
  → discord/sender.ts          (stream updates to Discord as embeds)
```

### Module responsibilities

| Directory | Responsibility |
|-----------|---------------|
| `claude/` | All Claude SDK integration: query execution, streaming, model discovery, mid-session controls (interrupt, rewind, model swap, permission change), AskUserQuestion, permission prompts, hooks |
| `core/` | Bot wiring: config loading, factory functions for all handler creation, dependency injection, graceful shutdown |
| `discord/` | Discord.js wrapper: bot lifecycle, message sending/embedding, pagination, thread-per-session management |
| `settings/` | Persistent bot settings: model, thinking mode, effort level, system prompt, sandbox mode, etc. |
| `git/` | `/git` commands and worktree management |
| `shell/` | `/shell` command with ShellManager |
| `agent/` | `/agent` command (custom AgentDefinition) |
| `screenshot/` | `/screenshot` command |
| `system/`, `util/`, `help/`, `process/` | System info, utilities, help text, crash handling |

### Settings pipeline

`/settings` → `settings/unified-settings.ts` (persist) → `core/handler-registry.ts` `getQueryOptions()` reads all current values → `ClaudeModelOptions` passed to `claude/enhanced-client.ts` on each query.

### Adding a new slash command

1. Define the command (name, description, options) in the feature module's `commands.ts`
2. Create a handler factory function accepting `HandlerRegistryDeps`
3. Export command + handler from the module's `index.ts`
4. Import and wire both into `core/handler-registry.ts` (`getAllCommands()` + `createAllHandlers()`)

### Project resolution

Each Discord thread or channel can be bound to a specific git repository directory ("project"). When a bound channel receives a Claude command or free-form message, the SDK runs with that directory as `cwd`.

**Resolution chain** (first match wins):
1. Direct binding for the current thread/channel (set via `/project bind` or `/claude-thread dir:`)
2. Parent channel binding (for threads under a bound text channel)
3. Global default: the directory the bot was launched from

**Binding management:** `/project bind|unbind|show|list`

**Operational side effects of changing `cwd`:**
- `.claude/mcp.json` is read from the project directory
- `.claude/settings*.json` project-scoped settings are loaded from the project directory
- `.claude/agents/` and `.claude/hooks/` are discovered from the project directory

This is intentional — a "project" is genuinely defined by its `cwd`-scoped config.

**Known limitation:** If `MONITOR_CHANNEL_ID` points to a different channel than the bot's main channel, `/project bind` cannot be run there (Discord routes commands only to the bot's main channel/threads). To use project bindings with monitor alerts, set `MONITOR_CHANNEL_ID` to the bot's main channel ID.

### AWS Bedrock backend

Set `CLAUDE_CODE_USE_BEDROCK=1` plus AWS credentials (static keys, profile, or IAM role). When active, the bot uses `us.anthropic.*` cross-region inference profile IDs and `ANTHROPIC_API_KEY` is not required. See `.env.example` for the full variable list.

## Known limitations

### Free-form messaging (`MessageCreate` handler)
Plain text typed in the bot's channel or any thread under it triggers Claude without a slash command.

- **Session memory is in-memory only**: bot restart wipes all channel→session bindings. Users must re-run `/claude` or `/claude-thread` to re-establish a session after restart.
- **`/claude-thread` placeholder window**: if a user sends a free-form message in a `/claude-thread` thread *while the thread is still being created* (between Discord thread creation and the first response), they will see a ⌛ reaction and the message is ignored. This window is typically 1–3 seconds.
- **AskUser/permission routing during cancel+restart**: if `/claude-cancel` is called while Claude is waiting for a user to click an AskUserQuestion or permission-request button, and a new `/claude-thread` is started immediately after, the stale permission/question prompt may route to the old thread for the duration of Discord's component timeout before falling back. This is a known edge case with no practical workaround short of making Discord collectors abort-aware.
- **Global single-run model**: the bot runs one Claude query at a time globally. All commands and free-form messages in *any* channel are blocked (⌛) while a `/claude-thread` is in its startup window. After the session is established (a few seconds), only the originating channel is blocked.
- **Project binding and cross-channel `/resume`**: when a plain `/claude` session (no dedicated thread) is started in channel A and then resumed via `/resume` or `/claude session_id:...` from a different channel, the resumed run uses the *invoking channel's* project binding rather than channel A's. This only affects explicit cross-channel resumes of non-thread sessions. Sessions started via `/claude-thread` are not affected — their cwd is resolved from the session thread's channel id.

### AskUser/permission button routing
`getActiveSessionChannel()` in `index.ts` routes AskUser and permission-request buttons to the most recently active session thread. If multiple sessions are running concurrently (not possible today with the single-run model, but relevant if that changes), buttons may appear in the wrong channel.

## Key files

- `index.ts` — entry point; bootstraps Discord client and wires all modules
- `core/handler-registry.ts` — central hub; builds `ClaudeModelOptions` and routes every command
- `claude/client.ts` — raw SDK query execution and streaming loop
- `claude/enhanced-client.ts` — session manager, model discovery, per-session state
- `settings/unified-settings.ts` — settings state, defaults, disk persistence
- `discord/session-threads.ts` — thread-per-session lifecycle (create, reuse, close)
