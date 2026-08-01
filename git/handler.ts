import { basename } from "node:path";
import type { GitInfo, WorktreeResult, WorktreeListResult, GitStatus } from "./types.ts";

/**
 * Validate a git branch name to prevent command injection.
 * Rejects names containing shell metacharacters or patterns that could
 * be interpreted as flags/options.
 */
/** Shell metacharacters — defense-in-depth even with argv spawn (branch names) */
const SHELL_METACHARS = /[;&|`$(){}!\\\n\r"'<>]/;

/** Metacharacters rejected outside quoted segments in `/git` command strings */
const GIT_UNQUOTED_METACHARS = /[;&|`$(){}!\\\n\r<>]/;

export function validateBranchName(branch: string): { valid: boolean; reason?: string } {
  if (!branch || !branch.trim()) {
    return { valid: false, reason: "Branch name cannot be empty" };
  }

  // Reject names starting with '-' (could be interpreted as flags)
  if (branch.startsWith('-')) {
    return { valid: false, reason: "Branch name cannot start with '-'" };
  }

  // Reject shell metacharacters that could enable command injection
  if (SHELL_METACHARS.test(branch)) {
    return { valid: false, reason: "Branch name contains invalid characters" };
  }

  // Reject git-specific invalid patterns
  if (branch.includes('..') || branch.includes('~') || branch.includes('^') || branch.includes(':')) {
    return { valid: false, reason: "Branch name contains invalid git ref characters" };
  }

  // Reject whitespace
  if (/\s/.test(branch)) {
    return { valid: false, reason: "Branch name cannot contain whitespace" };
  }

  return { valid: true };
}

type GitTokenizeResult =
  | { ok: true; tokens: string[] }
  | { ok: false; reason: string };

/**
 * Shell-like argv tokenization (no shell execution).
 * Respects single/double quotes; rejects metacharacters outside quotes.
 * Strips a leading `git` token so callers can pass args to Deno.Command("git", …).
 */
function tokenizeGitCommand(command: string): GitTokenizeResult {
  if (!command || !command.trim()) {
    return { ok: false, reason: "Git command cannot be empty" };
  }

  const tokens: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i]!;

    if (inSingle) {
      if (ch === "'") {
        inSingle = false;
      } else {
        current += ch;
      }
      continue;
    }

    if (inDouble) {
      if (ch === '"') {
        inDouble = false;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    if (GIT_UNQUOTED_METACHARS.test(ch)) {
      return { ok: false, reason: "Git command contains invalid characters" };
    }
    current += ch;
  }

  if (inSingle || inDouble) {
    return { ok: false, reason: "Unclosed quote in git command" };
  }
  if (current) {
    tokens.push(current);
  }

  if (tokens.length > 0 && tokens[0]!.toLowerCase() === "git") {
    tokens.shift();
  }

  if (tokens.length === 0) {
    return { ok: false, reason: "Git command cannot be empty" };
  }

  return { ok: true, tokens };
}

/**
 * Validate a user-supplied git command string (the part after `/git`).
 * Quotes are allowed for message text; metacharacters outside quotes are rejected.
 * Execution uses argv spawn (no shell).
 */
export function validateGitCommandArgs(command: string): { valid: boolean; reason?: string } {
  const result = tokenizeGitCommand(command);
  if (!result.ok) {
    return { valid: false, reason: result.reason };
  }
  return { valid: true };
}

/**
 * Split a validated git command string into argv tokens for Deno.Command.
 * Respects quotes; strips a leading `git` if the user included it.
 */
export function splitGitArgs(command: string): string[] {
  const result = tokenizeGitCommand(command);
  if (!result.ok) {
    return [];
  }
  return result.tokens;
}

/**
 * Run git via Deno.Command argv arrays (no shell interpolation).
 * @param args Git subcommand args only (e.g. `["status", "--porcelain"]`)
 */
export async function executeGitCommand(workDir: string, args: string[]): Promise<string> {
  try {
    const cmd = new Deno.Command("git", {
      args,
      cwd: workDir,
      env: { ...Deno.env.toObject(), GIT_TERMINAL_PROMPT: "0" },
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await cmd.output();
    const out = new TextDecoder().decode(stdout);
    const err = new TextDecoder().decode(stderr);

    if (code !== 0 && !out) {
      return `Error:\n${err || `git exited with code ${code}`}`;
    }

    return out || err || "Command executed successfully.";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Execution error: ${message}`;
  }
}

export async function getGitInfo(workDir: string = Deno.cwd()): Promise<GitInfo> {
  try {
    const branch = await executeGitCommand(workDir, ["branch", "--show-current"]);
    if (branch.startsWith("Execution error:") || branch.startsWith("Error:")) {
      throw new Error(branch);
    }
    const branchName = branch.trim() || "main";

    let repoName = basename(workDir);

    try {
      const remoteUrl = await executeGitCommand(workDir, ["config", "--get", "remote.origin.url"]);
      if (remoteUrl && !remoteUrl.startsWith("Execution error:") && !remoteUrl.startsWith("Error:")) {
        // Match repo name from various URL formats:
        // - https://github.com/user/repo.git
        // - git@github.com:user/repo.git
        // - https://github.com/user/repo
        const match = remoteUrl.match(/[\/:]([^\/:\s]+?)(\.git)?\s*$/);
        if (match) {
          repoName = match[1];
        }
      }
    } catch {
      // Use directory name if remote URL cannot be obtained
    }

    // Always strip .git suffix if present
    repoName = repoName.replace(/\.git$/, '');

    return { repo: repoName, branch: branchName };
  } catch (error) {
    console.error("Failed to get Git information:", error);
    throw new Error("This directory is not a Git repository");
  }
}

export async function createWorktree(workDir: string, branch: string, ref?: string): Promise<WorktreeResult> {
  // Validate branch name to prevent command injection
  const branchValidation = validateBranchName(branch);
  if (!branchValidation.valid) {
    return { result: `Error: ${branchValidation.reason}`, fullPath: '', baseDir: workDir };
  }
  if (ref) {
    const refValidation = validateBranchName(ref);
    if (!refValidation.valid) {
      return { result: `Error: Invalid ref - ${refValidation.reason}`, fullPath: '', baseDir: workDir };
    }
  }

  const actualRef = ref || branch;
  let baseWorkDir = workDir;

  try {
    const gitFile = await Deno.readTextFile(`${workDir}/.git`);
    if (gitFile.includes('gitdir:')) {
      baseWorkDir = workDir.replace(/\/\.git\/worktrees\/[^\/]+$/, '');
    }
  } catch {
    // For .git directory, this is a normal repository
  }

  // Check if worktree already exists for this branch using --porcelain for reliable parsing
  const existingWorktrees = await executeGitCommand(baseWorkDir, ["worktree", "list", "--porcelain"]);
  if (!existingWorktrees.startsWith('Execution error:') && !existingWorktrees.startsWith('Error:')) {
    const existingPath = findWorktreePathByBranch(existingWorktrees, branch);
    if (existingPath) {
      return {
        result: `Found existing worktree. Path: ${existingPath}`,
        fullPath: existingPath,
        baseDir: baseWorkDir,
        isExisting: true
      };
    }
  }

  // The actual worktree directory path (not the .git/worktrees path)
  const worktreeDir = `${baseWorkDir}/../${branch}`;

  // Check if directory already exists
  try {
    await Deno.stat(worktreeDir);
    return {
      result: `Error: Directory '${worktreeDir}' already exists.`,
      fullPath: worktreeDir,
      baseDir: baseWorkDir
    };
  } catch {
    // Directory doesn't exist, which is good
  }

  // Check if branch already exists (argv — no shell escaping)
  const branchCheckResult = await executeGitCommand(baseWorkDir, [
    "show-ref",
    "--verify",
    "--quiet",
    `refs/heads/${branch}`,
  ]);
  const branchExists = !branchCheckResult.startsWith('Execution error:') && !branchCheckResult.startsWith('Error:');

  let result: string;
  if (branchExists) {
    result = await executeGitCommand(baseWorkDir, ["worktree", "add", worktreeDir, branch]);
  } else {
    result = await executeGitCommand(baseWorkDir, [
      "worktree",
      "add",
      worktreeDir,
      "-b",
      branch,
      actualRef,
    ]);
  }

  return { result, fullPath: worktreeDir, baseDir: baseWorkDir };
}

/**
 * Parse `git worktree list --porcelain` output and find the path for a given branch.
 * Porcelain format uses structured blocks separated by blank lines:
 *   worktree /path/to/worktree
 *   HEAD abc123
 *   branch refs/heads/branch-name
 */
function findWorktreePathByBranch(porcelainOutput: string, branch: string): string | null {
  const blocks = porcelainOutput.split('\n\n');
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    let path = '';
    let blockBranch = '';
    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        path = line.substring('worktree '.length);
      } else if (line.startsWith('branch refs/heads/')) {
        blockBranch = line.substring('branch refs/heads/'.length);
      }
    }
    if (blockBranch === branch && path) {
      return path;
    }
  }
  return null;
}

export async function listWorktrees(workDir: string): Promise<WorktreeListResult> {
  let baseWorkDir = workDir;

  try {
    const gitFile = await Deno.readTextFile(`${workDir}/.git`);
    if (gitFile.includes('gitdir:')) {
      baseWorkDir = workDir.replace(/\/\.git\/worktrees\/[^\/]+$/, '');
    }
  } catch {
    // For .git directory, this is a normal repository
  }

  const result = await executeGitCommand(baseWorkDir, ["worktree", "list"]);
  return { result, baseDir: baseWorkDir };
}

export async function removeWorktree(workDir: string, branch: string): Promise<WorktreeResult> {
  // Validate branch name to prevent command injection
  const branchValidation = validateBranchName(branch);
  if (!branchValidation.valid) {
    return { result: `Error: ${branchValidation.reason}`, fullPath: '', baseDir: workDir };
  }

  let baseWorkDir = workDir;

  try {
    const gitFile = await Deno.readTextFile(`${workDir}/.git`);
    if (gitFile.includes('gitdir:')) {
      baseWorkDir = workDir.replace(/\/\.git\/worktrees\/[^\/]+$/, '');
    }
  } catch {
    // For .git directory, this is a normal repository
  }

  // Use --porcelain for reliable parsing (handles paths with spaces)
  const worktreeList = await executeGitCommand(baseWorkDir, ["worktree", "list", "--porcelain"]);
  if (worktreeList.startsWith('Execution error:') || worktreeList.startsWith('Error:')) {
    return { result: worktreeList, fullPath: '', baseDir: baseWorkDir };
  }

  const worktreePathToRemove = findWorktreePathByBranch(worktreeList, branch);

  if (!worktreePathToRemove) {
    return {
      result: `Error: Worktree for branch '${branch}' not found.`,
      fullPath: '',
      baseDir: baseWorkDir
    };
  }

  const result = await executeGitCommand(baseWorkDir, [
    "worktree",
    "remove",
    worktreePathToRemove,
    "--force",
  ]);

  return { result, fullPath: worktreePathToRemove, baseDir: baseWorkDir };
}

export async function getGitStatus(workDir: string): Promise<GitStatus> {
  try {
    // Get git status with better formatting
    const statusResult = await executeGitCommand(workDir, ["status", "--porcelain"]);
    const branchResult = await executeGitCommand(workDir, ["branch", "--show-current"]);
    const remoteResult = await executeGitCommand(workDir, ["remote", "-v"]);

    // Format status output
    let formattedStatus = "Working directory clean";
    if (statusResult && !statusResult.includes("Error") && statusResult.trim()) {
      const lines = statusResult.trim().split('\n');
      const changes = lines.map(line => {
        const status = line.substring(0, 2);
        const file = line.substring(3);

        // Skip deno.lock and other build artifacts
        if (file.includes('deno.lock') || file.includes('.DS_Store') || file.includes('node_modules/')) {
          return null;
        }

        let changeType = "";
        if (status === "??") changeType = "Untracked";
        else if (status.includes("M")) changeType = "Modified";
        else if (status.includes("A")) changeType = "Added";
        else if (status.includes("D")) changeType = "Deleted";
        else if (status.includes("R")) changeType = "Renamed";
        else changeType = "Changed";

        return `${changeType}: ${file}`;
      }).filter(Boolean);

      if (changes.length > 0) {
        formattedStatus = changes.slice(0, 10).join('\n');
        if (changes.length > 10) {
          formattedStatus += `\n... and ${changes.length - 10} more files`;
        }
      }
    }

    // Clean up branch name
    const cleanBranch = branchResult.replace(/Error:.*|Execution error:.*/, "").trim() || "unknown";

    // Format remote info
    let formattedRemote = "No remotes configured";
    if (remoteResult && !remoteResult.includes("Error") && remoteResult.trim()) {
      const remotes = remoteResult.trim().split('\n')
        .filter(line => line.includes('(fetch)'))
        .map(line => {
          const parts = line.split(/\s+/);
          return `${parts[0]}: ${parts[1]}`;
        });
      formattedRemote = remotes.join('\n') || "No remotes configured";
    }

    return {
      status: formattedStatus,
      branch: cleanBranch,
      remote: formattedRemote
    };
  } catch (_error) {
    return {
      status: "Error getting git status",
      branch: "unknown",
      remote: "unknown"
    };
  }
}
