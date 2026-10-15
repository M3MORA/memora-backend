import type { User } from '../../../generated/prisma/client';

export type PublicUser = Omit<User, 'passwordHash'>;

export type UserAuthRecord = Pick<
  User,
  | 'id'
  | 'email'
  | 'passwordHash'
  | 'status'
  | 'authProvider'
  | 'googleSub'
  | 'emailVerifiedAt'
>;

export function toPublicUser(user: User): PublicUser {
  const { passwordHash, ...publicUser } = user;
  void passwordHash;
  return publicUser;
}

export function toUserAuthRecord(user: User): UserAuthRecord {
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    status: user.status,
    authProvider: user.authProvider,
    googleSub: user.googleSub,
    emailVerifiedAt: user.emailVerifiedAt,
  };
}
