import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { RedisService } from './redis.service';

export const PURPOSE_EMAIL_VERIFICATION = 'email-verification';
export const PURPOSE_PASSWORD_RESET = 'password-reset';

export type PurposeTokenPurpose =
  typeof PURPOSE_EMAIL_VERIFICATION | typeof PURPOSE_PASSWORD_RESET;

export type PurposeTokenRecord = {
  userId: string;
  purpose: PurposeTokenPurpose;
  status: 'active' | 'pending';
  claimedAtMs: number | null;
};

export type ClaimPurposeTokenResult =
  | { status: 'ok'; userId: string }
  | { status: 'retry'; userId: string }
  | { status: 'in_flight' }
  | { status: 'missing' };

const TOKEN_KEY_PREFIX = 'iam:em:token:';
const USER_KEY_PREFIX = 'iam:em:user:';
const COOLDOWN_KEY_PREFIX = 'iam:em:cd:';
const RATE_KEY_PREFIX = 'iam:em:rl:';
const CLAIM_GRACE_MS = 5_000;

const ISSUE_SCRIPT = `
local tokenKey = KEYS[1]
local userKey = KEYS[2]
local payload = ARGV[1]
local ttl = tonumber(ARGV[2])
local previous = redis.call('GET', userKey)
if previous then
  redis.call('DEL', 'iam:em:token:' .. previous)
end
redis.call('SET', tokenKey, payload, 'EX', ttl)
redis.call('SET', userKey, ARGV[3], 'EX', ttl)
return 'ok'
`;

const CLAIM_SCRIPT = `
local tokenKey = KEYS[1]
local expectedPurpose = ARGV[1]
local now = tonumber(ARGV[2])
local grace = tonumber(ARGV[3])
local current = redis.call('GET', tokenKey)
if not current then
  return 'missing'
end
local record = cjson.decode(current)
if record.purpose ~= expectedPurpose then
  return 'missing'
end
if record.status == 'active' then
  record.status = 'pending'
  record.claimedAtMs = now
  redis.call('SET', tokenKey, cjson.encode(record), 'KEEPTTL')
  return 'ok|' .. record.userId
end
if record.status == 'pending' then
  local claimedAt = tonumber(record.claimedAtMs)
  if claimedAt and now - claimedAt < grace then
    return 'in_flight'
  end
  return 'retry|' .. record.userId
end
return 'missing'
`;

@Injectable()
export class RedisPurposeTokenStore {
  constructor(private readonly redis: RedisService) {}

  async issue(
    purpose: PurposeTokenPurpose,
    userId: string,
    tokenHash: string,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      const record: PurposeTokenRecord = {
        userId,
        purpose,
        status: 'active',
        claimedAtMs: null,
      };
      await this.redis
        .getClient()
        .eval(
          ISSUE_SCRIPT,
          2,
          tokenKey(tokenHash),
          userKey(purpose, userId),
          JSON.stringify(record),
          String(ttlSeconds),
          tokenHash,
        );
    } catch (error) {
      throwUnavailable(error);
    }
  }

  async claim(
    purpose: PurposeTokenPurpose,
    tokenHash: string,
  ): Promise<ClaimPurposeTokenResult> {
    try {
      const result = await this.redis
        .getClient()
        .eval(
          CLAIM_SCRIPT,
          1,
          tokenKey(tokenHash),
          purpose,
          String(Date.now()),
          String(CLAIM_GRACE_MS),
        );
      if (typeof result !== 'string') {
        return { status: 'missing' };
      }
      if (result === 'missing' || result === 'in_flight') {
        return { status: result };
      }
      if (result.startsWith('ok|')) {
        return { status: 'ok', userId: result.slice(3) };
      }
      if (result.startsWith('retry|')) {
        return { status: 'retry', userId: result.slice(6) };
      }
      return { status: 'missing' };
    } catch (error) {
      throwUnavailable(error);
    }
  }

  async complete(tokenHash: string): Promise<void> {
    try {
      await this.redis.getClient().del(tokenKey(tokenHash));
    } catch (error) {
      throwUnavailable(error);
    }
  }

  async acquireCooldown(
    purpose: PurposeTokenPurpose,
    subject: string,
    cooldownSeconds: number,
  ): Promise<boolean> {
    try {
      const result = await this.redis
        .getClient()
        .set(cooldownKey(purpose, subject), '1', 'EX', cooldownSeconds, 'NX');
      return result === 'OK';
    } catch (error) {
      throwUnavailable(error);
    }
  }

  async incrementRate(
    purpose: PurposeTokenPurpose,
    subject: string,
    windowSeconds: number,
  ): Promise<number> {
    try {
      const key = rateKey(purpose, subject);
      const client = this.redis.getClient();
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, windowSeconds);
      }
      return count;
    } catch (error) {
      throwUnavailable(error);
    }
  }
}

function tokenKey(tokenHash: string): string {
  return `${TOKEN_KEY_PREFIX}${tokenHash}`;
}

function userKey(purpose: PurposeTokenPurpose, userId: string): string {
  return `${USER_KEY_PREFIX}${purpose}:${userId}`;
}

function cooldownKey(purpose: PurposeTokenPurpose, subject: string): string {
  return `${COOLDOWN_KEY_PREFIX}${purpose}:${subject}`;
}

function rateKey(purpose: PurposeTokenPurpose, subject: string): string {
  return `${RATE_KEY_PREFIX}${purpose}:${subject}`;
}

function throwUnavailable(error: unknown): never {
  if (error instanceof ServiceUnavailableException) {
    throw error;
  }
  throw new ServiceUnavailableException('Session store unavailable');
}
