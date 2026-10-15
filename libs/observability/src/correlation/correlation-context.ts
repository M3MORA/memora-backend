import { AsyncLocalStorage } from 'node:async_hooks';

export interface CorrelationStore {
  readonly requestId: string;
}

const storage = new AsyncLocalStorage<CorrelationStore>();

export function runWithCorrelation<T>(store: CorrelationStore, fn: () => T): T {
  return storage.run(store, fn);
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

export function getCorrelationStore(): CorrelationStore | undefined {
  return storage.getStore();
}
