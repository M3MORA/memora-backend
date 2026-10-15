import type { AuthSessionResponse, PublicUserMessage } from '@app/contracts';
import type { AuthSession } from '../../../application/auth/authentication.service';
import type { PublicUser } from '../../../application/users/users.mapper';

export function toPublicUserMessage(user: PublicUser): PublicUserMessage {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    ...(user.phone !== null ? { phone: user.phone } : {}),
    authProvider: user.authProvider,
    status: user.status,
    ...(user.emailVerifiedAt !== null
      ? { emailVerifiedAt: user.emailVerifiedAt.toISOString() }
      : {}),
    ...(user.lastLoginAt !== null
      ? { lastLoginAt: user.lastLoginAt.toISOString() }
      : {}),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function toAuthSessionResponse(
  session: AuthSession,
): AuthSessionResponse {
  return {
    user: toPublicUserMessage(session.user),
    accessCredential: session.accessToken,
    refreshCredential: session.refreshToken,
    tokenType: session.tokenType,
    expiresInSeconds: session.expiresInSeconds,
    refreshExpiresInSeconds: session.refreshExpiresInSeconds,
  };
}
