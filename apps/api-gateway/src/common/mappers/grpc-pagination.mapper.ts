import type { GrpcPaginationRequest } from '@app/contracts';
import type { PaginationQueryDto } from '../dto/pagination-query.dto';

export function toGrpcPagination(
  query: Pick<PaginationQueryDto, 'page' | 'limit'>,
): GrpcPaginationRequest {
  return {
    page: query.page,
    limit: query.limit,
  };
}
