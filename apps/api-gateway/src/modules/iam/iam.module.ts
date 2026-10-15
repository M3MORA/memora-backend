import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthorizationModule, PermissionsGuard, RolesGuard } from '@app/auth';
import {
  GoogleOAuthModule,
  SignedCookieOAuthStateStore,
} from '@app/auth/google-oauth';
import type { CookieSameSite } from '@app/config';
import { AuthCookieService } from './auth/cookies/auth-cookie.service';
import { AuthController } from './auth/controllers/auth.controller';
import { GoogleOAuthController } from './auth/controllers/google-oauth.controller';
import { GoogleOAuthRedirectFilter } from './auth/filters/google-oauth-redirect.filter';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { HttpPrincipalResolver } from './authorization/http-principal.resolver';
import { IamGrpcPermissionResolver } from './authorization/iam-grpc-permission.resolver';
import { IamClientsModule } from './clients/iam-clients.module';

@Module({
  imports: [
    IamClientsModule,
    AuthorizationModule.forRoot({
      principalResolver: HttpPrincipalResolver,
      permissionResolver: IamGrpcPermissionResolver,
      imports: [IamClientsModule],
    }),
    GoogleOAuthModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const enabled =
          configService.get<boolean>('apiGateway.googleOAuthEnabled') === true;
        const sameSite = configService.getOrThrow<CookieSameSite>(
          'apiGateway.cookieSameSite',
        );
        const nodeEnv = configService.getOrThrow<string>('apiGateway.nodeEnv');
        const domain = configService.get<string>('apiGateway.cookieDomain');
        if (!enabled) {
          return {
            enabled: false,
            clientId: 'disabled',
            clientSecret: 'disabled-secret',
            callbackUrl: 'http://127.0.0.1/disabled',
            stateTtlSeconds: 600,
          };
        }
        return {
          enabled: true,
          clientId: configService.getOrThrow<string>(
            'apiGateway.googleClientId',
          ),
          clientSecret: configService.getOrThrow<string>(
            'apiGateway.googleClientSecret',
          ),
          callbackUrl: configService.getOrThrow<string>(
            'apiGateway.googleCallbackUrl',
          ),
          stateTtlSeconds: configService.getOrThrow<number>(
            'apiGateway.googleOAuthStateTtlSeconds',
          ),
          stateStore: new SignedCookieOAuthStateStore({
            cookieName: configService.getOrThrow<string>(
              'apiGateway.googleOAuthStateCookieName',
            ),
            secret: configService.getOrThrow<string>(
              'apiGateway.googleOAuthStateSecret',
            ),
            cookie: {
              path: configService.getOrThrow<string>('apiGateway.cookiePath'),
              sameSite,
              secure: nodeEnv === 'production' || sameSite === 'none',
              ...(domain === undefined ? {} : { domain }),
            },
          }),
        };
      },
    }),
  ],
  controllers: [AuthController, GoogleOAuthController],
  providers: [
    AuthCookieService,
    GoogleOAuthRedirectFilter,
    JwtAuthGuard,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class IamModule {}
