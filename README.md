<div align="center">

# claude-code-discord

**Run Claude Code from Discord with full SDK integration, agents, rewind, mid-session controls and more.**

<kbd>

| Feature | Details | Status |
|---------|---------|:------:|
| Use Claude Code Anywhere | Host locally (VM / Docker / cloud) and send commands via the Discord API | ✅ |
| Full SDK Integration | Built on `@anthropic-ai/claude-agent-sdk` v0.2.45 with native agent support | ✅ |
| Centralized collaboration | Run commands and discuss results where your team already communicates | ✅ |
| Branch-aware organization | Maps Git branches to channels/categories so feature work stays separated | ✅ |
| Mid-session controls | Interrupt, change model, change permissions, and rewind without restarting | ✅ |
| 7 Specialized AI Agents | Code reviewer, architect, debugger, security analyst, performance engineer, DevOps, general | ✅ |
| Dynamic model discovery | Auto-fetches available models from Anthropic API and CLI | ✅ |
| Structured output mode | Get JSON responses matching a configurable schema | ✅ |
| Advanced thinking modes | Standard, think, think-hard, ultrathink with configurable effort and budget | ✅ |
| Role-based access control | Restrict destructive commands (`/shell`, `/git`, worktree ops) to specific Discord roles | ✅ |
| Local hosting & security | Keep keys and code on your infra while exposing a controlled interface through Discord | ✅ |
| Audit trail & accountability | Channel history provides an easy-to-search record of who ran what and when | ✅ |

</kbd>

</div>

<br>

<img width="350" height="350" alt="preview" src="https://github.com/user-attachments/assets/e8091420-d271-48a4-8e55-279f2093d3ae" />

## Quick Start

```bash
git clone https://github.com/zebbern/claude-code-discord.git
cd claude-code-discord
cp .env.example .env
# Edit .env with your DISCORD_TOKEN and APPLICATION_ID
docker compose up -d
```

Need a Discord bot token first? See [Discord Bot Setup](docs/setup-discord.md).

For other install methods (setup script, manual), see [Installation Guide](docs/installation.md).

## Documentation

| Doc | Description |
| --- | --- |
| [Discord Bot Setup](docs/setup-discord.md) | Create a Discord app, get your token and application ID, invite the bot |
| [Installation](docs/installation.md) | Docker, one-command setup, manual setup, `.env` configuration |
| [Commands](docs/commands.md) | Full reference for all 45+ slash commands |
| [Features](docs/features.md) | Thinking modes, agents, MCP, rewind, structured output, mid-session controls |
| [Architecture](docs/architecture.md) | Project structure and SDK integration details |
| [Docker](docs/docker.md) | Docker Compose, GHCR images, Watchtower auto-updates |
| [Updating](docs/updating.md) | How to update (Docker pull, git pull, version check) |

## Quick Model Switching

```
/claude-settings action:set-model value:opus
/claude-settings action:set-model value:sonnet
/claude-settings action:set-model value:haiku
```

## Configuration

```env
# Required
DISCORD_TOKEN=your_bot_token_here
APPLICATION_ID=your_application_id_here

# Optional
ANTHROPIC_API_KEY=your_anthropic_api_key_here
USER_ID=your_discord_user_id
CATEGORY_NAME=claude-code
WORK_DIR=/path/to/project
```

<img width="250" height="250" alt="image" src="https://github.com/user-attachments/assets/2fea008b-76b7-48d8-9a87-8214cc7a24ad" />
