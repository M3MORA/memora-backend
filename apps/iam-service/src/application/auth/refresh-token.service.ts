import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import {
  RedisRefreshSessionStore,
  type RefreshSessionRecord,
} from '../../persistence/redis/refresh-session.store';

const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type IssuedRefreshSession = {
  sessionId: string;
  userId: string;
  refreshToken: string;
  refreshExpiresInSeconds: number;
};

@Injectable()
export class RefreshTokenService {
  private readonly pepper: string;
  private readonly idleTtlSeconds: number;
  private readonly absoluteTtlSeconds: number;
  private readonly reuseGraceMs: number;

  constructor(
    private readonly sessions: RedisRefreshSessionStore,
    configService: ConfigService,
  ) {
    this.pepper = configService.getOrThrow<string>('iam.refreshPepper');
    this.idleTtlSeconds = configService.getOrThrow<number>(
      'iam.refreshIdleTtlSeconds',
    );
    this.absoluteTtlSeconds = configService.getOrThrow<number>(
      'iam.refreshAbsoluteTtlSeconds',
    );
    this.reuseGraceMs =
      configService.getOrThrow<number>('iam.refreshReuseGraceSeconds') * 1000;
  }

  async createSession(userId: string): Promise<IssuedRefreshSession> {
    const nowMs = Date.now();
    const sessionId = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    const tokenHash = this.hashSecret(secret);
    const absoluteExpiresAtMs = nowMs + this.absoluteTtlSeconds * 1000;
    const ttlSeconds = this.ttlUntil(nowMs, absoluteExpiresAtMs);

    try {
      await this.sessions.save(
        {
          sessionId,
          userId,
          tokenHash,
          previousTokenHash: null,
          previousValidUntilMs: null,
          createdAtMs: nowMs,
          absoluteExpiresAtMs,
          revoked: false,
        },
        ttlSeconds,
      );
    } catch (error) {
      throwUnavailable(error);
    }

    return {
      sessionId,
      userId,
      refreshToken: formatRefreshToken(sessionId, secret),
      refreshExpiresInSeconds: ttlSeconds,
    };
  }

  async rotate(refreshToken: string): Promise<IssuedRefreshSession> {
    const parsed = parseRefreshToken(refreshToken);
    const presentedHash = this.hashSecret(parsed.secret);
    const current = await this.readSession(parsed.sessionId);
    if (Date.now() >= current.absoluteExpiresAtMs) {
      await this.revokeSession(current.sessionId, current.userId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const nowMs = Date.now();
    const nextSecret = randomBytes(32).toString('base64url');
    const nextHash = this.hashSecret(nextSecret);
    const next: RefreshSessionRecord = {
      ...current,
      tokenHash: nextHash,
      previousTokenHash: current.tokenHash,
      previousValidUntilMs: nowMs + this.reuseGraceMs,
    };
    const ttlSeconds = this.ttlUntil(nowMs, current.absoluteExpiresAtMs);

    let result: Awaited<ReturnType<RedisRefreshSessionStore['rotate']>>;
    try {
      result = await this.sessions.rotate(
        current.sessionId,
        presentedHash,
        next,
        ttlSeconds,
        nowMs,
      );
    } catch (error) {
      throwUnavailable(error);
    }

    if (result.status === 'rotated') {
      return {
        sessionId: current.sessionId,
        userId: current.userId,
        refreshToken: formatRefreshToken(current.sessionId, nextSecret),
        refreshExpiresInSeconds: ttlSeconds,
      };
    }

    if (result.status === 'stale') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.revokeSession(current.sessionId, current.userId);
    throw new UnauthorizedException('Invalid refresh token');
  }

  async logout(refreshToken: string): Promise<void> {
    const parsed = parseRefreshToken(refreshToken);
    const presentedHash = this.hashSecret(parsed.secret);
    const current = await this.sessions.getBySessionId(parsed.sessionId);
    if (current === null) {
      return;
    }
    if (!hashesMatch(current.tokenHash, presentedHash)) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.revokeSession(current.sessionId, current.userId);
  }

  async logoutAll(userId: string): Promise<void> {
    try {
      await this.sessions.revokeAllForUser(userId);
    } catch (error) {
      throwUnavailable(error);
    }
  }

  private async readSession(sessionId: string): Promise<RefreshSessionRecord> {
    let current: RefreshSessionRecord | null;
    try {
      current = await this.sessions.getBySessionId(sessionId);
    } catch (error) {
      throwUnavailable(error);
    }
    if (current === null || current.revoked) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return current;
  }

  private async revokeSession(
    sessionId: string,
    userId: string,
  ): Promise<void> {
    try {
      await this.sessions.revoke(sessionId, userId);
    } catch (error) {
      throwUnavailable(error);
    }
  }

  private hashSecret(secret: string): string {
    return createHmac('sha256', this.pepper).update(secret).digest('base64url');
  }

  private ttlUntil(nowMs: number, absoluteExpiresAtMs: number): number {
    const remainingAbsolute = Math.floor((absoluteExpiresAtMs - nowMs) / 1000);
    const ttl = Math.min(this.idleTtlSeconds, remainingAbsolute);
    if (ttl <= 0) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return ttl;
  }
}

function parseRefreshToken(token: string): {
  sessionId: string;
  secret: string;
} {
  const separator = token.indexOf('.');
  if (separator <= 0 || separator === token.length - 1) {
    throw new UnauthorizedException('Invalid refresh token');
  }
  const sessionId = token.slice(0, separator);
  const secret = token.slice(separator + 1);
  if (!SESSION_ID_PATTERN.test(sessionId) || secret.length < 32) {
    throw new UnauthorizedException('Invalid refresh token');
  }
  return { sessionId, secret };
}

function formatRefreshToken(sessionId: string, secret: string): string {
  return `${sessionId}.${secret}`;
}

function hashesMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function throwUnavailable(error: unknown): never {
  if (error instanceof ServiceUnavailableException) {
    throw error;
  }
  if (error instanceof UnauthorizedException) {
    throw error;
  }
  throw new ServiceUnavailableException('Session store unavailable');
}
