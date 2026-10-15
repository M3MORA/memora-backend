import type Redis from 'ioredis';

export type CacheAvailability = 'required' | 'optional';

export type RedisCacheModuleOptions = {
  host: string;
  port: number;
  password: string;
  db: number;
  cluster?: boolean;
  namespace: string;
  keyPrefix?: string;
  availability?: CacheAvailability;
  createClient?: () => Redis;
};
