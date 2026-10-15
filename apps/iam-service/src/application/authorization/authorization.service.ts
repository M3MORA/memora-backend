import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Permission, Role, User } from '../../../generated/prisma/client';
import { RolePermissionRepository } from '../../repositories/role-permission.repository';
import { UserRoleRepository } from '../../repositories/user-role.repository';
import { UserRepository } from '../../repositories/user.repository';
import { isActiveUserStatus } from '../constants/iam-status';

export type EffectiveAuthorization = {
  userId: string;
  roles: Role[];
  roleCodes: string[];
  permissions: Permission[];
  permissionCodes: string[];
};

const EMPTY_AUTHORIZATION: Omit<EffectiveAuthorization, 'userId'> = {
  roles: [],
  roleCodes: [],
  permissions: [],
  permissionCodes: [],
};

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly users: UserRepository,
    private readonly userRoles: UserRoleRepository,
    private readonly rolePermissions: RolePermissionRepository,
  ) {}

  async getAccountStatus(userId: string): Promise<string | null> {
    const user = await this.users.findById(userId);
    return user?.status ?? null;
  }

  async canPerformProtectedActions(userId: string): Promise<boolean> {
    const user = await this.loadUser(userId);
    return user !== null && isActiveUserStatus(user.status);
  }

  async assertCanPerformProtectedActions(userId: string): Promise<void> {
    const allowed = await this.canPerformProtectedActions(userId);
    if (!allowed) {
      throw new ForbiddenException();
    }
  }

  async getActiveRoles(userId: string): Promise<Role[]> {
    const access = await this.getEffectiveAuthorization(userId);
    return access.roles;
  }

  async getActivePermissions(userId: string): Promise<Permission[]> {
    const access = await this.getEffectiveAuthorization(userId);
    return access.permissions;
  }

  async hasRole(userId: string, roleCode: string): Promise<boolean> {
    const access = await this.getEffectiveAuthorization(userId);
    return access.roleCodes.includes(roleCode);
  }

  async hasAnyRole(userId: string, roleCodes: string[]): Promise<boolean> {
    const access = await this.getEffectiveAuthorization(userId);
    return roleCodes.some((code) => access.roleCodes.includes(code));
  }

  async hasPermission(
    userId: string,
    permissionCode: string,
  ): Promise<boolean> {
    const access = await this.getEffectiveAuthorization(userId);
    return access.permissionCodes.includes(permissionCode);
  }

  async hasAllPermissions(
    userId: string,
    permissionCodes: string[],
  ): Promise<boolean> {
    const uniqueCodes = [...new Set(permissionCodes)];
    if (uniqueCodes.length === 0) {
      return false;
    }
    const access = await this.getEffectiveAuthorization(userId);
    return uniqueCodes.every((code) => access.permissionCodes.includes(code));
  }

  async getEffectiveAuthorization(
    userId: string,
  ): Promise<EffectiveAuthorization> {
    const user = await this.loadUser(userId);
    if (user === null || !isActiveUserStatus(user.status)) {
      return { userId, ...EMPTY_AUTHORIZATION };
    }

    const assignments = await this.userRoles.findActiveWithRoleByUserId(userId);
    const roles = assignments.map((assignment) => assignment.role);
    if (roles.length === 0) {
      return { userId, ...EMPTY_AUTHORIZATION };
    }

    const grants = await this.rolePermissions.findActivePermissionsByRoleIds(
      roles.map((role) => role.id),
    );
    const permissionsByCode = new Map<string, Permission>();
    for (const grant of grants) {
      permissionsByCode.set(grant.permission.code, grant.permission);
    }

    const permissions = [...permissionsByCode.values()];
    return {
      userId,
      roles,
      roleCodes: roles.map((role) => role.code),
      permissions,
      permissionCodes: permissions.map((permission) => permission.code),
    };
  }

  private loadUser(userId: string): Promise<User | null> {
    return this.users.findById(userId);
  }
}
