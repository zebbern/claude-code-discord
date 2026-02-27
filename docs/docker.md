# Docker Guide

## Quick Start

```bash
docker compose up -d
```

Make sure your `.env` file is in the project root with **all required variables**:
- `DISCORD_TOKEN` — your Discord bot token
- `APPLICATION_ID` — your Discord application ID  
- `ANTHROPIC_API_KEY` — **required in Docker** (the Claude CLI inside the container uses this to authenticate)

See [Installation](installation.md) for full `.env` setup.

## Docker Compose

The included `docker-compose.yml` supports two modes:

### Build Locally

```yaml
services:
  claude-code-discord:
    build: .
    env_file: .env
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - .:/app
    restart: unless-stopped
```

```bash
docker compose up -d --build
```

### Use GHCR Image

Pre-built images are published to GitHub Container Registry on every push to `main`:

```yaml
services:
  claude-code-discord:
    image: ghcr.io/zebbern/claude-code-discord:latest
    env_file: .env
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - .:/app
    restart: unless-stopped
```

```bash
docker compose pull
docker compose up -d
```

## Common Commands

| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start in background |
| `docker compose down` | Stop and remove containers |
| `docker compose logs -f` | Follow live logs |
| `docker compose restart` | Restart the bot |
| `docker compose pull` | Pull latest GHCR image |
| `docker compose up -d --build` | Rebuild from source |

## Auto-Updates with Watchtower

[Watchtower](https://containrrr.dev/watchtower/) automatically pulls and restarts updated images:

```yaml
services:
  watchtower:
    image: containrrr/watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 300 claude-code-discord
    restart: unless-stopped
```

This checks for new images every 5 minutes and restarts the bot automatically.

## What's in the Image

The Dockerfile builds on `denoland/deno:latest` and adds:

- **Claude Code CLI** (`@anthropic-ai/claude-code`) — required for Claude interactions
- **Git** (required for branch tracking and version checks)
- **Node.js / npm** (used to install the Claude CLI)
- **Deno cached dependencies** from `deno.json`

## Authentication in Docker

Unlike native installs where you can run `claude /login` interactively, Docker containers authenticate via the `ANTHROPIC_API_KEY` environment variable.

**`ANTHROPIC_API_KEY` is required when running in Docker.** The Claude CLI inside the container reads this key to authenticate with Anthropic. Without it, any `/claude` or `/ask` command will fail with a `ProcessTransport is not ready for writing` error.

Make sure your `.env` file includes a valid key:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

Get your API key from [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys).

## Resource Limits

For production, consider setting resource limits:

```yaml
services:
  claude-code-discord:
    # ...
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '2.0'
```
