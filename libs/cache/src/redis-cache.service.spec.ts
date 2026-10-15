import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RedisCacheModule } from './redis-cache.module';
import { RedisCacheService } from './redis-cache.service';
import type { RedisCacheModuleOptions } from './redis-cache.interfaces';

type Stored = { value: string; ttl?: number };

class FakeRedis {
  status = 'wait';
  readonly store = new Map<string, Stored>();
  failNext = false;
  quitCalled = false;
  disconnectCalled = false;

  async connect(): Promise<void> {
    await Promise.resolve();
    this.status = 'ready';
  }

  async ping(): Promise<string> {
    await Promise.resolve();
    this.throwIfFailed();
    return 'PONG';
  }

  async get(key: string): Promise<string | null> {
    await Promise.resolve();
    this.throwIfFailed();
    return this.store.get(key)?.value ?? null;
  }

  async set(
    key: string,
    value: string,
    _ex: string,
    ttl: number,
  ): Promise<'OK'> {
    await Promise.resolve();
    this.throwIfFailed();
    this.store.set(key, { value, ttl });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    await Promise.resolve();
    this.throwIfFailed();
    return this.store.delete(key) ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    await Promise.resolve();
    this.throwIfFailed();
    return this.store.has(key) ? 1 : 0;
  }

  async quit(): Promise<void> {
    await Promise.resolve();
    this.quitCalled = true;
    this.status = 'end';
  }

  disconnect(): void {
    this.disconnectCalled = true;
  }

  private throwIfFailed(): void {
    if (this.failNext) {
      throw new Error('redis down');
    }
  }
}

function baseOptions(
  client: FakeRedis,
  namespace = 'catalog',
): RedisCacheModuleOptions {
  return {
    host: '127.0.0.1',
    port: 6379,
    password: 'cache-redis-password-ok',
    db: 1,
    namespace,
    availability: 'required',
    createClient: () => client as never,
  };
}

describe('RedisCacheService', () => {
  it('wires DynamicModule DI', async () => {
    const client = new FakeRedis();
    const moduleRef = await Test.createTestingModule({
      imports: [RedisCacheModule.forRoot(baseOptions(client))],
    }).compile();
    const cache = moduleRef.get(RedisCacheService);
    await cache.onModuleInit();
    expect(cache).toBeInstanceOf(RedisCacheService);
    await moduleRef.close();
  });

  it('returns null on miss and value on hit', async () => {
    const client = new FakeRedis();
    const cache = new RedisCacheService(baseOptions(client));
    await cache.onModuleInit();
    await expect(cache.get('product:1')).resolves.toBeNull();
    await cache.set('product:1', { id: '1' }, 60);
    await expect(cache.get<{ id: string }>('product:1')).resolves.toEqual({
      id: '1',
    });
  });

  it('stores TTL on set', async () => {
    const client = new FakeRedis();
    const cache = new RedisCacheService(baseOptions(client));
    await cache.onModuleInit();
    await cache.set('product:1', { id: '1' }, 120);
    const stored = [...client.store.values()][0];
    expect(stored?.ttl).toBe(120);
  });

  it('deletes keys', async () => {
    const client = new FakeRedis();
    const cache = new RedisCacheService(baseOptions(client));
    await cache.onModuleInit();
    await cache.set('product:1', { id: '1' }, 60);
    await expect(cache.exists('product:1')).resolves.toBe(true);
    await cache.delete('product:1');
    await expect(cache.exists('product:1')).resolves.toBe(false);
  });

  it('isolates namespaces', async () => {
    const client = new FakeRedis();
    const catalog = new RedisCacheService(baseOptions(client, 'catalog'));
    const design = new RedisCacheService(baseOptions(client, 'design'));
    await catalog.onModuleInit();
    await design.onModuleInit();
    await catalog.set('draft:1', { owner: 'catalog' }, 60);
    await expect(design.get('draft:1')).resolves.toBeNull();
    expect([...client.store.keys()]).toEqual(['memora:cache:catalog:draft:1']);
  });

  it('throws when Redis is required and unavailable', async () => {
    const client = new FakeRedis();
    client.failNext = true;
    const cache = new RedisCacheService(baseOptions(client));
    await expect(cache.onModuleInit()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('optional availability lets Nest init succeed when Redis is down', async () => {
    const client = new FakeRedis();
    client.failNext = true;
    const moduleRef = await Test.createTestingModule({
      imports: [
        RedisCacheModule.forRoot({
          ...baseOptions(client),
          availability: 'optional',
        }),
      ],
    }).compile();
    await expect(moduleRef.init()).resolves.toBeDefined();
    const cache = moduleRef.get(RedisCacheService);
    await expect(cache.get('product:1')).resolves.toBeNull();
    await moduleRef.close();
  });

  it('required availability fails Nest init when Redis is down', async () => {
    const client = new FakeRedis();
    client.failNext = true;
    const moduleRef = await Test.createTestingModule({
      imports: [RedisCacheModule.forRoot(baseOptions(client))],
    }).compile();
    await expect(moduleRef.init()).rejects.toThrow(ServiceUnavailableException);
  });

  it('fail-open optional cache returns null when Redis is down', async () => {
    const client = new FakeRedis();
    const cache = new RedisCacheService({
      ...baseOptions(client),
      availability: 'optional',
    });
    await cache.onModuleInit();
    client.failNext = true;
    await expect(cache.get('product:1')).resolves.toBeNull();
  });

  it('rejects invalid TTL', async () => {
    const client = new FakeRedis();
    const cache = new RedisCacheService(baseOptions(client));
    await cache.onModuleInit();
    await expect(cache.set('product:1', { id: '1' }, 0)).rejects.toThrow(/TTL/);
  });

  it('quits the client on shutdown', async () => {
    const client = new FakeRedis();
    const cache = new RedisCacheService(baseOptions(client));
    await cache.onModuleInit();
    await cache.onModuleDestroy();
    expect(client.quitCalled).toBe(true);
  });
});
