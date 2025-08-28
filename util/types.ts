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