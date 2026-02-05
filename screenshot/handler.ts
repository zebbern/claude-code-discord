/**
 * Screenshot handler for capturing the host machine's screen
 * Only works in non-Docker, non-headless environments
 */

import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ScreenshotResult, ScreenshotEnvironment } from "./types.ts";

const exec = promisify(execCallback);

/**
 * Check if running in Docker
 */
async function isDockerEnvironment(): Promise<boolean> {
  // Check environment variable (set in our Dockerfile)
  if (Deno.env.get("DOCKER_CONTAINER") === "true") {
    return true;
  }
  
  // Check for .dockerenv file
  try {
    await Deno.stat("/.dockerenv");
    return true;
  } catch {
    // Not in Docker
  }
  
  // Check for docker in cgroup
  try {
    const cgroup = await Deno.readTextFile("/proc/1/cgroup");
    if (cgroup.includes("docker")) {
      return true;
    }
  } catch {
    // Not Linux or can't read cgroup
  }
  
  return false;
}

/**
 * Check if a display is available
 */
function hasDisplay(): boolean {
  const os = Deno.build.os;
  
  // Windows always has a display if running interactively
  if (os === "windows") {
    return true;
  }
  
  // macOS - check if running in a GUI session
  if (os === "darwin") {
    return true; // Assume GUI on macOS
  }
  
  // Linux - check DISPLAY environment variable
  const display = Deno.env.get("DISPLAY");
  return !!display;
}

/**
 * Get screenshot environment information
 */
export async function getScreenshotEnvironment(): Promise<ScreenshotEnvironment> {
  const isDocker = await isDockerEnvironment();
  const display = hasDisplay();
  const platform = Deno.build.os;
  
  let canCapture = true;
  let reason: string | undefined;
  
  if (isDocker) {
    canCapture = false;
    reason = "Screenshot is not available in Docker containers";
  } else if (!display) {
    canCapture = false;
    reason = "No display available (headless environment)";
  }
  
  return {
    isDocker,
    hasDisplay: display,
    platform,
    canCapture,
    reason,
  };
}

/**
 * Capture screenshot based on platform
 */
export async function captureScreenshot(outputDir: string = Deno.cwd()): Promise<ScreenshotResult> {
  const env = await getScreenshotEnvironment();
  
  if (!env.canCapture) {
    return {
      success: false,
      error: env.reason || "Cannot capture screenshot",
    };
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `screenshot-${timestamp}.png`;
  const filePath = join(outputDir, filename);
  
  try {
    switch (env.platform) {
      case "windows": {
        // PowerShell screenshot command
        const psCommand = `
          Add-Type -AssemblyName System.Windows.Forms,System.Drawing
          $screens = [System.Windows.Forms.Screen]::AllScreens
          $top = ($screens | ForEach-Object {$_.Bounds.Top} | Measure-Object -Minimum).Minimum
          $left = ($screens | ForEach-Object {$_.Bounds.Left} | Measure-Object -Minimum).Minimum
          $width = ($screens | ForEach-Object {$_.Bounds.Right} | Measure-Object -Maximum).Maximum - $left
          $height = ($screens | ForEach-Object {$_.Bounds.Bottom} | Measure-Object -Maximum).Maximum - $top
          $bitmap = New-Object System.Drawing.Bitmap($width, $height)
          $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
          $graphics.CopyFromScreen($left, $top, 0, 0, [System.Drawing.Size]::new($width, $height))
          $bitmap.Save('${filePath.replace(/\\/g, "\\\\")}')
          $graphics.Dispose()
          $bitmap.Dispose()
        `.trim().replace(/\n/g, "; ");
        
        await exec(`powershell -NoProfile -Command "${psCommand}"`);
        break;
      }
      
      case "darwin": {
        // macOS screencapture
        await exec(`screencapture -x "${filePath}"`);
        break;
      }
      
      case "linux": {
        // Try different Linux screenshot tools
        const tools = [
          `gnome-screenshot -f "${filePath}"`,
          `import -window root "${filePath}"`,
          `scrot "${filePath}"`,
        ];
        
        let captured = false;
        for (const tool of tools) {
          try {
            await exec(tool);
            captured = true;
            break;
          } catch {
            // Try next tool
          }
        }
        
        if (!captured) {
          return {
            success: false,
            error: "No screenshot tool available (install gnome-screenshot, imagemagick, or scrot)",
          };
        }
        break;
      }
      
      default:
        return {
          success: false,
          error: `Unsupported platform: ${env.platform}`,
        };
    }
    
    // Verify the file was created
    if (existsSync(filePath)) {
      return {
        success: true,
        filePath,
      };
    } else {
      return {
        success: false,
        error: "Screenshot file was not created",
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Screenshot capture failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Clean up screenshot file after upload
 */
export async function cleanupScreenshot(filePath: string): Promise<void> {
  try {
    await Deno.remove(filePath);
  } catch {
    // Ignore cleanup errors
  }
}
