import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

export type MemoraQueueWorkerEvents = {
  on(
    event: 'failed',
    listener: (job: Job | undefined, error: Error) => void,
  ): unknown;
  on(event: 'completed', listener: (job: Job | undefined) => void): unknown;
  on(event: 'active', listener: (job: Job | undefined) => void): unknown;
};

export function registerWorkerJobLogging(
  worker: MemoraQueueWorkerEvents,
  queueName: string,
  logger: Logger = new Logger('MemoraQueue'),
): void {
  worker.on('active', (job) => {
    logger.log(
      `Queue job active queue=${queueName} jobId=${job?.id ?? 'unknown'} jobName=${job?.name ?? 'unknown'} attempts=${job?.attemptsMade ?? 0}`,
    );
  });
  worker.on('completed', (job) => {
    const started = job?.processedOn;
    const finished = job?.finishedOn;
    const durationMs =
      typeof started === 'number' && typeof finished === 'number'
        ? finished - started
        : undefined;
    logger.log(
      `Queue job completed queue=${queueName} jobId=${job?.id ?? 'unknown'} jobName=${job?.name ?? 'unknown'} attempts=${job?.attemptsMade ?? 0}${durationMs === undefined ? '' : ` durationMs=${durationMs}`}`,
    );
  });
  worker.on('failed', (job, error) => {
    logger.error(
      `Queue job failed queue=${queueName} jobId=${job?.id ?? 'unknown'} jobName=${job?.name ?? 'unknown'} attempts=${job?.attemptsMade ?? 0} error=${error.name}`,
    );
  });
}
