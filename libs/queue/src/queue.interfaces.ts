import type { ConnectionOptions, DefaultJobOptions } from 'bullmq';
import type { RedisEndpointConfig } from '@app/config';

export type QueueConnectionRole = 'producer' | 'worker';

export type QueueRedisModuleOptions = RedisEndpointConfig & {
  prefix?: string;
  defaultAttempts?: number;
  defaultBackoffMs?: number;
  role: QueueConnectionRole;
  workerConcurrency?: number;
};

export type MemoraBullMqSharedOptions = {
  connection: ConnectionOptions;
  prefix: string;
  defaultJobOptions: DefaultJobOptions;
};

export type MemoraWorkerOptions = {
  connection: ConnectionOptions;
  prefix: string;
  concurrency: number;
};
