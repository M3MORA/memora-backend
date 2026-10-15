import { Module } from '@nestjs/common';
import { PrismaModule } from '../persistence/prisma/prisma.module';
import { CustomerIdentityRepository } from './customer-identity.repository';
import { PermissionRepository } from './permission.repository';
import { RolePermissionRepository } from './role-permission.repository';
import { RoleRepository } from './role.repository';
import { UserRoleRepository } from './user-role.repository';
import { UserRepository } from './user.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    UserRepository,
    CustomerIdentityRepository,
    RoleRepository,
    PermissionRepository,
    UserRoleRepository,
    RolePermissionRepository,
  ],
  exports: [
    UserRepository,
    CustomerIdentityRepository,
    RoleRepository,
    PermissionRepository,
    UserRoleRepository,
    RolePermissionRepository,
  ],
})
export class RepositoriesModule {}
