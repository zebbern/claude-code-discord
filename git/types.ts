export interface GitInfo {
  repo: string;
  branch: string;
}

export interface WorktreeResult {
  result: string;
  fullPath: string;
  baseDir: string;
  isExisting?: boolean;
}

export interface WorktreeListResult {
  result: string;
  baseDir: string;
}

export interface GitStatus {
  status: string;
  branch: string;
  remote: string;
}