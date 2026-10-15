import { Module } from '@nestjs/common';
import { RedisModule } from '../persistence/redis/redis.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { AccessTokenService } from './auth/access-token.service';
import { AuthenticationService } from './auth/authentication.service';
import { GoogleAuthService } from './auth/google-auth.service';
import { GoogleIdTokenVerifier } from './auth/google-id-token.verifier';
import { EMAIL_SENDER, UnconfiguredEmailSender } from './auth/email-sender';
import { EmailVerificationService } from './auth/email-verification.service';
import { PasswordHasher } from './auth/password-hasher';
import { PasswordRecoveryService } from './auth/password-recovery.service';
import { RefreshTokenService } from './auth/refresh-token.service';
import { AuthorizationService } from './authorization/authorization.service';
import { CustomerIdentitiesService } from './users/customer-identities.service';
import { UsersService } from './users/users.service';

@Module({
  imports: [RepositoriesModule, RedisModule],
  providers: [
    UsersService,
    CustomerIdentitiesService,
    AuthorizationService,
    PasswordHasher,
    AccessTokenService,
    RefreshTokenService,
    AuthenticationService,
    GoogleIdTokenVerifier,
    GoogleAuthService,
    {
      provide: EMAIL_SENDER,
      useClass: UnconfiguredEmailSender,
    },
    EmailVerificationService,
    PasswordRecoveryService,
  ],
  exports: [
    UsersService,
    CustomerIdentitiesService,
    AuthorizationService,
    AuthenticationService,
    GoogleAuthService,
    EmailVerificationService,
    PasswordRecoveryService,
  ],
})
export class ApplicationModule {}
