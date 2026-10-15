import { Expose } from 'class-transformer';
import { registerAs } from '@nestjs/config';
import {
  EnvDurationSeconds,
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

export class QueueRedisEnvironment {
  @Expose()
  @EnvHostname()
  QUEUE_REDIS_HOST!: string;

  @Expose()
  @EnvPort()
  QUEUE_REDIS_PORT!: number;

  @Expose()
  @EnvSecret(16)
  QUEUE_REDIS_PASSWORD!: string;

  @Expose()
  @EnvRedisDb()
  QUEUE_REDIS_DB!: number;

  @Expose()
  @EnvNonEmptyText(64)
  QUEUE_PREFIX!: string;

  @Expose()
  @EnvDurationSeconds(1, 10)
  QUEUE_DEFAULT_ATTEMPTS!: number;

  @Expose()
  @EnvDurationSeconds(100, 60_000)
  QUEUE_DEFAULT_BACKOFF_MS!: number;
}

export type QueueRedisEnv = RedisEndpointConfig & {
  prefix: string;
  defaultAttempts: number;
  defaultBackoffMs: number;
};

export function validateQueueRedisEnv(
  source: NodeJS.ProcessEnv | Record<string, unknown>,
): QueueRedisEnv {
  const cluster = parseRedisClusterFlag(source.QUEUE_REDIS_CLUSTER);
  const rawDb = source.QUEUE_REDIS_DB;
  const rawPrefix = source.QUEUE_PREFIX;
  const rawAttempts = source.QUEUE_DEFAULT_ATTEMPTS;
  const rawBackoff = source.QUEUE_DEFAULT_BACKOFF_MS;
  const validated = validateEnv(QueueRedisEnvironment, {
    ...source,
    QUEUE_REDIS_DB:
      rawDb === undefined || rawDb === null || rawDb === ''
        ? defaultRedisLogicalDb(cluster, 2)
        : rawDb,
    QUEUE_PREFIX:
      rawPrefix === undefined || rawPrefix === null || rawPrefix === ''
        ? 'memora:bull'
        : rawPrefix,
    QUEUE_DEFAULT_ATTEMPTS:
      rawAttempts === undefined || rawAttempts === null || rawAttempts === ''
        ? 3
        : rawAttempts,
    QUEUE_DEFAULT_BACKOFF_MS:
      rawBackoff === undefined || rawBackoff === null || rawBackoff === ''
        ? 1000
        : rawBackoff,
  });

  if (cluster && validated.QUEUE_REDIS_DB !== 0) {
    throw new Error(
      'Environment validation failed: QUEUE_REDIS_DB must be 0 when QUEUE_REDIS_CLUSTER=true',
    );
  }

  return {
    host: validated.QUEUE_REDIS_HOST,
    port: validated.QUEUE_REDIS_PORT,
    password: validated.QUEUE_REDIS_PASSWORD,
    db: validated.QUEUE_REDIS_DB,
    cluster,
    prefix: validated.QUEUE_PREFIX,
    defaultAttempts: validated.QUEUE_DEFAULT_ATTEMPTS,
    defaultBackoffMs: validated.QUEUE_DEFAULT_BACKOFF_MS,
  };
}

export const queueRedisConfig = registerAs('queueRedis', () => {
  const env = validateQueueRedisEnv(process.env);
  return {
    host: env.host,
    port: env.port,
    password: env.password,
    db: env.db,
    cluster: env.cluster,
    prefix: env.prefix,
    defaultAttempts: env.defaultAttempts,
    defaultBackoffMs: env.defaultBackoffMs,
  };
});
