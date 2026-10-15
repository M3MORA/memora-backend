import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import {
  PURPOSE_PASSWORD_RESET,
  RedisPurposeTokenStore,
} from '../../persistence/redis/purpose-token.store';
import { UserRepository } from '../../repositories/user.repository';
import { AUTH_PROVIDER } from '../constants/iam-auth';
import { USER_STATUS } from '../constants/iam-status';
import { EMAIL_SENDER, type EmailSender } from './email-sender';
import { assertValidPassword, normalizeEmail } from './identity-input';
import { PasswordHasher } from './password-hasher';
import { RefreshTokenService } from './refresh-token.service';
import { UsersService } from '../users/users.service';

const ACCEPTED = { accepted: true } as const;
const INVALID_REQUEST = 'Invalid recovery request';

@Injectable()
export class PasswordRecoveryService {
  private readonly pepper: string;
  private readonly ttlSeconds: number;
  private readonly cooldownSeconds: number;
  private readonly rateMax: number;
  private readonly rateWindowSeconds: number;
  private readonly actionBaseUrl: string;

  constructor(
    private readonly users: UsersService,
    private readonly userRepository: UserRepository,
    private readonly tokens: RedisPurposeTokenStore,
    private readonly passwords: PasswordHasher,
    private readonly refreshTokens: RefreshTokenService,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
    configService: ConfigService,
  ) {
    this.pepper = configService.getOrThrow<string>('iam.purposeTokenPepper');
    this.ttlSeconds = configService.getOrThrow<number>(
      'iam.passwordResetTtlSeconds',
    );
    this.cooldownSeconds = configService.getOrThrow<number>(
      'iam.passwordResetCooldownSeconds',
    );
    this.rateMax = configService.getOrThrow<number>('iam.emailRateLimitMax');
    this.rateWindowSeconds = configService.getOrThrow<number>(
      'iam.emailRateLimitWindowSeconds',
    );
    this.actionBaseUrl = configService.getOrThrow<string>(
      'iam.emailActionBaseUrl',
    );
  }

  async forgotPassword(email: string): Promise<{ accepted: true }> {
    const normalized = normalizeEmail(email);
    const rateSubject = createHash('sha256').update(normalized).digest('hex');
    await this.enforceLimits(rateSubject);

    const record = await this.users.findAuthByEmail(normalized);
    if (
      record === null ||
      !canReceivePasswordReset(
        record.status,
        record.authProvider,
        record.passwordHash,
      )
    ) {
      return ACCEPTED;
    }

    const secret = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(this.pepper, secret);
    await this.tokens.issue(
      PURPOSE_PASSWORD_RESET,
      record.id,
      tokenHash,
      this.ttlSeconds,
    );

    try {
      await this.emailSender.send({
        to: record.email,
        template: 'password-reset',
        actionUrl: `${this.actionBaseUrl}/reset-password?token=${secret}`,
      });
    } catch {
      return ACCEPTED;
    }

    return ACCEPTED;
  }

  private async enforceLimits(subject: string): Promise<void> {
    const count = await this.tokens.incrementRate(
      PURPOSE_PASSWORD_RESET,
      subject,
      this.rateWindowSeconds,
    );
    if (count > this.rateMax) {
      throw tooManyRequests();
    }
    const allowed = await this.tokens.acquireCooldown(
      PURPOSE_PASSWORD_RESET,
      subject,
      this.cooldownSeconds,
    );
    if (!allowed) {
      throw tooManyRequests();
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    assertValidPassword(newPassword);
    const tokenHash = hashToken(this.pepper, token);
    const claimed = await this.tokens.claim(PURPOSE_PASSWORD_RESET, tokenHash);
    if (claimed.status === 'in_flight') {
      throw tooManyRequests();
    }
    if (claimed.status === 'missing') {
      throw new UnauthorizedException(INVALID_REQUEST);
    }

    const user = await this.userRepository.findById(claimed.userId);
    if (
      user === null ||
      !canReceivePasswordReset(
        user.status,
        user.authProvider,
        user.passwordHash,
      )
    ) {
      await this.tokens.complete(tokenHash);
      throw new UnauthorizedException(INVALID_REQUEST);
    }

    const passwordHash = await this.passwords.hash(newPassword);
    await this.userRepository.updateById(user.id, { passwordHash });
    await this.refreshTokens.logoutAll(user.id);
    await this.tokens.complete(tokenHash);
  }
}

function canReceivePasswordReset(
  status: string | undefined,
  authProvider: string | undefined,
  passwordHash: string | null | undefined,
): boolean {
  if (status !== USER_STATUS.ACTIVE && status !== USER_STATUS.LOCKED) {
    return false;
  }
  if (authProvider === AUTH_PROVIDER.GOOGLE) {
    return false;
  }
  return passwordHash !== null && passwordHash !== undefined;
}

function hashToken(pepper: string, secret: string): string {
  return createHmac('sha256', pepper).update(secret).digest('base64url');
}

function tooManyRequests(): HttpException {
  return new HttpException(
    'Please try again later',
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
