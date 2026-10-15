// Contract gRPC của IAM, khớp proto/iam/v1/iam.proto.
// RPC mới: thêm message trong proto, rồi thêm method vào IamServiceHandler.
// Phía Gateway khai báo stub Observable ngay trong grpc client, cùng chỗ gọi .pipe().

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthenticateGoogleRequest {
  idToken: string;
}

export interface RefreshTokenRequest {
  refreshCredential: string;
}

export interface LogoutRequest {
  refreshCredential: string;
}

export interface LogoutAllRequest {
  accessCredential: string;
}

export type LogoutResponse = Record<string, never>;

export interface VerifyEmailRequest {
  verificationCredential: string;
}

export interface ResendVerificationEmailRequest {
  accessCredential: string;
}

export interface ResendVerificationEmailResponse {
  alreadyVerified: boolean;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  accepted: boolean;
}

export interface ResetPasswordRequest {
  recoveryCredential: string;
  password: string;
}

export type ResetPasswordResponse = Record<string, never>;

export interface GetCurrentUserRequest {
  accessCredential: string;
}

export interface GetUserByIdRequest {
  userId: string;
}

export interface UserResponse {
  user: PublicUserMessage;
}

export interface ValidateAccessTokenRequest {
  accessCredential: string;
}

export interface AccessPrincipalResponse {
  userId: string;
  tokenId: string;
  emailVerified: boolean;
}

export interface CheckRolesRequest {
  accessCredential: string;
  roleCodes: string[];
}

export interface CheckPermissionsRequest {
  accessCredential: string;
  permissionCodes: string[];
}

export interface AuthorizationDecisionResponse {
  allowed: boolean;
  userId: string;
}

export interface AuthSessionResponse {
  user: PublicUserMessage;
  accessCredential: string;
  refreshCredential: string;
  tokenType: string;
  expiresInSeconds: number;
  refreshExpiresInSeconds: number;
}

export interface PublicUserMessage {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  authProvider: string;
  status: string;
  emailVerifiedAt?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IamServiceHandler {
  register(request: RegisterRequest): Promise<AuthSessionResponse>;
  login(request: LoginRequest): Promise<AuthSessionResponse>;
  authenticateGoogle(
    request: AuthenticateGoogleRequest,
  ): Promise<AuthSessionResponse>;
  refreshToken(request: RefreshTokenRequest): Promise<AuthSessionResponse>;
  logout(request: LogoutRequest): Promise<LogoutResponse>;
  logoutAll(request: LogoutAllRequest): Promise<LogoutResponse>;
  verifyEmail(request: VerifyEmailRequest): Promise<UserResponse>;
  resendVerificationEmail(
    request: ResendVerificationEmailRequest,
  ): Promise<ResendVerificationEmailResponse>;
  forgotPassword(
    request: ForgotPasswordRequest,
  ): Promise<ForgotPasswordResponse>;
  resetPassword(request: ResetPasswordRequest): Promise<ResetPasswordResponse>;
  getCurrentUser(request: GetCurrentUserRequest): Promise<UserResponse>;
  getUserById(request: GetUserByIdRequest): Promise<UserResponse>;
  validateAccessToken(
    request: ValidateAccessTokenRequest,
  ): Promise<AccessPrincipalResponse>;
  checkRoles(
    request: CheckRolesRequest,
  ): Promise<AuthorizationDecisionResponse>;
  checkPermissions(
    request: CheckPermissionsRequest,
  ): Promise<AuthorizationDecisionResponse>;
}
