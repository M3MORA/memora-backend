import type { AuthenticatedPrincipal } from '@app/auth';

export type GatewayAuthenticatedPrincipal = AuthenticatedPrincipal & {
  readonly accessCredential: string;
  readonly emailVerified: boolean;
  readonly tokenId: string;
};

export function hasAccessCredential(
  principal: AuthenticatedPrincipal,
): principal is GatewayAuthenticatedPrincipal {
  return (
    'accessCredential' in principal &&
    typeof principal.accessCredential === 'string' &&
    principal.accessCredential.length > 0
  );
}
