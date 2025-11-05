import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import axios, { AxiosError } from 'axios';
import { PinterestService, PinterestMedia, MediaType } from './pinterest.service';
import { MediaDownloadError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Service for fetching and processing media from Pinterest
 * Handles downloading, validation, and preparation for Discord upload
 */
export class MediaFetcherService {
  private pinterestService: PinterestService;

  constructor(pinterestService: PinterestService) {
    this.pinterestService = pinterestService;
  }

  /**
   * Fetches media from Pinterest and prepares it for Discord
   * @param query - Search query
   * @param mediaType - Type of media to fetch
   * @param count - Number of media items to fetch (default: 1)
   * @returns Array of Discord attachments and embeds
   */
  public async fetchAndPrepareMedia(
    query: string,
    mediaType: MediaType,
    count: number = 1
  ): Promise<{ attachments: AttachmentBuilder[]; embeds: EmbedBuilder[] }> {
    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new ValidationError('Query cannot be empty');
    }

    if (count < 1 || count > 5) {
      throw new ValidationError('Count must be between 1 and 5');
    }

    try {
      // Fetch media from Pinterest
      const mediaItems = await this.pinterestService.searchMedia(query.trim(), mediaType, count);

      if (!mediaItems || mediaItems.length === 0) {
        throw new ValidationError(`No ${mediaType} found for query: ${query}`);
      }

      const attachments: AttachmentBuilder[] = [];
      const embeds: EmbedBuilder[] = [];
      const errors: Error[] = [];

      // Process each media item
      for (const media of mediaItems.slice(0, count)) {
        if (!media.url || !media.id) {
          logger.warn('Invalid media item skipped', { media });
          continue;
        }

        try {
          // Download media
          const buffer = await this.downloadMedia(media.url);

          if (!buffer || buffer.length === 0) {
            throw new MediaDownloadError('Downloaded buffer is empty', media.url);
          }

          // Create Discord attachment
          const attachment = new AttachmentBuilder(buffer, {
            name: this.getFileName(media),
          });

          attachments.push(attachment);

          // Create embed
          const embed = this.createEmbed(media, attachment);
          embeds.push(embed);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(error instanceof Error ? error : new Error(errorMsg));
          logger.warn('Failed to process media item', {
            error: error instanceof Error ? error.message : 'Unknown error',
            mediaId: media.id,
            mediaUrl: media.url,
          });
          // Continue with other items even if one fails
        }
      }

      if (attachments.length === 0) {
        const errorMessages = errors.map(e => e.message).join('; ');
        throw new MediaDownloadError(
          `Failed to download any media items. Errors: ${errorMessages}`
        );
      }

      return { attachments, embeds };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof MediaDownloadError) {
        throw error;
      }
      logger.error('Error fetching media', error as Error, { query, mediaType, count });
      throw error;
    }
  }

  /**
   * Downloads media from a URL with retry logic for rate limits
   * @param url - Media URL
   * @returns Media buffer
   */
  private async downloadMedia(url: string): Promise<Buffer> {
    if (!url || typeof url !== 'string') {
      throw new ValidationError('Invalid URL provided');
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 30000, // 30 second timeout
          maxContentLength: 25 * 1024 * 1024, // 25MB limit
          validateStatus: (status: number) => status >= 200 && status < 300,
        });

        if (!response.data) {
          throw new MediaDownloadError('Empty response from server', url);
        }

        const buffer = Buffer.from(response.data);
        if (buffer.length === 0) {
          throw new MediaDownloadError('Downloaded buffer is empty', url);
        }

        return buffer;
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        lastError = err;

        // Handle rate limiting with exponential backoff
        if (error instanceof AxiosError) {
          const axiosError = error as AxiosError;
          if (axiosError.response?.status === 429) {
            const retryAfter = axiosError.response.headers['retry-after'];
            const waitTime = retryAfter 
              ? parseInt(String(retryAfter), 10) * 1000 
              : Math.min((attempt + 1) * 2000, 10000); // Cap at 10 seconds
            
            logger.warn('Rate limited when downloading media', {
              url,
              attempt: attempt + 1,
              maxRetries,
              waitTime,
            });
            
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue;
          }

          // Handle other HTTP errors
          if (axiosError.response) {
            throw new MediaDownloadError(
              `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`,
              url
            );
          }

          // Handle network errors
          if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
            if (attempt === maxRetries - 1) {
              throw new MediaDownloadError('Request timeout', url);
            }
            await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000));
            continue;
          }
        }

        // For non-retryable errors, throw immediately
        if (error instanceof MediaDownloadError) {
          throw error;
        }
      }
    }

    throw new MediaDownloadError(
      `Failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
      url
    );
  }

  /**
   * Generates a filename for the media attachment
   * @param media - Pinterest media item
   * @returns Filename
   */
  private getFileName(media: PinterestMedia): string {
    const extension = this.getFileExtension(media.url);
    const prefix = media.type;
    const timestamp = Date.now();
    return `${prefix}_${timestamp}.${extension}`;
  }

  /**
   * Extracts file extension from URL
   * @param url - Media URL
   * @returns File extension
   */
  private getFileExtension(url: string): string {
    const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return match ? match[1] : 'jpg';
  }

  /**
   * Creates a Discord embed for the media
   * @param media - Pinterest media item
   * @param attachment - Discord attachment
   * @returns Discord embed
   */
  private createEmbed(media: PinterestMedia, attachment: AttachmentBuilder): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(media.title || `${media.type.toUpperCase()} from Pinterest`)
      .setColor(0xBD081C) // Pinterest red color
      .setImage(`attachment://${attachment.name}`)
      .setTimestamp()
      .setFooter({ text: 'Pinterest Media Fetcher' });

    if (media.description) {
      embed.setDescription(media.description);
    }

    return embed;
  }

  /**
   * Fetches a specific pin by ID and prepares it for Discord
   * @param pinId - Pinterest pin ID
   * @returns Discord attachments and embeds
   */
  public async fetchPinById(pinId: string): Promise<{ attachments: AttachmentBuilder[]; embeds: EmbedBuilder[] }> {
    try {
      const media = await this.pinterestService.getPinById(pinId);
      const buffer = await this.downloadMedia(media.url);
      
      const attachment = new AttachmentBuilder(buffer, {
        name: this.getFileName(media),
      });

      const embed = this.createEmbed(media, attachment);

      return {
        attachments: [attachment],
        embeds: [embed],
      };
    } catch (error) {
      logger.error('Error fetching pin by ID', error as Error, { pinId });
      throw error;
    }
  }
}

