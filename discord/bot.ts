import { 
  Client, 
  GatewayIntentBits, 
  Events, 
  ChannelType, 
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  REST,
  Routes,
  CommandInteraction,
  ButtonInteraction,
  TextChannel,
  EmbedBuilder
} from "npm:discord.js@14.14.1";

import { sanitizeChannelName } from "./utils.ts";
import { handlePaginationInteraction } from "./pagination.ts";
import type { 
  BotConfig, 
  CommandHandlers, 
  ButtonHandlers,
  MessageContent, 
  InteractionContext,
  BotDependencies
} from "./types.ts";


// ================================
// Helper Functions
// ================================

// deno-lint-ignore no-explicit-any
function convertMessageContent(content: MessageContent): any {
  // deno-lint-ignore no-explicit-any
  const payload: any = {};
  
  if (content.content) payload.content = content.content;
  
  if (content.embeds) {
    payload.embeds = content.embeds.map(e => {
      const embed = new EmbedBuilder();
      if (e.color !== undefined) embed.setColor(e.color);
      if (e.title) embed.setTitle(e.title);
      if (e.description) embed.setDescription(e.description);
      if (e.fields) e.fields.forEach(f => embed.addFields(f));
      if (e.footer) embed.setFooter(e.footer);
      if (e.timestamp) embed.setTimestamp();
      return embed;
    });
  }
  
  if (content.components) {
    payload.components = content.components.map(row => {
      const actionRow = new ActionRowBuilder<ButtonBuilder>();
      row.components.forEach(comp => {
        const button = new ButtonBuilder()
          .setCustomId(comp.customId)
          .setLabel(comp.label);
        
        switch (comp.style) {
          case 'primary': button.setStyle(ButtonStyle.Primary); break;
          case 'secondary': button.setStyle(ButtonStyle.Secondary); break;
          case 'success': button.setStyle(ButtonStyle.Success); break;
          case 'danger': button.setStyle(ButtonStyle.Danger); break;
          case 'link': button.setStyle(ButtonStyle.Link); break;
        }
        
        actionRow.addComponents(button);
      });
      return actionRow;
    });
  }
  
  // Handle file attachments
  if (content.files && content.files.length > 0) {
    payload.files = content.files.map(f => ({
      attachment: f.path,
      name: f.name || 'attachment',
      description: f.description,
    }));
  }
  
  return payload;
}

// ================================
// Main Bot Creation Function
// ================================

export async function createDiscordBot(
  config: BotConfig, 
  handlers: CommandHandlers,
  buttonHandlers: ButtonHandlers,
  dependencies: BotDependencies,
  crashHandler?: any
) {
  const { discordToken, applicationId, workDir, repoName, branchName, categoryName } = config;
  const actualCategoryName = categoryName || repoName;
  
  let myChannel: TextChannel | null = null;
  // deno-lint-ignore no-explicit-any no-unused-vars
  let myCategory: any = null;
  
  const botSettings = dependencies.botSettings || {
    mentionEnabled: !!config.defaultMentionUserId,
    mentionUserId: config.defaultMentionUserId || null,
  };
  
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });
  
  // Use commands from dependencies
  const commands = dependencies.commands;
  
  // Channel management
  // deno-lint-ignore no-explicit-any
  async function ensureChannelExists(guild: any): Promise<TextChannel> {
    const channelName = sanitizeChannelName(branchName);
    
    console.log(`Checking category "${actualCategoryName}"...`);
    
    let category = guild.channels.cache.find(
      // deno-lint-ignore no-explicit-any
      (c: any) => c.type === ChannelType.GuildCategory && c.name === actualCategoryName
    );
    
    if (!category) {
      console.log(`Creating category "${actualCategoryName}"...`);
      try {
        category = await guild.channels.create({
          name: actualCategoryName,
          type: ChannelType.GuildCategory,
        });
        console.log(`Created category "${actualCategoryName}"`);
      } catch (error) {
        console.error(`Category creation error: ${error}`);
        throw new Error(`Cannot create category. Please ensure the bot has "Manage Channels" permission.`);
      }
    }
    
    myCategory = category;
    
    let channel = guild.channels.cache.find(
      // deno-lint-ignore no-explicit-any
      (c: any) => c.type === ChannelType.GuildText && c.name === channelName && c.parentId === category.id
    );
    
    if (!channel) {
      console.log(`Creating channel "${channelName}"...`);
      try {
        channel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: category.id,
          topic: `Repository: ${repoName} | Branch: ${branchName} | Machine: ${Deno.hostname()} | Path: ${workDir}`,
        });
        console.log(`Created channel "${channelName}"`);
      } catch (error) {
        console.error(`Channel creation error: ${error}`);
        throw new Error(`Cannot create channel. Please ensure the bot has "Manage Channels" permission.`);
      }
    }
    
    return channel as TextChannel;
  }
  
  // Create interaction context wrapper
  function createInteractionContext(interaction: CommandInteraction | ButtonInteraction): InteractionContext {
    return {
      async deferReply(): Promise<void> {
        await interaction.deferReply();
      },
      
      async editReply(content: MessageContent): Promise<void> {
        await interaction.editReply(convertMessageContent(content));
      },
      
      async followUp(content: MessageContent & { ephemeral?: boolean }): Promise<void> {
        const payload = convertMessageContent(content);
        payload.ephemeral = content.ephemeral || false;
        await interaction.followUp(payload);
      },
      
      async reply(content: MessageContent & { ephemeral?: boolean }): Promise<void> {
        const payload = convertMessageContent(content);
        payload.ephemeral = content.ephemeral || false;
        await interaction.reply(payload);
      },
      
      async update(content: MessageContent): Promise<void> {
        if ('update' in interaction) {
          await (interaction as ButtonInteraction).update(convertMessageContent(content));
        }
      },
      
      getString(name: string, required?: boolean): string | null {
        if (interaction.isCommand && interaction.isCommand()) {
          // deno-lint-ignore no-explicit-any
          return (interaction as any).options.getString(name, required ?? false);
        }
        return null;
      },
      
      getInteger(name: string, required?: boolean): number | null {
        if (interaction.isCommand && interaction.isCommand()) {
          // deno-lint-ignore no-explicit-any
          return (interaction as any).options.getInteger(name, required ?? false);
        }
        return null;
      },
      
      getBoolean(name: string, required?: boolean): boolean | null {
        if (interaction.isCommand && interaction.isCommand()) {
          // deno-lint-ignore no-explicit-any
          return (interaction as any).options.getBoolean(name, required ?? false);
        }
        return null;
      }
    };
  }
  
  // Command handler - completely generic
  async function handleCommand(interaction: CommandInteraction) {
    if (!myChannel || interaction.channelId !== myChannel.id) {
      return;
    }
    
    const ctx = createInteractionContext(interaction);
    const handler = handlers.get(interaction.commandName);
    
    if (!handler) {
      await ctx.reply({
        content: `Unknown command: ${interaction.commandName}`,
        ephemeral: true
      });
      return;
    }
    
    try {
      await handler.execute(ctx);
    } catch (error) {
      console.error(`Error executing command ${interaction.commandName}:`, error);
      // Try to send error message if possible
      try {
        if (interaction.deferred) {
          await ctx.editReply({
            content: `Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        } else {
          await ctx.reply({
            content: `Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`,
            ephemeral: true
          });
        }
      } catch {
        // Ignore errors when sending error message
      }
    }
  }
  
  // Button handler - completely generic
  async function handleButton(interaction: ButtonInteraction) {
    if (!myChannel || interaction.channelId !== myChannel.id) {
      return;
    }
    
    const ctx = createInteractionContext(interaction);
    
    // Handle pagination buttons first
    if (interaction.customId.startsWith('pagination:')) {
      try {
        const paginationResult = handlePaginationInteraction(interaction.customId);
        if (paginationResult) {
          await ctx.update({
            embeds: [paginationResult.embed],
            components: paginationResult.components ? [{ type: 'actionRow', components: paginationResult.components }] : []
          });
          return;
        }
      } catch (error) {
        console.error('Error handling pagination:', error);
        if (crashHandler) {
          await crashHandler.reportCrash('main', error instanceof Error ? error : new Error(String(error)), 'pagination', 'Button interaction');
        }
      }
    }
    
    const handler = buttonHandlers.get(interaction.customId);
    
    if (handler) {
      try {
        await handler(ctx);
      } catch (error) {
        console.error(`Error handling button ${interaction.customId}:`, error);
        if (crashHandler) {
          await crashHandler.reportCrash('main', error instanceof Error ? error : new Error(String(error)), 'button', `ID: ${interaction.customId}`);
        }
        try {
          await ctx.followUp({
            content: `Error handling button: ${error instanceof Error ? error.message : 'Unknown error'}`,
            ephemeral: true
          });
        } catch {
          // Ignore errors when sending error message
        }
      }
      return;
    }
    
    // Handle dynamic button IDs with patterns
    const buttonId = interaction.customId;
    
    // Handle continue with session ID pattern: "continue:sessionId"
    if (buttonId.startsWith('continue:')) {
      const sessionId = buttonId.split(':')[1];
      const continueHandler = buttonHandlers.get('continue');
      if (continueHandler) {
        try {
          await continueHandler(ctx);
        } catch (error) {
          console.error(`Error handling continue button:`, error);
        }
      }
      return;
    }
    
    // Handle copy session ID pattern: "copy-session:sessionId"
    if (buttonId.startsWith('copy-session:')) {
      const sessionId = buttonId.split(':')[1];
      try {
        await ctx.update({
          embeds: [{
            color: 0x00ff00,
            title: '📋 Session ID',
            description: `\`${sessionId}\``,
            fields: [
              { name: 'Usage', value: 'Copy this ID to use with `/claude session_id:...`', inline: false }
            ],
            timestamp: true
          }]
        });
      } catch (error) {
        console.error(`Error handling copy-session button:`, error);
      }
      return;
    }
    
    // Handle expand content pattern: "expand:contentId" 
    if (buttonId.startsWith('expand:')) {
      const expandId = buttonId.substring(7);
      
      // Try to find a handler that can process expand buttons
      for (const [handlerName, handler] of handlers.entries()) {
        if (handler.handleButton) {
          try {
            await handler.handleButton(ctx, buttonId);
            return;
          } catch (error) {
            console.error(`Error in ${handlerName} handleButton for expand:`, error);
          }
        }
      }
      
      // If no handler found, show default message
      try {
        await ctx.update({
          embeds: [{
            color: 0xffaa00,
            title: '📖 Content Not Available',
            description: 'The full content is no longer available for expansion.',
            timestamp: true
          }],
          components: []
        });
      } catch (error) {
        console.error(`Error handling expand button fallback:`, error);
      }
      return;
    }
    
    // If no specific handler found, try to delegate to command handlers with handleButton method
    const commandHandler = Array.from(handlers.values()).find(h => h.handleButton);
    if (commandHandler?.handleButton) {
      try {
        await commandHandler.handleButton(ctx, interaction.customId);
      } catch (error) {
        console.error(`Error handling button ${interaction.customId} via command handler:`, error);
        try {
          await ctx.followUp({
            content: `Error handling button: ${error instanceof Error ? error.message : 'Unknown error'}`,
            ephemeral: true
          });
        } catch {
          // Ignore errors when sending error message
        }
      }
    } else {
      console.warn(`No handler found for button: ${interaction.customId}`);
    }
  }
  
  // Register commands
  const rest = new REST({ version: '10' }).setToken(discordToken);
  
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(applicationId),
      { body: commands.map(cmd => cmd.toJSON()) },
    );
    console.log('Slash commands registered');
  } catch (error) {
    console.error('Failed to register slash commands:', error);
    throw error;
  }
  
  // Event handlers
  client.once(Events.ClientReady, async () => {
    console.log(`Bot logged in: ${client.user?.tag}`);
    console.log(`Category: ${actualCategoryName}`);
    console.log(`Branch: ${branchName}`);
    console.log(`Working directory: ${workDir}`);
    
    const guilds = client.guilds.cache;
    if (guilds.size === 0) {
      console.error('Error: Bot is not in any servers');
      return;
    }
    
    const guild = guilds.first();
    if (!guild) {
      console.error('Error: Guild not found');
      return;
    }
    
    try {
      myChannel = await ensureChannelExists(guild);
      console.log(`Using channel "${myChannel.name}"`);
      
      await myChannel.send(convertMessageContent({
        embeds: [{
          color: 0x00ff00,
          title: '🚀 Startup Complete',
          description: `Claude Code bot for branch ${branchName} has started`,
          fields: [
            { name: 'Category', value: actualCategoryName, inline: true },
            { name: 'Repository', value: repoName, inline: true },
            { name: 'Branch', value: branchName, inline: true },
            { name: 'Working Directory', value: `\`${workDir}\``, inline: false }
          ],
          timestamp: true
        }]
      }));
    } catch (error) {
      console.error('Channel creation/retrieval error:', error);
    }
  });
  
  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isCommand()) {
      await handleCommand(interaction as CommandInteraction);
    } else if (interaction.isButton()) {
      await handleButton(interaction as ButtonInteraction);
    }
  });
  
  // Login
  await client.login(discordToken);
  
  // Return bot control functions
  return {
    client,
    getChannel() {
      return myChannel;
    },
    updateBotSettings(settings: { mentionEnabled: boolean; mentionUserId: string | null }) {
      botSettings.mentionEnabled = settings.mentionEnabled;
      botSettings.mentionUserId = settings.mentionUserId;
    },
    getBotSettings() {
      return { ...botSettings };
    }
  };
}