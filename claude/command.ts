import type { ClaudeResponse, ClaudeMessage } from "./types.ts";
import { sendToClaudeCode, type ClaudeModelOptions } from "./client.ts";
import { convertToClaudeMessages } from "./message-converter.ts";
import { SlashCommandBuilder } from "npm:discord.js@14.14.1";

// Discord command definitions
export const claudeCommands = [
  new SlashCommandBuilder()
    .setName('claude')
    .setDescription('Send message to Claude Code')
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('Prompt for Claude Code')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('session_id')
        .setDescription('Session ID to continue (optional)')
        .setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the previous Claude Code session')
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('Prompt for Claude Code (optional)')
        .setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('claude-cancel')
    .setDescription('Cancel currently running Claude Code command'),
];

export interface ClaudeHandlerDeps {
  workDir: string;
  getClaudeController: () => AbortController | null;
  setClaudeController: (controller: AbortController | null) => void;
  setClaudeSessionId: (sessionId: string | undefined) => void;
  sendClaudeMessages: (messages: ClaudeMessage[]) => Promise<void>;
  /** Get current runtime options from unified settings (thinking, operation, proxy) */
  getQueryOptions?: () => ClaudeModelOptions;
}

export function createClaudeHandlers(deps: ClaudeHandlerDeps) {
  const { workDir, sendClaudeMessages } = deps;
  
  return {
    // deno-lint-ignore no-explicit-any
    async onClaude(ctx: any, prompt: string, sessionId?: string): Promise<ClaudeResponse> {
      // Cancel any existing session
      const existingController = deps.getClaudeController();
      if (existingController) {
        existingController.abort();
      }
      
      const controller = new AbortController();
      deps.setClaudeController(controller);
      
      // Defer interaction (execute first)
      await ctx.deferReply();
      
      // Send initial message
      await ctx.editReply({
        embeds: [{
          color: 0xffff00,
          title: 'Claude Code Running...',
          description: 'Waiting for response...',
          fields: [{ name: 'Prompt', value: `\`${prompt.substring(0, 1020)}\``, inline: false }],
          timestamp: true
        }]
      });
      
      const result = await sendToClaudeCode(
        workDir,
        prompt,
        controller,
        sessionId,
        undefined, // onChunk callback not used
        (jsonData) => {
          // Process JSON stream data and send to Discord
          const claudeMessages = convertToClaudeMessages(jsonData);
          if (claudeMessages.length > 0) {
            sendClaudeMessages(claudeMessages).catch(() => {});
          }
        },
        false, // continueMode = false
        deps.getQueryOptions?.() // Pass runtime settings (thinking, operation, proxy)
      );
      
      deps.setClaudeSessionId(result.sessionId);
      deps.setClaudeController(null);
      
      // Completion message is already sent via SDK streaming (result type → message-converter.ts)
      
      return result;
    },
    
    // deno-lint-ignore no-explicit-any
    async onContinue(ctx: any, prompt?: string): Promise<ClaudeResponse> {
      // Cancel any existing session
      const existingController = deps.getClaudeController();
      if (existingController) {
        existingController.abort();
      }
      
      const controller = new AbortController();
      deps.setClaudeController(controller);
      
      const actualPrompt = prompt || "Please continue.";
      
      // Defer interaction
      await ctx.deferReply();
      
      // Send initial message
      const embedData: { color: number; title: string; description: string; timestamp: boolean; fields?: Array<{ name: string; value: string; inline: boolean }> } = {
        color: 0xffff00,
        title: 'Claude Code Continuing Conversation...',
        description: 'Loading latest conversation and waiting for response...',
        timestamp: true
      };
      
      if (prompt) {
        embedData.fields = [{ name: 'Prompt', value: `\`${prompt.substring(0, 1020)}\``, inline: false }];
      }
      
      await ctx.editReply({ embeds: [embedData] });
      
      const result = await sendToClaudeCode(
        workDir,
        actualPrompt,
        controller,
        undefined, // sessionId not used
        undefined, // onChunk callback not used
        (jsonData) => {
          // Process JSON stream data and send to Discord
          const claudeMessages = convertToClaudeMessages(jsonData);
          if (claudeMessages.length > 0) {
            sendClaudeMessages(claudeMessages).catch(() => {});
          }
        },
        true, // continueMode = true
        deps.getQueryOptions?.() // Pass runtime settings (thinking, operation, proxy)
      );
      
      deps.setClaudeSessionId(result.sessionId);
      deps.setClaudeController(null);
      
      // Completion message is already sent via SDK streaming (result type → message-converter.ts)
      
      return result;
    },
    
    // deno-lint-ignore no-explicit-any
    onClaudeCancel(_ctx: any): boolean {
      const currentController = deps.getClaudeController();
      if (!currentController) {
        return false;
      }
      
      console.log("Cancelling Claude Code session...");
      currentController.abort();
      deps.setClaudeController(null);
      deps.setClaudeSessionId(undefined);
      
      return true;
    }
  };
}