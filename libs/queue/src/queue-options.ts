import type { ConnectionOptions, DefaultJobOptions } from 'bullmq';
import { redisStandaloneConnectionFields } from '@app/config';
import {
  DEFAULT_QUEUE_ATTEMPTS,
  DEFAULT_QUEUE_BACKOFF_MS,
  DEFAULT_QUEUE_PREFIX,
  DEFAULT_WORKER_CONCURRENCY,
} from './queue.constants';
import type {
  MemoraBullMqSharedOptions,
  MemoraWorkerOptions,
  QueueConnectionRole,
  QueueRedisModuleOptions,
} from './queue.interfaces';

export function createQueueRedisConnectionOptions(
  options: QueueRedisModuleOptions,
): ConnectionOptions {
  const worker = options.role === 'worker';
  const endpoint = redisStandaloneConnectionFields({
    host: options.host,
    port: options.port,
    password: options.password,
    db: options.db,
    cluster: options.cluster === true,
  });
  return {
    ...endpoint,
    maxRetriesPerRequest: worker ? null : 2,
    enableOfflineQueue: worker,
    lazyConnect: !worker,
  };
}

export type StandaloneQueueRedisOptions = {
  host?: string;
  port?: number;
  db?: number;
  password?: string;
  maxRetriesPerRequest?: number | null;
  enableOfflineQueue?: boolean;
  lazyConnect?: boolean;
  keyPrefix?: string;
};

export function standaloneRedisConnection(
  connection: ConnectionOptions,
): StandaloneQueueRedisOptions {
  if (typeof connection !== 'object' || connection === null) {
    throw new Error('expected ioredis options, not a Redis client instance');
  }
  const candidate = connection as StandaloneQueueRedisOptions & {
    connect?: unknown;
  };
  if (typeof candidate.connect === 'function') {
    throw new Error('expected ioredis options, not a Redis client instance');
  }
  return candidate;
}

export function createDefaultJobOptions(
  options: Pick<
    QueueRedisModuleOptions,
    'defaultAttempts' | 'defaultBackoffMs'
  >,
): DefaultJobOptions {
  const attempts = options.defaultAttempts ?? DEFAULT_QUEUE_ATTEMPTS;
  const delay = options.defaultBackoffMs ?? DEFAULT_QUEUE_BACKOFF_MS;
  return {
    attempts,
    backoff: {
      type: 'exponential',
      delay,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  };
}

export function createBullMqSharedOptions(
  options: QueueRedisModuleOptions,
): MemoraBullMqSharedOptions {
  return {
    connection: createQueueRedisConnectionOptions(options),
    prefix: options.prefix ?? DEFAULT_QUEUE_PREFIX,
    defaultJobOptions: createDefaultJobOptions(options),
  };
}

export function createMemoraWorkerOptions(
  options: QueueRedisModuleOptions,
): MemoraWorkerOptions {
  if (options.role !== 'worker') {
    throw new Error(
      'Worker Redis options require role=worker (maxRetriesPerRequest=null)',
    );
  }
  const shared = createBullMqSharedOptions(options);
  return {
    connection: shared.connection,
    prefix: shared.prefix,
    concurrency: options.workerConcurrency ?? DEFAULT_WORKER_CONCURRENCY,
  };
}

export function isWorkerConnectionRole(
  role: QueueConnectionRole,
): role is 'worker' {
  return role === 'worker';
}
