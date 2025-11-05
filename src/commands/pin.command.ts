import { Message, EmbedBuilder } from 'discord.js';
import { BaseCommand, CommandMetadata } from './base.command';

/**
 * Command for fetching a specific pin by ID
 */
export class PinCommand extends BaseCommand {
  public readonly metadata: CommandMetadata = {
    name: 'pin',
    aliases: ['pinid'],
    description: 'Fetches a specific pin by ID from Pinterest',
    usage: 'pin <pin_id>',
    category: 'media',
  };

  public async execute(message: Message, args: string[]): Promise<void> {
    const pinId = args[0];

    if (!pinId) {
      await this.discordRateLimitHandler.replyMessage(message, {
        embeds: [
          this.createErrorEmbed(
            '❌ Missing Pin ID',
            `Usage: \`${this.prefix}${this.metadata.usage}\``
          ),
        ],
      });
      return;
    }

    await this.discordRateLimitHandler.sendTyping(message.channel);

    const { attachments, embeds } = await this.mediaFetcherService.fetchPinById(pinId);

    await this.discordRateLimitHandler.replyMessage(message, {
      files: attachments,
      embeds: embeds,
    });
  }
}

