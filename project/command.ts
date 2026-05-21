import { SlashCommandBuilder } from "npm:discord.js@14.14.1";

export const projectCommands = [
  new SlashCommandBuilder()
    .setName("project")
    .setDescription("Bind this thread/channel to a project directory")
    .addStringOption((option) =>
      option
        .setName("action")
        .setDescription("Action to perform")
        .setRequired(true)
        .addChoices(
          { name: "bind", value: "bind" },
          { name: "unbind", value: "unbind" },
          { name: "show", value: "show" },
          { name: "list", value: "list" },
        )
    )
    .addStringOption((option) =>
      option
        .setName("path")
        .setDescription(
          "Absolute path to a git repository (required for bind)",
        )
        .setRequired(false)
    ),
];
