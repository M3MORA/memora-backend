import { JOB_NAME_PATTERN, QUEUE_NAME_PATTERN } from './queue.constants';

export function assertQueueName(queueName: string): string {
  if (!QUEUE_NAME_PATTERN.test(queueName)) {
    throw new Error(
      'Queue name must match /^[a-z][a-z0-9-]{0,47}$/ and is owned by the business service',
    );
  }
  return queueName;
}

export function assertJobName(jobName: string): string {
  if (!JOB_NAME_PATTERN.test(jobName)) {
    throw new Error(
      'Job name must match /^[a-z][a-z0-9._-]{0,63}$/ and is owned by the business service',
    );
  }
  return jobName;
}

export function memoraQueueName(owner: string, name: string): string {
  return assertQueueName(`${assertOwner(owner)}-${assertQueueName(name)}`);
}

function assertOwner(owner: string): string {
  if (!QUEUE_NAME_PATTERN.test(owner)) {
    throw new Error(
      'Queue owner must match /^[a-z][a-z0-9-]{0,47}$/ (service or feature slug)',
    );
  }
  return owner;
}
