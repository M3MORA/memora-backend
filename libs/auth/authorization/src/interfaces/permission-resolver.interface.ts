import type { AuthenticatedPrincipal } from './authenticated-principal.interface';

/**
 * Nguồn quyền hiện hành (IAM gRPC CheckRoles / CheckPermissions).
 * Không đọc JWT claims. Fail closed khi nguồn không khả dụng.
 */
export interface PermissionResolver {
  hasAnyRole(
    principal: AuthenticatedPrincipal,
    roleCodes: readonly string[],
  ): Promise<boolean>;
  hasAllPermissions(
    principal: AuthenticatedPrincipal,
    permissionCodes: readonly string[],
  ): Promise<boolean>;
}
