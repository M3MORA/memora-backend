import { Injectable } from '@nestjs/common';
import { Prisma, type Permission } from '../../generated/prisma/client';
import { PrismaService } from '../persistence/prisma/prisma.service';

@Injectable()
export class PermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Permission | null> {
    return this.prisma.permission.findUnique({
      where: { id },
    });
  }

  findByCode(code: string): Promise<Permission | null> {
    return this.prisma.permission.findUnique({
      where: { code },
    });
  }

  findActiveByIds(ids: string[]): Promise<Permission[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }

    return this.prisma.permission.findMany({
      where: {
        id: { in: ids },
        isActive: true,
      },
    });
  }

  create(data: Prisma.PermissionUncheckedCreateInput): Promise<Permission> {
    return this.prisma.permission.create({ data });
  }
}
