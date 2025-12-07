import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

/**
 * Custom Decorator für gewrappte API-Responses
 * Beschreibt die tatsächliche Response-Struktur mit data und meta
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

  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      description,
      schema: {
        type: 'object',
        properties: {
          data: isArray
            ? {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              }
            : {
                $ref: getSchemaPath(model),
              },
          meta: {
            type: 'object',
            properties: {
              timestamp: {
                type: 'string',
                format: 'date-time',
                example: '2025-08-29T14:00:00.000Z',
              },
              version: {
                type: 'string',
                example: 'alpha',
              },
              requestId: {
                type: 'string',
                example: 'abc123xyz',
              },
            },
            required: ['timestamp', 'version', 'requestId'],
          },
          ...(isArray
            ? {
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'number', example: 1 },
                    limit: { type: 'number', example: 20 },
                    total: { type: 'number', example: 100 },
                    totalPages: { type: 'number', example: 5 },
                  },
                },
              }
            : {}),
        },
        required: ['data', 'meta'],
      },
    }),
  );
};
