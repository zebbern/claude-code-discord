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
  toggleMcpServerActive,
  reconnectMcpServerActive,
  setMcpServersActive,
} from "./query-manager.ts";
export type { ClaudeInitInfo, RewindFilesResult } from "./query-manager.ts";
// Hooks — passive SDK callbacks for tool/notification/task observability
export { buildHooks } from "./hooks.ts";
export type { HookConfig, HookEvent_Discord } from "./hooks.ts";
// AskUserQuestion — interactive question flow (SDK v0.1.71+)
export { buildQuestionMessages, parseAskUserButtonId, parseAskUserConfirmId } from "./user-question.ts";
export type { AskUserCallback, AskUserQuestionInput, AskUserQuestionItem, AskUserOption } from "./user-question.ts";
// PermissionRequest — interactive tool-permission flow (replaces TUI prompt)
export { buildPermissionEmbed, describeToolAction, parsePermissionButtonId } from "./permission-request.ts";
export type { PermissionRequestCallback } from "./permission-request.ts";