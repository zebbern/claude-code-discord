import { promisify } from "node:util";
import { exec as execCallback } from "node:child_process";
import { basename } from "node:path";
import process from "node:process";
import type { GitInfo, WorktreeResult, WorktreeListResult, GitStatus } from "./types.ts";

const exec = promisify(execCallback);

/**
 * Validate a git branch name to prevent command injection.
 * Rejects names containing shell metacharacters or patterns that could
 * be interpreted as flags/options.
 */
export function validateBranchName(branch: string): { valid: boolean; reason?: string } {
  if (!branch || !branch.trim()) {
    return { valid: false, reason: "Branch name cannot be empty" };
  }

  // Reject names starting with '-' (could be interpreted as flags)
  if (branch.startsWith('-')) {
    return { valid: false, reason: "Branch name cannot start with '-'" };
  }

  // Reject shell metacharacters that could enable command injection
  const dangerousChars = /[;&|`$(){}!\\\n\r"'<>]/;
  if (dangerousChars.test(branch)) {
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

/**
 * Shell-escape a string argument for safe use in exec() commands.
 */
function shellEscape(arg: string): string {
  // Wrap in single quotes; escape any embedded single quotes
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

export async function getGitInfo(workDir: string = Deno.cwd()): Promise<GitInfo> {
  try {
    const { stdout: branch } = await exec("git branch --show-current", { cwd: workDir });
    const branchName = branch.trim() || "main";
    
    let repoName = basename(workDir);
    
    try {
      const { stdout: remoteUrl } = await exec("git config --get remote.origin.url", { cwd: workDir });
      if (remoteUrl) {
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

export async function executeGitCommand(workDir: string, command: string): Promise<string> {
  try {
    const { stdout, stderr } = await exec(command, { 
      cwd: workDir,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
    });
    
    if (stderr && !stdout) {
      return `Error:\n${stderr}`;
    }
    
    return stdout || stderr || "Command executed successfully.";
  // deno-lint-ignore no-explicit-any
  } catch (error: any) {
    return `Execution error: ${error.message}\n${error.stderr || ''}`;
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
  const existingWorktrees = await executeGitCommand(baseWorkDir, "git worktree list --porcelain");
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

  // Check if branch already exists (use shell-escaped branch name)
  const branchCheckResult = await executeGitCommand(baseWorkDir, `git show-ref --verify --quiet refs/heads/${shellEscape(branch)}`);
  const branchExists = !branchCheckResult.startsWith('Execution error:') && !branchCheckResult.startsWith('Error:');

  let result: string;
  if (branchExists) {
    result = await executeGitCommand(baseWorkDir, `git worktree add ${shellEscape(worktreeDir)} ${shellEscape(branch)}`);
  } else {
    result = await executeGitCommand(baseWorkDir, `git worktree add ${shellEscape(worktreeDir)} -b ${shellEscape(branch)} ${shellEscape(actualRef)}`);
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

  const result = await executeGitCommand(baseWorkDir, "git worktree list");
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
  const worktreeList = await executeGitCommand(baseWorkDir, "git worktree list --porcelain");
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

  // Remove the worktree using shell-escaped path
  const result = await executeGitCommand(baseWorkDir, `git worktree remove ${shellEscape(worktreePathToRemove)} --force`);

  return { result, fullPath: worktreePathToRemove, baseDir: baseWorkDir };
}

export async function getGitStatus(workDir: string): Promise<GitStatus> {
  try {
    // Get git status with better formatting
    const statusResult = await executeGitCommand(workDir, "git status --porcelain");
    const branchResult = await executeGitCommand(workDir, "git branch --show-current");
    const remoteResult = await executeGitCommand(workDir, "git remote -v");
    
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
  } catch (error) {
    return {
      status: "Error getting git status",
      branch: "unknown", 
      remote: "unknown"
    };
  }
}