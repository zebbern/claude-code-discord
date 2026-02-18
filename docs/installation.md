# Installation

## Option 1: Docker (Recommended)

```bash
git clone https://github.com/zebbern/claude-code-discord.git
cd claude-code-discord
cp .env.example .env
# Edit .env with your DISCORD_TOKEN and APPLICATION_ID
docker compose up -d
```

See [Docker Guide](docker.md) for full Docker usage, commands, and GHCR image details.

## Option 2: One-Command Setup

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
1. Install Deno (if needed)
2. Install Claude CLI (if needed)
3. Create `.env` file with your tokens
4. Initialize git repository (if needed)
5. Offer to start the bot immediately

## Option 3: Manual Setup

**Install Deno** via [deno.com](https://deno.com/) or:
```bash
# Linux/macOS
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
deno task start           # Using .env file (recommended)
deno task dev             # Development mode (hot reload)
deno run --allow-all index.ts  # Direct execution
```

**Optional flags:**
```bash
deno run --allow-all index.ts --category myproject --user-id YOUR_DISCORD_ID
```

> If you get `not a git directory`, run `git init` first.

## Configuration (.env)

```env
# Required
DISCORD_TOKEN=your_bot_token_here
APPLICATION_ID=your_application_id_here

# Optional
ANTHROPIC_API_KEY=your_anthropic_api_key_here  # Only needed if not using `claude` CLI for auth
USER_ID=your_discord_user_id                   # Get mentioned when Claude finishes
CATEGORY_NAME=claude-code                      # Discord category for channels
WORK_DIR=/path/to/project                      # Working directory (default: current)
```

Environment variables take precedence over `.env` file settings.
