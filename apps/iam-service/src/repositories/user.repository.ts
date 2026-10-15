import { Injectable } from '@nestjs/common';
import { Prisma, type User } from '../../generated/prisma/client';
import { PrismaService } from '../persistence/prisma/prisma.service';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  findByGoogleSub(googleSub: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { googleSub },
    });
  }

  create(data: Prisma.UserUncheckedCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  createWithRoleAssignment(
    data: Prisma.UserUncheckedCreateInput,
    roleId: string,
  ): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data });
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId,
        },
      });
      return user;
    });
  }

  updateById(id: string, data: Prisma.UserUncheckedUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }
}
