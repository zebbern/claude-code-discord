# Docker Guide

## Quick Start

```bash
docker compose up -d
```

Make sure your `.env` file is in the project root with all required variables. See [Installation](installation.md) for `.env` setup.

## Docker Compose

The included `docker-compose.yml` supports two modes:

### Build Locally

```yaml
services:
  devonz:
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
  devonz:
    image: ghcr.io/zebbern/devonz:latest
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
    command: --interval 300 devonz
    restart: unless-stopped
```

This checks for new images every 5 minutes and restarts the bot automatically.

## What's in the Image

The Dockerfile builds on `denoland/deno:latest` and adds:

- **Git** (required for branch tracking and version checks)
- **Deno cached dependencies** from `deno.json`

## Resource Limits

For production, consider setting resource limits:

```yaml
services:
  devonz:
    # ...
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '2.0'
```
