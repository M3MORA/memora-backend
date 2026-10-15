/**
 * Contract TypeScript khớp proto/common/v1/pagination.proto (memora.common.v1).
 * Chỉ định nghĩa shape giao tiếp giữa các service. Không chứa logic tính/chuyển.
 */

/** Khớp proto `PaginationRequest`. proto-loader: camelCase, int32 → number. */
export interface GrpcPaginationRequest {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedGrpcResult<T> {
  data: T[];
  pagination: PaginationMeta;
}
