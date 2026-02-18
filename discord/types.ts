// Discord module types
import type { BotSettings } from "../types/shared.ts";

export interface EmbedData {
  color?: number;
  title?: string;
  description?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: boolean;
}

export interface ComponentData {
  type: 'button';
  customId: string;
  label: string;
  style: 'primary' | 'secondary' | 'success' | 'danger' | 'link';
  disabled?: boolean;
}

export interface FileAttachment {
  /** File path or URL */
  path: string;
  /** Optional display name */
  name?: string;
  /** Optional description */
  description?: string;
}

export interface MessageContent {
  content?: string;
  embeds?: EmbedData[];
  components?: Array<{ type: 'actionRow'; components: ComponentData[] }>;
  /** File attachments to include */
  files?: FileAttachment[];
}

export interface InteractionContext {
  deferReply(): Promise<void>;
  editReply(content: MessageContent): Promise<void>;
  followUp(content: MessageContent & { ephemeral?: boolean }): Promise<void>;
  reply(content: MessageContent & { ephemeral?: boolean }): Promise<void>;
  update(content: MessageContent): Promise<void>;
  getString(name: string, required?: boolean): string | null;
  getInteger(name: string, required?: boolean): number | null;
  getBoolean(name: string, required?: boolean): boolean | null;
  /** Returns the set of role IDs the invoking member has */
  getMemberRoleIds(): Set<string>;
  /** Returns the invoking member's user ID */
  getUserId(): string;
}

export interface BotConfig {
  discordToken: string;
  applicationId: string;
  workDir: string;
  repoName: string;
  branchName: string;
  categoryName?: string;
  defaultMentionUserId?: string;
}

// Abstract command handler interface
export interface CommandHandler {
  // Execute the command
  execute(ctx: InteractionContext): Promise<void> | void;
  // Optional: Handle button interactions for this command
  handleButton?(ctx: InteractionContext, customId: string): Promise<void> | void;
}

// Map of command name to handler
export type CommandHandlers = Map<string, CommandHandler>;

// Button handler type
export type ButtonHandler = (ctx: InteractionContext) => Promise<void> | void;

// Button handler registry  
export type ButtonHandlers = Map<string, ButtonHandler>;

// Interfaces for dependency injection

export interface SlashCommand {
  name: string;
  description: string;
  // deno-lint-ignore no-explicit-any
  options?: any[];
  // deno-lint-ignore no-explicit-any
  toJSON(): any;
}

export interface BotDependencies {
  commands: SlashCommand[];
  cleanSessionId?: (sessionId: string) => string;
  /** Optional bot settings for mention functionality */
  botSettings?: BotSettings;
}