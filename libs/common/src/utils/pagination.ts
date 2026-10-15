import type { PaginationMeta } from '../interfaces/api-response.interface';

/** page/limit đã chuẩn hóa. Không import @app/contracts từ libs/common. */
export interface PaginationParams {
  page: number;
  limit: number;
}

export const DEFAULT_PAGINATION_PAGE = 1;
export const DEFAULT_PAGINATION_LIMIT = 10;
export const MAX_PAGINATION_LIMIT = 100;

/** int64 sau proto-loader (`longs: String`) hoặc Long-like. */
export type GrpcInt64 = number | string | { toString(): string };

/** Pagination trên wire trước khi chuẩn hóa sang contract. */
export interface GrpcPaginationWire {
  page: number;
  limit: number;
  total: GrpcInt64;
  totalPages?: number;
}

export function isValidPagination(page: number, limit: number): boolean {
  return (
    Number.isInteger(page) &&
    Number.isInteger(limit) &&
    Number.isSafeInteger(page) &&
    Number.isSafeInteger(limit) &&
    page >= 1 &&
    limit >= 1 &&
    limit <= MAX_PAGINATION_LIMIT
  );
}

export function assertPagination(page: number, limit: number): void {
  if (!isValidPagination(page, limit)) {
    throw new RangeError(
      `Invalid pagination: page must be an integer >= 1 and limit an integer from 1 to ${MAX_PAGINATION_LIMIT}`,
    );
  }
}

/**
 * Default chỉ khi `page`/`limit` là `undefined` (hoặc cả object thiếu).
 * Không đổi 0 / âm / decimal thành default — đó là dữ liệu sai.
 */
export function normalizePagination(
  input?: Partial<PaginationParams> | null,
): PaginationParams {
  const page = input?.page === undefined ? DEFAULT_PAGINATION_PAGE : input.page;
  const limit =
    input?.limit === undefined ? DEFAULT_PAGINATION_LIMIT : input.limit;
  assertPagination(page, limit);
  return { page, limit };
}

export function getPaginationOffset(
  page: number,
  limit: number,
): { skip: number; take: number } {
  assertPagination(page, limit);
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip)) {
    throw new RangeError('Pagination offset exceeds Number.MAX_SAFE_INTEGER');
  }
  return { skip, take: limit };
}

export function computeTotalPages(total: number, limit: number): number {
  if (total <= 0 || limit <= 0) {
    return 0;
  }
  return Math.ceil(total / limit);
}

export function toSafeInt64(value: GrpcInt64): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new TypeError('gRPC int64 must be a finite integer');
    }
    if (!Number.isSafeInteger(value)) {
      throw new RangeError('gRPC int64 exceeds Number.MAX_SAFE_INTEGER');
    }
    return value;
  }

  const raw = typeof value === 'string' ? value : value.toString();
  if (!/^-?\d+$/.test(raw)) {
    throw new TypeError('gRPC int64 must be an integer string');
  }

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) {
    throw new RangeError('gRPC int64 exceeds Number.MAX_SAFE_INTEGER');
  }
  return parsed;
}

export function toPaginationMeta(
  pagination: GrpcPaginationWire,
): PaginationMeta {
  const page = pagination.page;
  const limit = pagination.limit;
  const total = toSafeInt64(pagination.total);
  const totalPages = pagination.totalPages ?? computeTotalPages(total, limit);

  return { page, limit, total, totalPages };
}
