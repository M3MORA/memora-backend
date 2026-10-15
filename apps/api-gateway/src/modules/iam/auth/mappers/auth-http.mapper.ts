import type { AuthSessionResponse, PublicUserMessage } from '@app/contracts';
import type { AuthSessionResponseDto } from '../dto/response/auth-session.response.dto';
import type { PublicUserResponseDto } from '../dto/response/public-user.response.dto';

export function toPublicUserResponse(
  user: PublicUserMessage,
): PublicUserResponseDto {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    ...(user.phone === undefined ? {} : { phone: user.phone }),
    authProvider: user.authProvider,
    status: user.status,
    ...(user.emailVerifiedAt === undefined
      ? {}
      : { emailVerifiedAt: user.emailVerifiedAt }),
    ...(user.lastLoginAt === undefined
      ? {}
      : { lastLoginAt: user.lastLoginAt }),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function toAuthSessionHttp(
  session: AuthSessionResponse,
): AuthSessionResponseDto {
  return {
    user: toPublicUserResponse(session.user),
    accessToken: session.accessCredential,
    tokenType: session.tokenType,
    expiresInSeconds: session.expiresInSeconds,
  };
}
