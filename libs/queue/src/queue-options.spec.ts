import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QUEUE_BULLMQ_SHARED_OPTIONS } from './queue.constants';
import { QueueConfigModule } from './queue-config.module';
import {
  assertJobName,
  assertQueueName,
  memoraQueueName,
} from './queue-naming';
import { registerWorkerJobLogging } from './queue-observability';
import {
  createBullMqSharedOptions,
  createMemoraWorkerOptions,
  createQueueRedisConnectionOptions,
  standaloneRedisConnection,
} from './queue-options';
import type {
  MemoraBullMqSharedOptions,
  QueueRedisModuleOptions,
} from './queue.interfaces';

const endpoint: QueueRedisModuleOptions = {
  host: '127.0.0.1',
  port: 6379,
  password: 'queue-redis-password-ok',
  db: 2,
  role: 'producer',
};

describe('queue options and conventions', () => {
  it('uses producer connection retries without sharing worker blocking settings', () => {
    const producer = standaloneRedisConnection(
      createQueueRedisConnectionOptions(endpoint),
    );
    expect(producer.maxRetriesPerRequest).toBe(2);
    expect(producer.enableOfflineQueue).toBe(false);
    expect(producer.db).toBe(2);
  });

  it('uses worker connection with maxRetriesPerRequest null', () => {
    const worker = createMemoraWorkerOptions({
      ...endpoint,
      role: 'worker',
      workerConcurrency: 8,
    });
    const redis = standaloneRedisConnection(worker.connection);
    expect(redis.maxRetriesPerRequest).toBeNull();
    expect(redis.enableOfflineQueue).toBe(true);
    expect(worker.concurrency).toBe(8);
    expect(worker.prefix).toBe('memora:bull');
    expect(redis.keyPrefix).toBeUndefined();
  });

  it('omits Redis SELECT db on cluster endpoints and rejects non-zero db', () => {
    const clustered = createQueueRedisConnectionOptions({
      ...endpoint,
      db: 0,
      cluster: true,
      role: 'worker',
    });
    const redis = standaloneRedisConnection(clustered);
    expect(redis.db).toBeUndefined();
    expect(redis.maxRetriesPerRequest).toBeNull();
    expect(() =>
      createQueueRedisConnectionOptions({
        ...endpoint,
        db: 1,
        cluster: true,
        role: 'producer',
      }),
    ).toThrow(/logical DB 0/);
  });

  it('applies bounded exponential retry defaults', () => {
    const shared = createBullMqSharedOptions(endpoint);
    expect(shared.defaultJobOptions.attempts).toBe(3);
    expect(shared.defaultJobOptions.backoff).toEqual({
      type: 'exponential',
      delay: 1000,
    });
    expect(shared.prefix).toBe('memora:bull');
  });

  it('validates queue and job names owned by the business service', () => {
    expect(memoraQueueName('catalog', 'index-rebuild')).toBe(
      'catalog-index-rebuild',
    );
    expect(assertJobName('rebuild.requested')).toBe('rebuild.requested');
    expect(() => assertQueueName('Catalog Queue')).toThrow(/Queue name/);
    expect(() => assertJobName('')).toThrow(/Job name/);
  });

  it('logs job failure without payload fields', () => {
    const listeners: Record<string, (...args: unknown[]) => void> = {};
    const worker = {
      on: (event: string, listener: (...args: unknown[]) => void) => {
        listeners[event] = listener;
      },
    };
    const error = jest.fn();
    const logger = {
      log: jest.fn(),
      error,
    } as unknown as Logger;
    registerWorkerJobLogging(worker as never, 'catalog-index-rebuild', logger);
    listeners.failed?.(
      {
        id: 'job-1',
        name: 'rebuild.requested',
        attemptsMade: 2,
        data: { secret: 'must-not-log' },
      },
      new Error('boom'),
    );
    const message = firstMockStringArg(error);
    expect(message).toContain('jobId=job-1');
    expect(message).not.toContain('must-not-log');
  });

  it('provides shared options through QueueConfigModule without requiring apps to import it', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [QueueConfigModule.forRoot(endpoint)],
    }).compile();
    const shared = moduleRef.get<MemoraBullMqSharedOptions>(
      QUEUE_BULLMQ_SHARED_OPTIONS,
    );
    expect(standaloneRedisConnection(shared.connection).host).toBe('127.0.0.1');
    await moduleRef.close();
  });

  it('does not register BullMQ processors by default', () => {
    const moduleRef = QueueConfigModule.forRoot(endpoint);
    expect(moduleRef.providers).toHaveLength(2);
  });
});

function firstMockStringArg(mockFn: jest.Mock): string {
  const rows = mockFn.mock.calls as readonly unknown[];
  const row = rows[0];
  if (!Array.isArray(row)) {
    return '';
  }
  const arg: unknown = row[0];
  return typeof arg === 'string' ? arg : '';
}
