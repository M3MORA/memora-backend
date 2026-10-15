import { HttpException, HttpStatus } from '@nestjs/common';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { TimeoutError } from 'rxjs';
import {
  ERROR_CODES,
  SAFE_INTERNAL_MESSAGE,
  type ErrorCode,
} from './error-codes';

export interface MappedHttpError {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly message: string;
}

const GRPC_TO_HTTP: Readonly<Partial<Record<GrpcStatus, MappedHttpError>>> = {
  [GrpcStatus.INVALID_ARGUMENT]: {
    statusCode: HttpStatus.BAD_REQUEST,
    code: ERROR_CODES.BAD_REQUEST,
    message: 'Invalid argument',
  },
  [GrpcStatus.UNAUTHENTICATED]: {
    statusCode: HttpStatus.UNAUTHORIZED,
    code: ERROR_CODES.UNAUTHORIZED,
    message: 'Unauthenticated',
  },
  [GrpcStatus.PERMISSION_DENIED]: {
    statusCode: HttpStatus.FORBIDDEN,
    code: ERROR_CODES.FORBIDDEN,
    message: 'Permission denied',
  },
  [GrpcStatus.NOT_FOUND]: {
    statusCode: HttpStatus.NOT_FOUND,
    code: ERROR_CODES.NOT_FOUND,
    message: 'Resource not found',
  },
  [GrpcStatus.ALREADY_EXISTS]: {
    statusCode: HttpStatus.CONFLICT,
    code: ERROR_CODES.CONFLICT,
    message: 'Resource already exists',
  },
  [GrpcStatus.RESOURCE_EXHAUSTED]: {
    statusCode: HttpStatus.TOO_MANY_REQUESTS,
    code: ERROR_CODES.TOO_MANY_REQUESTS,
    message: 'Resource exhausted',
  },
  [GrpcStatus.FAILED_PRECONDITION]: {
    statusCode: HttpStatus.PRECONDITION_FAILED,
    code: ERROR_CODES.PRECONDITION_FAILED,
    message: 'Failed precondition',
  },
  [GrpcStatus.DEADLINE_EXCEEDED]: {
    statusCode: HttpStatus.GATEWAY_TIMEOUT,
    code: ERROR_CODES.GATEWAY_TIMEOUT,
    message: 'Upstream deadline exceeded',
  },
  [GrpcStatus.UNAVAILABLE]: {
    statusCode: HttpStatus.SERVICE_UNAVAILABLE,
    code: ERROR_CODES.SERVICE_UNAVAILABLE,
    message: 'Service unavailable',
  },
  [GrpcStatus.INTERNAL]: {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: SAFE_INTERNAL_MESSAGE,
  },
  [GrpcStatus.UNKNOWN]: {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: SAFE_INTERNAL_MESSAGE,
  },
};

const HTTP_TO_GRPC: Readonly<Partial<Record<number, GrpcStatus>>> = {
  [HttpStatus.BAD_REQUEST]: GrpcStatus.INVALID_ARGUMENT,
  [HttpStatus.UNAUTHORIZED]: GrpcStatus.UNAUTHENTICATED,
  [HttpStatus.FORBIDDEN]: GrpcStatus.PERMISSION_DENIED,
  [HttpStatus.NOT_FOUND]: GrpcStatus.NOT_FOUND,
  [HttpStatus.CONFLICT]: GrpcStatus.ALREADY_EXISTS,
  [HttpStatus.PRECONDITION_FAILED]: GrpcStatus.FAILED_PRECONDITION,
  [HttpStatus.TOO_MANY_REQUESTS]: GrpcStatus.RESOURCE_EXHAUSTED,
  [HttpStatus.GATEWAY_TIMEOUT]: GrpcStatus.DEADLINE_EXCEEDED,
  [HttpStatus.SERVICE_UNAVAILABLE]: GrpcStatus.UNAVAILABLE,
  [HttpStatus.INTERNAL_SERVER_ERROR]: GrpcStatus.INTERNAL,
};

const UNKNOWN_GRPC_MAPPING: MappedHttpError = {
  statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
  code: ERROR_CODES.INTERNAL_ERROR,
  message: SAFE_INTERNAL_MESSAGE,
};

const FIRST_GRPC_STATUS = 0;
const LAST_GRPC_STATUS = 16;
const HTTP_SERVER_ERROR = 500;

export function isGrpcStatus(value: number): value is GrpcStatus {
  return (
    Number.isInteger(value) &&
    value >= FIRST_GRPC_STATUS &&
    value <= LAST_GRPC_STATUS
  );
}

export function mapGrpcStatusToHttp(grpcStatus: number): MappedHttpError {
  if (!isGrpcStatus(grpcStatus)) {
    return UNKNOWN_GRPC_MAPPING;
  }

  return GRPC_TO_HTTP[grpcStatus] ?? UNKNOWN_GRPC_MAPPING;
}

export function mapHttpStatusToGrpc(httpStatus: number): GrpcStatus {
  return HTTP_TO_GRPC[httpStatus] ?? GrpcStatus.INTERNAL;
}

export function mapGrpcError(error: unknown): MappedHttpError {
  if (error instanceof TimeoutError) {
    return mapGrpcStatusToHttp(GrpcStatus.DEADLINE_EXCEEDED);
  }

  const grpcStatus = readGrpcStatus(error);
  if (grpcStatus === undefined) {
    return UNKNOWN_GRPC_MAPPING;
  }

  const mapped = mapGrpcStatusToHttp(grpcStatus);
  if (mapped.statusCode >= HTTP_SERVER_ERROR) {
    return mapped;
  }

  const publicMessage = readPublicGrpcMessage(error);
  return publicMessage === undefined
    ? mapped
    : { ...mapped, message: publicMessage };
}

export function mapGrpcErrorToHttpException(error: unknown): HttpException {
  if (error instanceof HttpException) {
    return error;
  }

  const mapped = mapGrpcError(error);
  return new HttpException(
    {
      statusCode: mapped.statusCode,
      code: mapped.code,
      message: mapped.message,
    },
    mapped.statusCode,
  );
}

function readGrpcStatus(error: unknown): number | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  if (typeof error.code === 'number') {
    return error.code;
  }

  return undefined;
}

function readPublicGrpcMessage(error: unknown): string | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  const candidate =
    typeof error.details === 'string'
      ? error.details
      : typeof error.message === 'string'
        ? error.message
        : undefined;

  if (candidate === undefined || !isSafePublicMessage(candidate)) {
    return undefined;
  }

  return candidate;
}

export function isSafePublicMessage(value: string): boolean {
  if (value.length === 0 || value.length > 200) {
    return false;
  }

  if (value.includes('\n') || value.includes('\r')) {
    return false;
  }

  return !/(password|stack|prisma|econnrefused|secret|token)/i.test(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
