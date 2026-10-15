import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedPrincipal, PermissionResolver } from '@app/auth';
import { IamGrpcClient } from '../clients/iam-grpc.client';
import { hasAccessCredential } from '../auth/gateway-principal';

@Injectable()
export class IamGrpcPermissionResolver implements PermissionResolver {
  constructor(private readonly iam: IamGrpcClient) {}

  async hasAnyRole(
    principal: AuthenticatedPrincipal,
    roleCodes: readonly string[],
  ): Promise<boolean> {
    const result = await this.iam.checkRoles(accessCredentialOf(principal), [
      ...roleCodes,
    ]);
    return result.allowed;
  }

  async hasAllPermissions(
    principal: AuthenticatedPrincipal,
    permissionCodes: readonly string[],
  ): Promise<boolean> {
    const result = await this.iam.checkPermissions(
      accessCredentialOf(principal),
      [...permissionCodes],
    );
    return result.allowed;
  }
}

function accessCredentialOf(principal: AuthenticatedPrincipal): string {
  if (!hasAccessCredential(principal)) {
    throw new UnauthorizedException();
  }
  return principal.accessCredential;
}
