import { SetMetadata } from '@nestjs/common';
import { RATE_LIMIT_KEY, type RateLimitOptions } from '@/infrastructure/http/guards/rate-limit.guard';

/**
 * Rate Limit Decorator
 *
 * Wendet Rate Limiting auf Controller oder einzelne Endpunkte an.
 *
 * @param options Rate limit configuration
 * @returns Method/Class decorator
 *
 * @example
 * ```typescript
 * // Apply to entire controller
 * @Controller('api')
 * @RateLimit({ maxRequests: 100, windowMs: 60000 }) // 100 requests per minute
 * export class ApiController {}
 *
 * // Apply to specific endpoint
 * @Get('data')
 * @RateLimit({ maxRequests: 10, windowMs: 60000 }) // 10 requests per minute
 * getData() {}
 *
 * // Different limits for different endpoints
 * @Post('upload')
 * @RateLimit({ maxRequests: 5, windowMs: 300000 }) // 5 uploads per 5 minutes
 * uploadFile() {}
 * ```
 */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);

/**
 * Common Rate Limit Presets
 */
export const RateLimitPresets = {
  /** Standard API rate limit: 100 requests per minute */
  standard: (): RateLimitOptions => ({
    maxRequests: 100,
    windowMs: 60000,
  }),

  /** Strict rate limit: 10 requests per minute */
  strict: (): RateLimitOptions => ({
    maxRequests: 10,
    windowMs: 60000,
  }),

  /** Authentication endpoints: 5 attempts per 15 minutes */
  auth: (): RateLimitOptions => ({
    maxRequests: 5,
    windowMs: 900000, // 15 minutes
    prefix: 'auth',
  }),

  /** File upload endpoints: 10 uploads per hour */
  upload: (): RateLimitOptions => ({
    maxRequests: 10,
    windowMs: 3600000, // 1 hour
    prefix: 'upload',
  }),

  /** Search endpoints: 30 searches per minute */
  search: (): RateLimitOptions => ({
    maxRequests: 30,
    windowMs: 60000,
    prefix: 'search',
  }),

  /** WebSocket connections: 5 connections per minute */
  websocket: (): RateLimitOptions => ({
    maxRequests: 5,
    windowMs: 60000,
    prefix: 'ws',
  }),

  /** Custom rate limit */
  custom: (maxRequests: number, windowMs: number, prefix?: string): RateLimitOptions => ({
    maxRequests,
    windowMs,
    prefix,
  }),
};
