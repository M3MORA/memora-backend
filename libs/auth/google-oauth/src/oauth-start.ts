import { createHash, randomBytes } from 'node:crypto';
import type { GoogleOAuthStart } from './interfaces/google-oauth.interfaces';

export function createGoogleOAuthStart(ttlSeconds: number): GoogleOAuthStart {
  const state = randomBytes(32).toString('base64url');
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return {
    state,
    codeVerifier,
    codeChallenge,
    expiresAtMs: Date.now() + ttlSeconds * 1000,
  };
}

export function isGoogleOAuthStartExpired(
  start: GoogleOAuthStart,
  nowMs = Date.now(),
): boolean {
  return nowMs >= start.expiresAtMs;
}
