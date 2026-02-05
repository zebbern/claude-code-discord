/**
 * Screenshot module exports
 */

export { captureScreenshot, cleanupScreenshot, getScreenshotEnvironment } from "./handler.ts";
export { screenshotCommands } from "./command.ts";
export { createScreenshotHandlers } from "./handlers.ts";
export type { ScreenshotResult, ScreenshotEnvironment } from "./types.ts";
