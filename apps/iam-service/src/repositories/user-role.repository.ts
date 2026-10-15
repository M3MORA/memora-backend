import { Injectable } from '@nestjs/common';
import { Prisma, type UserRole } from '../../generated/prisma/client';
import { PrismaService } from '../persistence/prisma/prisma.service';

export type UserRoleWithRole = Prisma.UserRoleGetPayload<{
  include: { role: true };
}>;

@Injectable()
export class UserRoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveByUserId(userId: string): Promise<UserRole[]> {
    return this.prisma.userRole.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      orderBy: { assignedAt: 'asc' },
    });
  }

  findActiveWithRoleByUserId(userId: string): Promise<UserRoleWithRole[]> {
    return this.prisma.userRole.findMany({
      where: {
        userId,
        revokedAt: null,
        role: { isActive: true },
      },
      include: { role: true },
      orderBy: { assignedAt: 'asc' },
    });
  }

  findHistoryByUserId(userId: string): Promise<UserRole[]> {
    return this.prisma.userRole.findMany({
      where: { userId },
      orderBy: { assignedAt: 'desc' },
    });
  }

  findActiveByUserAndRole(
    userId: string,
    roleId: string,
  ): Promise<UserRole | null> {
    return this.prisma.userRole.findFirst({
      where: {
        userId,
        roleId,
        revokedAt: null,
      },
    });
  }

  assign(data: Prisma.UserRoleUncheckedCreateInput): Promise<UserRole> {
    return this.prisma.userRole.create({ data });
  }

  revoke(id: string, revokeReason?: string): Promise<UserRole> {
    return this.prisma.userRole.update({
      where: { id },
      data: {
        revokedAt: new Date(),
        revokeReason: revokeReason ?? null,
      },
    });
  }
}
