import { Message, EmbedBuilder } from 'discord.js';
import { RateLimitHandler, RateLimitError } from '../utils/rate-limit.handler';
import { DiscordRateLimitHandler } from '../utils/discord-rate-limit';
import { ValidationError, MediaDownloadError, PinterestAPIError } from '../utils/errors';
import { logger } from '../utils/logger';
import { appConfig } from '../utils/config';
import { CommandManager } from '../managers/command.manager';

/**
 * Command handler for processing Discord bot commands
 * Handles command parsing, validation, and execution
 */
export class CommandHandler {
  private commandManager: CommandManager;
  private rateLimitHandler: RateLimitHandler;
  private discordRateLimitHandler: DiscordRateLimitHandler;
  private prefix: string;

  constructor(
    commandManager: CommandManager,
    rateLimitHandler: RateLimitHandler
  ) {
    this.commandManager = commandManager;
    this.rateLimitHandler = rateLimitHandler;
    this.discordRateLimitHandler = new DiscordRateLimitHandler();
    this.prefix = appConfig.getValues().prefix;
  }

  /**
   * Processes a Discord message and executes commands
   * @param message - Discord message object
   */
  public async handleCommand(message: Message): Promise<void> {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Check if message starts with prefix
    if (!message.content.startsWith(this.prefix)) return;

    // Parse command and arguments
    const args = message.content.slice(this.prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    const userId = message.author.id;

    try {
      // Execute command using command manager
      const result = await this.commandManager.executeCommand(
        message,
        commandName,
        args,
        this.rateLimitHandler
      );

      if (!result.success && result.error) {
        // Command not found or execution failed
        if (!this.commandManager.hasCommand(commandName)) {
          await this.discordRateLimitHandler.replyMessage(message, {
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Unknown Command')
                .setDescription(
                  `Unknown command: \`${commandName}\`. Use \`${this.prefix}help\` to see available commands.`
                ),
            ],
          });
        }
      }
    } catch (error) {
      if (error instanceof RateLimitError) {
        const remaining = await this.rateLimitHandler.getRemainingRequests(userId);
        const resetTime = new Date(error.resetAt);
        const timeUntilReset = Math.ceil((resetTime.getTime() - Date.now()) / 1000);

        await this.discordRateLimitHandler.replyMessage(message, {
          embeds: [
            new EmbedBuilder()
              .setColor(0xFFAA00)
              .setTitle('⏳ Rate Limit Exceeded')
              .setDescription(
                `You've used too many commands. Please try again in ${timeUntilReset} seconds.\n` +
                `Remaining requests: ${remaining.remaining}/${remaining.remaining + 1}`
              )
              .setFooter({ text: `Resets at ${resetTime.toLocaleTimeString()}` }),
          ],
        });
      } else {
        // Handle specific error types with appropriate messages
        let errorMessage = 'An unexpected error occurred';
        let errorTitle = '❌ Error';

        if (error instanceof ValidationError) {
          errorTitle = '❌ Invalid Input';
          errorMessage = error.message;
        } else if (error instanceof MediaDownloadError) {
          errorTitle = '❌ Download Failed';
          errorMessage = 'Failed to download media. Please try again.';
        } else if (error instanceof PinterestAPIError) {
          errorTitle = '❌ API Error';
          errorMessage = 'Pinterest API is currently unavailable. Please try again later.';
        }

        logger.error('Error handling command', error as Error, {
          userId,
          guildId,
          commandName,
        });

        await this.discordRateLimitHandler.replyMessage(message, {
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setTitle(errorTitle)
              .setDescription(errorMessage),
          ],
        });

        // Log failed command
        await this.rateLimitHandler.logCommandUsage(
          userId,
          guildId,
          commandName,
          args.join(' ') || undefined,
          this.getMediaTypeFromCommand(commandName),
          false,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }
  }

}

