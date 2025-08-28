import { SlashCommandBuilder } from "npm:discord.js@14.14.1";
import type { ShellManager } from "./handler.ts";

export const shellCommands = [
  new SlashCommandBuilder()
    .setName('shell')
    .setDescription('Execute shell command (supports interactive commands)')
    .addStringOption(option =>
      option.setName('command')
        .setDescription('Command to execute')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('input')
        .setDescription('Initial standard input (optional)')
        .setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('shell-input')
    .setDescription('Send standard input to running shell process')
    .addIntegerOption(option =>
      option.setName('id')
        .setDescription('Process ID')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('text')
        .setDescription('Text to send')
        .setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('shell-list')
    .setDescription('List running shell commands'),
  
  new SlashCommandBuilder()
    .setName('shell-kill')
    .setDescription('Stop running shell command')
    .addIntegerOption(option =>
      option.setName('id')
        .setDescription('ID of process to stop')
        .setRequired(true)),
];

export interface ShellHandlerDeps {
  shellManager: ShellManager;
}

export function createShellHandlers(deps: ShellHandlerDeps) {
  const { shellManager } = deps;
  
  return {
    // deno-lint-ignore no-explicit-any
    async onShell(ctx: any, command: string, input?: string) {
      const result = await shellManager.execute(command, input, ctx);
      return result;
    },
    
    // deno-lint-ignore no-explicit-any
    async onShellInput(_ctx: any, processId: number, text: string) {
      return await shellManager.sendInput(processId, text);
    },
    
    // deno-lint-ignore no-explicit-any
    onShellList(_ctx: any) {
      return shellManager.getRunningProcesses();
    },
    
    // deno-lint-ignore no-explicit-any
    async onShellKill(_ctx: any, processId: number) {
      return await shellManager.killProcess(processId);
    },
    
    killAllProcesses() {
      shellManager.killAllProcesses();
    },

    getNewOutput(processId: number): string {
      return shellManager.getNewOutput(processId);
    }
  };
}