import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { createId } from '@paralleldrive/cuid2';
import * as util from 'node:util';
import { PerformanceLogger } from '@/shared/utils/performance-logger.util';

interface RequestWithStartTime extends Request {
  startTime?: number;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithStartTime>();

    // Generate or retrieve request ID for correlation
    const requestId = (request.headers['x-request-id'] as string) || createId();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // Determine error details based on status code
    let message: string;
    let errorDetails: unknown = null;

    if (status >= 500) {
      // For 5xx errors, don't expose sensitive information
      message = 'Ein interner Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.';

      // Log the actual error internally for debugging
      const actualError = exception instanceof HttpException ? exception.getResponse() : exception;

      this.logger.error(`[${requestId}] Internal Server Error: ${util.inspect(actualError)}`, exception instanceof Error ? exception.stack : undefined);
    } else {
      // For client errors (4xx), provide the actual error message
      if (exception instanceof HttpException) {
        const errorResponse = exception.getResponse();
        if (typeof errorResponse === 'string') {
          message = errorResponse;
        } else if (typeof errorResponse === 'object' && errorResponse !== null) {
          const responseObj = errorResponse as Record<string, unknown>;
          message = (responseObj.message as string) || exception.message;
          errorDetails = responseObj.error || null;
        } else {
          message = exception.message;
        }
      } else {
        message = 'Ein unerwarteter Fehler ist aufgetreten';
      }
    }

    const start = request.startTime ?? response.locals?.startTime ?? Date.now();
    const duration = Date.now() - start;

    // Log request with correlation ID
    PerformanceLogger.logHttpRequest(request.method, request.url, status, duration, 'ExceptionFilter', `[${requestId}] ${message}`);

    // Build response body
    const responseBody: Record<string, unknown> = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      requestId, // Always include request ID for correlation
    };

    // Only include error details for non-5xx errors
    if (status < 500 && errorDetails) {
      responseBody.error = errorDetails;
    }

    // Set request ID header for client correlation
    response.setHeader('X-Request-Id', requestId);

    response.status(status).json(responseBody);
  }
}
