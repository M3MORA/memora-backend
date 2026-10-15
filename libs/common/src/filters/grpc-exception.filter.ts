import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type RpcExceptionFilter,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Observable, throwError } from 'rxjs';
import { SAFE_INTERNAL_MESSAGE } from '../exceptions/error-codes';
import {
  isGrpcStatus,
  isRecord,
  isSafePublicMessage,
  mapHttpStatusToGrpc,
} from '../exceptions/grpc-error.mapper';

export interface GrpcErrorPayload {
  readonly code: GrpcStatus;
  readonly message: string;
}

@Catch()
export class GrpcExceptionFilter implements RpcExceptionFilter {
  private readonly logger = new Logger(GrpcExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): Observable<never> {
    void host;
    const payload = this.toGrpcError(exception);
    if (payload.code === GrpcStatus.INTERNAL) {
      this.logger.error(
        'Unexpected gRPC error',
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    return throwError(() => payload);
  }

  private toGrpcError(exception: unknown): GrpcErrorPayload {
    if (exception instanceof RpcException) {
      return this.fromRpcException(exception);
    }

    if (exception instanceof HttpException) {
      const httpStatus = exception.getStatus();
      return {
        code: mapHttpStatusToGrpc(httpStatus),
        message:
          httpStatus >= 500
            ? SAFE_INTERNAL_MESSAGE
            : readHttpExceptionMessage(exception),
      };
    }

    return {
      code: GrpcStatus.INTERNAL,
      message: SAFE_INTERNAL_MESSAGE,
    };
  }

  private fromRpcException(exception: RpcException): GrpcErrorPayload {
    const error = exception.getError();
    if (typeof error === 'string') {
      return {
        code: GrpcStatus.UNKNOWN,
        message: isSafePublicMessage(error) ? error : SAFE_INTERNAL_MESSAGE,
      };
    }

    if (!isRecord(error)) {
      return {
        code: GrpcStatus.INTERNAL,
        message: SAFE_INTERNAL_MESSAGE,
      };
    }

    const code =
      typeof error.code === 'number' && isGrpcStatus(error.code)
        ? error.code
        : GrpcStatus.INTERNAL;

    if (code === GrpcStatus.INTERNAL || code === GrpcStatus.UNKNOWN) {
      return { code, message: SAFE_INTERNAL_MESSAGE };
    }

    const message =
      typeof error.message === 'string' && isSafePublicMessage(error.message)
        ? error.message
        : SAFE_INTERNAL_MESSAGE;

    return { code, message };
  }
}

function readHttpExceptionMessage(exception: HttpException): string {
  const payload = exception.getResponse();
  if (typeof payload === 'string' && isSafePublicMessage(payload)) {
    return payload;
  }

  if (isRecord(payload) && typeof payload.message === 'string') {
    return isSafePublicMessage(payload.message)
      ? payload.message
      : SAFE_INTERNAL_MESSAGE;
  }

  return SAFE_INTERNAL_MESSAGE;
}
