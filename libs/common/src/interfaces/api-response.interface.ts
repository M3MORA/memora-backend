export const DEFAULT_SUCCESS_MESSAGE = 'SUCCESS';

export const API_SUCCESS_ENVELOPE = Symbol.for('memora.apiSuccessEnvelope');

export interface PaginationMeta {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages?: number;
}

export interface ApiResponse<T> {
  readonly statusCode: number;
  readonly message: string;
  readonly data: T;
  readonly meta?: PaginationMeta;
}

export interface SuccessResponseOptions {
  readonly message?: string;
  readonly meta?: PaginationMeta;
}

/**
 * Contract tường minh khi controller muốn đổi message hoặc gắn pagination meta.
 * Interceptor nhận diện bằng `instanceof`, không đoán từ field `message`/`data`.
 */
export class SuccessResponse<T> {
  constructor(
    readonly data: T,
    readonly options: SuccessResponseOptions = {},
  ) {}
}

export type ApiSuccessEnvelope<T> = ApiResponse<T> & {
  readonly [API_SUCCESS_ENVELOPE]: true;
};

export function isSuccessResponse(
  value: unknown,
): value is SuccessResponse<unknown> {
  return value instanceof SuccessResponse;
}

export function isApiSuccessEnvelope(
  value: unknown,
): value is ApiSuccessEnvelope<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    API_SUCCESS_ENVELOPE in value &&
    (value as { [API_SUCCESS_ENVELOPE]?: unknown })[API_SUCCESS_ENVELOPE] ===
      true
  );
}
