<div align="center">

# claude-code-discord

<kbd>

| Advantage                                   | Details                                                                                     | Status |
|---------------------------------------------|---------------------------------------------------------------------------------------------|:------:|
| Use Claude Code Anywhere                    | Host locally (VM / Docker / cloud) and send commands via the Discord API                    | ✅     |
| Centralized collaboration                   | Run commands and discuss results where your team already communicates                       | ✅     |
| Branch-aware organization                   | Maps Git branches to channels/categories so feature work stays separated                    | ✅     |
| Immediate, shareable feedback               | Execute `/git`, `/shell`, or `/claude` and get outputs directly in-channel                  | ✅     |
| Reduced context switching                   | Keep actions, logs, and discussion together — less switching between terminal and chat      | ✅     |
| Role-based access control                   | Restrict destructive commands (`/shell`, `/git`, worktree ops) to specific Discord roles    | ✅     |
| Non-developer friendly                      | PMs, QA, and stakeholders can trigger checks and view results without repo access           | ✅     |
| Automatable touchpoint                      | Integrate with CI/webhooks to triage issues and run fixes from chat                         | ✅     |
| Local hosting & security                    | Keep keys and code on your infra while exposing a controlled interface through Discord      | ✅     |
| Audit trail & accountability                | Channel history provides an easy-to-search record of who ran what and when                  | ✅     |

</kbd>

</div>

<br>


**Start Here If You Have These:**
<kbd>DISCORD_TOKEN</kbd>
<kbd>APPLICATION_ID</kbd>

- **[Quick Start](#pre)** 
- **[Command List 45+ Commands](#Command-list)** 

**Tutorial If you dont know or have them follow these first then come back:**
- **[How To Setup Discord Bot?](#setup)**

---

### Preview: 
<img width="350" height="350" alt="image" src="https://github.com/user-attachments/assets/e8091420-d271-48a4-8e55-279f2093d3ae" />



<h2 id="pre">Quick Start</h2>

### Option 1: Docker (Recommended - Most Secure)

**Quick Start:**
```bash
git clone https://github.com/zebbern/claude-code-discord.git
cd claude-code-discord
cp .env.example .env
# Edit .env with your DISCORD_TOKEN and APPLICATION_ID
docker compose up -d
```

**Docker Commands:**
```bash
# Start the bot
docker compose up -d

# View logs
docker compose logs -f

# Stop the bot
docker compose down

# Rebuild after updates
docker compose build --no-cache && docker compose up -d
```

**Why Docker?**
- 🔒 **Isolated container** - No direct host system access
- 🛡️ **Non-root security mode** - Runs as unprivileged user
- 📦 **Zero dependencies** - Everything bundled in container
- 🔄 **Auto-restart on crashes** - Built-in resilience
- 💾 **Persistent storage** - Data survives restarts
- ⚙️ **Resource limits** - 2 CPU, 2GB RAM max

---

### Option 2: One-Command Setup (Quick Start)

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

The bot uses a `.env` file for configuration. Copy `.env.example` to `.env` and edit:

```env
# Required
DISCORD_TOKEN=your_bot_token_here
APPLICATION_ID=your_application_id_here

# Optional
USER_ID=your_discord_user_id          # Get mentioned when Claude finishes
CATEGORY_NAME=claude-code             # Discord category for channels
WORK_DIR=/path/to/project             # Working directory (default: current)
```

**Environment variables take precedence over `.env` file settings.**

<img width="250" height="250" alt="image" src="https://github.com/user-attachments/assets/2fea008b-76b7-48d8-9a87-8214cc7a24ad" />




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



## Command List 
> (45+ Commands)

### Core Claude (3)
- `/claude`, `/continue`, `/claude-cancel`

### Enhanced Claude (4) 
- `/claude-enhanced`, `/claude-models`, `/claude-sessions`, `/claude-context`

### Development Tools (7)
- `/claude-explain`, `/claude-debug`, `/claude-optimize`, `/claude-review`
- `/claude-generate`, `/claude-refactor`, `/claude-learn`

### Task Management (3)
- `/todos` - Task management with priorities and persistence
- `/mcp` - Model Context Protocol servers  
- `/agent` - 7 specialized AI agents

### Settings (4)
- `/settings` - Unified settings management
- `/claude-settings`, `/output-settings`, `/quick-model`

### Git Operations (6)
- `/git`, `/worktree`, `/worktree-list`, `/worktree-remove`
- `/worktree-bots`, `/worktree-kill`

### Shell Management (4)
- `/shell`, `/shell-input`, `/shell-list`, `/shell-kill`

### System Monitoring (11)
- `/system-info`, `/processes`, `/system-resources`, `/network-info`
- `/disk-usage`, `/env-vars`, `/system-logs`, `/port-scan`
- `/service-status`, `/uptime`, `/screenshot`

### Utilities (4)
- `/status`, `/pwd`, `/shutdown`, `/help`

### Agent System
- `/agent` with 7 specialized agents:
  - Code Reviewer, Software Architect, Debug Specialist
  - Security Analyst, Performance Engineer, DevOps Engineer, General Assistant


#### Thinking Mode Options ✨
- `none` - Standard Claude responses
- `think` - Step-by-step reasoning mode
- `think-hard` - Deep analysis and reasoning
- `ultrathink` - Maximum depth thinking for complex problems

#### Operation Mode Options ✨
- `normal` - Standard operation with user confirmation
- `plan` - Planning mode without execution
- `auto-accept` - Automatically apply suggested changes
- `danger` - Unrestricted mode (high risk)

#### `/todos` Command ✨
- **Action types**: list, add, complete, generate, prioritize
- **Priority levels**: low, medium, high, critical  
- **Persistence** - Todos are saved to disk and persist across restarts
- **Auto-generation** - Generate todos from code files

#### `/mcp` Command ✨ 
- **MCP server management** - Model Context Protocol integration
- **Reads from `.mcp.json`** - Standard Claude Code configuration format
- **Actions**: list, add, remove, test, status
- **Cross-platform** - Command testing works on Windows and Unix
- **Add servers via Discord**:
  ```
  /mcp action:add server_name:filesystem command:npx -y @anthropic-ai/filesystem-mcp description:Local filesystem access
  ```
- **Or edit `.mcp.json` directly**:
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

#### `/agent` Command ✨
- **Specialized AI agents** for different development tasks:
  - Code Reviewer - Quality analysis and security
  - Software Architect - System design and architecture  
  - Debug Specialist - Bug analysis and troubleshooting
  - Security Analyst - Vulnerability assessment
  - Performance Engineer - Optimization and profiling
  - DevOps Engineer - Deployment and infrastructure
  - General Assistant - Multi-purpose development help
- **Risk levels** - Low/Medium/High risk classification
- **Session management** - Persistent agent conversations
- **Context awareness** - Include system info and files

#### `/claude-settings` Command ✨
- **Actions**: show, set-model, toggle-git-context, toggle-system-info, set-system-prompt, reset-defaults
- **Supported options**: Model selection, Git context, System info, System prompts
- *Note: Only features supported by Claude Code CLI are available*

#### `/screenshot` Command ✨
- **Capture full screen** - Take screenshots of the host machine's display
- **Optional delay** - `/screenshot delay: 5` to wait before capturing
- **Platform support** - Windows, macOS, and Linux (with GUI)
- **DPI-aware** - Captures at actual screen resolution regardless of Windows scaling
- **Auto-cleanup** - Temporary files are automatically removed
- *Note: Not available in Docker containers or headless environments*

