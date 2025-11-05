import { Message } from 'discord.js';
import { BaseCommand, CommandMetadata } from './base.command';
import { MediaType } from '../services/pinterest.service';

/**
 * Command for fetching GIFs from Pinterest
 */
export class GifCommand extends BaseCommand {
  public readonly metadata: CommandMetadata = {
    name: 'gif',
    aliases: ['animated', 'video'],
    description: 'Fetches GIFs from Pinterest',
    usage: 'gif <query> [count]',
    category: 'media',
  };

  public async execute(message: Message, args: string[]): Promise<void> {
    const query = args.join(' ') || 'gif';
    const count = this.parseCount(args);

    await this.discordRateLimitHandler.sendTyping(message.channel);

    const { attachments, embeds } = await this.mediaFetcherService.fetchAndPrepareMedia(
      query,
      MediaType.GIF,
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

