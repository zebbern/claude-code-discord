# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Discord bot that provides an interface to Claude Code CLI, allowing users to interact with Claude Code through Discord slash commands. The bot operates in "bypass mode" with `dangerouslySkipPermissions: true`, automatically executing commands without confirmation prompts.

## Technology Stack

- **Runtime**: Deno (with shebang `#!/usr/bin/env -S deno run --allow-all`)
- **Language**: TypeScript
- **Discord SDK**: discord.js v14.14.1
- **Claude Code SDK**: @anthropic-ai/claude-code (latest)
- **Dependencies**: All imported via npm specifiers in Deno

## Key Architecture Components

### Main Entry File: `index.ts`

The main entry point that orchestrates the entire application, which can be executed directly or imported as a module.

### Module Structure

The application is organized into functional modules:

- **`claude/`**: Claude Code integration
  - `types.ts`: Type definitions for Claude-related structures
  - `client.ts`: Claude Code SDK wrapper with error handling and streaming
  - `command.ts`: Discord slash commands and handlers for Claude
  - `message-converter.ts`: Converts Claude JSON responses to Discord messages
  
- **`discord/`**: Discord bot core functionality
  - `types.ts`: Discord-specific type definitions
  - `bot.ts`: Main Discord bot creation and event handling
  - `utils.ts`: Discord utility functions (channel name sanitization, text splitting)
  
- **`git/`**: Git operations
  - `types.ts`: Git-related type definitions
  - `handler.ts`: Git command execution and worktree management
  - `command.ts`: Discord slash commands for Git operations
  
- **`shell/`**: Shell execution management
  - `types.ts`: Shell process type definitions
  - `handler.ts`: Shell process manager with interactive I/O support
  - `command.ts`: Discord slash commands for shell operations
  
- **`util/`**: Utility functions
  - `types.ts`: Utility type definitions
  - `handler.ts`: Settings management and status functions
  - `command.ts`: Discord slash commands for utility operations

### Core Functions and Exports

- `getGitInfo()`: Retrieves current Git repository and branch information (from git/handler.ts)
- `sanitizeChannelName()`: Converts branch names to Discord-compliant channel names (from discord/utils.ts)
- `executeGitCommand()`: Executes Git commands in the working directory (from git/handler.ts)
- `sendToClaudeCode()`: Wraps Claude Code SDK with error handling, retry logic, and streaming support (from claude/client.ts)
- `createClaudeCodeBot()`: Main factory function that creates and initializes the Discord bot (from index.ts)
- `createDiscordBot()`: Creates the Discord client and handles all Discord interactions (from discord/bot.ts)

### Key Features

1. **Multi-branch Support**: Creates separate Discord channels for each Git branch
2. **Session Management**: Maintains Claude Code session IDs for conversation continuity
3. **Interactive Shell**: Supports long-running and interactive shell processes
4. **Git Worktree Integration**: Can spawn new bot instances for Git worktrees
5. **Streaming Responses**: Real-time streaming of Claude Code responses to Discord

## Development Commands

```bash
# Run the bot directly (requires execution permissions)
./index.ts --category myproject --user-id 123456789012345678

# Run with Deno
deno run --allow-all index.ts --category myproject --user-id 123456789012345678

# Required environment variables
export DISCORD_TOKEN="your-discord-bot-token"
export APPLICATION_ID="your-discord-app-id"
```

## Code Patterns and Conventions

### Discord Embed Handling
- Messages over 4096 characters are split into multiple embeds
- Tool outputs are displayed in specialized embeds with proper formatting
- Todo lists from Claude Code are parsed and displayed with status indicators

### Error Handling
- Comprehensive try-catch blocks around Claude Code SDK calls
- Automatic retry with different models on failure
- Graceful handling of process termination signals

### Process Management
- Interactive shell processes are tracked in a Map with unique IDs
- Processes can receive input, be listed, and killed via slash commands
- Automatic cleanup of zombie processes

### Channel Naming
- Branch names are sanitized to comply with Discord's channel naming rules
- Special characters are replaced with hyphens
- Names are limited to 100 characters

## Important Implementation Details

1. **Bypass Mode**: The bot runs Claude Code with `dangerouslySkipPermissions: true` - commands execute without user confirmation
2. **Session Cleanup**: Session IDs in user input are cleaned to remove backticks and code block markers
3. **Git Integration**: Assumes the bot runs from within a Git repository
4. **Discord Permissions**: Requires specific bot permissions including channel management and role management

## Testing Approach

There are no explicit tests in this repository. When making changes:
1. Test Discord slash command registration
2. Verify Claude Code SDK integration works with streaming
3. Test interactive shell process management
4. Ensure Git commands execute properly in the working directory

## Module Usage

The bot can be imported and used programmatically:

```typescript
import { createClaudeCodeBot, getGitInfo } from "./index.ts";

const gitInfo = await getGitInfo();
const bot = await createClaudeCodeBot({
  discordToken: "token",
  applicationId: "app-id",
  workDir: Deno.cwd(),
  repoName: gitInfo.repo,
  branchName: gitInfo.branch,
  categoryName: "category",
});
```

You can also import specific modules directly:

```typescript
// Use Git operations independently
import { executeGitCommand, createWorktree } from "./git/index.ts";

// Use Claude Code client directly
import { sendToClaudeCode } from "./claude/index.ts";

// Create Discord bot with custom handlers
import { createDiscordBot } from "./discord/index.ts";
```