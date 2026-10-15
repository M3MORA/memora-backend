import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClientGrpc } from '@nestjs/microservices';
import {
  INTERNAL_GRPC_AUTH_METADATA_KEY,
  mapGrpcErrorToHttpException,
} from '@app/common';
import type {
  AccessPrincipalResponse,
  AuthenticateGoogleRequest,
  AuthorizationDecisionResponse,
  AuthSessionResponse,
  CheckPermissionsRequest,
  CheckRolesRequest,
  ForgotPasswordResponse,
  GetCurrentUserRequest,
  LoginRequest,
  LogoutAllRequest,
  LogoutRequest,
  RefreshTokenRequest,
  RegisterRequest,
  ResendVerificationEmailRequest,
  ResendVerificationEmailResponse,
  ResetPasswordRequest,
  UserResponse,
  VerifyEmailRequest,
} from '@app/contracts';
import { createOutgoingGrpcMetadata } from '@app/observability';
import type { Metadata } from '@grpc/grpc-js';
import { Observable, firstValueFrom, timeout } from 'rxjs';

export const IAM_GRPC_CLIENT = 'IAM_GRPC_CLIENT';
const IAM_RPC_TIMEOUT_MS = 5000;

interface IamServiceClient {
  register(
    request: RegisterRequest,
    metadata?: Metadata,
  ): Observable<AuthSessionResponse>;
  login(
    request: LoginRequest,
    metadata?: Metadata,
  ): Observable<AuthSessionResponse>;
  authenticateGoogle(
    request: AuthenticateGoogleRequest,
    metadata?: Metadata,
  ): Observable<AuthSessionResponse>;
  refreshToken(
    request: RefreshTokenRequest,
    metadata?: Metadata,
  ): Observable<AuthSessionResponse>;
  logout(request: LogoutRequest, metadata?: Metadata): Observable<object>;
  logoutAll(request: LogoutAllRequest, metadata?: Metadata): Observable<object>;
  verifyEmail(
    request: VerifyEmailRequest,
    metadata?: Metadata,
  ): Observable<UserResponse>;
  resendVerificationEmail(
    request: ResendVerificationEmailRequest,
    metadata?: Metadata,
  ): Observable<ResendVerificationEmailResponse>;
  forgotPassword(
    request: { email: string },
    metadata?: Metadata,
  ): Observable<ForgotPasswordResponse>;
  resetPassword(
    request: ResetPasswordRequest,
    metadata?: Metadata,
  ): Observable<object>;
  getCurrentUser(
    request: GetCurrentUserRequest,
    metadata?: Metadata,
  ): Observable<UserResponse>;
  validateAccessToken(
    request: { accessCredential: string },
    metadata?: Metadata,
  ): Observable<AccessPrincipalResponse>;
  checkRoles(
    request: CheckRolesRequest,
    metadata?: Metadata,
  ): Observable<AuthorizationDecisionResponse>;
  checkPermissions(
    request: CheckPermissionsRequest,
    metadata?: Metadata,
  ): Observable<AuthorizationDecisionResponse>;
}

@Injectable()
export class IamGrpcClient implements OnModuleInit {
  private iamService!: IamServiceClient;
  private readonly internalSecret: string;

  constructor(
    @Inject(IAM_GRPC_CLIENT)
    private readonly grpcClient: ClientGrpc,
    configService: ConfigService,
  ) {
    this.internalSecret = configService.getOrThrow<string>(
      'apiGateway.internalGrpcSecret',
    );
  }

  onModuleInit(): void {
    this.iamService =
      this.grpcClient.getService<IamServiceClient>('IamService');
  }

  register(request: RegisterRequest): Promise<AuthSessionResponse> {
    return this.unary((metadata) =>
      this.iamService.register(request, metadata),
    );
  }

  login(request: LoginRequest): Promise<AuthSessionResponse> {
    return this.unary((metadata) => this.iamService.login(request, metadata));
  }

  authenticateGoogle(idToken: string): Promise<AuthSessionResponse> {
    return this.unary((metadata) =>
      this.iamService.authenticateGoogle({ idToken }, metadata),
    );
  }

  refreshToken(refreshCredential: string): Promise<AuthSessionResponse> {
    return this.unary((metadata) =>
      this.iamService.refreshToken({ refreshCredential }, metadata),
    );
  }

  logout(refreshCredential: string): Promise<void> {
    return this.unary((metadata) =>
      this.iamService.logout({ refreshCredential }, metadata),
    ).then(() => undefined);
  }

  logoutAll(accessCredential: string): Promise<void> {
    return this.unary((metadata) =>
      this.iamService.logoutAll({ accessCredential }, metadata),
    ).then(() => undefined);
  }

  verifyEmail(verificationCredential: string): Promise<UserResponse> {
    return this.unary((metadata) =>
      this.iamService.verifyEmail({ verificationCredential }, metadata),
    );
  }

  resendVerificationEmail(
    accessCredential: string,
  ): Promise<ResendVerificationEmailResponse> {
    return this.unary((metadata) =>
      this.iamService.resendVerificationEmail({ accessCredential }, metadata),
    );
  }

  forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    return this.unary((metadata) =>
      this.iamService.forgotPassword({ email }, metadata),
    );
  }

  resetPassword(recoveryCredential: string, password: string): Promise<void> {
    return this.unary((metadata) =>
      this.iamService.resetPassword({ recoveryCredential, password }, metadata),
    ).then(() => undefined);
  }

  getCurrentUser(accessCredential: string): Promise<UserResponse> {
    return this.unary((metadata) =>
      this.iamService.getCurrentUser({ accessCredential }, metadata),
    );
  }

  validateAccessToken(
    accessCredential: string,
  ): Promise<AccessPrincipalResponse> {
    return this.unary((metadata) =>
      this.iamService.validateAccessToken({ accessCredential }, metadata),
    );
  }

  checkRoles(
    accessCredential: string,
    roleCodes: string[],
  ): Promise<AuthorizationDecisionResponse> {
    return this.unary((metadata) =>
      this.iamService.checkRoles({ accessCredential, roleCodes }, metadata),
    );
  }

  checkPermissions(
    accessCredential: string,
    permissionCodes: string[],
  ): Promise<AuthorizationDecisionResponse> {
    return this.unary((metadata) =>
      this.iamService.checkPermissions(
        { accessCredential, permissionCodes },
        metadata,
      ),
    );
  }

  private async unary<T>(
    call: (metadata: Metadata) => Observable<T>,
  ): Promise<T> {
    const metadata = this.createInternalMetadata();
    try {
      return await firstValueFrom(
        call(metadata).pipe(timeout(IAM_RPC_TIMEOUT_MS)),
      );
    } catch (error: unknown) {
      throw mapGrpcErrorToHttpException(error);
    }
  }

  private createInternalMetadata(): Metadata {
    const metadata = createOutgoingGrpcMetadata();
    metadata.set(INTERNAL_GRPC_AUTH_METADATA_KEY, this.internalSecret);
    return metadata;
  }
}
