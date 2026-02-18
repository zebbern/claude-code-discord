# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- Claude API via @anthropic-ai/claude-code (deprecated; see v2.0.0 for migration)

---

[2.0.0]: https://github.com/zebbern/claude-code-discord/releases/tag/v2.0.0
[1.0.0]: https://github.com/zebbern/claude-code-discord/releases/tag/v1.0.0
