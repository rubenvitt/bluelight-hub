import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { createId } from '@paralleldrive/cuid2';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Interface für paginierte Daten vom Controller
 */
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page?: number;
  limit?: number;
}

/**
 * Interface für Antworten mit Message
 */
export interface ResponseWithMessage<T = unknown> {
  data?: T;
  message: string;
}

/**
 * Interface für die transformierte API-Antwort
 */
export interface TransformedResponse<T = unknown> {
  data: T;
  meta: {
    timestamp: string;
    version?: string;
    requestId?: string;
  };
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Type Guard für paginierte Daten
 */
function isPaginatedData<T>(data: unknown): data is PaginatedData<T> {
  return data !== null && typeof data === 'object' && 'items' in data && Array.isArray((data as { items: unknown }).items) && 'total' in data && typeof (data as { total: unknown }).total === 'number';
}

/**
 * Type Guard für Response mit Message
 */
function hasMessage(data: unknown): data is { message: string } {
  return data !== null && typeof data === 'object' && 'message' in data;
}

/**
 * Type Guard für bereits transformierte Response
 */
function isTransformedResponse<T>(data: unknown): data is TransformedResponse<T> {
  return data !== null && typeof data === 'object' && 'data' in data && 'meta' in data && typeof (data as { meta: unknown }).meta === 'object';
}

/**
 * Interceptor zur Transformation aller API-Antworten in ein standardisiertes Format
 *
 * RxJS wird benötigt, da NestJS auf dem Observable-Pattern basiert:
 * - Ermöglicht asynchrone Stream-Verarbeitung
 * - Unterstützt reaktive Programmierung
 * - Erlaubt Transformation von Response-Daten im Stream
 */
@Injectable()
export class TransformInterceptor<T = unknown> implements NestInterceptor<T, TransformedResponse<T> | T> {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<TransformedResponse<T> | T> {
    // Prüfe ob Transform übersprungen werden soll
    const skipTransform = this.reflector.getAllAndOverride<boolean>('skipTransform', [context.getHandler(), context.getClass()]);

    if (skipTransform) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const requestId = (request.headers['x-request-id'] as string) || createId();

    return next.handle().pipe(
      map((responseData): TransformedResponse<T> => {
        // Wenn data bereits das korrekte Format hat, nicht nochmal wrappen
        if (isTransformedResponse(responseData)) {
          return responseData as TransformedResponse<T>;
        }

        // Basis-Transformation
        const transformed: TransformedResponse<T> = {
          data: responseData as T,
          meta: {
            timestamp: new Date().toISOString(),
            version: 'alpha',
            requestId,
          },
        };

        // Prüfe auf paginierte Daten
        if (isPaginatedData(responseData)) {
          const { items, total, page = 1, limit = 20 } = responseData;
          transformed.data = items as T;
          transformed.pagination = {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          };
        }

        // Füge message hinzu, wenn vorhanden
        if (hasMessage(responseData)) {
          const { message } = responseData;
          transformed.message = message;

          // Wenn es auch ein data-Feld gibt, verwende das
          if ('data' in responseData) {
            transformed.data = (responseData as ResponseWithMessage).data as T;
          } else {
            // Entferne message aus dem data-Objekt
            const { message: _, ...restData } = responseData as Record<string, unknown> & {
              message?: string;
            };
            transformed.data = restData as T;
          }
        }

        return transformed;
      }),
    );
  }
}
