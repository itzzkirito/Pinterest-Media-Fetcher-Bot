import { Message, EmbedBuilder } from 'discord.js';
import { MediaFetcherService } from '../services/media-fetcher.service';
import { DiscordRateLimitHandler } from '../utils/discord-rate-limit';

/**
 * Base command interface that all commands must implement
 */
export interface CommandMetadata {
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  category?: string;
}

/**
 * Base command class for all bot commands
 * Provides common functionality and structure
 */
export abstract class BaseCommand {
  protected mediaFetcherService: MediaFetcherService;
  protected discordRateLimitHandler: DiscordRateLimitHandler;
  protected prefix: string;

  /**
   * Command metadata
   */
  public abstract readonly metadata: CommandMetadata;

  constructor(
    mediaFetcherService: MediaFetcherService,
    discordRateLimitHandler: DiscordRateLimitHandler,
    prefix: string
  ) {
    this.mediaFetcherService = mediaFetcherService;
    this.discordRateLimitHandler = discordRateLimitHandler;
    this.prefix = prefix;
  }

  /**
   * Executes the command
   * @param message - Discord message object
   * @param args - Command arguments
   */
  public abstract execute(message: Message, args: string[]): Promise<void>;

  /**
   * Creates an error embed
   */
  protected createErrorEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp();
  }

  /**
   * Creates a success embed
   */
  protected createSuccessEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp();
  }

  /**
   * Creates an info embed
   */
  protected createInfoEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp();
  }
}

