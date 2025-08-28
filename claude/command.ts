import type { ClaudeResponse, ClaudeMessage } from "./types.ts";
import { sendToClaudeCode } from "./client.ts";
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
    .setName('continue')
    .setDescription('Continue the previous Claude Code session')
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
  claudeController: AbortController | null;
  setClaudeController: (controller: AbortController | null) => void;
  setClaudeSessionId: (sessionId: string | undefined) => void;
  sendClaudeMessages: (messages: ClaudeMessage[]) => Promise<void>;
}

export function createClaudeHandlers(deps: ClaudeHandlerDeps) {
  const { workDir, sendClaudeMessages } = deps;
  
  return {
    // deno-lint-ignore no-explicit-any
    async onClaude(ctx: any, prompt: string, sessionId?: string): Promise<ClaudeResponse> {
      // Cancel any existing session
      if (deps.claudeController) {
        deps.claudeController.abort();
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
        false // continueMode = false
      );
      
      deps.setClaudeSessionId(result.sessionId);
      deps.setClaudeController(null);
      
      // Send completion message with interactive buttons
      if (result.sessionId) {
        await sendClaudeMessages([{
          type: 'system',
          content: '',
          metadata: {
            subtype: 'completion',
            session_id: result.sessionId,
            model: result.modelUsed || 'Default',
            total_cost_usd: result.cost,
            duration_ms: result.duration,
            cwd: workDir
          }
        }]);
      }
      
      return result;
    },
    
    // deno-lint-ignore no-explicit-any
    async onContinue(ctx: any, prompt?: string): Promise<ClaudeResponse> {
      // Cancel any existing session
      if (deps.claudeController) {
        deps.claudeController.abort();
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
        true // continueMode = true
      );
      
      deps.setClaudeSessionId(result.sessionId);
      deps.setClaudeController(null);
      
      // Send completion message with interactive buttons
      if (result.sessionId) {
        await sendClaudeMessages([{
          type: 'system',
          content: '',
          metadata: {
            subtype: 'completion',
            session_id: result.sessionId,
            model: result.modelUsed || 'Default',
            total_cost_usd: result.cost,
            duration_ms: result.duration,
            cwd: workDir
          }
        }]);
      }
      
      return result;
    },
    
    // deno-lint-ignore no-explicit-any
    onClaudeCancel(_ctx: any): boolean {
      if (!deps.claudeController) {
        return false;
      }
      
      console.log("Cancelling Claude Code session...");
      deps.claudeController.abort();
      deps.setClaudeController(null);
      deps.setClaudeSessionId(undefined);
      
      return true;
    }
  };
}