export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PRECONDITION_FAILED: 'PRECONDITION_FAILED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const SAFE_INTERNAL_MESSAGE = 'Internal server error';
export const VALIDATION_FAILED_MESSAGE = 'Validation failed';

export interface ValidationFieldError {
  readonly field: string;
  readonly messages: string[];
}

export interface HttpErrorResponse {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: ValidationFieldError[];
  readonly path: string;
  readonly timestamp: string;
  readonly requestId?: string;
}
