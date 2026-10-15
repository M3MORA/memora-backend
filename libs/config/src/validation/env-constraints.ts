import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const GRPC_URL = /^([a-zA-Z0-9._-]+):(\d+)$/;
const HOSTNAME = /^[a-zA-Z0-9._-]+$/;
const POSTGRES_URL = /^postgres(?:ql)?:\/\//i;

export function parseEnvPort(value: unknown): unknown {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return Number(value.trim());
  }

  return value;
}

export function parseEnvBoolean(value: unknown): unknown {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }

  return value;
}

export function parseEnvText(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
}

export function EnvPort(): PropertyDecorator {
  return (target, propertyKey) => {
    const key = String(propertyKey);
    Transform(({ value }: { value: unknown }) => parseEnvPort(value))(
      target,
      key,
    );
    IsInt()(target, key);
    Min(1)(target, key);
    Max(65535)(target, key);
  };
}

export function EnvHostname(): PropertyDecorator {
  return (target, propertyKey) => {
    const key = String(propertyKey);
    Transform(({ value }: { value: unknown }) => parseEnvText(value))(
      target,
      key,
    );
    IsString()(target, key);
    IsNotEmpty()(target, key);
    Matches(HOSTNAME)(target, key);
  };
}

export function EnvSecret(minLength = 32): PropertyDecorator {
  return (target, propertyKey) => {
    const key = String(propertyKey);
    Transform(({ value }: { value: unknown }) => parseEnvText(value))(
      target,
      key,
    );
    IsString()(target, key);
    MinLength(minLength)(target, key);
  };
}

export function EnvNonEmptyText(maxLength = 255): PropertyDecorator {
  return (target, propertyKey) => {
    const key = String(propertyKey);
    Transform(({ value }: { value: unknown }) => parseEnvText(value))(
      target,
      key,
    );
    IsString()(target, key);
    IsNotEmpty()(target, key);
    MaxLength(maxLength)(target, key);
  };
}

export function EnvTtlSeconds(): PropertyDecorator {
  return (target, propertyKey) => {
    const key = String(propertyKey);
    Transform(({ value }: { value: unknown }) => parseEnvPort(value))(
      target,
      key,
    );
    IsInt()(target, key);
    Min(60)(target, key);
    Max(3600)(target, key);
  };
}

export function EnvDurationSeconds(
  minSeconds: number,
  maxSeconds: number,
): PropertyDecorator {
  return (target, propertyKey) => {
    const key = String(propertyKey);
    Transform(({ value }: { value: unknown }) => parseEnvPort(value))(
      target,
      key,
    );
    IsInt()(target, key);
    Min(minSeconds)(target, key);
    Max(maxSeconds)(target, key);
  };
}

export function EnvRedisDb(): PropertyDecorator {
  return (target, propertyKey) => {
    const key = String(propertyKey);
    Transform(({ value }: { value: unknown }) => parseEnvPort(value))(
      target,
      key,
    );
    IsInt()(target, key);
    Min(0)(target, key);
    Max(15)(target, key);
  };
}

export function EnvHttpUrl(): PropertyDecorator {
  return (target, propertyKey) => {
    const key = String(propertyKey);
    Transform(({ value }: { value: unknown }) => parseEnvText(value))(
      target,
      key,
    );
    IsString()(target, key);
    IsNotEmpty()(target, key);
    IsUrl(
      { require_tld: false, protocols: ['http', 'https'] },
      { message: 'must be an absolute http(s) URL' },
    )(target, key);
  };
}

export function EnvPostgresUrl(): PropertyDecorator {
  return (target, propertyKey) => {
    const key = String(propertyKey);
    Transform(({ value }: { value: unknown }) => parseEnvText(value))(
      target,
      key,
    );
    IsString()(target, key);
    IsNotEmpty()(target, key);
    Matches(POSTGRES_URL, {
      message: 'must be a PostgreSQL connection URL',
    })(target, key);
  };
}

@ValidatorConstraint({ name: 'grpcUrl', async: false })
export class GrpcUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    const match = GRPC_URL.exec(value.trim());
    if (!match) {
      return false;
    }

    const port = Number(match[2]);
    return Number.isInteger(port) && port >= 1 && port <= 65535;
  }

  defaultMessage(): string {
    return 'must be a host:port target with port between 1 and 65535';
  }
}
