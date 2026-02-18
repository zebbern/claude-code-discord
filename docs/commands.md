# Command Reference

## Core Claude Commands (3)

| Command | Description |
|---------|-------------|
| `/claude` | Send a prompt to Claude Code. Supports `prompt` and `session_id` options. |
| `/resume` | Resume (continue) a previous Claude conversation with an optional follow-up prompt. |
| `/claude-cancel` | Cancel the currently running Claude operation. |
| `/fast` | Toggle Opus 4.6 fast mode — 2.5x faster responses, same quality. |

## Enhanced Claude Commands (4)

| Command | Description |
|---------|-------------|
| `/claude-enhanced` | Enhanced Claude interaction with model options and streaming. |
| `/claude-models` | List all available Claude models (dynamically fetched). |
| `/claude-sessions` | Manage and view Claude conversation sessions. |
| `/claude-context` | Set additional context for Claude interactions. |

## Development Tools (7)

| Command | Description |
|---------|-------------|
| `/claude-explain` | Explain code or concepts. Options: `content`, `detail_level`, `include_examples`. |
| `/claude-debug` | Debug errors or code. Options: `error_or_code`, `language`, `context_files`. |
| `/claude-optimize` | Optimize code. Options: `code`, `focus` (speed/memory/readability/all), `preserve_functionality`. |
| `/claude-review` | Code review. Options: `code_or_file`, `review_type`, `include_security`, `include_performance`. |
| `/claude-generate` | Generate code. Options: `request`, `type` (function/class/module/test/api/config), `style`. |
| `/claude-refactor` | Refactor code. Options: `code`, `goal`, `preserve_behavior`, `add_tests`. |
| `/claude-learn` | Learn a topic. Options: `topic`, `level` (beginner/intermediate/advanced/expert), `include_exercises`, `step_by_step`. |

## Info & Control Commands (3)

| Command | Description |
|---------|-------------|
| `/claude-info` | View account info, available models, and MCP server status. Options: `section` (all/account/models/mcp). Works with or without an active session. |
| `/rewind` | Rewind file changes to a specific conversation turn. Options: `turn` (number), `dry_run` (preview changes without applying). |
| `/claude-control` | Mid-session controls. Options: `action` (interrupt/set-model/set-permissions/stop-task/status), `value`. Change model, permissions, or stop background tasks without restarting. In default/acceptEdits mode, unapproved tools trigger interactive Allow/Deny buttons. |

## Settings Commands (4)

| Command | Description |
|---------|-------------|
| `/settings` | Unified settings hub. Options: `category` (mode/claude/output/system/mcp/permissions/all), `action`, `value`. |
| `/claude-settings` | Claude-specific settings. Actions: `show`, `set-model`, `toggle-git-context`, `toggle-system-info`, `set-system-prompt`, `reset-defaults`. |
| `/output-settings` | Output formatting settings. |
| `/quick-model` | Quickly switch the active Claude model. |

## Task & Agent Management (3)

| Command | Description |
|---------|-------------|
| `/todos` | Task management. Actions: `list`, `add`, `complete`, `generate`, `prioritize`. Priority levels: low/medium/high/critical. Persists to disk. |
| `/mcp` | MCP (Model Context Protocol) server management. Actions: `list`, `add`, `remove`, `test`, `status`, `toggle`, `reconnect`. Reads from `.claude/mcp.json`. Toggle/reconnect work mid-session. |
| `/agent` | Run specialized AI agents. Actions: `list`, `start`, `stop`, `status`. 7 built-in agents. |

## Git Operations (6)

| Command | Description |
|---------|-------------|
| `/git` | Run git commands from Discord. |
| `/worktree` | Create a new git worktree with its own Discord channel. |
| `/worktree-list` | List all active worktrees. |
| `/worktree-remove` | Remove a worktree and its channel. |
| `/worktree-bots` | Manage bot instances per worktree. |
| `/worktree-kill` | Kill a worktree bot instance. |

## Shell Management (4)

| Command | Description |
|---------|-------------|
| `/shell` | Execute shell commands on the host. |
| `/shell-input` | Send input to a running shell process. |
| `/shell-list` | List active shell processes. |
| `/shell-kill` | Kill a running shell process. |

## System Monitoring (11)

| Command | Description |
|---------|-------------|
| `/system-info` | System information overview. |
| `/processes` | List running processes. |
| `/system-resources` | CPU, memory, and disk usage. |
| `/network-info` | Network configuration and connections. |
| `/disk-usage` | Detailed disk usage analysis. |
| `/env-vars` | View environment variables (filtered for safety). |
| `/system-logs` | View system logs. |
| `/port-scan` | Scan for open ports. |
| `/service-status` | Check service status. |
| `/uptime` | System uptime. |
| `/screenshot` | Capture a screenshot of the host display. Options: `delay`. |

## Utilities (4)

| Command | Description |
|---------|-------------|
| `/status` | Bot status and health check. |
| `/pwd` | Show current working directory. |
| `/shutdown` | Gracefully stop the bot. |
| `/help` | Show all available commands. |
