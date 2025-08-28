import { SlashCommandBuilder } from "npm:discord.js@14.14.1";

export const utilsCommands = [
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show current status'),
  
  new SlashCommandBuilder()
    .setName('pwd')
    .setDescription('Show current working directory'),
  
  new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Manage bot settings')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Action to execute')
        .setRequired(true)
        .addChoices(
          { name: 'mention-on', value: 'mention-on' },
          { name: 'mention-off', value: 'mention-off' },
          { name: 'show', value: 'show' }
        ))
    .addStringOption(option =>
      option.setName('value')
        .setDescription('Setting value (user ID for mention-on)')
        .setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('shutdown')
    .setDescription('Shutdown the bot'),
];

export { createUtilsHandlers, type UtilsHandlerDeps } from "./handler.ts";