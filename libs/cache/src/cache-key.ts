import {
  CACHE_NAMESPACE_PATTERN,
  CACHE_RELATIVE_KEY_PATTERN,
  DEFAULT_CACHE_KEY_PREFIX,
} from './redis-cache.constants';

export function assertCacheNamespace(namespace: string): string {
  if (!CACHE_NAMESPACE_PATTERN.test(namespace)) {
    throw new Error(
      'Cache namespace must match /^[a-z][a-z0-9-]{0,31}$/ (owning service decides keys)',
    );
  }
  return namespace;
}

export function assertCacheRelativeKey(key: string): string {
  if (!CACHE_RELATIVE_KEY_PATTERN.test(key)) {
    throw new Error(
      'Cache key must match /^[a-zA-Z0-9:_-]{1,200}$/ and must not use KEYS/globs',
    );
  }
  return key;
}

export function buildCacheRedisKey(
  keyPrefix: string,
  namespace: string,
  relativeKey: string,
): string {
  const prefix =
    keyPrefix.trim().length > 0 ? keyPrefix.trim() : DEFAULT_CACHE_KEY_PREFIX;
  return `${prefix}:${assertCacheNamespace(namespace)}:${assertCacheRelativeKey(relativeKey)}`;
}
