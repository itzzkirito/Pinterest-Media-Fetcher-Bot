import { Client, Events, Message } from 'discord.js';
import { CommandHandler } from './command.handler';
import { logger } from '../utils/logger';

/**
 * Event handler for Discord bot events
 * Manages event registration and lifecycle
 */
export class EventHandler {
  private client: Client;
  private commandHandler: CommandHandler;

  constructor(client: Client, commandHandler: CommandHandler) {
    this.client = client;
    this.commandHandler = commandHandler;
  }

  /**
   * Registers all event listeners for the Discord bot
   */
  public registerEvents(): void {
    // Ready event - fires when bot is ready
    this.client.once(Events.ClientReady, (readyClient) => {
      logger.info('Bot is ready', {
        botTag: readyClient.user.tag,
        guildCount: readyClient.guilds.cache.size,
      });
      this.setBotPresence(readyClient);
    });

    // Message create event - handles incoming messages
    this.client.on(Events.MessageCreate, async (message: Message) => {
      await this.handleMessage(message);
    });

    // Error handling
    this.client.on(Events.Error, (error) => {
      logger.error('Discord client error', error);
    });

    this.client.on(Events.Warn, (warning) => {
      logger.warn('Discord client warning', { warning });
    });

    // WebSocket error handling
    this.client.on(Events.ShardError, (error) => {
      logger.error('Discord shard error', error);
    });
  }

  /**
   * Handles incoming messages
   * @param message - Discord message object
   */
  private async handleMessage(message: Message): Promise<void> {
    try {
      // Process command if applicable
      await this.commandHandler.handleCommand(message);
    } catch (error) {
      logger.error('Error handling message', error as Error, {
        messageId: message.id,
        userId: message.author.id,
      });
    }
  }

  /**
   * Sets the bot's presence/status
   * @param client - Discord client
   */
  private setBotPresence(client: Client): void {
    client.user?.setPresence({
      activities: [
        {
          name: 'Pinterest Media',
          type: 3, // Watching
        },
      ],
      status: 'online',
    });
  }
}

