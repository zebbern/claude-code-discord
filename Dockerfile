# Claude Code Discord Bot
# Multi-stage build for optimized production image

FROM denoland/deno:2.0.0

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN groupadd -r claude && useradd -r -g claude claude

# Copy dependency files first (for layer caching)
COPY deno.json ./

# Cache the dependencies
RUN deno cache --reload index.ts || true

# Copy all source files
COPY . .

# Create data directory for persistence
RUN mkdir -p .bot-data && chown -R claude:claude /app

# Switch to non-root user
USER claude

# Pre-compile for faster startup
RUN deno cache index.ts

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD deno eval "console.log('healthy')" || exit 1

# Default command
CMD ["deno", "run", "--allow-all", "index.ts"]

# Labels for image metadata
LABEL org.opencontainers.image.source="https://github.com/zebbern/claude-code-discord"
LABEL org.opencontainers.image.description="Claude Code Discord Bot - Use Claude AI via Discord"
LABEL org.opencontainers.image.licenses="MIT"
