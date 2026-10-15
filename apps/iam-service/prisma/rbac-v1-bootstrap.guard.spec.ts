import { RBAC_V1_MARKER_KEY } from '../../../libs/contracts/src/iam/permissions';
import { assertSafeDevelopmentTarget } from './rbac-v1-bootstrap';

describe('RBAC bootstrap target guard', () => {
  const original = process.env.MEMORA_RBAC_PRODUCTION_CONFIRM;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.MEMORA_RBAC_PRODUCTION_CONFIRM;
    } else {
      process.env.MEMORA_RBAC_PRODUCTION_CONFIRM = original;
    }
  });

  it('rejects production without explicit marker confirm', () => {
    delete process.env.MEMORA_RBAC_PRODUCTION_CONFIRM;
    expect(() =>
      assertSafeDevelopmentTarget(
        'postgresql://u:p@127.0.0.1:5432/memora',
        'production',
      ),
    ).toThrow(/NODE_ENV=production/);
  });

  it('allows docker postgres host when marker confirm is set', () => {
    process.env.MEMORA_RBAC_PRODUCTION_CONFIRM = RBAC_V1_MARKER_KEY;
    const target = assertSafeDevelopmentTarget(
      'postgresql://u:p@postgres:5432/memora?schema=iam',
      'production',
    );
    expect(target.host).toBe('postgres');
  });

  it('rejects unrelated hosts even with confirm', () => {
    process.env.MEMORA_RBAC_PRODUCTION_CONFIRM = RBAC_V1_MARKER_KEY;
    expect(() =>
      assertSafeDevelopmentTarget(
        'postgresql://u:p@db.example.com:5432/memora',
        'production',
      ),
    ).toThrow(/not a local development target/);
  });
});
