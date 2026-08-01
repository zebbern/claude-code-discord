// Discord utilities and components
export { createDiscordBot } from "./bot.ts";
export { sanitizeChannelName, splitText } from "./utils.ts";
export {
  createPaginatedEmbeds,
  createPaginationButtons,
  initializePagination,
  handlePaginationInteraction,
  cleanupPaginationStates,
  smartSplit,
  createPaginatedMessage
} from "./pagination.ts";
export {
  formatText,
  formatFileContent,
  formatShellOutput,
  formatGitOutput,
  formatError,
  needsFormatting,
  createFormattedEmbed
} from "./formatting.ts";
export { EMBED_COLORS, formatDuration, truncateField, firstNonEmptyLine } from "./embed-theme.ts";
export { buildTextAttachment, filesForTruncation, MAX_TEXT_ATTACHMENT_BYTES } from "./attachments.ts";
export {
  buildShellResultEmbed,
  buildShellRunningEmbed,
  buildShellErrorEmbed,
  buildShellOutputFollowUpEmbed,
  buildGitResultEmbed,
  buildGitErrorEmbed,
} from "./command-embeds.ts";
export type {
  BotConfig,
  CommandHandlers,
  ButtonHandlers,
  MessageContent,
  InteractionContext,
  BotDependencies,
  MonitorConfig,
  SessionThread,
  EmbedData,
  ComponentData
} from "./types.ts";
export { SessionThreadManager, threadNameFromPrompt } from "./session-threads.ts";
// Re-export shared types for convenience
export type { BotSettings, BotSettingsUpdater } from "../types/shared.ts";
export type {
  PaginationOptions,
  PaginatedContent,
  PaginationState
} from "./pagination.ts";
export type {
  FormatOptions
} from "./formatting.ts";
