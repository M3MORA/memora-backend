import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';

export type AccessTokenClaims = {
  sub: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
};

export type SignedAccessToken = {
  token: string;
  expiresInSeconds: number;
};

@Injectable()
export class AccessTokenService {
  private readonly secret: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly expiresInSeconds: number;

  constructor(configService: ConfigService) {
    this.secret = configService.getOrThrow<string>('iam.jwtSecret');
    this.issuer = configService.getOrThrow<string>('iam.jwtIssuer');
    this.audience = configService.getOrThrow<string>('iam.jwtAudience');
    this.expiresInSeconds = configService.getOrThrow<number>(
      'iam.jwtAccessTtlSeconds',
    );
  }

  sign(userId: string): SignedAccessToken {
    const token = jwt.sign({}, this.secret, {
      algorithm: 'HS256',
      subject: userId,
      issuer: this.issuer,
      audience: this.audience,
      expiresIn: this.expiresInSeconds,
      jwtid: randomUUID(),
    });

    return {
      token,
      expiresInSeconds: this.expiresInSeconds,
    };
  }

  verify(token: string): AccessTokenClaims {
    try {
      const payload = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: this.issuer,
        audience: this.audience,
      });
      return toAccessTokenClaims(payload);
    } catch {
      throw new UnauthorizedException('Unauthenticated');
    }
  }
}

function toAccessTokenClaims(payload: string | JwtPayload): AccessTokenClaims {
  if (typeof payload === 'string') {
    throw new UnauthorizedException('Unauthenticated');
  }

  const { sub, iss, aud, iat, exp, jti } = payload;
  if (
    typeof sub !== 'string' ||
    typeof iss !== 'string' ||
    typeof aud !== 'string' ||
    typeof iat !== 'number' ||
    typeof exp !== 'number' ||
    typeof jti !== 'string'
  ) {
    throw new UnauthorizedException('Unauthenticated');
  }

  return { sub, iss, aud, iat, exp, jti };
}
