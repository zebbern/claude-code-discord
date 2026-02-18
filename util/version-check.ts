/**
 * Version checker - compares local commit hash against GitHub's latest.
 * Notifies at startup if the bot is behind.
 *
 * @module util/version-check
 */

const REPO_OWNER = "zebbern";
const REPO_NAME = "claude-code-discord";

interface VersionCheckResult {
  upToDate: boolean;
  localCommit: string;
  remoteCommit: string;
  behind?: boolean;
  error?: string;
}

/**
 * Get the local HEAD commit hash using git.
 */
async function getLocalCommit(): Promise<string> {
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
 * Check if the local version matches the latest on GitHub.
 */
export async function checkForUpdates(): Promise<VersionCheckResult> {
  try {
    const [localCommit, remoteCommit] = await Promise.all([
      getLocalCommit(),
      getRemoteCommit(),
    ]);

    const upToDate = localCommit === remoteCommit;

    return {
      upToDate,
      localCommit: localCommit.substring(0, 7),
      remoteCommit: remoteCommit.substring(0, 7),
      behind: !upToDate,
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

  console.log(`[Version Check] Update available! Local: ${result.localCommit}, Latest: ${result.remoteCommit}`);

  return {
    updateAvailable: true,
    embed: {
      color: 0xFFA500, // Orange
      title: "Update Available",
      description: "A newer version of claude-code-discord is available on GitHub.",
      fields: [
        { name: "Your Version", value: `\`${result.localCommit}\``, inline: true },
        { name: "Latest Version", value: `\`${result.remoteCommit}\``, inline: true },
        {
          name: "How to Update",
          value: Deno.env.get("DOCKER_CONTAINER")
            ? "```\ndocker compose pull && docker compose up -d\n```"
            : "```\ngit pull origin main && deno task start\n```",
          inline: false
        },
      ],
    },
  };
}
