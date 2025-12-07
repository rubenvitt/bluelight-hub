import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { DomainException, EinsatzNotFoundException, EinsatzValidationException, EinsatzBusinessRuleException, EinsatzPersistenceException } from '@/domain/common/exceptions';
import { DuplicateEntityException, EntityNotFoundException, DatabaseTimeoutException, ConcurrencyException } from '@/infrastructure/common/prisma-error.mapper';

/**
 * Exception Filter für Domain Exceptions.
 *
 * Mappt Domain-spezifische Exceptions zu HTTP Status Codes und
 * erzeugt konsistente Error Responses im JSON-Format.
 *
 * **Mapping:**
 * - EinsatzValidationException → 400 Bad Request
 * - EinsatzNotFoundException / EntityNotFoundException → 404 Not Found
 * - EinsatzBusinessRuleException → 422 Unprocessable Entity
 * - EinsatzPersistenceException / DB Exceptions → 500 Internal Server Error
 * - DuplicateEntityException → 409 Conflict
 * - DatabaseTimeoutException → 503 Service Unavailable
 * - ConcurrencyException → 409 Conflict
 */
@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: DomainException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Generate or retrieve request ID for correlation
    const requestId = (request.headers['x-request-id'] as string) || createId();

    const { status, errorCode } = this.mapExceptionToStatus(exception);
    const errorResponse = this.buildErrorResponse(exception, status, errorCode, request, requestId);

    // Log based on status code severity
    if (status >= 500) {
      this.logger.error(`[${requestId}] Domain exception occurred`, {
        ...exception.toJSON(),
        statusCode: status,
        path: request.url,
      });
    } else {
      this.logger.warn(`[${requestId}] Domain exception occurred`, {
        ...exception.toJSON(),
        statusCode: status,
        path: request.url,
      });
    }

    // Set request ID header for client correlation
    response.setHeader('X-Request-Id', requestId);

    response.status(status).json(errorResponse);
  }

  /**
   * Mappt Exception-Typ zu HTTP Status Code und Error Code.
   */
  private mapExceptionToStatus(exception: DomainException): { status: number; errorCode: string } {
    // Validation Errors → 400 Bad Request
    if (exception instanceof EinsatzValidationException) {
      return { status: HttpStatus.BAD_REQUEST, errorCode: 'VALIDATION_ERROR' };
    }

    // Not Found → 404
    if (exception instanceof EinsatzNotFoundException || exception instanceof EntityNotFoundException) {
      return { status: HttpStatus.NOT_FOUND, errorCode: 'NOT_FOUND' };
    }

    // Business Rule Violations → 422 Unprocessable Entity
    if (exception instanceof EinsatzBusinessRuleException) {
      return { status: HttpStatus.UNPROCESSABLE_ENTITY, errorCode: 'BUSINESS_RULE_VIOLATION' };
    }

    // Duplicate Entity → 409 Conflict
    if (exception instanceof DuplicateEntityException) {
      return { status: HttpStatus.CONFLICT, errorCode: 'DUPLICATE_ENTITY' };
    }

    // Concurrency → 409 Conflict
    if (exception instanceof ConcurrencyException) {
      return { status: HttpStatus.CONFLICT, errorCode: 'CONCURRENCY_CONFLICT' };
    }

    // Timeout → 503 Service Unavailable
    if (exception instanceof DatabaseTimeoutException) {
      return { status: HttpStatus.SERVICE_UNAVAILABLE, errorCode: 'DATABASE_TIMEOUT' };
    }

    // Persistence Errors → 500 Internal Server Error
    if (exception instanceof EinsatzPersistenceException) {
      return { status: HttpStatus.INTERNAL_SERVER_ERROR, errorCode: 'PERSISTENCE_ERROR' };
    }

    // Default: 500 Internal Server Error
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, errorCode: 'DOMAIN_ERROR' };
  }

  /**
   * Baut konsistente Error Response im NestJS-Format.
   *
   * SECURITY: Exponiert KEINE internen Details (originalError, stack traces).
   */
  private buildErrorResponse(exception: DomainException, status: number, errorCode: string, request: Request, requestId: string): Record<string, unknown> {
    return {
      statusCode: status,
      error: errorCode,
      message: exception.message,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId, // Include request ID for correlation
      // Domain-specific context (safe to expose)
      ...(exception.aggregateId && { aggregateId: exception.aggregateId }),
      ...(exception.operation && { operation: exception.operation }),
    };
  }
}
