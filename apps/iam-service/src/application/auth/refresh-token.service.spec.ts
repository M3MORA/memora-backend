import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenService } from './refresh-token.service';
import {
  RedisRefreshSessionStore,
  type RefreshSessionRecord,
} from '../../persistence/redis/refresh-session.store';

describe('RefreshTokenService', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const nowMs = Date.now();

  let sessions: {
    save: jest.Mock;
    rotate: jest.Mock;
    getBySessionId: jest.Mock;
    revoke: jest.Mock;
    revokeAllForUser: jest.Mock;
  };
  let service: RefreshTokenService;

  beforeEach(() => {
    sessions = {
      save: jest.fn().mockResolvedValue(undefined),
      rotate: jest.fn(),
      getBySessionId: jest.fn(),
      revoke: jest.fn().mockResolvedValue(undefined),
      revokeAllForUser: jest.fn().mockResolvedValue(undefined),
    };
    const config = {
      getOrThrow: (key: string): string | number => {
        const values: Record<string, string | number> = {
          'iam.refreshPepper': 'refresh-pepper-value-32-chars-min',
          'iam.refreshIdleTtlSeconds': 3600,
          'iam.refreshAbsoluteTtlSeconds': 7200,
          'iam.refreshReuseGraceSeconds': 10,
        };
        const value = values[key];
        if (value === undefined) {
          throw new Error(key);
        }
        return value;
      },
    };
    service = new RefreshTokenService(
      sessions as unknown as RedisRefreshSessionStore,
      config as unknown as ConfigService,
    );
  });

  it('creates a session without changing store TTL contract', async () => {
    const issued = await service.createSession(userId);
    expect(issued.userId).toBe(userId);
    expect(issued.refreshToken).toContain('.');
    expect(sessions.save).toHaveBeenCalledTimes(1);
    const saved = firstSaveRecord();
    expect(saved.userId).toBe(userId);
    expect(saved.revoked).toBe(false);
  });

  it('rotates a valid refresh token', async () => {
    const issued = await service.createSession(userId);
    const current = firstSaveRecord();
    sessions.getBySessionId.mockResolvedValue(current);
    sessions.rotate.mockResolvedValue({ status: 'rotated', session: current });
    const rotated = await service.rotate(issued.refreshToken);
    expect(rotated.sessionId).toBe(issued.sessionId);
    expect(rotated.refreshToken).not.toBe(issued.refreshToken);
  });

  it('rejects replay of the previous token (stale)', async () => {
    const issued = await service.createSession(userId);
    const current = firstSaveRecord();
    sessions.getBySessionId.mockResolvedValue(current);
    sessions.rotate.mockResolvedValue({
      status: 'stale',
      session: {
        ...current,
        previousTokenHash: current.tokenHash,
        previousValidUntilMs: nowMs + 5000,
      },
    });
    await expect(service.rotate(issued.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(sessions.revoke).not.toHaveBeenCalled();
  });

  it('revokes on mismatch (reuse outside grace)', async () => {
    const issued = await service.createSession(userId);
    const current = firstSaveRecord();
    sessions.getBySessionId.mockResolvedValue(current);
    sessions.rotate.mockResolvedValue({ status: 'mismatch' });
    await expect(service.rotate(issued.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(sessions.revoke).toHaveBeenCalledWith(current.sessionId, userId);
  });

  it('maps store failures to 503 without leaking Redis errors', async () => {
    sessions.save.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(service.createSession(userId)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  function firstSaveRecord(): RefreshSessionRecord {
    const rows = sessions.save.mock.calls as readonly unknown[];
    const row = rows[0];
    if (!Array.isArray(row)) {
      throw new Error('expected save call');
    }
    const record: unknown = row[0];
    return record as RefreshSessionRecord;
  }
});
