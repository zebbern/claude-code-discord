/**
 * Version checker - compares local commit hash against GitHub's latest.
 * Notifies at startup if the bot is behind.
 * Also provides periodic update checks and semver display.
 *
 * @module util/version-check
 */

// Read version from deno.json at startup
const denoConfig = JSON.parse(Deno.readTextFileSync("deno.json"));

/** Current bot version from deno.json */
export const BOT_VERSION: string = denoConfig.version ?? "unknown";

const REPO_OWNER = "zebbern";
const REPO_NAME = "claude-code-discord";

/** Full SHA length or abbreviated (7+) */
const COMMIT_SHA_RE = /^[0-9a-f]{7,40}$/i;

export interface VersionCheckResult {
  upToDate: boolean;
  localCommit: string;
  remoteCommit: string;
  /** True only when remote main contains commits we do not have (we are behind). */
  behind?: boolean;
  /** True when we have local commits not on remote main (we are ahead). */
  ahead?: boolean;
  error?: string;
}

function isDockerContainer(): boolean {
  return Deno.env.get("DOCKER_CONTAINER") === "true";
}

/**
 * Build-time / runtime commit identity (Docker images set this via ARG/ENV).
 * Prefer BOT_GIT_COMMIT, then GIT_COMMIT.
 */
function getEnvCommit(): string | undefined {
  for (const key of ["BOT_GIT_COMMIT", "GIT_COMMIT"] as const) {
    const value = Deno.env.get(key)?.trim();
    if (value && COMMIT_SHA_RE.test(value)) {
      return value;
    }
  }
  return undefined;
}

/**
 * Get the local HEAD commit hash.
 * Uses BOT_GIT_COMMIT / GIT_COMMIT when set (Docker builds), else `git rev-parse HEAD`.
 */
async function getLocalCommit(): Promise<string> {
  const fromEnv = getEnvCommit();
  if (fromEnv) {
    return fromEnv;
  }

  const cmd = new Deno.Command("git", {
    args: ["rev-parse", "HEAD"],
    stdout: "piped",
    stderr: "piped",
  });
  const output = await cmd.output();
  if (!output.success) {
    throw new Error("Failed to get local git commit");
  }
  return new TextDecoder().decode(output.stdout).trim();
}

/**
 * Get the latest commit hash from GitHub API.
 */
async function getRemoteCommit(): Promise<string> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits/main`;
  const response = await fetch(url, {
    headers: { "Accept": "application/vnd.github.v3+json" },
  });

  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}`);
  }

  const data = await response.json();
  return data.sha;
}

/**
 * Return true if `ancestor` is an ancestor of `descendant` (git merge-base --is-ancestor).
 */
async function isAncestor(ancestor: string, descendant: string): Promise<boolean> {
  const cmd = new Deno.Command("git", {
    args: ["merge-base", "--is-ancestor", ancestor, descendant],
    stdout: "null",
    stderr: "null",
  });
  const output = await cmd.output();
  return output.success;
}

/**
 * Check if the local version matches the latest on GitHub.
 * Distinguishes behind (need pull) from ahead (local-only commits) and diverged.
 *
 * In Docker without a usable commit identity (no GIT_COMMIT / BOT_GIT_COMMIT and
 * git HEAD unavailable), returns an error so callers skip "Update Available" notifies.
 */
export async function checkForUpdates(): Promise<VersionCheckResult> {
  try {
    let localCommit: string;
    try {
      localCommit = await getLocalCommit();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        upToDate: true,
        localCommit: "unknown",
        remoteCommit: "unknown",
        error: isDockerContainer()
          ? `Docker image has no commit identity (set GIT_COMMIT at build time): ${message}`
          : message,
      };
    }

    if (!COMMIT_SHA_RE.test(localCommit)) {
      return {
        upToDate: true,
        localCommit: "unknown",
        remoteCommit: "unknown",
        error: isDockerContainer()
          ? "Docker image has no usable commit identity (set GIT_COMMIT at build time)"
          : "Unusable local commit identity",
      };
    }

    const remoteCommit = await getRemoteCommit();

    const upToDate = localCommit === remoteCommit ||
      localCommit.startsWith(remoteCommit.substring(0, 7)) ||
      remoteCommit.startsWith(localCommit.substring(0, 7));
    let behind = false;
    let ahead = false;

    if (!upToDate) {
      // When only an env SHA is available (typical Docker image), git objects may be
      // missing — fall back to "not equal remote" ⇒ treat as behind for pull notify.
      const hasEnvCommit = Boolean(getEnvCommit());
      if (hasEnvCommit && isDockerContainer()) {
        behind = true;
      } else {
        // local ancestor of remote → we are behind; remote ancestor of local → we are ahead
        behind = await isAncestor(localCommit, remoteCommit);
        ahead = await isAncestor(remoteCommit, localCommit);
        // If both false, histories diverged — treat as behind so operators still get a signal
        if (!behind && !ahead) {
          behind = true;
        }
      }
    }

    return {
      upToDate,
      localCommit: localCommit.substring(0, 7),
      remoteCommit: remoteCommit.substring(0, 7),
      behind,
      ahead,
    };
  } catch (error) {
    return {
      upToDate: true, // Don't block startup on version check failure
      localCommit: "unknown",
      remoteCommit: "unknown",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Log a version check result at startup.
 * Returns an embed-friendly object if an update is available.
 */
export async function runVersionCheck(): Promise<{
  updateAvailable: boolean;
  embed?: {
    color: number;
    title: string;
    description: string;
    fields: Array<{ name: string; value: string; inline: boolean }>;
  };
}> {
  const result = await checkForUpdates();

  if (result.error) {
    console.log(`[Version Check] Could not check for updates: ${result.error}`);
    return { updateAvailable: false };
  }

  if (result.upToDate) {
    console.log(`[Version Check] Up to date (${result.localCommit})`);
    return { updateAvailable: false };
  }

  // Local-only commits: not an "update available" situation
  if (result.ahead && !result.behind) {
    console.log(`[Version Check] Ahead of GitHub main (local ${result.localCommit}, remote ${result.remoteCommit})`);
    return { updateAvailable: false };
  }

  if (!result.behind) {
    return { updateAvailable: false };
  }

  console.log(`[Version Check] Update available! Local: ${result.localCommit}, Latest: ${result.remoteCommit}`);

  return {
    updateAvailable: true,
    embed: {
      color: 0xFFA500, // Orange
      title: "Update Available",
      description: `A newer version of claude-code-discord is available on GitHub. You are running **v${BOT_VERSION}**.`,
      fields: [
        { name: "Your Commit", value: `\`${result.localCommit}\``, inline: true },
        { name: "Latest Commit", value: `\`${result.remoteCommit}\``, inline: true },
        {
          name: "How to Update",
          value: isDockerContainer()
            ? "```\ndocker compose pull && docker compose up -d\n```"
            : "```\ngit pull origin main && deno task start\n```",
          inline: false
        },
      ],
    },
  };
}

/** Cached update check result for use in /status and periodic checks */
let lastCheckResult: VersionCheckResult | null = null;

/** Get cached update status (non-blocking, returns last known state) */
export function getLastCheckResult(): VersionCheckResult | null {
  return lastCheckResult;
}

/**
 * Start periodic update checks.
 * Runs checkForUpdates every `intervalMs` (default: 12 hours).
 * Calls `onUpdateAvailable` when the bot is behind remote main.
 *
 * The first run only populates the cache (no Discord notify) so startup
 * does not double-fire with `runVersionCheck()`.
 */
export function startPeriodicUpdateCheck(
  onUpdateAvailable: (result: VersionCheckResult) => void,
  intervalMs = 12 * 60 * 60 * 1000
): number {
  const check = async (notify: boolean) => {
    try {
      const result = await checkForUpdates();
      lastCheckResult = result;
      // Skip notify when we lack identity / check failed — don't lie about updates
      if (notify && result.behind && !result.error) {
        onUpdateAvailable(result);
      }
    } catch {
      // Silently ignore periodic check failures
    }
  };

  // Populate cache only — startup Discord notify is owned by runVersionCheck()
  void check(false);

  return setInterval(() => {
    void check(true);
  }, intervalMs) as unknown as number;
}
