import { EmbedBuilder, Message, TextChannel, BaseGuildTextChannel } from 'discord.js';
import { logger } from './logger';

/**
 * Discord rate limit handler for message operations
 * Handles Discord API rate limits with retry logic
 */
export class DiscordRateLimitHandler {
  private retryQueue: Map<string, { message: Message; retries: number; delay: number }> = new Map();

  /**
   * Sends a message with rate limit handling
   * @param channel - Discord text channel
   * @param options - Message options
   * @returns Sent message
   */
  public async sendMessage(
    channel: TextChannel,
    options: { content?: string; embeds?: EmbedBuilder[]; files?: any[] }
  ): Promise<Message> {
    try {
      return await channel.send(options);
    } catch (error: any) {
      if (error.code === 50035 || error.status === 429) {
        // Rate limited - wait and retry once
        const retryAfter = error.retry_after || 2000;
        logger.warn('Discord rate limit hit', { retryAfter });
        await new Promise((resolve) => setTimeout(resolve, retryAfter));
        return channel.send(options);
      }
      throw error;
    }
  }

  /**
   * Replies to a message with rate limit handling
   * @param message - Original message
   * @param options - Reply options
   * @returns Sent message
   */
  public async replyMessage(
    message: Message,
    options: { content?: string; embeds?: EmbedBuilder[]; files?: any[] }
  ): Promise<Message> {
    try {
      return await message.reply(options);
    } catch (error: any) {
      if (error.code === 50035 || error.status === 429) {
        // Rate limited - wait and retry once
        const retryAfter = error.retry_after || 2000;
        logger.warn('Discord rate limit hit', { retryAfter });
        await new Promise((resolve) => setTimeout(resolve, retryAfter));
        return message.reply(options);
      }
      throw error;
    }
  }

  /**
   * Sends typing indicator with rate limit handling
   * @param channel - Discord text channel
   */
  public async sendTyping(channel: TextChannel | BaseGuildTextChannel): Promise<void> {
    try {
      await channel.sendTyping();
    } catch (error: any) {
      // Ignore rate limit errors for typing indicators
      if (error.code !== 50035 && error.status !== 429) {
        logger.error('Error sending typing indicator', error as Error);
      }
    }
  }
}

