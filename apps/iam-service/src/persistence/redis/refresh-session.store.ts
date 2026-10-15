import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { RedisService } from './redis.service';

export type RefreshSessionRecord = {
  sessionId: string;
  userId: string;
  tokenHash: string;
  previousTokenHash: string | null;
  previousValidUntilMs: number | null;
  createdAtMs: number;
  absoluteExpiresAtMs: number;
  revoked: boolean;
};

export type RotateSessionResult =
  | { status: 'rotated'; session: RefreshSessionRecord }
  | { status: 'stale'; session: RefreshSessionRecord }
  | { status: 'mismatch' }
  | { status: 'missing' };

const SESSION_KEY_PREFIX = 'iam:rt:session:';
const USER_SESSIONS_KEY_PREFIX = 'iam:rt:user:';

const ROTATE_SCRIPT = `
local key = KEYS[1]
local expected = ARGV[1]
local nextJson = ARGV[2]
local ttl = tonumber(ARGV[3])
local now = tonumber(ARGV[4])
local current = redis.call('GET', key)
if not current then
  return 'missing'
end
local session = cjson.decode(current)
if session.revoked then
  return 'mismatch'
end
if session.tokenHash == expected then
  redis.call('SET', key, nextJson, 'EX', ttl)
  return 'rotated'
end
if session.previousTokenHash == expected
  and session.previousValidUntilMs
  and now < tonumber(session.previousValidUntilMs) then
  return 'stale|' .. current
end
return 'mismatch'
`;

@Injectable()
export class RedisRefreshSessionStore {
  constructor(private readonly redis: RedisService) {}

  async save(session: RefreshSessionRecord, ttlSeconds: number): Promise<void> {
    try {
      const client = this.redis.getClient();
      const pipeline = client.multi();
      pipeline.set(
        sessionKey(session.sessionId),
        serialize(session),
        'EX',
        ttlSeconds,
      );
      pipeline.sadd(userSessionsKey(session.userId), session.sessionId);
      pipeline.expire(userSessionsKey(session.userId), ttlSeconds);
      await pipeline.exec();
    } catch (error) {
      throwToUnavailable(error);
    }
  }

  async getBySessionId(
    sessionId: string,
  ): Promise<RefreshSessionRecord | null> {
    try {
      const raw = await this.redis.getClient().get(sessionKey(sessionId));
      return raw === null ? null : parseSession(raw);
    } catch (error) {
      throwToUnavailable(error);
    }
  }

  async rotate(
    sessionId: string,
    expectedHash: string,
    next: RefreshSessionRecord,
    ttlSeconds: number,
    nowMs: number,
  ): Promise<RotateSessionResult> {
    try {
      const result = await this.redis
        .getClient()
        .eval(
          ROTATE_SCRIPT,
          1,
          sessionKey(sessionId),
          expectedHash,
          serialize(next),
          String(ttlSeconds),
          String(nowMs),
        );

      if (typeof result !== 'string') {
        return { status: 'missing' };
      }
      if (result === 'rotated') {
        return { status: 'rotated', session: next };
      }
      if (result === 'mismatch') {
        return { status: 'mismatch' };
      }
      if (result === 'missing') {
        return { status: 'missing' };
      }
      if (result.startsWith('stale|')) {
        return {
          status: 'stale',
          session: parseSession(result.slice('stale|'.length)),
        };
      }
      return { status: 'missing' };
    } catch (error) {
      throwToUnavailable(error);
    }
  }

  async revoke(sessionId: string, userId: string): Promise<void> {
    try {
      const client = this.redis.getClient();
      const pipeline = client.multi();
      pipeline.del(sessionKey(sessionId));
      pipeline.srem(userSessionsKey(userId), sessionId);
      await pipeline.exec();
    } catch (error) {
      throwToUnavailable(error);
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    try {
      const client = this.redis.getClient();
      const sessionIds = await client.smembers(userSessionsKey(userId));
      if (sessionIds.length === 0) {
        return;
      }
      const pipeline = client.multi();
      for (const sessionId of sessionIds) {
        pipeline.del(sessionKey(sessionId));
      }
      pipeline.del(userSessionsKey(userId));
      await pipeline.exec();
    } catch (error) {
      throwToUnavailable(error);
    }
  }
}

function sessionKey(sessionId: string): string {
  return `${SESSION_KEY_PREFIX}${sessionId}`;
}

function userSessionsKey(userId: string): string {
  return `${USER_SESSIONS_KEY_PREFIX}${userId}`;
}

function serialize(session: RefreshSessionRecord): string {
  return JSON.stringify(session);
}

function parseSession(raw: string): RefreshSessionRecord {
  const parsed: unknown = JSON.parse(raw);
  if (!isRefreshSessionRecord(parsed)) {
    throw new ServiceUnavailableException('Session store unavailable');
  }
  return parsed;
}

function isRefreshSessionRecord(value: unknown): value is RefreshSessionRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.sessionId === 'string' &&
    typeof record.userId === 'string' &&
    typeof record.tokenHash === 'string' &&
    (record.previousTokenHash === null ||
      typeof record.previousTokenHash === 'string') &&
    (record.previousValidUntilMs === null ||
      typeof record.previousValidUntilMs === 'number') &&
    typeof record.createdAtMs === 'number' &&
    typeof record.absoluteExpiresAtMs === 'number' &&
    typeof record.revoked === 'boolean'
  );
}

function throwToUnavailable(error: unknown): never {
  if (error instanceof ServiceUnavailableException) {
    throw error;
  }
  throw new ServiceUnavailableException('Session store unavailable');
}
