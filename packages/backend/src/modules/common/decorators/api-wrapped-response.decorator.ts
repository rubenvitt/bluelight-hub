import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiCreatedResponse, getSchemaPath } from '@nestjs/swagger';

/**
 * Generiert das Schema für eine gewrappte Response mit data und meta.
 *
 * @param model - Das DTO-Model für die Response
 * @param isArray - Ob data ein Array ist
 */
const createWrappedSchema = <TModel extends Type<unknown>>(model: TModel, isArray: boolean) => ({
  type: 'object' as const,
  properties: {
    data: isArray
      ? {
          type: 'array' as const,
          items: { $ref: getSchemaPath(model) },
        }
      : {
          $ref: getSchemaPath(model),
        },
    meta: {
      type: 'object' as const,
      properties: {
        timestamp: {
          type: 'string' as const,
          format: 'date-time',
          example: '2025-08-29T14:00:00.000Z',
        },
        version: {
          type: 'string' as const,
          example: 'alpha',
        },
        requestId: {
          type: 'string' as const,
          example: 'abc123xyz',
        },
      },
      required: ['timestamp', 'version', 'requestId'],
    },
    ...(isArray
      ? {
          pagination: {
            type: 'object' as const,
            properties: {
              page: { type: 'number' as const, example: 1 },
              limit: { type: 'number' as const, example: 20 },
              total: { type: 'number' as const, example: 100 },
              totalPages: { type: 'number' as const, example: 5 },
            },
          },
        }
      : {}),
  },
  required: ['data', 'meta'],
});

/**
 * Custom Decorator für gewrappte API-Responses (HTTP 200 OK).
 * Beschreibt die tatsächliche Response-Struktur mit data und meta.
 */
export const ApiWrappedResponse = <TModel extends Type<unknown>>(
  model: TModel,
  options?: {
    description?: string;
    isArray?: boolean;
  },
) => {
  const isArray = options?.isArray ?? false;
  const description = options?.description ?? 'Successful response';

  return applyDecorators(ApiExtraModels(model), ApiOkResponse({ description, schema: createWrappedSchema(model, isArray) }));
};

/**
 * Custom Decorator für gewrappte API-Responses bei Resource-Erstellung (HTTP 201 Created).
 * Beschreibt die tatsächliche Response-Struktur mit data und meta.
 *
 * Für Endpoints, die eine Liste neu erzeugter Rows liefern (z. B. Fanout-
 * Create), `options.isArray = true` setzen — der OpenAPI-Generator
 * typisiert `data` dann korrekt als Array statt als Einzel-Objekt.
 */
export const ApiWrappedCreatedResponse = <TModel extends Type<unknown>>(
  model: TModel,
  options?: {
    description?: string;
    isArray?: boolean;
  },
) => {
  const description = options?.description ?? 'Resource successfully created';
  const isArray = options?.isArray ?? false;

  return applyDecorators(ApiExtraModels(model), ApiCreatedResponse({ description, schema: createWrappedSchema(model, isArray) }));
};

/**
 * Custom Decorator für gewrappte API-Responses mit echter Pagination-Meta
 * (HTTP 200 OK). Pflicht für Listen-Endpoints, deren Schema `pageSize` (statt
 * des generischen `limit` aus `ApiWrappedResponse({ isArray: true })`) als
 * Top-Level-Feld führt und die `total` + `totalPages` synchron mitliefern
 * (`PaginationMetaDto`-Vertrag, Story 1.6 AC1).
 *
 * Variante zu `ApiWrappedResponse(..., { isArray: true })`, weil der dortige
 * Pagination-Stub mit `limit` arbeitet — der Vertrag im Frontend (TanStack-
 * Query-Hook `usePatientenList`) sowie der generierte Shared-Client erwartet
 * jedoch `pageSize`.
 */
export const ApiWrappedPaginatedResponse = <TModel extends Type<unknown>>(
  model: TModel,
  options?: {
    description?: string;
  },
) => {
  const description = options?.description ?? 'Successful paginated response';
  const schema = {
    type: 'object' as const,
    properties: {
      data: {
        type: 'array' as const,
        items: { $ref: getSchemaPath(model) },
      },
      meta: {
        type: 'object' as const,
        properties: {
          timestamp: { type: 'string' as const, format: 'date-time', example: '2026-05-20T14:23:01.234Z' },
          version: { type: 'string' as const, example: 'alpha' },
          requestId: { type: 'string' as const, example: 'abc123xyz' },
        },
        required: ['timestamp', 'version', 'requestId'],
      },
      pagination: {
        type: 'object' as const,
        properties: {
          page: { type: 'number' as const, example: 1, minimum: 1 },
          pageSize: { type: 'number' as const, example: 50, minimum: 1, maximum: 100 },
          total: { type: 'number' as const, example: 250, minimum: 0 },
          totalPages: { type: 'number' as const, example: 5, minimum: 0 },
        },
        required: ['page', 'pageSize', 'total', 'totalPages'],
      },
    },
    required: ['data', 'meta', 'pagination'],
  };

  return applyDecorators(ApiExtraModels(model), ApiOkResponse({ description, schema }));
};
