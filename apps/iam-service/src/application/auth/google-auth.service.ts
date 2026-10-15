import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type User } from '../../../generated/prisma/client';
import { RoleRepository } from '../../repositories/role.repository';
import { UserRepository } from '../../repositories/user.repository';
import { AUTH_PROVIDER, ROLE_CODE } from '../constants/iam-auth';
import { isActiveUserStatus, USER_STATUS } from '../constants/iam-status';
import { toPublicUser, type PublicUser } from '../users/users.mapper';
import { UsersService } from '../users/users.service';
import { AccessTokenService } from './access-token.service';
import type { AuthSession } from './authentication.service';
import {
  GoogleIdTokenVerifier,
  type VerifiedGoogleIdentity,
} from './google-id-token.verifier';
import {
  RefreshTokenService,
  type IssuedRefreshSession,
} from './refresh-token.service';

const EMAIL_ALREADY_REGISTERED =
  'This email is already registered. Sign in with your existing account.';
const UNABLE_TO_SIGN_IN = 'Unable to sign in';

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);

  constructor(
    private readonly tokens: GoogleIdTokenVerifier,
    private readonly users: UsersService,
    private readonly userRepository: UserRepository,
    private readonly roles: RoleRepository,
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  async authenticate(idToken: string): Promise<AuthSession> {
    const identity = await this.tokens.verify(idToken);
    const existing = await this.userRepository.findByGoogleSub(
      identity.googleSub,
    );
    if (existing !== null) {
      return this.signInExisting(existing);
    }
    return this.registerGoogleCustomer(identity);
  }

  private async signInExisting(user: User): Promise<AuthSession> {
    if (!isActiveUserStatus(user.status)) {
      throw new UnauthorizedException(UNABLE_TO_SIGN_IN);
    }
    const updated = await this.userRepository.updateById(user.id, {
      lastLoginAt: new Date(),
    });
    return this.issueSession(updated);
  }

  private async registerGoogleCustomer(
    identity: VerifiedGoogleIdentity,
  ): Promise<AuthSession> {
    const email = identity.email.trim().toLowerCase();
    const colliding = await this.users.findAuthByEmail(email);
    if (colliding !== null) {
      throw new ConflictException(EMAIL_ALREADY_REGISTERED);
    }

    const customerRole = await this.roles.findByCode(ROLE_CODE.CUSTOMER);
    if (customerRole === null || !customerRole.isActive) {
      this.logger.error(
        'IAM configuration error: system role CUSTOMER is missing or inactive; Google registration cannot proceed',
      );
      throw new ServiceUnavailableException(
        'Customer registration is unavailable',
      );
    }

    try {
      const created = await this.userRepository.createWithRoleAssignment(
        {
          email,
          fullName: identity.fullName,
          googleSub: identity.googleSub,
          authProvider: AUTH_PROVIDER.GOOGLE,
          status: USER_STATUS.ACTIVE,
          emailVerifiedAt: new Date(),
          lastLoginAt: new Date(),
          passwordHash: null,
        },
        customerRole.id,
      );
      return this.issueSession(created);
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      const raced = await this.userRepository.findByGoogleSub(
        identity.googleSub,
      );
      if (raced !== null) {
        return this.signInExisting(raced);
      }
      throw new ConflictException(EMAIL_ALREADY_REGISTERED);
    }
  }

  private async issueSession(user: User): Promise<AuthSession> {
    const refresh = await this.refreshTokens.createSession(user.id);
    return this.toAuthSession(toPublicUser(user), refresh);
  }

  private toAuthSession(
    user: PublicUser,
    refresh: IssuedRefreshSession,
  ): AuthSession {
    const signed = this.accessTokens.sign(user.id);
    return {
      user,
      accessToken: signed.token,
      refreshToken: refresh.refreshToken,
      tokenType: 'Bearer',
      expiresInSeconds: signed.expiresInSeconds,
      refreshExpiresInSeconds: refresh.refreshExpiresInSeconds,
    };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
