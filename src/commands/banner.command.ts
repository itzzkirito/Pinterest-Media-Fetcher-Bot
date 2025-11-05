import { Message } from 'discord.js';
import { BaseCommand, CommandMetadata } from './base.command';
import { MediaType } from '../services/pinterest.service';

/**
 * Command for fetching banners from Pinterest
 */
export class BannerCommand extends BaseCommand {
  public readonly metadata: CommandMetadata = {
    name: 'banner',
    aliases: ['header', 'cover'],
    description: 'Fetches banners/headers from Pinterest',
    usage: 'banner <query> [count]',
    category: 'media',
  };

  public async execute(message: Message, args: string[]): Promise<void> {
    const query = args.join(' ') || 'banner';
    const count = this.parseCount(args);

    await this.discordRateLimitHandler.sendTyping(message.channel);

    const { attachments, embeds } = await this.mediaFetcherService.fetchAndPrepareMedia(
      query,
      MediaType.BANNER,
      count
    );

    await this.discordRateLimitHandler.replyMessage(message, {
      files: attachments,
      embeds: embeds,
    });
  }

  private parseCount(args: string[]): number {
    const countArg = args.find((arg) => /^\d+$/.test(arg));
    if (countArg) {
      const count = parseInt(countArg, 10);
      return Math.min(Math.max(count, 1), 5);
    }
    return 1;
  }
}

