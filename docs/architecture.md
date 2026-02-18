# Architecture

## Project Structure

```
Devonz/
├── index.ts                    # Entry point, Discord client setup
├── deno.json                   # Deno configuration
├── .env                        # Environment variables (not committed)
├── .claude/mcp.json            # MCP server configuration
│
├── claude/                     # Claude SDK integration
│   ├── client.ts               # SDK query execution, streaming
│   ├── enhanced-client.ts      # Model discovery, session manager
│   ├── command.ts              # /claude, /continue, /claude-cancel handlers
│   ├── message-converter.ts    # SDK JSON stream → Discord message format
│   ├── model-fetcher.ts        # Dynamic model fetching (API + CLI)
│   ├── query-manager.ts        # Active query lifecycle, mid-session controls
│   └── info-commands.ts        # /claude-info, /rewind, /claude-control
│
├── core/                       # Core bot infrastructure
│   ├── handler-registry.ts     # Command routing, query options builder
│   └── ...
│
├── discord/                    # Discord integration layer
│   ├── sender.ts               # Message sending, embeds, streaming
│   └── ...
│
├── settings/                   # Settings management
│   ├── unified-settings.ts     # Settings state, defaults, persistence
│   └── unified-handlers.ts     # Settings command handlers, UI
│
├── util/                       # Utilities
│   ├── version-check.ts        # Startup version comparison
│   └── ...
│
├── docs/                       # Documentation
│   ├── setup-discord.md        # Discord bot setup tutorial
│   ├── installation.md         # Installation guide
│   ├── commands.md             # Command reference
│   ├── features.md             # Feature details
│   ├── architecture.md         # This file
│   ├── docker.md               # Docker guide
│   └── updating.md             # Update instructions
│
├── Dockerfile                  # Container: Deno + Node.js + Claude CLI
├── docker-compose.yml          # Docker Compose configuration
└── .github/
    └── workflows/
        └── docker-publish.yml  # GHCR image publishing
```

## SDK Integration

Built on `@anthropic-ai/claude-agent-sdk` v0.2.45.

### Data Flow

```
Discord Message
  → handler-registry.ts (route command, build options)
  → enhanced-client.ts (create SDK query)
  → claude-agent-sdk (streaming async generator)
  → message-converter.ts (SDK JSON → ClaudeMessage)
  → discord/sender.ts (send/update Discord embeds)
```

### Key SDK Features Used

| Feature | Implementation |
|---------|---------------|
| Streaming | `Query` async generator yields `SDKMessage` objects |
| Models | `query.supportedModels()` for runtime discovery |
| Agents | `AgentDefinition` with system prompts passed via `agents` option |
| Permissions | `query.setPermissionMode()` for mid-session changes |
| Model Swap | `query.setModel()` for mid-session model changes |
| Rewind | `query.rewindFiles(messageId)` for file change rollback |
| Info | `query.accountInfo()`, `query.initializationResult()` |
| MCP | `query.mcpServerStatus()`, `query.setMcpServers()` |
| Interrupts | `query.interrupt()` for cancellation |
| Sessions | `persistSession: true` for conversation continuity |

### Settings Pipeline

```
User sets value via /settings
  → unified-settings.ts (update + persist)
  → handler-registry.ts getQueryOptions() reads settings
  → ClaudeModelOptions built with all current values
  → enhanced-client.ts passes to SDK query
```

Settings include: model, thinking mode, effort level, system prompt, operation mode, git context, output format, sandbox mode, file checkpointing, 1M context beta.
