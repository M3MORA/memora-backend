import { RedisRefreshSessionStore } from './refresh-session.store';
import { RedisService } from './redis.service';

describe('RedisRefreshSessionStore', () => {
  const session = {
    sessionId: '22222222-2222-4222-8222-222222222222',
    userId: '11111111-1111-4111-8111-111111111111',
    tokenHash: 'current-hash',
    previousTokenHash: null,
    previousValidUntilMs: null,
    createdAtMs: Date.now(),
    absoluteExpiresAtMs: Date.now() + 60_000,
    revoked: false,
  };

  it('saves session keys under iam:rt prefixes', async () => {
    const set = jest.fn();
    const sadd = jest.fn();
    const expire = jest.fn();
    const exec = jest.fn().mockResolvedValue([]);
    const store = new RedisRefreshSessionStore({
      getClient: () => ({
        multi: () => ({ set, sadd, expire, exec }),
      }),
    } as unknown as RedisService);
    await store.save(session, 120);
    expect(set).toHaveBeenCalledWith(
      `iam:rt:session:${session.sessionId}`,
      expect.any(String),
      'EX',
      120,
    );
    expect(sadd).toHaveBeenCalledWith(
      `iam:rt:user:${session.userId}`,
      session.sessionId,
    );
  });

  it('maps rotate lua results without changing script semantics', async () => {
    const evalFn = jest
      .fn()
      .mockResolvedValueOnce('rotated')
      .mockResolvedValueOnce(
        `stale|${JSON.stringify({
          ...session,
          previousTokenHash: 'old',
          previousValidUntilMs: Date.now() + 1000,
        })}`,
      )
      .mockResolvedValueOnce('mismatch')
      .mockResolvedValueOnce('missing');
    const store = new RedisRefreshSessionStore({
      getClient: () => ({ eval: evalFn }),
    } as unknown as RedisService);
    await expect(
      store.rotate(session.sessionId, 'current-hash', session, 60, Date.now()),
    ).resolves.toEqual({ status: 'rotated', session });
    await expect(
      store.rotate(session.sessionId, 'old', session, 60, Date.now()),
    ).resolves.toMatchObject({ status: 'stale' });
    await expect(
      store.rotate(session.sessionId, 'other', session, 60, Date.now()),
    ).resolves.toEqual({ status: 'mismatch' });
    await expect(
      store.rotate(session.sessionId, 'other', session, 60, Date.now()),
    ).resolves.toEqual({ status: 'missing' });
  });
});
