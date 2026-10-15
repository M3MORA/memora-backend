import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ERROR_CODES,
  SAFE_INTERNAL_MESSAGE,
  type ErrorCode,
  type HttpErrorResponse,
  type ValidationFieldError,
} from '../exceptions/error-codes';
import { isRecord } from '../exceptions/grpc-error.mapper';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    if (response.headersSent) {
      this.logger.warn(
        'Headers already sent, skipping exception filter response.',
      );
      return;
    }

    const body = this.toErrorResponse(exception, request);
    if (body.statusCode >= 500) {
      const requestIdSuffix =
        body.requestId === undefined ? '' : ` requestId=${body.requestId}`;
      this.logger.error(
        `Unexpected HTTP error on ${request.method} ${publicRequestPath(request)}${requestIdSuffix}`,
        exception instanceof Error ? exception.stack : exception,
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toErrorResponse(
    exception: unknown,
    request: Request,
  ): HttpErrorResponse {
    const path = publicRequestPath(request);
    const timestamp = new Date().toISOString();
    const requestId = readRequestId(request);

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();
      const isServerError = statusCode >= 500;

      return {
        statusCode,
        code: isServerError
          ? ERROR_CODES.INTERNAL_ERROR
          : readErrorCode(payload, statusCode),
        message: isServerError
          ? SAFE_INTERNAL_MESSAGE
          : readPublicMessage(payload, statusCode),
        details: isServerError ? undefined : readDetails(payload),
        path,
        timestamp,
        ...(requestId === undefined ? {} : { requestId }),
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: SAFE_INTERNAL_MESSAGE,
      path,
      timestamp,
      ...(requestId === undefined ? {} : { requestId }),
    };
  }
}

function publicRequestPath(request: Request): string {
  const raw = request.originalUrl ?? request.url ?? '';
  const queryIndex = raw.indexOf('?');
  return queryIndex < 0 ? raw : raw.slice(0, queryIndex);
}

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

function readRequestId(request: Request): string | undefined {
  const header = request.headers['x-request-id'];
  const raw =
    typeof header === 'string'
      ? header
      : Array.isArray(header) && typeof header[0] === 'string'
        ? header[0]
        : undefined;

  if (raw !== undefined && SAFE_REQUEST_ID.test(raw)) {
    return raw;
  }

  return undefined;
}

function readErrorCode(
  payload: string | object,
  statusCode: number,
): ErrorCode {
  if (isRecord(payload) && isErrorCode(payload.code)) {
    return payload.code;
  }

  return httpStatusToErrorCode(statusCode);
}

function readPublicMessage(
  payload: string | object,
  statusCode: number,
): string {
  if (typeof payload === 'string' && payload.length > 0) {
    return payload;
  }

  if (isRecord(payload) && typeof payload.message === 'string') {
    return payload.message;
  }

  if (isRecord(payload) && Array.isArray(payload.message)) {
    const messages = payload.message.filter(
      (item): item is string => typeof item === 'string',
    );
    if (messages.length > 0) {
      return messages.join(', ');
    }
  }

  return httpStatusToErrorCode(statusCode);
}

function readDetails(
  payload: string | object,
): ValidationFieldError[] | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.details)) {
    return undefined;
  }

  const details = payload.details.filter(isValidationFieldError);
  return details.length > 0 ? details : undefined;
}

function isValidationFieldError(value: unknown): value is ValidationFieldError {
  if (!isRecord(value) || typeof value.field !== 'string') {
    return false;
  }

  return (
    Array.isArray(value.messages) &&
    value.messages.every((item) => typeof item === 'string')
  );
}

function isErrorCode(value: unknown): value is ErrorCode {
  return (
    typeof value === 'string' &&
    Object.values(ERROR_CODES).includes(value as ErrorCode)
  );
}

const HTTP_STATUS_ERROR_CODES: Readonly<Record<number, ErrorCode>> = {
  400: ERROR_CODES.BAD_REQUEST,
  401: ERROR_CODES.UNAUTHORIZED,
  403: ERROR_CODES.FORBIDDEN,
  404: ERROR_CODES.NOT_FOUND,
  409: ERROR_CODES.CONFLICT,
  412: ERROR_CODES.PRECONDITION_FAILED,
  429: ERROR_CODES.TOO_MANY_REQUESTS,
  504: ERROR_CODES.GATEWAY_TIMEOUT,
  503: ERROR_CODES.SERVICE_UNAVAILABLE,
};

function httpStatusToErrorCode(statusCode: number): ErrorCode {
  return HTTP_STATUS_ERROR_CODES[statusCode] ?? ERROR_CODES.INTERNAL_ERROR;
}
