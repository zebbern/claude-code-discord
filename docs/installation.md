# Installation

## Option 1: Docker (Recommended)

Works on all platforms with Docker installed.

```bash
git clone https://github.com/zebbern/claude-code-discord.git
cd claude-code-discord
cp .env.example .env
# Edit .env with your DISCORD_TOKEN and APPLICATION_ID
docker compose up -d
```

See [Docker Guide](docker.md) for full Docker usage, GHCR images, and auto-updates.

---

## Option 2: Setup Script

### Linux / macOS

```bash
git clone https://github.com/zebbern/claude-code-discord.git
cd claude-code-discord
chmod +x setup.sh && ./setup.sh
```

### Windows (PowerShell)

```powershell
git clone https://github.com/zebbern/claude-code-discord.git
cd claude-code-discord
.\setup.ps1
```

The setup script handles:

1. Installing Deno (if not found)
2. Installing Claude CLI (if not found)
3. Creating `.env` with your tokens
4. Initializing git repo (if needed)
5. Offering to start the bot

---

## Option 3: Manual Setup

### Install Deno

**Linux / macOS:**

```bash
curl -fsSL https://deno.land/install.sh | sh
```

**Windows (PowerShell):**

```powershell
irm https://deno.land/install.ps1 | iex
```

Or download from [deno.com](https://deno.com/).

### Install Claude CLI

Requires Node.js / npm:

```bash
npm install -g @anthropic-ai/claude-code
claude /login
```

### Clone and Configure

```bash
git clone https://github.com/zebbern/claude-code-discord.git
cd claude-code-discord
cp .env.example .env
```

Edit `.env` with your `DISCORD_TOKEN` and `APPLICATION_ID`. See [Configuration](#configuration-env) below.

### Start the Bot

**Linux / macOS:**

```bash
deno task start
```

**Windows (PowerShell):**

```powershell
deno task start
```

**Development mode (hot reload):**

```bash
deno task dev
```

**With optional flags:**

```bash
deno run --allow-all index.ts --category myproject --user-id YOUR_DISCORD_ID
```

> If you get `not a git directory`, run `git init` in the project folder first.

---

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

Environment variables override `.env` file settings. CLI flags override environment variables.

---

## Platform Notes

### Linux / macOS

- Deno and Claude CLI install via shell one-liners
- Use `chmod +x setup.sh` before running the setup script
- `cp` works natively for `.env.example`

### Windows

- Run PowerShell as Administrator if Deno install requires it
- Use `copy .env.example .env` instead of `cp` if not using Git Bash
- The setup script (`setup.ps1`) handles Windows-specific paths automatically

### Docker (all platforms)

- Docker Desktop required on Windows/macOS, Docker Engine on Linux
- The image bundles Deno and Git so no local installs needed
- See [Docker Guide](docker.md) for volumes, GHCR, and Watchtower
