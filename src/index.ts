import { Client, GatewayIntentBits } from 'discord.js';
import { PinterestService } from './services/pinterest.service';
import { MediaFetcherService } from './services/media-fetcher.service';
import { CommandHandler } from './handlers/command.handler';
import { EventHandler } from './handlers/event.handler';
import { prisma, disconnectPrisma } from './utils/database';
import { RateLimitHandler } from './utils/rate-limit.handler';
import { appConfig } from './utils/config';
import { logger } from './utils/logger';
import { CommandManager } from './managers/command.manager';
import { DiscordRateLimitHandler } from './utils/discord-rate-limit';
import { PfpCommand } from './commands/pfp.command';
import { BannerCommand } from './commands/banner.command';
import { GifCommand } from './commands/gif.command';
import { PinCommand } from './commands/pin.command';
import { HelpCommand } from './commands/help.command';

/**
 * Main entry point for the Pinterest Discord Bot
 * Initializes services and starts the Discord bot
 */
class Bot {
  private client: Client;
  private pinterestService: PinterestService;
  private mediaFetcherService: MediaFetcherService;
  private rateLimitHandler: RateLimitHandler;
  private commandHandler: CommandHandler;
  private eventHandler: EventHandler;

  constructor() {
    // Initialize Discord client with required intents
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    // Initialize rate limit handler
    const config = appConfig.getValues();
    this.rateLimitHandler = new RateLimitHandler(prisma, {
      maxRequests: config.rateLimitMaxRequests,
      windowMs: config.rateLimitWindowMs,
      queueConcurrency: config.rateLimitConcurrency,
    });

    // Initialize services
    this.pinterestService = new PinterestService(prisma);
    this.mediaFetcherService = new MediaFetcherService(this.pinterestService);

    // Initialize command manager and register commands
    const commandManager = new CommandManager(config.prefix);
    const discordRateLimitHandler = new DiscordRateLimitHandler();

    // Register all commands
    commandManager.registerCommands([
      new PfpCommand(this.mediaFetcherService, discordRateLimitHandler, config.prefix),
      new BannerCommand(this.mediaFetcherService, discordRateLimitHandler, config.prefix),
      new GifCommand(this.mediaFetcherService, discordRateLimitHandler, config.prefix),
      new PinCommand(this.mediaFetcherService, discordRateLimitHandler, config.prefix),
      new HelpCommand(this.mediaFetcherService, discordRateLimitHandler, config.prefix, commandManager),
    ]);

    logger.info('Commands registered', {
      count: commandManager.getAllCommands().length,
    });

    // Initialize command handler
    this.commandHandler = new CommandHandler(commandManager, this.rateLimitHandler);
    this.eventHandler = new EventHandler(this.client, this.commandHandler);

    // Setup cleanup interval for expired rate limits
    setInterval(() => {
      this.rateLimitHandler.cleanupExpiredRecords().catch((error) => {
        logger.error('Error during rate limit cleanup', error as Error);
      });
    }, 60000); // Clean up every minute

    // Graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  /**
   * Gracefully shuts down the bot
   */
  private async shutdown(): Promise<void> {
    logger.info('Shutting down bot...');
    try {
      this.client.destroy();
      await disconnectPrisma();
      logger.info('Bot shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error as Error);
      process.exit(1);
    }
  }

  /**
   * Starts the bot and sets up event listeners
   */
  public async start(): Promise<void> {
    try {
      const config = appConfig.getValues();
      
      // Test database connection
      await prisma.$connect();
      logger.info('Connected to database');

      // Register event handlers
      this.eventHandler.registerEvents();

      // Login to Discord
      await this.client.login(config.discordToken);
      logger.info('Bot is ready and connected to Discord', {
        botTag: this.client.user?.tag,
        guildCount: this.client.guilds.cache.size,
      });
    } catch (error) {
      logger.error('Failed to start bot', error as Error);
      try {
        await disconnectPrisma();
      } catch (disconnectError) {
        logger.error('Error disconnecting from database', disconnectError as Error);
      }
      process.exit(1);
    }
  }
}

// Start the bot with proper error handling
const bot = new Bot();
bot.start().catch((error) => {
  logger.error('Unhandled error during bot startup', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', reason as Error, { promise });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  process.exit(1);
});

