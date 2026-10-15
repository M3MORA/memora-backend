import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AUTHORIZATION_METADATA,
  PERMISSION_RESOLVER,
  PRINCIPAL_RESOLVER,
} from '../constants/authorization.constants';
import type { PermissionResolver } from '../interfaces/permission-resolver.interface';
import type { PrincipalResolver } from '../interfaces/principal-resolver.interface';
import { resolveAuthorizationSource } from './fail-closed';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(PRINCIPAL_RESOLVER)
    private readonly principals: PrincipalResolver,
    @Inject(PERMISSION_RESOLVER)
    private readonly authorization: PermissionResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      AUTHORIZATION_METADATA.ROLES,
      [context.getHandler(), context.getClass()],
    );
    if (required === undefined) {
      return true;
    }

    const principal = await resolveAuthorizationSource(() =>
      Promise.resolve(this.principals.resolve(context)),
    );
    if (principal === null) {
      throw new UnauthorizedException();
    }

    const allowed = await resolveAuthorizationSource(() =>
      this.authorization.hasAnyRole(principal, required),
    );
    if (!allowed) {
      throw new ForbiddenException();
    }

    return true;
  }
}
