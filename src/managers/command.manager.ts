import { Message } from 'discord.js';
import { BaseCommand } from '../commands/base.command';
import { RateLimitHandler, RateLimitError } from '../utils/rate-limit.handler';
import { DiscordRateLimitHandler } from '../utils/discord-rate-limit';
import { ValidationError, MediaDownloadError, PinterestAPIError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Command Manager
 * Manages command registration, discovery, and execution
 */
export class CommandManager {
  private commands: Map<string, BaseCommand> = new Map();
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  /**
   * Registers a command
   * @param command - Command instance to register
   */
  public registerCommand(command: BaseCommand): void {
    const metadata = command.metadata;
    this.commands.set(metadata.name.toLowerCase(), command);

    // Register aliases
    if (metadata.aliases) {
      for (const alias of metadata.aliases) {
        this.commands.set(alias.toLowerCase(), command);
      }
    }

    logger.debug('Command registered', {
      name: metadata.name,
      aliases: metadata.aliases,
      category: metadata.category,
    });
  }

  /**
   * Registers multiple commands
   * @param commands - Array of command instances
   */
  public registerCommands(commands: BaseCommand[]): void {
    for (const command of commands) {
      this.registerCommand(command);
    }
  }

  /**
   * Gets a command by name or alias
   * @param name - Command name or alias
   * @returns Command instance or undefined
   */
  public getCommand(name: string): BaseCommand | undefined {
    return this.commands.get(name.toLowerCase());
  }

  /**
   * Gets all registered commands
   * @returns Array of unique command instances
   */
  public getAllCommands(): BaseCommand[] {
    const uniqueCommands = new Set<BaseCommand>();
    for (const command of this.commands.values()) {
      uniqueCommands.add(command);
    }
    return Array.from(uniqueCommands);
  }

  /**
   * Checks if a command exists
   * @param name - Command name or alias
   * @returns True if command exists
   */
  public hasCommand(name: string): boolean {
    return this.commands.has(name.toLowerCase());
  }

  /**
   * Executes a command
   * @param message - Discord message
   * @param commandName - Name of the command to execute
   * @param args - Command arguments
   * @param rateLimitHandler - Rate limit handler
   */
  public async executeCommand(
    message: Message,
    commandName: string,
    args: string[],
    rateLimitHandler: RateLimitHandler
  ): Promise<{ success: boolean; error?: string }> {
    const command = this.getCommand(commandName);

    if (!command) {
      return {
        success: false,
        error: `Unknown command: ${commandName}`,
      };
    }

    const userId = message.author.id;
    const guildId = message.guildId;

    try {
      // Execute command with rate limiting
      await rateLimitHandler.executeWithRateLimit(userId, async () => {
        await command.execute(message, args);
      });

      // Log successful command
      await rateLimitHandler.logCommandUsage(
        userId,
        guildId,
        command.metadata.name,
        args.join(' ') || undefined,
        this.getMediaTypeFromCommand(command.metadata.name),
        true
      );

      return { success: true };
    } catch (error) {
      let errorMessage: string | undefined;

      if (error instanceof RateLimitError) {
        errorMessage = 'Rate limit exceeded';
        throw error; // Re-throw to be handled by caller
      } else {
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
      }

      // Log failed command
      await rateLimitHandler.logCommandUsage(
        userId,
        guildId,
        command.metadata.name,
        args.join(' ') || undefined,
        this.getMediaTypeFromCommand(command.metadata.name),
        false,
        errorMessage
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Gets media type from command name
   */
  private getMediaTypeFromCommand(commandName: string): string | undefined {
    const mediaTypeMap: Record<string, string> = {
      pfp: 'pfp',
      avatar: 'pfp',
      profile: 'pfp',
      banner: 'banner',
      header: 'banner',
      cover: 'banner',
      gif: 'gif',
      animated: 'gif',
      video: 'gif',
      pin: 'pin',
      pinid: 'pin',
    };
    return mediaTypeMap[commandName.toLowerCase()];
  }
}

