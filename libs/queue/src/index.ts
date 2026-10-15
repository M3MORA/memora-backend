export { QueueConfigModule } from './queue-config.module';
export {
  createBullMqSharedOptions,
  createDefaultJobOptions,
  createMemoraWorkerOptions,
  createQueueRedisConnectionOptions,
  standaloneRedisConnection,
} from './queue-options';
export {
  assertJobName,
  assertQueueName,
  memoraQueueName,
} from './queue-naming';
export {
  registerWorkerJobLogging,
  type MemoraQueueWorkerEvents,
} from './queue-observability';
export {
  DEFAULT_QUEUE_ATTEMPTS,
  DEFAULT_QUEUE_BACKOFF_MS,
  DEFAULT_QUEUE_PREFIX,
  DEFAULT_WORKER_CONCURRENCY,
  QUEUE_BULLMQ_SHARED_OPTIONS,
  QUEUE_REDIS_CONNECTION_OPTIONS,
} from './queue.constants';
export type {
  MemoraBullMqSharedOptions,
  MemoraWorkerOptions,
  QueueConnectionRole,
  QueueRedisModuleOptions,
} from './queue.interfaces';
