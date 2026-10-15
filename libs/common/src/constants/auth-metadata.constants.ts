/**
 * Metadata keys cho authentication/authorization.
 * Guards sau này chỉ đọc các key này qua Reflector, ưu tiên
 * `getAllAndOverride(key, [handler, controller])` để method ghi đè controller.
 *
 * Quy ước khi global guards được gắn:
 * - `PUBLIC`: endpoint không yêu cầu user authentication.
 * - `ROLES`: OR. User chỉ cần một role trong danh sách.
 * - `PERMISSIONS`: AND. User phải có mọi permission được khai báo.
 * - Có cả ROLES và PERMISSIONS: phải thỏa cả hai nhóm.
 * - Không gắn decorator: yêu cầu authentication. Không có cơ chế default-public.
 */
export const AUTH_METADATA = {
  PUBLIC: 'auth:public',
  ROLES: 'auth:roles',
  PERMISSIONS: 'auth:permissions',
} as const;

export type AuthMetadataKey =
  (typeof AUTH_METADATA)[keyof typeof AUTH_METADATA];
