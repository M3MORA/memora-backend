/**
 * Metadata keys cho RBAC. Khớp `AUTH_METADATA.ROLES` / `PERMISSIONS` trong
 * `@app/common` để decorator cũ và Guard mới đọc cùng một key.
 *
 * - Không có metadata: Guard RBAC bỏ qua (không thay Authentication).
 * - `ROLES`: ANY — chỉ cần một role khớp.
 * - `PERMISSIONS`: ALL — phải có mọi permission khai báo.
 * - Có cả hai: phải thỏa cả hai Guard (AND giữa nhóm).
 */
export const AUTHORIZATION_METADATA = {
  ROLES: 'auth:roles',
  PERMISSIONS: 'auth:permissions',
} as const;

export const PRINCIPAL_RESOLVER = Symbol('AUTHORIZATION_PRINCIPAL_RESOLVER');
export const PERMISSION_RESOLVER = Symbol('AUTHORIZATION_PERMISSION_RESOLVER');
