/**
 * Identity đã được Authentication xác minh.
 * `roles` / `permissions` nếu có chỉ là hint — Guard RBAC không được tin,
 * phải resolve quyền hiện hành qua PermissionResolver.
 */
export interface AuthenticatedPrincipal {
  readonly userId: string;
  readonly roles?: readonly string[];
  readonly permissions?: readonly string[];
}
