import { SlashCommandBuilder } from "npm:discord.js@14.14.1";

// Screenshot command - captures host machine's screen (not available in Docker)
export const screenshotCommands = [
  new SlashCommandBuilder()
    .setName('screenshot')
    .setDescription('Capture and share a screenshot of the host machine screen')
    .addStringOption(option =>
      option.setName('delay')
        .setDescription('Delay in seconds before capture (0-10)')
        .setRequired(false)
    )
];
