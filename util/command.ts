import { SlashCommandBuilder } from "npm:discord.js@14.14.1";

export const utilsCommands = [
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show current status'),
  
  new SlashCommandBuilder()
    .setName('pwd')
    .setDescription('Show current working directory'),
  
  // NOTE: 'settings' command moved to unified-settings.ts
  // Old settings functionality is now part of the unified settings system
  
  new SlashCommandBuilder()
    .setName('shutdown')
    .setDescription('Shutdown the bot'),
];

export { createUtilsHandlers, type UtilsHandlerDeps } from "./handler.ts";