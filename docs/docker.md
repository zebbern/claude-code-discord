# Docker Guide

## Quick Start

```bash
cp .env.example .env
# Set DISCORD_TOKEN, APPLICATION_ID, and ANTHROPIC_API_KEY
docker compose up -d
```

Make sure your `.env` file is in the project root with **all required variables**:
- `DISCORD_TOKEN` — your Discord bot token
- `APPLICATION_ID` — your Discord application ID  
- `ANTHROPIC_API_KEY` — **required in Docker** (SDK authentication; there is no Claude CLI in the image)

See [Installation](installation.md) for full `.env` setup.

Service name: `claude-bot` · Container name: `claude-code-discord`

## Docker Compose

The included `docker-compose.yml` supports two modes:

### Build Locally

Default in `docker-compose.yml` — builds from the local `Dockerfile`:

```bash
# Optional but recommended: bake HEAD into the image for accurate version checks
export GIT_COMMIT=$(git rev-parse HEAD)   # PowerShell: $env:GIT_COMMIT = git rev-parse HEAD
docker compose up -d --build
```

Volumes (from compose):
- `bot-data` → `/app/.bot-data`
- `claude-config` → `/home/claude/.claude`
- Optional host project mount → `/app/workspace` (commented out by default)

### Use GHCR Image

Pre-built images are published to GitHub Container Registry on every push to `main`.

In `docker-compose.yml`, comment out the `build:` section and uncomment:

```yaml
image: ghcr.io/zebbern/claude-code-discord:latest
```

Then:

```bash
docker compose pull
docker compose up -d
```

GHCR images include a baked-in `GIT_COMMIT` from the CI build for version checks.

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

This checks for new images every 5 minutes and restarts the bot container (`claude-code-discord`) automatically.

## What's in the Image

The Dockerfile builds on `denoland/deno:latest` and adds:

- **Git**, **curl**, **ca-certificates** — workspace ops and HTTPS
- **Deno cached dependencies** from `deno.json` / `@anthropic-ai/claude-agent-sdk`
- Non-root user, healthcheck, and named-volume-friendly layout

There is **no** Node.js/npm and **no** Claude Code CLI in the image. The bot talks to Anthropic via the Agent SDK.

## Authentication in Docker

**`ANTHROPIC_API_KEY` is required when running in Docker.** Set it in `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

Get your API key from [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys).

Do not use `docker exec … claude /login` — the CLI is not installed in this image.

## Resource Limits

Compose already sets deploy limits (2 CPU / 2G memory). Adjust in `docker-compose.yml` under `claude-bot.deploy.resources` if needed.
