import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type User } from '../../../generated/prisma/client';
import { RoleRepository } from '../../repositories/role.repository';
import { UserRepository } from '../../repositories/user.repository';
import { AccessTokenService } from './access-token.service';
import {
  AuthorizationService,
  type EffectiveAuthorization,
} from '../authorization/authorization.service';
import { AUTH_PROVIDER, ROLE_CODE } from '../constants/iam-auth';
import {
  USER_STATUS,
  hasVerifiedEmail,
  isActiveUserStatus,
} from '../constants/iam-status';
import {
  toPublicUser,
  type PublicUser,
  type UserAuthRecord,
} from '../users/users.mapper';
import { PasswordHasher } from './password-hasher';
import {
  RefreshTokenService,
  type IssuedRefreshSession,
} from './refresh-token.service';
import { UsersService } from '../users/users.service';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_SECRET_LENGTH = 8;
const MAX_SECRET_LENGTH = 128;
const MAX_FULL_NAME_LENGTH = 150;
const INVALID_CREDENTIALS = 'Invalid credentials';

export type RegisterCustomerInput = {
  fullName: string;
  email: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type AuthSession = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
  refreshExpiresInSeconds: number;
};

export type AccessPrincipal = {
  user: PublicUser;
  emailVerified: boolean;
  authorization: EffectiveAuthorization;
  claims: {
    sub: string;
    iss: string;
    aud: string;
    iat: number;
    exp: number;
    jti: string;
  };
};

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name);

  constructor(
    private readonly users: UsersService,
    private readonly userRepository: UserRepository,
    private readonly roles: RoleRepository,
    private readonly authorization: AuthorizationService,
    private readonly passwords: PasswordHasher,
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  async registerCustomer(input: RegisterCustomerInput): Promise<AuthSession> {
    const fullName = normalizeFullName(input.fullName);
    const email = normalizeEmail(input.email);
    assertValidPassword(input.password);

    const existing = await this.users.findAuthByEmail(email);
    if (existing !== null) {
      throw new ConflictException('Email already registered');
    }

    const customerRole = await this.roles.findByCode(ROLE_CODE.CUSTOMER);
    if (customerRole === null || !customerRole.isActive) {
      this.logger.error(
        customerRole === null
          ? 'IAM configuration error: system role CUSTOMER is missing; public registration cannot proceed'
          : 'IAM configuration error: system role CUSTOMER is inactive; public registration cannot proceed',
      );
      throw new ServiceUnavailableException(
        'Customer registration is unavailable',
      );
    }

    const passwordHash = await this.passwords.hash(input.password);

    let created: User;
    try {
      created = await this.userRepository.createWithRoleAssignment(
        {
          email,
          fullName,
          passwordHash,
          authProvider: AUTH_PROVIDER.LOCAL,
          status: USER_STATUS.ACTIVE,
          emailVerifiedAt: null,
        },
        customerRole.id,
      );
    } catch (error) {
      if (isEmailUniqueViolation(error)) {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }

    return this.issueSession(created);
  }

  async login(input: LoginInput): Promise<AuthSession> {
    const email = normalizeEmail(input.email);
    assertValidPassword(input.password);

    const record = await this.users.findAuthByEmail(email);
    if (!canAttemptLocalLogin(record)) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const matches = await this.passwords.verify(
      record.passwordHash,
      input.password,
    );
    if (!matches || !isActiveUserStatus(record.status)) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const updated = await this.userRepository.updateById(record.id, {
      lastLoginAt: new Date(),
    });

    return this.issueSession(updated);
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    const rotated = await this.refreshTokens.rotate(refreshToken);
    const user = await this.users.findById(rotated.userId);
    if (user === null || !isActiveUserStatus(user.status)) {
      await this.refreshTokens.logoutAll(rotated.userId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const signed = this.accessTokens.sign(user.id);
    return {
      user,
      accessToken: signed.token,
      refreshToken: rotated.refreshToken,
      tokenType: 'Bearer',
      expiresInSeconds: signed.expiresInSeconds,
      refreshExpiresInSeconds: rotated.refreshExpiresInSeconds,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokens.logout(refreshToken);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokens.logoutAll(userId);
  }

  async verifyAccessToken(token: string): Promise<AccessPrincipal> {
    const claims = this.accessTokens.verify(token);
    const user = await this.users.findById(claims.sub);
    if (user === null || !isActiveUserStatus(user.status)) {
      throw new UnauthorizedException('Unauthenticated');
    }

    const authorization = await this.authorization.getEffectiveAuthorization(
      user.id,
    );

    return {
      user,
      emailVerified: hasVerifiedEmail(user.emailVerifiedAt),
      authorization,
      claims,
    };
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

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new BadRequestException('Email is invalid');
  }
  return normalized;
}

function normalizeFullName(fullName: string): string {
  const normalized = fullName.trim().replace(/\s+/g, ' ');
  if (normalized.length === 0 || normalized.length > MAX_FULL_NAME_LENGTH) {
    throw new BadRequestException('Full name is invalid');
  }
  return normalized;
}

function assertValidPassword(password: string): void {
  if (
    password.length < MIN_SECRET_LENGTH ||
    password.length > MAX_SECRET_LENGTH
  ) {
    throw new BadRequestException('Credentials do not meet requirements');
  }
}

function canAttemptLocalLogin(
  record: UserAuthRecord | null,
): record is UserAuthRecord & { passwordHash: string } {
  if (record === null || record.passwordHash === null) {
    return false;
  }

  if (record.authProvider === AUTH_PROVIDER.GOOGLE) {
    return false;
  }

  return true;
}

function isEmailUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
