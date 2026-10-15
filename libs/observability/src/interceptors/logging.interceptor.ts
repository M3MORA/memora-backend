import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import {
  runWithCorrelation,
  type CorrelationStore,
} from '../correlation/correlation-context';
import { readIncomingGrpcRequestId } from '../grpc/grpc-request-id';

type TransportName = 'http' | 'grpc';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    const type = context.getType<string>();
    if (type === 'rpc') {
      const store: CorrelationStore = {
        requestId: readIncomingGrpcRequestId(
          context.switchToRpc().getContext(),
        ),
      };
      return bindObservableToContext(store, this.trace(context, next, 'grpc'));
    }

    if (type === 'http') {
      return this.trace(context, next, 'http');
    }

    return next.handle();
  }

  private trace(
    context: ExecutionContext,
    next: CallHandler<unknown>,
    transport: TransportName,
  ): Observable<unknown> {
    const started = Date.now();
    const route = describeRoute(context, transport);

    return next.handle().pipe(
      tap(() => {
        this.write({
          transport,
          route,
          status: resolveSuccessStatus(context, transport),
          durationMs: Date.now() - started,
          outcome: 'success',
          errorKind: 'none',
        });
      }),
      catchError((error: unknown) => {
        const status = resolveErrorStatus(error, transport);
        this.write({
          transport,
          route,
          status,
          durationMs: Date.now() - started,
          outcome: 'failure',
          errorKind: resolveErrorKind(status),
        });
        return throwError(() => error);
      }),
    );
  }

  private write(entry: {
    transport: TransportName;
    route: string;
    status: number;
    durationMs: number;
    outcome: 'success' | 'failure';
    errorKind: 'none' | 'http' | 'dependency';
  }): void {
    const kindPart = entry.outcome === 'failure' ? ` ${entry.errorKind}` : '';
    const message = `${entry.transport.toUpperCase()} ${entry.route} ${entry.status} ${entry.durationMs}ms ${entry.outcome}${kindPart}`;
    if (entry.outcome === 'success') {
      this.logger.log(message);
      return;
    }
    this.logger.warn(message);
  }
}

function bindObservableToContext<T>(
  store: CorrelationStore,
  source: Observable<T>,
): Observable<T> {
  return new Observable((subscriber) => {
    const subscription = runWithCorrelation(store, () =>
      source.subscribe({
        next: (value) => {
          runWithCorrelation(store, () => {
            subscriber.next(value);
          });
        },
        error: (err: unknown) => {
          runWithCorrelation(store, () => {
            subscriber.error(err);
          });
        },
        complete: () => {
          runWithCorrelation(store, () => {
            subscriber.complete();
          });
        },
      }),
    );
    return () => {
      subscription.unsubscribe();
    };
  });
}

function describeRoute(
  context: ExecutionContext,
  transport: TransportName,
): string {
  if (transport === 'http') {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      originalUrl?: string;
      url?: string;
    }>();
    const method = request.method ?? 'GET';
    const url = sanitizeHttpUrl(request.originalUrl ?? request.url ?? '');
    return `${method} ${url}`;
  }

  return `${context.getClass().name}.${context.getHandler().name}`;
}

const REDACTED_QUERY_KEYS = new Set([
  'code',
  'state',
  'id_token',
  'access_token',
  'refresh_token',
  'token',
]);

export function sanitizeHttpUrl(url: string): string {
  const queryIndex = url.indexOf('?');
  if (queryIndex < 0) {
    return url;
  }
  const path = url.slice(0, queryIndex);
  const search = url.slice(queryIndex + 1);
  const params = new URLSearchParams(search);
  for (const key of [...params.keys()]) {
    if (REDACTED_QUERY_KEYS.has(key.toLowerCase())) {
      params.set(key, '[REDACTED]');
    }
  }
  const next = params.toString();
  return next.length === 0 ? path : `${path}?${next}`;
}

function resolveSuccessStatus(
  context: ExecutionContext,
  transport: TransportName,
): number {
  if (transport === 'grpc') {
    return GrpcStatus.OK;
  }

  const httpCode: unknown = Reflect.getMetadata(
    HTTP_CODE_METADATA,
    context.getHandler(),
  );
  if (typeof httpCode === 'number') {
    return httpCode;
  }

  const response = context
    .switchToHttp()
    .getResponse<{ statusCode?: number }>();
  return response.statusCode ?? HttpStatus.OK;
}

function resolveErrorStatus(error: unknown, transport: TransportName): number {
  if (error instanceof HttpException) {
    return error.getStatus();
  }

  if (transport === 'grpc' && hasNumericCode(error)) {
    return error.code;
  }

  return transport === 'grpc'
    ? GrpcStatus.INTERNAL
    : HttpStatus.INTERNAL_SERVER_ERROR;
}

function resolveErrorKind(status: number): 'http' | 'dependency' {
  const httpDependency = new Set<number>([
    HttpStatus.BAD_GATEWAY,
    HttpStatus.SERVICE_UNAVAILABLE,
    HttpStatus.GATEWAY_TIMEOUT,
  ]);
  const grpcDependency = new Set<number>([
    GrpcStatus.UNAVAILABLE,
    GrpcStatus.DEADLINE_EXCEEDED,
  ]);
  if (httpDependency.has(status) || grpcDependency.has(status)) {
    return 'dependency';
  }
  return 'http';
}

function hasNumericCode(value: unknown): value is { code: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof value.code === 'number'
  );
}
