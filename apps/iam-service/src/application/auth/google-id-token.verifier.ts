import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';

export type VerifiedGoogleIdentity = {
  googleSub: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
};

const GOOGLE_ISSUERS = new Set([
  'https://accounts.google.com',
  'accounts.google.com',
]);

@Injectable()
export class GoogleIdTokenVerifier {
  private readonly clientId: string | undefined;
  private readonly client: OAuth2Client | undefined;

  constructor(configService: ConfigService) {
    const clientId = configService.get<string | undefined>(
      'iam.googleClientId',
    );
    this.clientId =
      typeof clientId === 'string' && clientId.length > 0
        ? clientId
        : undefined;
    this.client =
      this.clientId === undefined ? undefined : new OAuth2Client(this.clientId);
  }

  async verify(idToken: string): Promise<VerifiedGoogleIdentity> {
    if (this.client === undefined || this.clientId === undefined) {
      throw new ServiceUnavailableException('Google sign-in is unavailable');
    }

    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Google sign-in is unavailable');
    }

    if (payload === undefined) {
      throw new UnauthorizedException('Google sign-in is unavailable');
    }
    if (payload.iss === undefined || !GOOGLE_ISSUERS.has(payload.iss)) {
      throw new UnauthorizedException('Google sign-in is unavailable');
    }
    if (payload.aud !== this.clientId) {
      throw new UnauthorizedException('Google sign-in is unavailable');
    }
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new UnauthorizedException('Google sign-in is unavailable');
    }
    if (typeof payload.email !== 'string' || payload.email.length === 0) {
      throw new UnauthorizedException('Google sign-in is unavailable');
    }
    if (payload.email_verified !== true) {
      throw new UnauthorizedException('Google email is not verified');
    }

    return {
      googleSub: payload.sub,
      email: payload.email,
      emailVerified: true,
      fullName: resolveFullName(payload),
    };
  }
}

function resolveFullName(payload: TokenPayload): string {
  if (typeof payload.name === 'string' && payload.name.trim().length > 0) {
    return payload.name.trim().replace(/\s+/g, ' ').slice(0, 150);
  }
  const given =
    typeof payload.given_name === 'string' ? payload.given_name.trim() : '';
  const family =
    typeof payload.family_name === 'string' ? payload.family_name.trim() : '';
  const combined = `${given} ${family}`.trim();
  if (combined.length > 0) {
    return combined.slice(0, 150);
  }
  const local = payload.email?.split('@')[0] ?? 'Customer';
  return local.slice(0, 150);
}
