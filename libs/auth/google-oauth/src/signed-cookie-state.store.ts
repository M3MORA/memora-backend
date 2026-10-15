import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { isGoogleOAuthStartExpired } from './oauth-start';
import type {
  GoogleOAuthStart,
  GoogleOAuthStateStore,
} from './interfaces/google-oauth.interfaces';

export type SignedCookieOAuthStateStoreOptions = {
  cookieName: string;
  secret: string;
  cookie: CookieOptions;
};

type SignedPayload = GoogleOAuthStart;

export class SignedCookieOAuthStateStore implements GoogleOAuthStateStore {
  constructor(private readonly options: SignedCookieOAuthStateStoreOptions) {}

  save(_request: Request, response: Response, start: GoogleOAuthStart): void {
    response.cookie(this.options.cookieName, sign(start, this.options.secret), {
      ...this.options.cookie,
      httpOnly: true,
      maxAge: Math.max(start.expiresAtMs - Date.now(), 1),
    });
  }

  consume(request: Request, response: Response): GoogleOAuthStart | null {
    const raw = readCookie(request, this.options.cookieName);
    this.clear(response);
    if (raw === undefined) {
      return null;
    }

    const start = verify(raw, this.options.secret);
    if (start === null) {
      throw new UnauthorizedException();
    }
    if (isGoogleOAuthStartExpired(start)) {
      throw new ForbiddenException();
    }
    return start;
  }

  clear(response: Response): void {
    response.clearCookie(this.options.cookieName, {
      ...this.options.cookie,
      httpOnly: true,
    });
  }
}

function sign(payload: SignedPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  );
  return `${body}.${hmac(body, secret)}`;
}

function verify(value: string, secret: string): SignedPayload | null {
  const separator = value.lastIndexOf('.');
  if (separator <= 0 || separator === value.length - 1) {
    return null;
  }
  const body = value.slice(0, separator);
  const digest = value.slice(separator + 1);
  const expected = hmac(body, secret);
  if (!safeEqual(digest, expected)) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    );
    if (!isStart(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function hmac(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function readCookie(request: Request, name: string): string | undefined {
  const cookies = request.cookies;
  if (typeof cookies !== 'object' || cookies === null) {
    return undefined;
  }
  const value = (cookies as Record<string, unknown>)[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isStart(value: unknown): value is SignedPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.state === 'string' &&
    record.state.length > 0 &&
    typeof record.codeVerifier === 'string' &&
    record.codeVerifier.length > 0 &&
    typeof record.codeChallenge === 'string' &&
    record.codeChallenge.length > 0 &&
    typeof record.expiresAtMs === 'number'
  );
}
