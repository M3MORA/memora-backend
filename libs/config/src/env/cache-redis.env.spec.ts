import { validateCacheRedisEnv } from './cache-redis.env';
import { validateQueueRedisEnv } from './queue-redis.env';

const cacheSource = {
  CACHE_REDIS_HOST: '127.0.0.1',
  CACHE_REDIS_PORT: '6379',
  CACHE_REDIS_PASSWORD: 'cache-redis-password-ok',
  CACHE_REDIS_DB: '1',
};

const queueSource = {
  QUEUE_REDIS_HOST: '127.0.0.1',
  QUEUE_REDIS_PORT: '6379',
  QUEUE_REDIS_PASSWORD: 'queue-redis-password-ok',
  QUEUE_REDIS_DB: '2',
};

describe('cache and queue redis env', () => {
  it('accepts valid cache redis env', () => {
    expect(validateCacheRedisEnv(cacheSource)).toEqual({
      host: '127.0.0.1',
      port: 6379,
      password: 'cache-redis-password-ok',
      db: 1,
      cluster: false,
      keyPrefix: 'memora:cache',
    });
  });

  it('rejects missing cache redis password', () => {
    expect(() =>
      validateCacheRedisEnv({
        CACHE_REDIS_HOST: '127.0.0.1',
        CACHE_REDIS_PORT: '6379',
      }),
    ).toThrow(/Environment validation failed/);
  });

  it('rejects invalid cache redis port', () => {
    expect(() =>
      validateCacheRedisEnv({
        ...cacheSource,
        CACHE_REDIS_PORT: '70000',
      }),
    ).toThrow(/Environment validation failed/);
  });

  it('defaults queue prefix attempts and backoff', () => {
    expect(validateQueueRedisEnv(queueSource)).toMatchObject({
      db: 2,
      prefix: 'memora:bull',
      defaultAttempts: 3,
      defaultBackoffMs: 1000,
    });
  });

  it('requires cache db 0 on Redis Cluster', () => {
    expect(
      validateCacheRedisEnv({
        ...cacheSource,
        CACHE_REDIS_CLUSTER: 'true',
        CACHE_REDIS_DB: '0',
      }).cluster,
    ).toBe(true);
    expect(() =>
      validateCacheRedisEnv({
        ...cacheSource,
        CACHE_REDIS_CLUSTER: 'true',
        CACHE_REDIS_DB: '1',
      }),
    ).toThrow(/CACHE_REDIS_DB must be 0/);
  });

  it('rejects invalid queue attempts', () => {
    expect(() =>
      validateQueueRedisEnv({
        ...queueSource,
        QUEUE_DEFAULT_ATTEMPTS: '99',
      }),
    ).toThrow(/Environment validation failed/);
  });
});
