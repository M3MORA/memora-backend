import { Injectable } from '@nestjs/common';
import { Prisma, type CustomerIdentity } from '../../generated/prisma/client';
import { PrismaService } from '../persistence/prisma/prisma.service';

@Injectable()
export class CustomerIdentityRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<CustomerIdentity | null> {
    return this.prisma.customerIdentity.findUnique({
      where: { id },
    });
  }

  findByUserId(userId: string): Promise<CustomerIdentity[]> {
    return this.prisma.customerIdentity.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  findPrimaryByUserId(userId: string): Promise<CustomerIdentity | null> {
    return this.prisma.customerIdentity.findFirst({
      where: {
        userId,
        isPrimaryForUser: true,
      },
    });
  }

  create(
    data: Prisma.CustomerIdentityUncheckedCreateInput,
  ): Promise<CustomerIdentity> {
    return this.prisma.customerIdentity.create({ data });
  }

  updateById(
    id: string,
    data: Prisma.CustomerIdentityUncheckedUpdateInput,
  ): Promise<CustomerIdentity> {
    return this.prisma.customerIdentity.update({
      where: { id },
      data,
    });
  }
}
