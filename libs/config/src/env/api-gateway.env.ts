import { Expose, Transform } from 'class-transformer';
import { registerAs } from '@nestjs/config';
import { IsBoolean, Validate } from 'class-validator';
import {
  EnvDurationSeconds,
  EnvHttpUrl,
  EnvNonEmptyText,
  EnvPort,
  EnvSecret,
  GrpcUrlConstraint,
  parseEnvBoolean,
  parseEnvText,
} from '../validation/env-constraints';
import { validateEnv } from '../validation/validate-env';
import { NodeEnvironment, NodeEnvName } from './node-environment';

// Schema env riêng của API Gateway.
// Class cha NodeEnvironment thêm NODE_ENV (development | production | test).
// @Expose() giữ field này khi validateEnv() bỏ mọi biến không khai báo,
// nên IAM_GRPC_HOST, PATH, ... trong cùng file .env không bị kiểm tra ở đây.
export class ApiGatewayEnvironment extends NodeEnvironment {
  // Cổng HTTP. Chuỗi "3000" được đổi thành số, phải từ 1 đến 65535.
  @Expose()
  @EnvPort()
  API_GATEWAY_PORT!: number;

  // "true"/"false"/"1"/"0" được đổi thành boolean trước khi @IsBoolean() kiểm tra.
  @Expose()
  @Transform(({ value }: { value: unknown }) => parseEnvBoolean(value))
  @IsBoolean()
  SWAGGER_ENABLED!: boolean;

  // Địa chỉ Gateway gọi sang IAM, dạng host:port (localhost:50051 hoặc iam-service:50051).
  @Expose()
  @Transform(({ value }: { value: unknown }) => parseEnvText(value))
  @Validate(GrpcUrlConstraint)
  IAM_GRPC_URL!: string;

  @Expose()
  @EnvSecret(32)
  IAM_INTERNAL_GRPC_SECRET!: string;
}

export class ApiGatewayGoogleOAuthEnvironment {
  @Expose()
  @EnvNonEmptyText(512)
  GOOGLE_CLIENT_ID!: string;

  @Expose()
  @EnvSecret(16)
  GOOGLE_CLIENT_SECRET!: string;

  @Expose()
  @EnvHttpUrl()
  GOOGLE_CALLBACK_URL!: string;

  @Expose()
  @EnvDurationSeconds(30, 3600)
  GOOGLE_OAUTH_STATE_TTL_SECONDS!: number;

  @Expose()
  @EnvSecret(32)
  GOOGLE_OAUTH_STATE_SECRET!: string;

  @Expose()
  @EnvHttpUrl()
  FRONTEND_AUTH_SUCCESS_URL!: string;

  @Expose()
  @EnvHttpUrl()
  FRONTEND_AUTH_FAILURE_URL!: string;
}

// Object đã validate, đúng kiểu, chỉ gồm biến của Gateway.
export type CookieSameSite = 'lax' | 'strict' | 'none';

export interface ApiGatewayEnv {
  NODE_ENV: NodeEnvName;
  API_GATEWAY_PORT: number;
  SWAGGER_ENABLED: boolean;
  IAM_GRPC_URL: string;
  IAM_INTERNAL_GRPC_SECRET: string;
  AUTH_REFRESH_COOKIE_NAME: string;
  AUTH_CSRF_COOKIE_NAME: string;
  AUTH_COOKIE_PATH: string;
  AUTH_COOKIE_DOMAIN: string | undefined;
  AUTH_COOKIE_SAMESITE: CookieSameSite;
  GOOGLE_OAUTH_ENABLED: boolean;
  GOOGLE_CLIENT_ID: string | undefined;
  GOOGLE_CLIENT_SECRET: string | undefined;
  GOOGLE_CALLBACK_URL: string | undefined;
  GOOGLE_OAUTH_STATE_TTL_SECONDS: number;
  GOOGLE_OAUTH_STATE_SECRET: string | undefined;
  GOOGLE_OAUTH_STATE_COOKIE_NAME: string;
  FRONTEND_AUTH_SUCCESS_URL: string | undefined;
  FRONTEND_AUTH_FAILURE_URL: string | undefined;
  FRONTEND_ORIGIN: string | undefined;
  CORS_ALLOWED_ORIGINS: string[];
  TRUST_PROXY_HOPS: false | number;
  AUTH_THROTTLE_DISABLED: boolean;
}

// ConfigModule.forRoot() gọi hàm này lúc import AppModule, trước app.listen().
// source là .env gộp với process.env; biến đã inject sẵn sẽ thắng giá trị trong file.
export function validateApiGatewayEnv(
  source: NodeJS.ProcessEnv | Record<string, unknown>,
): ApiGatewayEnv {
  const rawFlag = source.SWAGGER_ENABLED;
  // Không khai báo SWAGGER_ENABLED thì bật ở development/test, tắt ở production.
  // Có khai báo thì dùng đúng giá trị đó, kể cả production.
  const swaggerEnabled =
    rawFlag === undefined || rawFlag === null || rawFlag === ''
      ? source.NODE_ENV !== 'production'
      : rawFlag;

  // Sai kiểu hoặc thiếu biến thì ném lỗi và process dừng, chưa mở cổng.
  const validated = validateEnv(ApiGatewayEnvironment, {
    ...source,
    SWAGGER_ENABLED: swaggerEnabled,
  });

  const google = parseGoogleOAuth(source);
  const corsAllowedOrigins = mergeOrigins(
    parseOriginList(source.CORS_ALLOWED_ORIGINS),
    parseSingleOrigin(source.FRONTEND_ORIGIN),
    google.FRONTEND_ORIGIN,
  );

  return {
    NODE_ENV: validated.NODE_ENV,
    API_GATEWAY_PORT: validated.API_GATEWAY_PORT,
    SWAGGER_ENABLED: validated.SWAGGER_ENABLED,
    IAM_GRPC_URL: validated.IAM_GRPC_URL,
    IAM_INTERNAL_GRPC_SECRET: validated.IAM_INTERNAL_GRPC_SECRET,
    AUTH_REFRESH_COOKIE_NAME: optionalCookieName(
      source.AUTH_REFRESH_COOKIE_NAME,
      'memora_refresh',
    ),
    AUTH_CSRF_COOKIE_NAME: optionalCookieName(
      source.AUTH_CSRF_COOKIE_NAME,
      'memora_csrf',
    ),
    AUTH_COOKIE_PATH: optionalCookieName(
      source.AUTH_COOKIE_PATH,
      '/api/v1/auth',
    ),
    AUTH_COOKIE_DOMAIN: optionalCookieDomain(source.AUTH_COOKIE_DOMAIN),
    AUTH_COOKIE_SAMESITE: optionalSameSite(source.AUTH_COOKIE_SAMESITE),
    ...google,
    CORS_ALLOWED_ORIGINS: corsAllowedOrigins,
    TRUST_PROXY_HOPS: parseTrustProxyHops(source.TRUST_PROXY),
    AUTH_THROTTLE_DISABLED: parseOptionalBoolean(
      source.AUTH_THROTTLE_DISABLED,
      false,
    ),
  };
}

// Đăng ký namespace "apiGateway" cho ConfigService sau khi validate thành công.
// main.ts đọc apiGateway.port; gRPC client đọc apiGateway.iamGrpcUrl.
export const apiGatewayConfig = registerAs('apiGateway', () => {
  const env = validateApiGatewayEnv(process.env);

  return {
    nodeEnv: env.NODE_ENV,
    port: env.API_GATEWAY_PORT,
    swaggerEnabled: env.SWAGGER_ENABLED,
    iamGrpcUrl: env.IAM_GRPC_URL,
    internalGrpcSecret: env.IAM_INTERNAL_GRPC_SECRET,
    refreshCookieName: env.AUTH_REFRESH_COOKIE_NAME,
    csrfCookieName: env.AUTH_CSRF_COOKIE_NAME,
    cookiePath: env.AUTH_COOKIE_PATH,
    cookieDomain: env.AUTH_COOKIE_DOMAIN,
    cookieSameSite: env.AUTH_COOKIE_SAMESITE,
    googleOAuthEnabled: env.GOOGLE_OAUTH_ENABLED,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    googleCallbackUrl: env.GOOGLE_CALLBACK_URL,
    googleOAuthStateTtlSeconds: env.GOOGLE_OAUTH_STATE_TTL_SECONDS,
    googleOAuthStateSecret: env.GOOGLE_OAUTH_STATE_SECRET,
    googleOAuthStateCookieName: env.GOOGLE_OAUTH_STATE_COOKIE_NAME,
    frontendAuthSuccessUrl: env.FRONTEND_AUTH_SUCCESS_URL,
    frontendAuthFailureUrl: env.FRONTEND_AUTH_FAILURE_URL,
    frontendOrigin: env.FRONTEND_ORIGIN,
    corsAllowedOrigins: env.CORS_ALLOWED_ORIGINS,
    trustProxyHops: env.TRUST_PROXY_HOPS,
    throttleDisabled: env.AUTH_THROTTLE_DISABLED,
  };
});

function parseGoogleOAuth(
  source: NodeJS.ProcessEnv | Record<string, unknown>,
): {
  GOOGLE_OAUTH_ENABLED: boolean;
  GOOGLE_CLIENT_ID: string | undefined;
  GOOGLE_CLIENT_SECRET: string | undefined;
  GOOGLE_CALLBACK_URL: string | undefined;
  GOOGLE_OAUTH_STATE_TTL_SECONDS: number;
  GOOGLE_OAUTH_STATE_SECRET: string | undefined;
  GOOGLE_OAUTH_STATE_COOKIE_NAME: string;
  FRONTEND_AUTH_SUCCESS_URL: string | undefined;
  FRONTEND_AUTH_FAILURE_URL: string | undefined;
  FRONTEND_ORIGIN: string | undefined;
} {
  const enabled = parseEnvBoolean(source.GOOGLE_OAUTH_ENABLED);
  const googleEnabled = enabled === true;
  const cookieName = optionalCookieName(
    source.GOOGLE_OAUTH_STATE_COOKIE_NAME,
    'memora_oauth_state',
  );

  if (!googleEnabled) {
    return {
      GOOGLE_OAUTH_ENABLED: false,
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
      GOOGLE_CALLBACK_URL: undefined,
      GOOGLE_OAUTH_STATE_TTL_SECONDS: 600,
      GOOGLE_OAUTH_STATE_SECRET: undefined,
      GOOGLE_OAUTH_STATE_COOKIE_NAME: cookieName,
      FRONTEND_AUTH_SUCCESS_URL: undefined,
      FRONTEND_AUTH_FAILURE_URL: undefined,
      FRONTEND_ORIGIN: undefined,
    };
  }

  const ttlRaw = source.GOOGLE_OAUTH_STATE_TTL_SECONDS;
  const google = validateEnv(ApiGatewayGoogleOAuthEnvironment, {
    ...source,
    GOOGLE_OAUTH_STATE_TTL_SECONDS:
      ttlRaw === undefined || ttlRaw === null || ttlRaw === '' ? 600 : ttlRaw,
  });

  return {
    GOOGLE_OAUTH_ENABLED: true,
    GOOGLE_CLIENT_ID: google.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: google.GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL: google.GOOGLE_CALLBACK_URL,
    GOOGLE_OAUTH_STATE_TTL_SECONDS: google.GOOGLE_OAUTH_STATE_TTL_SECONDS,
    GOOGLE_OAUTH_STATE_SECRET: google.GOOGLE_OAUTH_STATE_SECRET,
    GOOGLE_OAUTH_STATE_COOKIE_NAME: cookieName,
    FRONTEND_AUTH_SUCCESS_URL: google.FRONTEND_AUTH_SUCCESS_URL,
    FRONTEND_AUTH_FAILURE_URL: google.FRONTEND_AUTH_FAILURE_URL,
    FRONTEND_ORIGIN: originOf(google.FRONTEND_AUTH_SUCCESS_URL),
  };
}

function originOf(url: string): string {
  return new URL(url).origin;
}

function parseOriginList(value: unknown): string[] {
  if (value === undefined || value === null || value === '') {
    return [];
  }
  if (typeof value !== 'string') {
    throw new Error(
      'Environment validation failed: CORS_ALLOWED_ORIGINS must be a comma-separated origin list',
    );
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map(requireAbsoluteOrigin);
}

function parseSingleOrigin(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(
      'Environment validation failed: FRONTEND_ORIGIN must be an absolute http(s) origin',
    );
  }
  return requireAbsoluteOrigin(value.trim());
}

function requireAbsoluteOrigin(value: string): string {
  if (value === '*') {
    throw new Error(
      'Environment validation failed: wildcard CORS origins are not allowed',
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `Environment validation failed: invalid CORS origin "${value}"`,
    );
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `Environment validation failed: CORS origin must be http(s): "${value}"`,
    );
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new Error(
      'Environment validation failed: CORS origin must not include credentials',
    );
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new Error(
      `Environment validation failed: CORS origin must not include a path: "${value}"`,
    );
  }
  if (parsed.search !== '' || parsed.hash !== '') {
    throw new Error(
      `Environment validation failed: CORS origin must not include query or fragment: "${value}"`,
    );
  }
  return parsed.origin;
}

function mergeOrigins(
  list: string[],
  frontendOrigin: string | undefined,
  oauthOrigin: string | undefined,
): string[] {
  const unique = new Set<string>(list);
  if (frontendOrigin !== undefined) {
    unique.add(frontendOrigin);
  }
  if (oauthOrigin !== undefined) {
    unique.add(oauthOrigin);
  }
  return [...unique];
}

function parseTrustProxyHops(value: unknown): false | number {
  if (value === undefined || value === null || value === '') {
    return false;
  }
  const asBoolean = parseEnvBoolean(value);
  if (asBoolean === false) {
    return false;
  }
  if (asBoolean === true) {
    return 1;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const hops = Number(value.trim());
    if (hops === 0) {
      return false;
    }
    if (hops >= 1 && hops <= 5) {
      return hops;
    }
  }
  throw new Error(
    'Environment validation failed: TRUST_PROXY must be false, true, or hop count 1-5',
  );
}

function parseOptionalBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = parseEnvBoolean(value);
  if (parsed === true || parsed === false) {
    return parsed;
  }
  throw new Error(
    'Environment validation failed: AUTH_THROTTLE_DISABLED must be true or false',
  );
}

function optionalCookieName(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    return fallback;
  }
  return value.trim();
}

function optionalCookieDomain(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }
  return value.trim();
}

function optionalSameSite(value: unknown): CookieSameSite {
  if (value === undefined || value === null || value === '') {
    return 'lax';
  }
  if (typeof value !== 'string') {
    throw new Error(
      'Environment validation failed: AUTH_COOKIE_SAMESITE must be lax, strict, or none',
    );
  }
  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'lax' ||
    normalized === 'strict' ||
    normalized === 'none'
  ) {
    return normalized;
  }
  throw new Error(
    'Environment validation failed: AUTH_COOKIE_SAMESITE must be lax, strict, or none',
  );
}
