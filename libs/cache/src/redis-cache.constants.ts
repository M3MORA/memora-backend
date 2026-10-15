export const REDIS_CACHE_OPTIONS = 'REDIS_CACHE_OPTIONS';

export const DEFAULT_CACHE_KEY_PREFIX = 'memora:cache';

export const CACHE_TTL_SECONDS_MIN = 1;
export const CACHE_TTL_SECONDS_MAX = 604_800;

export const CACHE_NAMESPACE_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;
export const CACHE_RELATIVE_KEY_PATTERN = /^[a-zA-Z0-9:_-]{1,200}$/;
