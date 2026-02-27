# Claude Code Discord Bot
# Optimized production image with Claude CLI

FROM denoland/deno:latest

# Build arguments for user UID/GID (match host user to avoid permission issues)
ARG USER_ID=1000
ARG GROUP_ID=1000

# Set working directory
WORKDIR /app

# Set environment variable to indicate Docker container
ENV DOCKER_CONTAINER=true

# Install system dependencies
USER root
RUN apt-get update && \
    apt-get install -y --no-install-recommends git curl ca-certificates nodejs npm && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user with home directory (needed for Claude CLI config)
RUN groupadd -r -g ${GROUP_ID} claude && \
    useradd -r -u ${USER_ID} -g claude -m claude

# Install Claude Code CLI globally via npm
RUN npm install -g @anthropic-ai/claude-code && \
    npm cache clean --force

# Verify claude binary is accessible
RUN claude --version

# Copy all source files (as root)
COPY . .

# Remove lockfile if present (avoid version conflicts)
RUN rm -f deno.lock

# Initialize git repo in container (for non-git workspaces)
RUN git init && git config user.email "bot@claude.local" && git config user.name "Claude Bot"

# Pre-compile Deno dependencies
RUN deno cache --no-lock index.ts

# Create data directory for persistence + workspace dir, set ownership
RUN mkdir -p .bot-data /app/workspace && \
    cd /app/workspace && git init && git config user.email "bot@claude.local" && git config user.name "Claude Bot" && \
    chown -R claude:claude /app /home/claude

# Switch to non-root user
USER claude

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD deno eval "console.log('healthy')" || exit 1

# Default command
CMD ["deno", "run", "--allow-all", "--no-lock", "index.ts"]

# Labels for image metadata
LABEL org.opencontainers.image.source="https://github.com/zebbern/claude-code-discord"
LABEL org.opencontainers.image.description="Claude Code Discord Bot - Use Claude AI via Discord"
LABEL org.opencontainers.image.licenses="MIT"
