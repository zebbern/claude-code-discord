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
export type { 
  BotConfig, 
  CommandHandlers, 
  ButtonHandlers, 
  MessageContent, 
  InteractionContext, 
  BotDependencies,
  EmbedData,
  ComponentData
} from "./types.ts";
export type {
  PaginationOptions,
  PaginatedContent,
  PaginationState
} from "./pagination.ts";
export type {
  FormatOptions
} from "./formatting.ts";