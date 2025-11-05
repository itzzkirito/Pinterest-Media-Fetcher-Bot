import { config } from 'dotenv';
import { logger } from './logger';

// Load environment variables
config();

/**
 * Validates and provides typed access to environment variables
 */
export class Config {
  private static instance: Config;
  private readonly values: {
    discordToken: string;
    discordClientId: string;
    pinterestAccessToken: string;
    prefix: string;
    databaseUrl: string;
    rateLimitMaxRequests: number;
    rateLimitWindowMs: number;
    rateLimitConcurrency: number;
    nodeEnv: string;
  };

  private constructor() {
    this.values = {
      discordToken: this.getRequiredEnv('DISCORD_TOKEN'),
      discordClientId: this.getRequiredEnv('DISCORD_CLIENT_ID'),
      pinterestAccessToken: this.getRequiredEnv('PINTEREST_ACCESS_TOKEN'),
      prefix: process.env.PREFIX || '!',
      databaseUrl: process.env.DATABASE_URL || 'file:./data.db',
      rateLimitMaxRequests: this.getNumberEnv('RATE_LIMIT_MAX_REQUESTS', 10),
      rateLimitWindowMs: this.getNumberEnv('RATE_LIMIT_WINDOW_MS', 60000),
      rateLimitConcurrency: this.getNumberEnv('RATE_LIMIT_CONCURRENCY', 3),
      nodeEnv: process.env.NODE_ENV || 'production',
    };

    this.validate();
  }

  /**
   * Gets the singleton instance
   */
  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  /**
   * Gets a required environment variable
   */
  private getRequiredEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  }

  /**
   * Gets a number environment variable with default
   */
  private getNumberEnv(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 0) {
      logger.warn(`Invalid ${key}, using default: ${defaultValue}`);
      return defaultValue;
    }
    return parsed;
  }

  /**
   * Validates configuration values
   */
  private validate(): void {
    if (this.values.rateLimitMaxRequests < 1) {
      throw new Error('RATE_LIMIT_MAX_REQUESTS must be at least 1');
    }
    if (this.values.rateLimitWindowMs < 1000) {
      throw new Error('RATE_LIMIT_WINDOW_MS must be at least 1000ms');
    }
    if (this.values.rateLimitConcurrency < 1) {
      throw new Error('RATE_LIMIT_CONCURRENCY must be at least 1');
    }
    if (this.values.prefix.length !== 1) {
      throw new Error('PREFIX must be a single character');
    }
  }

  /**
   * Gets all configuration values
   */
  public getValues() {
    return { ...this.values };
  }
}

export const appConfig = Config.getInstance();

