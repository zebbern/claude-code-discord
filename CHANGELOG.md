# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- `/mcp` - Model Context Protocol server management (reads from `.mcp.json`)
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
- Reads server configurations from standard `.mcp.json` file
- Add/remove/test/list MCP servers via Discord commands
- Cross-platform command testing (Windows `where` / Unix `which`)

### Technical Details
- Built with Deno 2.x and TypeScript
- Uses Discord.js 14.14.1
- Claude API via @anthropic-ai/claude-code

---

[1.0.0]: https://github.com/zebbern/claude-code-discord/releases/tag/v1.0.0
