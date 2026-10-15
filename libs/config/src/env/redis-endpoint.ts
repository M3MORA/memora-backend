export type RedisEndpointConfig = {
  host: string;
  port: number;
  password: string;
  db: number;
  cluster?: boolean;
};

export type RedisStandaloneConnectionFields = {
  host: string;
  port: number;
  password: string;
  db?: number;
};

export function redisStandaloneConnectionFields(
  endpoint: RedisEndpointConfig,
): RedisStandaloneConnectionFields {
  if (endpoint.cluster === true) {
    if (endpoint.db !== 0) {
      throw new Error(
        'Redis Cluster only supports logical DB 0; use independent endpoints for IAM sessions, cache and queues',
      );
    }
    return {
      host: endpoint.host,
      port: endpoint.port,
      password: endpoint.password,
    };
  }
  return {
    host: endpoint.host,
    port: endpoint.port,
    password: endpoint.password,
    db: endpoint.db,
  };
}

export function defaultRedisLogicalDb(
  cluster: boolean,
  sharedInstanceDevDb: number,
): number {
  return cluster ? 0 : sharedInstanceDevDb;
}

export function parseRedisClusterFlag(value: unknown): boolean {
  if (value === undefined || value === null || value === '') {
    return false;
  }
  if (value === true || value === 'true' || value === '1') {
    return true;
  }
  if (value === false || value === 'false' || value === '0') {
    return false;
  }
  throw new Error(
    'Environment validation failed: Redis cluster flag must be true or false',
  );
}
