# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.5.0] - 2026-08-01

First published release after v2.3.0. Consolidates security/stability work previously drafted as 2.4.x plus Discord UX improvements.

### Security
- **`/git` argv spawn**: Git commands and worktree ops use `Deno.Command` argument arrays instead of shell `exec` / POSIX `shellEscape` (Audit #2 mitigation). Soft metacharacter validation kept as defense-in-depth; quote-aware tokenization so `commit -m "msg"` still works.
- **Worktree branch validation**: Reject shell metacharacters and invalid ref patterns in `/worktree` branch names.
- **Shell output cap**: Truncate at 10 MB and kill the runaway process (prevents OOM / infinite `yes`-style floods).

### Added
- **Same-channel `/claude` queue**: One waiting prompt per channel while busy; further calls stay busy-rejected. Cancel drops the queue.
- **Truncation → `.txt` attach**: When embed formatters truncate, full payload is attached as a text file (shell/git, system commands, expand paths).
- **Cancel on running embeds**: Danger Cancel button on `/claude`, queued, `/claude-thread`, and `/resume` status embeds (same as `/claude-cancel`).
- **Session footer**: Short session id (+ thread mention when mapped) on Claude status embeds; completion edits clear the Cancel button.
- **Compact `/shell` / `/git` cards**: Shared embed theme; meta in fields, payload-only description; no double code fences.
- **AGENTS.md**: Agent guidelines for this repo (verification, claimed-vs-wired, concurrency, testing policy).

### Fixed
- **Per-channel Claude isolation**: Concurrent `/claude` in different channels no longer share one AbortController / active query; cancel and mid-session controls are channel-scoped.
- **MCP mid-session channelId**: `/mcp toggle` and `/mcp reconnect` target the active query in the invoking channel.
- **`/claude-thread` cancel window**: AbortController is registered before defer/thread create so cancel works during setup.
- **Haiku fallback timeout**: Rate-limit Haiku retry uses the same timeout / `clearTimeout` / active-query clear pattern as the primary query race.
- **Update check false positives**: No longer treat "local ahead of GitHub" as an update; avoid duplicate Update Available embeds on startup.
- **Docker SDK-only image**: Removed Node.js/npm and `@anthropic-ai/claude-code` CLI from the Dockerfile (bot uses `@anthropic-ai/claude-agent-sdk` via Deno).
- **Docker version-check false positives**: Bake `GIT_COMMIT` at build time; prefer `BOT_GIT_COMMIT` / `GIT_COMMIT` over a fake `/app` git repo.
- **Busy `/claude`**: Same-channel overlap no longer silently aborts; shows busy/queue messaging instead.

### Changed
- Docker auth is API-key only: **`ANTHROPIC_API_KEY` required** in Docker (compose, README, `docs/docker.md`).
- Embed titles drop decorative emoji; status signaled by color and short labels.
- `/shell` / `/git` result titles are command-scoped (`/shell`, `/git`) with exit/duration in fields.

## [2.3.0] - 2026-03-03

### Added
- **Channel Monitoring** (#17): Watch a Discord channel for bot/webhook messages and auto-trigger a Claude investigation in a thread. Messages are batched over a 30-second debounce window. Requires `MONITOR_CHANNEL_ID` and `MONITOR_BOT_IDS` env vars and the Message Content privileged intent.
- **Thread-per-Session** (#19): New `/claude-thread` command starts each conversation in a dedicated Discord thread with a custom name.
- **Per-Channel Session Tracking**: Regular `/claude` commands in the same channel automatically reuse the last session — no need to pass `session_id` manually.
- **Custom Thread Names**: `/claude-thread name:"Fix auth bug" prompt:"Review the auth module"` creates a thread titled "Fix auth bug".
- **Thread-Aware Channel Detection**: Commands work correctly inside session threads (bot recognizes the parent channel).

### Changed
- `discord/session-threads.ts` added — `SessionThreadManager` handles thread creation, lookup, and lifecycle
- `discord/types.ts` — `InteractionContext` now exposes `getChannelId()` for per-channel session mapping
- `core/handler-registry.ts` — `channelSessionMap` maintains channel → session mapping
- `.env.example` updated with Channel Monitoring section

## [2.2.0] - 2025-07-18

### Added
- **Version in /status**: Shows bot version (e.g. `v2.2.0`) and update status in the `/status` embed
- **Periodic Update Checks**: Automatically checks for updates every 12 hours and notifies in Discord
- **Semver in Startup Embed**: Startup message now shows version number
- **BOT_VERSION Export**: `deno.json` version read at startup and available throughout codebase

### Changed
- **Dockerfile Optimized**: Removed unnecessary Node.js and `@anthropic-ai/claude-code` CLI install — bot uses SDK directly via Deno imports, reducing image size

### Fixed
- `deno.json` version bumped from `1.0.0` to `2.2.0` (was not updated for v2.1.0)
- CHANGELOG legacy reference to deprecated CLI corrected to `@anthropic-ai/claude-agent-sdk`

## [2.1.0] - 2025-07-17

### Added
- **Interactive Permission Requests**: Allow/Deny buttons in Discord when Claude wants to use an unapproved tool (replaces CLI TUI prompt, makes `default` and `acceptEdits` modes fully usable)
- **Settings Autocomplete**: `/settings` action and value fields now show dropdown suggestions based on selected category
- **Fast Mode** (`/fast`): Toggle Opus 4.6 speed-optimized API config (2.5x faster, same quality)
- **AskUserQuestion Handler**: Claude can now ask clarifying questions mid-session via Discord buttons
- **Startup Buttons**: Quick-action buttons on the startup embed (Status, Sessions, Help, Shutdown)
- **MCP Mid-Session Management** (`/mcp toggle`, `/mcp reconnect`): Enable/disable or reconnect MCP servers without restarting
- **Granular Sandbox Config**: Full SDK SandboxSettings support (network rules, filesystem ACLs, excluded commands, violation ignoring)
- **Additional Directories**: Multi-repo access via `additionalDirectories` setting
- **Fork Session**: Branch conversations into new sessions via `forkSession` option
- **Hooks System**: Passive SDK callbacks for tool use, notification, and task completion observability
- **stopTask()**: Stop background tasks mid-session via `/claude-control action:stop-task`
- **Agent Teams**: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` env var support with `delegate` permission mode
- **stop_reason Display**: Shows why Claude stopped (end_turn, max_tokens, stop_sequence) in completion embeds
- **Tasks Env Var**: `CLAUDE_CODE_ENABLE_TASKS=1` automatically set for background task support
- **Known Issues Documentation**: `docs/known-issues.md` documenting 22 accepted risks

### Changed
- `/continue` renamed to `/resume` for clarity
- `/claude-settings` and `/output-settings` removed — consolidated into `/settings` (use `category:claude` or `category:output`)
- Button UX overhaul: consistent styling, proper disabled states, contextual labels
- Settings display now shows SDK features (hooks, agent teams, sandbox config, additional dirs)
- Help system updated with all new command documentation

### Fixed
- Getter pattern for `claudeController` prevents stale abort controller references
- Abort state checks prevent sending to cancelled sessions
- Continue button properly resumes the last session
- Pagination titles show correct page info
- Unicode-safe message splitting prevents mid-codepoint truncation

## [2.0.0] - 2026-02-18

### Breaking Changes
- Migrated from deprecated `@anthropic-ai/claude-code` to `@anthropic-ai/claude-agent-sdk` v0.2.45
- Default model no longer hardcoded; SDK auto-selects the best available model

### Added
- **Mid-Session Controls** (`/claude-control`): interrupt, change model, change permissions without restarting
- **File Rewind** (`/rewind`): undo file changes to any conversation turn with dry-run preview
- **Structured Output**: force JSON responses matching a configurable schema
- **Info Commands** (`/claude-info`): view account info, available models, MCP server status
- **Dynamic Model Discovery**: auto-fetches models from Anthropic API and CLI at startup
- **1M Token Context Beta**: opt-in extended context window
- **File Checkpointing**: enables rewind support for file changes
- **Sandbox Mode**: run Claude in a sandboxed environment
- **Startup Version Check**: compares local commit vs GitHub, sends Discord notification if behind
- **GHCR Docker Publishing**: GitHub Actions workflow builds and pushes images on every push to main
- **Watchtower Support**: auto-update Docker containers when new images are published
- **DRY Documentation**: README slimmed to hub, 7 focused doc files in `/docs`
- **OS-Specific Install Guides**: separate instructions for Linux/macOS, Windows, Docker

### Changed
- SDK integration uses `AsyncGenerator<SDKMessage>` streaming instead of CLI subprocess
- Agents converted to native SDK `AgentDefinition` format
- Normal permission mode uses `acceptEdits` instead of `default`
- All settings (thinking, effort, system prompt, permissions, git context) now wired to SDK
- Dockerfile includes Node.js 20 and Claude CLI
- `ANTHROPIC_API_KEY` passthrough added to Docker Compose

### Fixed
- Duplicate "Claude Code Complete" embeds per query
- Model default causing rate limit fallback to haiku
- Settings not being passed through to SDK queries

## [1.0.0] - 2026-02-05

### 🎉 First Public Release

This is the first stable release of Claude Code Discord Bot - a Discord bot that brings Claude AI capabilities to your Discord server.

### Features

#### Core Commands
- `/claude` - Chat with Claude AI with thinking modes
- `/continue` - Continue previous conversations
- `/claude-cancel` - Cancel ongoing requests

#### Enhanced Claude
- `/claude-enhanced` - Advanced Claude with model selection
- `/claude-models` - List available Claude models
- `/claude-sessions` - Manage conversation sessions
- `/claude-context` - View and manage context

#### Development Tools
- `/claude-explain` - Get code explanations
- `/claude-debug` - Debug code issues
- `/claude-optimize` - Optimize code performance
- `/claude-review` - Code review assistant
- `/claude-generate` - Generate code snippets
- `/claude-refactor` - Refactor code
- `/claude-learn` - Learn programming concepts

#### Task Management
- `/todos` - Task management with priorities and persistence
- `/mcp` - Model Context Protocol server management (reads from `.claude/mcp.json`)
- `/agent` - 7 specialized AI agents

#### Settings
- `/settings` - Unified settings management
- `/claude-settings` - Claude-specific settings
- `/output-settings` - Output formatting options
- `/quick-model` - Quick model switching

#### Git Operations
- `/git` - Execute git commands
- `/worktree` - Create git worktrees
- `/worktree-list` - List all worktrees
- `/worktree-remove` - Remove worktrees
- `/worktree-bots` - Manage worktree bots
- `/worktree-kill` - Kill worktree processes

#### Shell Management
- `/shell` - Execute shell commands
- `/shell-input` - Send input to running processes
- `/shell-list` - List running processes
- `/shell-kill` - Kill processes

#### System Monitoring
- `/system-info` - System information
- `/processes` - Process listing
- `/system-resources` - Resource usage
- `/network-info` - Network information
- `/disk-usage` - Disk space info
- `/env-vars` - Environment variables
- `/system-logs` - System logs
- `/port-scan` - Port scanning
- `/service-status` - Service status
- `/uptime` - System uptime
- `/screenshot` - Capture screen (Windows/macOS/Linux GUI)

#### Utilities
- `/status` - Bot status
- `/pwd` - Current directory
- `/shutdown` - Graceful shutdown
- `/help` - Command help

#### AI Agents
7 specialized AI agents for different development tasks:
- **Code Reviewer** - Quality analysis and security review
- **Software Architect** - System design and architecture
- **Debug Specialist** - Bug analysis and troubleshooting
- **Security Analyst** - Vulnerability assessment
- **Performance Engineer** - Optimization and profiling
- **DevOps Engineer** - Deployment and infrastructure
- **General Assistant** - Multi-purpose development help

### Infrastructure
- **Docker Support** - Production-ready Dockerfile and docker-compose.yml
- **Cross-Platform** - Windows, macOS, and Linux support
- **Persistence** - Todos, sessions, and settings persist across restarts
- **Branch-Aware** - Automatic channel organization by git branch
- **Secure** - Runs as non-root user in Docker, resource limits

### MCP (Model Context Protocol) Support
- Reads server configurations from standard `.claude/mcp.json` file
- Add/remove/test/list MCP servers via Discord commands
- Cross-platform command testing (Windows `where` / Unix `which`)

### Technical Details
- Built with Deno 2.x and TypeScript
- Uses Discord.js 14.14.1
- Claude API via @anthropic-ai/claude-agent-sdk

---

[2.5.0]: https://github.com/zebbern/claude-code-discord/releases/tag/v2.5.0
[2.3.0]: https://github.com/zebbern/claude-code-discord/releases/tag/v2.3.0
[2.2.0]: https://github.com/zebbern/claude-code-discord/releases/tag/v2.2.0
[2.1.0]: https://github.com/zebbern/claude-code-discord/releases/tag/v2.1.0
[2.0.0]: https://github.com/zebbern/claude-code-discord/releases/tag/v2.0.0
[1.0.0]: https://github.com/zebbern/claude-code-discord/releases/tag/v1.0.0
