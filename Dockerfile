# Claude Code Discord Bot
# Multi-stage build for optimized production image

FROM denoland/deno:latest

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN groupadd -r claude && useradd -r -g claude claude

# Copy all source files first (as root)
COPY . .

# Remove lockfile if present (avoid version conflicts)
RUN rm -f deno.lock

# Pre-compile dependencies as root (before switching user)
RUN deno cache --no-lock index.ts

# Create data directory for persistence and set ownership
RUN mkdir -p .bot-data && chown -R claude:claude /app

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
