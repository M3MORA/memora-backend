export const CORS_ALLOWED_METHODS = ['GET', 'HEAD', 'POST', 'OPTIONS'] as const;

export const CORS_ALLOWED_HEADERS = [
  'Authorization',
  'Content-Type',
  'x-csrf-token',
  'x-request-id',
] as const;

export const CORS_EXPOSED_HEADERS = ['x-request-id'] as const;

export function isAllowedOrigin(
  origin: string,
  allowlist: readonly string[],
): boolean {
  return allowlist.includes(origin);
}

export function resolveCorsOrigin(
  origin: string | undefined,
  allowlist: readonly string[],
): string | false {
  if (origin === undefined || origin.length === 0) {
    return false;
  }
  return isAllowedOrigin(origin, allowlist) ? origin : false;
}
