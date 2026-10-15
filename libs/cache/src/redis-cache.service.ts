import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { redisStandaloneConnectionFields } from '@app/config';
import Redis from 'ioredis';
import { buildCacheRedisKey } from './cache-key';
import {
  CACHE_TTL_SECONDS_MAX,
  CACHE_TTL_SECONDS_MIN,
  DEFAULT_CACHE_KEY_PREFIX,
  REDIS_CACHE_OPTIONS,
} from './redis-cache.constants';
import type { RedisCacheModuleOptions } from './redis-cache.interfaces';

const CACHE_UNAVAILABLE = 'Cache unavailable';

@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly client: Redis;
  private readonly namespace: string;
  private readonly keyPrefix: string;
  private readonly optional: boolean;

  constructor(
    @Inject(REDIS_CACHE_OPTIONS)
    private readonly options: RedisCacheModuleOptions,
  ) {
    this.namespace = options.namespace;
    this.keyPrefix = options.keyPrefix ?? DEFAULT_CACHE_KEY_PREFIX;
    this.optional = options.availability === 'optional';
    this.client =
      options.createClient === undefined
        ? new Redis({
            ...redisStandaloneConnectionFields({
              host: options.host,
              port: options.port,
              password: options.password,
              db: options.db,
              cluster: options.cluster === true,
            }),
            maxRetriesPerRequest: 2,
            enableOfflineQueue: false,
            lazyConnect: true,
            connectTimeout: 1500,
            retryStrategy: this.optional ? () => null : undefined,
          })
        : options.createClient();
  }

  async onModuleInit(): Promise<void> {
    try {
      if (this.client.status === 'wait') {
        await this.client.connect();
      }
      await this.client.ping();
      this.logger.log(
        `Cache Redis connected namespace=${this.namespace} db=${this.options.db}`,
      );
    } catch {
      this.logger.error(
        `Cache Redis connection failed namespace=${this.namespace}`,
      );
      if (!this.optional) {
        throw new ServiceUnavailableException(CACHE_UNAVAILABLE);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const redisKey = this.redisKey(key);
    try {
      const raw = await this.client.get(redisKey);
      if (raw === null) {
        return null;
      }
      return deserialize<T>(raw);
    } catch (error) {
      return this.onFailure('get', error, null);
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    assertTtlSeconds(ttlSeconds);
    const redisKey = this.redisKey(key);
    try {
      await this.client.set(redisKey, serialize(value), 'EX', ttlSeconds);
    } catch (error) {
      this.onFailure('set', error, undefined);
    }
  }

  async delete(key: string): Promise<void> {
    const redisKey = this.redisKey(key);
    try {
      await this.client.del(redisKey);
    } catch (error) {
      this.onFailure('delete', error, undefined);
    }
  }

  async exists(key: string): Promise<boolean> {
    const redisKey = this.redisKey(key);
    try {
      const count = await this.client.exists(redisKey);
      return count === 1;
    } catch (error) {
      return this.onFailure('exists', error, false);
    }
  }

  private redisKey(key: string): string {
    return buildCacheRedisKey(this.keyPrefix, this.namespace, key);
  }

  private onFailure<T>(operation: string, error: unknown, fallback: T): T {
    this.logger.warn(
      `Cache Redis ${operation} failed namespace=${this.namespace}`,
    );
    if (this.optional) {
      return fallback;
    }
    if (error instanceof ServiceUnavailableException) {
      throw error;
    }
    throw new ServiceUnavailableException(CACHE_UNAVAILABLE);
  }
}

function assertTtlSeconds(ttlSeconds: number): void {
  if (
    !Number.isInteger(ttlSeconds) ||
    ttlSeconds < CACHE_TTL_SECONDS_MIN ||
    ttlSeconds > CACHE_TTL_SECONDS_MAX
  ) {
    throw new Error(
      `Cache TTL must be an integer between ${CACHE_TTL_SECONDS_MIN} and ${CACHE_TTL_SECONDS_MAX} seconds`,
    );
  }
}

function serialize<T>(value: T): string {
  return JSON.stringify(value);
}

function deserialize<T>(raw: string): T {
  return JSON.parse(raw) as T;
}
