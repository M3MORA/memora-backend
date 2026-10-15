import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';
export const REQUEST_ID_METADATA_KEY = 'x-request-id';

const MAX_REQUEST_ID_LENGTH = 128;
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

export function isValidRequestId(value: string): boolean {
  if (value.length === 0 || value.length > MAX_REQUEST_ID_LENGTH) {
    return false;
  }
  if (value.includes('\n') || value.includes('\r') || value.includes('\0')) {
    return false;
  }
  return SAFE_REQUEST_ID.test(value);
}

export function resolveRequestId(candidate: unknown): string {
  const raw = firstHeaderValue(candidate);
  if (raw !== undefined && isValidRequestId(raw)) {
    return raw;
  }
  return randomUUID();
}

export function firstHeaderValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0].trim();
  }
  return undefined;
}
