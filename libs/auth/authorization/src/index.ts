export { AuthorizationModule } from './authorization.module';
export type { AuthorizationModuleOptions } from './authorization.module';
export {
  AUTHORIZATION_METADATA,
  PERMISSION_RESOLVER,
  PRINCIPAL_RESOLVER,
} from './constants/authorization.constants';
export { RequirePermissions } from './decorators/permissions.decorator';
export { Roles } from './decorators/roles.decorator';
export { PermissionsGuard } from './guards/permissions.guard';
export { RolesGuard } from './guards/roles.guard';
export type { AuthenticatedPrincipal } from './interfaces/authenticated-principal.interface';
export type { PermissionResolver } from './interfaces/permission-resolver.interface';
export type { PrincipalResolver } from './interfaces/principal-resolver.interface';
export type { ResourceAccessPolicy } from './interfaces/resource-access-policy.interface';
