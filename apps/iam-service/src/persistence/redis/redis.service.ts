import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(configService: ConfigService) {
    this.client = new Redis({
      host: configService.getOrThrow<string>('iam.redisHost'),
      port: configService.getOrThrow<number>('iam.redisPort'),
      password: configService.getOrThrow<string>('iam.redisPassword'),
      db: configService.getOrThrow<number>('iam.redisDb'),
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
      await this.client.ping();
    } catch {
      this.logger.error('IAM Redis connection failed');
      throw new ServiceUnavailableException('Session store unavailable');
    }

    this.logger.log('IAM Redis connected');
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}
