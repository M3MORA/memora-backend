import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'node:crypto';
import {
  PURPOSE_EMAIL_VERIFICATION,
  RedisPurposeTokenStore,
} from '../../persistence/redis/purpose-token.store';
import { UserRepository } from '../../repositories/user.repository';
import { USER_STATUS, hasVerifiedEmail } from '../constants/iam-status';
import { EMAIL_SENDER, type EmailSender } from './email-sender';
import { toPublicUser, type PublicUser } from '../users/users.mapper';

const INVALID_REQUEST = 'Invalid verification request';

@Injectable()
export class EmailVerificationService {
  private readonly pepper: string;
  private readonly ttlSeconds: number;
  private readonly cooldownSeconds: number;
  private readonly rateMax: number;
  private readonly rateWindowSeconds: number;
  private readonly actionBaseUrl: string;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokens: RedisPurposeTokenStore,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
    configService: ConfigService,
  ) {
    this.pepper = configService.getOrThrow<string>('iam.purposeTokenPepper');
    this.ttlSeconds = configService.getOrThrow<number>(
      'iam.emailVerificationTtlSeconds',
    );
    this.cooldownSeconds = configService.getOrThrow<number>(
      'iam.emailVerificationCooldownSeconds',
    );
    this.rateMax = configService.getOrThrow<number>('iam.emailRateLimitMax');
    this.rateWindowSeconds = configService.getOrThrow<number>(
      'iam.emailRateLimitWindowSeconds',
    );
    this.actionBaseUrl = configService.getOrThrow<string>(
      'iam.emailActionBaseUrl',
    );
  }

  async request(userId: string): Promise<{ alreadyVerified: boolean }> {
    const user = await this.userRepository.findById(userId);
    if (user === null || user.status === USER_STATUS.DISABLED) {
      throw new UnauthorizedException(INVALID_REQUEST);
    }
    if (hasVerifiedEmail(user.emailVerifiedAt)) {
      return { alreadyVerified: true };
    }

    await this.enforceLimits(user.id);
    const secret = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(this.pepper, secret);
    await this.tokens.issue(
      PURPOSE_EMAIL_VERIFICATION,
      user.id,
      tokenHash,
      this.ttlSeconds,
    );

    try {
      await this.emailSender.send({
        to: user.email,
        template: 'email-verification',
        actionUrl: `${this.actionBaseUrl}/verify-email?token=${secret}`,
      });
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException('Email delivery is unavailable');
    }

    return { alreadyVerified: false };
  }

  async confirm(token: string): Promise<PublicUser> {
    const tokenHash = hashToken(this.pepper, token);
    const claimed = await this.tokens.claim(
      PURPOSE_EMAIL_VERIFICATION,
      tokenHash,
    );
    if (claimed.status === 'in_flight') {
      throw new HttpException(
        'Please try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (claimed.status === 'missing') {
      throw new UnauthorizedException(INVALID_REQUEST);
    }

    const user = await this.userRepository.findById(claimed.userId);
    if (user === null || user.status === USER_STATUS.DISABLED) {
      await this.tokens.complete(tokenHash);
      throw new UnauthorizedException(INVALID_REQUEST);
    }

    if (hasVerifiedEmail(user.emailVerifiedAt)) {
      await this.tokens.complete(tokenHash);
      return toPublicUser(user);
    }

    const updated = await this.userRepository.updateById(user.id, {
      emailVerifiedAt: new Date(),
    });
    await this.tokens.complete(tokenHash);
    return toPublicUser(updated);
  }

  private async enforceLimits(userId: string): Promise<void> {
    const count = await this.tokens.incrementRate(
      PURPOSE_EMAIL_VERIFICATION,
      userId,
      this.rateWindowSeconds,
    );
    if (count > this.rateMax) {
      throw new HttpException(
        'Please try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const allowed = await this.tokens.acquireCooldown(
      PURPOSE_EMAIL_VERIFICATION,
      userId,
      this.cooldownSeconds,
    );
    if (!allowed) {
      throw new HttpException(
        'Please try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}

function hashToken(pepper: string, secret: string): string {
  return createHmac('sha256', pepper).update(secret).digest('base64url');
}
