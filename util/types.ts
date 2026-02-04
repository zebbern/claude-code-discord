/**
 * Safely extracts error message from unknown error type.
 * Use in catch blocks where error is typed as unknown.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export interface SettingsResult {
  success: boolean;
  mentionEnabled?: boolean;
  mentionUserId?: string | null;
  message?: string;
}

export interface PwdResult {
  workDir: string;
  categoryName: string;
  repoName: string;
  branchName: string;
}

export interface StatusResult {
  claudeStatus: string;
  gitStatus: string;
  gitBranch: string;
  gitRemote: string;
  runningProcessCount: number;
}