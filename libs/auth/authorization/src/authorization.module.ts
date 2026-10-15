import { type DynamicModule, Module, type Type } from '@nestjs/common';
import {
  PERMISSION_RESOLVER,
  PRINCIPAL_RESOLVER,
} from './constants/authorization.constants';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import type { PermissionResolver } from './interfaces/permission-resolver.interface';
import type { PrincipalResolver } from './interfaces/principal-resolver.interface';

export type AuthorizationModuleOptions = {
  principalResolver: Type<PrincipalResolver>;
  permissionResolver: Type<PermissionResolver>;
  imports?: DynamicModule['imports'];
};

@Module({})
export class AuthorizationModule {
  static forRoot(options: AuthorizationModuleOptions): DynamicModule {
    return {
      module: AuthorizationModule,
      imports: [...(options.imports ?? [])],
      providers: [
        {
          provide: PRINCIPAL_RESOLVER,
          useClass: options.principalResolver,
        },
        {
          provide: PERMISSION_RESOLVER,
          useClass: options.permissionResolver,
        },
        RolesGuard,
        PermissionsGuard,
      ],
      exports: [
        PRINCIPAL_RESOLVER,
        PERMISSION_RESOLVER,
        RolesGuard,
        PermissionsGuard,
      ],
    };
  }
}
