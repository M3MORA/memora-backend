import { loadEnvFile } from '@app/config';
import Redis from 'ioredis';
import { RedisCacheService } from './redis-cache.service';

loadEnvFile();

const host =
  process.env.CACHE_REDIS_HOST ?? process.env.IAM_REDIS_HOST ?? '127.0.0.1';
const port = Number(
  process.env.CACHE_REDIS_PORT ?? process.env.IAM_REDIS_PORT ?? '6379',
);
const password = process.env.CACHE_REDIS_PASSWORD ?? process.env.REDIS_PASSWORD;
const db = Number(process.env.CACHE_REDIS_DB ?? '1');
const live =
  process.env.MEMORA_REDIS_TEST === '1' &&
  typeof password === 'string' &&
  password.length >= 16;

const describeLive = live ? describe : describe.skip;

describeLive('RedisCacheService live Redis', () => {
  const namespaceA = 'phase311a';
  const namespaceB = 'phase311b';
  const relativeKey = `probe:${Date.now()}`;
  let client: Redis;
  let cacheA: RedisCacheService;
  let cacheB: RedisCacheService;

  beforeAll(async () => {
    client = new Redis({
      host,
      port,
      password,
      db,
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      connectTimeout: 1500,
    });
    cacheA = new RedisCacheService({
      host,
      port,
      password: password ?? '',
      db,
      namespace: namespaceA,
      createClient: () => client,
    });
    cacheB = new RedisCacheService({
      host,
      port,
      password: password ?? '',
      db,
      namespace: namespaceB,
      createClient: () => client,
    });
    await cacheA.onModuleInit();
  });

  afterAll(async () => {
    await cacheA.delete(relativeKey);
    await cacheB.delete(relativeKey);
    await cacheA.onModuleDestroy();
  });

  it('sets TTL and isolates namespaces without flushdb', async () => {
    await cacheA.set(relativeKey, { ns: 'a' }, 30);
    await expect(cacheA.get<{ ns: string }>(relativeKey)).resolves.toEqual({
      ns: 'a',
    });
    await expect(cacheB.get(relativeKey)).resolves.toBeNull();
    const ttl = await client.ttl(`memora:cache:${namespaceA}:${relativeKey}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(30);
  });

  it('quits an isolated client on graceful shutdown', async () => {
    const shutdownClient = new Redis({
      host,
      port,
      password,
      db,
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      connectTimeout: 1500,
    });
    const shutdownCache = new RedisCacheService({
      host,
      port,
      password: password ?? '',
      db,
      namespace: 'phase311s',
      createClient: () => shutdownClient,
    });
    await shutdownCache.onModuleInit();
    await shutdownCache.onModuleDestroy();
    await expect(shutdownClient.ping()).rejects.toThrow();
  });
});
