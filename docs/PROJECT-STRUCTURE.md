# Claude Code Discord Bot - Project Structure

## Directory Structure

```
/app/
├── agent/                  # AI Agent system
│   └── index.ts           # Specialized development agents
├── claude/                # Claude Code integration
│   ├── client.ts          # Basic Claude API client
│   ├── command.ts         # Core Claude commands
│   ├── enhanced-client.ts # Enhanced Claude features
│   ├── enhanced-commands.ts # Advanced Claude commands
│   ├── additional-commands.ts # Extra Claude tools
│   ├── additional-index.ts # Additional command exports
│   ├── handler.ts         # Command execution handlers
│   ├── index.ts           # Main Claude exports
│   ├── message-converter.ts # Discord message formatting
│   └── types.ts           # Type definitions
├── discord/               # Discord bot core
│   ├── bot.ts            # Main bot logic
│   ├── button.ts         # Button interaction handlers
│   ├── command.ts        # Command registration
│   ├── formatting.ts     # Message formatting utilities
│   ├── index.ts          # Discord exports
│   ├── pagination.ts     # Message pagination system
│   └── sender.ts         # Message sending utilities
├── docs/                 # Documentation
│   ├── CLAUDE.md         # Claude integration docs
│   ├── CLEANUP-PLAN.md   # Cleanup documentation
│   ├── DUPLICATE-COMMANDS-FIX.md # Fix documentation
│   ├── PROJECT-STRUCTURE.md # This file
│   ├── README.md         # Main project documentation
│   └── UNIFIED-SETTINGS-IMPLEMENTATION.md # Settings docs
├── git/                  # Git integration
│   ├── command.ts        # Git slash commands
│   ├── handler.ts        # Git command execution
│   ├── index.ts          # Git exports
│   ├── process-manager.ts # Worktree bot management
│   └── types.ts          # Git type definitions
├── help/                 # Help system
│   ├── commands.ts       # Help command definitions
│   └── index.ts          # Help exports
├── process/              # Process management
│   ├── crash-handler.ts  # Crash recovery system
│   └── index.ts          # Process exports
├── settings/             # Settings management
│   ├── advanced-settings.ts # Advanced settings (legacy)
│   ├── handlers.ts       # Advanced settings handlers
│   ├── index.ts          # Settings exports
│   ├── unified-handlers.ts # New unified handlers
│   └── unified-settings.ts # New unified settings system
├── shell/                # Shell command execution
│   ├── command.ts        # Shell slash commands
│   ├── handler.ts        # Shell execution logic
│   └── index.ts          # Shell exports
├── system/               # System monitoring
│   ├── commands.ts       # System monitoring commands
│   └── index.ts          # System exports
├── tests/                # Test files
│   ├── test-no-duplicates.ts # Command duplicate checker
│   ├── test-unified-settings.ts # Settings system tests
│   └── verify-implementation.ts # Implementation verification
├── util/                 # Utilities
│   ├── command.ts        # Basic utility commands
│   ├── handler.ts        # Utility handlers
│   ├── index.ts          # Utility exports
│   ├── proxy.ts          # Proxy configuration utilities
│   └── types.ts          # Shared type definitions
├── deno.json             # Deno configuration
├── index.ts              # Main application entry point
└── LICENSE               # License file
```

## Core Components

### 🤖 **Claude Integration**
- **Basic**: Core Claude Code functionality
- **Enhanced**: Advanced features with templates and context
- **Additional**: Specialized tools (explain, debug, optimize, etc.)

### 🎯 **Unified Settings System**
- **New**: `/settings` command with categories
- **Modes**: Thinking modes (think, think-hard, ultrathink)
- **Operations**: Plan, auto-accept, danger modes
- **Legacy**: Advanced settings still available for compatibility

### 🔧 **New Features**
- **Agent System**: 7 specialized AI agents for different tasks
- **Todo Management**: Rate-limit aware task management
- **MCP Support**: Model Context Protocol server configuration
- **Proxy Support**: NO_PROXY environment variable handling

### 📊 **System Monitoring**
- **Git Integration**: Worktree management and git operations
- **Shell Management**: Interactive process execution
- **System Tools**: Resource monitoring and status checks

### 🛠️ **Development Tools**
- **Process Management**: Crash handling and recovery
- **Message Formatting**: Pagination and syntax highlighting
- **Help System**: Comprehensive command documentation

## Key Files

| File | Purpose |
|------|---------|
| `index.ts` | Main application entry point and command registration |
| `settings/unified-settings.ts` | New unified settings system |
| `agent/index.ts` | Specialized AI agents |
| `help/commands.ts` | Command documentation and help system |
| `git/handler.ts` | Git operations and status formatting |
| `discord/bot.ts` | Core Discord bot functionality |

## Commands Overview

### Core Commands (26)
- `/claude`, `/continue`, `/claude-cancel` - Basic Claude integration
- `/claude-enhanced` - Advanced Claude with options
- `/settings` - Unified settings management (NEW)
- `/todos` - Task management (NEW) 
- `/mcp` - MCP server config (NEW)
- `/agent` - AI agents (NEW)

### Development Tools (7)
- `/claude-explain`, `/claude-debug`, `/claude-optimize`
- `/claude-review`, `/claude-generate`, `/claude-refactor`, `/claude-learn`

### System Tools (15)
- Git: `/git`, `/worktree*` commands
- Shell: `/shell*` commands  
- Monitoring: `/system-*`, `/processes`, `/uptime`
- Utilities: `/status`, `/pwd`, `/shutdown`, `/help`

## Removed Components

### Cleaned Up
- ❌ `claude-templates` - Removed as requested
- ❌ Non-implemented advanced settings commands
- ❌ Obsolete test files
- ❌ Duplicate command definitions
- ❌ Zombie documentation files

### Legacy Support
- ✅ `/claude-settings` - Still available for compatibility
- ✅ `/output-settings` - Still functional
- ✅ `/quick-model` - Still available

## Testing

- `tests/test-no-duplicates.ts` - Verifies no command conflicts
- `tests/test-unified-settings.ts` - Tests new settings system
- `tests/verify-implementation.ts` - Overall system verification

## Configuration

- `deno.json` - Deno runtime configuration
- Environment variables for Discord tokens and API keys
- Proxy configuration via `NO_PROXY` environment variable