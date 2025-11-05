import { Message, EmbedBuilder } from 'discord.js';
import { BaseCommand, CommandMetadata } from './base.command';
import { CommandManager } from '../managers/command.manager';

/**
 * Command for displaying help information
 */
export class HelpCommand extends BaseCommand {
  private commandManager: CommandManager;

  public readonly metadata: CommandMetadata = {
    name: 'help',
    aliases: ['h', 'commands'],
    description: 'Shows available commands and their usage',
    usage: 'help [command]',
    category: 'utility',
  };

  constructor(
    mediaFetcherService: any,
    discordRateLimitHandler: any,
    prefix: string,
    commandManager: CommandManager
  ) {
    super(mediaFetcherService, discordRateLimitHandler, prefix);
    this.commandManager = commandManager;
  }

  public async execute(message: Message, args: string[]): Promise<void> {
    const commandName = args[0]?.toLowerCase();

    // If specific command requested, show detailed help
    if (commandName) {
      const command = this.commandManager.getCommand(commandName);
      if (command) {
        const embed = this.createCommandHelpEmbed(command);
        await this.discordRateLimitHandler.replyMessage(message, { embeds: [embed] });
        return;
      }
    }

    // Show general help with all commands
    const embed = this.createGeneralHelpEmbed();
    await this.discordRateLimitHandler.replyMessage(message, { embeds: [embed] });
  }

  private createGeneralHelpEmbed(): EmbedBuilder {
    const commands = this.commandManager.getAllCommands();
    const categories = this.groupCommandsByCategory(commands);

    const embed = new EmbedBuilder()
      .setColor(0xBD081C)
      .setTitle('📖 Command Help')
      .setDescription('Available commands for the Pinterest Media Fetcher Bot')
      .setTimestamp()
      .setFooter({ text: 'Pinterest Media Fetcher Bot' });

    for (const [category, categoryCommands] of Object.entries(categories)) {
      const fields = categoryCommands.map((cmd) => ({
        name: `\`${this.prefix}${cmd.metadata.name}\``,
        value: cmd.metadata.description,
        inline: true,
      }));

      embed.addFields({
        name: `**${category}**`,
        value: `\`${this.prefix}help <command>\` for more details`,
        inline: false,
      });

      // Add command fields in chunks of 3 (Discord limit)
      for (let i = 0; i < fields.length; i += 3) {
        embed.addFields(fields.slice(i, i + 3));
      }
    }

    return embed;
  }

  private createCommandHelpEmbed(command: BaseCommand): EmbedBuilder {
    const metadata = command.metadata;
    const aliases = metadata.aliases?.length
      ? `\n**Aliases:** ${metadata.aliases.map((a) => `\`${a}\``).join(', ')}`
      : '';

    return new EmbedBuilder()
      .setColor(0xBD081C)
      .setTitle(`📖 ${metadata.name.toUpperCase()} Command`)
      .setDescription(metadata.description)
      .addFields(
        {
          name: 'Usage',
          value: `\`${this.prefix}${metadata.usage}\``,
          inline: false,
        },
        {
          name: 'Category',
          value: metadata.category || 'General',
          inline: true,
        }
      )
      .setFooter({ text: `Use ${this.prefix}help to see all commands` })
      .setTimestamp();
  }

  private groupCommandsByCategory(
    commands: BaseCommand[]
  ): Record<string, BaseCommand[]> {
    const grouped: Record<string, BaseCommand[]> = {};

    for (const command of commands) {
      const category = command.metadata.category || 'General';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(command);
    }

    return grouped;
  }
}

