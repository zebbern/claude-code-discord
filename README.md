<div align="center">

# claude-code-discord

**Run Claude Code from Discord — with full SDK integration, agents, rewind, mid-session controls, and 45+ slash commands.**

<kbd>

| Feature                                     | Details                                                                                     | Status |
|---------------------------------------------|---------------------------------------------------------------------------------------------|:------:|
| Use Claude Code Anywhere                    | Host locally (VM / Docker / cloud) and send commands via the Discord API                    | ✅     |
| Full SDK Integration                        | Built on `@anthropic-ai/claude-agent-sdk` v0.2.45 with native agent support                 | ✅     |
| Centralized collaboration                   | Run commands and discuss results where your team already communicates                       | ✅     |
| Branch-aware organization                   | Maps Git branches to channels/categories so feature work stays separated                    | ✅     |
| Mid-session controls                        | Interrupt, change model, change permissions, and rewind — all without restarting             | ✅     |
| 7 Specialized AI Agents                     | Code reviewer, architect, debugger, security analyst, performance engineer, DevOps, general  | ✅     |
| Dynamic model discovery                     | Auto-fetches available models from Anthropic API and CLI                                     | ✅     |
| Structured output mode                      | Get JSON responses matching a configurable schema                                            | ✅     |
| Advanced thinking modes                     | Standard, think, think-hard, ultrathink — with configurable effort and budget                | ✅     |
| Role-based access control                   | Restrict destructive commands (`/shell`, `/git`, worktree ops) to specific Discord roles    | ✅     |
| Local hosting & security                    | Keep keys and code on your infra while exposing a controlled interface through Discord      | ✅     |
| Audit trail & accountability                | Channel history provides an easy-to-search record of who ran what and when                  | ✅     |

</kbd>

</div>

<br>

**Start Here If You Have These:**
<kbd>DISCORD_TOKEN</kbd>
<kbd>APPLICATION_ID</kbd>

- **[Quick Start](#pre)** 
- **[Full Command Reference (45+ Commands)](#command-reference)** 

**Tutorial If you don't have them — follow these first then come back:**
- **[How To Setup Discord Bot?](#setup)**

---

### Quick Model Switching

```
/claude-settings action:set-model value:opus
/claude-settings action:set-model value:sonnet
/claude-settings action:set-model value:haiku
```

### Preview
<img width="350" height="350" alt="image" src="https://github.com/user-attachments/assets/e8091420-d271-48a4-8e55-279f2093d3ae" />

---

<h2 id="pre">Quick Start</h2>

### Option 1: Docker (Recommended — Most Secure)

```bash
git clone https://github.com/zebbern/claude-code-discord.git
cd claude-code-discord
cp .env.example .env
# Edit .env with your DISCORD_TOKEN and APPLICATION_ID
docker compose up -d
```

**Docker Commands:**
```bash
docker compose up -d            # Start
docker compose logs -f          # View logs
docker compose down             # Stop
docker compose build --no-cache && docker compose up -d  # Rebuild
```

**Why Docker?**
- 🔒 Isolated container — no direct host system access
- 🛡️ Non-root security mode
- 📦 Zero dependencies — everything bundled
- 🔄 Auto-restart on crashes
- 💾 Persistent storage across restarts
- ⚙️ Resource limits (2 CPU, 2GB RAM max)

---

### Option 2: One-Command Setup

**Linux/macOS:**
```bash
git clone https://github.com/zebbern/claude-code-discord.git
cd claude-code-discord
chmod +x setup.sh && ./setup.sh
```

**Windows PowerShell:**
```powershell
git clone https://github.com/zebbern/claude-code-discord.git
cd claude-code-discord
.\setup.ps1
```

The setup script will:
- ✅ Install Deno (if needed)
- ✅ Install Claude CLI (if needed)  
- ✅ Create `.env` file with your tokens
- ✅ Initialize git repository (if needed)
- ✅ Offer to start the bot immediately

---

### Option 3: Manual Setup

**Install Deno via [Deno's Website](https://deno.com/) or:**
```bash
# Linux/MacOS
curl -fsSL https://deno.land/install.sh | sh

# Windows PowerShell
irm https://deno.land/install.ps1 | iex
```

**Clone and configure:**
```bash
git clone https://github.com/zebbern/claude-code-discord.git
cd claude-code-discord
cp .env.example .env
# Edit .env with your DISCORD_TOKEN and APPLICATION_ID
```

**Install Claude CLI and login:**
```bash
npm install -g @anthropic-ai/claude-code
claude /login
```

**Run the bot:**
```bash
# Using .env file (recommended)
deno task start

# With environment variables
export DISCORD_TOKEN="your-token"
export APPLICATION_ID="your-app-id"
deno run --allow-all index.ts

# Development mode (hot reload)
deno task dev
```

**Optional flags:**
```bash
# Custom category and user mentions
deno run --allow-all index.ts --category myproject --user-id YOUR_DISCORD_ID
```

> If you get `not a git directory`, run `git init` first.

---

### Configuration (.env file)

```env
# Required
DISCORD_TOKEN=your_bot_token_here
APPLICATION_ID=your_application_id_here

# Optional
USER_ID=your_discord_user_id          # Get mentioned when Claude finishes
CATEGORY_NAME=claude-code             # Discord category for channels
WORK_DIR=/path/to/project             # Working directory (default: current)
```

Environment variables take precedence over `.env` file settings.

<img width="250" height="250" alt="image" src="https://github.com/user-attachments/assets/2fea008b-76b7-48d8-9a87-8214cc7a24ad" />

---

<h1 id="setup">Setup Discord Bot</h1>

<h2 id="1">1. Create a Discord Application</h2>

> [!Note]
> - Go to the [Discord Developer Portal](https://discord.com/developers/applications)
> - Click <kbd>New Application</kbd>
> - Give your application a name (e.g., <kbd>ClaudeCode</kbd>)
> - Click <kbd>Create</kbd>
> <img width="500" height="500" alt="app-create" src="https://github.com/user-attachments/assets/ee8bdf4e-9bbf-4d01-8046-a182ca6d5da9" />

<h2 id="2">2. Copy Application ID (Needed For Config)</h2>

> [!Note]
> - Go to the <kbd>General Information</kbd> → Copy <kbd>Application ID</kbd> section
> <img width="800" height="500" alt="APPLICATION_ID" src="https://github.com/user-attachments/assets/3ad02111-0a9f-4f0f-8a77-d61841f6dd27" />

<h2 id="3">3. Create a Bot User</h2>

> [!Note]
> - In your application, go to the <kbd>Bot</kbd> section in the left sidebar
> - Click <kbd>Add Bot</kbd>
> - Under <kbd>Token</kbd> click <kbd>Copy</kbd> to copy your bot token (keep this secure!)
> - Click <kbd>Save Changes</kbd>
> <img width="800" height="500" alt="image" src="https://github.com/user-attachments/assets/0621b5ed-c4b4-44e3-a3f6-fe678f6893c3" />

<h2 id="4">4. Invite the Bot to Your Server</h2>

> [!Note]
> - Go to the <kbd>OAuth2</kbd> → <kbd>URL Generator</kbd> section
> - Under <kbd>Scopes</kbd> select:
> ```
> + | bot
> + | applications.commands
> ```
> - Under <kbd>Bot Permissions</kbd> select:
> ```
> + | Send Messages
> + | Use Slash Commands
> + | Read Message History
> + | Embed Links
> ```
> Copy the generated URL and open it in your browser
> Select your Discord server and authorize the bot
> <img width="800" height="500" alt="oauth2" src="https://github.com/user-attachments/assets/3e1fe004-1ae5-4078-b1a4-882a11bc68cd" />
> <img width="800" height="500" alt="botallowcommands" src="https://github.com/user-attachments/assets/9cd92467-2f3d-4c03-abb0-9f10ec979a1b" />
> <img width="800" height="500" alt="image" src="https://github.com/user-attachments/assets/697f6f52-fe37-4885-b492-5d660f23596d" />

---

<h1 id="command-reference">Command Reference (45+ Commands)</h1>

## Core Claude Commands (3)

| Command | Description |
|---------|-------------|
| `/claude` | Send a prompt to Claude Code. Supports `prompt` and `session_id` options. |
| `/continue` | Continue a previous Claude conversation with an optional follow-up prompt. |
| `/claude-cancel` | Cancel the currently running Claude operation. |

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

## Info & Control Commands (3) — NEW

| Command | Description |
|---------|-------------|
| `/claude-info` | View account info, available models, and MCP server status. Options: `section` (all/account/models/mcp). Works with or without an active session. |
| `/rewind` | Rewind file changes to a specific conversation turn. Options: `turn` (number), `dry_run` (preview changes without applying). |
| `/claude-control` | Mid-session controls. Options: `action` (interrupt/set-model/set-permissions/status), `value`. Change model or permissions without restarting. |

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
| `/mcp` | MCP (Model Context Protocol) server management. Actions: `list`, `add`, `remove`, `test`, `status`. Reads from `.mcp.json`. |
| `/agent` | Run specialized AI agents. Actions: `list`, `start`, `stop`, `status`. 7 built-in agents (see below). |

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

---

## Feature Details

### Thinking Modes

Control how deeply Claude reasons about problems:

| Mode | Description |
|------|-------------|
| `none` | Standard responses — no extended thinking |
| `think` | Step-by-step reasoning |
| `think-hard` | Deep analysis with higher budget |
| `ultrathink` | Maximum depth thinking for complex problems |

Configure via `/settings category:mode action:set-thinking value:<mode>`

### Operation Modes

| Mode | Description |
|------|-------------|
| `normal` | Standard operation — auto-accepts edits, prompts for dangerous commands |
| `plan` | Planning mode — Claude analyzes and plans but doesn't execute |
| `auto-accept` | Automatically apply all suggested changes |
| `danger` | Unrestricted mode — bypasses all safety checks (use with caution) |

### Effort Levels

| Level | Description |
|-------|-------------|
| `low` | Quick, concise responses |
| `medium` | Balanced depth (default) |
| `high` | Thorough, detailed analysis |

### Advanced SDK Features

| Feature | Toggle Command |
|---------|---------------|
| 1M Token Context | `/settings category:mode action:toggle-1m` |
| File Checkpointing | `/settings category:mode action:toggle-checkpoint` |
| Sandbox Mode | `/settings category:mode action:toggle-sandbox` |
| Structured Output | `/settings category:mode action:toggle-structured-output` |
| Custom JSON Schema | `/settings category:mode action:set-output-schema value:{...}` |

### Agent System

7 specialized AI agents, each with tailored system prompts, operation modes, and SDK `AgentDefinition` format:

| Agent | Specialty | Risk Level |
|-------|-----------|------------|
| Code Reviewer | Quality analysis, security, best practices | Low |
| Software Architect | System design, architecture patterns, ADRs | Medium |
| Debug Specialist | Bug analysis, troubleshooting, root cause analysis | Medium |
| Security Analyst | Vulnerability assessment, OWASP compliance | Low |
| Performance Engineer | Optimization, profiling, benchmarking | Medium |
| DevOps Engineer | Deployment, CI/CD, infrastructure | High |
| General Assistant | Multi-purpose development help | Low |

```
/agent action:list
/agent action:start agent_name:code-reviewer message:"Review my auth module"
```

### MCP Server Management

Manage Model Context Protocol servers directly from Discord:

```
/mcp action:list
/mcp action:add server_name:filesystem command:npx args:-y @anthropic-ai/filesystem-mcp
/mcp action:status
```

Or edit `.mcp.json` directly:
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/filesystem-mcp"],
      "description": "Local filesystem access"
    }
  }
}
```

### Mid-Session Controls

Control an active Claude session without restarting:

```
/claude-control action:interrupt              # Stop current processing
/claude-control action:set-model value:opus   # Switch model mid-conversation
/claude-control action:set-permissions value:plan  # Switch to plan mode
/claude-control action:status                 # Check active session state
```

### File Rewind

Undo file changes made during a conversation:

```
/rewind                          # List conversation turns
/rewind turn:3 dry_run:true      # Preview what would change at turn 3
/rewind turn:3                   # Rewind files to turn 3
```

### Structured Output

Get Claude responses as structured JSON:

```
/settings category:mode action:toggle-structured-output
/settings category:mode action:set-output-schema value:{"type":"object","properties":{"answer":{"type":"string"},"confidence":{"type":"number"}}}
```

---

## Architecture

```
claude-code-discord/
├── index.ts                     # Entry point — Discord client setup
├── claude/
│   ├── client.ts                # SDK query execution, streaming, query lifecycle
│   ├── command.ts               # Core slash commands (claude, continue, cancel)
│   ├── additional-commands.ts   # Dev tool commands (explain, debug, optimize, etc.)
│   ├── enhanced-client.ts       # Model discovery, enhanced query wrapper
│   ├── info-commands.ts         # Info, rewind, and control commands
│   ├── query-manager.ts         # Active query tracking for mid-session controls
│   ├── message-converter.ts     # SDK message → Discord embed conversion
│   ├── discord-sender.ts        # Chunked Discord message delivery
│   ├── model-fetcher.ts         # Dynamic model fetching (API + CLI)
│   ├── types.ts                 # Shared TypeScript types
│   └── index.ts                 # Module exports
├── agent/
│   └── index.ts                 # 7 predefined agents with SDK AgentDefinition format
├── core/
│   ├── handler-registry.ts      # Handler creation, settings→SDK option mapping
│   └── command-wrappers.ts      # Discord interaction → handler routing
├── settings/
│   ├── unified-settings.ts      # Settings interface, defaults, slash commands
│   ├── unified-handlers.ts      # All settings category handlers
│   └── advanced-settings.ts     # claude-settings, output-settings, quick-model
├── system/                      # System monitoring commands
├── git/                         # Git and worktree commands
├── shell/                       # Shell execution commands
└── utils/                       # Utilities (status, pwd, help, shutdown)
```

### SDK Integration

Built on `@anthropic-ai/claude-agent-sdk` v0.2.45 — the official Anthropic SDK for Claude Code integration. Key capabilities:

- **Streaming responses** via `AsyncGenerator<SDKMessage>`
- **Native agent support** with `AgentDefinition` objects
- **Mid-session controls**: `interrupt()`, `setModel()`, `setPermissionMode()`
- **File rewind**: `rewindFiles()` with dry-run preview
- **Account introspection**: `accountInfo()`, `supportedModels()`, `mcpServerStatus()`
- **Advanced options**: thinking budgets, 1M context beta, file checkpointing, sandbox mode, structured output

---

## License

MIT

