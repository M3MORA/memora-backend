import { Expose } from 'class-transformer';
import { registerAs } from '@nestjs/config';
import {
  EnvDurationSeconds,
  EnvHostname,
  EnvNonEmptyText,
  EnvPort,
  EnvPostgresUrl,
  EnvRedisDb,
  EnvSecret,
  EnvTtlSeconds,
} from '../validation/env-constraints';
import { validateEnv } from '../validation/validate-env';
import { loadEnvFile } from './load-env-file';
import { NodeEnvironment, NodeEnvName } from './node-environment';

export class IamEnvironment extends NodeEnvironment {
  @Expose()
  @EnvHostname()
  IAM_GRPC_HOST!: string;

  @Expose()
  @EnvPort()
  IAM_GRPC_PORT!: number;

  @Expose()
  @EnvHostname()
  IAM_HEALTH_HOST!: string;

  @Expose()
  @EnvPort()
  IAM_HEALTH_PORT!: number;

  @Expose()
  @EnvPostgresUrl()
  IAM_DATABASE_URL!: string;

  @Expose()
  @EnvSecret(32)
  IAM_JWT_SECRET!: string;

  @Expose()
  @EnvSecret(32)
  IAM_INTERNAL_GRPC_SECRET!: string;

  @Expose()
  @EnvNonEmptyText()
  IAM_JWT_ISSUER!: string;

  @Expose()
  @EnvNonEmptyText()
  IAM_JWT_AUDIENCE!: string;

  @Expose()
  @EnvTtlSeconds()
  IAM_JWT_ACCESS_TTL_SECONDS!: number;

  @Expose()
  @EnvHostname()
  IAM_REDIS_HOST!: string;

  @Expose()
  @EnvPort()
  IAM_REDIS_PORT!: number;

  @Expose()
  @EnvSecret(16)
  IAM_REDIS_PASSWORD!: string;

  @Expose()
  @EnvRedisDb()
  IAM_REDIS_DB!: number;

  @Expose()
  @EnvSecret(32)
  IAM_REFRESH_PEPPER!: string;

  @Expose()
  @EnvDurationSeconds(300, 2_592_000)
  IAM_REFRESH_IDLE_TTL_SECONDS!: number;

  @Expose()
  @EnvDurationSeconds(300, 2_592_000)
  IAM_REFRESH_ABSOLUTE_TTL_SECONDS!: number;

  @Expose()
  @EnvDurationSeconds(1, 60)
  IAM_REFRESH_REUSE_GRACE_SECONDS!: number;

  @Expose()
  @EnvSecret(32)
  IAM_PURPOSE_TOKEN_PEPPER!: string;

  @Expose()
  @EnvNonEmptyText()
  IAM_EMAIL_ACTION_BASE_URL!: string;

  @Expose()
  @EnvDurationSeconds(300, 604_800)
  IAM_EMAIL_VERIFICATION_TTL_SECONDS!: number;

  @Expose()
  @EnvDurationSeconds(30, 3_600)
  IAM_EMAIL_VERIFICATION_COOLDOWN_SECONDS!: number;

  @Expose()
  @EnvDurationSeconds(300, 7_200)
  IAM_PASSWORD_RESET_TTL_SECONDS!: number;

  @Expose()
  @EnvDurationSeconds(30, 3_600)
  IAM_PASSWORD_RESET_COOLDOWN_SECONDS!: number;

  @Expose()
  @EnvDurationSeconds(1, 20)
  IAM_EMAIL_RATE_LIMIT_MAX!: number;

  @Expose()
  @EnvDurationSeconds(60, 86_400)
  IAM_EMAIL_RATE_LIMIT_WINDOW_SECONDS!: number;
}

export class IamGoogleEnvironment {
  @Expose()
  @EnvNonEmptyText(512)
  GOOGLE_CLIENT_ID!: string;
}

export interface IamEnv {
  NODE_ENV: NodeEnvName;
  IAM_GRPC_HOST: string;
  IAM_GRPC_PORT: number;
  IAM_HEALTH_HOST: string;
  IAM_HEALTH_PORT: number;
  IAM_DATABASE_URL: string;
  IAM_JWT_SECRET: string;
  IAM_INTERNAL_GRPC_SECRET: string;
  IAM_JWT_ISSUER: string;
  IAM_JWT_AUDIENCE: string;
  IAM_JWT_ACCESS_TTL_SECONDS: number;
  IAM_REDIS_HOST: string;
  IAM_REDIS_PORT: number;
  IAM_REDIS_PASSWORD: string;
  IAM_REDIS_DB: number;
  IAM_REFRESH_PEPPER: string;
  IAM_REFRESH_IDLE_TTL_SECONDS: number;
  IAM_REFRESH_ABSOLUTE_TTL_SECONDS: number;
  IAM_REFRESH_REUSE_GRACE_SECONDS: number;
  IAM_PURPOSE_TOKEN_PEPPER: string;
  IAM_EMAIL_ACTION_BASE_URL: string;
  IAM_EMAIL_VERIFICATION_TTL_SECONDS: number;
  IAM_EMAIL_VERIFICATION_COOLDOWN_SECONDS: number;
  IAM_PASSWORD_RESET_TTL_SECONDS: number;
  IAM_PASSWORD_RESET_COOLDOWN_SECONDS: number;
  IAM_EMAIL_RATE_LIMIT_MAX: number;
  IAM_EMAIL_RATE_LIMIT_WINDOW_SECONDS: number;
  GOOGLE_CLIENT_ID: string | undefined;
}

export function validateIamEnv(
  source: NodeJS.ProcessEnv | Record<string, unknown>,
): IamEnv {
  const rawDb = source.IAM_REDIS_DB;
  const rawHealthHost = source.IAM_HEALTH_HOST;
  const rawHealthPort = source.IAM_HEALTH_PORT;
  const validated = validateEnv(IamEnvironment, {
    ...source,
    IAM_REDIS_DB:
      rawDb === undefined || rawDb === null || rawDb === '' ? 0 : rawDb,
    IAM_HEALTH_HOST:
      rawHealthHost === undefined ||
      rawHealthHost === null ||
      rawHealthHost === ''
        ? '127.0.0.1'
        : rawHealthHost,
    IAM_HEALTH_PORT:
      rawHealthPort === undefined ||
      rawHealthPort === null ||
      rawHealthPort === ''
        ? 5051
        : rawHealthPort,
  });

  if (
    validated.IAM_REFRESH_IDLE_TTL_SECONDS >
    validated.IAM_REFRESH_ABSOLUTE_TTL_SECONDS
  ) {
    throw new Error(
      'Environment validation failed: IAM_REFRESH_IDLE_TTL_SECONDS must be less than or equal to IAM_REFRESH_ABSOLUTE_TTL_SECONDS',
    );
  }

  return {
    NODE_ENV: validated.NODE_ENV,
    IAM_GRPC_HOST: validated.IAM_GRPC_HOST,
    IAM_GRPC_PORT: validated.IAM_GRPC_PORT,
    IAM_HEALTH_HOST: validated.IAM_HEALTH_HOST,
    IAM_HEALTH_PORT: validated.IAM_HEALTH_PORT,
    IAM_DATABASE_URL: validated.IAM_DATABASE_URL,
    IAM_JWT_SECRET: validated.IAM_JWT_SECRET,
    IAM_INTERNAL_GRPC_SECRET: validated.IAM_INTERNAL_GRPC_SECRET,
    IAM_JWT_ISSUER: validated.IAM_JWT_ISSUER,
    IAM_JWT_AUDIENCE: validated.IAM_JWT_AUDIENCE,
    IAM_JWT_ACCESS_TTL_SECONDS: validated.IAM_JWT_ACCESS_TTL_SECONDS,
    IAM_REDIS_HOST: validated.IAM_REDIS_HOST,
    IAM_REDIS_PORT: validated.IAM_REDIS_PORT,
    IAM_REDIS_PASSWORD: validated.IAM_REDIS_PASSWORD,
    IAM_REDIS_DB: validated.IAM_REDIS_DB,
    IAM_REFRESH_PEPPER: validated.IAM_REFRESH_PEPPER,
    IAM_REFRESH_IDLE_TTL_SECONDS: validated.IAM_REFRESH_IDLE_TTL_SECONDS,
    IAM_REFRESH_ABSOLUTE_TTL_SECONDS:
      validated.IAM_REFRESH_ABSOLUTE_TTL_SECONDS,
    IAM_REFRESH_REUSE_GRACE_SECONDS: validated.IAM_REFRESH_REUSE_GRACE_SECONDS,
    IAM_PURPOSE_TOKEN_PEPPER: validated.IAM_PURPOSE_TOKEN_PEPPER,
    IAM_EMAIL_ACTION_BASE_URL: validated.IAM_EMAIL_ACTION_BASE_URL,
    IAM_EMAIL_VERIFICATION_TTL_SECONDS:
      validated.IAM_EMAIL_VERIFICATION_TTL_SECONDS,
    IAM_EMAIL_VERIFICATION_COOLDOWN_SECONDS:
      validated.IAM_EMAIL_VERIFICATION_COOLDOWN_SECONDS,
    IAM_PASSWORD_RESET_TTL_SECONDS: validated.IAM_PASSWORD_RESET_TTL_SECONDS,
    IAM_PASSWORD_RESET_COOLDOWN_SECONDS:
      validated.IAM_PASSWORD_RESET_COOLDOWN_SECONDS,
    IAM_EMAIL_RATE_LIMIT_MAX: validated.IAM_EMAIL_RATE_LIMIT_MAX,
    IAM_EMAIL_RATE_LIMIT_WINDOW_SECONDS:
      validated.IAM_EMAIL_RATE_LIMIT_WINDOW_SECONDS,
    GOOGLE_CLIENT_ID: parseOptionalGoogleClientId(source.GOOGLE_CLIENT_ID),
  };
}

export function loadIamRuntimeConfig(): IamEnv {
  loadEnvFile();
  return validateIamEnv(process.env);
}

export const iamConfig = registerAs('iam', () => {
  const env = validateIamEnv(process.env);

  return {
    nodeEnv: env.NODE_ENV,
    grpcHost: env.IAM_GRPC_HOST,
    grpcPort: env.IAM_GRPC_PORT,
    healthHost: env.IAM_HEALTH_HOST,
    healthPort: env.IAM_HEALTH_PORT,
    databaseUrl: env.IAM_DATABASE_URL,
    jwtSecret: env.IAM_JWT_SECRET,
    internalGrpcSecret: env.IAM_INTERNAL_GRPC_SECRET,
    jwtIssuer: env.IAM_JWT_ISSUER,
    jwtAudience: env.IAM_JWT_AUDIENCE,
    jwtAccessTtlSeconds: env.IAM_JWT_ACCESS_TTL_SECONDS,
    redisHost: env.IAM_REDIS_HOST,
    redisPort: env.IAM_REDIS_PORT,
    redisPassword: env.IAM_REDIS_PASSWORD,
    redisDb: env.IAM_REDIS_DB,
    refreshPepper: env.IAM_REFRESH_PEPPER,
    refreshIdleTtlSeconds: env.IAM_REFRESH_IDLE_TTL_SECONDS,
    refreshAbsoluteTtlSeconds: env.IAM_REFRESH_ABSOLUTE_TTL_SECONDS,
    refreshReuseGraceSeconds: env.IAM_REFRESH_REUSE_GRACE_SECONDS,
    purposeTokenPepper: env.IAM_PURPOSE_TOKEN_PEPPER,
    emailActionBaseUrl: env.IAM_EMAIL_ACTION_BASE_URL,
    emailVerificationTtlSeconds: env.IAM_EMAIL_VERIFICATION_TTL_SECONDS,
    emailVerificationCooldownSeconds:
      env.IAM_EMAIL_VERIFICATION_COOLDOWN_SECONDS,
    passwordResetTtlSeconds: env.IAM_PASSWORD_RESET_TTL_SECONDS,
    passwordResetCooldownSeconds: env.IAM_PASSWORD_RESET_COOLDOWN_SECONDS,
    emailRateLimitMax: env.IAM_EMAIL_RATE_LIMIT_MAX,
    emailRateLimitWindowSeconds: env.IAM_EMAIL_RATE_LIMIT_WINDOW_SECONDS,
    googleClientId: env.GOOGLE_CLIENT_ID,
  };
});

function parseOptionalGoogleClientId(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return validateEnv(IamGoogleEnvironment, { GOOGLE_CLIENT_ID: value })
    .GOOGLE_CLIENT_ID;
}
