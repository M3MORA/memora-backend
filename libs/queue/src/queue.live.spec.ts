import { loadEnvFile } from '@app/config';
import { Queue, Worker } from 'bullmq';
import { memoraQueueName } from './queue-naming';
import {
  createBullMqSharedOptions,
  standaloneRedisConnection,
} from './queue-options';

loadEnvFile();

const password = process.env.QUEUE_REDIS_PASSWORD ?? process.env.REDIS_PASSWORD;
const live =
  process.env.MEMORA_REDIS_TEST === '1' &&
  typeof password === 'string' &&
  password.length >= 16;

const describeLive = live ? describe : describe.skip;

describeLive('BullMQ live Redis', () => {
  const shared = createBullMqSharedOptions({
    host:
      process.env.QUEUE_REDIS_HOST ?? process.env.IAM_REDIS_HOST ?? '127.0.0.1',
    port: Number(
      process.env.QUEUE_REDIS_PORT ?? process.env.IAM_REDIS_PORT ?? '6379',
    ),
    password: password ?? '',
    db: Number(process.env.QUEUE_REDIS_DB ?? '2'),
    role: 'worker',
    defaultAttempts: 2,
    defaultBackoffMs: 50,
  });

  it('uses worker maxRetriesPerRequest null and no ioredis keyPrefix', () => {
    const redis = standaloneRedisConnection(shared.connection);
    expect(redis.maxRetriesPerRequest).toBeNull();
    expect(redis.keyPrefix).toBeUndefined();
    expect(shared.prefix).toBe('memora:bull');
  });

  it('adds, retries once, consumes, then shuts down an isolated queue', async () => {
    const queueName = memoraQueueName('phase311', `q-${Date.now()}`);
    const queue = new Queue(queueName, {
      connection: shared.connection,
      prefix: shared.prefix,
      defaultJobOptions: shared.defaultJobOptions,
    });
    let worker: Worker | undefined;
    try {
      let attempts = 0;
      const finished = new Promise<void>((resolve, reject) => {
        worker = new Worker(
          queueName,
          async () => {
            await Promise.resolve();
            attempts += 1;
            if (attempts === 1) {
              throw new Error('retry-once');
            }
          },
          {
            connection: {
              ...shared.connection,
              maxRetriesPerRequest: null,
            },
            prefix: shared.prefix,
            concurrency: 1,
          },
        );
        worker.on('completed', () => {
          resolve();
        });
        worker.on('failed', (job, error) => {
          const maxAttempts = job?.opts.attempts ?? 2;
          if ((job?.attemptsMade ?? 0) >= maxAttempts) {
            reject(error);
          }
        });
      });
      await queue.add(
        'probe.ping',
        { probe: true },
        { jobId: `phase311-${Date.now()}` },
      );
      await finished;
      expect(attempts).toBe(2);
    } finally {
      await worker?.close();
      await queue.obliterate({ force: true });
      await queue.close();
    }
  }, 15_000);
});
