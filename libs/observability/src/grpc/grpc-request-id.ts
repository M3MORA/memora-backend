import { Metadata } from '@grpc/grpc-js';
import { getRequestId } from '../correlation/correlation-context';
import {
  REQUEST_ID_METADATA_KEY,
  firstHeaderValue,
  resolveRequestId,
} from '../correlation/request-id';

export function createOutgoingGrpcMetadata(): Metadata {
  const metadata = new Metadata();
  const requestId = getRequestId();
  if (requestId !== undefined) {
    metadata.set(REQUEST_ID_METADATA_KEY, requestId);
  }
  return metadata;
}

export function readIncomingGrpcRequestId(metadata: unknown): string {
  return resolveRequestId(readMetadataValue(metadata, REQUEST_ID_METADATA_KEY));
}

function readMetadataValue(metadata: unknown, key: string): unknown {
  if (!hasMetadataGet(metadata)) {
    return undefined;
  }
  const values = metadata.get(key);
  return firstHeaderValue(values);
}

function hasMetadataGet(
  value: unknown,
): value is { get: (key: string) => unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'get' in value &&
    typeof value.get === 'function'
  );
}
