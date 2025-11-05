import { PQueue } from 'p-queue';
import { PrismaClient } from '@prisma/client';
import { DatabaseError } from './errors';
import { logger } from './logger';

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  queueConcurrency: number;
}

/**
 * Rate limit handler for Discord bot commands
 * Prevents abuse and handles rate limiting gracefully
 */
export class RateLimitHandler {
  private prisma: PrismaClient;
  private commandQueue: PQueue;
  private config: RateLimitConfig;

  constructor(prisma: PrismaClient, config?: Partial<RateLimitConfig>) {
    this.prisma = prisma;
    this.config = {
      maxRequests: config?.maxRequests || 10,
      windowMs: config?.windowMs || 60000, // 1 minute default
      queueConcurrency: config?.queueConcurrency || 3,
    };

    // Initialize queue with concurrency limit
    this.commandQueue = new PQueue({
      concurrency: this.config.queueConcurrency,
      interval: 1000,
      intervalCap: this.config.queueConcurrency,
    });
  }

  /**
   * Checks if a user can execute a command (rate limit check)
   * @param userId - Discord user ID
   * @returns True if user can execute, false if rate limited
   */
  public async canExecute(userId: string): Promise<boolean> {
    try {
      const now = new Date();
      
      // Get or create rate limit record for user
      let rateLimit = await this.prisma.rateLimit.findUnique({
        where: { userId },
      });

      // If no record exists or reset time has passed, create/reset
      if (!rateLimit || rateLimit.resetAt < now) {
        if (rateLimit) {
          await this.prisma.rateLimit.update({
            where: { userId },
            data: {
              count: 1,
              resetAt: new Date(now.getTime() + this.config.windowMs),
            },
          });
        } else {
          await this.prisma.rateLimit.create({
            data: {
              userId,
              count: 1,
              resetAt: new Date(now.getTime() + this.config.windowMs),
            },
          });
        }
        return true;
      }

      // Check if user has exceeded limit
      if (rateLimit.count >= this.config.maxRequests) {
        return false;
      }

      // Increment count
      await this.prisma.rateLimit.update({
        where: { userId },
        data: {
          count: rateLimit.count + 1,
        },
      });

      return true;
    } catch (error) {
      logger.error('Error checking rate limit', error as Error, { userId });
      // On error, allow execution (fail open) to prevent service disruption
      return true;
    }
  }

  /**
   * Gets remaining requests for a user
   * @param userId - Discord user ID
   * @returns Remaining requests and reset time
   */
  public async getRemainingRequests(userId: string): Promise<{
    remaining: number;
    resetAt: Date;
  }> {
    try {
      const rateLimit = await this.prisma.rateLimit.findUnique({
        where: { userId },
      });

      if (!rateLimit) {
        return {
          remaining: this.config.maxRequests,
          resetAt: new Date(Date.now() + this.config.windowMs),
        };
      }

      const now = new Date();
      if (rateLimit.resetAt < now) {
        return {
          remaining: this.config.maxRequests,
          resetAt: new Date(now.getTime() + this.config.windowMs),
        };
      }

      return {
        remaining: Math.max(0, this.config.maxRequests - rateLimit.count),
        resetAt: rateLimit.resetAt,
      };
    } catch (error) {
      logger.error('Error getting remaining requests', error as Error, { userId });
      return {
        remaining: this.config.maxRequests,
        resetAt: new Date(Date.now() + this.config.windowMs),
      };
    }
  }

  /**
   * Executes a command with rate limiting and queue management
   * @param userId - Discord user ID
   * @param commandFn - Function to execute
   * @returns Promise that resolves when command completes
   */
  public async executeWithRateLimit<T>(
    userId: string,
    commandFn: () => Promise<T>
  ): Promise<T> {
    // Check rate limit
    const canExecute = await this.canExecute(userId);
    
    if (!canExecute) {
      const remaining = await this.getRemainingRequests(userId);
      throw new RateLimitError(
        `Rate limit exceeded. Try again after ${remaining.resetAt.toISOString()}`,
        remaining.resetAt
      );
    }

    // Add to queue for execution
    return this.commandQueue.add(async () => {
      try {
        return await commandFn();
      } catch (error) {
        // Re-throw to be handled by caller
        throw error;
      }
    });
  }

  /**
   * Logs command usage to database
   * @param userId - Discord user ID
   * @param guildId - Discord guild ID (optional)
   * @param command - Command name
   * @param query - Search query (optional)
   * @param mediaType - Media type (optional)
   * @param success - Whether command succeeded
   * @param error - Error message if failed
   */
  public async logCommandUsage(
    userId: string,
    guildId: string | null,
    command: string,
    query?: string,
    mediaType?: string,
    success: boolean = true,
    error?: string
  ): Promise<void> {
    try {
      await this.prisma.commandUsage.create({
        data: {
          userId,
          guildId: guildId || null,
          command,
          query: query || null,
          mediaType: mediaType || null,
          success,
          error: error || null,
        },
      });
    } catch (err) {
      logger.error('Error logging command usage', err as Error, {
        userId,
        guildId,
        command,
      });
      // Don't throw - logging failure shouldn't break command execution
    }
  }

  /**
   * Cleans up expired rate limit records
   */
  public async cleanupExpiredRecords(): Promise<void> {
    try {
      const now = new Date();
      await this.prisma.rateLimit.deleteMany({
        where: {
          resetAt: {
            lt: now,
          },
        },
      });
    } catch (error) {
      logger.error('Error cleaning up expired rate limits', error as Error);
    }
  }
}

/**
 * Custom error for rate limit exceeded
 */
export class RateLimitError extends Error {
  public resetAt: Date;

  constructor(message: string, resetAt: Date) {
    super(message);
    this.name = 'RateLimitError';
    this.resetAt = resetAt;
  }
}

