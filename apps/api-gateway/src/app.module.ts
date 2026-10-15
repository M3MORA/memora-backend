import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  apiGatewayConfig,
  createServiceConfigModule,
  validateApiGatewayEnv,
} from '@app/config';
import { LoggingInterceptor, ObservabilityModule } from '@app/observability';
import { GatewayThrottlerGuard } from './common/guards/gateway-throttler.guard';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { HealthModule } from './modules/health/health.module';
import { IamModule } from './modules/iam/iam.module';

@Module({
  imports: [
    createServiceConfigModule({
      validate: validateApiGatewayEnv,
      load: [apiGatewayConfig],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        skipIf: () =>
          configService.get<boolean>('apiGateway.throttleDisabled') === true,
        throttlers: [
          {
            name: 'default',
            ttl: 60_000,
            limit: 120,
          },
        ],
      }),
    }),
    ObservabilityModule,
    HealthModule,
    IamModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: GatewayThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTransformInterceptor,
    },
  ],
})
export class AppModule {}
