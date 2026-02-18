# Updating

## Docker Users

### Manual Update

```bash
docker compose pull
docker compose up -d
```

### Automatic Updates

Use [Watchtower](https://containrrr.dev/watchtower/) to auto-pull and restart when new images are published. See [Docker Guide](docker.md) for setup.

## Non-Docker Users

```bash
git pull origin main
deno run --allow-all index.ts
```

## Startup Version Check

The bot automatically checks for updates on startup. If a newer version is available on GitHub, it sends an orange embed in your Discord channel:

> **Update Available** Update available! You are X commits behind.

This check is non-blocking and compares your local git commit against the latest commit on `main` via the GitHub API.

## GHCR Image Tags

Images are published to `ghcr.io/zebbern/claude-code-discord` with these tags:

| Tag | Description |
|-----|-------------|
| `latest` | Most recent push to `main` |
| `sha-<hash>` | Specific commit |
| `v*.*.*` | Semantic version (on releases) |

## Release Workflow

Every push to `main` triggers a GitHub Actions workflow that builds and publishes the Docker image to GHCR. Tagged releases also produce versioned image tags.
