# Redis Cache & BullMQ Queue Foundation

Shared infrastructure for future MEMORA services. Phase 3.11 does **not** wire cache or queues into Gateway or IAM, and does **not** implement Guest Session, notifications, or catalog jobs.

IAM refresh sessions stay on `IAM_REDIS_*` and `iam:rt:*` keys. Do not move them into `RedisCacheModule`.

## When to use what

| Need | Use |
|---|---|
| Read-through of data the owning service already persists | `RedisCacheModule` (`@app/cache`) |
| Work that can complete after the request returns (email, index rebuild, thumbnail) | BullMQ via `@app/queue` connection options |
| Authoritative read/write that the caller must wait for | Synchronous gRPC |
| Many independent consumers, fan-out, other bounded contexts | Future event broker (not this library) |

Redis cache is **not** a source of truth. Missing key returns `null`. Connection failure is distinct: default `availability: 'required'` throws; `optional` is fail-open only when the caller has a safe database fallback. Never mark security-critical data optional (sessions, permissions, tokens).

BullMQ is **not** an event bus. It is at-least-once job processing with retries.

If a database commit and enqueue must not diverge, the owning feature needs a **transactional outbox** in that business phase. This library does not implement outbox.

## Redis isolation

| Role | ENV | Dev (same Redis process) | Production |
|---|---|---|---|
| IAM sessions | `IAM_REDIS_*` | DB `0`, keys `iam:rt:*` | Dedicated instance, `noeviction` |
| General cache | `CACHE_REDIS_*` | DB `1`, prefix `memora:cache` | Dedicated instance; eviction (e.g. `allkeys-lru`) is acceptable **only** on this instance |
| BullMQ | `QUEUE_REDIS_*` | DB `2`, prefix `memora:bull` | Dedicated instance, AOF/RDB, **`noeviction`** |

Redis DB index is **not** security isolation. Prefixes prevent accidental key collisions on a shared dev instance. Docker Compose Redis currently uses `noeviction` — keep that while IAM and queues share the process. Do not enable cache eviction on the IAM/queue instance.

**Redis Cluster:** Cluster only has logical **DB 0** (`SELECT` is unsupported). Do not use `CACHE_REDIS_DB=1` / `QUEUE_REDIS_DB=2` against a cluster. Set `CACHE_REDIS_CLUSTER=true` / `QUEUE_REDIS_CLUSTER=true` with DB `0`, and give IAM, cache, and queues **independent endpoints** (separate cluster or instance). Isolation is host/port, not DB index. ioredis `keyPrefix` is not set on queue connections; BullMQ `prefix` (`memora:bull`) owns queue keys.

Do not reuse `IAM_REDIS_PASSWORD` as the default credential for every service. Gateway must not load cache/queue ENV.

Current `docker-compose.redis.yml` topology is unchanged.

## Cache API

```ts
get<T>(key: string): Promise<T | null>
set<T>(key: string, value: T, ttlSeconds: number): Promise<void>
delete(key: string): Promise<void>
exists(key: string): Promise<boolean>
```

- TTL is required, integer seconds, 1–604800. No infinite default.
- Keys: `{prefix}:{namespace}:{relativeKey}` e.g. `memora:cache:catalog:product:sku-1`.
- Namespace: `^[a-z][a-z0-9-]{0,31}$` (owning service).
- Relative key: `^[a-zA-Z0-9:_-]{1,200}$`. No `KEYS`, `FLUSHDB`, or `FLUSHALL`.
- Values are JSON. Do not log values or Redis passwords.
- Invalidate **after** a successful database mutation, using constants owned by that feature. No distributed invalidation bus yet.

### Example (illustration only — do not scaffold Catalog)

```ts
RedisCacheModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    host: config.getOrThrow('cacheRedis.host'),
    port: config.getOrThrow('cacheRedis.port'),
    password: config.getOrThrow('cacheRedis.password'),
    db: config.getOrThrow('cacheRedis.db'),
    cluster: config.get('cacheRedis.cluster') === true,
    keyPrefix: config.getOrThrow('cacheRedis.keyPrefix'),
    namespace: 'catalog',
    availability: 'optional',
  }),
});
```

The owning service must load `cacheRedisConfig` itself. Gateway/IAM do not.

## Queue / BullMQ

`QueueConfigModule` only provides connection objects and default job options. Use official `@nestjs/bullmq` `BullModule`, `InjectQueue`, `@Processor`, `WorkerHost`. Do not put email or domain logic in `libs/queue`.

- Producer HTTP process: `role: 'producer'` (`maxRetriesPerRequest: 2`, no offline queue).
- Worker process: `role: 'worker'` (`maxRetriesPerRequest: null`). Do not reuse a cache ioredis client or a blocking worker connection on the HTTP path.
- Queue name: `{owner}-{name}` via `memoraQueueName('catalog', 'index-rebuild')`.
- Job name: `^[a-z][a-z0-9._-]{0,63}$`.
- Defaults: 3 attempts, exponential backoff 1000ms, bounded completed/failed retention. Throw `UnrecoverableError` (BullMQ) for permanent failures so they are not retried.
- Idempotency: pass a stable `jobId` derived from the business unique key. Processors must tolerate duplicates.
- Observability: `registerWorkerJobLogging(worker, queueName)` logs queue, job id/name, attempts, duration — never the payload. No secrets or biometric data in job data.

### Example (illustration only — do not scaffold a worker app)

```ts
BullModule.forRootAsync({
  imports: [QueueConfigModule.forRootAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
      ...config.getOrThrow('queueRedis'),
      role: 'producer',
    }),
  })],
  inject: [QUEUE_BULLMQ_SHARED_OPTIONS],
  useFactory: (shared) => shared,
});

BullModule.registerQueue({ name: memoraQueueName('notification', 'email') });
```

Register `@Processor` only in the service that executes the job.

## Guest session (not implemented here)

Future guest checkout should use a Gateway-owned opaque cookie, Redis metadata under a guest-specific prefix (not IAM JWT, not `RedisCacheModule` for security-critical session authority without review), and Design Service as owner of cart/draft. Phase 3.11 does not implement that.

## Future consumers

- **Catalog**: optional product-read cache with DB fallback; index jobs on BullMQ.
- **Notification**: enqueue email/push after domain commit (outbox if required); processor in platform/notification module.
- **Production**: long-running render/export jobs with idempotent `jobId`.

Each service imports only the library it needs and its own ENV group.
