import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieSameSite } from '@app/config';
import type { Request, Response } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const CSRF_HEADER_NAME = 'x-csrf-token';

@Injectable()
export class AuthCookieService {
  private readonly refreshCookieName: string;
  private readonly csrfCookieName: string;
  private readonly path: string;
  private readonly domain: string | undefined;
  private readonly sameSite: CookieSameSite;
  private readonly secure: boolean;

  constructor(configService: ConfigService) {
    this.refreshCookieName = configService.getOrThrow<string>(
      'apiGateway.refreshCookieName',
    );
    this.csrfCookieName = configService.getOrThrow<string>(
      'apiGateway.csrfCookieName',
    );
    this.path = configService.getOrThrow<string>('apiGateway.cookiePath');
    this.domain = configService.get<string>('apiGateway.cookieDomain');
    this.sameSite = configService.getOrThrow<CookieSameSite>(
      'apiGateway.cookieSameSite',
    );
    this.secure =
      configService.getOrThrow<string>('apiGateway.nodeEnv') === 'production' ||
      this.sameSite === 'none';
  }

  attachSession(
    response: Response,
    refreshCredential: string,
    maxAgeSeconds: number,
  ): void {
    const csrfToken = randomBytes(32).toString('base64url');
    const maxAgeMs = maxAgeSeconds * 1000;
    this.setCookie(response, this.refreshCookieName, refreshCredential, {
      httpOnly: true,
      maxAgeMs,
    });
    this.setCookie(response, this.csrfCookieName, csrfToken, {
      httpOnly: false,
      maxAgeMs,
    });
  }

  clearSession(response: Response): void {
    this.clearCookie(response, this.refreshCookieName, true);
    this.clearCookie(response, this.csrfCookieName, false);
  }

  readCsrfToken(request: Request): string {
    this.readRefreshCredential(request);
    const value = cookiesOf(request)[this.csrfCookieName];
    if (typeof value !== 'string' || value.length === 0) {
      throw new ForbiddenException();
    }
    return value;
  }

  readRefreshCredential(request: Request): string {
    const value = cookiesOf(request)[this.refreshCookieName];
    if (typeof value !== 'string' || value.length === 0) {
      throw new UnauthorizedException();
    }
    return value;
  }

  assertCsrf(request: Request): void {
    const cookieToken = cookiesOf(request)[this.csrfCookieName];
    const headerToken = request.headers[CSRF_HEADER_NAME];
    const presented = typeof headerToken === 'string' ? headerToken : undefined;
    if (
      typeof cookieToken !== 'string' ||
      cookieToken.length === 0 ||
      presented === undefined ||
      presented.length === 0 ||
      !sameCredential(cookieToken, presented)
    ) {
      throw new ForbiddenException();
    }
  }

  private setCookie(
    response: Response,
    name: string,
    value: string,
    options: { httpOnly: boolean; maxAgeMs: number },
  ): void {
    response.cookie(name, value, {
      httpOnly: options.httpOnly,
      secure: this.secure,
      sameSite: this.sameSite,
      path: this.path,
      maxAge: options.maxAgeMs,
      ...(this.domain === undefined ? {} : { domain: this.domain }),
    });
  }

  private clearCookie(
    response: Response,
    name: string,
    httpOnly: boolean,
  ): void {
    response.clearCookie(name, {
      httpOnly,
      secure: this.secure,
      sameSite: this.sameSite,
      path: this.path,
      ...(this.domain === undefined ? {} : { domain: this.domain }),
    });
  }
}

function cookiesOf(request: Request): Record<string, string> {
  const cookies = request.cookies;
  if (typeof cookies !== 'object' || cookies === null) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(cookies)) {
    if (typeof value === 'string') {
      result[key] = value;
    }
  }
  return result;
}

function sameCredential(left: string, right: string): boolean {
  const leftDigest = createHash('sha256').update(left).digest();
  const rightDigest = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}
