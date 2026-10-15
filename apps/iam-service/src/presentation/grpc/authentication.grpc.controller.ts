import { Controller, UseGuards } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type {
  AuthenticateGoogleRequest,
  AuthSessionResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LogoutAllRequest,
  LogoutRequest,
  LogoutResponse,
  RefreshTokenRequest,
  RegisterRequest,
  ResendVerificationEmailRequest,
  ResendVerificationEmailResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  UserResponse,
  VerifyEmailRequest,
} from '@app/contracts';
import { AuthenticationService } from '../../application/auth/authentication.service';
import { GoogleAuthService } from '../../application/auth/google-auth.service';
import { EmailVerificationService } from '../../application/auth/email-verification.service';
import { PasswordRecoveryService } from '../../application/auth/password-recovery.service';
import {
  requireCredential,
  requireGoogleIdToken,
  requireText,
} from './grpc-request';
import { InternalGrpcAuthGuard } from './internal-grpc-auth.guard';
import {
  toAuthSessionResponse,
  toPublicUserMessage,
} from './mappers/user.grpc.mapper';

@Controller()
@UseGuards(InternalGrpcAuthGuard)
export class AuthenticationGrpcController {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly googleAuth: GoogleAuthService,
    private readonly emailVerification: EmailVerificationService,
    private readonly passwordRecovery: PasswordRecoveryService,
  ) {}

  @GrpcMethod('IamService', 'Register')
  async register(request: RegisterRequest): Promise<AuthSessionResponse> {
    const session = await this.authentication.registerCustomer({
      fullName: requireText(request.fullName, 'Full name', 150),
      email: requireText(request.email, 'Email', 255),
      password: requireText(request.password, 'Password', 128),
    });
    return toAuthSessionResponse(session);
  }

  @GrpcMethod('IamService', 'AuthenticateGoogle')
  async authenticateGoogle(
    request: AuthenticateGoogleRequest,
  ): Promise<AuthSessionResponse> {
    const session = await this.googleAuth.authenticate(
      requireGoogleIdToken(request.idToken),
    );
    return toAuthSessionResponse(session);
  }

  @GrpcMethod('IamService', 'Login')
  async login(request: LoginRequest): Promise<AuthSessionResponse> {
    const session = await this.authentication.login({
      email: requireText(request.email, 'Email', 255),
      password: requireText(request.password, 'Password', 128),
    });
    return toAuthSessionResponse(session);
  }

  @GrpcMethod('IamService', 'RefreshToken')
  async refreshToken(
    request: RefreshTokenRequest,
  ): Promise<AuthSessionResponse> {
    const session = await this.authentication.refresh(
      requireCredential(request.refreshCredential),
    );
    return toAuthSessionResponse(session);
  }

  @GrpcMethod('IamService', 'Logout')
  async logout(request: LogoutRequest): Promise<LogoutResponse> {
    await this.authentication.logout(
      requireCredential(request.refreshCredential),
    );
    return {};
  }

  @GrpcMethod('IamService', 'LogoutAll')
  async logoutAll(request: LogoutAllRequest): Promise<LogoutResponse> {
    const principal = await this.authentication.verifyAccessToken(
      requireCredential(request.accessCredential),
    );
    await this.authentication.logoutAll(principal.user.id);
    return {};
  }

  @GrpcMethod('IamService', 'VerifyEmail')
  async verifyEmail(request: VerifyEmailRequest): Promise<UserResponse> {
    const user = await this.emailVerification.confirm(
      requireCredential(request.verificationCredential),
    );
    return { user: toPublicUserMessage(user) };
  }

  @GrpcMethod('IamService', 'ResendVerificationEmail')
  async resendVerificationEmail(
    request: ResendVerificationEmailRequest,
  ): Promise<ResendVerificationEmailResponse> {
    const principal = await this.authentication.verifyAccessToken(
      requireCredential(request.accessCredential),
    );
    const result = await this.emailVerification.request(principal.user.id);
    return { alreadyVerified: result.alreadyVerified };
  }

  @GrpcMethod('IamService', 'ForgotPassword')
  async forgotPassword(
    request: ForgotPasswordRequest,
  ): Promise<ForgotPasswordResponse> {
    return this.passwordRecovery.forgotPassword(
      requireText(request.email, 'Email', 255),
    );
  }

  @GrpcMethod('IamService', 'ResetPassword')
  async resetPassword(
    request: ResetPasswordRequest,
  ): Promise<ResetPasswordResponse> {
    await this.passwordRecovery.resetPassword(
      requireCredential(request.recoveryCredential),
      requireText(request.password, 'Password', 128),
    );
    return {};
  }
}
