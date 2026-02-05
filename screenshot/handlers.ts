/**
 * Screenshot command handlers
 */

import type { InteractionContext } from "../discord/index.ts";
import { captureScreenshot, cleanupScreenshot, getScreenshotEnvironment } from "./handler.ts";

export interface ScreenshotHandlerDeps {
  workDir: string;
}

/**
 * Create screenshot command handlers
 */
export function createScreenshotHandlers(deps: ScreenshotHandlerDeps) {
  const { workDir } = deps;

  return {
    async screenshot(ctx: InteractionContext): Promise<void> {
      await ctx.deferReply();
      
      // Check if screenshot is available in this environment
      const env = await getScreenshotEnvironment();
      
      if (!env.canCapture) {
        await ctx.editReply({
          content: `❌ **Screenshot Not Available**\n\n${env.reason || "Cannot capture screenshot in this environment."}\n\n**Environment Details:**\n• Platform: ${env.platform}\n• Docker: ${env.isDocker ? "Yes" : "No"}\n• Display: ${env.hasDisplay ? "Available" : "Not available"}`,
        });
        return;
      }
      
      // Get delay parameter
      const delayStr = ctx.getString("delay");
      let delay = 0;
      if (delayStr) {
        delay = Math.min(Math.max(parseInt(delayStr, 10) || 0, 0), 10);
        if (delay > 0) {
          await ctx.editReply({
            content: `⏳ Capturing screenshot in ${delay} seconds...`,
          });
          await new Promise(resolve => setTimeout(resolve, delay * 1000));
        }
      }
      
      await ctx.editReply({
        content: "📸 Capturing screenshot...",
      });
      
      // Capture screenshot
      const result = await captureScreenshot(workDir);
      
      if (!result.success || !result.filePath) {
        await ctx.editReply({
          content: `❌ **Screenshot Failed**\n\n${result.error || "Unknown error occurred."}`,
        });
        return;
      }
      
      try {
        // Send the screenshot with file attachment
        await ctx.editReply({
          content: `📸 **Screenshot Captured**\n\n• Platform: ${env.platform}\n• Time: ${new Date().toLocaleString()}`,
          files: [{
            path: result.filePath,
            name: "screenshot.png",
            description: "Screenshot of host machine",
          }],
        });
        
        // Clean up the temporary file after a short delay to ensure upload completes
        setTimeout(async () => {
          await cleanupScreenshot(result.filePath!);
        }, 5000);
      } catch (error) {
        await ctx.editReply({
          content: `❌ **Upload Failed**\n\n${error instanceof Error ? error.message : "Could not upload screenshot."}`,
        });
        
        // Clean up on error
        await cleanupScreenshot(result.filePath);
      }
    },
  };
}
