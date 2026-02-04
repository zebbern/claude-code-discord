import { SlashCommandBuilder } from "npm:discord.js@14.14.1";

// System commands - slash command definitions only
// Handler implementations are in index.ts (cross-platform version)

export const systemCommands = [
  new SlashCommandBuilder()
    .setName('system-info')
    .setDescription('Display comprehensive system information'),
  
  new SlashCommandBuilder()
    .setName('processes')
    .setDescription('List running processes')
    .addStringOption(option =>
      option.setName('filter')
        .setDescription('Filter processes by name (optional)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Maximum number of processes to show (default: 20)')
        .setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('system-resources')
    .setDescription('Show system resource usage (CPU, Memory, Disk)'),
  
  new SlashCommandBuilder()
    .setName('network-info')
    .setDescription('Display network interfaces and connections'),
  
  new SlashCommandBuilder()
    .setName('disk-usage')
    .setDescription('Show disk space usage for all mounted drives'),
  
  new SlashCommandBuilder()
    .setName('env-vars')
    .setDescription('List environment variables')
    .addStringOption(option =>
      option.setName('filter')
        .setDescription('Filter by variable name (optional)')
        .setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('system-logs')
    .setDescription('Show recent system logs')
    .addIntegerOption(option =>
      option.setName('lines')
        .setDescription('Number of lines to show (default: 50)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('service')
        .setDescription('Specific service/application to filter')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('port-scan')
    .setDescription('Check which ports are open/listening')
    .addStringOption(option =>
      option.setName('host')
        .setDescription('Host to scan (default: localhost)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('ports')
        .setDescription('Port range (e.g. 80,443 or 8000-9000)')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('service-status')
    .setDescription('Check status of system services')
    .addStringOption(option =>
      option.setName('service')
        .setDescription('Specific service name to check')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('uptime')
    .setDescription('Show system uptime and load averages')
];