import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation } from '@nestjs/swagger';
import { ApiSuccessResponse } from '../../../../common/docs/api-success-response';
import { AcceptedResponseDto } from '../dto/response/accepted.response.dto';
import { AuthSessionResponseDto } from '../dto/response/auth-session.response.dto';
import { PublicUserResponseDto } from '../dto/response/public-user.response.dto';
import { ResendVerificationResponseDto } from '../dto/response/resend-verification.response.dto';
import { CSRF_HEADER_NAME } from '../cookies/auth-cookie.service';

export function ApiAuthSessionDocs(summary: string) {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiSuccessResponse({ type: AuthSessionResponseDto }),
  );
}

export function ApiCookieCsrfDocs(summary: string) {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiHeader({
      name: CSRF_HEADER_NAME,
      required: true,
      description: 'Must match the non-HttpOnly CSRF cookie',
    }),
  );
}

export function ApiMeDocs() {
  return applyDecorators(
    ApiBearerAuth('bearer'),
    ApiOperation({ summary: 'Get the authenticated user' }),
    ApiSuccessResponse({ type: PublicUserResponseDto }),
  );
}

export function ApiAcceptedDocs(summary: string) {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiSuccessResponse({ type: AcceptedResponseDto }),
  );
}

export function ApiUserDocs(summary: string) {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiSuccessResponse({ type: PublicUserResponseDto }),
  );
}

export function ApiResendVerificationDocs() {
  return applyDecorators(
    ApiBearerAuth('bearer'),
    ApiOperation({ summary: 'Resend the email verification message' }),
    ApiSuccessResponse({ type: ResendVerificationResponseDto }),
  );
}

export function ApiLogoutDocs(summary: string) {
  return applyDecorators(ApiOperation({ summary }));
}
