import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';

/**
 * Rate Limiter Service using NestJS Cache Manager
 *
 * Implements a sliding window algorithm for rate limiting
 * using the application's cache infrastructure.
 */
@Injectable()
export class CacheRateLimiterService {
  private readonly logger = new Logger(CacheRateLimiterService.name);

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  /**
   * Check if a request is allowed under the rate limit
   *
   * @param key Unique identifier for the rate limit (e.g., user ID, IP)
   * @param limit Maximum number of requests allowed
   * @param windowMs Time window in milliseconds
   * @returns Whether the request is allowed
   */
  async isAllowed(key: string, limit: number, windowMs: number): Promise<boolean> {
    try {
      const now = Date.now();
      const windowStart = Math.floor(now / windowMs) * windowMs;
      const cacheKey = `ratelimit:${key}:${windowStart}`;

      // Get current count from cache
      const currentCount = await this.cacheManager.get<number>(cacheKey);

      if (currentCount === undefined || currentCount === null) {
        // First request in this window
        await this.cacheManager.set(cacheKey, 1, windowMs);
        return true;
      }

      if (currentCount >= limit) {
        // Rate limit exceeded
        return false;
      }

      // Increment counter
      const newCount = currentCount + 1;
      const ttl = windowStart + windowMs - now;
      await this.cacheManager.set(cacheKey, newCount, ttl);

      return true;
    } catch (error: unknown) {
      // Log error but don't block requests on cache failures
      this.logger.error(`Rate limiter cache error for key ${key}:`, error);
      // Return true to allow request on cache failure (graceful degradation)
      return true;
    }
  }

  /**
   * Get the current rate limit status for a key
   *
   * @param key Unique identifier for the rate limit
   * @param limit Maximum number of requests allowed (needed for calculation)
   * @param windowMs Time window in milliseconds
   * @returns Current request count and reset time
   */
  async getStatus(key: string, limit: number, windowMs: number): Promise<{ requests: number; resetTime: Date; remaining: number }> {
    try {
      const now = Date.now();
      const windowStart = Math.floor(now / windowMs) * windowMs;
      const cacheKey = `ratelimit:${key}:${windowStart}`;

      // Get current count from cache
      const currentCount = await this.cacheManager.get<number>(cacheKey);
      const requests = currentCount || 0;
      const resetTime = new Date(windowStart + windowMs);
      const remaining = Math.max(0, limit - requests);

      return {
        requests,
        resetTime,
        remaining,
      };
    } catch (error: unknown) {
      this.logger.error(`Rate limiter status error for key ${key}:`, error);
      // Return safe defaults on error
      return {
        requests: 0,
        resetTime: new Date(Date.now() + windowMs),
        remaining: limit,
      };
    }
  }

  /**
   * Reset rate limit for a specific key
   * Useful for admin operations or testing
   *
   * @param key Unique identifier for the rate limit
   * @param windowMs Time window in milliseconds
   */
  async reset(key: string, windowMs: number): Promise<void> {
    try {
      const now = Date.now();
      const windowStart = Math.floor(now / windowMs) * windowMs;
      const cacheKey = `ratelimit:${key}:${windowStart}`;

      await this.cacheManager.del(cacheKey);
      this.logger.debug(`Reset rate limit for key: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to reset rate limit for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Consume a request slot, incrementing the counter
   * This is a more efficient version when you don't need to check first
   *
   * @param key Unique identifier for the rate limit
   * @param limit Maximum number of requests allowed
   * @param windowMs Time window in milliseconds
   * @returns The new request count, or null if limit exceeded
   */
  async consume(key: string, limit: number, windowMs: number): Promise<number | null> {
    try {
      const now = Date.now();
      const windowStart = Math.floor(now / windowMs) * windowMs;
      const cacheKey = `ratelimit:${key}:${windowStart}`;

      // Get current count
      const currentCount = await this.cacheManager.get<number>(cacheKey);

      if (currentCount === undefined || currentCount === null) {
        // First request in this window
        await this.cacheManager.set(cacheKey, 1, windowMs);
        return 1;
      }

      if (currentCount >= limit) {
        // Rate limit exceeded
        return null;
      }

      // Increment and return new count
      const newCount = currentCount + 1;
      const ttl = windowStart + windowMs - now;
      await this.cacheManager.set(cacheKey, newCount, ttl);

      return newCount;
    } catch (error) {
      this.logger.error(`Rate limiter consume error for key ${key}:`, error);
      // Return 1 to allow request on cache failure
      return 1;
    }
  }
}
