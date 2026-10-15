import { Injectable } from '@nestjs/common';
import { Prisma, type Role } from '../../generated/prisma/client';
import { PrismaService } from '../persistence/prisma/prisma.service';

@Injectable()
export class RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Role | null> {
    return this.prisma.role.findUnique({
      where: { id },
    });
  }

  findByCode(code: string): Promise<Role | null> {
    return this.prisma.role.findUnique({
      where: { code },
    });
  }

  findActiveByIds(ids: string[]): Promise<Role[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }

    return this.prisma.role.findMany({
      where: {
        id: { in: ids },
        isActive: true,
      },
    });
  }

  create(data: Prisma.RoleUncheckedCreateInput): Promise<Role> {
    return this.prisma.role.create({ data });
  }
}
