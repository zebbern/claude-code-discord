// Advanced settings exports (legacy)
export { 
  advancedSettingsCommands,
  DEFAULT_SETTINGS
} from "./advanced-settings.ts";
export { createAdvancedSettingsHandlers } from "./handlers.ts";
export type { 
  AdvancedBotSettings 
} from "./advanced-settings.ts";
export type { 
  SettingsHandlerDeps 
} from "./handlers.ts";

// New unified settings exports
export {
  unifiedSettingsCommands,
  todosCommand,
  mcpCommand,
  UNIFIED_DEFAULT_SETTINGS,
  THINKING_MODES,
  OPERATION_MODES,
  ANTHROPIC_RATE_LIMITS
} from "./unified-settings.ts";
export { createUnifiedSettingsHandlers } from "./unified-handlers.ts";
export type {
  UnifiedBotSettings,
  RateLimitTier
} from "./unified-settings.ts";
export type {
  UnifiedSettingsHandlerDeps,
  TodoItem,
  MCPServerConfig
} from "./unified-handlers.ts";