import { Injectable } from '@nestjs/common';
import { Prisma, type RolePermission } from '../../generated/prisma/client';
import { PrismaService } from '../persistence/prisma/prisma.service';

export type RolePermissionWithPermission = Prisma.RolePermissionGetPayload<{
  include: { permission: true };
}>;

@Injectable()
export class RolePermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByRoleId(roleId: string): Promise<RolePermission[]> {
    return this.prisma.rolePermission.findMany({
      where: { roleId },
      orderBy: { grantedAt: 'asc' },
    });
  }

  findActivePermissionsByRoleIds(
    roleIds: string[],
  ): Promise<RolePermissionWithPermission[]> {
    if (roleIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.prisma.rolePermission.findMany({
      where: {
        roleId: { in: roleIds },
        permission: { isActive: true },
      },
      include: { permission: true },
      orderBy: { grantedAt: 'asc' },
    });
  }

  grant(
    data: Prisma.RolePermissionUncheckedCreateInput,
  ): Promise<RolePermission> {
    return this.prisma.rolePermission.create({ data });
  }
}
