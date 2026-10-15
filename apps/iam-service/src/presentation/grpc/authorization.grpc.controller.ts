import { Controller, UseGuards } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type {
  AccessPrincipalResponse,
  AuthorizationDecisionResponse,
  CheckPermissionsRequest,
  CheckRolesRequest,
  ValidateAccessTokenRequest,
} from '@app/contracts';
import { AuthenticationService } from '../../application/auth/authentication.service';
import { AuthorizationService } from '../../application/authorization/authorization.service';
import { requireCodes, requireCredential } from './grpc-request';
import { InternalGrpcAuthGuard } from './internal-grpc-auth.guard';

@Controller()
@UseGuards(InternalGrpcAuthGuard)
export class AuthorizationGrpcController {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly authorization: AuthorizationService,
  ) {}

  @GrpcMethod('IamService', 'ValidateAccessToken')
  async validateAccessToken(
    request: ValidateAccessTokenRequest,
  ): Promise<AccessPrincipalResponse> {
    const principal = await this.authentication.verifyAccessToken(
      requireCredential(request.accessCredential),
    );
    return {
      userId: principal.user.id,
      tokenId: principal.claims.jti,
      emailVerified: principal.emailVerified,
    };
  }

  @GrpcMethod('IamService', 'CheckRoles')
  async checkRoles(
    request: CheckRolesRequest,
  ): Promise<AuthorizationDecisionResponse> {
    const principal = await this.authentication.verifyAccessToken(
      requireCredential(request.accessCredential),
    );
    const allowed = await this.authorization.hasAnyRole(
      principal.user.id,
      requireCodes(request.roleCodes),
    );
    return { allowed, userId: principal.user.id };
  }

  @GrpcMethod('IamService', 'CheckPermissions')
  async checkPermissions(
    request: CheckPermissionsRequest,
  ): Promise<AuthorizationDecisionResponse> {
    const principal = await this.authentication.verifyAccessToken(
      requireCredential(request.accessCredential),
    );
    const allowed = await this.authorization.hasAllPermissions(
      principal.user.id,
      requireCodes(request.permissionCodes),
    );
    return { allowed, userId: principal.user.id };
  }
}
