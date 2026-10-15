import type { AuthenticatedPrincipal } from './authenticated-principal.interface';

/**
 * Mở rộng ngoài RBAC (ownership, assignment, bước workflow).
 * Policy cụ thể thuộc business service sở hữu tài nguyên — Phase 3.5 không triển khai.
 */
export interface ResourceAccessPolicy<TResource = unknown> {
  canAccess(
    principal: AuthenticatedPrincipal,
    resource: TResource,
  ): boolean | Promise<boolean>;
}
