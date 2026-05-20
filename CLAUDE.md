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

### AWS Bedrock backend

Set `CLAUDE_CODE_USE_BEDROCK=1` plus AWS credentials (static keys, profile, or IAM role). When active, the bot uses `us.anthropic.*` cross-region inference profile IDs and `ANTHROPIC_API_KEY` is not required. See `.env.example` for the full variable list.

## Key files

- `index.ts` — entry point; bootstraps Discord client and wires all modules
- `core/handler-registry.ts` — central hub; builds `ClaudeModelOptions` and routes every command
- `claude/client.ts` — raw SDK query execution and streaming loop
- `claude/enhanced-client.ts` — session manager, model discovery, per-session state
- `settings/unified-settings.ts` — settings state, defaults, disk persistence
- `discord/session-threads.ts` — thread-per-session lifecycle (create, reuse, close)
