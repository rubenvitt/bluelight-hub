import { type CanActivate, type ExecutionContext, Injectable, Logger } from '@nestjs/common';
// biome-ignore lint/style/useImportType: Reflector needed for DI at runtime
import { Reflector } from '@nestjs/core';
import * as crypto from 'node:crypto';
// biome-ignore lint/style/useImportType: CacheRateLimiterService needed for DI at runtime
import { CacheRateLimiterService } from '@/infrastructure/services/cache-rate-limiter.service';

export const RATE_LIMIT_KEY = 'rateLimit';

/**
 * Rate Limit Decorator Options
 */
export interface RateLimitOptions {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Optional custom key prefix */
  prefix?: string;
  /** Optional custom key generator */
  keyGenerator?: (context: unknown) => string;
}

/**
 * Rate Limit Guard
 *
 * Schützt Endpunkte vor übermäßigen Anfragen durch Rate Limiting.
 * Nutzt Cache-basierten Rate Limiter mit Sliding Window Algorithm.
 *
 * @example
 * ```typescript
 * @Controller('api')
 * @UseGuards(RateLimitGuard)
 * export class ApiController {
 *   @Get('data')
 *   @RateLimit({ maxRequests: 10, windowMs: 60000 }) // 10 requests per minute
 *   getData() {
 *     return { data: 'protected' };
 *   }
 * }
 * ```
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly cacheRateLimiterService: CacheRateLimiterService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimitOptions = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]);

    if (!rateLimitOptions) {
      return true; // No rate limit configured
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const key = rateLimitOptions.keyGenerator ? rateLimitOptions.keyGenerator(request) : generateSecureRateLimitKey(request);
    const prefixedKey = `${rateLimitOptions.prefix || 'api'}:${key}`;
    const limit = rateLimitOptions.maxRequests;
    const windowMs = rateLimitOptions.windowMs;

    try {
      const allowed = await this.cacheRateLimiterService.isAllowed(prefixedKey, limit, windowMs);

      if (!allowed) {
        const status = await this.cacheRateLimiterService.getStatus(prefixedKey, limit, windowMs);
        const retryAfter = Math.ceil((status.resetTime.getTime() - Date.now()) / 1000);

        response.setHeader('X-RateLimit-Limit', limit);
        response.setHeader('X-RateLimit-Remaining', 0);
        response.setHeader('X-RateLimit-Reset', status.resetTime.toISOString());
        response.setHeader('Retry-After', retryAfter);

        response.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${retryAfter} seconds`,
          retryAfter,
        });

        return false;
      }

      // Add rate limit headers for successful requests
      const status = await this.cacheRateLimiterService.getStatus(prefixedKey, limit, windowMs);
      response.setHeader('X-RateLimit-Limit', limit);
      response.setHeader('X-RateLimit-Remaining', status.remaining);
      response.setHeader('X-RateLimit-Reset', status.resetTime.toISOString());

      return true;
    } catch (error: unknown) {
      // Log error but allow request on cache failures (graceful degradation)
      this.logger.error('Rate limiter error:', error);
      return true;
    }
  }
}

/**
 * Generate a secure key from multiple request factors
 *
 * This function creates a composite key that is much harder to manipulate than
 * relying solely on IP addresses. It combines multiple factors in order of reliability:
 *
 * 1. Session ID - Most reliable for logged-in users
 * 2. User ID - For authenticated requests
 * 3. Browser fingerprint - Combination of stable headers (User-Agent, Accept headers, etc.)
 * 4. IP address - Still included but not primary identifier
 * 5. API key/Token - For API requests
 *
 * The combination makes it difficult for attackers to bypass rate limits by:
 * - Changing IP addresses (fingerprint remains)
 * - Spoofing headers (session/auth remains)
 * - Using different sessions (fingerprint helps correlate)
 *
 * @param req Express request object
 * @returns Combined key string in format "factor1:value1:factor2:value2:..."
 * @example
 * // Authenticated user: "user:123:fp:a1b2c3d4:ip:192.168.1.1"
 * // Anonymous user: "fp:a1b2c3d4:ip:192.168.1.1"
 * // API request: "api:key123:fp:a1b2c3d4:ip:192.168.1.1"
 */
interface RequestLike {
  session?: { id?: string };
  user?: { id?: string };
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  connection?: { remoteAddress?: string };
}

export function generateSecureRateLimitKey(req: RequestLike): string {
  const factors: string[] = [];

  // 1. Session ID (if available)
  if (req.session?.id) {
    factors.push(`session:${req.session.id}`);
  }

  // 2. User ID (if authenticated)
  if (req.user?.id) {
    factors.push(`user:${req.user.id}`);
  }

  // 3. Fingerprint from headers combination
  const fingerprint = [
    req.headers?.['user-agent'] || 'no-ua',
    req.headers?.['accept-language'] || 'no-lang',
    req.headers?.['accept-encoding'] || 'no-encoding',
    // Add more stable headers that are less likely to change during a session
    req.headers?.['sec-ch-ua'] || '',
    req.headers?.['sec-ch-ua-platform'] || '',
  ].join('|');

  // Hash the fingerprint to keep keys shorter
  const fingerprintHash = crypto.createHash('sha256').update(fingerprint).digest('hex').substring(0, 16); // Use first 16 chars of hash

  factors.push(`fp:${fingerprintHash}`);

  // 4. IP address as fallback (still useful but not primary)
  const xForwardedFor = req.headers?.['x-forwarded-for'];
  const ip = req.ip || (typeof xForwardedFor === 'string' ? xForwardedFor.split(',')[0] : xForwardedFor?.[0]) || req.connection?.remoteAddress || 'no-ip';
  factors.push(`ip:${ip}`);

  // 5. API key or OAuth client ID (for API endpoints)
  if (req.headers?.['x-api-key']) {
    factors.push(`api:${req.headers['x-api-key']}`);
  } else if (typeof req.headers?.authorization === 'string' && req.headers.authorization.startsWith('Bearer ')) {
    // Extract token identifier (first 8 chars of token)
    const token = req.headers.authorization.substring(7, 15);
    factors.push(`token:${token}`);
  }

  // Combine all factors
  return factors.join(':');
}
