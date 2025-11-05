/**
 * Custom error classes for the bot
 * Provides better error handling and debugging
 */

/**
 * Base error class for bot-specific errors
 */
export class BotError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;

  constructor(message: string, code: string, statusCode?: number) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error for Pinterest API failures
 */
export class PinterestAPIError extends BotError {
  constructor(message: string, statusCode?: number) {
    super(message, 'PINTEREST_API_ERROR', statusCode);
  }
}

/**
 * Error for Discord API failures
 */
export class DiscordAPIError extends BotError {
  constructor(message: string, statusCode?: number) {
    super(message, 'DISCORD_API_ERROR', statusCode);
  }
}

/**
 * Error for media download failures
 */
export class MediaDownloadError extends BotError {
  constructor(message: string, url?: string) {
    super(
      url ? `Failed to download media from ${url}: ${message}` : `Media download failed: ${message}`,
      'MEDIA_DOWNLOAD_ERROR'
    );
  }
}

/**
 * Error for validation failures
 */
export class ValidationError extends BotError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

/**
 * Error for database operations
 */
export class DatabaseError extends BotError {
  constructor(message: string, originalError?: Error) {
    super(
      originalError ? `${message}: ${originalError.message}` : message,
      'DATABASE_ERROR'
    );
  }
}

