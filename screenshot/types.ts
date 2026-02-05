/**
 * Screenshot types
 */

export interface ScreenshotResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface ScreenshotEnvironment {
  isDocker: boolean;
  hasDisplay: boolean;
  platform: string;
  canCapture: boolean;
  reason?: string;
}
