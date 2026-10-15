import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  createServiceConfigModule,
  iamConfig,
  validateIamEnv,
} from '@app/config';
import { LoggingInterceptor, ObservabilityModule } from '@app/observability';
import { ApplicationModule } from './application/application.module';
import { PrismaModule } from './persistence/prisma/prisma.module';
import { RedisModule } from './persistence/redis/redis.module';
import { IamReadinessService } from './application/ops/iam-readiness.service';
import { AccountGrpcController } from './presentation/grpc/account.grpc.controller';
import { AuthenticationGrpcController } from './presentation/grpc/authentication.grpc.controller';
import { AuthorizationGrpcController } from './presentation/grpc/authorization.grpc.controller';
import { GrpcHealthController } from './presentation/grpc/health.grpc.controller';
import { InternalGrpcAuthGuard } from './presentation/grpc/internal-grpc-auth.guard';

@Module({
  imports: [
    createServiceConfigModule({
      validate: validateIamEnv,
      load: [iamConfig],
    }),
    ObservabilityModule,
    PrismaModule,
    RedisModule,
    ApplicationModule,
  ],
  controllers: [
    AuthenticationGrpcController,
    AccountGrpcController,
    AuthorizationGrpcController,
    GrpcHealthController,
  ],
  providers: [
    IamReadinessService,
    InternalGrpcAuthGuard,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class IamServiceModule {}
