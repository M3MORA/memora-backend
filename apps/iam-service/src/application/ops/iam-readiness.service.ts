import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../persistence/prisma/prisma.service';
import { RedisService } from '../../persistence/redis/redis.service';

@Injectable()
export class IamReadinessService {
  private readonly logger = new Logger(IamReadinessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async isReady(): Promise<boolean> {
    const postgres = await this.pingPostgres();
    const redis = await this.pingRedis();
    return postgres && redis;
  }

  async pingPostgres(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      this.logger.warn('PostgreSQL readiness probe failed');
      return false;
    }
  }

  async pingRedis(): Promise<boolean> {
    try {
      const pong = await this.redis.getClient().ping();
      return pong === 'PONG';
    } catch {
      this.logger.warn('Redis readiness probe failed');
      return false;
    }
  }
}
