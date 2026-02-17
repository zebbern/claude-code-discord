// Claude Code integration exports
export { claudeCommands, createClaudeHandlers } from "./command.ts";
export { cleanSessionId, sendToClaudeCode } from "./client.ts";
export type { ClaudeModelOptions, SDKPermissionMode, ThinkingConfig, EffortLevel, SDKAgentDefinition, SDKModelInfo } from "./client.ts";
export { createClaudeSender, expandableContent } from "./discord-sender.ts";
export { convertToClaudeMessages } from "./message-converter.ts";
export { 
  enhancedClaudeCommands, 
  createEnhancedClaudeHandlers 
} from "./enhanced-commands.ts";
export {
  enhancedClaudeQuery,
  ClaudeSessionManager,
  CLAUDE_MODELS,
  CLAUDE_TEMPLATES,
  initModels,
  refreshModels,
  updateModelsFromSDK,
  resolveModelId,
  isValidModel
} from "./enhanced-client.ts";
export type { DiscordSender } from "./discord-sender.ts";
export type { ClaudeMessage } from "./types.ts";
export type { 
  EnhancedClaudeOptions,
  ClaudeSession,
  ModelInfo
} from "./enhanced-client.ts";
export type { EnhancedClaudeHandlerDeps } from "./enhanced-commands.ts";
// Info & control commands — /claude-info, /rewind, /claude-control
export { infoCommands, createInfoCommandHandlers } from "./info-commands.ts";
export type { InfoCommandHandlerDeps } from "./info-commands.ts";
// Query manager — active query controls, info retrieval, rewind
export {
  setActiveQuery,
  getActiveQuery,
  trackMessageId,
  getTrackedMessages,
  clearTrackedMessages,
  interruptActiveQuery,
  setActiveModel,
  setActivePermissionMode,
  rewindToMessage,
  getInitInfo,
  getAccountInfo,
  getSupportedModels,
  getMcpServerStatus,
  fetchClaudeInfo,
} from "./query-manager.ts";
export type { ClaudeInitInfo, RewindFilesResult } from "./query-manager.ts";