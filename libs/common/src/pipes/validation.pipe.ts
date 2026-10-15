import {
  BadRequestException,
  HttpStatus,
  ValidationPipe,
  type ValidationError,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import {
  ERROR_CODES,
  VALIDATION_FAILED_MESSAGE,
} from '../exceptions/error-codes';
import { flattenValidationErrors } from '../exceptions/validation-errors';

function createValidationPayload(errors: ValidationError[]) {
  return {
    statusCode: HttpStatus.BAD_REQUEST,
    code: ERROR_CODES.VALIDATION_ERROR,
    message: VALIDATION_FAILED_MESSAGE,
    details: flattenValidationErrors(errors),
  };
}

const sharedOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
} as const;

export function createHttpValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    ...sharedOptions,
    exceptionFactory: (errors: ValidationError[]) =>
      new BadRequestException(createValidationPayload(errors)),
  });
}

export function createGrpcValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    ...sharedOptions,
    exceptionFactory: (errors: ValidationError[]) =>
      new RpcException({
        code: GrpcStatus.INVALID_ARGUMENT,
        message: VALIDATION_FAILED_MESSAGE,
        details: flattenValidationErrors(errors),
      }),
  });
}
