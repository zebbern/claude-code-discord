# Features

## Thinking Modes

| Mode | Description |
|------|-------------|
| Disabled | Standard responses without extended thinking |
| Concise | Brief, efficient analysis |
| Verbose | Detailed, thorough reasoning |
| Comprehensive | Maximum depth analysis |

Set via `/settings` > `claude` > `set-thinking`.

## Operation Modes

| Mode | Permissions | Description |
|------|-------------|-------------|
| Normal | `acceptEdits` | Can edit files, asks before running commands |
| Trusted | `bypassPermissions` | Full auto-approval of all operations |
| Safe | `plan` | Analyze only, no modifications |

Set via `/settings` > `permissions` > `set-mode`.

## Effort Levels

| Level | Description |
|-------|-------------|
| `min` | Quick responses, minimal processing |
| `low` | Simple analysis and code completion |
| `medium` | Standard effort with good accuracy |
| `high` | Thorough analysis and robust output |
| `max` | Maximum depth, best quality |

Set via `/settings` > `claude` > `set-effort`.

## Advanced SDK Features

| Feature | Description |
|---------|-------------|
| Fast Mode | Toggle Opus 4.6 speed-optimized API (2.5x faster, same quality) via `/fast` |
| 1M Token Context | Beta: increases context window to 1M tokens |
| Sandbox Mode | Granular sandbox with network rules, filesystem ACLs, excluded commands |
| File Checkpointing | Enables file change tracking for rewind support |
| Agent Teams | Experimental multi-agent collaboration (delegate mode) |
| Hooks System | Passive SDK callbacks for tool use, notification, and task observability |
| Additional Directories | Multi-repo access — let Claude read/write across multiple directories |
| Fork Session | Branch a conversation into a new independent session |
| AskUserQuestion | Claude can ask clarifying questions mid-session via Discord buttons |

Toggles available via `/settings` > `claude`.

## Agent System

7 built-in agents optimized for specific tasks:

| Agent | Specialization |
|-------|---------------|
| `code-review` | Deep code analysis, security, and style checks |
| `debug` | Error diagnosis and root cause analysis |
| `architect` | System design and architecture planning |
| `refactor` | Code restructuring and improvement |
| `test-writer` | Test generation and coverage analysis |
| `docs` | Documentation generation |
| `security` | Security vulnerability scanning |

### Usage

```
/agent start code-review    # Start an agent
/agent list                  # View all available agents
/agent status                # Check running agent status
/agent stop                  # Stop current agent
```

Agents run through the SDK using native `AgentDefinition` support with tailored system prompts.

## MCP Server Management

Manage Model Context Protocol servers for Claude:

```
/mcp list        # Show configured MCP servers
/mcp add         # Add a new MCP server
/mcp remove      # Remove an MCP server
/mcp status      # Check connection status
/mcp test        # Test a server connection
/mcp toggle      # Enable/disable a server mid-session
/mcp reconnect   # Reconnect a failed server mid-session
```

MCP configuration is stored in `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "my-mcp-server"],
      "env": {
        "API_KEY": "your-key"
      }
    }
  }
}
```

## Mid-Session Controls

Change model or permissions without restarting your session:

```
/claude-control set-model claude-sonnet-4-20250514
/claude-control set-permissions bypassPermissions
/claude-control stop-task <task_id>
/claude-control status
/claude-control interrupt
```

These operations apply immediately to the active query.

## File Rewind

Undo file changes made during a Claude session:

```
/rewind turn:3              # Rewind to turn 3
/rewind turn:5 dry_run:true # Preview what would change
```

Requires file checkpointing to be enabled via `/settings`.

## Structured Output

Force Claude to respond in JSON matching a specific schema:

1. Enable via `/settings` > `output` > `toggle-structured-output`
2. Set schema via `/settings` > `output` > `set-output-schema`

Example schema:

```json
{
  "type": "object",
  "properties": {
    "summary": { "type": "string" },
    "confidence": { "type": "number" }
  }
}
```

When enabled, responses follow `json_schema` output format through the SDK.

## Role-Based Access Control (RBAC)

Restrict dangerous commands to authorized users and roles:

### Restricted Command Categories

| Category | Commands |
| -------- | -------- |
| Shell | `/shell`, `/exec`, `/run`, `/terminal` |
| Git | `/git`, `/commit`, `/push`, `/pull`, `/branch` |
| System | `/shutdown`, `/restart`, `/config` |
| Admin | `/admin` |

### Configuration

Set via environment variables in `.env`:

```env
# Comma-separated Discord Role IDs
ADMIN_ROLE_IDS=123456789,987654321

# Comma-separated Discord User IDs (bypass role checks)
ADMIN_USER_IDS=111111111,222222222
```

### Behavior

- **Neither variable set**: RBAC disabled — all commands open (default)
- **One or both set**: Only users with a listed role or user ID can run restricted commands
- **Denied users**: Receive an ephemeral "Permission Denied" message (only they can see it)
- **Unrestricted commands**: Always available to everyone (e.g., `/claude`, `/settings`, `/help`)
