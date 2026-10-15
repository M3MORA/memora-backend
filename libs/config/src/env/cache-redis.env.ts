import { Expose } from 'class-transformer';
import { registerAs } from '@nestjs/config';
import {
  EnvHostname,
  EnvNonEmptyText,
  EnvPort,
  EnvRedisDb,
  EnvSecret,
} from '../validation/env-constraints';
import { validateEnv } from '../validation/validate-env';
import {
  defaultRedisLogicalDb,
  parseRedisClusterFlag,
  type RedisEndpointConfig,
} from './redis-endpoint';

export class CacheRedisEnvironment {
  @Expose()
  @EnvHostname()
  CACHE_REDIS_HOST!: string;

  @Expose()
  @EnvPort()
  CACHE_REDIS_PORT!: number;

  @Expose()
  @EnvSecret(16)
  CACHE_REDIS_PASSWORD!: string;

  @Expose()
  @EnvRedisDb()
  CACHE_REDIS_DB!: number;

  @Expose()
  @EnvNonEmptyText(64)
  CACHE_KEY_PREFIX!: string;
}

export type CacheRedisEnv = RedisEndpointConfig & {
  keyPrefix: string;
};

export function validateCacheRedisEnv(
  source: NodeJS.ProcessEnv | Record<string, unknown>,
): CacheRedisEnv {
  const cluster = parseRedisClusterFlag(source.CACHE_REDIS_CLUSTER);
  const rawDb = source.CACHE_REDIS_DB;
  const rawPrefix = source.CACHE_KEY_PREFIX;
  const validated = validateEnv(CacheRedisEnvironment, {
    ...source,
    CACHE_REDIS_DB:
      rawDb === undefined || rawDb === null || rawDb === ''
        ? defaultRedisLogicalDb(cluster, 1)
        : rawDb,
    CACHE_KEY_PREFIX:
      rawPrefix === undefined || rawPrefix === null || rawPrefix === ''
        ? 'memora:cache'
        : rawPrefix,
  });

  if (cluster && validated.CACHE_REDIS_DB !== 0) {
    throw new Error(
      'Environment validation failed: CACHE_REDIS_DB must be 0 when CACHE_REDIS_CLUSTER=true',
    );
  }

  return {
    host: validated.CACHE_REDIS_HOST,
    port: validated.CACHE_REDIS_PORT,
    password: validated.CACHE_REDIS_PASSWORD,
    db: validated.CACHE_REDIS_DB,
    cluster,
    keyPrefix: validated.CACHE_KEY_PREFIX,
  };
}

export const cacheRedisConfig = registerAs('cacheRedis', () => {
  const env = validateCacheRedisEnv(process.env);
  return {
    host: env.host,
    port: env.port,
    password: env.password,
    db: env.db,
    cluster: env.cluster,
    keyPrefix: env.keyPrefix,
  };
});
