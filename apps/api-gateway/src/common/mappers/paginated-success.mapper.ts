import { SuccessResponse, toPaginationMeta } from '@app/common';
import type { PaginatedGrpcResult } from '@app/contracts';

export function toPaginatedSuccessResponse<T>(
  result: PaginatedGrpcResult<T>,
  message?: string,
): SuccessResponse<T[]> {
  return new SuccessResponse(result.data, {
    ...(message === undefined ? {} : { message }),
    meta: toPaginationMeta(result.pagination),
  });
}
