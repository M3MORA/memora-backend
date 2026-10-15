import {
  Injectable,
  StreamableFile,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  REDIRECT_METADATA,
  SSE_METADATA,
} from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  API_SUCCESS_ENVELOPE,
  DEFAULT_SUCCESS_MESSAGE,
  RESPONSE_TRANSFORM_METADATA,
  isApiSuccessEnvelope,
  isSuccessResponse,
  type ApiResponse,
  type PaginationMeta,
} from '@app/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Readable } from 'node:stream';

@Injectable()
export class ResponseTransformInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    if (!this.shouldTransform(context)) {
      return next.handle();
    }

    return next
      .handle()
      .pipe(map((payload: unknown) => this.wrap(context, payload)));
  }

  private shouldTransform(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return false;
    }

    const handler = context.getHandler();
    const skip = this.reflector.getAllAndOverride<boolean>(
      RESPONSE_TRANSFORM_METADATA.SKIP,
      [handler, context.getClass()],
    );
    if (skip) {
      return false;
    }

    if (this.reflector.get<unknown>(SSE_METADATA, handler)) {
      return false;
    }

    if (this.reflector.get<unknown>(REDIRECT_METADATA, handler)) {
      return false;
    }

    const request = context.switchToHttp().getRequest<Request>();
    if (request.method === 'HEAD') {
      return false;
    }

    const response = context.switchToHttp().getResponse<Response>();
    const statusCode = this.resolveStatusCode(context, response);
    if (isEmptyBodyStatus(statusCode) || isRedirectStatus(statusCode)) {
      return false;
    }

    const contentType = response.getHeader('Content-Type');
    if (isEventStream(contentType)) {
      return false;
    }

    return true;
  }

  private wrap(context: ExecutionContext, payload: unknown): unknown {
    if (isPassthroughPayload(payload)) {
      return payload;
    }

    const response = context.switchToHttp().getResponse<Response>();
    const statusCode = this.resolveStatusCode(context, response);
    if (
      response.headersSent ||
      response.writableEnded ||
      isEmptyBodyStatus(statusCode) ||
      isRedirectStatus(statusCode)
    ) {
      return payload;
    }

    if (isApiSuccessEnvelope(payload)) {
      return payload;
    }

    const decoratorMessage = this.reflector.getAllAndOverride<string>(
      RESPONSE_TRANSFORM_METADATA.MESSAGE,
      [context.getHandler(), context.getClass()],
    );

    let data: unknown = payload;
    let message = decoratorMessage ?? DEFAULT_SUCCESS_MESSAGE;
    let meta: PaginationMeta | undefined;

    if (isSuccessResponse(payload)) {
      data = payload.data;
      message = payload.options.message ?? message;
      meta = payload.options.meta;
    }

    const body: ApiResponse<unknown> & {
      [API_SUCCESS_ENVELOPE]: true;
    } = {
      [API_SUCCESS_ENVELOPE]: true,
      statusCode,
      message,
      data: data === undefined ? null : data,
      ...(meta === undefined ? {} : { meta }),
    };

    return body;
  }

  private resolveStatusCode(
    context: ExecutionContext,
    response: Response,
  ): number {
    const httpCode = this.reflector.get<number>(
      HTTP_CODE_METADATA,
      context.getHandler(),
    );
    return httpCode ?? response.statusCode;
  }
}

function isPassthroughPayload(payload: unknown): boolean {
  if (payload instanceof StreamableFile || payload instanceof Readable) {
    return true;
  }

  return typeof payload === 'function';
}

function isEmptyBodyStatus(statusCode: number): boolean {
  return statusCode === 204 || statusCode === 304;
}

function isRedirectStatus(statusCode: number): boolean {
  return statusCode >= 300 && statusCode < 400;
}

function isEventStream(
  contentType: number | string | string[] | undefined,
): boolean {
  if (typeof contentType === 'string') {
    return contentType.includes('text/event-stream');
  }

  if (Array.isArray(contentType)) {
    return contentType.some((value) => value.includes('text/event-stream'));
  }

  return false;
}
