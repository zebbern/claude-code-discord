<div align="center">

# claude-code-discord

<img width="350" height="350" alt="image" src="https://github.com/user-attachments/assets/e8091420-d271-48a4-8e55-279f2093d3ae" />


<kbd>

| Advantage                                   | Details                                                                                     | Status |
|---------------------------------------------|---------------------------------------------------------------------------------------------|:------:|
| Use Claude Code Anywhere                    | Host locally (VM / Docker / cloud) and send commands via the Discord API                    | ✅     |
| Centralized collaboration                   | Run commands and discuss results where your team already communicates                       | ✅     |
| Branch-aware organization                   | Maps Git branches to channels/categories so feature work stays separated                    | ✅     |
| Immediate, shareable feedback               | Execute `/git`, `/shell`, or `/claude` and get outputs directly in-channel                  | ✅     |
| Reduced context switching                   | Keep actions, logs, and discussion together — less switching between terminal and chat      | ✅     |
| Role-based access control                   | Restrict destructive commands (`/shell`, `/git`, worktree ops) to specific Discord roles    | ✅     |
| Non-developer friendly                      | PMs, QA, and stakeholders can trigger checks and view results without repo access          | ✅     |
| Automatable touchpoint                      | Integrate with CI/webhooks to triage issues and run fixes from chat                        | ✅     |
| Local hosting & security                    | Keep keys and code on your infra while exposing a controlled interface through Discord      | ✅     |
| Audit trail & accountability                | Channel history provides an easy-to-search record of who ran what and when                 | ✅     |

</kbd>

</div>

<br>


**Start Here If You Have These:**
<kbd>DISCORD_TOKEN</kbd>
<kbd>APPLICATION_ID</kbd>

- **[Quick Start](#pre)** 
- **[Command List 48 Commands](#Command-list)** 

**Tutorial If you dont know or have them follow these first then come back:**
- **[How To Setup Discord Bot?](#setup)**
- **[How To Use](#)**

---


<h2 id="pre">Quick Start</h2>

- **Install Deno Can Be Done Via [Denos Website](https://deno.com/) Or Commands Under:**
```C
# Linux/MacOS
curl -fsSL https://deno.land/install.sh | sh

# Windows|Powershell
irm https://deno.land/install.ps1 | iex
```

**Clone the project:**
```
git clone https://github.com/zebbern/claude-code-discord.git
cd claude-code-discord
```
**Install claude `If you dont have it` and login:**
```
npm install -g @anthropic-ai/claude-code
claude /login
```
**Required environment variables**
```
export DISCORD_TOKEN="your-discord-bot-token"
export APPLICATION_ID="your-discord-app-id"
```
**Now Run the discord Bot**
> If you get `not a git directory` just run 
> <kbd>git add .</kbd>
```bash
# Run the bot directly (requires execution permissions)
./index.ts --category myproject --user-id Your_Discord_User_ID_Here

# Or Run with Deno
deno run --allow-all index.ts --category myproject --user-id Your_Discord_User_ID_Here
```
**You can run without `--user-id Your_Discord_User_ID_Here` if you dont want to be notified when claude finishes**
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
> (48 Commands)

### Core Claude (3)
- `/claude`, `/continue`, `/claude-cancel`

### Enhanced Claude (4) 
- `/claude-enhanced`, `/claude-models`, `/claude-sessions`, `/claude-context`

### Development Tools (7)
- `/claude-explain`, `/claude-debug`, `/claude-optimize`, `/claude-review`
- `/claude-generate`, `/claude-refactor`, `/claude-learn`

### New Features (3)
- `/todos` - Task management with API rate limits
- `/mcp` - Model Context Protocol servers  
- `/agent` - 7 specialized AI agents

### Settings (4)
- `/settings` - Unified settings (NEW)
- `/claude-settings`, `/output-settings`, `/quick-model`

### Git Operations (6)
- `/git`, `/worktree`, `/worktree-list`, `/worktree-remove`
- `/worktree-bots`, `/worktree-kill`

### Shell Management (4)
- `/shell`, `/shell-input`, `/shell-list`, `/shell-kill`

### System Monitoring (10)
- `/system-info`, `/processes`, `/system-resources`, `/network-info`
- `/disk-usage`, `/env-vars`, `/system-logs`, `/port-scan`
- `/service-status`, `/uptime`

### Utilities (4)
- `/status`, `/pwd`, `/shutdown`, `/help`

### Agent System (3)
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
- **Action types**: list, add, complete, generate, prioritize, rate-status
- **Priority levels**: low, medium, high, critical  
- **Rate limit awareness** - Supports Anthropic API tiers including `exceeds_200k_tokens`
- **Token estimation** - Calculates estimated token usage
- **Auto-generation** - Generate todos from code files

#### `/mcp` Command ✨ 
- **MCP server management** - Model Context Protocol integration
- **Server types**: local, http, websocket, ssh
- **Actions**: list, add, remove, test, status
- **Connection testing** - Verify MCP server connectivity

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

