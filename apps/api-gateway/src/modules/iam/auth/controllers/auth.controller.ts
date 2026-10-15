import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public, SuccessMessage } from '@app/common';
import type { Request, Response } from 'express';
import { AuthCookieService } from '../cookies/auth-cookie.service';
import type { GatewayAuthenticatedPrincipal } from '../gateway-principal';
import { IamGrpcClient } from '../../clients/iam-grpc.client';
import {
  ApiAcceptedDocs,
  ApiAuthSessionDocs,
  ApiCookieCsrfDocs,
  ApiLogoutDocs,
  ApiMeDocs,
  ApiResendVerificationDocs,
  ApiUserDocs,
} from '../docs/auth.swagger';
import { ForgotPasswordRequestDto } from '../dto/request/forgot-password.request.dto';
import { LoginRequestDto } from '../dto/request/login.request.dto';
import { RegisterRequestDto } from '../dto/request/register.request.dto';
import { ResetPasswordRequestDto } from '../dto/request/reset-password.request.dto';
import { VerifyEmailRequestDto } from '../dto/request/verify-email.request.dto';
import type { AuthSessionResponseDto } from '../dto/response/auth-session.response.dto';
import { CsrfTokenResponseDto } from '../dto/response/csrf-token.response.dto';
import {
  toAuthSessionHttp,
  toPublicUserResponse,
} from '../mappers/auth-http.mapper';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly iam: IamGrpcClient,
    private readonly cookies: AuthCookieService,
  ) {}

  @Post('register')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @HttpCode(201)
  @SuccessMessage('Registered')
  @ApiAuthSessionDocs('Register a local customer account')
  async register(
    @Body() body: RegisterRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponseDto> {
    const session = await this.iam.register({
      fullName: body.fullName,
      email: body.email,
      password: body.password,
    });
    this.cookies.attachSession(
      response,
      session.refreshCredential,
      session.refreshExpiresInSeconds,
    );
    return toAuthSessionHttp(session);
  }

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @HttpCode(200)
  @SuccessMessage('Authenticated')
  @ApiAuthSessionDocs('Log in with email and password')
  async login(
    @Body() body: LoginRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponseDto> {
    const session = await this.iam.login({
      email: body.email,
      password: body.password,
    });
    this.cookies.attachSession(
      response,
      session.refreshCredential,
      session.refreshExpiresInSeconds,
    );
    return toAuthSessionHttp(session);
  }

  @Get('csrf')
  @Public()
  @HttpCode(200)
  @SuccessMessage('CSRF token')
  @ApiOperation({
    summary:
      'Return the CSRF cookie value for session bootstrap after OAuth (requires refresh cookie)',
  })
  csrf(@Req() request: Request): CsrfTokenResponseDto {
    return { csrfToken: this.cookies.readCsrfToken(request) };
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  @SuccessMessage('Refreshed')
  @ApiCookieCsrfDocs('Rotate the refresh session using the HttpOnly cookie')
  @ApiAuthSessionDocs('Rotate the refresh session using the HttpOnly cookie')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponseDto> {
    this.cookies.assertCsrf(request);
    const session = await this.iam.refreshToken(
      this.cookies.readRefreshCredential(request),
    );
    this.cookies.attachSession(
      response,
      session.refreshCredential,
      session.refreshExpiresInSeconds,
    );
    return toAuthSessionHttp(session);
  }

  @Post('logout')
  @Public()
  @HttpCode(200)
  @SuccessMessage('Signed out')
  @ApiCookieCsrfDocs('Revoke the current refresh session')
  @ApiLogoutDocs('Revoke the current refresh session')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<null> {
    this.cookies.assertCsrf(request);
    await this.iam.logout(this.cookies.readRefreshCredential(request));
    this.cookies.clearSession(response);
    return null;
  }

  @Post('logout-all')
  @HttpCode(200)
  @SuccessMessage('Signed out everywhere')
  @ApiLogoutDocs('Revoke every refresh session for the authenticated user')
  async logoutAll(
    @CurrentUser() principal: GatewayAuthenticatedPrincipal | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<null> {
    if (principal === undefined) {
      throw new UnauthorizedException();
    }
    await this.iam.logoutAll(principal.accessCredential);
    this.cookies.clearSession(response);
    return null;
  }

  @Get('me')
  @ApiMeDocs()
  async me(
    @CurrentUser() principal: GatewayAuthenticatedPrincipal | undefined,
  ) {
    if (principal === undefined) {
      throw new UnauthorizedException();
    }
    const result = await this.iam.getCurrentUser(principal.accessCredential);
    return toPublicUserResponse(result.user);
  }

  @Post('verify-email')
  @Public()
  @HttpCode(200)
  @ApiUserDocs('Confirm email verification')
  async verifyEmail(@Body() body: VerifyEmailRequestDto) {
    const result = await this.iam.verifyEmail(body.verificationCredential);
    return toPublicUserResponse(result.user);
  }

  @Post('resend-verification')
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @HttpCode(200)
  @ApiResendVerificationDocs()
  async resendVerification(
    @CurrentUser() principal: GatewayAuthenticatedPrincipal | undefined,
  ) {
    if (principal === undefined) {
      throw new UnauthorizedException();
    }
    return this.iam.resendVerificationEmail(principal.accessCredential);
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @HttpCode(200)
  @ApiAcceptedDocs('Request a password reset email')
  forgotPassword(@Body() body: ForgotPasswordRequestDto) {
    return this.iam.forgotPassword(body.email);
  }

  @Post('reset-password')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @HttpCode(200)
  @SuccessMessage('Password updated')
  @ApiLogoutDocs('Reset password with a recovery credential')
  async resetPassword(@Body() body: ResetPasswordRequestDto): Promise<null> {
    await this.iam.resetPassword(body.recoveryCredential, body.password);
    return null;
  }
}
