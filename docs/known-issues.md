# Known Issues & Accepted Risks

> Last audited: 2025-02-18  
> Context: Single-user personal Discord bot — not a production multi-user service

This document tracks issues identified during a comprehensive code audit that were **intentionally not fixed**. Each entry explains why the issue exists, why it doesn't matter for our use case, and under what conditions (if any) it would need revisiting.

---

## Security — Accepted for Personal Use

### Command Injection via `/git` (Audit #2)

**What:** The `/git` command passes user input to `git` CLI without sanitization. A crafted input could inject shell commands.

**Why we keep it:** This bot is operated by its owner in a private Discord server. The only person who can run `/git` is the same person who has SSH access to the machine. You can't escalate beyond what you already have. If the bot were ever exposed to untrusted users, this would need parameterized command execution.

### Path Traversal in Git Worktree (Audit #3)

**What:** The `/git worktree` subcommand accepts paths without restriction, so `../../etc/passwd` style paths are technically possible.

**Why we keep it:** Same reasoning — the operator already has full filesystem access. The bot doesn't expand the attack surface beyond what the user already controls.

### `/env-vars` Exposes Environment (Audit #4)

**What:** The `/env-vars` system command displays environment variables, which could include tokens or secrets.

**Why we keep it:** This is a debugging utility for the bot owner. The Discord channel is private. The bot token is already known to the operator. If you add RBAC restrictions to limit who can run system commands, this becomes a non-issue even in shared servers.

### Full Environment Propagated to Child Processes (Audit #19)

**What:** When spawning git supervisor sub-bots, the full environment (including `DISCORD_TOKEN`) is passed to child processes.

**Why we keep it:** Child processes run on the same machine under the same user. They inherit the same trust boundary. The token is needed for the child bot to function. There's no privilege escalation.

---

## Memory — Self-Resolving

### `expandableContent` Map Grows Unboundedly (Audit #5)

**What:** Every "Show Full" button creates an entry in a Map that's never evicted. Over time, memory usage grows.

**Why it doesn't matter:** For a single user generating maybe 10-50 expandable messages per day, this is a few KB. The bot process restarts periodically (updates, system reboots, crashes), which clears the Map. You'd need to run the bot for months with heavy usage to notice any impact.

**When to revisit:** If the bot runs continuously for weeks with very heavy use and you notice memory growth in `htop`/Task Manager.

### Agent Sessions Never Cleaned (Audit #18)

**What:** The `agentSessions` Map in `agent/index.ts` accumulates session objects that are never removed.

**Why it doesn't matter:** Each session is a small object. A single user creates maybe 1-5 sessions per day. Bot restarts clear them. Same as above — self-resolving through natural process lifecycle.

### Usage Records Lost on Crash (Audit #17)

**What:** Usage data is batched (saved every 5 records). On crash, up to 4 records are lost.

**Why it doesn't matter:** Usage tracking is informational, not billing. Losing a few records has zero functional impact. The data is nice-to-have, not critical.

---

## Race Conditions — Single User Can't Trigger

### Concurrent Query State Clobber (Audit #6)

**What:** If two `/claude` commands run simultaneously, they share a single `claudeController`. Only the last one can be cancelled.

**Why it doesn't matter:** As a single user, you won't send two `/claude` commands at the exact same time. Even if you did, both queries still complete — you just can't cancel the first one. The second command's abort check (fixed in commit `5366f00`) now properly aborts the first.

### Shell Callback Registration Race (Audit #7)

**What:** Two simultaneous `/shell` commands could cross-wire their output callbacks.

**Why it doesn't matter:** Same as above — single user, sequential usage. You'd have to fire two shell commands within milliseconds of each other.

---

## Non-Functional / Dead Code

### Proxy Implementation Non-Functional (Audit #8)

**What:** The proxy configuration code in `util/proxy.ts` exists but doesn't actually apply the proxy to outgoing requests.

**Why we keep it:** If you're not behind a proxy, this code is never invoked. It's dead code that doesn't hurt anything. If proxy support is needed in the future, the scaffolding is there to build on.

### `removeSignalHandlers` Is a No-Op (Audit #23)

**What:** The function to remove signal handlers doesn't actually store handler references, so it can't remove them.

**Why it doesn't matter:** Signal handlers only fire on SIGINT/SIGTERM (process shutdown). The "remove" function would only matter for hot-reload scenarios, which don't apply to this bot. On shutdown, all handlers fire and cleanup runs — the fact that you can't selectively remove them is irrelevant.

### `isValidModel` Always Returns True (Audit #16)

**What:** The model validation function accepts any string as a valid model name.

**Why it doesn't matter:** If you type an invalid model name, the Anthropic API returns an error. You get the same outcome (failure + error message) whether validation happens client-side or server-side. The API is the authoritative validator.

### `getEnvVarPattern` Identical on Both Platforms (Audit #26)

**What:** The Windows and Unix branches of `getEnvVarPattern` return the same regex.

**Why it doesn't matter:** It works correctly on both platforms. The code is just redundant, not buggy.

---

## Fragile but Functional

### Duplicate Signal Handlers (Audit #15)

**What:** Multiple modules register their own SIGINT/SIGTERM handlers. On shutdown, all of them fire, which means cleanup code runs multiple times.

**Why it doesn't matter:** The cleanup operations are idempotent (aborting an already-aborted controller, destroying an already-destroyed client). Multiple runs don't cause errors. At worst, you see extra log lines during shutdown.

### RBAC Cache Never Invalidated (Audit #14)

**What:** Permission check results are cached and never expire. If you change role assignments, the cache still has the old results.

**Why it doesn't matter:** As the only user, your permissions don't change. Even if they did, a bot restart clears the cache. For a multi-user setup, you'd want TTL-based invalidation.

### Model List Parser Is Regex-Based (Audit #20)

**What:** The `/claude-models` command parses `claude` CLI output with regex. If Anthropic changes the output format, parsing breaks.

**Why we accept it:** There's no stable API for this. Regex parsing is the only option. When it breaks, it fails gracefully (shows empty list or error), and the fix is a regex update.

### Hardcoded Rate Limit Tiers (Audit #24)

**What:** Rate limit display values are hardcoded rather than fetched from the API.

**Why it doesn't matter:** These are informational displays. The actual rate limiting is enforced by Anthropic's API, not by this bot. Displaying slightly outdated tier info has no functional impact.

### Manual Settings Sync (Audit #27)

**What:** Multiple settings systems (advanced, unified, legacy) must be manually kept in sync. Changing a setting in one place might not propagate.

**Why we accept it:** The unified settings system is the primary one. Legacy systems exist for backward compatibility. In practice, the user interacts with one settings interface. If something feels out of sync, re-setting the value fixes it.

### `fetchClaudeInfo` Subprocess Leak (Audit #9)

**What:** The `claude` CLI subprocess spawned by `query-manager.ts` may not be killed on timeout or abort.

**Why it doesn't matter:** A stray `claude` process eventually exits on its own (API timeout, idle timeout). For a single user, at most one stray process exists at a time. The OS handles cleanup on bot restart.

---

## Edge Cases — Rare in Practice

### JSON Streaming Empty Response (Audit #21)

**What:** Certain response formats in the JSON streaming path could return an empty string.

**Why it's rare:** This path is only triggered with specific Claude API response shapes. In normal conversational use, it doesn't occur. If it does, you just re-run the command.

### Unawaited Screenshot Cleanup (Audit #22)

**What:** Temporary screenshot files might not be deleted if the async cleanup doesn't complete.

**Why it doesn't matter:** A few stray temp files in `/tmp` or `%TEMP%`. The OS cleans these periodically. Zero functional impact.

### `detectPlatform` Uncached (Audit #25)

**What:** Platform detection runs every time it's called instead of caching the result.

**Why it doesn't matter:** It's a few string comparisons and property reads. Microseconds per call. Not a performance bottleneck by any measure.

---

## Summary

| Category | Count | Action |
|----------|-------|--------|
| Security (accepted for personal use) | 4 | No fix needed — same trust boundary |
| Memory (self-resolving) | 3 | Bot restarts clear state |
| Race conditions (single-user) | 2 | Can't trigger with sequential usage |
| Dead/non-functional code | 4 | No impact, leave as-is |
| Fragile but functional | 6 | Works in practice, accept the tradeoff |
| Rare edge cases | 3 | Not worth the complexity to fix |
| **Total accepted** | **22** | |

**Issues that were fixed:** #1 (stale closure), #10 (missing abort checks), #11 (pagination title), #12 (unicode splitting), #13 (continue button session ID) — see git log for details.
