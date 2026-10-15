import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiProperty,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { DEFAULT_SUCCESS_MESSAGE } from '@app/common';

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

export function ApiSuccessResponse(options: {
  type: Type<unknown>;
  isArray?: boolean;
  paginated?: boolean;
  status?: number;
  description?: string;
}) {
  const status = options.status ?? 200;
  const dataSchema = options.isArray
    ? { type: 'array' as const, items: { $ref: getSchemaPath(options.type) } }
    : { $ref: getSchemaPath(options.type) };

  return applyDecorators(
    ApiExtraModels(options.type, PaginationMetaDto),
    ApiResponse({
      status,
      description: options.description ?? DEFAULT_SUCCESS_MESSAGE,
      schema: {
        type: 'object',
        required: ['statusCode', 'message', 'data'],
        properties: {
          statusCode: { type: 'number', example: status },
          message: { type: 'string', example: DEFAULT_SUCCESS_MESSAGE },
          data: dataSchema,
          ...(options.paginated
            ? { meta: { $ref: getSchemaPath(PaginationMetaDto) } }
            : {}),
        },
      },
    }),
  );
}
