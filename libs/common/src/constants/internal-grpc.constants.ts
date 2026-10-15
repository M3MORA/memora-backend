/**
 * Metadata xác thực caller nội bộ Gateway → IAM.
 * Không dùng IAM JWT HS256 secret. Giá trị nằm ở ENV IAM_INTERNAL_GRPC_SECRET.
 */
export const INTERNAL_GRPC_AUTH_METADATA_KEY = 'x-memora-internal-token';
