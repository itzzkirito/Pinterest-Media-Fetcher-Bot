import axios, { AxiosInstance, AxiosError } from 'axios';
import { PrismaClient } from '@prisma/client';
import { PinterestAPIError, DatabaseError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Media types supported by Pinterest
 */
export enum MediaType {
  PFP = 'pfp',
  BANNER = 'banner',
  GIF = 'gif',
}

/**
 * Pinterest media item interface
 */
export interface PinterestMedia {
  id: string;
  type: MediaType;
  url: string;
  title?: string;
  description?: string;
  width?: number;
  height?: number;
}

/**
 * Pinterest API response interface
 */
interface PinterestResponse {
  data: Array<{
    id: string;
    media: {
      images?: {
        '564x'?: { url: string };
        '736x'?: { url: string };
        'originals'?: { url: string };
      };
      videos?: {
        '720p'?: { url: string };
        '480p'?: { url: string };
      };
    };
    title?: string;
    description?: string;
    board_id?: string;
    pin_id?: string;
  }>;
  page?: {
    cursor?: string;
  };
}

/**
 * Service for interacting with the Pinterest API
 * Handles authentication, search, and media retrieval with caching
 */
export class PinterestService {
  private apiClient: AxiosInstance;
  private accessToken: string;
  private prisma: PrismaClient;
  private cacheExpiryHours: number;

  constructor(prisma: PrismaClient, cacheExpiryHours: number = 24) {
    this.prisma = prisma;
    this.cacheExpiryHours = cacheExpiryHours;
    this.accessToken = process.env.PINTEREST_ACCESS_TOKEN || '';
    
    if (!this.accessToken) {
      throw new Error('PINTEREST_ACCESS_TOKEN is required');
    }

    // Initialize Axios client with Pinterest API base URL
    this.apiClient = axios.create({
      baseURL: 'https://api.pinterest.com/v5',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    });

    // Add response interceptor for rate limit handling with retry logic
    this.apiClient.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 429) {
          // Rate limited - wait and retry with exponential backoff
          const retryAfter = error.response.headers['retry-after'];
          const waitTime = retryAfter 
            ? parseInt(retryAfter, 10) * 1000 
            : 5000;
          
          logger.warn('Rate limited by Pinterest API', {
            waitTime,
            url: error.config?.url,
          });
          
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          
          // Only retry if config exists
          if (error.config) {
            return this.apiClient.request(error.config);
          }
        }
        
        // Transform axios errors to custom errors
        if (error.response) {
          throw new PinterestAPIError(
            error.response.data?.message || error.message || 'Pinterest API error',
            error.response.status
          );
        }
        
        throw error;
      }
    );
  }

  /**
   * Searches Pinterest for media based on query and type
   * @param query - Search query
   * @param mediaType - Type of media to search for
   * @param limit - Maximum number of results (default: 10)
   * @returns Array of Pinterest media items
   */
  public async searchMedia(
    query: string,
    mediaType: MediaType,
    limit: number = 10
  ): Promise<PinterestMedia[]> {
    try {
      const searchQuery = this.buildSearchQuery(query, mediaType);
      
      const response = await this.apiClient.get<PinterestResponse>('/search/pins', {
        params: {
          query: searchQuery,
          limit: Math.min(limit, 250), // Pinterest API limit
        },
      });

      if (!response.data || !Array.isArray(response.data.data)) {
        throw new PinterestAPIError('Invalid response from Pinterest API');
      }

      return this.parseMediaResponse(response.data, mediaType);
    } catch (error) {
      if (error instanceof PinterestAPIError) {
        throw error;
      }
      logger.error('Error searching Pinterest', error as Error, { query, mediaType, limit });
      throw new PinterestAPIError(
        `Failed to search Pinterest: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Fetches a specific pin by ID with caching
   * @param pinId - Pinterest pin ID
   * @returns Pinterest media item
   */
  public async getPinById(pinId: string): Promise<PinterestMedia> {
    try {
      // Check cache first
      const cached = await this.prisma.cachedMedia.findUnique({
        where: { pinId },
      });

      if (cached && cached.expiresAt > new Date()) {
        return {
          id: cached.pinId,
          type: cached.mediaType as MediaType,
          url: cached.url,
          title: cached.title || undefined,
          description: cached.description || undefined,
          width: cached.width || undefined,
          height: cached.height || undefined,
        };
      }

      // Fetch from API
      const response = await this.apiClient.get(`/pins/${pinId}`);
      const pin = response.data;

      const mediaType = this.detectMediaType(pin);
      const mediaUrl = this.extractMediaUrl(pin);

      const media: PinterestMedia = {
        id: pin.id,
        type: mediaType,
        url: mediaUrl,
        title: pin.title,
        description: pin.description,
        width: pin.media?.images?.originals?.width,
        height: pin.media?.images?.originals?.height,
      };

      // Cache the result
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.cacheExpiryHours);

      try {
        await this.prisma.cachedMedia.upsert({
          where: { pinId },
          create: {
            pinId,
            mediaType: mediaType,
            url: mediaUrl,
            title: pin.title,
            description: pin.description,
            width: pin.media?.images?.originals?.width,
            height: pin.media?.images?.originals?.height,
            expiresAt,
          },
          update: {
            mediaType: mediaType,
            url: mediaUrl,
            title: pin.title,
            description: pin.description,
            width: pin.media?.images?.originals?.width,
            height: pin.media?.images?.originals?.height,
            expiresAt,
            cachedAt: new Date(),
          },
        });
      } catch (dbError) {
        logger.warn('Failed to cache media', dbError as Error, { pinId });
        // Continue even if caching fails
      }

      return media;
    } catch (error) {
      if (error instanceof PinterestAPIError) {
        throw error;
      }
      logger.error('Error fetching pin', error as Error, { pinId });
      throw new PinterestAPIError(
        `Failed to fetch pin: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Builds a search query optimized for the media type
   * @param query - Base search query
   * @param mediaType - Type of media
   * @returns Optimized search query
   */
  private buildSearchQuery(query: string, mediaType: MediaType): string {
    const typeKeywords: Record<MediaType, string[]> = {
      [MediaType.PFP]: ['profile picture', 'avatar', 'pfp', 'icon'],
      [MediaType.BANNER]: ['banner', 'header', 'cover', 'background'],
      [MediaType.GIF]: ['gif', 'animated', 'meme'],
    };

    const keywords = typeKeywords[mediaType].join(' OR ');
    return `${query} ${keywords}`;
  }

  /**
   * Parses Pinterest API response into media items
   * @param response - Pinterest API response
   * @param mediaType - Expected media type
   * @returns Array of parsed media items
   */
  private parseMediaResponse(
    response: PinterestResponse,
    mediaType: MediaType
  ): PinterestMedia[] {
    return response.data.map((item) => {
      const mediaUrl = this.extractMediaUrl(item);
      const detectedType = this.detectMediaType(item);

      return {
        id: item.id || item.pin_id || '',
        type: detectedType || mediaType,
        url: mediaUrl,
        title: item.title,
        description: item.description,
      };
    }).filter((item) => item.url && item.id);
  }

  /**
   * Extracts the best quality media URL from a Pinterest pin
   * @param pin - Pinterest pin data
   * @returns Media URL
   */
  private extractMediaUrl(pin: any): string {
    // Try to get the highest quality image
    if (pin.media?.images?.originals?.url) {
      return pin.media.images.originals.url;
    }
    if (pin.media?.images?.['736x']?.url) {
      return pin.media.images['736x'].url;
    }
    if (pin.media?.images?.['564x']?.url) {
      return pin.media.images['564x'].url;
    }
    
    // Try to get video URL (for GIFs)
    if (pin.media?.videos?.['720p']?.url) {
      return pin.media.videos['720p'].url;
    }
    if (pin.media?.videos?.['480p']?.url) {
      return pin.media.videos['480p'].url;
    }

    throw new Error('No media URL found in pin');
  }

  /**
   * Detects the media type from a Pinterest pin
   * @param pin - Pinterest pin data
   * @returns Detected media type
   */
  private detectMediaType(pin: any): MediaType {
    // Check for video/GIF indicators
    if (pin.media?.videos || pin.media_type === 'video') {
      return MediaType.GIF;
    }

    // Check dimensions to guess type
    const width = pin.media?.images?.originals?.width || 0;
    const height = pin.media?.images?.originals?.height || 0;

    if (width > 0 && height > 0) {
      const aspectRatio = width / height;
      
      // Banners are typically wide (16:9 or wider)
      if (aspectRatio > 2) {
        return MediaType.BANNER;
      }
      
      // PFPs are typically square or close to square
      if (aspectRatio >= 0.9 && aspectRatio <= 1.1) {
        return MediaType.PFP;
      }
    }

    // Default to banner if uncertain
    return MediaType.BANNER;
  }
}

