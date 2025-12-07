import { Logger } from '@nestjs/common';
import { milliseconds } from 'date-fns';

export class PerformanceLogger {
  private static readonly logger = new Logger('Performance');
  private static slowRequestThresholdMs = milliseconds({ seconds: 1 });

  /**
   * Configure the slow request threshold
   * @param options - Configuration options
   * @param options.slowRequestThresholdMs - Threshold in milliseconds for slow request detection
   */
  static configure(options: { slowRequestThresholdMs?: number }): void {
    if (options.slowRequestThresholdMs !== undefined && options.slowRequestThresholdMs > 0) {
      PerformanceLogger.slowRequestThresholdMs = options.slowRequestThresholdMs;
    }
  }

  /**
   * Get current slow request threshold
   */
  static getSlowRequestThreshold(): number {
    return PerformanceLogger.slowRequestThresholdMs;
  }

  /**
   * Logs HTTP request performance with appropriate log level based on status code
   * @param method - HTTP method (GET, POST, etc.)
   * @param url - Request URL (should be without query parameters for privacy)
   * @param statusCode - HTTP response status code
   * @param duration - Request duration in milliseconds
   * @param context - Optional context string (e.g., controller/handler name)
   * @param errorMessage - Optional error message for failed requests
   * @param options - Optional configuration for this specific log call
   * @param options.slowRequestThresholdMs - Override slow request threshold for this call
   */
  static logHttpRequest(method: string, url: string, statusCode: number, duration: number, context?: string, errorMessage?: string, options?: { slowRequestThresholdMs?: number }): void {
    const contextStr = context ? `[${context}] ` : '';
    const baseMessage = `${contextStr}${method} ${url} - ${statusCode} - ${duration}ms`;

    // Log mit unterschiedlichen Levels basierend auf Status Code
    if (statusCode >= 200 && statusCode < 300) {
      // Success
      PerformanceLogger.logger.log(baseMessage);

      // Slow request warning with configurable threshold
      const threshold = options?.slowRequestThresholdMs ?? PerformanceLogger.slowRequestThresholdMs;
      if (duration > threshold) {
        PerformanceLogger.logger.warn(`Slow request detected: ${method} ${url} took ${duration}ms (threshold: ${threshold}ms)`);
      }
    } else if (statusCode === 401 || statusCode === 403) {
      // Unauthorized/Forbidden
      PerformanceLogger.logger.warn(`${baseMessage} (Unauthorized/Forbidden)`);
    } else if (statusCode >= 400 && statusCode < 500) {
      // Client errors - use warn level for better visibility
      PerformanceLogger.logger.warn(`${baseMessage} (Client Error)`);
    } else {
      // Server errors (500+)
      // Note: errorMessage should already be sanitized to avoid PII leakage
      const errorInfo = errorMessage ? `: ${errorMessage}` : '';
      PerformanceLogger.logger.error(`${baseMessage}${errorInfo}`);
    }
  }
}
