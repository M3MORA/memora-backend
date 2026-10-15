import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  DEFAULT_PAGINATION_LIMIT,
  DEFAULT_PAGINATION_PAGE,
  MAX_PAGINATION_LIMIT,
} from '@app/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    default: DEFAULT_PAGINATION_PAGE,
    minimum: 1,
    type: Number,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = DEFAULT_PAGINATION_PAGE;

  @ApiPropertyOptional({
    description: `Page size (1–${MAX_PAGINATION_LIMIT})`,
    default: DEFAULT_PAGINATION_LIMIT,
    minimum: 1,
    maximum: MAX_PAGINATION_LIMIT,
    type: Number,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGINATION_LIMIT)
  limit: number = DEFAULT_PAGINATION_LIMIT;
}
